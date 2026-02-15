import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInMonths } from 'date-fns';

export type OverdueHandlingStatus = 'pending' | 'contacted' | 'in_progress' | 'resolved' | 'escalated';

interface OverdueHandling {
  id: string;
  loanId: string;
  status: OverdueHandlingStatus;
  notes: string | null;
  contactedAt: string | null;
  updatedAt: string;
}

interface OverdueMember {
  userId: string;
  memberName: string;
  memberNumber: string;
  loanId: string;
  principalAmount: number;
  overdueInstallments: number;
  overdueAmount: number;
  oldestDueDate: string;
  overdueMonths: number;
  category: '1-3_months' | '3-6_months' | '6+_months';
  handling?: OverdueHandling;
}

interface OverdueStatistics {
  total: number;
  category1to3: number;
  category3to6: number;
  category6plus: number;
  totalOverdueAmount: number;
  members: OverdueMember[];
}

export const useOverdueStatistics = () => {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<OverdueStatistics>({
    total: 0,
    category1to3: 0,
    category3to6: 0,
    category6plus: 0,
    totalOverdueAmount: 0,
    members: []
  });

  const fetchStatistics = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all overdue installments with loan and profile data
      const { data: installments, error: installmentsError } = await supabase
        .from('loan_installments')
        .select(`
          id,
          loan_id,
          installment_number,
          due_date,
          total_amount,
          paid_amount,
          status,
          loans!inner (
            id,
            user_id,
            principal_amount,
            status
          )
        `)
        .in('status', ['overdue', 'pending', 'partial'])
        .lt('due_date', new Date().toISOString().split('T')[0])
        .eq('loans.status', 'active');

      if (installmentsError) throw installmentsError;

      // Get unique user IDs and loan IDs
      const userIds = [...new Set(installments?.map(i => (i.loans as any).user_id) || [])];
      const loanIds = [...new Set(installments?.map(i => i.loan_id) || [])];

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Fetch handling status for these loans
      const { data: handlingData, error: handlingError } = await supabase
        .from('overdue_handling')
        .select('*')
        .in('loan_id', loanIds);

      if (handlingError) throw handlingError;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const handlingMap = new Map(handlingData?.map(h => [h.loan_id, {
        id: h.id,
        loanId: h.loan_id,
        status: h.status as OverdueHandlingStatus,
        notes: h.notes,
        contactedAt: h.contacted_at,
        updatedAt: h.updated_at
      }]) || []);

      // Group installments by loan
      const loanMap = new Map<string, {
        userId: string;
        principalAmount: number;
        installments: typeof installments;
      }>();

      installments?.forEach(inst => {
        const loan = inst.loans as any;
        if (!loanMap.has(loan.id)) {
          loanMap.set(loan.id, {
            userId: loan.user_id,
            principalAmount: loan.principal_amount,
            installments: []
          });
        }
        loanMap.get(loan.id)!.installments.push(inst);
      });

      const members: OverdueMember[] = [];
      const today = new Date();

      loanMap.forEach((loanData, loanId) => {
        const profile = profileMap.get(loanData.userId);
        if (!profile) return;

        const overdueInstallments = loanData.installments.filter(i => {
          const dueDate = new Date(i.due_date);
          return dueDate < today;
        });

        if (overdueInstallments.length === 0) return;

        const oldestDueDate = overdueInstallments.reduce((oldest, curr) => {
          return new Date(curr.due_date) < new Date(oldest.due_date) ? curr : oldest;
        });

        const overdueMonths = differenceInMonths(today, new Date(oldestDueDate.due_date));
        
        if (overdueMonths < 1) return; // Skip if less than 1 month overdue

        const overdueAmount = overdueInstallments.reduce((sum, inst) => {
          const remaining = inst.total_amount - (inst.paid_amount || 0);
          return sum + remaining;
        }, 0);

        let category: OverdueMember['category'];
        if (overdueMonths >= 6) {
          category = '6+_months';
        } else if (overdueMonths >= 3) {
          category = '3-6_months';
        } else {
          category = '1-3_months';
        }

        members.push({
          userId: loanData.userId,
          memberName: profile.name,
          memberNumber: profile.member_number || '-',
          loanId,
          principalAmount: loanData.principalAmount,
          overdueInstallments: overdueInstallments.length,
          overdueAmount,
          oldestDueDate: oldestDueDate.due_date,
          overdueMonths,
          category,
          handling: handlingMap.get(loanId)
        });
      });

      // Sort by overdue months descending
      members.sort((a, b) => b.overdueMonths - a.overdueMonths);

      const category1to3 = members.filter(m => m.category === '1-3_months').length;
      const category3to6 = members.filter(m => m.category === '3-6_months').length;
      const category6plus = members.filter(m => m.category === '6+_months').length;
      const totalOverdueAmount = members.reduce((sum, m) => sum + m.overdueAmount, 0);

      setStatistics({
        total: members.length,
        category1to3,
        category3to6,
        category6plus,
        totalOverdueAmount,
        members
      });
    } catch (error) {
      console.error('Error fetching overdue statistics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateHandlingStatus = useCallback(async (
    loanId: string, 
    userId: string,
    status: OverdueHandlingStatus, 
    notes?: string
  ) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const currentUserId = session?.session?.user?.id;

      const updateData: any = {
        loan_id: loanId,
        user_id: userId,
        status,
        notes: notes || null,
        last_updated_by: currentUserId,
        updated_at: new Date().toISOString()
      };

      if (status === 'contacted' || status === 'in_progress') {
        updateData.contacted_at = new Date().toISOString();
        updateData.contacted_by = currentUserId;
      }

      const { error } = await supabase
        .from('overdue_handling')
        .upsert(updateData, { onConflict: 'loan_id' });

      if (error) throw error;

      // Refresh data
      await fetchStatistics();
      return true;
    } catch (error) {
      console.error('Error updating handling status:', error);
      return false;
    }
  }, [fetchStatistics]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  const membersByCategory = useMemo(() => ({
    '1-3_months': statistics.members.filter(m => m.category === '1-3_months'),
    '3-6_months': statistics.members.filter(m => m.category === '3-6_months'),
    '6+_months': statistics.members.filter(m => m.category === '6+_months')
  }), [statistics.members]);

  return {
    loading,
    statistics,
    membersByCategory,
    refetch: fetchStatistics,
    updateHandlingStatus
  };
};
