import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface MigrationSnapshotDB {
  id: string;
  type: 'before' | 'after';
  batch_id: string | null;
  timestamp: string;
  // Savings
  total_simpanan_pokok: number;
  total_simpanan_wajib: number;
  total_simpanan_sukarela: number;
  total_simpanan: number;
  member_count: number;
  // Loans
  total_loan_principal: number;
  total_remaining_principal: number;
  active_loan_count: number;
  // COA
  coa_simpanan_pokok: number;
  coa_simpanan_wajib: number;
  coa_simpanan_sukarela: number;
  coa_piutang_pinjaman: number;
  // Journals
  journal_count: number;
  total_journal_debit: number;
  total_journal_credit: number;
  // Meta
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SnapshotComparison {
  before: MigrationSnapshotDB | null;
  after: MigrationSnapshotDB | null;
  differences: {
    savings: {
      pokok: number;
      wajib: number;
      sukarela: number;
      total: number;
      memberDiff: number;
    };
    loans: {
      principal: number;
      remaining: number;
      loanDiff: number;
    };
    coa: {
      simpananPokok: number;
      simpananWajib: number;
      simpananSukarela: number;
      piutangPinjaman: number;
    };
    journals: {
      count: number;
      debit: number;
      credit: number;
    };
  };
  isBalanced: boolean;
  discrepancies: string[];
}

export const useMigrationSnapshots = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<MigrationSnapshotDB[]>([]);

  // Capture current database state as snapshot
  const captureSnapshot = useCallback(async (
    type: 'before' | 'after',
    batchId?: string,
    notes?: string
  ): Promise<MigrationSnapshotDB | null> => {
    setLoading(true);
    try {
      // Fetch savings data
      const { data: savingsData } = await supabase
        .from('savings_summary')
        .select('simpanan_pokok, simpanan_wajib, simpanan_sukarela, user_id');

      // Fetch loan data
      const { data: loanData } = await supabase
        .from('loans')
        .select('principal_amount, remaining_principal, status')
        .eq('status', 'active');

      // Fetch COA balances
      const { data: coaData } = await supabase
        .from('chart_of_accounts')
        .select('account_code, balance')
        .in('account_code', ['1-2000', '2-1010', '2-1020', '2-1030']);

      // Fetch journal entries
      const { data: journalData } = await supabase
        .from('journal_entries')
        .select('total_debit, total_credit')
        .eq('status', 'posted');

      // Calculate totals
      const totalPokok = savingsData?.reduce((sum, s) => sum + (s.simpanan_pokok || 0), 0) || 0;
      const totalWajib = savingsData?.reduce((sum, s) => sum + (s.simpanan_wajib || 0), 0) || 0;
      const totalSukarela = savingsData?.reduce((sum, s) => sum + (s.simpanan_sukarela || 0), 0) || 0;
      const memberCount = new Set(savingsData?.map(s => s.user_id)).size;

      const totalPrincipal = loanData?.reduce((sum, l) => sum + (l.principal_amount || 0), 0) || 0;
      const totalRemaining = loanData?.reduce((sum, l) => sum + (l.remaining_principal || 0), 0) || 0;
      const loanCount = loanData?.length || 0;

      const coaMap = new Map(coaData?.map(c => [c.account_code, c.balance || 0]));
      
      const journalCount = journalData?.length || 0;
      const totalDebit = journalData?.reduce((sum, j) => sum + (j.total_debit || 0), 0) || 0;
      const totalCredit = journalData?.reduce((sum, j) => sum + (j.total_credit || 0), 0) || 0;

      // Insert to database
      const { data, error } = await supabase
        .from('migration_snapshots')
        .insert({
          type,
          batch_id: batchId || null,
          total_simpanan_pokok: totalPokok,
          total_simpanan_wajib: totalWajib,
          total_simpanan_sukarela: totalSukarela,
          total_simpanan: totalPokok + totalWajib + totalSukarela,
          member_count: memberCount,
          total_loan_principal: totalPrincipal,
          total_remaining_principal: totalRemaining,
          active_loan_count: loanCount,
          coa_simpanan_pokok: coaMap.get('2-1010') || 0,
          coa_simpanan_wajib: coaMap.get('2-1020') || 0,
          coa_simpanan_sukarela: coaMap.get('2-1030') || 0,
          coa_piutang_pinjaman: coaMap.get('1-2000') || 0,
          journal_count: journalCount,
          total_journal_debit: totalDebit,
          total_journal_credit: totalCredit,
          notes,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Snapshot ${type === 'before' ? 'sebelum' : 'sesudah'} tersimpan`);
      await loadSnapshots();
      return data as MigrationSnapshotDB;
    } catch (error) {
      console.error('Error capturing snapshot:', error);
      toast.error('Gagal menyimpan snapshot');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load all snapshots
  const loadSnapshots = useCallback(async () => {
    const { data, error } = await supabase
      .from('migration_snapshots')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading snapshots:', error);
      return;
    }

    setSnapshots(data as MigrationSnapshotDB[]);
  }, []);

  // Delete a snapshot
  const deleteSnapshot = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('migration_snapshots')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Gagal menghapus snapshot');
      return false;
    }

    toast.success('Snapshot berhasil dihapus');
    await loadSnapshots();
    return true;
  }, [loadSnapshots]);

  // Compare two snapshots
  const compareSnapshots = useCallback((
    before: MigrationSnapshotDB,
    after: MigrationSnapshotDB
  ): SnapshotComparison => {
    const differences = {
      savings: {
        pokok: after.total_simpanan_pokok - before.total_simpanan_pokok,
        wajib: after.total_simpanan_wajib - before.total_simpanan_wajib,
        sukarela: after.total_simpanan_sukarela - before.total_simpanan_sukarela,
        total: after.total_simpanan - before.total_simpanan,
        memberDiff: after.member_count - before.member_count,
      },
      loans: {
        principal: after.total_loan_principal - before.total_loan_principal,
        remaining: after.total_remaining_principal - before.total_remaining_principal,
        loanDiff: after.active_loan_count - before.active_loan_count,
      },
      coa: {
        simpananPokok: after.coa_simpanan_pokok - before.coa_simpanan_pokok,
        simpananWajib: after.coa_simpanan_wajib - before.coa_simpanan_wajib,
        simpananSukarela: after.coa_simpanan_sukarela - before.coa_simpanan_sukarela,
        piutangPinjaman: after.coa_piutang_pinjaman - before.coa_piutang_pinjaman,
      },
      journals: {
        count: after.journal_count - before.journal_count,
        debit: after.total_journal_debit - before.total_journal_debit,
        credit: after.total_journal_credit - before.total_journal_credit,
      },
    };

    const discrepancies: string[] = [];

    // Check savings vs COA consistency
    if (Math.abs(differences.savings.pokok - differences.coa.simpananPokok) > 1) {
      discrepancies.push(`Selisih Simpanan Pokok: Data vs COA`);
    }
    if (Math.abs(differences.savings.wajib - differences.coa.simpananWajib) > 1) {
      discrepancies.push(`Selisih Simpanan Wajib: Data vs COA`);
    }
    if (Math.abs(differences.savings.sukarela - differences.coa.simpananSukarela) > 1) {
      discrepancies.push(`Selisih Simpanan Sukarela: Data vs COA`);
    }
    if (Math.abs(differences.loans.remaining - differences.coa.piutangPinjaman) > 1) {
      discrepancies.push(`Selisih Piutang Pinjaman: Data vs COA`);
    }
    if (Math.abs(differences.journals.debit - differences.journals.credit) > 1) {
      discrepancies.push(`Jurnal tidak seimbang: Debit vs Credit`);
    }

    return {
      before,
      after,
      differences,
      isBalanced: discrepancies.length === 0,
      discrepancies,
    };
  }, []);

  return {
    loading,
    snapshots,
    captureSnapshot,
    loadSnapshots,
    deleteSnapshot,
    compareSnapshots,
  };
};
