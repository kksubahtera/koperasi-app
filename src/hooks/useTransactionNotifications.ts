import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getTransactionTypeLabel } from '@/lib/mockData';

export const useTransactionNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up transaction notifications for user:', user.id);

    const channel = supabase
      .channel('transaction-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Transaction update received:', payload);
          
          const newRecord = payload.new as {
            id: string;
            status: string;
            type: string;
            amount: number;
            rejection_reason?: string;
          };
          const oldRecord = payload.old as { status: string };

          // Only notify if status changed from pending
          if (oldRecord.status === 'pending' && newRecord.status !== 'pending') {
            const transactionType = getTransactionTypeLabel(newRecord.type as any);
            const amount = new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              minimumFractionDigits: 0,
            }).format(newRecord.amount);

            if (newRecord.status === 'approved') {
              toast.success('Transaksi Disetujui! ✓', {
                description: `${transactionType} sebesar ${amount} telah disetujui.`,
                duration: 5000,
              });
            } else if (newRecord.status === 'rejected') {
              toast.error('Transaksi Ditolak', {
                description: newRecord.rejection_reason 
                  ? `${transactionType}: ${newRecord.rejection_reason}`
                  : `${transactionType} sebesar ${amount} telah ditolak.`,
                duration: 7000,
              });
            }

            // Refresh data
            queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
            queryClient.invalidateQueries({ queryKey: ['user-savings'] });
            queryClient.invalidateQueries({ queryKey: ['user-loans'] });
          }
        }
      )
      .subscribe((status) => {
        console.log('Transaction notification subscription status:', status);
      });

    return () => {
      console.log('Cleaning up transaction notifications');
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
};
