import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExitedMemberSHURecord {
  id: string;
  user_id: string;
  year: number;
  member_number: string | null;
  member_name: string;
  join_date: string | null;
  exit_date: string;
  active_months: number;
  total_months: number;
  proportion_factor: number;
  calculation_method: string;
  total_simpanan: number;
  total_jasa_usaha: number;
  base_simpanan_share: number;
  base_jasa_usaha_share: number;
  final_simpanan_share: number;
  final_jasa_usaha_share: number;
  total_shu_amount: number;
  payment_status: 'pending' | 'paid' | 'cancelled';
  payment_date: string | null;
  payment_method: string | null;
  payment_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExitedMemberSHUSummary {
  totalExitedMembers: number;
  totalSHUAmount: number;
  paidAmount: number;
  pendingAmount: number;
  cancelledAmount: number;
  paidCount: number;
  pendingCount: number;
  cancelledCount: number;
}

interface SHUSettings {
  enabled: boolean;
  calculationMethod: 'pro_rata' | 'full' | 'at_exit';
  paymentTime: 'with_distribution' | 'on_exit' | 'end_of_year';
  fallbackAllocation: 'reserve_fund' | 'social_fund' | 'education_fund';
}

const defaultSettings: SHUSettings = {
  enabled: false,
  calculationMethod: 'pro_rata',
  paymentTime: 'with_distribution',
  fallbackAllocation: 'reserve_fund',
};

export const useExitedMemberSHUReport = (year: number) => {
  const [records, setRecords] = useState<ExitedMemberSHURecord[]>([]);
  const [summary, setSummary] = useState<ExitedMemberSHUSummary>({
    totalExitedMembers: 0,
    totalSHUAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    cancelledAmount: 0,
    paidCount: 0,
    pendingCount: 0,
    cancelledCount: 0,
  });
  const [settings, setSettings] = useState<SHUSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', [
          'exited_member_shu_enabled',
          'exited_member_shu_calculation_method',
          'exited_member_shu_payment_time',
          'exited_member_shu_fallback_allocation',
        ]);

      if (error) throw error;

      const settingsObj: SHUSettings = { ...defaultSettings };
      data?.forEach((item) => {
        const value = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
        switch (item.key) {
          case 'exited_member_shu_enabled':
            settingsObj.enabled = value === 'true' || value === '"true"';
            break;
          case 'exited_member_shu_calculation_method':
            settingsObj.calculationMethod = value.replace(/"/g, '') as SHUSettings['calculationMethod'];
            break;
          case 'exited_member_shu_payment_time':
            settingsObj.paymentTime = value.replace(/"/g, '') as SHUSettings['paymentTime'];
            break;
          case 'exited_member_shu_fallback_allocation':
            settingsObj.fallbackAllocation = value.replace(/"/g, '') as SHUSettings['fallbackAllocation'];
            break;
        }
      });

      setSettings(settingsObj);
    } catch (error) {
      console.error('Error fetching SHU settings:', error);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('exited_member_shu_payments')
        .select('*')
        .eq('year', year)
        .order('exit_date', { ascending: true });

      if (error) throw error;

      const typedRecords = (data || []) as ExitedMemberSHURecord[];
      setRecords(typedRecords);

      // Calculate summary
      const newSummary: ExitedMemberSHUSummary = {
        totalExitedMembers: typedRecords.length,
        totalSHUAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        cancelledAmount: 0,
        paidCount: 0,
        pendingCount: 0,
        cancelledCount: 0,
      };

      typedRecords.forEach((record) => {
        newSummary.totalSHUAmount += Number(record.total_shu_amount);
        switch (record.payment_status) {
          case 'paid':
            newSummary.paidAmount += Number(record.total_shu_amount);
            newSummary.paidCount++;
            break;
          case 'pending':
            newSummary.pendingAmount += Number(record.total_shu_amount);
            newSummary.pendingCount++;
            break;
          case 'cancelled':
            newSummary.cancelledAmount += Number(record.total_shu_amount);
            newSummary.cancelledCount++;
            break;
        }
      });

      setSummary(newSummary);
    } catch (error) {
      console.error('Error fetching exited member SHU records:', error);
      toast.error('Gagal memuat data SHU anggota keluar');
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  const calculateAndGenerateRecords = useCallback(async () => {
    setIsCalculating(true);
    try {
      // Fetch exited members for the year
      const { data: exitedMembers, error: memberError } = await supabase
        .from('profiles')
        .select('user_id, name, member_number, join_date, exit_date')
        .eq('exit_year', year)
        .eq('is_active', false);

      if (memberError) throw memberError;

      if (!exitedMembers || exitedMembers.length === 0) {
        toast.info('Tidak ada anggota yang keluar pada tahun ini');
        setIsCalculating(false);
        return;
      }

      // Fetch SHU distribution for the year
      const { data: shuDistribution } = await supabase
        .from('shu_distributions')
        .select('*')
        .eq('year', year)
        .single();

      // Get total savings and loan interest for all members
      const { data: allSavings } = await supabase
        .from('savings_summary')
        .select('user_id, total_simpanan');

      const { data: allLoanInterest } = await supabase
        .from('loan_installments')
        .select('loan_id, interest_amount, paid_date')
        .not('paid_date', 'is', null);

      // Get loans for the year
      const { data: loans } = await supabase
        .from('loans')
        .select('id, user_id');

      // Calculate total interest per user
      const interestByUser: Record<string, number> = {};
      if (loans && allLoanInterest) {
        const loanUserMap: Record<string, string> = {};
        loans.forEach((loan) => {
          loanUserMap[loan.id] = loan.user_id;
        });

        allLoanInterest.forEach((inst) => {
          const userId = loanUserMap[inst.loan_id];
          if (userId) {
            interestByUser[userId] = (interestByUser[userId] || 0) + Number(inst.interest_amount);
          }
        });
      }

      // Get business unit transactions for member participation
      const { data: businessTransactions } = await supabase
        .from('business_unit_transactions')
        .select('user_id, amount')
        .eq('is_member_transaction', true)
        .gte('transaction_date', `${year}-01-01`)
        .lte('transaction_date', `${year}-12-31`);

      const businessByUser: Record<string, number> = {};
      businessTransactions?.forEach((tx) => {
        businessByUser[tx.user_id] = (businessByUser[tx.user_id] || 0) + Number(tx.amount);
      });

      // Calculate totals
      const totalSimpanan = allSavings?.reduce((sum, s) => sum + Number(s.total_simpanan), 0) || 0;
      const totalInterest = Object.values(interestByUser).reduce((sum, i) => sum + i, 0);
      const totalBusiness = Object.values(businessByUser).reduce((sum, b) => sum + b, 0);

      // Get SHU allocations from settings or distribution
      // These values are stored in member_distributions JSON or separate fields
      const memberSHUPercentage = 50; // Default percentage for members
      const simpananSharePercentage = 60; // Default simpanan share
      const jasaUsahaSharePercentage = 100 - simpananSharePercentage;

      const totalMemberSHU = shuDistribution?.shu_anggota_total || 0;
      const totalSimpananPool = (totalMemberSHU * simpananSharePercentage) / 100;
      const totalJasaUsahaPool = (totalMemberSHU * jasaUsahaSharePercentage) / 100;

      // Process each exited member
      const newRecords: Omit<ExitedMemberSHURecord, 'id' | 'created_at' | 'updated_at'>[] = [];

      for (const member of exitedMembers) {
        const joinDate = member.join_date ? new Date(member.join_date) : new Date(`${year}-01-01`);
        const exitDate = new Date(member.exit_date);
        const yearStart = new Date(`${year}-01-01`);
        const yearEnd = new Date(`${year}-12-31`);

        // Calculate active months
        const effectiveStart = joinDate > yearStart ? joinDate : yearStart;
        const effectiveEnd = exitDate < yearEnd ? exitDate : yearEnd;
        
        const activeMonths = Math.max(
          0,
          Math.ceil(
            (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24 * 30)
          )
        );
        const totalMonths = 12;

        // Calculate proportion factor based on method
        let proportionFactor = 1;
        if (settings.calculationMethod === 'pro_rata') {
          proportionFactor = activeMonths / totalMonths;
        } else if (settings.calculationMethod === 'at_exit') {
          proportionFactor = activeMonths > 0 ? activeMonths / totalMonths : 0;
        }
        // 'full' method = proportion stays 1

        // Get member's savings
        const memberSavings = allSavings?.find((s) => s.user_id === member.user_id);
        const userSimpanan = memberSavings ? Number(memberSavings.total_simpanan) : 0;
        const userInterest = interestByUser[member.user_id] || 0;
        const userBusiness = businessByUser[member.user_id] || 0;
        const userJasaUsaha = userInterest + userBusiness;

        // Calculate base shares
        const baseSimpananShare = totalSimpanan > 0 
          ? (userSimpanan / totalSimpanan) * totalSimpananPool 
          : 0;
        const baseJasaUsahaShare = (totalInterest + totalBusiness) > 0
          ? (userJasaUsaha / (totalInterest + totalBusiness)) * totalJasaUsahaPool
          : 0;

        // Apply proportion factor
        const finalSimpananShare = baseSimpananShare * proportionFactor;
        const finalJasaUsahaShare = baseJasaUsahaShare * proportionFactor;
        const totalSHU = finalSimpananShare + finalJasaUsahaShare;

        newRecords.push({
          user_id: member.user_id,
          year,
          member_number: member.member_number,
          member_name: member.name,
          join_date: member.join_date,
          exit_date: member.exit_date,
          active_months: activeMonths,
          total_months: totalMonths,
          proportion_factor: proportionFactor,
          calculation_method: settings.calculationMethod,
          total_simpanan: userSimpanan,
          total_jasa_usaha: userJasaUsaha,
          base_simpanan_share: baseSimpananShare,
          base_jasa_usaha_share: baseJasaUsahaShare,
          final_simpanan_share: finalSimpananShare,
          final_jasa_usaha_share: finalJasaUsahaShare,
          total_shu_amount: totalSHU,
          payment_status: 'pending',
          payment_date: null,
          payment_method: null,
          payment_note: null,
        });
      }

      // Upsert records
      if (newRecords.length > 0) {
        const { error: upsertError } = await supabase
          .from('exited_member_shu_payments')
          .upsert(
            newRecords.map((r) => ({
              ...r,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: 'user_id,year' }
          );

        if (upsertError) throw upsertError;

        toast.success(`Berhasil menghitung SHU untuk ${newRecords.length} anggota keluar`);
        await fetchRecords();
      }
    } catch (error) {
      console.error('Error calculating exited member SHU:', error);
      toast.error('Gagal menghitung SHU anggota keluar');
    } finally {
      setIsCalculating(false);
    }
  }, [year, settings.calculationMethod, fetchRecords]);

  const updatePaymentStatus = useCallback(
    async (
      recordId: string,
      status: 'pending' | 'paid' | 'cancelled',
      paymentMethod?: string,
      paymentNote?: string
    ) => {
      try {
        const updateData: Record<string, unknown> = {
          payment_status: status,
          updated_at: new Date().toISOString(),
        };

        if (status === 'paid') {
          updateData.payment_date = new Date().toISOString();
          updateData.payment_method = paymentMethod || 'transfer';
        } else if (status === 'cancelled' || status === 'pending') {
          updateData.payment_date = null;
          updateData.payment_method = null;
        }

        if (paymentNote) {
          updateData.payment_note = paymentNote;
        }

        const { error } = await supabase
          .from('exited_member_shu_payments')
          .update(updateData)
          .eq('id', recordId);

        if (error) throw error;

        toast.success(
          status === 'paid'
            ? 'Pembayaran berhasil dicatat'
            : status === 'cancelled'
            ? 'Pembayaran dibatalkan'
            : 'Status dikembalikan ke pending'
        );

        await fetchRecords();
      } catch (error) {
        console.error('Error updating payment status:', error);
        toast.error('Gagal mengubah status pembayaran');
      }
    },
    [fetchRecords]
  );

  const deleteRecord = useCallback(
    async (recordId: string) => {
      try {
        const { error } = await supabase
          .from('exited_member_shu_payments')
          .delete()
          .eq('id', recordId);

        if (error) throw error;

        toast.success('Data berhasil dihapus');
        await fetchRecords();
      } catch (error) {
        console.error('Error deleting record:', error);
        toast.error('Gagal menghapus data');
      }
    },
    [fetchRecords]
  );

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return {
    records,
    summary,
    settings,
    isLoading,
    isCalculating,
    fetchRecords,
    calculateAndGenerateRecords,
    updatePaymentStatus,
    deleteRecord,
  };
};
