import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type TableName = 'transactions' | 'savings_summary' | 'loans' | 'loan_installments' | 'profiles' | 'cooperative_settings' | 'member_notifications' | 'admin_notifications' | 'corrections';

interface UseRealtimeSubscriptionOptions {
  tables: TableName[];
  userId?: string;
  onUpdate?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

// Map table names to their React Query keys
const tableToQueryKeys: Record<TableName, string[]> = {
  transactions: ['user-transactions', 'all-transactions'],
  savings_summary: ['user-savings', 'savings-summary'],
  loans: ['user-loans', 'all-loans'],
  loan_installments: ['user-loans', 'loan-installments'],
  profiles: ['user-profile', 'profiles', 'all-members'],
  cooperative_settings: ['cooperative-settings'],
  member_notifications: ['member-notifications', 'notification-count'],
  admin_notifications: ['admin-notifications'],
  corrections: ['corrections', 'user-corrections'],
};

export const useRealtimeSubscription = ({ 
  tables, 
  userId,
  onUpdate 
}: UseRealtimeSubscriptionOptions) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (tables.length === 0) return;

    const channelName = `realtime-${tables.join('-')}-${userId || 'global'}`;
    
    const channel = supabase.channel(channelName);

    // Subscribe to each table
    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          ...(userId && ['transactions', 'savings_summary', 'loans', 'member_notifications'].includes(table)
            ? { filter: `user_id=eq.${userId}` }
            : {}),
        },
        (payload) => {
          console.log(`[Realtime] ${table} changed:`, payload.eventType);
          
          // Invalidate related queries
          const queryKeys = tableToQueryKeys[table] || [];
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });

          // Call custom update handler
          onUpdate?.(payload);
        }
      );
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Subscribed to: ${tables.join(', ')}`);
      }
    });

    return () => {
      console.log(`[Realtime] Unsubscribing from: ${tables.join(', ')}`);
      supabase.removeChannel(channel);
    };
  }, [tables.join(','), userId, queryClient, onUpdate]);
};

// Simplified hook for member dashboard
export const useMemberRealtimeUpdates = (userId: string | undefined) => {
  useRealtimeSubscription({
    tables: ['transactions', 'savings_summary', 'loans', 'loan_installments', 'member_notifications'],
    userId,
  });
};

// Simplified hook for admin dashboard
export const useAdminRealtimeUpdates = () => {
  useRealtimeSubscription({
    tables: ['transactions', 'loans', 'profiles', 'admin_notifications', 'corrections'],
  });
};
