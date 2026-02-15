import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCriticalSettings } from './useSettingsChangeLogs';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export interface SavingsInterestRecord {
  month: string;
  year: number;
  monthDate: Date;
  openingBalance: number;
  depositsBeforeCutoff: number;
  depositsAfterCutoff: number;
  withdrawals: number;
  closingBalance: number;
  eligibleBalance: number;
  interestRate: number;
  interestEarned: number;
  status: 'paid' | 'pending';
  hasCorrections: boolean; // Indicates if this month has corrections applied
  correctionNote?: string; // Note about corrections
  transactions: {
    date: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    beforeCutoff: boolean;
    isCorrected?: boolean; // Indicates if this transaction was corrected
  }[];
}

interface UseSavingsInterestReturn {
  interestHistory: SavingsInterestRecord[];
  totalInterestEarned: number;
  pendingInterest: number;
  currentMonthEligibleBalance: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useSavingsInterest = (): UseSavingsInterestReturn => {
  const { user } = useAuth();
  const { settings: criticalSettings, loading: settingsLoading } = useCriticalSettings();
  const [interestHistory, setInterestHistory] = useState<SavingsInterestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get cutoff date from settings or default to 15
  const cutoffDate = useMemo(() => {
    const localSettings = JSON.parse(localStorage.getItem('cooperativeSettings') || '{}');
    return localSettings.simpananSukarelaInterestCutoffDate || 15;
  }, []);

  // Get interest calculation method from settings
  const interestMethod = useMemo((): 'opening_plus_eligible' | 'closing_if_eligible' => {
    const localSettings = JSON.parse(localStorage.getItem('cooperativeSettings') || '{}');
    return localSettings.simpananSukarelaInterestMethod || 'opening_plus_eligible';
  }, []);

  const fetchInterestHistory = async () => {
    if (!user?.id || settingsLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const interestRate = criticalSettings?.simpananSukarelaInterestRate ?? 0.4;
      
      // Fetch all voluntary savings transactions for the past 12 months
      const twelveMonthsAgo = subMonths(new Date(), 12);
      
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .in('type', ['simpanan_sukarela', 'setor_simpanan_sukarela', 'penarikan_simpanan_sukarela'])
        .gte('date', format(twelveMonthsAgo, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (txError) throw txError;

      // Fetch corrections for voluntary savings (transaction-based corrections)
      const { data: corrections, error: corError } = await supabase
        .from('corrections')
        .select(`
          *,
          transactions:transaction_id (
            date,
            type,
            amount
          )
        `)
        .eq('user_id', user.id)
        .eq('correction_type', 'simpanan_sukarela')
        .eq('status', 'applied')
        .gte('created_at', format(twelveMonthsAgo, 'yyyy-MM-dd'));

      if (corError) throw corError;

      // Create a map of corrected transaction IDs and their correction amounts
      // Key: transaction_id, Value: { totalCorrection, originalAmount }
      const correctionsByTxId = new Map<string, { totalCorrection: number; originalAmount: number }>();
      const correctionsByMonth = new Map<string, number>(); // For nominal-based corrections
      
      // First, build a map of original transaction amounts for validation
      const txAmountsById = new Map<string, number>();
      (transactions || []).forEach((tx: any) => {
        txAmountsById.set(tx.id, Number(tx.amount));
      });
      
      (corrections || []).forEach((cor: any) => {
        const correctionAmount = cor.operation === 'subtract' ? -cor.amount : cor.amount;
        
        if (cor.correction_mode === 'transaction_based' && cor.transaction_id) {
          // Transaction-based: accumulate by transaction ID with validation
          const existing = correctionsByTxId.get(cor.transaction_id) || { totalCorrection: 0, originalAmount: 0 };
          const originalAmount = txAmountsById.get(cor.transaction_id) || cor.transactions?.amount || 0;
          
          // Calculate new total, but cap it to not exceed original amount for subtractions
          let newTotal = existing.totalCorrection + correctionAmount;
          if (newTotal < -originalAmount) {
            // Cap the total correction to not exceed the original transaction amount
            newTotal = -originalAmount;
          }
          
          correctionsByTxId.set(cor.transaction_id, { 
            totalCorrection: newTotal, 
            originalAmount 
          });
        } else if (cor.correction_mode === 'nominal') {
          // Nominal-based: apply to the month the correction was created
          const monthKey = format(new Date(cor.created_at), 'yyyy-MM');
          const existing = correctionsByMonth.get(monthKey) || 0;
          correctionsByMonth.set(monthKey, existing + correctionAmount);
        }
      });

      // Fetch current savings balance
      const { data: savingsData, error: savingsError } = await supabase
        .from('savings_summary')
        .select('simpanan_sukarela')
        .eq('user_id', user.id)
        .maybeSingle();

      if (savingsError) throw savingsError;

      const currentBalance = Number(savingsData?.simpanan_sukarela) || 0;

      // Calculate interest for each of the past 6 months
      const history: SavingsInterestRecord[] = [];
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      // Group transactions by month
      const monthlyData: Map<string, {
        deposits: number;
        depositsBeforeCutoff: number;
        depositsAfterCutoff: number;
        withdrawals: number;
        correctionAdjustment: number; // Track correction adjustments
        hasCorrections: boolean; // Track if any corrections applied
        transactions: SavingsInterestRecord['transactions'];
      }> = new Map();

      // Process transactions and group by month
      (transactions || []).forEach(tx => {
        const txDate = new Date(tx.date);
        const monthKey = format(txDate, 'yyyy-MM');
        const dayOfMonth = txDate.getDate();
        const isBeforeCutoff = dayOfMonth <= cutoffDate;
        const isWithdrawal = tx.type === 'penarikan_simpanan_sukarela';
        let amount = Number(tx.amount);
        let isCorrected = false;

        // Check if this transaction has been corrected
        const correctionData = correctionsByTxId.get(tx.id);
        if (correctionData && correctionData.totalCorrection !== 0) {
          // For transaction-based corrections, adjust the effective amount
          // If correction is negative (subtract), reduce the deposit amount
          // Ensure the result is not negative
          amount = Math.max(0, amount + correctionData.totalCorrection);
          isCorrected = true;
        }

        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, {
            deposits: 0,
            depositsBeforeCutoff: 0,
            depositsAfterCutoff: 0,
            withdrawals: 0,
            correctionAdjustment: 0,
            hasCorrections: false,
            transactions: [],
          });
        }

        const data = monthlyData.get(monthKey)!;
        
        if (isWithdrawal) {
          data.withdrawals += amount;
        } else {
          data.deposits += amount;
          if (isBeforeCutoff) {
            data.depositsBeforeCutoff += amount;
          } else {
            data.depositsAfterCutoff += amount;
          }
        }

        // Mark month as having corrections if any transaction is corrected
        if (isCorrected) {
          data.hasCorrections = true;
        }

        data.transactions.push({
          date: tx.date,
          type: isWithdrawal ? 'withdrawal' : 'deposit',
          amount, // This is now the corrected amount
          beforeCutoff: isBeforeCutoff,
          isCorrected,
        });
      });

      // Apply nominal-based corrections to monthly data
      correctionsByMonth.forEach((adjustment, monthKey) => {
        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, {
            deposits: 0,
            depositsBeforeCutoff: 0,
            depositsAfterCutoff: 0,
            withdrawals: 0,
            correctionAdjustment: adjustment,
            hasCorrections: true,
            transactions: [],
          });
        } else {
          const data = monthlyData.get(monthKey)!;
          data.correctionAdjustment = adjustment;
          data.hasCorrections = true;
        }
      });

      // Calculate running balance forward from first transaction
      // Build chronological list of months with transactions
      const sortedMonthKeys = Array.from(monthlyData.keys()).sort();
      
      // Create a map of cumulative balances per month
      const monthlyBalances: Map<string, { openingBalance: number; closingBalance: number }> = new Map();
      let runningBalance = 0;

      sortedMonthKeys.forEach(monthKey => {
        const data = monthlyData.get(monthKey)!;
        const openingBalance = runningBalance;
        runningBalance = runningBalance + data.deposits - data.withdrawals;
        monthlyBalances.set(monthKey, {
          openingBalance,
          closingBalance: runningBalance,
        });
      });

      // Generate history for past 6 months (only months with data or after first transaction)
      const firstTxMonth = sortedMonthKeys.length > 0 ? sortedMonthKeys[0] : null;

      for (let i = 0; i < 6; i++) {
        let monthNum = currentMonth - i;
        let year = currentYear;

        if (monthNum < 0) {
          monthNum += 12;
          year -= 1;
        }

        const monthDate = new Date(year, monthNum, 1);
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthName = format(monthDate, 'MMMM', { locale: localeId });

        // Skip months before first transaction
        if (firstTxMonth && monthKey < firstTxMonth) {
          continue;
        }

        const monthData = monthlyData.get(monthKey);
        const balanceData = monthlyBalances.get(monthKey);

        // If no transactions in this month, calculate balance from previous months
        let openingBalance = 0;
        let closingBalance = 0;

        if (balanceData) {
          openingBalance = balanceData.openingBalance;
          closingBalance = balanceData.closingBalance;
        } else if (firstTxMonth && monthKey > firstTxMonth) {
          // Find the most recent month with balance data before this month
          const previousMonths = sortedMonthKeys.filter(k => k < monthKey);
          if (previousMonths.length > 0) {
            const lastMonthWithData = previousMonths[previousMonths.length - 1];
            const lastBalance = monthlyBalances.get(lastMonthWithData);
            if (lastBalance) {
              openingBalance = lastBalance.closingBalance;
              closingBalance = lastBalance.closingBalance;
            }
          }
        }

        // Ensure balances are never negative
        openingBalance = Math.max(0, openingBalance);
        closingBalance = Math.max(0, closingBalance);
        
        // For current month, use actual current balance from database
        if (i === 0) {
          closingBalance = currentBalance;
        }

        const deposits = monthData?.deposits || 0;
        const depositsBeforeCutoff = monthData?.depositsBeforeCutoff || 0;
        const depositsAfterCutoff = monthData?.depositsAfterCutoff || 0;
        const withdrawals = monthData?.withdrawals || 0;
        const txList = monthData?.transactions || [];

        // Calculate eligible balance based on method
        let eligibleBalance: number;
        if (i === 0) {
          // For current month: use actual database balance as the source of truth
          eligibleBalance = Math.max(0, currentBalance);
        } else if (interestMethod === 'closing_if_eligible') {
          // Option B: Closing balance, but only if there are deposits before cutoff
          eligibleBalance = depositsBeforeCutoff > 0 ? Math.max(0, closingBalance) : 0;
        } else {
          // Option A (default): Opening balance + deposits before cutoff
          eligibleBalance = Math.max(0, openingBalance + depositsBeforeCutoff);
        }

        // Calculate interest
        const interest = eligibleBalance * (interestRate / 100);
        
        // Current month is pending, past months are paid
        const isPending = i === 0;

        // Check if this month has corrections
        const hasCorrections = monthData?.hasCorrections || false;

        history.push({
          month: monthName,
          year,
          monthDate,
          openingBalance: Math.round(openingBalance),
          depositsBeforeCutoff: Math.round(depositsBeforeCutoff),
          depositsAfterCutoff: Math.round(depositsAfterCutoff),
          withdrawals: Math.round(withdrawals),
          closingBalance: Math.round(closingBalance),
          eligibleBalance: Math.round(eligibleBalance),
          interestRate,
          interestEarned: Math.round(interest),
          status: isPending ? 'pending' : 'paid',
          hasCorrections,
          correctionNote: hasCorrections ? 'Saldo sudah disesuaikan dengan koreksi' : undefined,
          transactions: txList,
        });
      }

      setInterestHistory(history);
    } catch (err) {
      console.error('Error fetching savings interest:', err);
      setError('Gagal memuat riwayat bunga');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!settingsLoading) {
      fetchInterestHistory();
    }
  }, [user?.id, settingsLoading, criticalSettings?.simpananSukarelaInterestRate]);

  const totalInterestEarned = useMemo(() => {
    return interestHistory
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + r.interestEarned, 0);
  }, [interestHistory]);

  const pendingInterest = useMemo(() => {
    return interestHistory
      .filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + r.interestEarned, 0);
  }, [interestHistory]);

  const currentMonthEligibleBalance = useMemo(() => {
    return interestHistory.find(r => r.status === 'pending')?.eligibleBalance || 0;
  }, [interestHistory]);

  return {
    interestHistory,
    totalInterestEarned,
    pendingInterest,
    currentMonthEligibleBalance,
    isLoading: isLoading || settingsLoading,
    error,
    refetch: fetchInterestHistory,
  };
};
