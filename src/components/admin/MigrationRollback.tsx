import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  RotateCcw, 
  History, 
  AlertTriangle, 
  Trash2, 
  Eye, 
  Loader2,
  CheckCircle2,
  Clock,
  Database,
  Users,
  CreditCard,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatCurrency } from '@/lib/mockData';
import { Json } from '@/integrations/supabase/types';

interface MigrationBackup {
  id: string;
  year: number;
  created_at: string;
  backup_type: 'pre_migration';
  data: {
    balance_sheet: any;
    savings_summary: Array<{
      user_id: string;
      simpanan_pokok: number;
      simpanan_wajib: number;
      simpanan_sukarela: number;
      total_simpanan: number;
    }>;
    loans: Array<{
      id: string;
      user_id: string;
      principal_amount: number;
      tenor: number;
      interest_rate: number;
      status: string;
      remaining_principal: number;
    }>;
    loan_installments: Array<{
      id: string;
      loan_id: string;
      installment_number: number;
      status: string;
      paid_amount: number;
    }>;
    journal_entries: Array<{
      id: string;
      entry_number: string;
      description: string;
      total_debit: number;
      total_credit: number;
    }>;
    chart_of_accounts: Array<{
      id: string;
      account_code: string;
      balance: number;
    }>;
  };
  member_count: number;
  loan_count: number;
  total_savings: number;
}

interface MigrationRollbackProps {
  migrationYear: number;
  onRollbackComplete?: () => void;
}

export const MigrationRollback = ({ migrationYear, onRollbackComplete }: MigrationRollbackProps) => {
  const [backups, setBackups] = useState<MigrationBackup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<MigrationBackup | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Fetch backups for the year
  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cooperative_settings')
        .select('*')
        .eq('key', `migration_backup_${migrationYear}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Parse the backup data
        const parsedBackups = data.map(item => {
          const value = item.value as Record<string, Json>;
          const backupData = value.data as Record<string, Json>;
          return {
            id: item.id,
            year: migrationYear,
            created_at: item.updated_at || new Date().toISOString(),
            backup_type: 'pre_migration' as const,
            data: {
              balance_sheet: backupData?.balance_sheet || null,
              savings_summary: (backupData?.savings_summary || []) as any[],
              loans: (backupData?.loans || []) as any[],
              loan_installments: (backupData?.loan_installments || []) as any[],
              journal_entries: (backupData?.journal_entries || []) as any[],
              chart_of_accounts: (backupData?.chart_of_accounts || []) as any[],
            },
            member_count: (value.member_count as number) || 0,
            loan_count: (value.loan_count as number) || 0,
            total_savings: (value.total_savings as number) || 0,
          };
        });
        setBackups(parsedBackups);
      } else {
        setBackups([]);
      }
    } catch (error) {
      console.error('Error fetching backups:', error);
      toast.error('Gagal memuat data backup');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [migrationYear]);

  // Handle rollback
  const handleRollback = async () => {
    if (!selectedBackup) return;

    setIsRollingBack(true);
    try {
      const backupData = selectedBackup.data;

      // 1. Delete current migration data (loans created for this year)
      // First, get loans that were created during migration
      const { data: currentLoans } = await supabase
        .from('loans')
        .select('id')
        .eq('status', 'active');
      
      if (currentLoans && currentLoans.length > 0) {
        const loanIds = currentLoans.map(l => l.id);
        
        // Delete installments for these loans
        await supabase
          .from('loan_installments')
          .delete()
          .in('loan_id', loanIds);
        
        // Delete the loans
        await supabase
          .from('loans')
          .delete()
          .in('id', loanIds);
      }

      // 2. Restore savings_summary
      if (backupData.savings_summary && backupData.savings_summary.length > 0) {
        for (const savings of backupData.savings_summary) {
          await supabase
            .from('savings_summary')
            .update({
              simpanan_pokok: savings.simpanan_pokok,
              simpanan_wajib: savings.simpanan_wajib,
              simpanan_sukarela: savings.simpanan_sukarela,
              total_simpanan: savings.total_simpanan,
            })
            .eq('user_id', savings.user_id);
        }
      }

      // 3. Restore or delete balance_sheet
      if (backupData.balance_sheet) {
        await supabase
          .from('balance_sheets')
          .upsert(backupData.balance_sheet, { onConflict: 'year' });
      } else {
        // Delete if there was no balance sheet before
        await supabase
          .from('balance_sheets')
          .delete()
          .eq('year', migrationYear);
      }

      // 4. Restore chart of accounts balances
      if (backupData.chart_of_accounts && backupData.chart_of_accounts.length > 0) {
        for (const account of backupData.chart_of_accounts) {
          await supabase
            .from('chart_of_accounts')
            .update({ balance: account.balance })
            .eq('id', account.id);
        }
      }

      // 5. Delete opening journal entries for this year
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('id')
        .ilike('entry_number', `JU-${migrationYear}%`)
        .ilike('description', '%Saldo Awal%');

      if (journalEntries && journalEntries.length > 0) {
        const journalIds = journalEntries.map(j => j.id);
        
        // Delete journal lines first
        await supabase
          .from('journal_entry_lines')
          .delete()
          .in('journal_entry_id', journalIds);
        
        // Delete journal entries
        await supabase
          .from('journal_entries')
          .delete()
          .in('id', journalIds);
      }

      // 6. Save rollback history
      const historyKey = `migration_history_${migrationYear}_rollback_${Date.now()}`;
      const now = new Date().toISOString();
      await supabase
        .from('cooperative_settings')
        .insert({
          key: historyKey,
          value: {
            year: migrationYear,
            status: 'rolled_back',
            created_at: selectedBackup.created_at,
            rolled_back_at: now,
            member_count: selectedBackup.member_count,
            loan_count: selectedBackup.loan_count,
            total_savings: selectedBackup.total_savings,
            total_loans: 0,
            has_opening_journal: false,
            has_balance_sheet: false,
            notes: `Migrasi tahun ${migrationYear} dibatalkan (rollback)`,
          },
          updated_at: now,
        });

      // 7. Delete the backup record after successful rollback
      await supabase
        .from('cooperative_settings')
        .delete()
        .eq('id', selectedBackup.id);

      toast.success('Rollback migrasi berhasil! Data telah dikembalikan ke kondisi sebelum migrasi.');
      setShowConfirmDialog(false);
      setSelectedBackup(null);
      fetchBackups();
      onRollbackComplete?.();
    } catch (error) {
      console.error('Rollback error:', error);
      toast.error('Gagal melakukan rollback migrasi');
    } finally {
      setIsRollingBack(false);
    }
  };

  // Delete backup without rollback
  const handleDeleteBackup = async (backup: MigrationBackup) => {
    try {
      await supabase
        .from('cooperative_settings')
        .delete()
        .eq('id', backup.id);

      toast.success('Backup berhasil dihapus');
      fetchBackups();
    } catch (error) {
      console.error('Delete backup error:', error);
      toast.error('Gagal menghapus backup');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Memuat data backup...</p>
        </CardContent>
      </Card>
    );
  }

  if (backups.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">Tidak ada backup migrasi untuk tahun {migrationYear}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Backup akan dibuat otomatis saat Anda menyimpan data migrasi
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Rollback Migrasi
          </CardTitle>
          <CardDescription>
            Kembalikan data ke kondisi sebelum migrasi dilakukan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>Peringatan:</strong> Rollback akan menghapus semua data yang dibuat saat migrasi dan mengembalikan 
              ke kondisi sebelumnya. Tindakan ini tidak dapat dibatalkan.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {backups.map((backup) => (
              <Card key={backup.id} className="bg-muted/30">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-primary/10">
                        <Database className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Backup Migrasi Tahun {backup.year}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{format(new Date(backup.created_at), 'dd MMM yyyy HH:mm', { locale: id })}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{backup.member_count} anggota</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span>{backup.loan_count} pinjaman</span>
                        </div>
                        <Badge variant="outline" className="bg-green-100 text-green-700">
                          {formatCurrency(backup.total_savings)}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBackup(backup);
                            setShowDetailDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detail
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedBackup(backup);
                            setShowConfirmDialog(true);
                          }}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Rollback
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detail Backup Migrasi</DialogTitle>
            <DialogDescription>
              Backup dibuat pada {selectedBackup && format(new Date(selectedBackup.created_at), 'dd MMMM yyyy HH:mm', { locale: id })}
            </DialogDescription>
          </DialogHeader>

          {selectedBackup && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="bg-blue-50 dark:bg-blue-900/20">
                    <CardContent className="py-3 text-center">
                      <Users className="h-5 w-5 mx-auto text-blue-600" />
                      <p className="text-2xl font-bold text-blue-700">{selectedBackup.member_count}</p>
                      <p className="text-xs text-blue-600">Anggota dengan Simpanan</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 dark:bg-green-900/20">
                    <CardContent className="py-3 text-center">
                      <CreditCard className="h-5 w-5 mx-auto text-green-600" />
                      <p className="text-2xl font-bold text-green-700">{selectedBackup.loan_count}</p>
                      <p className="text-xs text-green-600">Pinjaman Aktif</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-50 dark:bg-purple-900/20">
                    <CardContent className="py-3 text-center">
                      <Database className="h-5 w-5 mx-auto text-purple-600" />
                      <p className="text-lg font-bold text-purple-700">{formatCurrency(selectedBackup.total_savings)}</p>
                      <p className="text-xs text-purple-600">Total Simpanan</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Savings Summary */}
                {selectedBackup.data.savings_summary.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Data Simpanan ({selectedBackup.data.savings_summary.length})</h4>
                    <div className="rounded-md border max-h-[200px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User ID</TableHead>
                            <TableHead className="text-right">Simpanan Pokok</TableHead>
                            <TableHead className="text-right">Simpanan Wajib</TableHead>
                            <TableHead className="text-right">Simpanan Sukarela</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedBackup.data.savings_summary.slice(0, 10).map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">{item.user_id.substring(0, 8)}...</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.simpanan_pokok)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.simpanan_wajib)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.simpanan_sukarela)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {selectedBackup.data.savings_summary.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ...dan {selectedBackup.data.savings_summary.length - 10} data lainnya
                      </p>
                    )}
                  </div>
                )}

                {/* Chart of Accounts */}
                {selectedBackup.data.chart_of_accounts.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Saldo Chart of Accounts ({selectedBackup.data.chart_of_accounts.length})</h4>
                    <div className="rounded-md border max-h-[150px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Kode Akun</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedBackup.data.chart_of_accounts.slice(0, 10).map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono">{item.account_code}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Tutup
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDetailDialog(false);
                setShowConfirmDialog(true);
              }}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Rollback Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Konfirmasi Rollback Migrasi
            </DialogTitle>
            <DialogDescription>
              Tindakan ini akan menghapus semua data migrasi dan mengembalikan ke kondisi sebelum migrasi.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Data yang akan dihapus:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Semua pinjaman aktif yang dibuat saat migrasi</li>
                <li>Jadwal angsuran pinjaman</li>
                <li>Jurnal pembuka tahun {migrationYear}</li>
                <li>Saldo neraca akan dikembalikan</li>
              </ul>
            </AlertDescription>
          </Alert>

          <p className="text-sm text-muted-foreground">
            Apakah Anda yakin ingin melakukan rollback? Tindakan ini tidak dapat dibatalkan.
          </p>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={isRollingBack}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleRollback}
              disabled={isRollingBack}
            >
              {isRollingBack ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rollback...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Ya, Rollback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Helper function to create backup before migration
export const createMigrationBackup = async (
  migrationYear: number,
  savingsEntries: Array<{ userId: string; simpananPokok: number; simpananWajib: number; simpananSukarela: number }>,
  loanEntries: Array<{ userId: string; principalAmount: number; tenor: number; interestRate: number }>
): Promise<boolean> => {
  try {
    // Get current savings_summary
    const { data: savingsSummary } = await supabase
      .from('savings_summary')
      .select('user_id, simpanan_pokok, simpanan_wajib, simpanan_sukarela, total_simpanan');

    // Get current balance_sheet
    const { data: balanceSheet } = await supabase
      .from('balance_sheets')
      .select('*')
      .eq('year', migrationYear)
      .maybeSingle();

    // Get current loans
    const { data: loans } = await supabase
      .from('loans')
      .select('id, user_id, principal_amount, tenor, interest_rate, status, remaining_principal')
      .eq('status', 'active');

    // Get current loan installments
    const { data: installments } = await supabase
      .from('loan_installments')
      .select('id, loan_id, installment_number, status, paid_amount');

    // Get current journal entries for this year
    const { data: journalEntries } = await supabase
      .from('journal_entries')
      .select('id, entry_number, description, total_debit, total_credit')
      .ilike('entry_number', `JU-${migrationYear}%`);

    // Get chart of accounts with balances
    const { data: chartOfAccounts } = await supabase
      .from('chart_of_accounts')
      .select('id, account_code, balance');

    // Calculate totals
    const totalSavings = savingsSummary?.reduce((sum, s) => sum + (s.total_simpanan || 0), 0) || 0;
    const memberCount = savingsEntries.filter(e => e.simpananPokok > 0 || e.simpananWajib > 0 || e.simpananSukarela > 0).length;
    const loanCount = loanEntries.length;

    // Create backup record
    const backupData = {
      year: migrationYear,
      created_at: new Date().toISOString(),
      backup_type: 'pre_migration',
      member_count: memberCount,
      loan_count: loanCount,
      total_savings: totalSavings,
      data: {
        balance_sheet: balanceSheet,
        savings_summary: savingsSummary || [],
        loans: loans || [],
        loan_installments: installments || [],
        journal_entries: journalEntries || [],
        chart_of_accounts: chartOfAccounts || [],
      },
    };

    // Store in cooperative_settings
    const { error } = await supabase
      .from('cooperative_settings')
      .upsert({
        key: `migration_backup_${migrationYear}`,
        value: backupData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error creating backup:', error);
    return false;
  }
};
