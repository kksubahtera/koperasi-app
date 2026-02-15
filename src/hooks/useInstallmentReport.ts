import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InstallmentReportItem {
  id: string;
  loanId: string;
  userId: string;
  memberName: string;
  memberNumber: string;
  installmentNumber: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  paidAmount: number;
  paidDate: string | null;
  status: string;
  adjustedInterestAmount: number | null;
  adjustedPenaltyAmount: number | null;
  adjustmentReason: string | null;
  loanPrincipal: number;
  loanTenor: number;
  loanDisbursementDate: string | null;
}

export interface InstallmentSummary {
  totalInstallments: number;
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  totalPenalty: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  partialCount: number;
}

export const useInstallmentReport = (
  year: number,
  month?: number,
  statusFilter?: string
) => {
  const [data, setData] = useState<InstallmentReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build date filter
      let startDate: string;
      let endDate: string;
      
      if (month) {
        startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      } else {
        startDate = `${year}-01-01`;
        endDate = `${year + 1}-01-01`;
      }

      // Fetch installments with loan and profile info
      let query = supabase
        .from('loan_installments')
        .select(`
          id,
          loan_id,
          installment_number,
          due_date,
          principal_amount,
          interest_amount,
          penalty_amount,
          total_amount,
          paid_amount,
          paid_date,
          status,
          adjusted_interest_amount,
          adjusted_penalty_amount,
          adjustment_reason,
          loans!inner (
            id,
            user_id,
            principal_amount,
            tenor,
            disbursement_date,
            status
          )
        `)
        .gte('due_date', startDate)
        .lt('due_date', endDate)
        .order('due_date', { ascending: true });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'paid' | 'pending' | 'overdue' | 'partial' | 'unpaid');
      }

      const { data: installments, error: instError } = await query;

      if (instError) throw instError;

      if (!installments || installments.length === 0) {
        setData([]);
        setIsLoading(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(installments.map((i: any) => i.loans?.user_id).filter(Boolean))];

      // Fetch profiles
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', userIds);

      if (profError) throw profError;

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, { name: p.name, number: p.member_number }])
      );

      // Map data
      const mappedData: InstallmentReportItem[] = installments.map((inst: any) => {
        const loan = inst.loans;
        const profile = profileMap.get(loan?.user_id) || { name: 'Unknown', number: '-' };

        return {
          id: inst.id,
          loanId: inst.loan_id,
          userId: loan?.user_id || '',
          memberName: profile.name || 'Unknown',
          memberNumber: profile.number || '-',
          installmentNumber: inst.installment_number,
          dueDate: inst.due_date,
          principalAmount: inst.principal_amount,
          interestAmount: inst.interest_amount,
          penaltyAmount: inst.penalty_amount || 0,
          totalAmount: inst.total_amount,
          paidAmount: inst.paid_amount || 0,
          paidDate: inst.paid_date,
          status: inst.status || 'pending',
          adjustedInterestAmount: inst.adjusted_interest_amount,
          adjustedPenaltyAmount: inst.adjusted_penalty_amount,
          adjustmentReason: inst.adjustment_reason,
          loanPrincipal: loan?.principal_amount || 0,
          loanTenor: loan?.tenor || 0,
          loanDisbursementDate: loan?.disbursement_date,
        };
      });

      setData(mappedData);
    } catch (err) {
      console.error('Error fetching installment report:', err);
      setError('Gagal mengambil data angsuran');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [year, month, statusFilter]);

  const summary = useMemo<InstallmentSummary>(() => {
    const result: InstallmentSummary = {
      totalInstallments: data.length,
      totalAmount: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      totalPenalty: 0,
      paidCount: 0,
      pendingCount: 0,
      overdueCount: 0,
      partialCount: 0,
    };

    data.forEach(item => {
      const effectiveInterest = item.adjustedInterestAmount ?? item.interestAmount;
      const effectivePenalty = item.adjustedPenaltyAmount ?? item.penaltyAmount;
      const effectiveTotal = item.principalAmount + effectiveInterest + effectivePenalty;

      result.totalAmount += effectiveTotal;
      result.totalPaid += item.paidAmount;
      result.totalPenalty += effectivePenalty;

      if (item.status === 'paid') {
        result.paidCount++;
      } else if (item.status === 'overdue') {
        result.overdueCount++;
        result.totalOutstanding += effectiveTotal - item.paidAmount;
      } else if (item.status === 'partial') {
        result.partialCount++;
        result.totalOutstanding += effectiveTotal - item.paidAmount;
      } else {
        result.pendingCount++;
        result.totalOutstanding += effectiveTotal - item.paidAmount;
      }
    });

    return result;
  }, [data]);

  return {
    data,
    summary,
    isLoading,
    error,
    refetch: fetchData,
  };
};
