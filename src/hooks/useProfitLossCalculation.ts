import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProfitLoss, IncomeEntry, ExpenseEntry } from '@/lib/cooperativeSettings';
import { toast } from 'sonner';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';
import { calculateAssetDepreciation, FixedAsset } from './useFixedAssetDepreciation';

export interface ProfitLossCalculation extends ProfitLoss {
  isCalculated: boolean;
  biayaPenyusutan: number; // Depreciation expense
}

/**
 * Hook untuk menghitung Laba Rugi secara otomatis dari data transaksi
 * 
 * Rumus:
 * - Pendapatan Bunga = Σ(interest_amount dari installments yang dibayar)
 * - Pendapatan Denda = Σ(penalty_amount dari installments yang dibayar)
 * - Pendapatan Manual = Σ(income_entries dengan type='manual')
 * - Biaya Bunga Simpanan = Σ(simpanan_sukarela × interest_rate per bulan)
 * - Biaya Manual = Σ(expense_entries dengan type='manual')
 * - SHU Bruto = Total Pendapatan - Total Biaya
 */
export const useProfitLossCalculation = (year: number) => {
  const [profitLoss, setProfitLoss] = useState<ProfitLossCalculation | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateProfitLoss = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const settings = getCooperativeSettings();

      // 1. Fetch paid installments for bunga and denda
      const { data: paidInstallments } = await supabase
        .from('loan_installments')
        .select('interest_amount, penalty_amount, paid_date')
        .eq('status', 'paid')
        .gte('paid_date', startDate)
        .lte('paid_date', endDate);

      const pendapatanBungaPinjaman = paidInstallments?.reduce((sum, i) => sum + (i.interest_amount || 0), 0) || 0;
      const pendapatanDendaPinjaman = paidInstallments?.reduce((sum, i) => sum + (i.penalty_amount || 0), 0) || 0;

      // 2. Fetch manual income entries
      const { data: incomeEntries } = await supabase
        .from('income_entries')
        .select('amount, type')
        .eq('year', year);

      const pendapatanManual = incomeEntries
        ?.filter(e => e.type === 'manual')
        .reduce((sum, e) => sum + e.amount, 0) || 0;

      // 3. Calculate bunga simpanan sukarela
      // Get interest notifications for the year (these are created by monthly closing)
      const { data: interestNotifications } = await supabase
        .from('interest_notifications')
        .select('interest_amount, period')
        .like('period', `${year}-%`);

      let biayaBungaSimpanan = interestNotifications?.reduce((sum, n) => sum + (n.interest_amount || 0), 0) || 0;

      // If no interest notifications, estimate from current savings
      if (biayaBungaSimpanan === 0) {
        const { data: savingsData } = await supabase
          .from('savings_summary')
          .select('simpanan_sukarela');

        const totalSimpananSukarela = savingsData?.reduce((sum, s) => sum + (s.simpanan_sukarela || 0), 0) || 0;
        const monthlyRate = (settings.simpananSukarelaInterestRate || 0.4) / 100;
        // Estimate for months passed in the year
        const monthsPassed = year === new Date().getFullYear() 
          ? new Date().getMonth() + 1 
          : 12;
        biayaBungaSimpanan = totalSimpananSukarela * monthlyRate * monthsPassed;
      }

      // 4. Fetch manual expense entries
      const { data: expenseEntries } = await supabase
        .from('expense_entries')
        .select('amount, type')
        .eq('year', year);

      const biayaManual = expenseEntries
        ?.filter(e => e.type === 'manual')
        .reduce((sum, e) => sum + e.amount, 0) || 0;

      // 5. Calculate depreciation expense from fixed assets
      const { data: fixedAssets } = await supabase
        .from('fixed_assets')
        .select('*')
        .eq('status', 'active');

      let biayaPenyusutan = 0;
      if (fixedAssets && fixedAssets.length > 0) {
        // Calculate yearly depreciation for the selected year
        const yearEndDate = new Date(year, 11, 31); // December 31st of the year
        const yearStartDate = new Date(year, 0, 1); // January 1st of the year
        
        (fixedAssets as FixedAsset[]).forEach(asset => {
          const acquisitionDate = new Date(asset.acquisition_date);
          
          // Only count depreciation if asset was acquired before or during the year
          if (acquisitionDate <= yearEndDate) {
            const depreciation = calculateAssetDepreciation(asset, yearEndDate);
            const depreciationAtYearStart = calculateAssetDepreciation(asset, new Date(year - 1, 11, 31));
            
            // Yearly depreciation = accumulated at year end - accumulated at year start
            let yearlyDep = depreciation.accumulatedToDate - depreciationAtYearStart.accumulatedToDate;
            
            // If asset acquired during this year, only count from acquisition date
            if (acquisitionDate >= yearStartDate && acquisitionDate <= yearEndDate) {
              yearlyDep = depreciation.accumulatedToDate;
            }
            
            biayaPenyusutan += Math.max(0, yearlyDep);
          }
        });
      }

      // Calculate totals
      const totalPendapatan = pendapatanBungaPinjaman + pendapatanDendaPinjaman + pendapatanManual;
      const totalBiaya = biayaBungaSimpanan + biayaManual + biayaPenyusutan;
      const shuBruto = totalPendapatan - totalBiaya;

      const calculatedPL: ProfitLossCalculation = {
        year,
        isCalculated: true,
        pendapatanManual,
        pendapatanBungaPinjaman,
        pendapatanDendaPinjaman,
        totalPendapatan,
        biayaManual,
        biayaBungaSimpanan,
        biayaPenyusutan,
        totalBiaya,
        shuBruto,
      };

      setProfitLoss(calculatedPL);
    } catch (error) {
      console.error('Error calculating profit/loss:', error);
      toast.error('Gagal menghitung laba rugi');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    calculateProfitLoss();
  }, [calculateProfitLoss]);

  // Add manual income entry
  const addIncomeEntry = async (description: string, amount: number) => {
    try {
      const { error } = await supabase.from('income_entries').insert([{
        description,
        amount,
        type: 'manual',
        year,
        date: new Date().toISOString(),
      }]);

      if (error) throw error;
      toast.success('Pendapatan berhasil ditambahkan');
      await calculateProfitLoss();
    } catch (error) {
      console.error('Error adding income entry:', error);
      toast.error('Gagal menambahkan pendapatan');
    }
  };

  // Add manual expense entry
  const addExpenseEntry = async (description: string, amount: number) => {
    try {
      const { error } = await supabase.from('expense_entries').insert([{
        description,
        amount,
        type: 'manual',
        year,
        date: new Date().toISOString(),
      }]);

      if (error) throw error;
      toast.success('Biaya berhasil ditambahkan');
      await calculateProfitLoss();
    } catch (error) {
      console.error('Error adding expense entry:', error);
      toast.error('Gagal menambahkan biaya');
    }
  };

  return {
    profitLoss,
    loading,
    refetch: calculateProfitLoss,
    addIncomeEntry,
    addExpenseEntry,
  };
};

// Hook to get income and expense entries for display
export const useIncomeExpenseEntries = (year: number) => {
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [incomeRes, expenseRes] = await Promise.all([
        supabase.from('income_entries').select('id, description, amount, type, date, year').eq('year', year).order('date', { ascending: false }),
        supabase.from('expense_entries').select('id, description, amount, type, date, year').eq('year', year).order('date', { ascending: false }),
      ]);

      // Cast to proper types - database returns string but we know the values are valid
      setIncomeEntries((incomeRes.data || []) as IncomeEntry[]);
      setExpenseEntries((expenseRes.data || []) as ExpenseEntry[]);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const deleteIncomeEntry = async (id: string) => {
    const { error } = await supabase.from('income_entries').delete().eq('id', id);
    if (error) {
      toast.error('Gagal menghapus pendapatan');
      return false;
    }
    toast.success('Pendapatan berhasil dihapus');
    await fetchEntries();
    return true;
  };

  const deleteExpenseEntry = async (id: string) => {
    const { error } = await supabase.from('expense_entries').delete().eq('id', id);
    if (error) {
      toast.error('Gagal menghapus biaya');
      return false;
    }
    toast.success('Biaya berhasil dihapus');
    await fetchEntries();
    return true;
  };

  return {
    incomeEntries,
    expenseEntries,
    loading,
    refetch: fetchEntries,
    deleteIncomeEntry,
    deleteExpenseEntry,
  };
};
