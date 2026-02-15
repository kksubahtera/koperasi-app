import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminActivityLog {
  id: string;
  admin_user_id: string;
  admin_name?: string;
  action_type: string;
  target_entity: string | null;
  target_id: string | null;
  description: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminActivityFilters {
  adminUserId?: string;
  actionType?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

export const ACTION_TYPE_OPTIONS = [
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'grant_admin_role', label: 'Berikan Akses Admin' },
  { value: 'remove_admin_role', label: 'Hapus Akses Admin' },
  { value: 'approve_transaction', label: 'Setujui Transaksi' },
  { value: 'reject_transaction', label: 'Tolak Transaksi' },
  { value: 'approve_loan', label: 'Setujui Pinjaman' },
  { value: 'reject_loan', label: 'Tolak Pinjaman' },
  { value: 'approve_registration', label: 'Setujui Pendaftaran' },
  { value: 'reject_registration', label: 'Tolak Pendaftaran' },
  { value: 'update_settings', label: 'Ubah Pengaturan' },
  { value: 'update_member', label: 'Ubah Data Anggota' },
  { value: 'deactivate_member', label: 'Nonaktifkan Anggota' },
  { value: 'reset_password', label: 'Reset Password' },
  { value: 'create_correction', label: 'Buat Koreksi' },
  { value: 'other', label: 'Lainnya' },
];

export const useAdminActivityLogs = (filters?: AdminActivityFilters) => {
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('admin_activity_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters?.adminUserId) {
        query = query.eq('admin_user_id', filters.adminUserId);
      }

      if (filters?.actionType) {
        query = query.eq('action_type', filters.actionType);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters?.searchQuery) {
        query = query.ilike('description', `%${filters.searchQuery}%`);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      // Get admin names
      const adminIds = [...new Set((data || []).map(log => log.admin_user_id))];
      
      let adminNames: Record<string, string> = {};
      if (adminIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', adminIds);

        if (profiles) {
          adminNames = profiles.reduce((acc, p) => {
            acc[p.user_id] = p.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const logsWithNames: AdminActivityLog[] = (data || []).map(log => ({
        ...log,
        admin_name: adminNames[log.admin_user_id] || 'Unknown',
        metadata: (log.metadata as Record<string, unknown>) || {},
      }));

      setLogs(logsWithNames);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching admin activity logs:', err);
      setError('Gagal memuat log aktivitas');
    } finally {
      setLoading(false);
    }
  }, [filters?.adminUserId, filters?.actionType, filters?.startDate, filters?.endDate, filters?.searchQuery]);

  const logActivity = async (
    adminUserId: string,
    actionType: string,
    description: string,
    options?: {
      targetEntity?: string;
      targetId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.from('admin_activity_logs').insert([{
        admin_user_id: adminUserId,
        action_type: actionType,
        description,
        target_entity: options?.targetEntity || null,
        target_id: options?.targetId || null,
        metadata: (options?.metadata || {}) as Record<string, string | number | boolean | null>,
      }]);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error logging activity:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchLogs();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('admin-activity-logs-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_activity_logs' },
        () => fetchLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    totalCount,
    refetch: fetchLogs,
    logActivity,
  };
};
