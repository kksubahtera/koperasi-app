import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  created_at: string;
  profile?: {
    name: string;
    email: string;
    member_number: string | null;
  };
}

export interface AuditLogFilters {
  actionType?: string;
  entityType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export const ACTION_TYPES = [
  { value: 'create', label: 'Buat' },
  { value: 'update', label: 'Perbarui' },
  { value: 'delete', label: 'Hapus' },
  { value: 'approve', label: 'Setujui' },
  { value: 'reject', label: 'Tolak' },
  { value: 'export', label: 'Ekspor' },
  { value: 'import', label: 'Impor' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'settings', label: 'Pengaturan' },
];

export const ENTITY_TYPES = [
  { value: 'member', label: 'Anggota' },
  { value: 'loan', label: 'Pinjaman' },
  { value: 'transaction', label: 'Transaksi' },
  { value: 'savings', label: 'Simpanan' },
  { value: 'journal', label: 'Jurnal' },
  { value: 'settings', label: 'Pengaturan' },
  { value: 'shu', label: 'SHU' },
  { value: 'resignation', label: 'Pengunduran Diri' },
  { value: 'backup', label: 'Backup' },
];

export const useAuditLogs = (filters?: AuditLogFilters) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters?.actionType) {
        query = query.eq('action_type', filters.actionType);
      }
      if (filters?.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data: logsData, error, count } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        return;
      }

      // Fetch profiles for user info
      const userIds = [...new Set(logsData?.map(log => log.user_id) || [])];
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name, email, member_number')
          .in('user_id', userIds);

        const profileMap = new Map(
          profilesData?.map(p => [p.user_id, { 
            name: p.name, 
            email: p.email, 
            member_number: p.member_number 
          }])
        );

        const logsWithProfiles = logsData?.map(log => ({
          ...log,
          profile: profileMap.get(log.user_id)
        })) || [];

        setLogs(logsWithProfiles as AuditLog[]);
      } else {
        setLogs((logsData || []) as AuditLog[]);
      }

      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [filters?.actionType, filters?.entityType, filters?.userId, filters?.startDate, filters?.endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, totalCount, refetch: fetchLogs };
};

export const useCreateAuditLog = () => {
  const { user } = useAuth();

  const createLog = async (
    actionType: string,
    entityType: string,
    description: string,
    options?: {
      entityId?: string;
      oldData?: Record<string, any>;
      newData?: Record<string, any>;
      metadata?: Record<string, any>;
    }
  ) => {
    if (!user) return false;

    try {
      const { error } = await supabase.from('audit_logs').insert({
        user_id: user.id,
        action_type: actionType,
        entity_type: entityType,
        description,
        entity_id: options?.entityId || null,
        old_data: options?.oldData || null,
        new_data: options?.newData || null,
        metadata: options?.metadata || {},
        user_agent: navigator.userAgent,
      });

      if (error) {
        console.error('Error creating audit log:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  return { createLog };
};
