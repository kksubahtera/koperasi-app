import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SavingsGrowthByType {
  month: string;
  pokok: number;
  wajib: number;
  sukarela: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const useSavingsGrowthByType = (selectedYear: number) => {
  const [loading, setLoading] = useState(true);
  const [savingsTransactions, setSavingsTransactions] = useState<{ month: number; type: string; amount: number }[]>([]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch savings transactions for selected year
      const { data: savingsTxns } = await supabase
        .from('transactions')
        .select('type, amount, date, status')
        .eq('status', 'approved')
        .in('type', ['simpanan_pokok', 'simpanan_wajib', 'simpanan_sukarela', 'setor_simpanan_wajib', 'setor_simpanan_sukarela'])
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`);

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
      } else {
        setSavingsTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching savings growth data:', error);
      setSavingsTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate savings growth by type (cumulative per month)
  const savingsGrowthByType = useMemo<SavingsGrowthByType[]>(() => {
    let cumulativePokok = 0;
    let cumulativeWajib = 0;
    let cumulativeSukarela = 0;

    // For current year, only show up to current month
    // For past years, show all 12 months
    const monthsToShow = selectedYear === currentYear ? currentMonth + 1 : 12;

    return MONTH_NAMES.slice(0, monthsToShow).map((month, idx) => {
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
  }, [savingsTransactions, currentMonth, currentYear, selectedYear]);

  // Calculate totals for the selected year
  const totals = useMemo(() => {
    const pokok = savingsTransactions
      .filter(t => t.type === 'simpanan_pokok')
      .reduce((sum, t) => sum + t.amount, 0);
    const wajib = savingsTransactions
      .filter(t => t.type === 'simpanan_wajib')
      .reduce((sum, t) => sum + t.amount, 0);
    const sukarela = savingsTransactions
      .filter(t => t.type === 'simpanan_sukarela')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return { pokok, wajib, sukarela, total: pokok + wajib + sukarela };
  }, [savingsTransactions]);

  return {
    loading,
    savingsGrowthByType,
    totals,
    refetch: fetchData,
  };
};
