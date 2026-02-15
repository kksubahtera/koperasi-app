import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LoanWithProfile {
  id: string;
  user_id: string;
  principal_amount: number;
  tenor: number;
  interest_rate: number | null;
  disbursement_date: string | null;
  remaining_principal: number | null;
  status: 'pending' | 'active' | 'completed' | 'defaulted' | 'rejected';
  application_date: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  approved_by: string | null;
  profiles: {
    name: string;
    member_number: string | null;
    email: string;
  } | null;
}

export const useAllLoans = () => {
  return useQuery({
    queryKey: ['all-loans'],
    queryFn: async () => {
      // Fetch all loans
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .order('application_date', { ascending: false });

      if (loansError) throw loansError;

      if (!loans || loans.length === 0) {
        return [] as LoanWithProfile[];
      }

      // Fetch profiles separately
      const userIds = [...new Set(loans.map(l => l.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, member_number, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return loans.map(loan => ({
        id: loan.id,
        user_id: loan.user_id,
        principal_amount: loan.principal_amount,
        tenor: loan.tenor,
        interest_rate: loan.interest_rate,
        disbursement_date: loan.disbursement_date,
        remaining_principal: loan.remaining_principal,
        status: loan.status as LoanWithProfile['status'],
        application_date: loan.application_date,
        rejection_reason: loan.rejection_reason,
        approved_at: loan.approved_at,
        approved_by: loan.approved_by,
        profiles: profileMap.get(loan.user_id) || null
      })) as LoanWithProfile[];
    },
  });
};
