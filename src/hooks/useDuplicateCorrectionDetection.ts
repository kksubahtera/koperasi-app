import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DuplicateGroup {
  key: string;
  transaction_id: string | null;
  correction_type: string;
  amount: number;
  operation: string;
  user_id: string;
  userName?: string;
  corrections: CorrectionRecord[];
  originalCount: number;
  excessCount: number;
  totalExcessAmount: number;
}

export interface CorrectionRecord {
  id: string;
  transaction_id: string | null;
  correction_type: string;
  amount: number;
  operation: string;
  reason: string;
  status: string;
  user_id: string;
  created_at: string;
  created_by: string | null;
  correction_mode: string | null;
  current_balance: number;
  new_balance: number;
}

interface UseDuplicateCorrectionDetectionReturn {
  duplicateGroups: DuplicateGroup[];
  totalDuplicates: number;
  totalExcessAmount: number;
  affectedUsers: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  cleanupDuplicate: (groupKey: string, keepFirst: boolean) => Promise<boolean>;
  cleanupAllDuplicates: () => Promise<boolean>;
  isCleaningUp: boolean;
}

// Helper function to recalculate savings for a user
const recalculateSavingsForUser = async (userId: string): Promise<boolean> => {
  try {
    // Fetch all approved transactions for the user
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .eq('status', 'approved');

    if (txError) throw txError;

    // Fetch all applied corrections for the user
    const { data: corrections, error: corError } = await supabase
      .from('corrections')
      .select('correction_type, amount, operation')
      .eq('user_id', userId)
      .eq('status', 'applied');

    if (corError) throw corError;

    // Calculate balances from transactions
    let simpananPokok = 0;
    let simpananWajib = 0;
    let simpananSukarela = 0;

    (transactions || []).forEach((tx) => {
      const amount = Number(tx.amount) || 0;
      switch (tx.type) {
        case 'simpanan_pokok':
          simpananPokok += amount;
          break;
        case 'simpanan_wajib':
        case 'setor_simpanan_wajib':
          simpananWajib += amount;
          break;
        case 'simpanan_sukarela':
        case 'setor_simpanan_sukarela':
          simpananSukarela += amount;
          break;
        case 'penarikan_simpanan_sukarela':
          simpananSukarela -= amount;
          break;
      }
    });

    // Apply corrections
    (corrections || []).forEach((cor) => {
      const amount = Number(cor.amount) || 0;
      const delta = cor.operation === 'add' ? amount : -amount;

      switch (cor.correction_type) {
        case 'simpanan_pokok':
          simpananPokok += delta;
          break;
        case 'simpanan_wajib':
          simpananWajib += delta;
          break;
        case 'simpanan_sukarela':
          simpananSukarela += delta;
          break;
      }
    });

    // Ensure no negative values
    simpananPokok = Math.max(0, simpananPokok);
    simpananWajib = Math.max(0, simpananWajib);
    simpananSukarela = Math.max(0, simpananSukarela);
    const totalSimpanan = simpananPokok + simpananWajib + simpananSukarela;

    // Update savings_summary
    const { error: updateError } = await supabase
      .from('savings_summary')
      .update({
        simpanan_pokok: simpananPokok,
        simpanan_wajib: simpananWajib,
        simpanan_sukarela: simpananSukarela,
        total_simpanan: totalSimpanan,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    return true;
  } catch (err) {
    console.error('Error recalculating savings for user:', userId, err);
    return false;
  }
};

export const useDuplicateCorrectionDetection = (): UseDuplicateCorrectionDetectionReturn => {
  const { toast } = useToast();
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDuplicates = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all applied corrections
      const { data: corrections, error: corError } = await supabase
        .from('corrections')
        .select('*')
        .eq('status', 'applied')
        .order('created_at', { ascending: true });

      if (corError) throw corError;

      // Fetch user names for display
      const userIds = [...new Set((corrections || []).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const userNameMap = new Map<string, string>();
      (profiles || []).forEach(p => userNameMap.set(p.user_id, p.name));

      // Group corrections by key (transaction_id + correction_type + amount + operation)
      const groups = new Map<string, CorrectionRecord[]>();

      (corrections || []).forEach((cor: any) => {
        // Only consider transaction-based corrections for duplicate detection
        if (cor.correction_mode === 'transaction_based' && cor.transaction_id) {
          const key = `${cor.transaction_id}|${cor.correction_type}|${cor.amount}|${cor.operation}`;
          
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push(cor as CorrectionRecord);
        }
      });

      // Filter to only groups with more than 1 correction (duplicates)
      const duplicates: DuplicateGroup[] = [];

      groups.forEach((corrections, key) => {
        if (corrections.length > 1) {
          const first = corrections[0];
          const excessCount = corrections.length - 1;
          const excessAmount = first.amount * excessCount;

          duplicates.push({
            key,
            transaction_id: first.transaction_id,
            correction_type: first.correction_type,
            amount: first.amount,
            operation: first.operation,
            user_id: first.user_id,
            userName: userNameMap.get(first.user_id) || 'Unknown',
            corrections,
            originalCount: corrections.length,
            excessCount,
            totalExcessAmount: excessAmount,
          });
        }
      });

      // Sort by excess amount descending (biggest impact first)
      duplicates.sort((a, b) => b.totalExcessAmount - a.totalExcessAmount);

      setDuplicateGroups(duplicates);
    } catch (err) {
      console.error('Error detecting duplicates:', err);
      setError('Gagal mendeteksi koreksi duplikat');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const totalDuplicates = useMemo(() => {
    return duplicateGroups.reduce((sum, g) => sum + g.excessCount, 0);
  }, [duplicateGroups]);

  const totalExcessAmount = useMemo(() => {
    return duplicateGroups.reduce((sum, g) => sum + g.totalExcessAmount, 0);
  }, [duplicateGroups]);

  const affectedUsers = useMemo(() => {
    return new Set(duplicateGroups.map(g => g.user_id)).size;
  }, [duplicateGroups]);

  const cleanupDuplicate = async (groupKey: string, keepFirst: boolean = true): Promise<boolean> => {
    setIsCleaningUp(true);
    try {
      const group = duplicateGroups.find(g => g.key === groupKey);
      if (!group) {
        throw new Error('Group not found');
      }

      // Get IDs to delete (keep first or keep last)
      const idsToDelete = keepFirst
        ? group.corrections.slice(1).map(c => c.id)
        : group.corrections.slice(0, -1).map(c => c.id);

      // Delete duplicate corrections
      const { error: deleteError } = await supabase
        .from('corrections')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) throw deleteError;

      // Recalculate savings for the affected user
      const recalcSuccess = await recalculateSavingsForUser(group.user_id);

      toast({
        title: 'Berhasil',
        description: recalcSuccess
          ? `${idsToDelete.length} duplikat dihapus dan saldo diperbarui`
          : `${idsToDelete.length} duplikat dihapus, tapi gagal update saldo`,
        variant: recalcSuccess ? 'default' : 'destructive',
      });

      // Refresh data
      await fetchDuplicates();
      return true;
    } catch (err) {
      console.error('Error cleaning up duplicate:', err);
      toast({
        title: 'Gagal',
        description: 'Gagal menghapus koreksi duplikat',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsCleaningUp(false);
    }
  };

  const cleanupAllDuplicates = async (): Promise<boolean> => {
    setIsCleaningUp(true);
    try {
      let totalDeleted = 0;
      const affectedUserIds = new Set<string>();

      for (const group of duplicateGroups) {
        // Keep only the first correction, delete the rest
        const idsToDelete = group.corrections.slice(1).map(c => c.id);

        if (idsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('corrections')
            .delete()
            .in('id', idsToDelete);

          if (deleteError) throw deleteError;
          totalDeleted += idsToDelete.length;
          affectedUserIds.add(group.user_id);
        }
      }

      // Recalculate savings for all affected users
      let recalcSuccessCount = 0;
      for (const userId of affectedUserIds) {
        const success = await recalculateSavingsForUser(userId);
        if (success) recalcSuccessCount++;
      }

      toast({
        title: 'Berhasil',
        description: `${totalDeleted} duplikat dihapus, ${recalcSuccessCount}/${affectedUserIds.size} saldo diperbarui`,
      });

      // Refresh data
      await fetchDuplicates();
      return true;
    } catch (err) {
      console.error('Error cleaning up all duplicates:', err);
      toast({
        title: 'Gagal',
        description: 'Gagal menghapus semua koreksi duplikat',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsCleaningUp(false);
    }
  };

  return {
    duplicateGroups,
    totalDuplicates,
    totalExcessAmount,
    affectedUsers,
    isLoading,
    error,
    refetch: fetchDuplicates,
    cleanupDuplicate,
    cleanupAllDuplicates,
    isCleaningUp,
  };
};
