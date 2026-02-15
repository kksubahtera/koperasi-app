import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';

export interface InstallmentUnderpayment {
  id: string;
  userId: string;
  memberName: string;
  memberNumber: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  totalDue: number;
  paidAmount: number;
  underpaymentAmount: number;
  status: string;
}

export interface SavingsUnderpayment {
  userId: string;
  memberName: string;
  memberNumber: string;
  joinDate: string;
  monthsJoined: number;
  expectedSimpananWajib: number;
  actualSimpananWajib: number;
  underpaymentAmount: number;
  deficitMonths: number;
}

export interface UnderpaymentSummary {
  totalMembersWithUnderpayment: number;
  totalInstallmentUnderpayment: number;
  totalSavingsUnderpayment: number;
  totalUnderpaymentValue: number;
  membersWithInstallmentUnderpayment: number;
  membersWithSavingsUnderpayment: number;
}

export interface UnderpaymentData {
  installments: InstallmentUnderpayment[];
  savings: SavingsUnderpayment[];
  summary: UnderpaymentSummary;
}

export const useUnderpaymentTracking = () => {
  const [data, setData] = useState<UnderpaymentData>({
    installments: [],
    savings: [],
    summary: {
      totalMembersWithUnderpayment: 0,
      totalInstallmentUnderpayment: 0,
      totalSavingsUnderpayment: 0,
      totalUnderpaymentValue: 0,
      membersWithInstallmentUnderpayment: 0,
      membersWithSavingsUnderpayment: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUnderpaymentData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch cooperative settings for monthly mandatory savings
      const settings = getCooperativeSettings();
      const monthlySaving = settings.simpananWajib || 100000;

      // Fetch partial installments with member and loan details
      const { data: partialInstallments, error: installmentsError } = await supabase
        .from('loan_installments')
        .select(`
          id,
          loan_id,
          installment_number,
          due_date,
          total_amount,
          paid_amount,
          penalty_amount,
          status,
          loans!inner (
            user_id
          )
        `)
        .eq('status', 'partial')
        .order('due_date', { ascending: true });

      if (installmentsError) throw installmentsError;

      // Get unique user IDs from partial installments to fetch profiles
      const userIds = [...new Set((partialInstallments || []).map((inst: any) => inst.loans?.user_id).filter(Boolean))];
      
      // Fetch profiles for these users
      let profilesMap: Record<string, { name: string; member_number: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name, member_number')
          .in('user_id', userIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = { name: p.name || 'Unknown', member_number: p.member_number || '-' };
          return acc;
        }, {} as Record<string, { name: string; member_number: string }>);
      }

      // Transform installment data
      const installmentUnderpayments: InstallmentUnderpayment[] = (partialInstallments || []).map((inst: any) => {
        const totalDue = (inst.total_amount || 0) + (inst.penalty_amount || 0);
        const paidAmount = inst.paid_amount || 0;
        const userId = inst.loans?.user_id || '';
        const profile = profilesMap[userId] || { name: 'Unknown', member_number: '-' };
        
        return {
          id: inst.id,
          userId,
          memberName: profile.name,
          memberNumber: profile.member_number,
          loanId: inst.loan_id,
          installmentNumber: inst.installment_number,
          dueDate: inst.due_date,
          totalDue,
          paidAmount,
          underpaymentAmount: totalDue - paidAmount,
          status: inst.status,
        };
      });

      // Fetch active members with their join date
      const { data: activeMembers, error: membersError } = await supabase
        .from('profiles')
        .select('user_id, name, member_number, join_date')
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .not('join_date', 'is', null);

      if (membersError) throw membersError;

      // Fetch savings summary for these members
      const memberUserIds = (activeMembers || []).map(m => m.user_id);
      let savingsMap: Record<string, number> = {};
      if (memberUserIds.length > 0) {
        const { data: savingsData } = await supabase
          .from('savings_summary')
          .select('user_id, simpanan_wajib')
          .in('user_id', memberUserIds);
        
        savingsMap = (savingsData || []).reduce((acc, s) => {
          acc[s.user_id] = s.simpanan_wajib || 0;
          return acc;
        }, {} as Record<string, number>);
      }

      // Calculate savings underpayments
      const now = new Date();
      const savingsUnderpayments: SavingsUnderpayment[] = [];

      for (const member of activeMembers || []) {
        if (!member.join_date) continue;
        
        const joinDate = new Date(member.join_date);
        const monthsJoined = Math.max(1, 
          (now.getFullYear() - joinDate.getFullYear()) * 12 + 
          (now.getMonth() - joinDate.getMonth()) + 1
        );
        
        const expectedSimpananWajib = monthsJoined * monthlySaving;
        const actualSimpananWajib = savingsMap[member.user_id] || 0;
        
        if (actualSimpananWajib < expectedSimpananWajib) {
          const underpaymentAmount = expectedSimpananWajib - actualSimpananWajib;
          const deficitMonths = Math.ceil(underpaymentAmount / monthlySaving);
          
          savingsUnderpayments.push({
            userId: member.user_id,
            memberName: member.name || 'Unknown',
            memberNumber: member.member_number || '-',
            joinDate: member.join_date,
            monthsJoined,
            expectedSimpananWajib,
            actualSimpananWajib,
            underpaymentAmount,
            deficitMonths,
          });
        }
      }

      // Calculate unique members with underpayments
      const memberIdsWithInstallment = new Set(installmentUnderpayments.map(i => i.userId));
      const memberIdsWithSavings = new Set(savingsUnderpayments.map(s => s.userId));
      const allMemberIds = new Set([...memberIdsWithInstallment, ...memberIdsWithSavings]);

      // Calculate summary
      const totalInstallmentUnderpayment = installmentUnderpayments.reduce(
        (sum, i) => sum + i.underpaymentAmount, 0
      );
      const totalSavingsUnderpayment = savingsUnderpayments.reduce(
        (sum, s) => sum + s.underpaymentAmount, 0
      );

      setData({
        installments: installmentUnderpayments,
        savings: savingsUnderpayments,
        summary: {
          totalMembersWithUnderpayment: allMemberIds.size,
          totalInstallmentUnderpayment,
          totalSavingsUnderpayment,
          totalUnderpaymentValue: totalInstallmentUnderpayment + totalSavingsUnderpayment,
          membersWithInstallmentUnderpayment: memberIdsWithInstallment.size,
          membersWithSavingsUnderpayment: memberIdsWithSavings.size,
        },
      });
    } catch (err: any) {
      console.error('Error fetching underpayment data:', err);
      setError(err.message || 'Gagal memuat data kekurangan bayar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnderpaymentData();
  }, [fetchUnderpaymentData]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('underpayment-tracking')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loan_installments' },
        () => {
          console.log('[Realtime] loan_installments updated');
          fetchUnderpaymentData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_summary' },
        () => {
          console.log('[Realtime] savings_summary updated');
          fetchUnderpaymentData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUnderpaymentData]);

  return {
    ...data,
    loading,
    error,
    refetch: fetchUnderpaymentData,
  };
};
