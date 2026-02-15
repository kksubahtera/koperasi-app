import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SHUDistributionResult, MemberSHUDistribution, getCooperativeSettings } from '@/lib/cooperativeSettings';
import { toast } from 'sonner';
import { useSHUJournalEntry } from './useSHUJournalEntry';
import { useSHUWithheldJournal } from './useSHUWithheldJournal';

export interface MemberSHUData {
  memberId: string;
  memberName: string;
  simpananPokok: number;
  simpananWajib: number;
  totalSimpanan: number;
  kontribusiBunga: number;
  kontribusiUsaha: number;
  detailUsaha: { unitCode: string; unitName: string; total: number }[];
  // Arrears info
  hasArrears: boolean;
  arrearsAmount: number;
  overdueInstallmentsCount: number;
  // Exited member info
  isExitedMember?: boolean;
  exitDate?: string;
  joinDate?: string;
  activeMonths?: number;
  proportionFactor?: number;
}

export interface RoleAssignment {
  id: string;
  name: string;
  role: 'pengurus' | 'pengawas' | 'penasihat';
  position: string | null;
  is_member: boolean;
  member_id: string | null;
  share_percentage: number;
}

// Default positions for pengurus role
export const DEFAULT_PENGURUS_POSITIONS = [
  'Ketua',
  'Wakil Ketua',
  'Sekretaris',
  'Bendahara',
] as const;

// Positions that can sign official letters
export const SIGNATORY_POSITIONS = [
  'Ketua',
  'Wakil Ketua',
  'Sekretaris',
  'Bendahara',
] as const;

export interface ManualExclusion {
  memberId: string;
  excluded: boolean;
  note?: string;
}

/**
 * Hook untuk menghitung distribusi SHU dengan deteksi tunggakan
 */
export const useSHUCalculation = (year: number, shuBruto: number) => {
  const [distribution, setDistribution] = useState<SHUDistributionResult | null>(null);
  const [memberData, setMemberData] = useState<MemberSHUData[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
  const [manualExclusions, setManualExclusions] = useState<ManualExclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const { createSHUJournalEntry, validateAccountsExist } = useSHUJournalEntry();
  const { createWithholdingJournal, ensureAccountsExist } = useSHUWithheldJournal();

  // Toggle manual exclusion for a member
  const toggleManualExclusion = useCallback((memberId: string, excluded: boolean, note?: string) => {
    setManualExclusions(prev => {
      const existing = prev.findIndex(e => e.memberId === memberId);
      if (existing >= 0) {
        if (!excluded) {
          return prev.filter(e => e.memberId !== memberId);
        }
        const updated = [...prev];
        updated[existing] = { memberId, excluded, note };
        return updated;
      }
      if (excluded) {
        return [...prev, { memberId, excluded, note }];
      }
      return prev;
    });
  }, []);

  const calculateSHU = useCallback(async () => {
    if (shuBruto <= 0) {
      setDistribution(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const settings = getCooperativeSettings();
      const shuSettings = settings.shuDistribution;
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // 1. Fetch all active members with their savings
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, join_date')
        .eq('is_active', true)
        .eq('approval_status', 'approved');

      // 1b. Fetch exited member SHU settings
      const { data: exitedMemberSettings } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', [
          'exited_member_shu_enabled',
          'exited_member_shu_calculation',
          'exited_member_shu_fallback'
        ]);

      const exitedSettingsMap = new Map(exitedMemberSettings?.map(d => [d.key, d.value]) || []);
      const exitedMemberSHUEnabled = exitedSettingsMap.get('exited_member_shu_enabled') === true || 
                                      exitedSettingsMap.get('exited_member_shu_enabled') === 'true';
      const exitedMemberCalculation = (exitedSettingsMap.get('exited_member_shu_calculation') as string) || 'pro_rata';
      const exitedMemberFallback = (exitedSettingsMap.get('exited_member_shu_fallback') as string) || 'reserve_fund';

      // 1c. Fetch exited members for this year (if enabled)
      let exitedMembers: { user_id: string; name: string; exit_date: string; join_date: string | null }[] = [];
      if (exitedMemberSHUEnabled) {
        const { data: exitedProfiles } = await supabase
          .from('profiles')
          .select('user_id, name, exit_date, join_date')
          .eq('is_active', false)
          .eq('exit_year', year);
        
        exitedMembers = (exitedProfiles || []).map(p => ({
          user_id: p.user_id,
          name: p.name,
          exit_date: p.exit_date || `${year}-12-31`,
          join_date: p.join_date
        }));
      }

      const { data: savingsData } = await supabase
        .from('savings_summary')
        .select('user_id, simpanan_pokok, simpanan_wajib');

      // 2. Fetch loan interest paid by each member this year
      const { data: loans } = await supabase
        .from('loans')
        .select('id, user_id, status');

      const loansByUser = new Map<string, string[]>();
      const activeLoansByUser = new Map<string, string[]>();
      loans?.forEach(loan => {
        const existing = loansByUser.get(loan.user_id) || [];
        existing.push(loan.id);
        loansByUser.set(loan.user_id, existing);
        
        if (loan.status === 'active') {
          const activeLoans = activeLoansByUser.get(loan.user_id) || [];
          activeLoans.push(loan.id);
          activeLoansByUser.set(loan.user_id, activeLoans);
        }
      });

      // Fetch installments paid this year
      const { data: paidInstallments } = await supabase
        .from('loan_installments')
        .select('loan_id, interest_amount')
        .eq('status', 'paid')
        .gte('paid_date', startDate)
        .lte('paid_date', endDate);

      // Fetch overdue installments for arrears detection
      const { data: overdueInstallments } = await supabase
        .from('loan_installments')
        .select('loan_id, principal_amount, interest_amount, penalty_amount')
        .eq('status', 'overdue');

      // Map loan_id to interest amount
      const interestByLoan = new Map<string, number>();
      paidInstallments?.forEach(inst => {
        const current = interestByLoan.get(inst.loan_id) || 0;
        interestByLoan.set(inst.loan_id, current + (inst.interest_amount || 0));
      });

      // Calculate interest contribution per user
      const interestByUser = new Map<string, number>();
      loansByUser.forEach((loanIds, userId) => {
        let totalInterest = 0;
        loanIds.forEach(loanId => {
          totalInterest += interestByLoan.get(loanId) || 0;
        });
        interestByUser.set(userId, totalInterest);
      });

      // Calculate arrears per user
      const arrearsByUser = new Map<string, { amount: number; count: number }>();
      overdueInstallments?.forEach(inst => {
        // Find which user owns this loan
        let foundUser: string | null = null;
        activeLoansByUser.forEach((loanIds, userId) => {
          if (loanIds.includes(inst.loan_id)) {
            foundUser = userId;
          }
        });
        
        if (foundUser) {
          const existing = arrearsByUser.get(foundUser) || { amount: 0, count: 0 };
          existing.amount += (inst.principal_amount || 0) + (inst.interest_amount || 0) + (inst.penalty_amount || 0);
          existing.count += 1;
          arrearsByUser.set(foundUser, existing);
        }
      });

      // 3. Fetch business unit transactions (non-SP units)
      const { data: businessUnits } = await supabase
        .from('business_units')
        .select('id, code, name')
        .neq('code', 'SP');

      const nonSpUnitIds = (businessUnits || []).map(u => u.id);
      const unitMap = new Map((businessUnits || []).map(u => [u.id, { code: u.code, name: u.name }]));

      const { data: buTransactions } = await supabase
        .from('business_unit_transactions')
        .select('user_id, business_unit_id, amount')
        .eq('is_member_transaction', true)
        .in('business_unit_id', nonSpUnitIds.length > 0 ? nonSpUnitIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      // Calculate business unit transaction totals per user
      const usahaByUser = new Map<string, { total: number; details: { unitCode: string; unitName: string; total: number }[] }>();
      (buTransactions || []).forEach(t => {
        const existing = usahaByUser.get(t.user_id) || { total: 0, details: [] };
        existing.total += t.amount;
        
        const unitInfo = unitMap.get(t.business_unit_id);
        if (unitInfo) {
          const detailIdx = existing.details.findIndex(d => d.unitCode === unitInfo.code);
          if (detailIdx >= 0) {
            existing.details[detailIdx].total += t.amount;
          } else {
            existing.details.push({ unitCode: unitInfo.code, unitName: unitInfo.name, total: t.amount });
          }
        }
        
        usahaByUser.set(t.user_id, existing);
      });

      // 4. Fetch existing manual exclusions from shu_withheld
      const { data: withheldData } = await supabase
        .from('shu_withheld')
        .select('user_id, manual_exclusion, exclusion_note')
        .eq('year', year)
        .eq('manual_exclusion', true);

      const existingExclusions = (withheldData || []).map(w => ({
        memberId: w.user_id,
        excluded: true,
        note: w.exclusion_note || undefined,
      }));

      // Merge with local state
      const allExclusions: ManualExclusion[] = [...existingExclusions];
      manualExclusions.forEach(me => {
        const existingIdx = allExclusions.findIndex(e => e.memberId === me.memberId);
        if (existingIdx >= 0) {
          allExclusions[existingIdx] = { ...allExclusions[existingIdx], ...me };
        } else {
          allExclusions.push(me);
        }
      });

      // 5. Build member data with arrears info
      const members: MemberSHUData[] = [];
      
      // Helper function to calculate active months
      const calculateActiveMonths = (joinDateStr: string | null, exitDateStr: string | null): { activeMonths: number; proportionFactor: number } => {
        const yearStart = new Date(`${year}-01-01`);
        const yearEnd = new Date(`${year}-12-31`);
        const joinDate = joinDateStr ? new Date(joinDateStr) : yearStart;
        const exitDate = exitDateStr ? new Date(exitDateStr) : yearEnd;
        
        const effectiveStart = joinDate > yearStart ? joinDate : yearStart;
        const effectiveEnd = exitDate < yearEnd ? exitDate : yearEnd;
        
        const monthsDiff = (effectiveEnd.getFullYear() - effectiveStart.getFullYear()) * 12 +
                           (effectiveEnd.getMonth() - effectiveStart.getMonth()) + 1;
        const activeMonths = Math.max(0, Math.min(12, monthsDiff));
        const proportionFactor = activeMonths / 12;
        
        return { activeMonths, proportionFactor };
      };

      // Add active members
      profiles?.forEach(profile => {
        const savings = savingsData?.find(s => s.user_id === profile.user_id);
        const simpananPokok = savings?.simpanan_pokok || 0;
        const simpananWajib = savings?.simpanan_wajib || 0;
        const usahaData = usahaByUser.get(profile.user_id) || { total: 0, details: [] };
        const arrearsData = arrearsByUser.get(profile.user_id) || { amount: 0, count: 0 };
        
        members.push({
          memberId: profile.user_id,
          memberName: profile.name,
          simpananPokok,
          simpananWajib,
          totalSimpanan: simpananPokok + simpananWajib,
          kontribusiBunga: interestByUser.get(profile.user_id) || 0,
          kontribusiUsaha: usahaData.total,
          detailUsaha: usahaData.details,
          hasArrears: arrearsData.amount > 0,
          arrearsAmount: arrearsData.amount,
          overdueInstallmentsCount: arrearsData.count,
          isExitedMember: false,
          joinDate: profile.join_date || undefined,
          activeMonths: 12,
          proportionFactor: 1,
        });
      });

      // Add exited members (if enabled and have any)
      if (exitedMemberSHUEnabled && exitedMembers.length > 0) {
        exitedMembers.forEach(exitedMember => {
          // Get their savings data (might have been zeroed out, check resignation_requests)
          const savings = savingsData?.find(s => s.user_id === exitedMember.user_id);
          const usahaData = usahaByUser.get(exitedMember.user_id) || { total: 0, details: [] };
          const arrearsData = arrearsByUser.get(exitedMember.user_id) || { amount: 0, count: 0 };
          
          // Calculate active months based on calculation method
          const { activeMonths, proportionFactor } = calculateActiveMonths(
            exitedMember.join_date,
            exitedMember.exit_date
          );

          // For exited members, we might need to get historical savings from resignation_requests
          // This is a simplified version - in production you might want to store historical data
          let simpananPokok = savings?.simpanan_pokok || 0;
          let simpananWajib = savings?.simpanan_wajib || 0;
          
          members.push({
            memberId: exitedMember.user_id,
            memberName: `${exitedMember.name} (Keluar)`,
            simpananPokok,
            simpananWajib,
            totalSimpanan: simpananPokok + simpananWajib,
            kontribusiBunga: interestByUser.get(exitedMember.user_id) || 0,
            kontribusiUsaha: usahaData.total,
            detailUsaha: usahaData.details,
            hasArrears: arrearsData.amount > 0,
            arrearsAmount: arrearsData.amount,
            overdueInstallmentsCount: arrearsData.count,
            isExitedMember: true,
            exitDate: exitedMember.exit_date,
            joinDate: exitedMember.join_date || undefined,
            activeMonths,
            proportionFactor: exitedMemberCalculation === 'pro_rata' ? proportionFactor : 1,
          });
        });
      }

      setMemberData(members);

      // 6. Fetch role assignments
      const { data: roles } = await supabase
        .from('role_assignments')
        .select('*');

      const typedRoles: RoleAssignment[] = (roles || []).map(r => ({
        id: r.id,
        name: r.name,
        role: r.role as 'pengurus' | 'pengawas' | 'penasihat',
        position: r.position,
        is_member: r.is_member,
        member_id: r.member_id,
        share_percentage: r.share_percentage,
      }));
      setRoleAssignments(typedRoles);

      // 7. Calculate distribution
      const shuAnggotaTotal = shuBruto * (shuSettings.shuAnggota / 100);
      const shuAnggotaSimpanan = shuAnggotaTotal * (shuSettings.shuAnggotaSimpanan / 100);
      const shuAnggotaJasaUsaha = shuAnggotaTotal * (shuSettings.shuAnggotaJasaUsaha / 100);
      const shuPengurus = shuBruto * (shuSettings.shuPengurus / 100);
      const shuPengawas = shuBruto * (shuSettings.shuPengawas / 100);
      const shuPenasihat = shuBruto * (shuSettings.shuPenasihat / 100);
      const danaCadangan = shuBruto * (shuSettings.danaCadangan / 100);
      const danaPendidikan = shuBruto * (shuSettings.danaPendidikan / 100);
      const danaSosial = shuBruto * (shuSettings.danaSosial / 100);
      const danaPembangunan = shuBruto * (shuSettings.danaPembangunan / 100);

      // 8. Calculate per-member distributions with arrears/exclusion status
      const totalSimpananAll = members.reduce((sum, m) => sum + m.totalSimpanan, 0);
      const totalKontribusiUsaha = members.reduce((sum, m) => sum + m.kontribusiBunga + m.kontribusiUsaha, 0);

      let totalWithheldSHU = 0;
      let withheldMembersCount = 0;

      const memberDistributions: MemberSHUDistribution[] = members.map(member => {
        // Base calculation
        let simpananShare = totalSimpananAll > 0 
          ? (member.totalSimpanan / totalSimpananAll) * shuAnggotaSimpanan 
          : 0;
        const kontribusiTotal = member.kontribusiBunga + member.kontribusiUsaha;
        let jasaUsahaShare = totalKontribusiUsaha > 0 
          ? (kontribusiTotal / totalKontribusiUsaha) * shuAnggotaJasaUsaha 
          : 0;

        // Apply proportion factor for exited members (pro-rata calculation)
        if (member.isExitedMember && member.proportionFactor !== undefined) {
          simpananShare = simpananShare * member.proportionFactor;
          jasaUsahaShare = jasaUsahaShare * member.proportionFactor;
        }

        const totalShare = simpananShare + jasaUsahaShare;

        // Check for arrears and manual exclusion
        const hasArrears = member.hasArrears;
        const manualExclusion = allExclusions.find(e => e.memberId === member.memberId && e.excluded);
        const isExcluded = hasArrears || !!manualExclusion;
        const isWithheld = isExcluded && totalShare > 0;

        if (isWithheld) {
          totalWithheldSHU += totalShare;
          withheldMembersCount += 1;
        }

        return {
          memberId: member.memberId,
          memberName: member.memberName,
          simpananShare,
          jasaUsahaShare,
          totalShare,
          hasArrears,
          arrearsAmount: member.arrearsAmount,
          isExcluded,
          exclusionReason: manualExclusion ? 'manual' : (hasArrears ? 'arrears' : undefined),
          exclusionNote: manualExclusion?.note,
          isWithheld,
          // Additional info for exited members
          isExitedMember: member.isExitedMember,
          activeMonths: member.activeMonths,
          proportionFactor: member.proportionFactor,
        };
      });

      // 9. Calculate role distributions
      const roleGroups = {
        pengurus: typedRoles.filter(r => r.role === 'pengurus'),
        pengawas: typedRoles.filter(r => r.role === 'pengawas'),
        penasihat: typedRoles.filter(r => r.role === 'penasihat'),
      };

      const roleDistributions: SHUDistributionResult['roleDistributions'] = [];

      const distributeToRole = (
        roleList: RoleAssignment[], 
        totalAmount: number, 
        roleName: 'pengurus' | 'pengawas' | 'penasihat'
      ) => {
        const totalPercentage = roleList.reduce((sum, r) => sum + r.share_percentage, 0);
        roleList.forEach(r => {
          const amount = totalPercentage > 0 
            ? (r.share_percentage / totalPercentage) * totalAmount 
            : totalAmount / roleList.length;
          roleDistributions.push({
            assignmentId: r.id,
            name: r.name,
            role: roleName,
            isMember: r.is_member,
            amount,
          });
        });
      };

      distributeToRole(roleGroups.pengurus, shuPengurus, 'pengurus');
      distributeToRole(roleGroups.pengawas, shuPengawas, 'pengawas');
      distributeToRole(roleGroups.penasihat, shuPenasihat, 'penasihat');

      const result: SHUDistributionResult = {
        year,
        shuBruto,
        shuAnggotaTotal,
        shuAnggotaSimpanan,
        shuAnggotaJasaUsaha,
        shuPengurus,
        shuPengawas,
        shuPenasihat,
        danaCadangan,
        danaPendidikan,
        danaSosial,
        danaPembangunan,
        memberDistributions,
        roleDistributions,
        status: 'draft',
        totalWithheldSHU,
        withheldMembersCount,
      };

      setDistribution(result);
    } catch (error) {
      console.error('Error calculating SHU:', error);
      toast.error('Gagal menghitung SHU');
    } finally {
      setLoading(false);
    }
  }, [year, shuBruto, manualExclusions]);

  useEffect(() => {
    calculateSHU();
  }, [calculateSHU]);

  // Confirm and save SHU distribution
  const confirmDistribution = async () => {
    if (!distribution) return false;

    try {
      // Validate accounts first
      const { valid, missingAccounts } = await validateAccountsExist(distribution);
      
      if (!valid && missingAccounts.length > 0) {
        toast.warning(`Akun berikut belum tersedia untuk jurnal otomatis: ${missingAccounts.join(', ')}`, {
          description: 'Distribusi akan disimpan tapi jurnal tidak akan dibuat otomatis.',
          duration: 6000,
        });
      }
      
      // Check if already exists
      const { data: existing } = await supabase
        .from('shu_distributions')
        .select('id')
        .eq('year', year)
        .maybeSingle();

      // Convert memberDistributions to JSON-compatible format
      const memberDistributionsJson = distribution.memberDistributions.map(m => ({
        memberId: m.memberId,
        memberName: m.memberName,
        simpananShare: m.simpananShare,
        jasaUsahaShare: m.jasaUsahaShare,
        totalShare: m.totalShare,
        hasArrears: m.hasArrears,
        arrearsAmount: m.arrearsAmount,
        isExcluded: m.isExcluded,
        exclusionReason: m.exclusionReason || null,
        exclusionNote: m.exclusionNote || null,
        isWithheld: m.isWithheld,
      }));

      let error;
      if (existing) {
        const result = await supabase
          .from('shu_distributions')
          .update({
            shu_bruto: distribution.shuBruto,
            shu_anggota_total: distribution.shuAnggotaTotal,
            shu_anggota_simpanan: distribution.shuAnggotaSimpanan,
            shu_anggota_jasa_pinjaman: distribution.shuAnggotaJasaUsaha,
            shu_pengurus: distribution.shuPengurus,
            shu_pengawas: distribution.shuPengawas,
            shu_penasihat: distribution.shuPenasihat,
            dana_cadangan: distribution.danaCadangan,
            dana_pendidikan: distribution.danaPendidikan || 0,
            dana_sosial: distribution.danaSosial || 0,
            dana_pembangunan: distribution.danaPembangunan || 0,
            member_distributions: JSON.parse(JSON.stringify(memberDistributionsJson)),
            role_distributions: JSON.parse(JSON.stringify(distribution.roleDistributions)),
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('year', year);
        error = result.error;
      } else {
        const result = await supabase
          .from('shu_distributions')
          .insert([{
            year,
            shu_bruto: distribution.shuBruto,
            shu_anggota_total: distribution.shuAnggotaTotal,
            shu_anggota_simpanan: distribution.shuAnggotaSimpanan,
            shu_anggota_jasa_pinjaman: distribution.shuAnggotaJasaUsaha,
            shu_pengurus: distribution.shuPengurus,
            shu_pengawas: distribution.shuPengawas,
            shu_penasihat: distribution.shuPenasihat,
            dana_cadangan: distribution.danaCadangan,
            dana_pendidikan: distribution.danaPendidikan || 0,
            dana_sosial: distribution.danaSosial || 0,
            dana_pembangunan: distribution.danaPembangunan || 0,
            member_distributions: JSON.parse(JSON.stringify(memberDistributionsJson)),
            role_distributions: JSON.parse(JSON.stringify(distribution.roleDistributions)),
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          }]);
        error = result.error;
      }

      if (error) throw error;

      // Handle distributed vs withheld members separately
      const distributedMembers = distribution.memberDistributions.filter(m => !m.isWithheld && m.totalShare > 0);
      const withheldMembers = distribution.memberDistributions.filter(m => m.isWithheld && m.totalShare > 0);

      // Create SHU records for distributed members only
      const shuRecords = distributedMembers.map(m => ({
        user_id: m.memberId,
        year,
        amount: m.totalShare,
        notes: `SHU Simpanan: ${m.simpananShare.toFixed(0)}, SHU Jasa Usaha: ${m.jasaUsahaShare.toFixed(0)}`,
        distributed_at: new Date().toISOString(),
      }));

      // Delete existing records for this year first
      await supabase.from('shu_records').delete().eq('year', year);

      // Insert new records for distributed members
      if (shuRecords.length > 0) {
        const { error: recordsError } = await supabase
          .from('shu_records')
          .insert(shuRecords);
        
        if (recordsError) {
          console.error('Error creating SHU records:', recordsError);
        }
      }

      // Save withheld SHU records
      for (const member of withheldMembers) {
        const { error: withheldError } = await supabase
          .from('shu_withheld')
          .upsert({
            user_id: member.memberId,
            year,
            shu_amount: member.totalShare,
            simpanan_share: member.simpananShare,
            jasa_usaha_share: member.jasaUsahaShare,
            arrears_amount: member.arrearsAmount,
            withhold_reason: member.exclusionReason || 'arrears',
            manual_exclusion: member.exclusionReason === 'manual',
            exclusion_note: member.exclusionNote,
            status: 'withheld',
          }, {
            onConflict: 'user_id,year',
          });

        if (withheldError) {
          console.error('Error saving withheld SHU:', withheldError);
        }
      }

      // Create notifications for distributed members
      const memberNotifications = distributedMembers.map(m => ({
        user_id: m.memberId,
        title: `SHU Tahun ${year} Telah Dibagikan`,
        message: `Selamat! Anda mendapatkan SHU sebesar Rp ${m.totalShare.toLocaleString('id-ID')} (Simpanan: Rp ${m.simpananShare.toLocaleString('id-ID')}, Jasa Usaha: Rp ${m.jasaUsahaShare.toLocaleString('id-ID')})`,
        notification_type: 'shu_distribution',
        metadata: {
          year,
          simpanan_share: m.simpananShare,
          jasa_usaha_share: m.jasaUsahaShare,
          total_share: m.totalShare,
        },
      }));

      // Create notifications for withheld members
      const withheldNotifications = withheldMembers.map(m => ({
        user_id: m.memberId,
        title: `SHU Tahun ${year} Ditahan`,
        message: `SHU Anda sebesar Rp ${m.totalShare.toLocaleString('id-ID')} ditahan karena ${m.exclusionReason === 'manual' ? 'keputusan pengurus' : `tunggakan sebesar Rp ${m.arrearsAmount.toLocaleString('id-ID')}`}. SHU akan dibagikan setelah tunggakan dilunasi.`,
        notification_type: 'shu_withheld',
        metadata: {
          year,
          simpanan_share: m.simpananShare,
          jasa_usaha_share: m.jasaUsahaShare,
          total_share: m.totalShare,
          arrears_amount: m.arrearsAmount,
          reason: m.exclusionReason,
        },
      }));
      
      if (memberNotifications.length > 0) {
        await supabase.from('member_notifications').insert(memberNotifications);
      }

      if (withheldNotifications.length > 0) {
        await supabase.from('member_notifications').insert(withheldNotifications);
      }

      // Create automatic journal entry if accounts are available
      if (valid) {
        const journalResult = await createSHUJournalEntry(distribution);
        
        if (journalResult.success) {
          toast.success(`Jurnal ${journalResult.journalNumber} berhasil dibuat`, {
            description: 'Distribusi SHU telah dicatat di jurnal',
          });
        } else {
          toast.warning('Jurnal otomatis tidak dibuat', {
            description: journalResult.error || 'Periksa konfigurasi akun',
          });
        }
      }

      // Create separate journal for withheld SHU
      if (withheldMembers.length > 0 && distribution.totalWithheldSHU > 0) {
        // Ensure withheld accounts exist first
        await ensureAccountsExist();
        
        const withheldJournalResult = await createWithholdingJournal(
          year,
          distribution.totalWithheldSHU,
          withheldMembers.length
        );

        if (withheldJournalResult.success && withheldJournalResult.journalNumber) {
          toast.success(`Jurnal penahanan ${withheldJournalResult.journalNumber} dibuat`, {
            description: `SHU ditahan untuk ${withheldMembers.length} anggota dicatat`,
          });
        } else if (withheldJournalResult.error) {
          toast.warning('Jurnal penahanan tidak dibuat', {
            description: withheldJournalResult.error,
          });
        }
      }

      toast.success('Distribusi SHU berhasil dikonfirmasi', {
        description: withheldMembers.length > 0 
          ? `${distributedMembers.length} anggota dibagikan, ${withheldMembers.length} anggota ditahan`
          : undefined,
      });
      
      // Update distribution state
      setDistribution({
        ...distribution,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error('Error confirming SHU distribution:', error);
      toast.error('Gagal mengkonfirmasi distribusi SHU');
      return false;
    }
  };

  // Check if already confirmed
  const checkConfirmedStatus = useCallback(async () => {
    const { data } = await supabase
      .from('shu_distributions')
      .select('status, confirmed_at, member_distributions, role_distributions')
      .eq('year', year)
      .maybeSingle();

    if (data?.status === 'confirmed' && distribution) {
      setDistribution({
        ...distribution,
        status: 'confirmed',
        confirmedAt: data.confirmed_at || undefined,
        memberDistributions: Array.isArray(data.member_distributions) 
          ? (data.member_distributions as unknown as MemberSHUDistribution[])
          : distribution.memberDistributions,
        roleDistributions: Array.isArray(data.role_distributions)
          ? data.role_distributions as SHUDistributionResult['roleDistributions']
          : distribution.roleDistributions,
      });
    }
  }, [year, distribution]);

  useEffect(() => {
    if (distribution) {
      checkConfirmedStatus();
    }
  }, [distribution?.shuBruto]);

  return {
    distribution,
    memberData,
    roleAssignments,
    loading,
    refetch: calculateSHU,
    confirmDistribution,
    toggleManualExclusion,
    manualExclusions,
  };
};

// Hook for managing role assignments
export const useRoleAssignmentsData = () => {
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('role_assignments')
      .select('*')
      .order('role', { ascending: true });

    if (error) {
      console.error('Error fetching role assignments:', error);
    } else {
      setAssignments((data || []).map(r => ({
        id: r.id,
        name: r.name,
        role: r.role as 'pengurus' | 'pengawas' | 'penasihat',
        position: r.position,
        is_member: r.is_member,
        member_id: r.member_id,
        share_percentage: r.share_percentage,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const addAssignment = async (assignment: Omit<RoleAssignment, 'id'>) => {
    const { error } = await supabase.from('role_assignments').insert([{
      name: assignment.name,
      role: assignment.role,
      position: assignment.position,
      is_member: assignment.is_member,
      member_id: assignment.member_id,
      share_percentage: assignment.share_percentage,
    }]);

    if (error) {
      console.error('Error adding assignment:', error);
      toast.error('Gagal menambah penugasan');
      return false;
    }

    toast.success('Penugasan berhasil ditambahkan');
    fetchAssignments();
    return true;
  };

  const updateAssignment = async (id: string, updates: Partial<RoleAssignment>) => {
    const { error } = await supabase
      .from('role_assignments')
      .update({
        name: updates.name,
        role: updates.role,
        position: updates.position,
        is_member: updates.is_member,
        member_id: updates.member_id,
        share_percentage: updates.share_percentage,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating assignment:', error);
      toast.error('Gagal mengupdate penugasan');
      return false;
    }

    toast.success('Penugasan berhasil diupdate');
    fetchAssignments();
    return true;
  };

  const deleteAssignment = async (id: string) => {
    const { error } = await supabase
      .from('role_assignments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Gagal menghapus penugasan');
      return false;
    }

    toast.success('Penugasan berhasil dihapus');
    fetchAssignments();
    return true;
  };

  return {
    assignments,
    loading,
    refetch: fetchAssignments,
    addAssignment,
    updateAssignment,
    deleteAssignment,
  };
};
