import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReconciliationResult {
  savingsTotals: {
    simpanan_pokok: number;
    simpanan_wajib: number;
    simpanan_sukarela: number;
    total: number;
  };
  coaTotals: {
    simpanan_pokok: number;
    simpanan_wajib: number;
    simpanan_sukarela: number;
    total: number;
  };
  loanTotals: {
    remaining_principal: number;
    coa_piutang: number;
  };
  differences: {
    simpanan_pokok: number;
    simpanan_wajib: number;
    simpanan_sukarela: number;
    savings_total: number;
    loan_piutang: number;
  };
  isReconciled: boolean;
  lastChecked: string;
}

interface MigrationStats {
  totalMigratedMembers: number;
  totalMigratedLoans: number;
  totalMigrationTransactions: number;
  unlinkedJournals: number;
}

interface ReconciliationLog {
  id: string;
  checked_at: string;
  savings_total: number;
  coa_hutang_total: number;
  loans_remaining_principal: number;
  coa_piutang_pinjaman: number;
  diff_savings_total: number;
  diff_loan_piutang: number;
  is_reconciled: boolean;
  action_taken: string | null;
}

export const useMigrationReconciliation = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [logs, setLogs] = useState<ReconciliationLog[]>([]);

  // Fetch reconciliation data using database function
  const checkReconciliation = useCallback(async () => {
    setLoading(true);
    try {
      // Get current user for logging
      const { data: { user } } = await supabase.auth.getUser();
      
      // Call database function for reconciliation check
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('perform_reconciliation_check', { p_user_id: user?.id || null });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        // Fallback to manual check if RPC fails
        return await checkReconciliationManual();
      }

      // Also get detailed breakdown
      const { data: savingsData } = await supabase
        .from('savings_summary')
        .select('simpanan_pokok, simpanan_wajib, simpanan_sukarela');

      const { data: coaData } = await supabase
        .from('chart_of_accounts')
        .select('account_code, balance')
        .in('account_code', ['2-1010', '2-1020', '2-1030', '1-2000']);

      const { data: loanData } = await supabase
        .from('loans')
        .select('remaining_principal')
        .eq('status', 'active');

      const savingsTotals = {
        simpanan_pokok: savingsData?.reduce((sum, s) => sum + (s.simpanan_pokok || 0), 0) || 0,
        simpanan_wajib: savingsData?.reduce((sum, s) => sum + (s.simpanan_wajib || 0), 0) || 0,
        simpanan_sukarela: savingsData?.reduce((sum, s) => sum + (s.simpanan_sukarela || 0), 0) || 0,
        total: 0,
      };
      savingsTotals.total = savingsTotals.simpanan_pokok + savingsTotals.simpanan_wajib + savingsTotals.simpanan_sukarela;

      const coaMap = new Map(coaData?.map(a => [a.account_code, a.balance || 0]));
      const coaTotals = {
        simpanan_pokok: coaMap.get('2-1010') || 0,
        simpanan_wajib: coaMap.get('2-1020') || 0,
        simpanan_sukarela: coaMap.get('2-1030') || 0,
        total: 0,
      };
      coaTotals.total = coaTotals.simpanan_pokok + coaTotals.simpanan_wajib + coaTotals.simpanan_sukarela;

      const loanTotals = {
        remaining_principal: loanData?.reduce((sum, l) => sum + (l.remaining_principal || 0), 0) || 0,
        coa_piutang: coaMap.get('1-2000') || 0,
      };

      const differences = {
        simpanan_pokok: savingsTotals.simpanan_pokok - coaTotals.simpanan_pokok,
        simpanan_wajib: savingsTotals.simpanan_wajib - coaTotals.simpanan_wajib,
        simpanan_sukarela: savingsTotals.simpanan_sukarela - coaTotals.simpanan_sukarela,
        savings_total: savingsTotals.total - coaTotals.total,
        loan_piutang: loanTotals.remaining_principal - loanTotals.coa_piutang,
      };

      const isReconciled = 
        Math.abs(differences.savings_total) < 1 && 
        Math.abs(differences.loan_piutang) < 1;

      const reconciliationResult: ReconciliationResult = {
        savingsTotals,
        coaTotals,
        loanTotals,
        differences,
        isReconciled,
        lastChecked: new Date().toISOString(),
      };

      setResult(reconciliationResult);

      if (!isReconciled) {
        toast.warning('Ditemukan selisih antara data simpanan dan buku besar');
      } else {
        toast.success('Data sudah seimbang (reconciled)');
      }

      return reconciliationResult;
    } catch (error) {
      console.error('Error checking reconciliation:', error);
      toast.error('Gagal memeriksa rekonsiliasi');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual reconciliation check (fallback)
  const checkReconciliationManual = useCallback(async () => {
    try {
      const { data: savingsData } = await supabase
        .from('savings_summary')
        .select('simpanan_pokok, simpanan_wajib, simpanan_sukarela');

      const { data: coaData } = await supabase
        .from('chart_of_accounts')
        .select('account_code, balance')
        .in('account_code', ['2-1010', '2-1020', '2-1030', '1-2000']);

      const { data: loanData } = await supabase
        .from('loans')
        .select('remaining_principal')
        .eq('status', 'active');

      const savingsTotals = {
        simpanan_pokok: savingsData?.reduce((sum, s) => sum + (s.simpanan_pokok || 0), 0) || 0,
        simpanan_wajib: savingsData?.reduce((sum, s) => sum + (s.simpanan_wajib || 0), 0) || 0,
        simpanan_sukarela: savingsData?.reduce((sum, s) => sum + (s.simpanan_sukarela || 0), 0) || 0,
        total: 0,
      };
      savingsTotals.total = savingsTotals.simpanan_pokok + savingsTotals.simpanan_wajib + savingsTotals.simpanan_sukarela;

      const coaMap = new Map(coaData?.map(a => [a.account_code, a.balance || 0]));
      const coaTotals = {
        simpanan_pokok: coaMap.get('2-1010') || 0,
        simpanan_wajib: coaMap.get('2-1020') || 0,
        simpanan_sukarela: coaMap.get('2-1030') || 0,
        total: 0,
      };
      coaTotals.total = coaTotals.simpanan_pokok + coaTotals.simpanan_wajib + coaTotals.simpanan_sukarela;

      const loanTotals = {
        remaining_principal: loanData?.reduce((sum, l) => sum + (l.remaining_principal || 0), 0) || 0,
        coa_piutang: coaMap.get('1-2000') || 0,
      };

      const differences = {
        simpanan_pokok: savingsTotals.simpanan_pokok - coaTotals.simpanan_pokok,
        simpanan_wajib: savingsTotals.simpanan_wajib - coaTotals.simpanan_wajib,
        simpanan_sukarela: savingsTotals.simpanan_sukarela - coaTotals.simpanan_sukarela,
        savings_total: savingsTotals.total - coaTotals.total,
        loan_piutang: loanTotals.remaining_principal - loanTotals.coa_piutang,
      };

      const isReconciled = 
        Math.abs(differences.savings_total) < 1 && 
        Math.abs(differences.loan_piutang) < 1;

      const reconciliationResult: ReconciliationResult = {
        savingsTotals,
        coaTotals,
        loanTotals,
        differences,
        isReconciled,
        lastChecked: new Date().toISOString(),
      };

      setResult(reconciliationResult);
      return reconciliationResult;
    } catch (error) {
      console.error('Error in manual reconciliation:', error);
      return null;
    }
  }, []);

  // Fetch migration statistics
  const fetchMigrationStats = useCallback(async () => {
    setLoading(true);
    try {
      const { count: migratedMembers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_migrated_account', true);

      const { count: migrationTransactions } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('is_migration', true);

      const { data: unlinkedTransactions } = await supabase
        .from('transactions')
        .select('id')
        .in('type', ['saldo_awal_pokok', 'saldo_awal_wajib', 'saldo_awal_sukarela'])
        .is('journal_entry_id', null);

      const { count: migratedLoans } = await supabase
        .from('loans')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const migrationStats: MigrationStats = {
        totalMigratedMembers: migratedMembers || 0,
        totalMigratedLoans: migratedLoans || 0,
        totalMigrationTransactions: migrationTransactions || 0,
        unlinkedJournals: unlinkedTransactions?.length || 0,
      };

      setStats(migrationStats);
      return migrationStats;
    } catch (error) {
      console.error('Error fetching migration stats:', error);
      toast.error('Gagal memuat statistik migrasi');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch reconciliation logs
  const fetchReconciliationLogs = useCallback(async (limit: number = 10) => {
    try {
      const { data, error } = await supabase
        .from('reconciliation_logs')
        .select('id, checked_at, savings_total, coa_hutang_total, loans_remaining_principal, coa_piutang_pinjaman, diff_savings_total, diff_loan_piutang, is_reconciled, action_taken')
        .order('checked_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setLogs(data || []);
      return data;
    } catch (error) {
      console.error('Error fetching reconciliation logs:', error);
      return [];
    }
  }, []);

  // Auto-fix COA balances using database function
  const syncCOAFromSavings = useCallback(async () => {
    if (!result) {
      toast.error('Jalankan pemeriksaan rekonsiliasi terlebih dahulu');
      return false;
    }

    if (result.isReconciled) {
      toast.info('Data sudah seimbang, tidak perlu sinkronisasi');
      return true;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Call database function for sync
      const { data, error } = await supabase
        .rpc('sync_coa_from_savings', { p_user_id: user?.id || null });

      if (error) {
        console.error('Sync RPC error:', error);
        // Fallback to manual sync
        return await syncCOAManual();
      }

      toast.success('Saldo buku besar berhasil disinkronkan');
      await checkReconciliation();
      return true;
    } catch (error) {
      console.error('Error syncing COA:', error);
      toast.error('Gagal menyinkronkan saldo buku besar');
      return false;
    } finally {
      setLoading(false);
    }
  }, [result, checkReconciliation]);

  // Manual sync (fallback)
  const syncCOAManual = useCallback(async () => {
    if (!result) return false;

    try {
      const updates = [
        { code: '2-1010', balance: result.savingsTotals.simpanan_pokok },
        { code: '2-1020', balance: result.savingsTotals.simpanan_wajib },
        { code: '2-1030', balance: result.savingsTotals.simpanan_sukarela },
        { code: '1-2000', balance: result.loanTotals.remaining_principal },
      ];

      for (const update of updates) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: update.balance, updated_at: new Date().toISOString() })
          .eq('account_code', update.code);
      }

      toast.success('Saldo buku besar berhasil disinkronkan (manual)');
      await checkReconciliation();
      return true;
    } catch (error) {
      console.error('Error in manual sync:', error);
      return false;
    }
  }, [result, checkReconciliation]);

  // Validate data consistency
  const validateDataConsistency = useCallback(async () => {
    setLoading(true);
    try {
      const issues: string[] = [];

      // Check for negative balances in savings
      const { data: negativeSavings } = await supabase
        .from('savings_summary')
        .select('user_id, simpanan_pokok, simpanan_wajib, simpanan_sukarela')
        .or('simpanan_pokok.lt.0,simpanan_wajib.lt.0,simpanan_sukarela.lt.0');

      if (negativeSavings && negativeSavings.length > 0) {
        issues.push(`${negativeSavings.length} anggota memiliki saldo simpanan negatif`);
      }

      // Check for orphaned transactions (no journal entry for approved saldo_awal)
      const { data: orphanedTx } = await supabase
        .from('transactions')
        .select('id, type')
        .in('type', ['saldo_awal_pokok', 'saldo_awal_wajib', 'saldo_awal_sukarela'])
        .eq('status', 'approved')
        .is('journal_entry_id', null);

      if (orphanedTx && orphanedTx.length > 0) {
        issues.push(`${orphanedTx.length} transaksi migrasi tanpa jurnal`);
      }

      // Check for loans with remaining principal > original principal
      const { data: invalidLoans } = await supabase
        .from('loans')
        .select('id, principal_amount, remaining_principal')
        .eq('status', 'active');

      const loansWithExcess = invalidLoans?.filter(
        l => (l.remaining_principal || 0) > l.principal_amount
      );

      if (loansWithExcess && loansWithExcess.length > 0) {
        issues.push(`${loansWithExcess.length} pinjaman dengan sisa pokok > pokok awal`);
      }

      if (issues.length === 0) {
        toast.success('Tidak ditemukan masalah konsistensi data');
      } else {
        toast.warning(`Ditemukan ${issues.length} masalah konsistensi data`);
      }

      return {
        isValid: issues.length === 0,
        issues,
        negativeSavingsCount: negativeSavings?.length || 0,
        orphanedTransactionsCount: orphanedTx?.length || 0,
        invalidLoansCount: loansWithExcess?.length || 0,
      };
    } catch (error) {
      console.error('Error validating data consistency:', error);
      toast.error('Gagal memvalidasi konsistensi data');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    result,
    stats,
    logs,
    checkReconciliation,
    fetchMigrationStats,
    fetchReconciliationLogs,
    syncCOAFromSavings,
    validateDataConsistency,
  };
};
