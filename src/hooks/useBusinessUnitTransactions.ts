import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BusinessUnitTransaction {
  id: string;
  user_id: string;
  business_unit_id: string;
  transaction_date: string;
  transaction_type: string;
  description: string | null;
  amount: number;
  quantity: number;
  is_member_transaction: boolean;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  journal_entry_id?: string | null;
  // Joined data
  user_name?: string;
  member_number?: string;
  business_unit_name?: string;
  business_unit_code?: string;
}

export interface BusinessUnitTransactionInput {
  user_id: string;
  business_unit_id: string;
  transaction_date: string;
  transaction_type: string;
  description?: string | null;
  amount: number;
  quantity?: number;
  is_member_transaction: boolean;
  notes?: string | null;
}

export const useBusinessUnitTransactions = (businessUnitId?: string) => {
  const [transactions, setTransactions] = useState<BusinessUnitTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      
      // First, fetch transactions
      let query = supabase
        .from('business_unit_transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (businessUnitId) {
        query = query.eq('business_unit_id', businessUnitId);
      }

      const { data: transactionsData, error: transactionsError } = await query;

      if (transactionsError) throw transactionsError;

      if (!transactionsData || transactionsData.length === 0) {
        setTransactions([]);
        return;
      }

      // Get unique user IDs and business unit IDs
      const userIds = [...new Set(transactionsData.map(t => t.user_id))];
      const unitIds = [...new Set(transactionsData.map(t => t.business_unit_id))];

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Fetch business units
      const { data: unitsData, error: unitsError } = await supabase
        .from('business_units')
        .select('id, name, code')
        .in('id', unitIds);

      if (unitsError) {
        console.error('Error fetching business units:', unitsError);
      }

      // Create lookup maps
      const profilesMap = new Map(
        (profilesData || []).map(p => [p.user_id, p])
      );
      const unitsMap = new Map(
        (unitsData || []).map(u => [u.id, u])
      );

      // Format data with joined info
      const formattedData: BusinessUnitTransaction[] = transactionsData.map((t) => {
        const profile = profilesMap.get(t.user_id);
        const unit = unitsMap.get(t.business_unit_id);
        return {
          ...t,
          user_name: profile?.name || 'Unknown',
          member_number: profile?.member_number || '-',
          business_unit_name: unit?.name || 'Unknown',
          business_unit_code: unit?.code || '-',
        };
      });

      setTransactions(formattedData);
    } catch (error) {
      console.error('Error fetching business unit transactions:', error);
      toast.error('Gagal memuat data transaksi unit usaha');
    } finally {
      setLoading(false);
    }
  }, [businessUnitId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = async (
    input: BusinessUnitTransactionInput, 
    createdBy?: string,
    options?: { createJournal?: boolean; memberName?: string }
  ) => {
    try {
      const { data, error } = await supabase
        .from('business_unit_transactions')
        .insert({
          ...input,
          created_by: createdBy,
        })
        .select()
        .single();

      if (error) throw error;

      // Try to create auto-journal if member transaction and journal templates are configured
      let journalEntryId: string | null = null;
      if (options?.createJournal !== false && input.is_member_transaction && input.amount > 0) {
        try {
          // Dynamically import to avoid circular dependencies
          const { createJournalFromBusinessUnitTransaction } = await import('./useBusinessUnitJournalTemplates');
          
          // Get business unit info
          const { data: unitData } = await supabase
            .from('business_units')
            .select('id, code, name')
            .eq('id', input.business_unit_id)
            .single();

          if (unitData && !unitData.code.startsWith('SP')) {
            // Get template for this unit and transaction type
            const templateType = `bu_${unitData.code.toLowerCase()}_${input.transaction_type}`;
            const { data: templateData } = await supabase
              .from('journal_templates')
              .select('*')
              .eq('type', templateType)
              .eq('is_active', true)
              .maybeSingle();

            if (templateData) {
              const lines = Array.isArray(templateData.lines) 
                ? templateData.lines 
                : JSON.parse(templateData.lines as string || '[]');
              
              const isConfigured = lines.every((l: any) => l.accountId);
              
              if (isConfigured) {
                const template = {
                  id: templateData.id,
                  businessUnitId: unitData.id,
                  businessUnitCode: unitData.code,
                  businessUnitName: unitData.name,
                  transactionType: input.transaction_type,
                  name: templateData.name,
                  description: templateData.description || '',
                  lines: lines.map((l: any) => ({
                    accountId: l.accountId || '',
                    accountCode: l.accountCode,
                    accountName: l.accountName,
                    isDebit: l.isDebit,
                    description: l.description,
                  })),
                  isActive: templateData.is_active,
                };

                const memberName = options?.memberName || 'Anggota';
                const entry = await createJournalFromBusinessUnitTransaction(
                  unitData.code,
                  input.transaction_type,
                  input.amount,
                  input.description || '',
                  memberName,
                  template,
                  unitData.id
                );

                if (entry) {
                  journalEntryId = entry.id;
                  // Update transaction with journal reference
                  await supabase
                    .from('business_unit_transactions')
                    .update({ notes: `${input.notes || ''} [Jurnal: ${entry.entry_number}]`.trim() })
                    .eq('id', data.id);
                }
              }
            }
          }
        } catch (journalError) {
          console.warn('Could not create auto-journal for business unit transaction:', journalError);
          // Don't fail the transaction if journal creation fails
        }
      }

      toast.success(journalEntryId 
        ? 'Transaksi berhasil ditambahkan (Jurnal otomatis dibuat)' 
        : 'Transaksi berhasil ditambahkan');
      await fetchTransactions();
      return data;
    } catch (error) {
      console.error('Error adding transaction:', error);
      toast.error('Gagal menambahkan transaksi');
      return null;
    }
  };

  const updateTransaction = async (id: string, input: Partial<BusinessUnitTransactionInput>) => {
    try {
      const { error } = await supabase
        .from('business_unit_transactions')
        .update(input)
        .eq('id', id);

      if (error) throw error;

      toast.success('Transaksi berhasil diperbarui');
      await fetchTransactions();
      return true;
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast.error('Gagal memperbarui transaksi');
      return false;
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      const { error } = await supabase
        .from('business_unit_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Transaksi berhasil dihapus');
      await fetchTransactions();
      return true;
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Gagal menghapus transaksi');
      return false;
    }
  };

  // Get member transaction totals by business unit for SHU calculation
  const getMemberTransactionTotals = async (year: number) => {
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const { data, error } = await supabase
        .from('business_unit_transactions')
        .select(`
          user_id,
          business_unit_id,
          amount,
          business_units:business_unit_id (name, code)
        `)
        .eq('is_member_transaction', true)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      if (error) throw error;

      // Group by user and business unit
      const totals: Record<string, Record<string, { total: number; unitName: string; unitCode: string }>> = {};

      (data || []).forEach((t: any) => {
        if (!totals[t.user_id]) {
          totals[t.user_id] = {};
        }
        if (!totals[t.user_id][t.business_unit_id]) {
          totals[t.user_id][t.business_unit_id] = {
            total: 0,
            unitName: t.business_units?.name || '',
            unitCode: t.business_units?.code || '',
          };
        }
        totals[t.user_id][t.business_unit_id].total += t.amount;
      });

      return totals;
    } catch (error) {
      console.error('Error getting member transaction totals:', error);
      return {};
    }
  };

  return {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getMemberTransactionTotals,
    refetch: fetchTransactions,
  };
};
