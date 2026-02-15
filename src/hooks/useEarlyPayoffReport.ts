import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EarlyPayoffRecord {
  id: string;
  loanId: string;
  userId: string;
  memberName: string;
  memberNumber: string;
  payoffDate: string;
  principalAmount: number;
  remainingPrincipal: number;
  currentInterest: number;
  currentPenalty: number;
  overdueInterest: number;       // Bunga dari periode sebelumnya
  overduePenalty: number;        // Denda dari periode sebelumnya
  totalInterestPaid: number;     // Total bunga yang dibayar
  totalPenaltyPaid: number;      // Total denda yang dibayar
  earlyPayoffFee: number;
  totalPaid: number;
  interestSaved: number;
  originalTenor: number;
  paidInstallments: number;
  remainingInstallments: number;
  overdueInstallmentsCount: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
  approvedBy?: string;
}

export interface EarlyPayoffSummary {
  totalEarlyPayoffs: number;
  totalPrincipalRecovered: number;
  totalInterestCollected: number;
  totalPenaltyCollected: number;
  totalInterestSaved: number;
  totalFeesCollected: number;
  averageSavingsPerPayoff: number;
}

export const useEarlyPayoffReport = (year?: number) => {
  const [records, setRecords] = useState<EarlyPayoffRecord[]>([]);
  const [summary, setSummary] = useState<EarlyPayoffSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEarlyPayoffRecords = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch transactions that are early payoffs (has early_payoff metadata in notes)
      let query = supabase
        .from('transactions')
        .select(`
          id,
          user_id,
          amount,
          date,
          status,
          notes,
          approved_at,
          approved_by,
          installment_id
        `)
        .like('notes', '%pelunasan_dini%')
        .order('date', { ascending: false });

      if (year) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        query = query.gte('date', startDate).lte('date', endDate);
      }

      const { data: transactions, error: txError } = await query;

      if (txError) throw txError;

      if (!transactions || transactions.length === 0) {
        setRecords([]);
        setSummary({
          totalEarlyPayoffs: 0,
          totalPrincipalRecovered: 0,
          totalInterestCollected: 0,
          totalPenaltyCollected: 0,
          totalInterestSaved: 0,
          totalFeesCollected: 0,
          averageSavingsPerPayoff: 0,
        });
        setIsLoading(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(transactions.map(t => t.user_id))];

      // Fetch profiles for members
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', userIds);

      if (profileError) throw profileError;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Fetch related loans
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select('id, user_id, principal_amount, tenor, interest_rate, status')
        .in('user_id', userIds);

      if (loansError) throw loansError;

      const loanMap = new Map(loans?.map(l => [l.user_id, l]) || []);

      // Parse records from transactions
      const parsedRecords: EarlyPayoffRecord[] = transactions.map(tx => {
        const profile = profileMap.get(tx.user_id);
        const loan = loanMap.get(tx.user_id);
        
        // Parse metadata from notes
        let metadata: any = {};
        try {
          const notesMatch = tx.notes?.match(/\{.*\}/);
          if (notesMatch) {
            metadata = JSON.parse(notesMatch[0]);
          }
        } catch (e) {
          console.error('Failed to parse early payoff metadata:', e);
        }

        return {
          id: tx.id,
          loanId: metadata.loanId || loan?.id || '',
          userId: tx.user_id,
          memberName: profile?.name || 'Unknown',
          memberNumber: profile?.member_number || '-',
          payoffDate: tx.date || '',
          principalAmount: loan?.principal_amount || metadata.principalAmount || 0,
          remainingPrincipal: metadata.remainingPrincipal || 0,
          currentInterest: metadata.currentInterest || 0,
          currentPenalty: metadata.currentPenalty || 0,
          overdueInterest: metadata.overdueInterest || 0,
          overduePenalty: metadata.overduePenalty || 0,
          totalInterestPaid: metadata.totalInterestPaid || (metadata.currentInterest || 0) + (metadata.overdueInterest || 0),
          totalPenaltyPaid: metadata.totalPenaltyPaid || (metadata.currentPenalty || 0) + (metadata.overduePenalty || 0),
          earlyPayoffFee: metadata.earlyPayoffFee || 0,
          totalPaid: tx.amount || 0,
          interestSaved: metadata.interestSaved || 0,
          originalTenor: loan?.tenor || metadata.originalTenor || 0,
          paidInstallments: metadata.paidInstallments || 0,
          remainingInstallments: metadata.remainingInstallments || 0,
          overdueInstallmentsCount: metadata.overdueInstallmentsCount || 0,
          status: tx.status as 'pending' | 'approved' | 'rejected',
          approvedAt: tx.approved_at || undefined,
          approvedBy: tx.approved_by || undefined,
        };
      });

      setRecords(parsedRecords);

      // Calculate summary
      const approvedRecords = parsedRecords.filter(r => r.status === 'approved');
      const totalEarlyPayoffs = approvedRecords.length;
      const totalPrincipalRecovered = approvedRecords.reduce((sum, r) => sum + r.remainingPrincipal, 0);
      const totalInterestCollected = approvedRecords.reduce((sum, r) => sum + r.totalInterestPaid, 0);
      const totalPenaltyCollected = approvedRecords.reduce((sum, r) => sum + r.totalPenaltyPaid, 0);
      const totalInterestSaved = approvedRecords.reduce((sum, r) => sum + r.interestSaved, 0);
      const totalFeesCollected = approvedRecords.reduce((sum, r) => sum + r.earlyPayoffFee, 0);
      const averageSavingsPerPayoff = totalEarlyPayoffs > 0 ? totalInterestSaved / totalEarlyPayoffs : 0;

      setSummary({
        totalEarlyPayoffs,
        totalPrincipalRecovered,
        totalInterestCollected,
        totalPenaltyCollected,
        totalInterestSaved,
        totalFeesCollected,
        averageSavingsPerPayoff,
      });

    } catch (err) {
      console.error('Error fetching early payoff records:', err);
      setError('Gagal memuat data pelunasan dini');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEarlyPayoffRecords();
  }, [year]);

  return {
    records,
    summary,
    isLoading,
    error,
    refetch: fetchEarlyPayoffRecords,
  };
};
