import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback, useMemo, useEffect } from 'react';
import { dispatchRealtimeUpdate } from '@/components/shared/RealtimeIndicator';
import { toast } from 'sonner';

export interface TransactionWithProfile {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  date: string | null;
  status: string;
  payment_method: string;
  account_holder_name: string | null;
  notes: string | null;
  created_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  installment_id: string | null;
  profiles: {
    name: string;
    member_number: string | null;
  } | null;
}

const PAGE_SIZE = 20;

// Hook for paginated transactions with infinite scroll
export const useAllTransactionsPaginated = () => {
  const queryClient = useQueryClient();
  
  // Set up real-time subscription for transactions
  useEffect(() => {
    const channel = supabase
      .channel('all-transactions-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        (payload: any) => {
          console.log('[Realtime] New transaction inserted:', payload);
          // Show toast notification for new pending transactions
          if (payload.new?.status === 'pending') {
            toast.info('Transaksi Baru', {
              description: 'Ada transaksi baru yang perlu diverifikasi',
              duration: 4000,
            });
          }
          dispatchRealtimeUpdate();
          queryClient.invalidateQueries({ queryKey: ['all-transactions-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions' },
        (payload) => {
          console.log('[Realtime] Transaction updated:', payload);
          dispatchRealtimeUpdate();
          queryClient.invalidateQueries({ queryKey: ['all-transactions-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'transactions' },
        (payload) => {
          console.log('[Realtime] Transaction deleted:', payload);
          dispatchRealtimeUpdate();
          queryClient.invalidateQueries({ queryKey: ['all-transactions-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to transactions table');
        }
      });

    return () => {
      console.log('[Realtime] Unsubscribing from transactions');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
  const query = useInfiniteQuery({
    queryKey: ['all-transactions-paginated'],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Fetch transactions with pagination
      const { data: transactions, error: transactionsError, count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (transactionsError) throw transactionsError;

      if (!transactions || transactions.length === 0) {
        return { 
          data: [] as TransactionWithProfile[], 
          nextPage: null,
          totalCount: count || 0
        };
      }

      // Fetch profiles separately
      const userIds = [...new Set(transactions.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const transformedData = transactions.map(t => ({
        id: t.id,
        user_id: t.user_id,
        type: t.type,
        amount: t.amount,
        date: t.date,
        status: t.status,
        payment_method: t.payment_method,
        account_holder_name: t.account_holder_name,
        notes: t.notes,
        created_at: t.created_at,
        approved_at: t.approved_at,
        approved_by: t.approved_by,
        rejection_reason: t.rejection_reason,
        installment_id: t.installment_id,
        profiles: profileMap.get(t.user_id) || null
      })) as TransactionWithProfile[];

      const hasNextPage = count ? from + transactions.length < count : transactions.length === PAGE_SIZE;

      return { 
        data: transformedData, 
        nextPage: hasNextPage ? pageParam + 1 : null,
        totalCount: count || 0
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 5000, // 5 seconds - data considered fresh
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const transactions = useMemo(() => 
    query.data?.pages.flatMap(page => page.data) || [],
    [query.data]
  );

  const totalCount = query.data?.pages[0]?.totalCount || 0;

  return {
    transactions,
    totalCount,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    error: query.error?.message || null,
    fetchNextPage: query.fetchNextPage,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['all-transactions-paginated'] }),
  };
};

// Original hook for backward compatibility (now with simple pagination)
export const useAllTransactions = () => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['all-transactions'],
    staleTime: 5000, // 5 seconds
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // Fetch transactions - limited to most recent 100 for performance
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (transactionsError) throw transactionsError;

      if (!transactions || transactions.length === 0) {
        return [] as TransactionWithProfile[];
      }

      // Fetch profiles separately
      const userIds = [...new Set(transactions.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return transactions.map(t => ({
        id: t.id,
        user_id: t.user_id,
        type: t.type,
        amount: t.amount,
        date: t.date,
        status: t.status,
        payment_method: t.payment_method,
        account_holder_name: t.account_holder_name,
        notes: t.notes,
        created_at: t.created_at,
        approved_at: t.approved_at,
        approved_by: t.approved_by,
        rejection_reason: t.rejection_reason,
        installment_id: t.installment_id,
        profiles: profileMap.get(t.user_id) || null
      })) as TransactionWithProfile[];
    },
  });

  return {
    transactions: query.data || [],
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['all-transactions'] }),
  };
};
