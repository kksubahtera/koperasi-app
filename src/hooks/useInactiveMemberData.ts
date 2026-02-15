import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SavingsSummary, Loan, LoanInstallment } from '@/lib/types';

interface InactiveMemberData {
  savingsMap: Record<string, SavingsSummary>;
  loansMap: Record<string, Loan[]>;
  installmentsMap: Record<string, LoanInstallment[]>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const defaultSavings: SavingsSummary = {
  simpananPokok: 0,
  simpananWajib: 0,
  simpananSukarela: 0,
  totalSimpanan: 0,
};

export const useInactiveMemberData = (userIds: string[]): InactiveMemberData => {
  const [savingsMap, setSavingsMap] = useState<Record<string, SavingsSummary>>({});
  const [loansMap, setLoansMap] = useState<Record<string, Loan[]>>({});
  const [installmentsMap, setInstallmentsMap] = useState<Record<string, LoanInstallment[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!userIds.length) {
      setSavingsMap({});
      setLoansMap({});
      setInstallmentsMap({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch savings for all users
      const { data: savingsData, error: savingsError } = await supabase
        .from('savings_summary')
        .select('*')
        .in('user_id', userIds);

      if (savingsError) {
        console.error('Error fetching savings:', savingsError);
      }

      // Map savings data
      const newSavingsMap: Record<string, SavingsSummary> = {};
      savingsData?.forEach(row => {
        newSavingsMap[row.user_id] = {
          simpananPokok: Number(row.simpanan_pokok) || 0,
          simpananWajib: Number(row.simpanan_wajib) || 0,
          simpananSukarela: Number(row.simpanan_sukarela) || 0,
          totalSimpanan: Number(row.total_simpanan) || 0,
        };
      });
      setSavingsMap(newSavingsMap);

      // Fetch loans for all users
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .in('user_id', userIds);

      if (loansError) {
        console.error('Error fetching loans:', loansError);
      }

      // Map loans data
      const newLoansMap: Record<string, Loan[]> = {};
      const loanIds: string[] = [];
      
      loansData?.forEach(loan => {
        loanIds.push(loan.id);
        // Map DB status to UI status: 'approved' in DB means 'active' in UI
        const dbStatus = loan.status as string;
        let uiStatus: 'active' | 'pending' | 'rejected' | 'completed' | 'defaulted' = 'pending';
        if (dbStatus === 'approved') {
          uiStatus = 'active';
        } else if (dbStatus === 'pending' || dbStatus === 'rejected' || dbStatus === 'completed' || dbStatus === 'defaulted') {
          uiStatus = dbStatus as any;
        }

        const mappedLoan: Loan = {
          id: loan.id,
          userId: loan.user_id,
          principalAmount: Number(loan.principal_amount),
          tenor: loan.tenor,
          interestRate: Number(loan.interest_rate) * 100,
          status: uiStatus,
          applicationDate: loan.application_date || '',
          disbursementDate: loan.disbursement_date || undefined,
          remainingPrincipal: Number(loan.remaining_principal) || 0,
        };

        if (!newLoansMap[loan.user_id]) {
          newLoansMap[loan.user_id] = [];
        }
        newLoansMap[loan.user_id].push(mappedLoan);
      });
      setLoansMap(newLoansMap);

      // Fetch installments for all loans
      if (loanIds.length > 0) {
        const { data: installmentsData, error: installmentsError } = await supabase
          .from('loan_installments')
          .select('*')
          .in('loan_id', loanIds);

        if (installmentsError) {
          console.error('Error fetching installments:', installmentsError);
        }

        // Map installments by loan_id, then group by user
        const loanToUserMap: Record<string, string> = {};
        loansData?.forEach(loan => {
          loanToUserMap[loan.id] = loan.user_id;
        });

        const newInstallmentsMap: Record<string, LoanInstallment[]> = {};
        installmentsData?.forEach(inst => {
          const userId = loanToUserMap[inst.loan_id];
          if (userId) {
            const mappedInstallment: LoanInstallment = {
              id: inst.id,
              loanId: inst.loan_id,
              installmentNumber: inst.installment_number,
              dueDate: inst.due_date,
              principalAmount: Number(inst.principal_amount),
              interestAmount: Number(inst.interest_amount),
              totalAmount: Number(inst.total_amount),
              paidAmount: Number(inst.paid_amount) || 0,
              paidDate: inst.paid_date || undefined,
              status: inst.status as any,
              penaltyAmount: Number(inst.penalty_amount) || 0,
              penaltyMonths: inst.penalty_months || 0,
            };

            if (!newInstallmentsMap[userId]) {
              newInstallmentsMap[userId] = [];
            }
            newInstallmentsMap[userId].push(mappedInstallment);
          }
        });
        setInstallmentsMap(newInstallmentsMap);
      } else {
        setInstallmentsMap({});
      }
    } catch (err) {
      console.error('Error in useInactiveMemberData:', err);
      setError('Failed to fetch member data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userIds.join(',')]);

  return {
    savingsMap,
    loansMap,
    installmentsMap,
    isLoading,
    error,
    refetch: fetchData,
  };
};

// Helper to get savings for a specific user
export const getMemberSavingsFromMap = (
  userId: string,
  savingsMap: Record<string, SavingsSummary>
): SavingsSummary => {
  return savingsMap[userId] || defaultSavings;
};

// Helper to get active loan for a specific user
export const getMemberActiveLoanFromMap = (
  userId: string,
  loansMap: Record<string, Loan[]>
): Loan | null => {
  const userLoans = loansMap[userId] || [];
  return userLoans.find(l => l.status === 'active') || null;
};

// Helper to calculate refund breakdown
export const calculateRefundBreakdown = (
  userId: string,
  savingsMap: Record<string, SavingsSummary>,
  loansMap: Record<string, Loan[]>,
  installmentsMap: Record<string, LoanInstallment[]>
) => {
  const savings = getMemberSavingsFromMap(userId, savingsMap);
  const activeLoan = getMemberActiveLoanFromMap(userId, loansMap);
  const userInstallments = installmentsMap[userId] || [];

  // Calculate arrears
  const overdueInstallments = userInstallments.filter(i => i.status === 'overdue');
  const totalPenalties = overdueInstallments.reduce((sum, i) => sum + (i.penaltyAmount || 0), 0);
  const remainingPrincipal = activeLoan?.remainingPrincipal || 0;
  const totalArrears = remainingPrincipal + totalPenalties;

  // Calculate net amount
  const netAmount = savings.totalSimpanan - totalArrears;
  const hasShortfall = netAmount < 0;
  const refundAmount = hasShortfall ? 0 : netAmount;
  const shortfallAmount = hasShortfall ? Math.abs(netAmount) : 0;

  return {
    savings,
    totalArrears,
    remainingPrincipal,
    totalPenalties,
    refundAmount,
    shortfallAmount,
    hasShortfall,
    hasLoan: !!activeLoan,
    loan: activeLoan,
  };
};
