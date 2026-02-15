import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Download, Upload, Wallet, AlertCircle, Check, X,
  Loader2, BookOpen, Eye, Play, RefreshCw,
  ChevronDown, HelpCircle, History, ArrowLeft
} from 'lucide-react';
import { ExcelDropZone } from './ExcelDropZone';
import { useSavingsMigration } from '@/hooks/useSavingsMigration';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { formatCurrency } from '@/lib/mockData';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import type { MigrationJournalMode } from '@/lib/types';
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

interface SavingsMigrationEnhancedProps {
  onBack?: () => void;
}

export default function SavingsMigrationEnhanced({ onBack }: SavingsMigrationEnhancedProps) {
  const [activeTab, setActiveTab] = useState('import');
  const [journalMode, setJournalMode] = useState<MigrationJournalMode>('per_batch');
  const [debitAccountId, setDebitAccountId] = useState<string>('');
  
  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const {
    loading,
    entries,
    migrationHistory,
    parseExcel,
    bulkImport,
    downloadTemplate,
    fetchHistory,
    clearEntries,
  } = useSavingsMigration();

  const { accounts, loading: accountsLoading } = useChartOfAccounts();

  // Filter asset accounts for debit selection
  const debitAccounts = accounts.filter(a => 
    a.is_active && 
    (a.account_type === 'asset') &&
    (a.account_name.toLowerCase().includes('kas') || a.account_name.toLowerCase().includes('bank'))
  );

  useEffect(() => {
    // Set default debit account
    if (debitAccounts.length > 0 && !debitAccountId) {
      const kasAccount = debitAccounts.find(a => a.account_name.toLowerCase().includes('kas'));
      setDebitAccountId(kasAccount?.id || debitAccounts[0].id);
    }
  }, [debitAccounts, debitAccountId]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    
    try {
      await parseExcel(file);
      toast.success('File berhasil dibaca');
    } catch (error: any) {
      toast.error(`Gagal membaca file: ${error.message}`);
    } finally {
      setIsParsing(false);
    }
  }, [parseExcel]);

  // Import data
  const handleImport = async () => {
    if (!debitAccountId) {
      toast.error('Pilih akun debit terlebih dahulu');
      return;
    }

    const validEntries = entries.filter(e => e.isValid);
    if (validEntries.length === 0) {
      toast.error('Tidak ada data valid untuk diimport');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const result = await bulkImport(validEntries, journalMode, debitAccountId);
      
      if (result.success) {
        setSelectedFile(null);
        clearEntries();
        fetchHistory();
      }
    } finally {
      setIsImporting(false);
      setImportProgress(100);
    }
  };

  // Stats
  const stats = {
    total: entries.length,
    valid: entries.filter(e => e.isValid).length,
    invalid: entries.filter(e => !e.isValid).length,
    totalPokok: entries.filter(e => e.isValid).reduce((sum, e) => sum + e.simpananPokok, 0),
    totalWajib: entries.filter(e => e.isValid).reduce((sum, e) => sum + e.simpananWajib, 0),
    totalSukarela: entries.filter(e => e.isValid).reduce((sum, e) => sum + e.simpananSukarela, 0),
  };

  const totalSimpanan = stats.totalPokok + stats.totalWajib + stats.totalSukarela;

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
              <Wallet className="h-5 w-5 text-primary" />
              Migrasi Simpanan Kolektif
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Import data simpanan anggota via Excel dengan jurnal otomatis
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Import Simpanan
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Riwayat Migrasi
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Import */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-4 w-4" />
                Langkah 1: Download Template
              </CardTitle>
              <CardDescription>
                Template Excel untuk migrasi data simpanan anggota
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={downloadTemplate}
                disabled={loading}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Template Simpanan
              </Button>

              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertDescription>
                  Template berisi kolom: <strong>No. Anggota</strong>, <strong>Nama</strong>, 
                  <strong>Simpanan Pokok</strong>, <strong>Simpanan Wajib</strong>, 
                  <strong>Simpanan Sukarela</strong>, dan <strong>Tanggal Setor</strong>.
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
                onFileSelect={handleFileUpload}
                isLoading={isParsing}
                selectedFile={selectedFile}
                onClear={() => {
                  setSelectedFile(null);
                  clearEntries();
                }}
              />
            </CardContent>
          </Card>

          {/* Preview Section */}
          {entries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview Data ({stats.total} baris)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Valid</p>
                    <p className="text-lg font-bold text-green-600">{stats.valid}</p>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Error</p>
                    <p className="text-lg font-bold text-red-600">{stats.invalid}</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Pokok</p>
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(stats.totalPokok)}</p>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Wajib</p>
                    <p className="text-sm font-bold text-purple-600">{formatCurrency(stats.totalWajib)}</p>
                  </div>
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Sukarela</p>
                    <p className="text-sm font-bold text-orange-600">{formatCurrency(stats.totalSukarela)}</p>
                  </div>
                </div>

                {/* Table Preview */}
                <ScrollArea className="h-[300px] border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>Anggota</TableHead>
                        <TableHead className="text-right">Pokok</TableHead>
                        <TableHead className="text-right">Wajib</TableHead>
                        <TableHead className="text-right">Sukarela</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Validasi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.slice(0, 50).map((entry, index) => (
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
                          <TableCell className="text-right text-sm">
                            {formatCurrency(entry.simpananPokok)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(entry.simpananWajib)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(entry.simpananSukarela)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {entry.depositDate || '-'}
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

                {entries.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Menampilkan 50 dari {entries.length} baris
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Journal Settings */}
          {entries.length > 0 && stats.valid > 0 && (
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
                      <RadioGroupItem value="per_transaction" id="per_tx" className="mt-1" />
                      <div>
                        <Label htmlFor="per_tx" className="font-medium cursor-pointer">
                          Per Anggota
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          1 jurnal per anggota (akurat tapi banyak jurnal)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="per_batch" id="per_batch" className="mt-1" />
                      <div>
                        <Label htmlFor="per_batch" className="font-medium cursor-pointer">
                          Per Batch (Agregat)
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
                      <p className="font-bold">Jurnal {journalMode === 'per_batch' ? 'Batch (Agregat)' : 'Per Anggota'}:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-green-600">Debit: Kas/Bank</p>
                          <p className="font-bold">{formatCurrency(totalSimpanan)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-red-600">Credit:</p>
                          <p>Simpanan Pokok: {formatCurrency(stats.totalPokok)}</p>
                          <p>Simpanan Wajib: {formatCurrency(stats.totalWajib)}</p>
                          <p>Simpanan Sukarela: {formatCurrency(stats.totalSukarela)}</p>
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
                      setSelectedFile(null);
                      clearEntries();
                    }}
                  >
                    Batal
                  </Button>
                  <Button 
                    onClick={handleImport}
                    disabled={isImporting || stats.valid === 0}
                    className="gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Mengimport...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Import {stats.valid} Simpanan
                      </>
                    )}
                  </Button>
                </div>

                {isImporting && (
                  <Progress value={importProgress} className="h-2" />
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: History */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-4 w-4" />
                Riwayat Migrasi Simpanan
              </CardTitle>
              <CardDescription>
                Daftar batch migrasi simpanan yang telah dilakukan
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
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {migrationHistory.map((history) => (
                      <div 
                        key={history.id} 
                        className="p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">
                              Batch Migrasi Simpanan
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(history.createdAt), 'dd MMM yyyy HH:mm', { locale: localeId })}
                            </p>
                          </div>
                          <Badge variant={history.failCount === 0 ? 'default' : 'secondary'}>
                            {history.successCount} sukses
                            {history.failCount > 0 && ` / ${history.failCount} gagal`}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Mode: {history.journalMode === 'per_batch' ? 'Agregat' : 'Per Anggota'}
                          </span>
                          <span className="text-muted-foreground">
                            {history.journalCount} jurnal
                          </span>
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
