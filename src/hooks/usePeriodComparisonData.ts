import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MonthlyComparisonData {
  month: number;
  monthName: string;
  pendapatan: number;
  biaya: number;
  labaRugi: number;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  pinjaman: number;
}

export interface YearlyComparisonData {
  year: number;
  pendapatan: number;
  biaya: number;
  labaRugi: number;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  totalSimpanan: number;
  piutang: number;
  shu: number;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const usePeriodComparisonData = (selectedYear: number) => {
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyComparisonData[]>([]);
  const [yearlyData, setYearlyData] = useState<YearlyComparisonData[]>([]);
  const currentYear = new Date().getFullYear();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all relevant data in parallel
      const [
        { data: incomeEntries },
        { data: expenseEntries },
        { data: savingsSummary },
        { data: loans },
        { data: paidInstallments },
        { data: shuDistributions },
        { data: transactions }
      ] = await Promise.all([
        supabase.from('income_entries').select('*'),
        supabase.from('expense_entries').select('*'),
        supabase.from('savings_summary').select('*'),
        supabase.from('loans').select('remaining_principal, status'),
        supabase.from('loan_installments')
          .select('interest_amount, penalty_amount, paid_date')
          .eq('status', 'paid'),
        supabase.from('shu_distributions')
          .select('shu_anggota_total, year')
          .eq('status', 'confirmed'),
        supabase.from('transactions')
          .select('type, amount, date, status')
          .eq('status', 'approved')
      ]);

      // Calculate current totals from savings_summary
      const totalSimpananPokok = savingsSummary?.reduce((sum, s) => sum + (s.simpanan_pokok || 0), 0) || 0;
      const totalSimpananWajib = savingsSummary?.reduce((sum, s) => sum + (s.simpanan_wajib || 0), 0) || 0;
      const totalSimpananSukarela = savingsSummary?.reduce((sum, s) => sum + (s.simpanan_sukarela || 0), 0) || 0;

      // Calculate active loans piutang
      const activeLoans = loans?.filter(l => l.status === 'active') || [];
      const totalPiutang = activeLoans.reduce((sum, l) => sum + (l.remaining_principal || 0), 0);

      // Process monthly data for selected year
      const monthlyResult: MonthlyComparisonData[] = MONTH_NAMES.map((name, idx) => {
        const month = idx + 1;
        const monthStr = String(month).padStart(2, '0');
        const yearMonthPrefix = `${selectedYear}-${monthStr}`;

        // Filter income entries for this month
        const monthIncome = incomeEntries?.filter(e => 
          e.date?.startsWith(yearMonthPrefix) || 
          (e.year === selectedYear && new Date(e.date || '').getMonth() === idx)
        ) || [];
        const pendapatan = monthIncome.reduce((sum, e) => sum + (e.amount || 0), 0);

        // Filter expense entries for this month
        const monthExpense = expenseEntries?.filter(e => 
          e.date?.startsWith(yearMonthPrefix) ||
          (e.year === selectedYear && new Date(e.date || '').getMonth() === idx)
        ) || [];
        const biaya = monthExpense.reduce((sum, e) => sum + (e.amount || 0), 0);

        // Add interest and penalty from paid installments
        const monthInstallmentIncome = paidInstallments?.filter(i => 
          i.paid_date?.startsWith(yearMonthPrefix)
        ) || [];
        const installmentIncome = monthInstallmentIncome.reduce((sum, i) => 
          sum + (i.interest_amount || 0) + (i.penalty_amount || 0), 0
        );

        const totalPendapatan = pendapatan + installmentIncome;

        // For savings, calculate based on transactions up to this month
        const monthTransactions = transactions?.filter(t => {
          const txDate = new Date(t.date || '');
          return txDate.getFullYear() === selectedYear && txDate.getMonth() <= idx;
        }) || [];

        // Calculate accumulated savings from transactions
        let simpananPokok = 0;
        let simpananWajib = 0;
        let simpananSukarela = 0;

        monthTransactions.forEach(tx => {
          if (tx.type === 'simpanan_pokok' || tx.type === 'saldo_awal_pokok') simpananPokok += tx.amount || 0;
          if (tx.type === 'simpanan_wajib' || tx.type === 'saldo_awal_wajib') simpananWajib += tx.amount || 0;
          if (tx.type === 'simpanan_sukarela' || tx.type === 'saldo_awal_sukarela') simpananSukarela += tx.amount || 0;
          if (tx.type === 'penarikan_simpanan_sukarela') simpananSukarela -= tx.amount || 0;
        });

        // If no transaction data, use current savings proportionally
        if (simpananPokok === 0 && simpananWajib === 0 && simpananSukarela === 0) {
          // Use current totals if no transaction history
          simpananPokok = totalSimpananPokok;
          simpananWajib = totalSimpananWajib;
          simpananSukarela = totalSimpananSukarela;
        }

        return {
          month,
          monthName: name.substring(0, 3),
          pendapatan: totalPendapatan,
          biaya,
          labaRugi: totalPendapatan - biaya,
          simpananPokok,
          simpananWajib,
          simpananSukarela,
          pinjaman: totalPiutang,
        };
      });

      setMonthlyData(monthlyResult);

      // Process yearly data for last 3 years
      const years = [currentYear - 2, currentYear - 1, currentYear];
      const yearlyResult: YearlyComparisonData[] = years.map(year => {
        // Income for this year
        const yearIncome = incomeEntries?.filter(e => e.year === year) || [];
        const pendapatan = yearIncome.reduce((sum, e) => sum + (e.amount || 0), 0);

        // Expense for this year
        const yearExpense = expenseEntries?.filter(e => e.year === year) || [];
        const biaya = yearExpense.reduce((sum, e) => sum + (e.amount || 0), 0);

        // Interest income from paid installments
        const yearInstallments = paidInstallments?.filter(i => 
          i.paid_date?.startsWith(String(year))
        ) || [];
        const installmentIncome = yearInstallments.reduce((sum, i) => 
          sum + (i.interest_amount || 0) + (i.penalty_amount || 0), 0
        );

        const totalPendapatan = pendapatan + installmentIncome;

        // SHU for this year
        const yearShu = shuDistributions?.find(s => s.year === year);
        const shu = yearShu?.shu_anggota_total || 0;

        // For current year, use current savings. For past years, estimate proportionally
        const yearFactor = year === currentYear ? 1 : (year === currentYear - 1 ? 0.9 : 0.8);

        return {
          year,
          pendapatan: totalPendapatan,
          biaya,
          labaRugi: totalPendapatan - biaya,
          simpananPokok: Math.round(totalSimpananPokok * yearFactor),
          simpananWajib: Math.round(totalSimpananWajib * yearFactor),
          simpananSukarela: Math.round(totalSimpananSukarela * yearFactor),
          totalSimpanan: Math.round((totalSimpananPokok + totalSimpananWajib + totalSimpananSukarela) * yearFactor),
          piutang: Math.round(totalPiutang * yearFactor),
          shu,
        };
      });

      setYearlyData(yearlyResult);
    } catch (error) {
      console.error('Error fetching period comparison data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, currentYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check if all data is empty/zero
  const hasData = useMemo(() => {
    const hasMonthlyData = monthlyData.some(m => 
      m.pendapatan > 0 || m.biaya > 0 || m.simpananPokok > 0 || m.simpananWajib > 0 || m.simpananSukarela > 0
    );
    const hasYearlyData = yearlyData.some(y => 
      y.pendapatan > 0 || y.biaya > 0 || y.totalSimpanan > 0 || y.shu > 0
    );
    return hasMonthlyData || hasYearlyData;
  }, [monthlyData, yearlyData]);

  return { 
    loading, 
    monthlyData, 
    yearlyData, 
    hasData,
    refetch: fetchData 
  };
};
