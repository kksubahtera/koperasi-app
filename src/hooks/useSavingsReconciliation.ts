import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SavingsDiscrepancy {
  userId: string;
  memberName: string;
  memberNumber: string;
  type: 'simpanan_pokok' | 'simpanan_wajib' | 'simpanan_sukarela';
  calculatedAmount: number;
  actualAmount: number;
  difference: number;
  transactionCount: number;
  correctionCount: number;
}

export interface ReconciliationSummary {
  totalMembers: number;
  membersWithDiscrepancy: number;
  totalDiscrepancyAmount: number;
  reconciliationRate: number;
}

// Transaction types that affect each savings type
const SAVINGS_TYPE_TRANSACTIONS: Record<string, string[]> = {
  simpanan_pokok: ['simpanan_pokok', 'saldo_awal_pokok'],
  simpanan_wajib: ['simpanan_wajib', 'setor_simpanan_wajib', 'saldo_awal_wajib'],
  simpanan_sukarela: ['simpanan_sukarela', 'setor_simpanan_sukarela', 'penarikan_simpanan_sukarela', 'saldo_awal_sukarela'],
};

// Correction types that affect each savings type
const SAVINGS_TYPE_CORRECTIONS: Record<string, string> = {
  simpanan_pokok: 'simpanan_pokok',
  simpanan_wajib: 'simpanan_wajib',
  simpanan_sukarela: 'simpanan_sukarela',
};

export const useSavingsReconciliation = () => {
  const [loading, setLoading] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<SavingsDiscrepancy[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);

  const calculateReconciliation = async () => {
    setLoading(true);
    try {
      // Fetch all approved transactions
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('user_id, type, amount')
        .eq('status', 'approved');

      if (txError) throw txError;

      // Fetch all applied corrections
      const { data: corrections, error: corrError } = await supabase
        .from('corrections')
        .select('user_id, correction_type, operation, amount')
        .eq('status', 'applied');

      if (corrError) throw corrError;

      // Fetch current savings summary
      const { data: savingsSummary, error: savingsError } = await supabase
        .from('savings_summary')
        .select('user_id, simpanan_pokok, simpanan_wajib, simpanan_sukarela');

      if (savingsError) throw savingsError;

      // Fetch member profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .eq('is_active', true);

      if (profileError) throw profileError;

      // Calculate expected balances from transactions
      const calculatedBalances: Record<string, { pokok: number; wajib: number; sukarela: number; txCount: Record<string, number> }> = {};

      // Initialize all users
      savingsSummary?.forEach(s => {
        calculatedBalances[s.user_id] = { pokok: 0, wajib: 0, sukarela: 0, txCount: { pokok: 0, wajib: 0, sukarela: 0 } };
      });

      // Sum transactions
      transactions?.forEach(tx => {
        if (!calculatedBalances[tx.user_id]) {
          calculatedBalances[tx.user_id] = { pokok: 0, wajib: 0, sukarela: 0, txCount: { pokok: 0, wajib: 0, sukarela: 0 } };
        }

        if (SAVINGS_TYPE_TRANSACTIONS.simpanan_pokok.includes(tx.type)) {
          calculatedBalances[tx.user_id].pokok += Number(tx.amount);
          calculatedBalances[tx.user_id].txCount.pokok++;
        } else if (SAVINGS_TYPE_TRANSACTIONS.simpanan_wajib.includes(tx.type)) {
          calculatedBalances[tx.user_id].wajib += Number(tx.amount);
          calculatedBalances[tx.user_id].txCount.wajib++;
        } else if (SAVINGS_TYPE_TRANSACTIONS.simpanan_sukarela.includes(tx.type)) {
          if (tx.type === 'penarikan_simpanan_sukarela') {
            calculatedBalances[tx.user_id].sukarela -= Number(tx.amount);
          } else {
            calculatedBalances[tx.user_id].sukarela += Number(tx.amount);
          }
          calculatedBalances[tx.user_id].txCount.sukarela++;
        }
      });

      // Track correction counts
      const correctionCounts: Record<string, Record<string, number>> = {};

      // Apply corrections
      corrections?.forEach(corr => {
        if (!calculatedBalances[corr.user_id]) {
          calculatedBalances[corr.user_id] = { pokok: 0, wajib: 0, sukarela: 0, txCount: { pokok: 0, wajib: 0, sukarela: 0 } };
        }
        if (!correctionCounts[corr.user_id]) {
          correctionCounts[corr.user_id] = { pokok: 0, wajib: 0, sukarela: 0 };
        }

        const amount = Number(corr.amount);
        const multiplier = corr.operation === 'add' ? 1 : -1;

        if (corr.correction_type === 'simpanan_pokok') {
          calculatedBalances[corr.user_id].pokok += amount * multiplier;
          correctionCounts[corr.user_id].pokok++;
        } else if (corr.correction_type === 'simpanan_wajib') {
          calculatedBalances[corr.user_id].wajib += amount * multiplier;
          correctionCounts[corr.user_id].wajib++;
        } else if (corr.correction_type === 'simpanan_sukarela') {
          calculatedBalances[corr.user_id].sukarela += amount * multiplier;
          correctionCounts[corr.user_id].sukarela++;
        }
      });

      // Compare with actual and find discrepancies
      const foundDiscrepancies: SavingsDiscrepancy[] = [];
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));

      savingsSummary?.forEach(savings => {
        const calc = calculatedBalances[savings.user_id] || { pokok: 0, wajib: 0, sukarela: 0, txCount: { pokok: 0, wajib: 0, sukarela: 0 } };
        const corrCount = correctionCounts[savings.user_id] || { pokok: 0, wajib: 0, sukarela: 0 };
        const profile = profileMap.get(savings.user_id);

        const types: Array<'simpanan_pokok' | 'simpanan_wajib' | 'simpanan_sukarela'> = ['simpanan_pokok', 'simpanan_wajib', 'simpanan_sukarela'];
        
        types.forEach(type => {
          let calculated = 0;
          let actual = 0;
          let txCount = 0;
          let cCount = 0;

          if (type === 'simpanan_pokok') {
            calculated = calc.pokok;
            actual = Number(savings.simpanan_pokok) || 0;
            txCount = calc.txCount.pokok;
            cCount = corrCount.pokok;
          } else if (type === 'simpanan_wajib') {
            calculated = calc.wajib;
            actual = Number(savings.simpanan_wajib) || 0;
            txCount = calc.txCount.wajib;
            cCount = corrCount.wajib;
          } else {
            calculated = calc.sukarela;
            actual = Number(savings.simpanan_sukarela) || 0;
            txCount = calc.txCount.sukarela;
            cCount = corrCount.sukarela;
          }

          const difference = Math.abs(calculated - actual);
          if (difference > 0.01) { // Allow small floating point differences
            foundDiscrepancies.push({
              userId: savings.user_id,
              memberName: profile?.name || 'Unknown',
              memberNumber: profile?.member_number || '-',
              type,
              calculatedAmount: calculated,
              actualAmount: actual,
              difference: actual - calculated,
              transactionCount: txCount,
              correctionCount: cCount,
            });
          }
        });
      });

      setDiscrepancies(foundDiscrepancies);

      // Calculate summary
      const uniqueMembers = new Set(foundDiscrepancies.map(d => d.userId));
      setSummary({
        totalMembers: savingsSummary?.length || 0,
        membersWithDiscrepancy: uniqueMembers.size,
        totalDiscrepancyAmount: foundDiscrepancies.reduce((sum, d) => sum + Math.abs(d.difference), 0),
        reconciliationRate: savingsSummary?.length 
          ? ((savingsSummary.length - uniqueMembers.size) / savingsSummary.length) * 100 
          : 100,
      });

    } catch (error) {
      console.error('Error calculating reconciliation:', error);
      toast.error('Gagal menghitung rekonsiliasi');
    } finally {
      setLoading(false);
    }
  };

  const fixDiscrepancy = async (discrepancy: SavingsDiscrepancy, mode: 'adjust_savings' | 'create_correction'): Promise<boolean> => {
    try {
      if (mode === 'adjust_savings') {
        // Directly update savings_summary to match calculated
        const updateField = discrepancy.type === 'simpanan_pokok' ? 'simpanan_pokok' :
                           discrepancy.type === 'simpanan_wajib' ? 'simpanan_wajib' : 'simpanan_sukarela';
        
        // Get current total
        const { data: current } = await supabase
          .from('savings_summary')
          .select('simpanan_pokok, simpanan_wajib, simpanan_sukarela')
          .eq('user_id', discrepancy.userId)
          .single();

        if (!current) throw new Error('Savings not found');

        const newTotal = discrepancy.calculatedAmount + 
          (discrepancy.type !== 'simpanan_pokok' ? Number(current.simpanan_pokok) : 0) +
          (discrepancy.type !== 'simpanan_wajib' ? Number(current.simpanan_wajib) : 0) +
          (discrepancy.type !== 'simpanan_sukarela' ? Number(current.simpanan_sukarela) : 0);

        const { error } = await supabase
          .from('savings_summary')
          .update({
            [updateField]: discrepancy.calculatedAmount,
            total_simpanan: newTotal,
          })
          .eq('user_id', discrepancy.userId);

        if (error) throw error;

        // Log to audit
        await supabase.from('savings_audit_log').insert({
          user_id: discrepancy.userId,
          change_type: 'update',
          old_simpanan_pokok: discrepancy.type === 'simpanan_pokok' ? discrepancy.actualAmount : null,
          new_simpanan_pokok: discrepancy.type === 'simpanan_pokok' ? discrepancy.calculatedAmount : null,
          old_simpanan_wajib: discrepancy.type === 'simpanan_wajib' ? discrepancy.actualAmount : null,
          new_simpanan_wajib: discrepancy.type === 'simpanan_wajib' ? discrepancy.calculatedAmount : null,
          old_simpanan_sukarela: discrepancy.type === 'simpanan_sukarela' ? discrepancy.actualAmount : null,
          new_simpanan_sukarela: discrepancy.type === 'simpanan_sukarela' ? discrepancy.calculatedAmount : null,
          source: 'reconciliation',
          notes: `Rekonsiliasi otomatis: menyesuaikan ${discrepancy.type} dari ${discrepancy.actualAmount} ke ${discrepancy.calculatedAmount}`,
        });

      } else {
        // Create a correction transaction
        const operation = discrepancy.difference > 0 ? 'subtract' : 'add';
        const amount = Math.abs(discrepancy.difference);

        const { error } = await supabase.from('corrections').insert({
          user_id: discrepancy.userId,
          correction_type: discrepancy.type,
          operation,
          amount,
          current_balance: discrepancy.actualAmount,
          new_balance: discrepancy.calculatedAmount,
          reason: 'Koreksi otomatis dari rekonsiliasi simpanan',
          footnote: `Selisih ${discrepancy.difference > 0 ? 'lebih' : 'kurang'}: Rp ${Math.abs(discrepancy.difference).toLocaleString('id-ID')}`,
          status: 'applied',
          correction_mode: 'nominal',
        });

        if (error) throw error;

        // Update savings_summary
        const updateField = discrepancy.type === 'simpanan_pokok' ? 'simpanan_pokok' :
                           discrepancy.type === 'simpanan_wajib' ? 'simpanan_wajib' : 'simpanan_sukarela';

        const { data: current } = await supabase
          .from('savings_summary')
          .select('simpanan_pokok, simpanan_wajib, simpanan_sukarela')
          .eq('user_id', discrepancy.userId)
          .single();

        if (!current) throw new Error('Savings not found');

        const newTotal = discrepancy.calculatedAmount + 
          (discrepancy.type !== 'simpanan_pokok' ? Number(current.simpanan_pokok) : 0) +
          (discrepancy.type !== 'simpanan_wajib' ? Number(current.simpanan_wajib) : 0) +
          (discrepancy.type !== 'simpanan_sukarela' ? Number(current.simpanan_sukarela) : 0);

        await supabase
          .from('savings_summary')
          .update({
            [updateField]: discrepancy.calculatedAmount,
            total_simpanan: newTotal,
          })
          .eq('user_id', discrepancy.userId);
      }

      toast.success('Berhasil memperbaiki selisih');
      return true;
    } catch (error) {
      console.error('Error fixing discrepancy:', error);
      toast.error('Gagal memperbaiki selisih');
      return false;
    }
  };

  const fixAllDiscrepancies = async (mode: 'adjust_savings' | 'create_correction'): Promise<number> => {
    let fixed = 0;
    for (const disc of discrepancies) {
      const success = await fixDiscrepancy(disc, mode);
      if (success) fixed++;
    }
    await calculateReconciliation();
    return fixed;
  };

  return {
    loading,
    discrepancies,
    summary,
    calculateReconciliation,
    fixDiscrepancy,
    fixAllDiscrepancies,
  };
};
