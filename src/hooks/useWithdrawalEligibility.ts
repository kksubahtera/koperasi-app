import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';

interface VoluntarySavingsDeposit {
  id: string;
  amount: number;
  date: string;
  monthsHeld: number;
  isEligible: boolean;
}

interface UseWithdrawalEligibilityResult {
  eligibleAmount: number;
  lockedAmount: number;
  deposits: VoluntarySavingsDeposit[];
  minHoldingMonths: number;
  isLoading: boolean;
}

export function useWithdrawalEligibility(userId?: string): UseWithdrawalEligibilityResult {
  const [deposits, setDeposits] = useState<VoluntarySavingsDeposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const settings = getCooperativeSettings();
  const minHoldingMonths = settings.simpananSukarelaMinHoldingMonths || 0;

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const fetchDeposits = async () => {
      try {
        // Get all approved voluntary savings deposits
        const { data: depositData, error: depositError } = await supabase
          .from('transactions')
          .select('id, amount, date, approved_at')
          .eq('user_id', userId)
          .eq('type', 'setor_simpanan_sukarela')
          .eq('status', 'approved')
          .order('date', { ascending: true });

        if (depositError) throw depositError;

        // Get all approved withdrawals to track what's been withdrawn
        const { data: withdrawalData, error: withdrawalError } = await supabase
          .from('transactions')
          .select('id, amount, date')
          .eq('user_id', userId)
          .eq('type', 'penarikan_simpanan_sukarela')
          .eq('status', 'approved')
          .order('date', { ascending: true });

        if (withdrawalError) throw withdrawalError;

        const now = new Date();
        let remainingWithdrawals = (withdrawalData || []).reduce((sum, w) => sum + Number(w.amount), 0);
        
        // Calculate months held and eligibility for each deposit
        const processedDeposits: VoluntarySavingsDeposit[] = [];
        
        for (const deposit of depositData || []) {
          // Use approved_at date for holding period calculation if available
          const depositDate = new Date(deposit.approved_at || deposit.date);
          const monthsDiff = (now.getFullYear() - depositDate.getFullYear()) * 12 + 
            (now.getMonth() - depositDate.getMonth());
          
          // Adjust for day of month
          const adjustedMonths = now.getDate() >= depositDate.getDate() ? monthsDiff : monthsDiff - 1;
          const monthsHeld = Math.max(0, adjustedMonths);
          
          const isEligible = minHoldingMonths === 0 || monthsHeld >= minHoldingMonths;
          
          // Calculate remaining amount after withdrawals (FIFO)
          let amount = Number(deposit.amount);
          if (remainingWithdrawals > 0) {
            const deducted = Math.min(remainingWithdrawals, amount);
            amount -= deducted;
            remainingWithdrawals -= deducted;
          }
          
          if (amount > 0) {
            processedDeposits.push({
              id: deposit.id,
              amount,
              date: deposit.date,
              monthsHeld,
              isEligible,
            });
          }
        }

        setDeposits(processedDeposits);
      } catch (error) {
        console.error('Error fetching withdrawal eligibility:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeposits();
  }, [userId, minHoldingMonths]);

  const { eligibleAmount, lockedAmount } = useMemo(() => {
    let eligible = 0;
    let locked = 0;
    
    for (const deposit of deposits) {
      if (deposit.isEligible) {
        eligible += deposit.amount;
      } else {
        locked += deposit.amount;
      }
    }
    
    return { eligibleAmount: eligible, lockedAmount: locked };
  }, [deposits]);

  return {
    eligibleAmount,
    lockedAmount,
    deposits,
    minHoldingMonths,
    isLoading,
  };
}
