import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Download, Upload, Check, X,
  Loader2, CreditCard, Calendar, BookOpen, Eye, Play,
  ChevronDown, HelpCircle, History, ArrowLeft
} from 'lucide-react';
import { ExcelDropZone } from './ExcelDropZone';
import { useInstallmentMigration } from '@/hooks/useInstallmentMigration';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { formatCurrency } from '@/lib/mockData';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import type { InstallmentMigrationEntry, LoanWithInstallmentMigrationEntry, MigrationJournalMode } from '@/lib/types';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InstallmentMigrationProps {
  onBack?: () => void;
}

export default function InstallmentMigration({ onBack }: InstallmentMigrationProps) {
  const [activeTab, setActiveTab] = useState('existing');
  const [journalMode, setJournalMode] = useState<MigrationJournalMode>('per_batch');
  const [debitAccountId, setDebitAccountId] = useState<string>('');
  
  // Existing loan migration state
  const [existingEntries, setExistingEntries] = useState<InstallmentMigrationEntry[]>([]);
  const [existingFile, setExistingFile] = useState<File | null>(null);
  const [isParsingExisting, setIsParsingExisting] = useState(false);
  const [isImportingExisting, setIsImportingExisting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  // New loan migration state
  const [newLoanEntries, setNewLoanEntries] = useState<LoanWithInstallmentMigrationEntry[]>([]);
  const [newLoanFile, setNewLoanFile] = useState<File | null>(null);
  const [isParsingNew, setIsParsingNew] = useState(false);
  const [isImportingNew, setIsImportingNew] = useState(false);
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const {
    loading,
    activeLoans,
    migrationHistory,
    fetchActiveLoans,
    fetchMigrationHistory,
    downloadInstallmentTemplate,
    downloadLoanWithInstallmentTemplate,
    parseInstallmentExcel,
    parseLoanWithInstallmentExcel,
    bulkImportInstallments,
    bulkImportLoansWithInstallments,
  } = useInstallmentMigration();

  const { accounts, loading: accountsLoading } = useChartOfAccounts();

  // Filter asset accounts for debit selection
  const debitAccounts = accounts.filter(a => 
    a.is_active && 
    (a.account_type === 'asset') &&
    (a.account_name.toLowerCase().includes('kas') || a.account_name.toLowerCase().includes('bank'))
  );

  useEffect(() => {
    fetchActiveLoans();
  }, [fetchActiveLoans]);

  // Fetch history when history tab is active
  useEffect(() => {
    if (activeTab === 'history') {
      fetchMigrationHistory();
    }
  }, [activeTab, fetchMigrationHistory]);

  useEffect(() => {
    // Set default debit account
    if (debitAccounts.length > 0 && !debitAccountId) {
      const kasAccount = debitAccounts.find(a => a.account_name.toLowerCase().includes('kas'));
      setDebitAccountId(kasAccount?.id || debitAccounts[0].id);
    }
  }, [debitAccounts, debitAccountId]);

  // Handle file upload for existing loan installments
  const handleExistingFileUpload = useCallback(async (file: File) => {
    setExistingFile(file);
    setIsParsingExisting(true);
    setExistingEntries([]);
    
    try {
      const entries = await parseInstallmentExcel(file);
      setExistingEntries(entries);
      setShowPreview(true);
      
      const validCount = entries.filter(e => e.isValid).length;
      const invalidCount = entries.length - validCount;
      
      toast.success(`${entries.length} baris data ditemukan (${validCount} valid, ${invalidCount} error)`);
    } catch (error: any) {
      toast.error(`Gagal membaca file: ${error.message}`);
    } finally {
      setIsParsingExisting(false);
    }
  }, [parseInstallmentExcel]);

  // Handle file upload for new loans
  const handleNewLoanFileUpload = useCallback(async (file: File) => {
    setNewLoanFile(file);
    setIsParsingNew(true);
    setNewLoanEntries([]);
    
    try {
      const entries = await parseLoanWithInstallmentExcel(file);
      setNewLoanEntries(entries);
      setShowPreview(true);
      
      const validCount = entries.filter(e => e.isValid).length;
      const invalidCount = entries.length - validCount;
      
      toast.success(`${entries.length} pinjaman ditemukan (${validCount} valid, ${invalidCount} error)`);
    } catch (error: any) {
      toast.error(`Gagal membaca file: ${error.message}`);
    } finally {
      setIsParsingNew(false);
    }
  }, [parseLoanWithInstallmentExcel]);

  // Import existing installment payments
  const handleImportExisting = async () => {
    if (!debitAccountId) {
      toast.error('Pilih akun debit terlebih dahulu');
      return;
    }

    const validEntries = existingEntries.filter(e => e.isValid);
    if (validEntries.length === 0) {
      toast.error('Tidak ada data valid untuk diimport');
      return;
    }

    setIsImportingExisting(true);
    setImportProgress(0);

    try {
      const result = await bulkImportInstallments(validEntries, journalMode, debitAccountId);
      
      if (result.success) {
        setExistingEntries([]);
        setExistingFile(null);
        setShowPreview(false);
        fetchActiveLoans();
      }

      if (result.errors.length > 0) {
        console.error('Import errors:', result.errors);
      }
    } finally {
      setIsImportingExisting(false);
      setImportProgress(100);
    }
  };

  // Import new loans with installments
  const handleImportNewLoans = async () => {
    if (!debitAccountId) {
      toast.error('Pilih akun debit terlebih dahulu');
      return;
    }

    const validEntries = newLoanEntries.filter(e => e.isValid);
    if (validEntries.length === 0) {
      toast.error('Tidak ada data valid untuk diimport');
      return;
    }

    setIsImportingNew(true);

    try {
      const result = await bulkImportLoansWithInstallments(validEntries, journalMode, debitAccountId);
      
      if (result.success) {
        setNewLoanEntries([]);
        setNewLoanFile(null);
        setShowPreview(false);
        fetchActiveLoans();
      }
    } finally {
      setIsImportingNew(false);
    }
  };

  const toggleRowExpand = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  // Stats for existing entries
  const existingStats = {
    total: existingEntries.length,
    valid: existingEntries.filter(e => e.isValid).length,
    invalid: existingEntries.filter(e => !e.isValid).length,
    paid: existingEntries.filter(e => e.status === 'paid' && e.isValid).length,
    partial: existingEntries.filter(e => e.status === 'partial' && e.isValid).length,
    totalPrincipal: existingEntries.filter(e => e.isValid).reduce((sum, e) => sum + e.principalPaid, 0),
    totalInterest: existingEntries.filter(e => e.isValid).reduce((sum, e) => sum + e.interestPaid, 0),
    totalPenalty: existingEntries.filter(e => e.isValid).reduce((sum, e) => sum + e.penaltyPaid, 0),
  };

  // Stats for new loan entries
  const newLoanStats = {
    total: newLoanEntries.length,
    valid: newLoanEntries.filter(e => e.isValid).length,
    invalid: newLoanEntries.filter(e => !e.isValid).length,
    totalPrincipal: newLoanEntries.filter(e => e.isValid).reduce((sum, e) => sum + e.principalAmount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Migrasi Detail Angsuran
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Import data pembayaran angsuran historis via Excel
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="existing" className="gap-2">
            <Calendar className="h-4 w-4" />
            Angsuran Existing
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Pinjaman Baru
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Riwayat
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Existing Loan Installments */}
        <TabsContent value="existing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-4 w-4" />
                Langkah 1: Download Template Pre-filled
              </CardTitle>
              <CardDescription>
                Template sudah berisi data anggota, pinjaman, dan jadwal angsuran
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{activeLoans.length} pinjaman aktif</p>
                  <p className="text-sm text-muted-foreground">
                    {activeLoans.reduce((sum, l) => sum + l.installments.length, 0)} angsuran total
                  </p>
                </div>
                <Button 
                  onClick={() => downloadInstallmentTemplate()}
                  disabled={loading || activeLoans.length === 0}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>

              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertDescription>
                  Anda hanya perlu mengisi kolom: <strong>Tanggal Bayar</strong>, <strong>Pokok Dibayar</strong>, 
                  <strong>Bunga Dibayar</strong>, <strong>Denda</strong>, dan <strong>Status</strong>.
                  Data anggota dan jadwal angsuran sudah terisi otomatis.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Langkah 2: Upload File Excel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ExcelDropZone
                onFileSelect={handleExistingFileUpload}
                isLoading={isParsingExisting}
                selectedFile={existingFile}
                onClear={() => {
                  setExistingFile(null);
                  setExistingEntries([]);
                  setShowPreview(false);
                }}
              />
            </CardContent>
          </Card>

          {/* Preview Section */}
          {existingEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview Data ({existingStats.total} baris)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Valid</p>
                    <p className="text-lg font-bold text-green-600">{existingStats.valid}</p>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Error</p>
                    <p className="text-lg font-bold text-red-600">{existingStats.invalid}</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Pokok</p>
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(existingStats.totalPrincipal)}</p>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Bunga</p>
                    <p className="text-sm font-bold text-purple-600">{formatCurrency(existingStats.totalInterest)}</p>
                  </div>
                </div>

                {/* Table Preview */}
                <ScrollArea className="h-[300px] border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>Anggota</TableHead>
                        <TableHead>Angsuran</TableHead>
                        <TableHead className="text-right">Pokok</TableHead>
                        <TableHead className="text-right">Bunga</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Validasi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {existingEntries.slice(0, 50).map((entry, index) => (
                        <TableRow 
                          key={index}
                          className={!entry.isValid ? 'bg-red-50/50 dark:bg-red-900/10' : ''}
                        >
                          <TableCell className="font-mono text-xs">{entry.rowIndex}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{entry.memberName}</p>
                              <p className="text-xs text-muted-foreground">{entry.memberNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">#{entry.installmentNumber}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(entry.principalPaid)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(entry.interestPaid)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              entry.status === 'paid' ? 'default' :
                              entry.status === 'partial' ? 'secondary' : 'outline'
                            }>
                              {entry.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {entry.isValid ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <X className="h-4 w-4 text-red-600" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <ul className="text-xs space-y-1">
                                      {entry.validationErrors.map((err, i) => (
                                        <li key={i}>• {err}</li>
                                      ))}
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {existingEntries.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Menampilkan 50 dari {existingEntries.length} baris
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Journal Settings */}
          {existingEntries.length > 0 && existingStats.valid > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Langkah 3: Pengaturan Jurnal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Mode Jurnal Otomatis</Label>
                  <RadioGroup 
                    value={journalMode} 
                    onValueChange={(v) => setJournalMode(v as MigrationJournalMode)}
                    className="grid grid-cols-1 md:grid-cols-2 gap-3"
                  >
                    <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="per_transaction" id="per_transaction" className="mt-1" />
                      <div>
                        <Label htmlFor="per_transaction" className="font-medium cursor-pointer">
                          Per Transaksi
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          1 jurnal per pembayaran angsuran (akurat tapi banyak jurnal)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="per_batch" id="per_batch" className="mt-1" />
                      <div>
                        <Label htmlFor="per_batch" className="font-medium cursor-pointer">
                          Per Batch
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          1 jurnal agregat untuk seluruh import (ringkas)
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Akun Debit (Kas/Bank)</Label>
                  <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih akun debit" />
                    </SelectTrigger>
                    <SelectContent>
                      {debitAccounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_code} - {account.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Journal Preview */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Preview Jurnal
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="p-4 bg-muted/50 rounded-lg font-mono text-sm space-y-2">
                      <p className="font-bold">Jurnal {journalMode === 'per_batch' ? 'Batch' : 'Per Transaksi'}:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-green-600">Debit: Kas/Bank</p>
                          <p className="font-bold">{formatCurrency(existingStats.totalPrincipal + existingStats.totalInterest + existingStats.totalPenalty)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-red-600">Credit:</p>
                          <p>Piutang Pinjaman: {formatCurrency(existingStats.totalPrincipal)}</p>
                          <p>Pendapatan Bunga: {formatCurrency(existingStats.totalInterest)}</p>
                          {existingStats.totalPenalty > 0 && (
                            <p>Pendapatan Denda: {formatCurrency(existingStats.totalPenalty)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Import Button */}
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setExistingEntries([]);
                      setExistingFile(null);
                      setShowPreview(false);
                    }}
                  >
                    Batal
                  </Button>
                  <Button 
                    onClick={handleImportExisting}
                    disabled={isImportingExisting || existingStats.valid === 0}
                    className="gap-2"
                  >
                    {isImportingExisting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Mengimport...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Import {existingStats.valid} Angsuran
                      </>
                    )}
                  </Button>
                </div>

                {isImportingExisting && (
                  <Progress value={importProgress} className="h-2" />
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: New Loans with Installments */}
        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-4 w-4" />
                Langkah 1: Download Template
              </CardTitle>
              <CardDescription>
                Template untuk membuat pinjaman baru sekaligus dengan riwayat pembayaran
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={downloadLoanWithInstallmentTemplate}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Template Pinjaman + Angsuran
              </Button>

              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertDescription>
                  Template memiliki 2 sheet: <strong>Data Pinjaman</strong> untuk informasi pinjaman baru,
                  dan <strong>Riwayat Pembayaran</strong> untuk angsuran yang sudah dibayar.
                  Pastikan anggota sudah terdaftar dan belum memiliki pinjaman aktif.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Langkah 2: Upload File Excel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ExcelDropZone
                onFileSelect={handleNewLoanFileUpload}
                isLoading={isParsingNew}
                selectedFile={newLoanFile}
                onClear={() => {
                  setNewLoanFile(null);
                  setNewLoanEntries([]);
                }}
              />
            </CardContent>
          </Card>

          {/* Preview for new loans */}
          {newLoanEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview Pinjaman Baru ({newLoanStats.total} pinjaman)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Valid</p>
                    <p className="text-lg font-bold text-green-600">{newLoanStats.valid}</p>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Error</p>
                    <p className="text-lg font-bold text-red-600">{newLoanStats.invalid}</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Pokok</p>
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(newLoanStats.totalPrincipal)}</p>
                  </div>
                </div>

                {/* Table */}
                <ScrollArea className="h-[300px] border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>Anggota</TableHead>
                        <TableHead className="text-right">Pokok</TableHead>
                        <TableHead>Tenor</TableHead>
                        <TableHead>Bunga</TableHead>
                        <TableHead>Angsuran Dibayar</TableHead>
                        <TableHead>Validasi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newLoanEntries.map((entry, index) => (
                        <TableRow 
                          key={index}
                          className={!entry.isValid ? 'bg-red-50/50 dark:bg-red-900/10' : ''}
                        >
                          <TableCell className="font-mono text-xs">{entry.rowIndex}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{entry.memberName || '-'}</p>
                              <p className="text-xs text-muted-foreground">{entry.memberNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(entry.principalAmount)}
                          </TableCell>
                          <TableCell>{entry.tenor} bulan</TableCell>
                          <TableCell>{entry.interestRate}%</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {entry.installments.length} angsuran
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {entry.isValid ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <X className="h-4 w-4 text-red-600" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <ul className="text-xs space-y-1">
                                      {entry.validationErrors.map((err, i) => (
                                        <li key={i}>• {err}</li>
                                      ))}
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {/* Import Button */}
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setNewLoanEntries([]);
                      setNewLoanFile(null);
                    }}
                  >
                    Batal
                  </Button>
                  <Button 
                    onClick={handleImportNewLoans}
                    disabled={isImportingNew || newLoanStats.valid === 0}
                    className="gap-2"
                  >
                    {isImportingNew ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Mengimport...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Import {newLoanStats.valid} Pinjaman
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3: History */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-4 w-4" />
                Riwayat Migrasi Angsuran
              </CardTitle>
              <CardDescription>
                Daftar batch migrasi angsuran yang telah dilakukan
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : migrationHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Belum ada riwayat migrasi</p>
                  <p className="text-sm mt-1">Setiap batch import akan tercatat beserta jurnal yang dibuatnya</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {migrationHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={item.type === 'installment' ? 'default' : 'secondary'}>
                              {item.type === 'installment' ? 'Angsuran Existing' : 'Pinjaman Baru'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {item.journalMode === 'per_batch' ? 'Batch' : 'Per Transaksi'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(item.createdAt), 'dd MMM yyyy HH:mm', { locale: localeId })}
                            {' oleh '}
                            <span className="font-medium">{item.createdByName}</span>
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-sm">
                              <span className="text-green-600 font-medium">{item.successCount}</span>
                              {item.failCount > 0 && (
                                <>
                                  {' / '}
                                  <span className="text-red-600 font-medium">{item.failCount}</span>
                                </>
                              )}
                              {' dari '}
                              {item.totalRecords}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.journalCount} jurnal dibuat
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
