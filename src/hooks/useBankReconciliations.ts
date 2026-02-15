import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OutstandingItem {
  id: string;
  type: 'deposit_in_transit' | 'outstanding_check' | 'bank_charge' | 'bank_interest' | 'error_correction' | 'other';
  description: string;
  amount: number;
  date: string;
  cleared: boolean;
}

export interface BankReconciliation {
  id: string;
  reconciliation_date: string;
  period_month: number;
  period_year: number;
  bank_statement_balance: number;
  book_balance: number;
  adjusted_bank_balance: number;
  adjusted_book_balance: number;
  difference: number;
  is_reconciled: boolean;
  outstanding_items: OutstandingItem[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankReconciliationInsert {
  reconciliation_date: string;
  period_month: number;
  period_year: number;
  bank_statement_balance: number;
  book_balance: number;
  adjusted_bank_balance: number;
  adjusted_book_balance: number;
  difference: number;
  is_reconciled: boolean;
  outstanding_items: OutstandingItem[];
  notes?: string;
}

export const useBankReconciliations = () => {
  const [reconciliations, setReconciliations] = useState<BankReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchReconciliations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bank_reconciliations')
        .select('*')
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

      if (error) throw error;

      // Parse outstanding_items from JSON
      const parsed = (data || []).map(item => ({
        ...item,
        outstanding_items: (item.outstanding_items as unknown as OutstandingItem[]) || []
      }));

      setReconciliations(parsed);
    } catch (error: any) {
      console.error('Error fetching reconciliations:', error);
      toast.error('Gagal memuat data rekonsiliasi');
    } finally {
      setLoading(false);
    }
  };

  const getReconciliationByPeriod = async (month: number, year: number): Promise<BankReconciliation | null> => {
    try {
      const { data, error } = await supabase
        .from('bank_reconciliations')
        .select('*')
        .eq('period_month', month)
        .eq('period_year', year)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return {
          ...data,
          outstanding_items: (data.outstanding_items as unknown as OutstandingItem[]) || []
        };
      }

      return null;
    } catch (error: any) {
      console.error('Error fetching reconciliation:', error);
      return null;
    }
  };

  const saveReconciliation = async (data: BankReconciliationInsert): Promise<boolean> => {
    try {
      setSaving(true);

      const { data: user } = await supabase.auth.getUser();
      
      // Check if reconciliation exists for this period
      const existing = await getReconciliationByPeriod(data.period_month, data.period_year);

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('bank_reconciliations')
          .update({
            reconciliation_date: data.reconciliation_date,
            bank_statement_balance: data.bank_statement_balance,
            book_balance: data.book_balance,
            adjusted_bank_balance: data.adjusted_bank_balance,
            adjusted_book_balance: data.adjusted_book_balance,
            difference: data.difference,
            is_reconciled: data.is_reconciled,
            outstanding_items: data.outstanding_items as unknown as any,
            notes: data.notes || null,
          })
          .eq('id', existing.id);

        if (error) throw error;
        toast.success('Rekonsiliasi berhasil diperbarui');
      } else {
        // Insert new
        const { error } = await supabase
          .from('bank_reconciliations')
          .insert({
            reconciliation_date: data.reconciliation_date,
            period_month: data.period_month,
            period_year: data.period_year,
            bank_statement_balance: data.bank_statement_balance,
            book_balance: data.book_balance,
            adjusted_bank_balance: data.adjusted_bank_balance,
            adjusted_book_balance: data.adjusted_book_balance,
            difference: data.difference,
            is_reconciled: data.is_reconciled,
            outstanding_items: data.outstanding_items as unknown as any,
            notes: data.notes || null,
            created_by: user?.user?.id || null,
          });

        if (error) throw error;
        toast.success(data.is_reconciled 
          ? 'Rekonsiliasi berhasil disimpan - Saldo cocok!' 
          : 'Rekonsiliasi disimpan dengan selisih'
        );
      }

      await fetchReconciliations();
      return true;
    } catch (error: any) {
      console.error('Error saving reconciliation:', error);
      toast.error('Gagal menyimpan rekonsiliasi: ' + error.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteReconciliation = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('bank_reconciliations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Rekonsiliasi berhasil dihapus');
      await fetchReconciliations();
      return true;
    } catch (error: any) {
      console.error('Error deleting reconciliation:', error);
      toast.error('Gagal menghapus rekonsiliasi');
      return false;
    }
  };

  useEffect(() => {
    fetchReconciliations();
  }, []);

  return {
    reconciliations,
    loading,
    saving,
    fetchReconciliations,
    getReconciliationByPeriod,
    saveReconciliation,
    deleteReconciliation,
  };
};
