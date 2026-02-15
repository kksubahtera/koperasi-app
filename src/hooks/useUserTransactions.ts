import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction } from '@/lib/types';
import { useEffect } from 'react';

const fetchTransactionsData = async (userId: string): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }

  return (data || []).map(t => ({
    id: t.id,
    userId: t.user_id,
    type: t.type,
    amount: Number(t.amount),
    date: t.date || '',
    status: t.status || 'pending',
    paymentMethod: t.payment_method,
    accountHolderName: t.account_holder_name || '',
    notes: t.notes || undefined,
    createdAt: t.created_at || '',
    approvedAt: t.approved_at || undefined,
    approvedBy: t.approved_by || undefined,
    rejectionReason: t.rejection_reason || undefined,
    // Adjustment fields
    originalAmount: t.original_amount !== null ? Number(t.original_amount) : undefined,
    originalDate: t.original_date || undefined,
    adjustedBy: t.adjusted_by || undefined,
    adjustmentReason: t.adjustment_reason || undefined,
    adjustedAt: t.adjusted_at || undefined,
  }));
};

export const useUserTransactions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['user-transactions', user?.id],
    queryFn: () => fetchTransactionsData(user!.id),
    enabled: !!user?.id,
    staleTime: 5000, // Reduced from 30s to 5s for faster updates
    refetchOnMount: 'always',
  });

  // Real-time subscription for transaction updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`transactions-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Realtime] Transaction updated:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['user-transactions', user.id] });
          // Also invalidate savings as transactions affect savings
          queryClient.invalidateQueries({ queryKey: ['user-savings', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return {
    transactions,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
};
