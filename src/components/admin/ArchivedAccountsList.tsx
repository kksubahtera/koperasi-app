import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/mockData';
import { toast } from 'sonner';
import { 
  Search,
  Loader2,
  Archive,
  Eye,
  Calendar,
  User,
  Wallet,
  CreditCard,
  Clock,
  FileText,
  RotateCcw,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface ArchivedAccount {
  id: string;
  original_user_id: string;
  member_number: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  join_date: string | null;
  simpanan_pokok: number | null;
  simpanan_wajib: number | null;
  simpanan_sukarela: number | null;
  total_simpanan: number | null;
  outstanding_loan: number | null;
  archive_reason: string;
  archived_at: string;
  archived_by: string | null;
  days_since_creation: number | null;
  was_claimed: boolean | null;
  original_profile_data: Record<string, unknown> | null;
  original_savings_data: Record<string, unknown> | null;
  original_loans_data: Record<string, unknown> | null;
  original_transactions_data: Record<string, unknown> | null;
}

interface ArchivedAccountsListProps {
  onRefresh?: () => void;
}

export const ArchivedAccountsList = ({ onRefresh }: ArchivedAccountsListProps) => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [archivedAccounts, setArchivedAccounts] = useState<ArchivedAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<ArchivedAccount | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToAction, setAccountToAction] = useState<ArchivedAccount | null>(null);

  const fetchArchivedAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('archived_accounts')
        .select('*')
        .order('archived_at', { ascending: false });

      if (error) throw error;
      
      const typedData = (data || []).map(item => ({
        ...item,
        original_profile_data: item.original_profile_data as Record<string, unknown> | null,
        original_savings_data: item.original_savings_data as Record<string, unknown> | null,
        original_loans_data: item.original_loans_data as Record<string, unknown> | null,
        original_transactions_data: item.original_transactions_data as Record<string, unknown> | null,
      }));
      
      setArchivedAccounts(typedData);
    } catch (error) {
      console.error('Error fetching archived accounts:', error);
      toast.error('Gagal memuat data arsip');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchivedAccounts();
  }, [fetchArchivedAccounts]);

  const filteredAccounts = archivedAccounts.filter(account =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (account.member_number?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (account.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleViewDetail = (account: ArchivedAccount) => {
    setSelectedAccount(account);
    setDetailOpen(true);
  };

  const handleRestoreClick = (account: ArchivedAccount) => {
    setAccountToAction(account);
    setRestoreDialogOpen(true);
  };

  const handleDeleteClick = (account: ArchivedAccount) => {
    setAccountToAction(account);
    setDeleteDialogOpen(true);
  };

  const handleRestore = async () => {
    if (!accountToAction) return;
    
    setActionLoading(true);
    try {
      const profileData = accountToAction.original_profile_data as Record<string, unknown> | null;
      const savingsData = accountToAction.original_savings_data as Record<string, unknown> | null;
      
      // Restore profile
      if (profileData) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: accountToAction.original_user_id,
            member_number: accountToAction.member_number,
            name: accountToAction.name,
            email: accountToAction.email,
            phone: accountToAction.phone,
            join_date: accountToAction.join_date,
            is_migrated_account: true,
            is_active: false,
            approval_status: 'approved',
            nik: profileData.nik as string || null,
            address: profileData.address as string || null,
            birth_date: profileData.birth_date as string || null,
            gender: profileData.gender as string || null,
            bank_name: profileData.bank_name as string || null,
            bank_account_number: profileData.bank_account_number as string || null,
            bank_account_name: profileData.bank_account_name as string || null,
          });
        
        if (profileError) throw profileError;
      }

      // Restore savings summary
      if (savingsData) {
        const { error: savingsError } = await supabase
          .from('savings_summary')
          .insert({
            user_id: accountToAction.original_user_id,
            simpanan_pokok: accountToAction.simpanan_pokok || 0,
            simpanan_wajib: accountToAction.simpanan_wajib || 0,
            simpanan_sukarela: accountToAction.simpanan_sukarela || 0,
            total_simpanan: accountToAction.total_simpanan || 0,
          });
        
        if (savingsError) throw savingsError;
      }

      // Restore user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: accountToAction.original_user_id,
          role: 'member',
        });
      
      if (roleError && !roleError.message.includes('duplicate')) {
        throw roleError;
      }

      // Delete from archived_accounts
      const { error: deleteError } = await supabase
        .from('archived_accounts')
        .delete()
        .eq('id', accountToAction.id);
      
      if (deleteError) throw deleteError;

      toast.success(`Akun ${accountToAction.name} berhasil diaktifkan kembali`);
      setRestoreDialogOpen(false);
      setAccountToAction(null);
      fetchArchivedAccounts();
      onRefresh?.();
    } catch (error) {
      console.error('Error restoring account:', error);
      toast.error('Gagal mengaktifkan kembali akun');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!accountToAction) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('archived_accounts')
        .delete()
        .eq('id', accountToAction.id);
      
      if (error) throw error;

      toast.success(`Akun ${accountToAction.name} telah dihapus permanen`);
      setDeleteDialogOpen(false);
      setAccountToAction(null);
      fetchArchivedAccounts();
    } catch (error) {
      console.error('Error permanently deleting account:', error);
      toast.error('Gagal menghapus akun');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Riwayat Akun Diarsipkan</CardTitle>
              <Badge variant="secondary">{archivedAccounts.length}</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari arsip..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Archive className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'Tidak ada arsip yang cocok' : 'Belum ada akun yang diarsipkan'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anggota</TableHead>
                    <TableHead>Tanggal Arsip</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead className="text-right">Data Keuangan</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {account.member_number || '-'} • {account.email || '-'}
                          </p>
                          {account.was_claimed && (
                            <Badge variant="outline" className="mt-1 text-xs">Pernah Diklaim</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(account.archived_at), 'dd MMM yyyy', { locale: id })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(account.archived_at), 'HH:mm', { locale: id })}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {account.archive_reason}
                        </Badge>
                        {account.days_since_creation !== null && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Usia akun: {account.days_since_creation} hari
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="font-mono text-sm font-medium">
                          {formatCurrency(account.total_simpanan || 0)}
                        </p>
                        {(account.outstanding_loan || 0) > 0 && (
                          <p className="text-xs text-destructive">
                            Pinjaman: {formatCurrency(account.outstanding_loan || 0)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetail(account)}
                            title="Lihat Detail"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRestoreClick(account)}
                            title="Aktifkan Kembali"
                            className="text-success hover:text-success hover:bg-success/10"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(account)}
                            title="Hapus Permanen"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Detail Akun Diarsipkan
            </DialogTitle>
            <DialogDescription>
              Data lengkap akun yang telah diarsipkan
            </DialogDescription>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Informasi Anggota</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Nama:</span> {selectedAccount.name}</p>
                      <p><span className="text-muted-foreground">No. Anggota:</span> {selectedAccount.member_number || '-'}</p>
                      <p><span className="text-muted-foreground">Email:</span> {selectedAccount.email || '-'}</p>
                      <p><span className="text-muted-foreground">Telepon:</span> {selectedAccount.phone || '-'}</p>
                      <p><span className="text-muted-foreground">Tgl Gabung:</span> {selectedAccount.join_date ? format(new Date(selectedAccount.join_date), 'dd MMM yyyy', { locale: id }) : '-'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Informasi Arsip</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Tanggal Arsip:</span> {format(new Date(selectedAccount.archived_at), 'dd MMM yyyy HH:mm', { locale: id })}</p>
                      <p><span className="text-muted-foreground">Alasan:</span> {selectedAccount.archive_reason}</p>
                      <p><span className="text-muted-foreground">Usia Akun:</span> {selectedAccount.days_since_creation || 0} hari</p>
                      <p><span className="text-muted-foreground">Status Klaim:</span> {selectedAccount.was_claimed ? 'Pernah Diklaim' : 'Tidak Pernah Diklaim'}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Financial Summary */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Data Keuangan Saat Diarsipkan</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Simpanan Pokok</p>
                      <p className="font-mono font-bold">{formatCurrency(selectedAccount.simpanan_pokok || 0)}</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Simpanan Wajib</p>
                      <p className="font-mono font-bold">{formatCurrency(selectedAccount.simpanan_wajib || 0)}</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Simpanan Sukarela</p>
                      <p className="font-mono font-bold">{formatCurrency(selectedAccount.simpanan_sukarela || 0)}</p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <p className="text-xs text-muted-foreground">Total Simpanan</p>
                      <p className="font-mono font-bold text-primary">{formatCurrency(selectedAccount.total_simpanan || 0)}</p>
                    </div>
                  </div>
                  {(selectedAccount.outstanding_loan || 0) > 0 && (
                    <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-destructive">Sisa Pinjaman: {formatCurrency(selectedAccount.outstanding_loan || 0)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Raw Data Info */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Data Backup Tersimpan</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={selectedAccount.original_profile_data ? 'default' : 'secondary'}>
                      Profil {selectedAccount.original_profile_data ? '✓' : '✗'}
                    </Badge>
                    <Badge variant={selectedAccount.original_savings_data ? 'default' : 'secondary'}>
                      Simpanan {selectedAccount.original_savings_data ? '✓' : '✗'}
                    </Badge>
                    <Badge variant={selectedAccount.original_loans_data ? 'default' : 'secondary'}>
                      Pinjaman {selectedAccount.original_loans_data ? '✓' : '✗'}
                    </Badge>
                    <Badge variant={selectedAccount.original_transactions_data ? 'default' : 'secondary'}>
                      Transaksi {selectedAccount.original_transactions_data ? '✓' : '✗'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Data lengkap tersimpan dalam format JSON untuk keperluan audit
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedAccount) handleRestoreClick(selectedAccount);
                setDetailOpen(false);
              }}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Aktifkan Kembali
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedAccount) handleDeleteClick(selectedAccount);
                setDetailOpen(false);
              }}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-success" />
              Aktifkan Kembali Akun?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {accountToAction && (
                <div className="space-y-3">
                  <p>
                    Akun <strong>{accountToAction.name}</strong> ({accountToAction.member_number || '-'}) akan diaktifkan kembali dengan data berikut:
                  </p>
                  <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                    <p>Simpanan Pokok: <strong>{formatCurrency(accountToAction.simpanan_pokok || 0)}</strong></p>
                    <p>Simpanan Wajib: <strong>{formatCurrency(accountToAction.simpanan_wajib || 0)}</strong></p>
                    <p>Simpanan Sukarela: <strong>{formatCurrency(accountToAction.simpanan_sukarela || 0)}</strong></p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Akun akan muncul kembali di daftar anggota dengan status belum diklaim.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={actionLoading}
              className="bg-success hover:bg-success/90"
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Aktifkan Kembali
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Hapus Permanen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {accountToAction && (
                <div className="space-y-3">
                  <p>
                    Anda akan menghapus <strong className="text-destructive">{accountToAction.name}</strong> secara permanen.
                  </p>
                  <div className="bg-destructive/10 p-3 rounded-lg text-sm space-y-1 border border-destructive/20">
                    <p className="font-medium text-destructive">⚠️ Peringatan:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li>Data arsip akan dihapus selamanya</li>
                      <li>Tidak dapat dikembalikan setelah dihapus</li>
                      <li>Riwayat backup profil, simpanan, dan transaksi akan hilang</li>
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Jurnal pembukuan yang sudah tercatat tetap tersimpan.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              disabled={actionLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
