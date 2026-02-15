import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CooperativeSummary } from '@/lib/types';

export interface BookkeepingData {
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  totalAssets: number;
  totalEquity: number;
  kas: number;
  bank: number;
  piutang: number;
  danaPendidikan: number;
  danaSosial: number;
  danaPembangunan: number;
  modalPenyertaan: number;
  modalPinjaman: number;
  hibahDonasi: number;
}

export const useCooperativeSummary = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CooperativeSummary>({
    totalSimpananPokok: 0,
    totalSimpananWajib: 0,
    totalSimpananSukarela: 0,
    totalAssets: 0,
    totalCash: 0,
    totalReceivables: 0,
    totalInterestReceived: 0,
    totalPenaltyReceived: 0,
    totalOutstandingPrincipal: 0,
    totalOutstandingInterest: 0,
    totalMembers: 0,
    membersWithLoans: 0,
    membersDefaulting: 0,
  });
  const [danaCadangan, setDanaCadangan] = useState(0);
  const [bookkeeping, setBookkeeping] = useState<BookkeepingData>({
    totalIncome: 0,
    totalExpense: 0,
    netIncome: 0,
    totalAssets: 0,
    totalEquity: 0,
    kas: 0,
    bank: 0,
    piutang: 0,
    danaPendidikan: 0,
    danaSosial: 0,
    danaPembangunan: 0,
    modalPenyertaan: 0,
    modalPinjaman: 0,
    hibahDonasi: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();

      // Fetch savings summary
      const { data: savingsData } = await supabase
        .from('savings_summary')
        .select('simpanan_pokok, simpanan_wajib, simpanan_sukarela');

      const totalSimpananPokok = savingsData?.reduce((sum, s) => sum + (s.simpanan_pokok || 0), 0) || 0;
      const totalSimpananWajib = savingsData?.reduce((sum, s) => sum + (s.simpanan_wajib || 0), 0) || 0;
      const totalSimpananSukarela = savingsData?.reduce((sum, s) => sum + (s.simpanan_sukarela || 0), 0) || 0;

      // Fetch active loans (for receivables)
      const { data: loansData } = await supabase
        .from('loans')
        .select('id, remaining_principal, status, user_id');

      const activeLoans = loansData?.filter(l => l.status === 'active') || [];
      const totalReceivables = activeLoans.reduce((sum, l) => sum + (l.remaining_principal || 0), 0);

      // Fetch overdue installments
      const { data: overdueData } = await supabase
        .from('loan_installments')
        .select('loan_id, total_amount')
        .eq('status', 'overdue');

      // Get unique user_ids with overdue loans
      const loanIdsWithOverdue = [...new Set(overdueData?.map(o => o.loan_id) || [])];
      const usersWithOverdue = new Set<string>();
      loanIdsWithOverdue.forEach(loanId => {
        const loan = loansData?.find(l => l.id === loanId);
        if (loan) usersWithOverdue.add(loan.user_id);
      });

      // Fetch paid installments for interest and penalty
      const { data: paidInstallments } = await supabase
        .from('loan_installments')
        .select('interest_amount, penalty_amount, paid_date')
        .eq('status', 'paid')
        .gte('paid_date', `${currentYear}-01-01`)
        .lte('paid_date', `${currentYear}-12-31`);

      const totalInterestReceived = paidInstallments?.reduce((sum, i) => sum + (i.interest_amount || 0), 0) || 0;
      const totalPenaltyReceived = paidInstallments?.reduce((sum, i) => sum + (i.penalty_amount || 0), 0) || 0;

      // Fetch active members
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, is_active, approval_status');

      const activeMembers = profilesData?.filter(p => p.is_active && p.approval_status === 'approved') || [];
      const totalMembers = activeMembers.length;

      // Count members with active loans
      const userIdsWithLoans = new Set(activeLoans.map(l => l.user_id));
      const membersWithLoans = userIdsWithLoans.size;

      // Fetch dana cadangan from confirmed SHU distributions
      const { data: shuDistributions } = await supabase
        .from('shu_distributions')
        .select('dana_cadangan')
        .eq('status', 'confirmed');

      const totalDanaCadangan = shuDistributions?.reduce((sum, s) => sum + (s.dana_cadangan || 0), 0) || 0;
      setDanaCadangan(totalDanaCadangan);

      // Fetch balance sheet for current year
      const { data: balanceSheet } = await supabase
        .from('balance_sheets')
        .select('*')
        .eq('year', currentYear)
        .maybeSingle();

      // Fetch income entries for current year
      const { data: incomeEntries } = await supabase
        .from('income_entries')
        .select('amount')
        .eq('year', currentYear);

      const totalIncomeFromEntries = incomeEntries?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0;

      // Fetch expense entries for current year
      const { data: expenseEntries } = await supabase
        .from('expense_entries')
        .select('amount')
        .eq('year', currentYear);

      const totalExpenseFromEntries = expenseEntries?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

      // Set bookkeeping data
      setBookkeeping({
        totalIncome: totalIncomeFromEntries + totalInterestReceived + totalPenaltyReceived,
        totalExpense: totalExpenseFromEntries,
        netIncome: (totalIncomeFromEntries + totalInterestReceived + totalPenaltyReceived) - totalExpenseFromEntries,
        totalAssets: balanceSheet?.total_assets || 0,
        totalEquity: balanceSheet?.total_equity || 0,
        kas: balanceSheet?.kas || 0,
        bank: balanceSheet?.bank || 0,
        piutang: balanceSheet?.piutang || 0,
        danaPendidikan: balanceSheet?.dana_pendidikan || 0,
        danaSosial: balanceSheet?.dana_sosial || 0,
        danaPembangunan: balanceSheet?.dana_pembangunan || 0,
        modalPenyertaan: balanceSheet?.modal_penyertaan || 0,
        modalPinjaman: balanceSheet?.modal_pinjaman || 0,
        hibahDonasi: balanceSheet?.hibah_donasi || 0,
      });

      // Calculate totals
      const totalSimpanan = totalSimpananPokok + totalSimpananWajib + totalSimpananSukarela;
      const totalAssets = totalSimpanan + totalDanaCadangan;
      const totalCash = totalSimpanan - totalReceivables;

      setSummary({
        totalSimpananPokok,
        totalSimpananWajib,
        totalSimpananSukarela,
        totalAssets,
        totalCash: totalCash > 0 ? totalCash : 0,
        totalReceivables,
        totalInterestReceived,
        totalPenaltyReceived,
        totalOutstandingPrincipal: totalReceivables,
        totalOutstandingInterest: 0,
        totalMembers,
        membersWithLoans,
        membersDefaulting: usersWithOverdue.size,
      });
    } catch (error) {
      console.error('Error fetching cooperative summary:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { loading, summary, danaCadangan, bookkeeping, refetch: fetchData };
};
