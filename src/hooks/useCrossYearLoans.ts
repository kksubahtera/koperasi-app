import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CrossYearLoanData {
  loanId: string;
  userId: string;
  memberName: string;
  memberNumber: string | null;
  principalAmount: number;
  tenor: number;
  interestRate: number;
  disbursementDate: string;
  // Saldo awal tahun
  principalStartOfYear: number;
  installmentsPaidBeforeYear: number;
  // Aktivitas selama tahun
  installmentsPaidDuringYear: number;
  principalPaidDuringYear: number;
  interestPaidDuringYear: number;
  penaltyPaidDuringYear: number;
  // Saldo akhir tahun
  principalEndOfYear: number;
  installmentsRemaining: number;
  status: string;
}

export const useCrossYearLoans = (year: number) => {
  return useQuery({
    queryKey: ['cross-year-loans', year],
    queryFn: async () => {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      const startOfNextYear = `${year + 1}-01-01`;

      // Fetch active/completed loans that existed in this year
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .or(`disbursement_date.lte.${endOfYear},application_date.lte.${endOfYear}`)
        .in('status', ['active', 'completed'])
        .not('disbursement_date', 'is', null);

      if (loansError) throw loansError;
      if (!loans || loans.length === 0) return [];

      // Fetch profiles
      const userIds = [...new Set(loans.map(l => l.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Fetch all installments for these loans
      const loanIds = loans.map(l => l.id);
      const { data: installments } = await supabase
        .from('loan_installments')
        .select('*')
        .in('loan_id', loanIds);

      const installmentsByLoan = new Map<string, typeof installments>();
      installments?.forEach(inst => {
        const existing = installmentsByLoan.get(inst.loan_id) || [];
        existing.push(inst);
        installmentsByLoan.set(inst.loan_id, existing);
      });

      const crossYearData: CrossYearLoanData[] = [];

      for (const loan of loans) {
        const disbursementDate = loan.disbursement_date;
        if (!disbursementDate) continue;

        // Skip loans that started after this year
        if (disbursementDate > endOfYear) continue;

        const profile = profileMap.get(loan.user_id);
        const loanInstallments = installmentsByLoan.get(loan.id) || [];

        // Calculate installments paid before this year
        const paidBeforeYear = loanInstallments.filter(
          inst => inst.paid_date && inst.paid_date < startOfYear && inst.status === 'paid'
        );

        // Calculate installments paid during this year
        const paidDuringYear = loanInstallments.filter(
          inst => inst.paid_date && inst.paid_date >= startOfYear && inst.paid_date <= endOfYear && inst.status === 'paid'
        );

        // Calculate remaining installments (not paid or paid after this year)
        const remainingAfterYear = loanInstallments.filter(
          inst => !inst.paid_date || inst.paid_date > endOfYear || inst.status !== 'paid'
        );

        // Principal calculations
        const totalPrincipal = loan.principal_amount;
        const principalPaidBefore = paidBeforeYear.reduce((sum, inst) => sum + (inst.principal_amount || 0), 0);
        const principalStartOfYear = totalPrincipal - principalPaidBefore;

        const principalPaidDuring = paidDuringYear.reduce((sum, inst) => sum + (inst.principal_amount || 0), 0);
        const interestPaidDuring = paidDuringYear.reduce((sum, inst) => sum + (inst.interest_amount || 0), 0);
        const penaltyPaidDuring = paidDuringYear.reduce((sum, inst) => sum + (inst.penalty_amount || 0), 0);

        const principalEndOfYear = principalStartOfYear - principalPaidDuring;

        // Only include loans that span this year (started before or during, and have remaining balance at start or activity during)
        if (principalStartOfYear > 0 || principalPaidDuring > 0) {
          crossYearData.push({
            loanId: loan.id,
            userId: loan.user_id,
            memberName: profile?.name || 'Unknown',
            memberNumber: profile?.member_number || null,
            principalAmount: totalPrincipal,
            tenor: loan.tenor,
            interestRate: (loan.interest_rate || 0) * 100,
            disbursementDate: disbursementDate,
            principalStartOfYear,
            installmentsPaidBeforeYear: paidBeforeYear.length,
            installmentsPaidDuringYear: paidDuringYear.length,
            principalPaidDuringYear: principalPaidDuring,
            interestPaidDuringYear: interestPaidDuring,
            penaltyPaidDuringYear: penaltyPaidDuring,
            principalEndOfYear: Math.max(0, principalEndOfYear),
            installmentsRemaining: remainingAfterYear.length,
            status: loan.status,
          });
        }
      }

      // Sort by member name
      return crossYearData.sort((a, b) => a.memberName.localeCompare(b.memberName));
    },
  });
};
