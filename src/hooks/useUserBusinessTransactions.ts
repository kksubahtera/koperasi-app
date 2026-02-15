import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserBusinessTransaction {
  id: string;
  businessUnitId: string;
  businessUnitName: string;
  businessUnitCode: string;
  transactionDate: string;
  transactionType: string;
  amount: number;
  quantity: number | null;
  description: string | null;
  notes: string | null;
}

export interface BusinessUnitSummary {
  id: string;
  name: string;
  code: string;
  totalTransactions: number;
  totalAmount: number;
  transactions: UserBusinessTransaction[];
}

export const useUserBusinessTransactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<UserBusinessTransaction[]>([]);
  const [summaryByUnit, setSummaryByUnit] = useState<BusinessUnitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch user's business unit transactions with unit details
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('business_unit_transactions')
        .select(`
          id,
          business_unit_id,
          transaction_date,
          transaction_type,
          amount,
          quantity,
          description,
          notes,
          business_units (
            id,
            name,
            code
          )
        `)
        .eq('user_id', user.id)
        .eq('is_member_transaction', true)
        .order('transaction_date', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Map to our interface
      const mappedTransactions: UserBusinessTransaction[] = (transactionsData || []).map((t: any) => ({
        id: t.id,
        businessUnitId: t.business_unit_id,
        businessUnitName: t.business_units?.name || 'Unknown',
        businessUnitCode: t.business_units?.code || '-',
        transactionDate: t.transaction_date,
        transactionType: t.transaction_type,
        amount: Number(t.amount),
        quantity: t.quantity ? Number(t.quantity) : null,
        description: t.description,
        notes: t.notes,
      }));

      setTransactions(mappedTransactions);

      // Group by business unit
      const unitMap = new Map<string, BusinessUnitSummary>();
      
      mappedTransactions.forEach(t => {
        if (!unitMap.has(t.businessUnitId)) {
          unitMap.set(t.businessUnitId, {
            id: t.businessUnitId,
            name: t.businessUnitName,
            code: t.businessUnitCode,
            totalTransactions: 0,
            totalAmount: 0,
            transactions: [],
          });
        }
        
        const unit = unitMap.get(t.businessUnitId)!;
        unit.totalTransactions += 1;
        unit.totalAmount += t.amount;
        unit.transactions.push(t);
      });

      setSummaryByUnit(Array.from(unitMap.values()));
    } catch (err: any) {
      console.error('Error fetching business transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    summaryByUnit,
    loading,
    error,
    refetch: fetchTransactions,
  };
};
