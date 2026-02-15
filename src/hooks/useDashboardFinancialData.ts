import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MonthlyTrend {
  month: string;
  pendapatan: number;
  biaya: number;
  simpanan: number;
  pinjaman: number;
}

export interface SavingsComposition {
  name: string;
  value: number;
  color: string;
}

export interface LoanStatusData {
  name: string;
  value: number;
  color: string;
}

export interface MemberStats {
  name: string;
  value: number;
  color: string;
}

export interface YearlyComparison {
  year: string;
  pendapatan: number;
  biaya: number;
  shu: number;
}

export interface SavingsGrowthByType {
  month: string;
  pokok: number;
  wajib: number;
  sukarela: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
];

export const useDashboardFinancialData = () => {
  const [loading, setLoading] = useState(true);
  const [savingsSummary, setSavingsSummary] = useState<{ pokok: number; wajib: number; sukarela: number }>({ pokok: 0, wajib: 0, sukarela: 0 });
  const [loanData, setLoanData] = useState<{ active: number; completed: number; pending: number; defaulted: number }>({ active: 0, completed: 0, pending: 0, defaulted: 0 });
  const [memberData, setMemberData] = useState<{ active: number; withLoans: number; defaulting: number }>({ active: 0, withLoans: 0, defaulting: 0 });
  const [incomeEntries, setIncomeEntries] = useState<{ month: number; amount: number }[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<{ month: number; amount: number }[]>([]);
  const [receivables, setReceivables] = useState(0);
  const [yearlyData, setYearlyData] = useState<{ year: number; income: number; expense: number }[]>([]);
  const [savingsTransactions, setSavingsTransactions] = useState<{ month: number; type: string; amount: number }[]>([]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch savings summary
      const { data: savings } = await supabase
        .from('savings_summary')
        .select('simpanan_pokok, simpanan_wajib, simpanan_sukarela');
      
      if (savings && savings.length > 0) {
        const totals = savings.reduce((acc, s) => ({
          pokok: acc.pokok + (s.simpanan_pokok || 0),
          wajib: acc.wajib + (s.simpanan_wajib || 0),
          sukarela: acc.sukarela + (s.simpanan_sukarela || 0),
        }), { pokok: 0, wajib: 0, sukarela: 0 });
        setSavingsSummary(totals);
      }

      // Fetch loan status counts
      const { data: loans } = await supabase
        .from('loans')
        .select('status');
      
      if (loans) {
        const loanCounts = {
          active: loans.filter(l => l.status === 'active').length,
          completed: loans.filter(l => l.status === 'completed').length,
          pending: loans.filter(l => l.status === 'pending').length,
          defaulted: loans.filter(l => l.status === 'defaulted').length,
        };
        setLoanData(loanCounts);
      }

      // Fetch member stats
      const { data: profiles } = await supabase
        .from('profiles')
        .select('is_active, user_id');
      
      const { data: activeLoans } = await supabase
        .from('loans')
        .select('user_id, status')
        .eq('status', 'active');

      const { data: overdueInstallments } = await supabase
        .from('loan_installments')
        .select('loan_id')
        .eq('status', 'overdue');

      if (profiles) {
        const activeMembers = profiles.filter(p => p.is_active).length;
        const membersWithLoans = new Set(activeLoans?.map(l => l.user_id) || []).size;
        
        // Get defaulting members from overdue installments
        let defaultingMembers = 0;
        if (overdueInstallments && overdueInstallments.length > 0) {
          const loanIds = [...new Set(overdueInstallments.map(i => i.loan_id))];
          const { data: defaultingLoans } = await supabase
            .from('loans')
            .select('user_id')
            .in('id', loanIds);
          defaultingMembers = new Set(defaultingLoans?.map(l => l.user_id) || []).size;
        }

        setMemberData({
          active: activeMembers,
          withLoans: membersWithLoans,
          defaulting: defaultingMembers,
        });
      }

      // Fetch income entries for current year
      const { data: income } = await supabase
        .from('income_entries')
        .select('amount, date')
        .eq('year', currentYear);
      
      if (income) {
        const monthlyIncome = income.map(i => ({
          month: new Date(i.date).getMonth(),
          amount: i.amount,
        }));
        setIncomeEntries(monthlyIncome);
      }

      // Fetch expense entries for current year
      const { data: expenses } = await supabase
        .from('expense_entries')
        .select('amount, date')
        .eq('year', currentYear);
      
      if (expenses) {
        const monthlyExpenses = expenses.map(e => ({
          month: new Date(e.date).getMonth(),
          amount: e.amount,
        }));
        setExpenseEntries(monthlyExpenses);
      }

      // Fetch total receivables from active loans
      const { data: allLoans } = await supabase
        .from('loans')
        .select('remaining_principal')
        .eq('status', 'active');
      
      if (allLoans) {
        const totalReceivables = allLoans.reduce((sum, l) => sum + (l.remaining_principal || 0), 0);
        setReceivables(totalReceivables);
      }

      // Fetch yearly comparison data (last 3 years)
      const years = [currentYear - 2, currentYear - 1, currentYear];
      const yearlyResults: { year: number; income: number; expense: number }[] = [];

      for (const year of years) {
        const { data: yearIncome } = await supabase
          .from('income_entries')
          .select('amount')
          .eq('year', year);
        
        const { data: yearExpense } = await supabase
          .from('expense_entries')
          .select('amount')
          .eq('year', year);

        yearlyResults.push({
          year,
          income: yearIncome?.reduce((sum, i) => sum + i.amount, 0) || 0,
          expense: yearExpense?.reduce((sum, e) => sum + e.amount, 0) || 0,
        });
      }
      setYearlyData(yearlyResults);

      // Fetch savings transactions for current year to show growth by type
      const { data: savingsTxns } = await supabase
        .from('transactions')
        .select('type, amount, date, status')
        .eq('status', 'approved')
        .in('type', ['simpanan_pokok', 'simpanan_wajib', 'simpanan_sukarela', 'setor_simpanan_wajib', 'setor_simpanan_sukarela'])
        .gte('date', `${currentYear}-01-01`)
        .lte('date', `${currentYear}-12-31`);

      if (savingsTxns) {
        const txnData = savingsTxns.map(t => {
          let normalizedType = t.type;
          if (t.type === 'setor_simpanan_wajib') normalizedType = 'simpanan_wajib';
          if (t.type === 'setor_simpanan_sukarela') normalizedType = 'simpanan_sukarela';
          return {
            month: new Date(t.date).getMonth(),
            type: normalizedType,
            amount: t.amount,
          };
        });
        setSavingsTransactions(txnData);
      }

    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate monthly trends
  const monthlyTrends = useMemo<MonthlyTrend[]>(() => {
    const totalSavings = savingsSummary.pokok + savingsSummary.wajib + savingsSummary.sukarela;
    
    return MONTH_NAMES.slice(0, currentMonth + 1).map((month, idx) => {
      const monthIncome = incomeEntries
        .filter(e => e.month === idx)
        .reduce((sum, e) => sum + e.amount, 0);
      
      const monthExpense = expenseEntries
        .filter(e => e.month === idx)
        .reduce((sum, e) => sum + e.amount, 0);
      
      // Estimate cumulative growth
      const growthFactor = (idx + 1) / 12;
      
      return {
        month,
        pendapatan: monthIncome,
        biaya: monthExpense,
        simpanan: Math.round(totalSavings * growthFactor),
        pinjaman: Math.round(receivables * growthFactor),
      };
    });
  }, [incomeEntries, expenseEntries, savingsSummary, receivables, currentMonth]);

  // Savings composition
  const savingsComposition = useMemo<SavingsComposition[]>(() => [
    { name: 'Simpanan Pokok', value: savingsSummary.pokok, color: COLORS[0] },
    { name: 'Simpanan Wajib', value: savingsSummary.wajib, color: COLORS[1] },
    { name: 'Simpanan Sukarela', value: savingsSummary.sukarela, color: COLORS[2] },
  ], [savingsSummary]);

  // Loan status distribution
  const loanStatus = useMemo<LoanStatusData[]>(() => {
    return [
      { name: 'Aktif', value: loanData.active, color: COLORS[0] },
      { name: 'Lunas', value: loanData.completed, color: COLORS[2] },
      { name: 'Pending', value: loanData.pending, color: COLORS[3] },
      { name: 'Bermasalah', value: loanData.defaulted, color: COLORS[1] },
    ].filter(item => item.value > 0);
  }, [loanData]);

  // Member statistics
  const memberStats = useMemo<MemberStats[]>(() => [
    { name: 'Aktif', value: memberData.active, color: COLORS[2] },
    { name: 'Punya Pinjaman', value: memberData.withLoans, color: COLORS[0] },
    { name: 'Menunggak', value: memberData.defaulting, color: COLORS[1] },
  ], [memberData]);

  // Yearly comparison
  const yearlyComparison = useMemo<YearlyComparison[]>(() => {
    return yearlyData.map(y => ({
      year: y.year.toString(),
      pendapatan: y.income,
      biaya: y.expense,
      shu: Math.max(0, y.income - y.expense),
    }));
  }, [yearlyData]);

  // Savings growth by type (cumulative per month)
  const savingsGrowthByType = useMemo<SavingsGrowthByType[]>(() => {
    let cumulativePokok = 0;
    let cumulativeWajib = 0;
    let cumulativeSukarela = 0;

    return MONTH_NAMES.slice(0, currentMonth + 1).map((month, idx) => {
      const monthPokok = savingsTransactions
        .filter(t => t.month === idx && t.type === 'simpanan_pokok')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const monthWajib = savingsTransactions
        .filter(t => t.month === idx && t.type === 'simpanan_wajib')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const monthSukarela = savingsTransactions
        .filter(t => t.month === idx && t.type === 'simpanan_sukarela')
        .reduce((sum, t) => sum + t.amount, 0);

      cumulativePokok += monthPokok;
      cumulativeWajib += monthWajib;
      cumulativeSukarela += monthSukarela;

      return {
        month,
        pokok: cumulativePokok,
        wajib: cumulativeWajib,
        sukarela: cumulativeSukarela,
      };
    });
  }, [savingsTransactions, currentMonth]);

  return {
    loading,
    monthlyTrends,
    savingsComposition,
    loanStatus,
    memberStats,
    yearlyComparison,
    savingsGrowthByType,
    refetch: fetchData,
  };
};
