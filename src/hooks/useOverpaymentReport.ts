import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OverpaymentRecord {
  id: string;
  userId: string;
  memberName: string;
  memberNumber: string;
  transactionId: string | null;
  overpaymentAmount: number;
  refundAmount: number;
  distributedAmount: number;
  distribution: Array<{ installmentNumber: number; amount: number }>;
  notificationType: string;
  createdAt: string;
}

interface UseOverpaymentReportOptions {
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
  filterType?: 'all' | 'refund' | 'distributed';
}

export const useOverpaymentReport = (options: UseOverpaymentReportOptions = {}) => {
  const { startDate, endDate, searchQuery, filterType = 'all' } = options;

  const { data: records = [], isLoading, refetch } = useQuery({
    queryKey: ['overpayment-report', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('member_notifications')
        .select('*')
        .in('notification_type', ['loan_overpayment', 'loan_overpayment_refund'])
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data: notifications, error } = await query;

      if (error) throw error;
      if (!notifications || notifications.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(notifications.map(n => n.user_id))];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Map notifications to records
      const mappedRecords: OverpaymentRecord[] = notifications.map(n => {
        const metadata = n.metadata as Record<string, unknown> || {};
        const profile = profileMap.get(n.user_id);
        
        const distribution = Array.isArray(metadata.distribution) 
          ? metadata.distribution as Array<{ installmentNumber: number; amount: number }>
          : [];
        
        const distributedAmount = distribution.reduce((sum, d) => sum + (d.amount || 0), 0);
        const overpaymentAmount = typeof metadata.overpayment_amount === 'number' 
          ? metadata.overpayment_amount 
          : (typeof metadata.refund_amount === 'number' ? metadata.refund_amount : 0);
        const refundAmount = typeof metadata.refund_amount === 'number' ? metadata.refund_amount : 0;

        return {
          id: n.id,
          userId: n.user_id,
          memberName: profile?.name || 'Unknown',
          memberNumber: profile?.member_number || '-',
          transactionId: typeof metadata.transaction_id === 'string' ? metadata.transaction_id : null,
          overpaymentAmount,
          refundAmount,
          distributedAmount,
          distribution,
          notificationType: n.notification_type,
          createdAt: n.created_at,
        };
      });

      return mappedRecords;
    },
  });

  // Apply client-side filters
  const filteredRecords = useMemo(() => {
    let result = records;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.memberName.toLowerCase().includes(query) ||
        r.memberNumber.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filterType === 'refund') {
      result = result.filter(r => r.refundAmount > 0);
    } else if (filterType === 'distributed') {
      result = result.filter(r => r.distributedAmount > 0 && r.refundAmount === 0);
    }

    return result;
  }, [records, searchQuery, filterType]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalOverpayment = filteredRecords.reduce((sum, r) => sum + r.overpaymentAmount, 0);
    const totalRefund = filteredRecords.reduce((sum, r) => sum + r.refundAmount, 0);
    const totalDistributed = filteredRecords.reduce((sum, r) => sum + r.distributedAmount, 0);
    const totalRecords = filteredRecords.length;

    return {
      totalOverpayment,
      totalRefund,
      totalDistributed,
      totalRecords,
    };
  }, [filteredRecords]);

  return {
    records: filteredRecords,
    statistics,
    isLoading,
    refetch,
  };
};
