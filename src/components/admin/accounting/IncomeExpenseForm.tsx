import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIncomeExpenseData } from '@/hooks/useIncomeExpenseEntries';
import { useHybridTransaction } from '@/hooks/useHybridTransaction';
import { useJournalEntries, JournalEntry, JournalEntryLineInput, JournalAuditLog } from '@/hooks/useJournalEntries';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { useBalanceSheets } from '@/hooks/useFinancialData';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { Plus, Trash2, TrendingUp, TrendingDown, AlertCircle, Loader2, Landmark, Gift, Building2, Wallet, BookOpen, CheckCircle2, Pencil, Save, History, Clock, User, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CapitalEntry {
  type: 'hibah' | 'pinjaman_diterima' | 'modal_penyertaan';
  description: string;
  amount: number;
  operation: 'tambah' | 'kurang';
}

interface EditLineState {
  account_id: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
}

interface IncomeExpenseFormProps {
  year: number;
}

export const IncomeExpenseForm = ({ year }: IncomeExpenseFormProps) => {
  const { incomeEntries, expenseEntries, loading: loadingEntries, refetch } = useIncomeExpenseData(year);
  const { createTransaction, deleteTransaction, loading: hybridLoading } = useHybridTransaction();
  const { getEntryWithLines, updateEntry, getAuditLogs, revertToVersion } = useJournalEntries();
  const { accounts } = useChartOfAccounts();
  const { sheets: balanceSheets, saveSheet } = useBalanceSheets();
  
  const [newIncome, setNewIncome] = useState({ description: '', amount: 0, category: 'lain' });
  const [newExpense, setNewExpense] = useState({ description: '', amount: 0, category: 'operasional' });
  const [newCapital, setNewCapital] = useState<CapitalEntry>({
    type: 'hibah',
    description: '',
    amount: 0,
    operation: 'tambah'
  });
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingCapital, setIsAddingCapital] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Journal detail dialog state
  const [showJournalDialog, setShowJournalDialog] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
  const [loadingJournal, setLoadingJournal] = useState(false);
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLines, setEditLines] = useState<EditLineState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Audit trail state
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [auditLogs, setAuditLogs] = useState<JournalAuditLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [revertingLogId, setRevertingLogId] = useState<string | null>(null);

  // Initialize edit form when entering edit mode
  useEffect(() => {
    if (isEditMode && selectedJournal) {
      setEditDescription(selectedJournal.description);
      setEditDate(selectedJournal.entry_date);
      setEditLines(selectedJournal.lines?.map(line => ({
        account_id: line.account_id,
        description: line.description || '',
        debit_amount: line.debit_amount,
        credit_amount: line.credit_amount
      })) || []);
    }
  }, [isEditMode, selectedJournal]);

  const handleViewJournal = async (entryId: string, referenceType: 'income_entry' | 'expense_entry') => {
    setLoadingJournal(true);
    setShowJournalDialog(true);
    setIsEditMode(false);
    
    // Find journal entry by reference
    const { data: journalData } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('reference_type', referenceType)
      .eq('reference_id', entryId)
      .maybeSingle();

    if (journalData) {
      const fullEntry = await getEntryWithLines(journalData.id);
      setSelectedJournal(fullEntry);
    }
    setLoadingJournal(false);
  };

const handleEditLine = (index: number, field: keyof EditLineState, value: string | number) => {
    const newLines = [...editLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setEditLines(newLines);
  };

  const handleAddEditLine = () => {
    setEditLines([
      ...editLines,
      {
        account_id: '',
        description: '',
        debit_amount: 0,
        credit_amount: 0
      }
    ]);
  };

  const handleRemoveEditLine = (index: number) => {
    if (editLines.length <= 2) {
      toast.error('Jurnal minimal harus memiliki 2 baris (debit dan kredit)');
      return;
    }
    setEditLines(editLines.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    if (!selectedJournal) return;

    const totalDebit = editLines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
    const totalCredit = editLines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast.error('Jurnal tidak seimbang! Total Debit harus sama dengan Total Kredit');
      return;
    }

    setIsSaving(true);

    const lines: JournalEntryLineInput[] = editLines.map(line => ({
      account_id: line.account_id,
      description: line.description,
      debit_amount: line.debit_amount,
      credit_amount: line.credit_amount
    }));

    const result = await updateEntry(selectedJournal.id, {
      entry_date: editDate,
      description: editDescription,
      lines
    });

    if (result) {
      // Refresh the journal view
      const fullEntry = await getEntryWithLines(selectedJournal.id);
      setSelectedJournal(fullEntry);
      setIsEditMode(false);
      await refetch();
    }

    setIsSaving(false);
  };

  const handleViewAuditTrail = async () => {
    if (!selectedJournal) return;
    
    setLoadingAuditLogs(true);
    setShowAuditTrail(true);
    
    const logs = await getAuditLogs(selectedJournal.id);
    setAuditLogs(logs);
    setLoadingAuditLogs(false);
  };

  const formatAuditDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return 'Dibuat';
      case 'updated': return 'Diubah';
      case 'deleted': return 'Dihapus';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'updated': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'deleted': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleRevert = async (log: JournalAuditLog) => {
    if (!selectedJournal || !log.old_data) return;
    
    // Confirm before reverting
    const confirmed = window.confirm(
      `Anda yakin ingin mengembalikan jurnal ke versi sebelum perubahan ini?\n\n` +
      `Waktu perubahan: ${formatAuditDate(log.changed_at)}\n` +
      `Ringkasan: ${log.change_summary || 'Tidak ada ringkasan'}`
    );
    
    if (!confirmed) return;
    
    setRevertingLogId(log.id);
    
    const result = await revertToVersion(selectedJournal.id, log.old_data as Record<string, unknown>);
    
    if (result) {
      // Refresh the journal view
      const fullEntry = await getEntryWithLines(selectedJournal.id);
      setSelectedJournal(fullEntry);
      
      // Refresh audit logs
      const logs = await getAuditLogs(selectedJournal.id);
      setAuditLogs(logs);
      
      await refetch();
    }
    
    setRevertingLogId(null);
  };

  const editTotalDebit = editLines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
  const editTotalCredit = editLines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
  const isEditBalanced = Math.abs(editTotalDebit - editTotalCredit) < 0.01;

  const incomes = incomeEntries.filter(i => i.year === year);
  const expenses = expenseEntries.filter(e => e.year === year);
  
  // Get current balance sheet for this year
  const currentBalanceSheet = balanceSheets.find(s => s.year === year);

  const handleAddIncome = async () => {
    if (!newIncome.description || !newIncome.amount) {
      toast.error('Lengkapi deskripsi dan jumlah');
      return;
    }

    setIsAddingIncome(true);
    
    const result = await createTransaction({
      type: 'income',
      description: newIncome.description,
      amount: newIncome.amount,
      year,
      incomeCategory: newIncome.category
    });

    if (result) {
      setNewIncome({ description: '', amount: 0, category: 'lain' });
      await refetch();
    }
    setIsAddingIncome(false);
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.amount) {
      toast.error('Lengkapi deskripsi dan jumlah');
      return;
    }

    setIsAddingExpense(true);
    
    const result = await createTransaction({
      type: 'expense',
      description: newExpense.description,
      amount: newExpense.amount,
      year,
      expenseCategory: newExpense.category
    });

    if (result) {
      setNewExpense({ description: '', amount: 0, category: 'operasional' });
      await refetch();
    }
    setIsAddingExpense(false);
  };

  const handleDeleteIncome = async (id: string) => {
    setDeletingId(id);
    const success = await deleteTransaction('income', id);
    if (success) {
      await refetch();
    }
    setDeletingId(null);
  };

  const handleDeleteExpense = async (id: string) => {
    setDeletingId(id);
    const success = await deleteTransaction('expense', id);
    if (success) {
      await refetch();
    }
    setDeletingId(null);
  };

  const handleAddCapital = async () => {
    if (!newCapital.description || !newCapital.amount) {
      toast.error('Lengkapi deskripsi dan jumlah');
      return;
    }

    setIsAddingCapital(true);
    
    try {
      // Get or create balance sheet for this year
      const baseSheet = currentBalanceSheet || {
        year,
        kasBank: 0,
        piutangUsaha: 0,
        totalAsetLancar: 0,
        pendapatanBungaPinjaman: 0,
        pendapatanDenda: 0,
        simpananPokok: 0,
        saldoAwalSimpananPokok: 0,
        penambahanSimpananPokok: 0,
        penguranganSimpananPokok: 0,
        simpananWajib: 0,
        saldoAwalSimpananWajib: 0,
        penambahanSimpananWajib: 0,
        penguranganSimpananWajib: 0,
        simpananSukarela: 0,
        saldoAwalSimpananSukarela: 0,
        penambahanSimpananSukarela: 0,
        penguranganSimpananSukarela: 0,
        danaCadangan: 0,
        saldoAwalDanaCadangan: 0,
        penambahanDanaCadangan: 0,
        penguranganDanaCadangan: 0,
        hibahDonasi: 0,
        saldoAwalHibahDonasi: 0,
        penambahanHibahDonasi: 0,
        penguranganHibahDonasi: 0,
        pinjamanDiterima: 0,
        saldoAwalPinjamanDiterima: 0,
        penambahanPinjamanDiterima: 0,
        penguranganPinjamanDiterima: 0,
        modalPenyertaan: 0,
        saldoAwalModalPenyertaan: 0,
        penambahanModalPenyertaan: 0,
        penguranganModalPenyertaan: 0,
        totalHartaKoperasi: 0,
        totalSaldoAwal: 0,
        totalPenambahan: 0,
        totalPengurangan: 0,
      };

      const updatedSheet = { ...baseSheet };
      const amount = newCapital.amount;
      const isTambah = newCapital.operation === 'tambah';

      // Update the appropriate field based on capital type
      switch (newCapital.type) {
        case 'hibah':
          if (isTambah) {
            updatedSheet.penambahanHibahDonasi += amount;
          } else {
            updatedSheet.penguranganHibahDonasi += amount;
          }
          updatedSheet.hibahDonasi = updatedSheet.saldoAwalHibahDonasi + updatedSheet.penambahanHibahDonasi - updatedSheet.penguranganHibahDonasi;
          break;
        case 'pinjaman_diterima':
          if (isTambah) {
            updatedSheet.penambahanPinjamanDiterima += amount;
          } else {
            updatedSheet.penguranganPinjamanDiterima += amount;
          }
          updatedSheet.pinjamanDiterima = updatedSheet.saldoAwalPinjamanDiterima + updatedSheet.penambahanPinjamanDiterima - updatedSheet.penguranganPinjamanDiterima;
          break;
        case 'modal_penyertaan':
          if (isTambah) {
            updatedSheet.penambahanModalPenyertaan += amount;
          } else {
            updatedSheet.penguranganModalPenyertaan += amount;
          }
          updatedSheet.modalPenyertaan = updatedSheet.saldoAwalModalPenyertaan + updatedSheet.penambahanModalPenyertaan - updatedSheet.penguranganModalPenyertaan;
          break;
      }

      // Recalculate totals
      updatedSheet.totalPenambahan = 
        updatedSheet.penambahanSimpananPokok + 
        updatedSheet.penambahanSimpananWajib + 
        updatedSheet.penambahanSimpananSukarela +
        updatedSheet.penambahanDanaCadangan + 
        updatedSheet.penambahanHibahDonasi + 
        updatedSheet.penambahanPinjamanDiterima + 
        updatedSheet.penambahanModalPenyertaan;

      updatedSheet.totalPengurangan = 
        updatedSheet.penguranganSimpananPokok + 
        updatedSheet.penguranganSimpananWajib + 
        updatedSheet.penguranganSimpananSukarela +
        updatedSheet.penguranganDanaCadangan + 
        updatedSheet.penguranganHibahDonasi + 
        updatedSheet.penguranganPinjamanDiterima + 
        updatedSheet.penguranganModalPenyertaan;

      updatedSheet.totalHartaKoperasi = 
        updatedSheet.simpananPokok + 
        updatedSheet.simpananWajib + 
        updatedSheet.simpananSukarela +
        updatedSheet.danaCadangan + 
        updatedSheet.hibahDonasi + 
        updatedSheet.pinjamanDiterima + 
        updatedSheet.modalPenyertaan;

      await saveSheet(updatedSheet);
      
      setNewCapital({
        type: 'hibah',
        description: '',
        amount: 0,
        operation: 'tambah'
      });
      
      const typeLabel = newCapital.type === 'hibah' ? 'Hibah' : 
                       newCapital.type === 'pinjaman_diterima' ? 'Pinjaman Diterima' : 'Modal Penyertaan';
      const opLabel = isTambah ? 'ditambahkan' : 'dikurangi';
      toast.success(`${typeLabel} berhasil ${opLabel}`);
    } catch (error) {
      toast.error('Gagal menyimpan data modal');
    }
    
    setIsAddingCapital(false);
  };

  const totalManualIncome = incomes.filter(i => i.type === 'manual').reduce((sum, i) => sum + i.amount, 0);
  const totalManualExpense = expenses.filter(e => e.type === 'manual').reduce((sum, e) => sum + e.amount, 0);

  const isLoading = loadingEntries;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">Input Pendapatan, Biaya & Modal</h2>
        <p className="text-muted-foreground">Tahun Buku {year}</p>
      </div>

      {/* Hybrid System Info */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              <strong>Sistem Hybrid Aktif:</strong> Setiap input pendapatan/beban akan otomatis membuat jurnal entry sesuai standar akuntansi double-entry
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>
              Pendapatan bunga pinjaman, denda, dan biaya bunga simpanan dihitung otomatis dari data transaksi
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="income" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="income" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Pendapatan
          </TabsTrigger>
          <TabsTrigger value="expense" className="gap-2">
            <TrendingDown className="h-4 w-4" />
            Biaya
          </TabsTrigger>
          <TabsTrigger value="capital" className="gap-2">
            <Landmark className="h-4 w-4" />
            Modal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="space-y-4 mt-4">
          {/* Add Income Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                Tambah Pendapatan
                <Badge variant="outline" className="text-xs font-normal gap-1">
                  <BookOpen className="h-3 w-3" />
                  Auto Jurnal
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select 
                    value={newIncome.category} 
                    onValueChange={(value) => setNewIncome({ ...newIncome, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Pendapatan Administrasi</SelectItem>
                      <SelectItem value="jasa">Pendapatan Jasa</SelectItem>
                      <SelectItem value="lain">Pendapatan Lain-lain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deskripsi</Label>
                  <Input 
                    value={newIncome.description}
                    onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
                    placeholder="Contoh: Pendapatan jasa admin"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jumlah</Label>
                  <CurrencyInput 
                    value={newIncome.amount}
                    onChange={(value) => setNewIncome({ ...newIncome, amount: value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                <BookOpen className="h-3 w-3" />
                <span>Jurnal: Debit Kas → Kredit Akun Pendapatan</span>
              </div>
              <Button onClick={handleAddIncome} disabled={isAddingIncome || hybridLoading} className="gap-2">
                {isAddingIncome ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Tambah Pendapatan
              </Button>
            </CardContent>
          </Card>

          {/* Income List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Daftar Pendapatan Manual</span>
                <span className="text-green-600">{formatCurrency(totalManualIncome)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incomes.filter(i => i.type === 'manual').length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Belum ada pendapatan manual
                </p>
              ) : (
                <div className="space-y-2">
                  {incomes.filter(i => i.type === 'manual').map(income => (
                    <div 
                      key={income.id} 
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{income.description}</p>
                          {income.journal_entry_number && (
                            <Badge 
                              variant="secondary" 
                              className="text-xs gap-1 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                              onClick={() => handleViewJournal(income.id, 'income_entry')}
                            >
                              <BookOpen className="h-3 w-3" />
                              {income.journal_entry_number}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(income.date)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-green-600">
                          {formatCurrency(income.amount)}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteIncome(income.id)}
                          disabled={deletingId === income.id}
                        >
                          {deletingId === income.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expense" className="space-y-4 mt-4">
          {/* Add Expense Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                Tambah Biaya Operasional
                <Badge variant="outline" className="text-xs font-normal gap-1">
                  <BookOpen className="h-3 w-3" />
                  Auto Jurnal
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select 
                    value={newExpense.category} 
                    onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operasional">Beban Operasional</SelectItem>
                      <SelectItem value="admin">Beban Administrasi</SelectItem>
                      <SelectItem value="lain">Beban Lain-lain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deskripsi</Label>
                  <Input 
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    placeholder="Contoh: Biaya ATK"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jumlah</Label>
                  <CurrencyInput 
                    value={newExpense.amount}
                    onChange={(value) => setNewExpense({ ...newExpense, amount: value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                <BookOpen className="h-3 w-3" />
                <span>Jurnal: Debit Akun Beban → Kredit Kas</span>
              </div>
              <Button onClick={handleAddExpense} disabled={isAddingExpense || hybridLoading} className="gap-2">
                {isAddingExpense ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Tambah Biaya
              </Button>
            </CardContent>
          </Card>

          {/* Expense List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Daftar Biaya Operasional</span>
                <span className="text-red-600">{formatCurrency(totalManualExpense)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expenses.filter(e => e.type === 'manual').length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Belum ada biaya operasional
                </p>
              ) : (
                <div className="space-y-2">
                  {expenses.filter(e => e.type === 'manual').map(expense => (
                    <div 
                      key={expense.id} 
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{expense.description}</p>
                          {expense.journal_entry_number && (
                            <Badge 
                              variant="secondary" 
                              className="text-xs gap-1 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                              onClick={() => handleViewJournal(expense.id, 'expense_entry')}
                            >
                              <BookOpen className="h-3 w-3" />
                              {expense.journal_entry_number}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(expense.date)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-red-600">
                          {formatCurrency(expense.amount)}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteExpense(expense.id)}
                          disabled={deletingId === expense.id}
                        >
                          {deletingId === expense.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Capital Input Tab */}
        <TabsContent value="capital" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Input Modal Koperasi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Capital Type Selection */}
              <div className="space-y-2">
                <Label>Jenis Modal</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={newCapital.type === 'hibah' ? 'default' : 'outline'}
                    className="gap-2 h-auto py-3 flex-col"
                    onClick={() => setNewCapital({ ...newCapital, type: 'hibah' })}
                  >
                    <Gift className="h-5 w-5" />
                    <span className="text-xs">Hibah/Donasi</span>
                  </Button>
                  <Button
                    type="button"
                    variant={newCapital.type === 'pinjaman_diterima' ? 'default' : 'outline'}
                    className="gap-2 h-auto py-3 flex-col"
                    onClick={() => setNewCapital({ ...newCapital, type: 'pinjaman_diterima' })}
                  >
                    <Building2 className="h-5 w-5" />
                    <span className="text-xs">Pinjaman Diterima</span>
                  </Button>
                  <Button
                    type="button"
                    variant={newCapital.type === 'modal_penyertaan' ? 'default' : 'outline'}
                    className="gap-2 h-auto py-3 flex-col"
                    onClick={() => setNewCapital({ ...newCapital, type: 'modal_penyertaan' })}
                  >
                    <Wallet className="h-5 w-5" />
                    <span className="text-xs">Modal Penyertaan</span>
                  </Button>
                </div>
              </div>

              {/* Operation Type */}
              <div className="space-y-2">
                <Label>Operasi</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={newCapital.operation === 'tambah' ? 'default' : 'outline'}
                    className="gap-2"
                    onClick={() => setNewCapital({ ...newCapital, operation: 'tambah' })}
                  >
                    <Plus className="h-4 w-4" />
                    Penambahan
                  </Button>
                  <Button
                    type="button"
                    variant={newCapital.operation === 'kurang' ? 'destructive' : 'outline'}
                    className="gap-2"
                    onClick={() => setNewCapital({ ...newCapital, operation: 'kurang' })}
                  >
                    <TrendingDown className="h-4 w-4" />
                    Pengurangan
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Keterangan</Label>
                  <Input 
                    value={newCapital.description}
                    onChange={(e) => setNewCapital({ ...newCapital, description: e.target.value })}
                    placeholder={
                      newCapital.type === 'hibah' ? 'Contoh: Donasi dari Pemda' :
                      newCapital.type === 'pinjaman_diterima' ? 'Contoh: Pinjaman dari Bank' :
                      'Contoh: Penyertaan modal anggota'
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jumlah</Label>
                  <CurrencyInput 
                    value={newCapital.amount}
                    onChange={(value) => setNewCapital({ ...newCapital, amount: value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <Button onClick={handleAddCapital} disabled={isAddingCapital} className="gap-2">
                {isAddingCapital ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Simpan {newCapital.operation === 'tambah' ? 'Penambahan' : 'Pengurangan'} Modal
              </Button>
            </CardContent>
          </Card>

          {/* Current Capital Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ringkasan Modal Tahun {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Gift className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="font-medium">Hibah/Donasi</p>
                      <p className="text-xs text-muted-foreground">
                        +{formatCurrency(currentBalanceSheet?.penambahanHibahDonasi || 0)} / 
                        -{formatCurrency(currentBalanceSheet?.penguranganHibahDonasi || 0)}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-primary">
                    {formatCurrency(currentBalanceSheet?.hibahDonasi || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Pinjaman Diterima</p>
                      <p className="text-xs text-muted-foreground">
                        +{formatCurrency(currentBalanceSheet?.penambahanPinjamanDiterima || 0)} / 
                        -{formatCurrency(currentBalanceSheet?.penguranganPinjamanDiterima || 0)}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-primary">
                    {formatCurrency(currentBalanceSheet?.pinjamanDiterima || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Modal Penyertaan</p>
                      <p className="text-xs text-muted-foreground">
                        +{formatCurrency(currentBalanceSheet?.penambahanModalPenyertaan || 0)} / 
                        -{formatCurrency(currentBalanceSheet?.penguranganModalPenyertaan || 0)}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-primary">
                    {formatCurrency(currentBalanceSheet?.modalPenyertaan || 0)}
                  </span>
                </div>

                <div className="border-t pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total Modal Lainnya</span>
                    <span className="font-bold text-lg text-primary">
                      {formatCurrency(
                        (currentBalanceSheet?.hibahDonasi || 0) +
                        (currentBalanceSheet?.pinjamanDiterima || 0) +
                        (currentBalanceSheet?.modalPenyertaan || 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Journal Detail Dialog */}
      <Dialog open={showJournalDialog} onOpenChange={(open) => {
        setShowJournalDialog(open);
        if (!open) setIsEditMode(false);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {isEditMode ? 'Edit Jurnal' : 'Detail Jurnal'} {selectedJournal?.entry_number}
              </div>
              {!isEditMode && selectedJournal && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleViewAuditTrail}
                  >
                    <History className="h-4 w-4" />
                    Riwayat
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsEditMode(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {loadingJournal ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedJournal ? (
            <div className="space-y-4">
              {/* Journal Header Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Nomor Jurnal</p>
                  <p className="font-medium">{selectedJournal.entry_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tanggal</p>
                  {isEditMode ? (
                    <Input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="h-8"
                    />
                  ) : (
                    <p className="font-medium">{formatDate(selectedJournal.entry_date)}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Keterangan</p>
                  {isEditMode ? (
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Keterangan jurnal"
                    />
                  ) : (
                    <p className="font-medium">{selectedJournal.description}</p>
                  )}
                </div>
              </div>

              {/* Journal Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Detail Transaksi</h4>
                  {isEditMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={handleAddEditLine}
                    >
                      <Plus className="h-3 w-3" />
                      Tambah Baris
                    </Button>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Akun</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Kredit</TableHead>
                      {isEditMode && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isEditMode ? (
                      editLines.map((line, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Select
                              value={line.account_id}
                              onValueChange={(value) => handleEditLine(index, 'account_id', value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Pilih akun" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.filter(a => a.is_active).map(account => (
                                  <SelectItem key={account.id} value={account.id}>
                                    {account.account_code} - {account.account_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <CurrencyInput
                              value={line.debit_amount}
                              onChange={(value) => handleEditLine(index, 'debit_amount', value)}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <CurrencyInput
                              value={line.credit_amount}
                              onChange={(value) => handleEditLine(index, 'credit_amount', value)}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveEditLine(index)}
                              disabled={editLines.length <= 2}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      selectedJournal.lines?.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <span className="font-mono text-sm">{line.account?.account_code}</span>
                            <span className="ml-2 text-muted-foreground">{line.account?.account_name}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            {line.debit_amount > 0 ? (
                              <span className="text-green-600 font-medium">
                                {formatCurrency(line.debit_amount)}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {line.credit_amount > 0 ? (
                              <span className="text-blue-600 font-medium">
                                {formatCurrency(line.credit_amount)}
                              </span>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="flex justify-end gap-8 p-3 bg-muted/30 rounded-lg">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total Debit</p>
                  <p className="font-bold text-green-600">
                    {formatCurrency(isEditMode ? editTotalDebit : selectedJournal.total_debit)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total Kredit</p>
                  <p className="font-bold text-blue-600">
                    {formatCurrency(isEditMode ? editTotalCredit : selectedJournal.total_credit)}
                  </p>
                </div>
              </div>

              {/* Balance Indicator */}
              <div className={`flex items-center justify-center gap-2 p-2 rounded ${
                (isEditMode ? isEditBalanced : selectedJournal.is_balanced)
                  ? 'bg-green-500/10 text-green-600' 
                  : 'bg-red-500/10 text-red-600'
              }`}>
                {(isEditMode ? isEditBalanced : selectedJournal.is_balanced) ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Jurnal Seimbang (Balanced)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Jurnal Tidak Seimbang!</span>
                  </>
                )}
              </div>

              {/* Edit Mode Actions */}
              {isEditMode && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditMode(false)}
                    disabled={isSaving}
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !isEditBalanced}
                    className="gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Simpan Perubahan
                  </Button>
                </DialogFooter>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Jurnal tidak ditemukan
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Audit Trail Dialog */}
      <Dialog open={showAuditTrail} onOpenChange={setShowAuditTrail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Riwayat Perubahan Jurnal {selectedJournal?.entry_number}
            </DialogTitle>
          </DialogHeader>
          
          {loadingAuditLogs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Belum ada riwayat perubahan</p>
            </div>
          ) : (
            <div className="space-y-4">
              {auditLogs.map((log, index) => (
                <div 
                  key={log.id} 
                  className="relative pl-6 pb-4 border-l-2 border-muted last:pb-0"
                >
                  {/* Timeline dot */}
                  <div className={`absolute -left-2 top-0 w-4 h-4 rounded-full border-2 ${
                    log.action === 'created' ? 'bg-green-500 border-green-500' :
                    log.action === 'updated' ? 'bg-blue-500 border-blue-500' :
                    'bg-red-500 border-red-500'
                  }`} />
                  
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <Badge 
                        variant="outline" 
                        className={getActionColor(log.action)}
                      >
                        {getActionLabel(log.action)}
                      </Badge>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatAuditDate(log.changed_at)}
                      </div>
                    </div>
                    
                    {/* User */}
                    {log.changer && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Oleh:</span>
                        <span className="font-medium">{log.changer.name}</span>
                      </div>
                    )}
                    
                    {/* Summary */}
                    {log.change_summary && (
                      <div className="p-2 bg-muted/50 rounded text-sm">
                        {log.change_summary}
                      </div>
                    )}
                    
                    {/* Detailed changes for updates */}
                    {log.action === 'updated' && log.old_data && log.new_data && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-red-500/5 rounded border border-red-500/10">
                          <p className="font-medium text-red-600 mb-1">Sebelum</p>
                          <p>Total: {formatCurrency((log.old_data as Record<string, unknown>).total_debit as number || 0)}</p>
                          <p>Baris: {((log.old_data as Record<string, unknown>).lines as unknown[] || []).length}</p>
                        </div>
                        <div className="p-2 bg-green-500/5 rounded border border-green-500/10">
                          <p className="font-medium text-green-600 mb-1">Sesudah</p>
                          <p>Total: {formatCurrency((log.new_data as Record<string, unknown>).total_debit as number || 0)}</p>
                          <p>Baris: {((log.new_data as Record<string, unknown>).lines as unknown[] || []).length}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Revert button for updated entries */}
                    {log.action === 'updated' && log.old_data && (log.old_data as Record<string, unknown>).lines && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 mt-2"
                        onClick={() => handleRevert(log)}
                        disabled={revertingLogId === log.id}
                      >
                        {revertingLogId === log.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        Kembalikan ke Versi Ini
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
