import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface IncomeEntry {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  year: number;
  created_at: string;
  // Related journal info
  journal_entry_number?: string;
}

export interface ExpenseEntry {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  year: number;
  created_at: string;
  // Related journal info
  journal_entry_number?: string;
}

// Income Entries Hook - Supabase based
export function useIncomeEntries(year?: number) {
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    
    let query = supabase
      .from('income_entries')
      .select('*')
      .order('date', { ascending: false });

    if (year) {
      query = query.eq('year', year);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching income entries:', error);
      toast.error('Gagal mengambil data pendapatan');
    } else {
      // Fetch related journal entries for display
      const entriesWithJournal = await Promise.all((data || []).map(async (entry) => {
        const { data: journal } = await supabase
          .from('journal_entries')
          .select('entry_number')
          .eq('reference_type', 'income_entry')
          .eq('reference_id', entry.id)
          .maybeSingle();

        return {
          ...entry,
          journal_entry_number: journal?.entry_number
        };
      }));

      setEntries(entriesWithJournal);
    }
    setLoading(false);
  }, [year]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return { entries, loading, refetch: fetchEntries };
}

// Expense Entries Hook - Supabase based
export function useExpenseEntries(year?: number) {
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    
    let query = supabase
      .from('expense_entries')
      .select('*')
      .order('date', { ascending: false });

    if (year) {
      query = query.eq('year', year);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching expense entries:', error);
      toast.error('Gagal mengambil data beban');
    } else {
      // Fetch related journal entries for display
      const entriesWithJournal = await Promise.all((data || []).map(async (entry) => {
        const { data: journal } = await supabase
          .from('journal_entries')
          .select('entry_number')
          .eq('reference_type', 'expense_entry')
          .eq('reference_id', entry.id)
          .maybeSingle();

        return {
          ...entry,
          journal_entry_number: journal?.entry_number
        };
      }));

      setEntries(entriesWithJournal);
    }
    setLoading(false);
  }, [year]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return { entries, loading, refetch: fetchEntries };
}

// Combined hook for both income and expense
export function useIncomeExpenseData(year?: number) {
  const { entries: incomeEntries, loading: incomeLoading, refetch: refetchIncome } = useIncomeEntries(year);
  const { entries: expenseEntries, loading: expenseLoading, refetch: refetchExpense } = useExpenseEntries(year);

  const refetch = useCallback(async () => {
    await Promise.all([refetchIncome(), refetchExpense()]);
  }, [refetchIncome, refetchExpense]);

  return {
    incomeEntries,
    expenseEntries,
    loading: incomeLoading || expenseLoading,
    refetch
  };
}
