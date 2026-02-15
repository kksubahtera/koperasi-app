import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCriticalSettings } from './useSettingsChangeLogs';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';

export interface MemberInterestCalculation {
  userId: string;
  memberName: string;
  memberNumber: string;
  openingBalance: number;
  closingBalance: number;
  depositsBeforeCutoff: number;
  eligibleBalance: number;
  interestRate: number;
  interestAmount: number;
  calculationMethod: 'opening_plus_eligible' | 'closing_if_eligible';
}

export interface MonthlyClosingResult {
  month: string;
  year: number;
  totalInterestExpense: number;
  memberCalculations: MemberInterestCalculation[];
  closedAt: string;
}

interface UseMonthlyClosingReturn {
  isProcessing: boolean;
  lastClosingResult: MonthlyClosingResult | null;
  processMonthlyClosing: (targetMonth?: Date) => Promise<MonthlyClosingResult | null>;
  checkClosingStatus: (targetMonth?: Date) => Promise<boolean>;
}

export const useMonthlyClosing = (): UseMonthlyClosingReturn => {
  const { settings: criticalSettings } = useCriticalSettings();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastClosingResult, setLastClosingResult] = useState<MonthlyClosingResult | null>(null);

  // Get cutoff date from settings or default to 15
  const getCutoffDate = () => {
    const localSettings = JSON.parse(localStorage.getItem('cooperativeSettings') || '{}');
    return localSettings.simpananSukarelaInterestCutoffDate || 15;
  };

  // Get interest calculation method from settings
  const getInterestMethod = (): 'opening_plus_eligible' | 'closing_if_eligible' => {
    const localSettings = JSON.parse(localStorage.getItem('cooperativeSettings') || '{}');
    return localSettings.simpananSukarelaInterestMethod || 'opening_plus_eligible';
  };

  // Check if a month has already been closed
  const checkClosingStatus = async (targetMonth?: Date): Promise<boolean> => {
    const closingMonth = targetMonth || subMonths(new Date(), 1);
    const monthKey = format(closingMonth, 'yyyy-MM');
    
    const { data: existingEntry } = await supabase
      .from('expense_entries')
      .select('id')
      .eq('type', 'bunga_simpanan_sukarela')
      .ilike('description', `%${monthKey}%`)
      .maybeSingle();
    
    return !!existingEntry;
  };

  const processMonthlyClosing = async (targetMonth?: Date): Promise<MonthlyClosingResult | null> => {
    setIsProcessing(true);
    
    try {
      const closingMonth = targetMonth || subMonths(new Date(), 1);
      const monthStart = startOfMonth(closingMonth);
      const monthEnd = endOfMonth(closingMonth);
      const monthKey = format(closingMonth, 'yyyy-MM');
      const monthName = format(closingMonth, 'MMMM yyyy', { locale: localeId });
      const year = closingMonth.getFullYear();
      const cutoffDate = getCutoffDate();
      const interestMethod = getInterestMethod();
      
      // Check if already closed
      const alreadyClosed = await checkClosingStatus(closingMonth);
      if (alreadyClosed) {
        toast.error(`Tutup buku untuk ${monthName} sudah dilakukan sebelumnya`);
        return null;
      }

      // Get interest rate from settings
      const interestRate = criticalSettings?.simpananSukarelaInterestRate ?? 0.4;

      // Get all active members with their savings
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          name,
          member_number,
          is_active,
          approval_status
        `)
        .eq('is_active', true)
        .eq('approval_status', 'approved');

      if (membersError) throw membersError;

      // Get all savings summaries
      const { data: savingsSummaries, error: savingsError } = await supabase
        .from('savings_summary')
        .select('user_id, simpanan_sukarela');

      if (savingsError) throw savingsError;

      // Create a map of user_id to current savings
      const savingsMap = new Map(
        savingsSummaries?.map(s => [s.user_id, Number(s.simpanan_sukarela) || 0]) || []
      );

      // Get all voluntary savings transactions for the target month
      const { data: allTransactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'approved')
        .in('type', ['simpanan_sukarela', 'setor_simpanan_sukarela', 'penarikan_simpanan_sukarela'])
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));

      if (txError) throw txError;

      // Also get transactions AFTER the target month to calculate opening balance
      const { data: futureTransactions, error: futureTxError } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'approved')
        .in('type', ['simpanan_sukarela', 'setor_simpanan_sukarela', 'penarikan_simpanan_sukarela'])
        .gt('date', format(monthEnd, 'yyyy-MM-dd'));

      if (futureTxError) throw futureTxError;

      // Calculate net movement after target month to derive opening balance
      const futureMovementByUser = new Map<string, number>();
      (futureTransactions || []).forEach(tx => {
        const userId = tx.user_id;
        const current = futureMovementByUser.get(userId) || 0;
        const amount = Number(tx.amount);
        
        if (tx.type === 'penarikan_simpanan_sukarela') {
          futureMovementByUser.set(userId, current + amount); // Withdrawal reduces future, so add back
        } else {
          futureMovementByUser.set(userId, current - amount); // Deposit increases future, so subtract
        }
      });

      // Group target month transactions by user
      const txByUser = new Map<string, typeof allTransactions>();
      (allTransactions || []).forEach(tx => {
        const existing = txByUser.get(tx.user_id) || [];
        existing.push(tx);
        txByUser.set(tx.user_id, existing);
      });

      const memberCalculations: MemberInterestCalculation[] = [];
      let totalInterestExpense = 0;

      // Calculate interest for each member
      for (const member of (members || [])) {
        const currentBalance = savingsMap.get(member.user_id) || 0;
        const userTx = txByUser.get(member.user_id) || [];
        const futureMovement = futureMovementByUser.get(member.user_id) || 0;

        // Calculate closing balance for target month (current balance adjusted for future movements)
        const closingBalance = currentBalance + futureMovement;

        // Calculate deposits and withdrawals in target month
        let monthDeposits = 0;
        let monthWithdrawals = 0;
        let depositsBeforeCutoff = 0;

        userTx.forEach(tx => {
          const txDate = new Date(tx.date);
          const dayOfMonth = txDate.getDate();
          const amount = Number(tx.amount);

          if (tx.type === 'penarikan_simpanan_sukarela') {
            monthWithdrawals += amount;
          } else {
            monthDeposits += amount;
            if (dayOfMonth <= cutoffDate) {
              depositsBeforeCutoff += amount;
            }
          }
        });

        // Opening balance = Closing balance - deposits + withdrawals
        const openingBalance = closingBalance - monthDeposits + monthWithdrawals;

        // Calculate eligible balance based on method
        let eligibleBalance: number;
        if (interestMethod === 'closing_if_eligible') {
          // Option B: Closing balance, but only if there are deposits before cutoff
          eligibleBalance = depositsBeforeCutoff > 0 ? Math.max(0, closingBalance) : 0;
        } else {
          // Option A (default): Opening balance + deposits before cutoff
          eligibleBalance = Math.max(0, openingBalance + depositsBeforeCutoff);
        }

        // Calculate interest
        const interestAmount = Math.round(eligibleBalance * (interestRate / 100));

        // Only include members with positive interest
        if (interestAmount > 0) {
          memberCalculations.push({
            userId: member.user_id,
            memberName: member.name,
            memberNumber: member.member_number || '',
            openingBalance: Math.round(openingBalance),
            closingBalance: Math.round(closingBalance),
            depositsBeforeCutoff: Math.round(depositsBeforeCutoff),
            eligibleBalance: Math.round(eligibleBalance),
            interestRate,
            interestAmount,
            calculationMethod: interestMethod,
          });

          totalInterestExpense += interestAmount;
        }
      }

      // Record total interest as expense entry
      if (totalInterestExpense > 0) {
        const { error: expenseError } = await supabase
          .from('expense_entries')
          .insert({
            description: `Beban Bunga Simpanan Sukarela - ${monthName} [${monthKey}]`,
            amount: totalInterestExpense,
            type: 'bunga_simpanan_sukarela',
            date: format(monthEnd, 'yyyy-MM-dd'),
            year: year,
          });

        if (expenseError) throw expenseError;

        // Create individual notifications for each member
        const interestNotifications = memberCalculations.map(mc => ({
          user_id: mc.userId,
          period: monthKey,
          period_name: monthName,
          eligible_balance: mc.eligibleBalance,
          interest_rate: mc.interestRate,
          interest_amount: mc.interestAmount,
          is_read: false,
        }));

        if (interestNotifications.length > 0) {
          const { error: notifError } = await supabase
            .from('interest_notifications')
            .insert(interestNotifications);

          if (notifError) {
            console.error('Error creating interest notifications:', notifError);
            // Don't throw, just log - notifications are not critical
          }
        }
      }

      const result: MonthlyClosingResult = {
        month: monthName,
        year,
        totalInterestExpense,
        memberCalculations,
        closedAt: new Date().toISOString(),
      };

      setLastClosingResult(result);
      toast.success(`Tutup buku ${monthName} berhasil! Total beban bunga: Rp ${totalInterestExpense.toLocaleString('id-ID')}`);
      
      return result;
    } catch (error) {
      console.error('Monthly closing error:', error);
      toast.error('Gagal melakukan tutup buku bulanan');
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    lastClosingResult,
    processMonthlyClosing,
    checkClosingStatus,
  };
};
