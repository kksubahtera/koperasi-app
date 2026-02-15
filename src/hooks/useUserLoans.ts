import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loan, LoanInstallment } from '@/lib/types';
import { applyPenaltyToInstallment } from '@/lib/penaltyCalculation';

interface LoansData {
  loans: Loan[];
  rawInstallments: LoanInstallment[];
}

const fetchLoansData = async (userId: string): Promise<LoansData> => {
  // Fetch loans for current user (including pending)
  const { data: loansData, error: loansError } = await supabase
    .from('loans')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'active', 'completed', 'defaulted', 'rejected'])
    .order('created_at', { ascending: false });

  if (loansError) {
    console.error('Error fetching loans:', loansError);
    throw loansError;
  }

  // Map database loans to Loan type
  const mappedLoans: Loan[] = (loansData || []).map(loan => ({
    id: loan.id,
    userId: loan.user_id,
    principalAmount: Number(loan.principal_amount),
    tenor: loan.tenor,
    interestRate: Number(loan.interest_rate) * 100, // Convert from decimal to percentage
    disbursementDate: loan.disbursement_date || loan.application_date || '',
    remainingPrincipal: Number(loan.remaining_principal) || Number(loan.principal_amount),
    status: loan.status as 'pending' | 'active' | 'completed' | 'defaulted' | 'rejected',
    applicationDate: loan.application_date || undefined,
    rejectionReason: loan.rejection_reason || undefined,
  }));

  // Fetch installments for all user loans
  let rawInstallments: LoanInstallment[] = [];
  if (mappedLoans.length > 0) {
    const loanIds = mappedLoans.map(l => l.id);
    
    const { data: installmentsData, error: installmentsError } = await supabase
      .from('loan_installments')
      .select('*')
      .in('loan_id', loanIds)
      .order('installment_number', { ascending: true });

    if (installmentsError) {
      console.error('Error fetching installments:', installmentsError);
      throw installmentsError;
    }

    rawInstallments = (installmentsData || []).map(inst => {
      // Use adjusted values if available
      const effectiveInterest = inst.adjusted_interest_amount !== null 
        ? Number(inst.adjusted_interest_amount) 
        : Number(inst.interest_amount);
      const effectivePenalty = inst.adjusted_penalty_amount !== null
        ? Number(inst.adjusted_penalty_amount)
        : Number(inst.penalty_amount) || 0;
      const effectiveTotal = Number(inst.principal_amount) + effectiveInterest + effectivePenalty;
      
      return {
        id: inst.id,
        loanId: inst.loan_id,
        installmentNumber: inst.installment_number,
        dueDate: inst.due_date,
        principalAmount: Number(inst.principal_amount),
        interestAmount: effectiveInterest,
        totalAmount: effectiveTotal,
        paidAmount: Number(inst.paid_amount) || 0,
        paidDate: inst.paid_date || undefined,
        status: inst.status as 'pending' | 'paid' | 'overdue' | 'partial' | 'unpaid',
        penaltyAmount: effectivePenalty,
        penaltyMonths: inst.penalty_months || 0,
        adjustedInterestAmount: inst.adjusted_interest_amount,
        adjustedPenaltyAmount: inst.adjusted_penalty_amount,
        adjustmentReason: inst.adjustment_reason,
      };
    });
  }

  return { loans: mappedLoans, rawInstallments };
};

export const useUserLoans = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['user-loans', user?.id],
    queryFn: () => fetchLoansData(user!.id),
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const loans = data?.loans || [];
  const rawInstallments = data?.rawInstallments || [];

  // Real-time subscription for loans and installments updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`loans-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loans',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Realtime] Loan updated:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['user-loans', user.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loan_installments',
        },
        (payload) => {
          console.log('[Realtime] Installment updated:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['user-loans', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Calculate real-time penalties for installments
  const installments = useMemo(() => {
    const today = new Date();
    
    return rawInstallments.map(installment => {
      // Find the loan for this installment to get remaining principal
      const loan = loans.find(l => l.id === installment.loanId);
      const loanPrincipalAmount = loan?.remainingPrincipal || 0;
      
      // Only calculate penalty for unpaid/partial installments
      if (installment.status === 'paid') {
        return installment;
      }
      
      // Apply real-time penalty calculation
      return applyPenaltyToInstallment(installment, loanPrincipalAmount, today);
    });
  }, [rawInstallments, loans]);

  return {
    loans,
    installments,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
};
