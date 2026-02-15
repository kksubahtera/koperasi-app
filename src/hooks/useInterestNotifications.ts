import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface InterestNotification {
  id: string;
  user_id: string;
  period: string;
  period_name: string;
  eligible_balance: number;
  interest_rate: number;
  interest_amount: number;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

interface UseInterestNotificationsReturn {
  notifications: InterestNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
}

export const useInterestNotifications = (): UseInterestNotificationsReturn => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, error, refetch } = useQuery({
    queryKey: ['interest-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error: fetchError } = await supabase
        .from('interest_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;

      return (data || []) as InterestNotification[];
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.is_read).length,
    [notifications]
  );

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error: updateError } = await supabase
        .from('interest_notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (updateError) throw updateError;
      return notificationId;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['interest-notifications', user?.id] });
      const previousNotifications = queryClient.getQueryData<InterestNotification[]>(['interest-notifications', user?.id]);
      
      queryClient.setQueryData<InterestNotification[]>(['interest-notifications', user?.id], (old) => 
        old?.map(n => n.id === notificationId 
          ? { ...n, is_read: true, read_at: new Date().toISOString() } 
          : n
        ) || []
      );
      
      return { previousNotifications };
    },
    onError: (err, notificationId, context) => {
      console.error('Error marking notification as read:', err);
      if (context?.previousNotifications) {
        queryClient.setQueryData(['interest-notifications', user?.id], context.previousNotifications);
      }
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user');
      
      const { error: updateError } = await supabase
        .from('interest_notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (updateError) throw updateError;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['interest-notifications', user?.id] });
      const previousNotifications = queryClient.getQueryData<InterestNotification[]>(['interest-notifications', user?.id]);
      
      queryClient.setQueryData<InterestNotification[]>(['interest-notifications', user?.id], (old) => 
        old?.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })) || []
      );
      
      return { previousNotifications };
    },
    onError: (err, _, context) => {
      console.error('Error marking all notifications as read:', err);
      if (context?.previousNotifications) {
        queryClient.setQueryData(['interest-notifications', user?.id], context.previousNotifications);
      }
    },
  });

  const markAsRead = useCallback(async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification || notification.is_read) return;
    markAsReadMutation.mutate(notificationId);
  }, [notifications, markAsReadMutation]);

  const markAllAsRead = useCallback(async () => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error: error ? 'Gagal memuat notifikasi' : null,
    markAsRead,
    markAllAsRead,
    refetch: async () => { await refetch(); },
  };
};
