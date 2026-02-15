import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePendingTransactionCount = () => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    const { count: pendingCount, error } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (!error && pendingCount !== null) {
      setCount(pendingCount);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCount();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('pending-transactions-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCount]);

  return { count, loading, refetch: fetchCount };
};
