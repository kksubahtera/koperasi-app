import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MemberBalanceDiscrepancy {
  userId: string;
  memberName: string;
  memberNumber: string | null;
  type: 'simpanan_pokok' | 'simpanan_wajib' | 'simpanan_sukarela';
  calculatedBalance: number;
  actualBalance: number;
  difference: number;
  transactionCount: number;
  correctionCount: number;
  totalCorrections: number;
}

export interface ReconciliationSummary {
  totalMembers: number;
  membersWithDiscrepancies: number;
  totalDiscrepancyAmount: number;
  discrepancyRate: number;
  byType: {
    simpanan_pokok: { count: number; totalDiff: number };
    simpanan_wajib: { count: number; totalDiff: number };
    simpanan_sukarela: { count: number; totalDiff: number };
  };
}

export const useBalanceReconciliation = () => {
  const [loading, setLoading] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<MemberBalanceDiscrepancy[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);

  const calculateBalanceFromTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all approved transactions
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('user_id, type, amount, status')
        .eq('status', 'approved');

      if (txError) throw txError;

      // Fetch all applied corrections
      const { data: corrections, error: corrError } = await supabase
        .from('corrections')
        .select('user_id, correction_type, amount, operation, status')
        .eq('status', 'applied');

      if (corrError) throw corrError;

      // Fetch actual savings summary
      const { data: savingsSummary, error: savError } = await supabase
        .from('savings_summary')
        .select('user_id, simpanan_pokok, simpanan_wajib, simpanan_sukarela');

      if (savError) throw savError;

      // Fetch profiles for member info
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('user_id, name, member_number, is_active, approval_status');

      if (profError) throw profError;

      // Calculate balances from transactions
      const calculatedBalances: Record<string, {
        simpanan_pokok: number;
        simpanan_wajib: number;
        simpanan_sukarela: number;
        txCounts: { pokok: number; wajib: number; sukarela: number };
      }> = {};

      // Initialize with all users from savings summary
      savingsSummary?.forEach(s => {
        if (!calculatedBalances[s.user_id]) {
          calculatedBalances[s.user_id] = {
            simpanan_pokok: 0,
            simpanan_wajib: 0,
            simpanan_sukarela: 0,
            txCounts: { pokok: 0, wajib: 0, sukarela: 0 },
          };
        }
      });

      // Sum up transactions
      transactions?.forEach(tx => {
        if (!calculatedBalances[tx.user_id]) {
          calculatedBalances[tx.user_id] = {
            simpanan_pokok: 0,
            simpanan_wajib: 0,
            simpanan_sukarela: 0,
            txCounts: { pokok: 0, wajib: 0, sukarela: 0 },
          };
        }

        const bal = calculatedBalances[tx.user_id];
        const amount = tx.amount || 0;

        switch (tx.type) {
          case 'simpanan_pokok':
            bal.simpanan_pokok += amount;
            bal.txCounts.pokok++;
            break;
          case 'simpanan_wajib':
          case 'setor_simpanan_wajib':
            bal.simpanan_wajib += amount;
            bal.txCounts.wajib++;
            break;
          case 'simpanan_sukarela':
          case 'setor_simpanan_sukarela':
            bal.simpanan_sukarela += amount;
            bal.txCounts.sukarela++;
            break;
          case 'penarikan_simpanan_sukarela':
            bal.simpanan_sukarela -= amount;
            bal.txCounts.sukarela++;
            break;
        }
      });

      // Calculate corrections by user
      const correctionsByUser: Record<string, {
        simpanan_pokok: { count: number; total: number };
        simpanan_wajib: { count: number; total: number };
        simpanan_sukarela: { count: number; total: number };
      }> = {};

      corrections?.forEach(corr => {
        if (!correctionsByUser[corr.user_id]) {
          correctionsByUser[corr.user_id] = {
            simpanan_pokok: { count: 0, total: 0 },
            simpanan_wajib: { count: 0, total: 0 },
            simpanan_sukarela: { count: 0, total: 0 },
          };
        }

        const userCorr = correctionsByUser[corr.user_id];
        const amount = corr.amount || 0;
        const type = corr.correction_type as 'simpanan_pokok' | 'simpanan_wajib' | 'simpanan_sukarela';
        
        if (userCorr[type]) {
          userCorr[type].count++;
          if (corr.operation === 'add') {
            userCorr[type].total += amount;
          } else {
            userCorr[type].total -= amount;
          }
        }
      });

      // Apply corrections to calculated balances
      Object.entries(correctionsByUser).forEach(([userId, userCorr]) => {
        if (calculatedBalances[userId]) {
          calculatedBalances[userId].simpanan_pokok += userCorr.simpanan_pokok.total;
          calculatedBalances[userId].simpanan_wajib += userCorr.simpanan_wajib.total;
          calculatedBalances[userId].simpanan_sukarela += userCorr.simpanan_sukarela.total;
        }
      });

      // Compare with actual balances and find discrepancies
      const foundDiscrepancies: MemberBalanceDiscrepancy[] = [];
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      savingsSummary?.forEach(actual => {
        const calculated = calculatedBalances[actual.user_id];
        const profile = profileMap.get(actual.user_id);
        const userCorr = correctionsByUser[actual.user_id] || {
          simpanan_pokok: { count: 0, total: 0 },
          simpanan_wajib: { count: 0, total: 0 },
          simpanan_sukarela: { count: 0, total: 0 },
        };

        if (!calculated) return;

        const types: Array<'simpanan_pokok' | 'simpanan_wajib' | 'simpanan_sukarela'> = [
          'simpanan_pokok',
          'simpanan_wajib',
          'simpanan_sukarela'
        ];

        types.forEach(type => {
          const actualVal = actual[type] || 0;
          const calcVal = calculated[type] || 0;
          const diff = actualVal - calcVal;

          // Only report if there's a meaningful discrepancy (> 1 to avoid floating point issues)
          if (Math.abs(diff) > 1) {
            foundDiscrepancies.push({
              userId: actual.user_id,
              memberName: profile?.name || 'Unknown',
              memberNumber: profile?.member_number || null,
              type,
              calculatedBalance: calcVal,
              actualBalance: actualVal,
              difference: diff,
              transactionCount: type === 'simpanan_pokok' 
                ? calculated.txCounts.pokok 
                : type === 'simpanan_wajib' 
                  ? calculated.txCounts.wajib 
                  : calculated.txCounts.sukarela,
              correctionCount: userCorr[type].count,
              totalCorrections: userCorr[type].total,
            });
          }
        });
      });

      // Sort by absolute difference (largest first)
      foundDiscrepancies.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

      // Calculate summary
      const uniqueUsersWithDiscrepancies = new Set(foundDiscrepancies.map(d => d.userId));
      const totalDiscrepancyAmount = foundDiscrepancies.reduce(
        (sum, d) => sum + Math.abs(d.difference), 
        0
      );

      const byType = {
        simpanan_pokok: { count: 0, totalDiff: 0 },
        simpanan_wajib: { count: 0, totalDiff: 0 },
        simpanan_sukarela: { count: 0, totalDiff: 0 },
      };

      foundDiscrepancies.forEach(d => {
        byType[d.type].count++;
        byType[d.type].totalDiff += Math.abs(d.difference);
      });

      const totalMembers = savingsSummary?.length || 0;
      const discrepancyRate = totalMembers > 0 
        ? (uniqueUsersWithDiscrepancies.size / totalMembers) * 100 
        : 0;

      setSummary({
        totalMembers,
        membersWithDiscrepancies: uniqueUsersWithDiscrepancies.size,
        totalDiscrepancyAmount,
        discrepancyRate,
        byType,
      });

      setDiscrepancies(foundDiscrepancies);

      return { discrepancies: foundDiscrepancies, summary };
    } catch (error) {
      console.error('Error calculating balance reconciliation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const fixDiscrepancy = useCallback(async (
    discrepancy: MemberBalanceDiscrepancy,
    mode: 'adjust_savings' | 'create_correction'
  ): Promise<boolean> => {
    try {
      if (mode === 'adjust_savings') {
        // Directly update savings_summary to match calculated
        const updateField = discrepancy.type;
        const newValue = discrepancy.calculatedBalance;

        const { error } = await supabase
          .from('savings_summary')
          .update({ 
            [updateField]: newValue,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', discrepancy.userId);

        if (error) throw error;
      } else {
        // Create a correction record to account for the discrepancy
        const operation = discrepancy.difference > 0 ? 'subtract' : 'add';
        const amount = Math.abs(discrepancy.difference);

        const { error } = await supabase
          .from('corrections')
          .insert({
            user_id: discrepancy.userId,
            correction_type: discrepancy.type,
            amount,
            operation,
            current_balance: discrepancy.actualBalance,
            new_balance: discrepancy.calculatedBalance,
            reason: `Koreksi otomatis untuk menyesuaikan selisih rekonsiliasi (${discrepancy.difference > 0 ? 'kelebihan' : 'kekurangan'} Rp ${amount.toLocaleString('id-ID')})`,
            status: 'applied',
            correction_mode: 'balance_adjustment',
          });

        if (error) throw error;

        // Update the actual savings to match calculated
        const { error: updateError } = await supabase
          .from('savings_summary')
          .update({
            [discrepancy.type]: discrepancy.calculatedBalance,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', discrepancy.userId);

        if (updateError) throw updateError;
      }

      return true;
    } catch (error) {
      console.error('Error fixing discrepancy:', error);
      return false;
    }
  }, []);

  return {
    loading,
    discrepancies,
    summary,
    calculateBalanceFromTransactions,
    fixDiscrepancy,
  };
};
