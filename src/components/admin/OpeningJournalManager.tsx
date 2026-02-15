import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BookOpen, 
  Loader2, 
  Eye, 
  Pencil, 
  Trash2, 
  AlertCircle, 
  Check,
  X,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface JournalEntryLine {
  id: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description: string | null;
  account?: {
    id: string;
    account_code: string;
    account_name: string;
  };
}

interface OpeningJournal {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  status: string;
  created_at: string;
  lines?: JournalEntryLine[];
}

interface OpeningJournalManagerProps {
  migrationYear: number;
  onJournalDeleted?: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

export const OpeningJournalManager = ({ migrationYear, onJournalDeleted }: OpeningJournalManagerProps) => {
  const [journals, setJournals] = useState<OpeningJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJournal, setSelectedJournal] = useState<OpeningJournal | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Edit form state
  const [editLines, setEditLines] = useState<JournalEntryLine[]>([]);
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  
  const { accounts } = useChartOfAccounts();

  const fetchOpeningJournals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('reference_type', 'opening_balance')
        .gte('entry_date', `${migrationYear}-01-01`)
        .lte('entry_date', `${migrationYear}-12-31`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJournals(data || []);
    } catch (error) {
      console.error('Error fetching opening journals:', error);
      toast.error('Gagal mengambil data jurnal pembuka');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpeningJournals();
  }, [migrationYear]);

  const fetchJournalLines = async (journalId: string): Promise<JournalEntryLine[]> => {
    const { data, error } = await supabase
      .from('journal_entry_lines')
      .select(`
        *,
        account:chart_of_accounts(id, account_code, account_name)
      `)
      .eq('journal_entry_id', journalId)
      .order('created_at');

    if (error) {
      console.error('Error fetching journal lines:', error);
      return [];
    }

    return (data || []).map(line => ({
      ...line,
      account: line.account || undefined
    }));
  };

  const handleView = async (journal: OpeningJournal) => {
    const lines = await fetchJournalLines(journal.id);
    setSelectedJournal({ ...journal, lines });
    setIsViewDialogOpen(true);
  };

  const handleEdit = async (journal: OpeningJournal) => {
    const lines = await fetchJournalLines(journal.id);
    setSelectedJournal({ ...journal, lines });
    setEditLines(lines);
    setEditDescription(journal.description);
    setEditDate(journal.entry_date);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (journal: OpeningJournal) => {
    setSelectedJournal(journal);
    setIsDeleteDialogOpen(true);
  };

  const updateEditLine = (index: number, field: 'account_id' | 'debit_amount' | 'credit_amount', value: string | number) => {
    const newLines = [...editLines];
    if (field === 'debit_amount' || field === 'credit_amount') {
      newLines[index] = { ...newLines[index], [field]: Number(value) || 0 };
    } else {
      newLines[index] = { ...newLines[index], [field]: value as string };
    }
    setEditLines(newLines);
  };

  const addEditLine = () => {
    setEditLines([...editLines, {
      id: crypto.randomUUID(),
      account_id: '',
      debit_amount: 0,
      credit_amount: 0,
      description: null
    }]);
  };

  const removeEditLine = (index: number) => {
    if (editLines.length <= 2) {
      toast.error('Jurnal minimal harus memiliki 2 baris');
      return;
    }
    setEditLines(editLines.filter((_, i) => i !== index));
  };

  const totalEditDebit = editLines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
  const totalEditCredit = editLines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
  const isEditBalanced = Math.abs(totalEditDebit - totalEditCredit) < 1;

  const handleSaveEdit = async () => {
    if (!selectedJournal) return;

    if (!isEditBalanced) {
      toast.error('Jurnal tidak seimbang! Total Debit harus sama dengan Total Kredit');
      return;
    }

    const validLines = editLines.filter(l => l.account_id && (l.debit_amount || l.credit_amount));
    if (validLines.length < 2) {
      toast.error('Minimal 2 baris jurnal dengan akun dan nominal');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get existing lines to reverse account balances
      const existingLines = await fetchJournalLines(selectedJournal.id);
      
      // Reverse old account balances
      for (const line of existingLines) {
        const { data: account } = await supabase
          .from('chart_of_accounts')
          .select('balance, account_type')
          .eq('id', line.account_id)
          .single();

        if (account) {
          let newBalance = account.balance;
          if (['asset', 'expense'].includes(account.account_type)) {
            newBalance -= (line.debit_amount || 0) - (line.credit_amount || 0);
          } else {
            newBalance -= (line.credit_amount || 0) - (line.debit_amount || 0);
          }

          await supabase
            .from('chart_of_accounts')
            .update({ balance: newBalance })
            .eq('id', line.account_id);
        }
      }

      // Delete old lines
      await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('journal_entry_id', selectedJournal.id);

      // Update journal entry
      const { error: updateError } = await supabase
        .from('journal_entries')
        .update({
          entry_date: editDate,
          description: editDescription,
          total_debit: totalEditDebit,
          total_credit: totalEditCredit,
          is_balanced: isEditBalanced,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedJournal.id);

      if (updateError) throw updateError;

      // Insert new lines
      const newLines = validLines.map(line => ({
        journal_entry_id: selectedJournal.id,
        account_id: line.account_id,
        description: `Saldo Awal`,
        debit_amount: line.debit_amount || 0,
        credit_amount: line.credit_amount || 0
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(newLines);

      if (linesError) throw linesError;

      // Apply new account balances
      for (const line of validLines) {
        const { data: account } = await supabase
          .from('chart_of_accounts')
          .select('balance, account_type')
          .eq('id', line.account_id)
          .single();

        if (account) {
          let newBalance = account.balance;
          if (['asset', 'expense'].includes(account.account_type)) {
            newBalance += (line.debit_amount || 0) - (line.credit_amount || 0);
          } else {
            newBalance += (line.credit_amount || 0) - (line.debit_amount || 0);
          }

          await supabase
            .from('chart_of_accounts')
            .update({ balance: newBalance })
            .eq('id', line.account_id);
        }
      }

      toast.success('Jurnal pembuka berhasil diperbarui');
      setIsEditDialogOpen(false);
      fetchOpeningJournals();
    } catch (error) {
      console.error('Error updating opening journal:', error);
      toast.error('Gagal memperbarui jurnal pembuka');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedJournal) return;

    setIsSubmitting(true);
    try {
      // Get lines first to reverse the balances
      const lines = await fetchJournalLines(selectedJournal.id);

      // Reverse account balances
      for (const line of lines) {
        const { data: account } = await supabase
          .from('chart_of_accounts')
          .select('balance, account_type')
          .eq('id', line.account_id)
          .single();

        if (account) {
          let newBalance = account.balance;
          if (['asset', 'expense'].includes(account.account_type)) {
            newBalance -= (line.debit_amount || 0) - (line.credit_amount || 0);
          } else {
            newBalance -= (line.credit_amount || 0) - (line.debit_amount || 0);
          }

          await supabase
            .from('chart_of_accounts')
            .update({ balance: newBalance })
            .eq('id', line.account_id);
        }
      }

      // Delete journal lines first
      await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('journal_entry_id', selectedJournal.id);

      // Delete the journal entry
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', selectedJournal.id);

      if (error) throw error;

      toast.success('Jurnal pembuka berhasil dihapus');
      setIsDeleteDialogOpen(false);
      fetchOpeningJournals();
      onJournalDeleted?.();
    } catch (error) {
      console.error('Error deleting opening journal:', error);
      toast.error('Gagal menghapus jurnal pembuka');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-muted-foreground">Memuat jurnal pembuka...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (journals.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">Belum ada jurnal pembuka untuk tahun {migrationYear}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Jurnal pembuka akan otomatis dibuat saat data migrasi disimpan.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Jurnal Pembuka Tahun {migrationYear}
              </CardTitle>
              <CardDescription>
                Kelola jurnal pembuka yang sudah dibuat dari proses migrasi
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchOpeningJournals} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Jurnal</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journals.map((journal) => (
                  <TableRow key={journal.id}>
                    <TableCell className="font-mono text-sm">{journal.entry_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(journal.entry_date), 'dd MMM yyyy', { locale: idLocale })}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{journal.description}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(journal.total_debit)}
                    </TableCell>
                    <TableCell className="text-center">
                      {journal.is_balanced ? (
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                          <Check className="h-3 w-3 mr-1" />
                          Seimbang
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <X className="h-3 w-3 mr-1" />
                          Tidak Seimbang
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleView(journal)} title="Lihat Detail">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(journal)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(journal)} title="Hapus" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Detail Jurnal Pembuka
            </DialogTitle>
            <DialogDescription>
              {selectedJournal?.entry_number} - {selectedJournal?.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedJournal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Tanggal:</span>
                  <span className="ml-2 font-medium">
                    {format(new Date(selectedJournal.entry_date), 'dd MMMM yyyy', { locale: idLocale })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <span className="ml-2">
                    {selectedJournal.is_balanced ? (
                      <Badge variant="outline" className="bg-green-100 text-green-700">Seimbang</Badge>
                    ) : (
                      <Badge variant="destructive">Tidak Seimbang</Badge>
                    )}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode Akun</TableHead>
                      <TableHead>Nama Akun</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Kredit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedJournal.lines?.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-mono">{line.account?.account_code || '-'}</TableCell>
                        <TableCell>{line.account?.account_name || '-'}</TableCell>
                        <TableCell className="text-right">
                          {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={2} className="text-right">TOTAL</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedJournal.total_debit)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedJournal.total_credit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Jurnal Pembuka
            </DialogTitle>
            <DialogDescription>
              Perbarui data jurnal pembuka {selectedJournal?.entry_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Keterangan</Label>
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Keterangan jurnal"
                />
              </div>
            </div>

            <div className="rounded-lg border overflow-auto max-h-[400px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-[250px]">Akun</TableHead>
                    <TableHead className="text-right w-[150px]">Debit</TableHead>
                    <TableHead className="text-right w-[150px]">Kredit</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editLines.map((line, index) => (
                    <TableRow key={line.id || index}>
                      <TableCell>
                        <Select
                          value={line.account_id}
                          onValueChange={(v) => updateEditLine(index, 'account_id', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih akun" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.account_code} - {acc.account_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.debit_amount || ''}
                          onChange={(e) => updateEditLine(index, 'debit_amount', e.target.value)}
                          placeholder="0"
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.credit_amount || ''}
                          onChange={(e) => updateEditLine(index, 'credit_amount', e.target.value)}
                          placeholder="0"
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEditLine(index)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button variant="outline" size="sm" onClick={addEditLine} className="gap-2">
              + Tambah Baris
            </Button>

            <Card className={isEditBalanced ? 'bg-green-50 dark:bg-green-900/20 border-green-300' : 'bg-destructive/10 border-destructive/30'}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isEditBalanced ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className="font-medium">
                      {isEditBalanced ? 'Jurnal Seimbang' : 'Jurnal Tidak Seimbang'}
                    </span>
                  </div>
                  <div className="text-right text-sm">
                    <div>Debit: {formatCurrency(totalEditDebit)}</div>
                    <div>Kredit: {formatCurrency(totalEditCredit)}</div>
                    {!isEditBalanced && (
                      <div className="text-destructive font-medium">
                        Selisih: {formatCurrency(Math.abs(totalEditDebit - totalEditCredit))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSubmitting || !isEditBalanced}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Perubahan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Konfirmasi Hapus
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus jurnal pembuka ini?
            </DialogDescription>
          </DialogHeader>
          
          {selectedJournal && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">{selectedJournal.entry_number}</p>
                <p className="text-sm">{selectedJournal.description}</p>
                <p className="text-sm mt-1">Total: {formatCurrency(selectedJournal.total_debit)}</p>
                <p className="text-sm mt-2 text-muted-foreground">
                  Saldo akun yang terkait akan dikembalikan ke nilai sebelum jurnal ini dibuat.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Ya, Hapus'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
