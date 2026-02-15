import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';

export interface SHUEstimateDetail {
  unitCode: string;
  unitName: string;
  total: number;
}

export interface UserSHUEstimate {
  // User contributions
  simpananPokok: number;
  simpananWajib: number;
  totalSimpanan: number;
  kontribusiBunga: number; // Loan interest paid
  kontribusiUsaha: number; // Business unit transactions
  detailUsaha: SHUEstimateDetail[];
  
  // Total contributions across all members
  totalSimpananAll: number;
  totalKontribusiUsahaAll: number;
  
  // User's share percentages
  simpananSharePercent: number;
  usahaSharePercent: number;
  
  // Estimated SHU (based on current year's data, actual SHU depends on confirmed shuBruto)
  estimatedSimpananSHU: number;
  estimatedUsahaSHU: number;
  estimatedTotalSHU: number;
  
  // Settings info
  shuSettings: {
    shuAnggota: number;
    shuAnggotaSimpanan: number;
    shuAnggotaJasaUsaha: number;
  };
  
  // Reference year
  year: number;
  
  // Last year's actual SHU (if available)
  lastYearSHU: number | null;
}

/**
 * Hook to calculate a member's estimated SHU for the current year
 * Combines savings contribution (Jasa Simpanan) and business unit transactions (Jasa Usaha)
 */
export const useUserSHUEstimate = () => {
  const { user } = useAuth();
  const [estimate, setEstimate] = useState<UserSHUEstimate | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateEstimate = useCallback(async () => {
    if (!user?.id) {
      setEstimate(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const settings = getCooperativeSettings();
      const shuSettings = settings.shuDistribution;
      const currentYear = new Date().getFullYear();
      const startDate = `${currentYear}-01-01`;
      const endDate = `${currentYear}-12-31`;

      // 1. Get user's savings
      const { data: userSavings } = await supabase
        .from('savings_summary')
        .select('simpanan_pokok, simpanan_wajib')
        .eq('user_id', user.id)
        .single();

      const simpananPokok = userSavings?.simpanan_pokok || 0;
      const simpananWajib = userSavings?.simpanan_wajib || 0;
      const totalSimpanan = simpananPokok + simpananWajib;

      // 2. Get total savings of all members
      const { data: allSavings } = await supabase
        .from('savings_summary')
        .select('simpanan_pokok, simpanan_wajib');

      const totalSimpananAll = (allSavings || []).reduce((sum, s) => 
        sum + (s.simpanan_pokok || 0) + (s.simpanan_wajib || 0), 0);

      // 3. Get user's loan interest paid this year
      const { data: userLoans } = await supabase
        .from('loans')
        .select('id')
        .eq('user_id', user.id);

      const userLoanIds = (userLoans || []).map(l => l.id);
      
      let kontribusiBunga = 0;
      if (userLoanIds.length > 0) {
        const { data: paidInstallments } = await supabase
          .from('loan_installments')
          .select('interest_amount')
          .in('loan_id', userLoanIds)
          .eq('status', 'paid')
          .gte('paid_date', startDate)
          .lte('paid_date', endDate);

        kontribusiBunga = (paidInstallments || []).reduce((sum, i) => 
          sum + (i.interest_amount || 0), 0);
      }

      // 4. Get all loan interest paid by all members this year (for percentage calculation)
      const { data: allLoans } = await supabase
        .from('loans')
        .select('id, user_id');

      const loansByUser = new Map<string, string[]>();
      (allLoans || []).forEach(loan => {
        const existing = loansByUser.get(loan.user_id) || [];
        existing.push(loan.id);
        loansByUser.set(loan.user_id, existing);
      });

      const allLoanIds = (allLoans || []).map(l => l.id);
      let totalBungaAll = 0;
      if (allLoanIds.length > 0) {
        const { data: allPaidInstallments } = await supabase
          .from('loan_installments')
          .select('interest_amount')
          .in('loan_id', allLoanIds)
          .eq('status', 'paid')
          .gte('paid_date', startDate)
          .lte('paid_date', endDate);

        totalBungaAll = (allPaidInstallments || []).reduce((sum, i) => 
          sum + (i.interest_amount || 0), 0);
      }

      // 5. Get business units (non-SP)
      const { data: businessUnits } = await supabase
        .from('business_units')
        .select('id, code, name')
        .neq('code', 'SP');

      const nonSpUnitIds = (businessUnits || []).map(u => u.id);
      const unitMap = new Map((businessUnits || []).map(u => [u.id, { code: u.code, name: u.name }]));

      // 6. Get user's business unit transactions
      let kontribusiUsaha = 0;
      const detailUsaha: SHUEstimateDetail[] = [];
      
      if (nonSpUnitIds.length > 0) {
        const { data: userBuTransactions } = await supabase
          .from('business_unit_transactions')
          .select('business_unit_id, amount')
          .eq('user_id', user.id)
          .eq('is_member_transaction', true)
          .in('business_unit_id', nonSpUnitIds)
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate);

        (userBuTransactions || []).forEach(t => {
          kontribusiUsaha += t.amount;
          const unitInfo = unitMap.get(t.business_unit_id);
          if (unitInfo) {
            const existing = detailUsaha.find(d => d.unitCode === unitInfo.code);
            if (existing) {
              existing.total += t.amount;
            } else {
              detailUsaha.push({ unitCode: unitInfo.code, unitName: unitInfo.name, total: t.amount });
            }
          }
        });
      }

      // 7. Get total business unit transactions of all members
      let totalUsahaAll = 0;
      if (nonSpUnitIds.length > 0) {
        const { data: allBuTransactions } = await supabase
          .from('business_unit_transactions')
          .select('amount')
          .eq('is_member_transaction', true)
          .in('business_unit_id', nonSpUnitIds)
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate);

        totalUsahaAll = (allBuTransactions || []).reduce((sum, t) => sum + t.amount, 0);
      }

      // Total contribution for Jasa Usaha = loan interest + business unit transactions
      const totalKontribusiUsahaAll = totalBungaAll + totalUsahaAll;
      const userKontribusiTotal = kontribusiBunga + kontribusiUsaha;

      // 8. Calculate share percentages
      const simpananSharePercent = totalSimpananAll > 0 
        ? (totalSimpanan / totalSimpananAll) * 100 
        : 0;
      const usahaSharePercent = totalKontribusiUsahaAll > 0 
        ? (userKontribusiTotal / totalKontribusiUsahaAll) * 100 
        : 0;

      // 9. Get last year's actual SHU for reference
      const { data: lastYearDistribution } = await supabase
        .from('shu_distributions')
        .select('shu_bruto')
        .eq('year', currentYear - 1)
        .eq('status', 'confirmed')
        .maybeSingle();

      const { data: lastYearRecord } = await supabase
        .from('shu_records')
        .select('amount')
        .eq('user_id', user.id)
        .eq('year', currentYear - 1)
        .maybeSingle();

      // 10. Calculate estimated SHU based on last year's SHU Bruto (as reference)
      const referenceShuBruto = lastYearDistribution?.shu_bruto || 0;
      const shuAnggotaTotal = referenceShuBruto * (shuSettings.shuAnggota / 100);
      const shuAnggotaSimpanan = shuAnggotaTotal * (shuSettings.shuAnggotaSimpanan / 100);
      const shuAnggotaJasaUsaha = shuAnggotaTotal * (shuSettings.shuAnggotaJasaUsaha / 100);

      const estimatedSimpananSHU = totalSimpananAll > 0 
        ? (totalSimpanan / totalSimpananAll) * shuAnggotaSimpanan 
        : 0;
      const estimatedUsahaSHU = totalKontribusiUsahaAll > 0 
        ? (userKontribusiTotal / totalKontribusiUsahaAll) * shuAnggotaJasaUsaha 
        : 0;

      setEstimate({
        simpananPokok,
        simpananWajib,
        totalSimpanan,
        kontribusiBunga,
        kontribusiUsaha,
        detailUsaha,
        totalSimpananAll,
        totalKontribusiUsahaAll,
        simpananSharePercent,
        usahaSharePercent,
        estimatedSimpananSHU,
        estimatedUsahaSHU,
        estimatedTotalSHU: estimatedSimpananSHU + estimatedUsahaSHU,
        shuSettings: {
          shuAnggota: shuSettings.shuAnggota,
          shuAnggotaSimpanan: shuSettings.shuAnggotaSimpanan,
          shuAnggotaJasaUsaha: shuSettings.shuAnggotaJasaUsaha,
        },
        year: currentYear,
        lastYearSHU: lastYearRecord?.amount || null,
      });
    } catch (error) {
      console.error('Error calculating SHU estimate:', error);
      setEstimate(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    calculateEstimate();
  }, [calculateEstimate]);

  return {
    estimate,
    loading,
    refetch: calculateEstimate,
  };
};
