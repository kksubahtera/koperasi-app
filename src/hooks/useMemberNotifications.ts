import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface MemberNotification {
  id: string;
  title: string;
  message: string;
  notificationType: string;
  metadata: Record<string, any>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export const useMemberNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['member-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('member_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map((n: any): MemberNotification => ({
        id: n.id,
        title: n.title,
        message: n.message,
        notificationType: n.notification_type,
        metadata: n.metadata || {},
        isRead: n.is_read,
        readAt: n.read_at,
        createdAt: n.created_at,
      }));
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.isRead).length, 
    [notifications]
  );

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('member_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
      return notificationId;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['member-notifications', user?.id] });
      const previousNotifications = queryClient.getQueryData<MemberNotification[]>(['member-notifications', user?.id]);
      
      queryClient.setQueryData<MemberNotification[]>(['member-notifications', user?.id], (old) => 
        old?.map(n => n.id === notificationId 
          ? { ...n, isRead: true, readAt: new Date().toISOString() } 
          : n
        ) || []
      );
      
      return { previousNotifications };
    },
    onError: (err, notificationId, context) => {
      console.error('Error marking notification as read:', err);
      if (context?.previousNotifications) {
        queryClient.setQueryData(['member-notifications', user?.id], context.previousNotifications);
      }
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user');
      
      const { error } = await supabase
        .from('member_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['member-notifications', user?.id] });
      const previousNotifications = queryClient.getQueryData<MemberNotification[]>(['member-notifications', user?.id]);
      
      queryClient.setQueryData<MemberNotification[]>(['member-notifications', user?.id], (old) => 
        old?.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })) || []
      );
      
      return { previousNotifications };
    },
    onError: (err, _, context) => {
      console.error('Error marking all notifications as read:', err);
      if (context?.previousNotifications) {
        queryClient.setQueryData(['member-notifications', user?.id], context.previousNotifications);
      }
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('member_notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return notificationId;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['member-notifications', user?.id] });
      const previousNotifications = queryClient.getQueryData<MemberNotification[]>(['member-notifications', user?.id]);
      
      queryClient.setQueryData<MemberNotification[]>(['member-notifications', user?.id], (old) => 
        old?.filter(n => n.id !== notificationId) || []
      );
      
      return { previousNotifications };
    },
    onError: (err, notificationId, context) => {
      console.error('Error deleting notification:', err);
      if (context?.previousNotifications) {
        queryClient.setQueryData(['member-notifications', user?.id], context.previousNotifications);
      }
    },
  });

  const markAsRead = useCallback(async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification || notification.isRead) return;
    markAsReadMutation.mutate(notificationId);
  }, [notifications, markAsReadMutation]);

  const markAllAsRead = useCallback(async () => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    deleteNotificationMutation.mutate(notificationId);
  }, [deleteNotificationMutation]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch,
  };
};
