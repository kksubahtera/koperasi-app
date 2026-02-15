import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export interface JournalTemplateAuditLog {
  id: string;
  template_id: string | null;
  action: 'create' | 'update' | 'toggle' | 'reset' | 'auto_map';
  changed_by: string | null;
  old_data: any;
  new_data: any;
  change_summary: string | null;
  created_at: string;
  // Joined data
  changed_by_name?: string;
  template_name?: string;
}

export const useJournalTemplateAudit = (templateId?: string) => {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['journal-template-audit', templateId, page],
    queryFn: async () => {
      let query = supabase
        .from('journal_template_audit_logs')
        .select(`
          *,
          journal_templates:template_id(name)
        `)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (templateId) {
        query = query.eq('template_id', templateId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user names for changed_by
      const userIds = [...new Set(data?.filter(d => d.changed_by).map(d => d.changed_by) || [])];
      let userMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);
        
        if (profiles) {
          userMap = profiles.reduce((acc, p) => ({ ...acc, [p.user_id]: p.name }), {});
        }
      }

      return (data || []).map(log => ({
        ...log,
        changed_by_name: log.changed_by ? userMap[log.changed_by] || 'Unknown' : null,
        template_name: (log.journal_templates as any)?.name || null,
      })) as JournalTemplateAuditLog[];
    },
  });

  const getActionLabel = useCallback((action: string): string => {
    const labels: Record<string, string> = {
      create: 'Dibuat',
      update: 'Diperbarui',
      toggle: 'Status Diubah',
      reset: 'Reset ke Default',
      auto_map: 'Auto-Mapping',
    };
    return labels[action] || action;
  }, []);

  const getActionColor = useCallback((action: string): string => {
    const colors: Record<string, string> = {
      create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      toggle: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      reset: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
      auto_map: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    };
    return colors[action] || 'bg-gray-100 text-gray-700';
  }, []);

  return {
    logs: data || [],
    loading: isLoading,
    error,
    refetch,
    page,
    setPage,
    pageSize,
    getActionLabel,
    getActionColor,
  };
};
