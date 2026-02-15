import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { useJournalTemplates } from '@/hooks/useJournalTemplates';
import { 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  ArrowRight, 
  Lightbulb, 
  Zap, 
  Wallet,
  Banknote,
  FileText,
  AlertTriangle,
  Info,
  ArrowRightLeft,
  CreditCard,
  Landmark,
  HandCoins,
  Receipt,
  Building2,
  Loader2,
  Sparkles,
  CheckCircle2,
  Link2,
  RefreshCw
} from 'lucide-react';

export const JournalTemplateConfigGuide = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const { 
    createStandardAccounts, 
    getMissingStandardAccounts, 
    hasAllStandardAccounts,
    loading: accountsLoading 
  } = useChartOfAccounts();

  const {
    autoMapAccounts,
    getAutoMappingStats,
    getConfiguredTemplatesCount,
    templates
  } = useJournalTemplates();

  const missingAccounts = getMissingStandardAccounts();
  const allAccountsExist = hasAllStandardAccounts();
  const mappingStats = getAutoMappingStats();
  const configuredCount = getConfiguredTemplatesCount();
  const totalTemplates = templates.filter(t => t.isActive).length;

  const handleAutoCreate = async () => {
    setIsCreating(true);
    try {
      await createStandardAccounts();
    } finally {
      setIsCreating(false);
    }
  };

  const handleAutoMap = async () => {
    setIsMapping(true);
    try {
      autoMapAccounts();
    } finally {
      setIsMapping(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-between bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/30 hover:bg-amber-500/20"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-500" />
            <span className="font-medium">Panduan Konfigurasi Template Jurnal</span>
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
              Siap Pakai
            </Badge>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 animate-fade-in">
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Panduan Lengkap Konfigurasi Template Jurnal Koperasi
            </CardTitle>
            <CardDescription>
              Ikuti panduan ini untuk mengkonfigurasi template jurnal otomatis dengan akun standar koperasi
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="intro" className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-auto">
                <TabsTrigger value="intro" className="text-xs py-2">
                  <Info className="h-3 w-3 mr-1" />
                  Pengantar
                </TabsTrigger>
                <TabsTrigger value="accounts" className="text-xs py-2">
                  <FileText className="h-3 w-3 mr-1" />
                  Akun Standar
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-xs py-2">
                  <Receipt className="h-3 w-3 mr-1" />
                  Template
                </TabsTrigger>
                <TabsTrigger value="steps" className="text-xs py-2">
                  <Check className="h-3 w-3 mr-1" />
                  Langkah
                </TabsTrigger>
              </TabsList>

              {/* Introduction Tab */}
              <TabsContent value="intro" className="space-y-4 mt-4">
                <div className="p-4 rounded-lg bg-background border">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    Apa itu Template Jurnal Otomatis?
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Template jurnal otomatis adalah fitur yang memungkinkan sistem untuk secara otomatis 
                    membuat entri jurnal (double-entry bookkeeping) saat transaksi anggota disetujui oleh admin.
                    Ini menghemat waktu dan mengurangi kesalahan pencatatan manual.
                  </p>
                </div>

                {/* Sync Information */}
                <Alert className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30">
                  <RefreshCw className="h-4 w-4 text-emerald-600" />
                  <AlertTitle className="text-emerald-700 dark:text-emerald-300">Sinkronisasi Jurnal Otomatis & Manual</AlertTitle>
                  <AlertDescription className="text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
                    <p>✓ <strong>Tidak ada input ganda!</strong> Jurnal otomatis dan jurnal manual menggunakan database yang sama.</p>
                    <p>✓ Jurnal dari transaksi anggota ditandai dengan <code className="bg-emerald-200/50 px-1 rounded">reference_type: 'transaction'</code></p>
                    <p>✓ Anda dapat melihat semua jurnal (otomatis & manual) di menu Jurnal Umum</p>
                  </AlertDescription>
                </Alert>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-emerald-500" />
                      <span className="font-medium text-sm text-emerald-700 dark:text-emerald-300">Keuntungan</span>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Pencatatan jurnal otomatis & akurat</li>
                      <li>• Saldo akun selalu terupdate</li>
                      <li>• Laporan keuangan real-time</li>
                      <li>• Mengurangi kesalahan manual</li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-sm text-blue-700 dark:text-blue-300">Cara Kerja</span>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Anggota mengajukan transaksi</li>
                      <li>• Admin menyetujui transaksi</li>
                      <li>• Sistem membuat jurnal otomatis</li>
                      <li>• Saldo akun diperbarui</li>
                    </ul>
                  </div>
                </div>

                <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-700 dark:text-amber-300">Penting!</AlertTitle>
                  <AlertDescription className="text-xs text-amber-600 dark:text-amber-400">
                    Pastikan semua akun sudah dikonfigurasi dengan benar sebelum menyetujui transaksi. 
                    Jika template belum dikonfigurasi, jurnal tidak akan dibuat secara otomatis.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              {/* Standard Accounts Tab */}
              <TabsContent value="accounts" className="space-y-4 mt-4">
                {/* Auto-Create Button */}
                <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-50/80 to-blue-50/80 dark:from-emerald-950/30 dark:to-blue-950/30 border border-emerald-200/50 dark:border-emerald-800/50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                        <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          Buat Akun Standar Otomatis
                          {allAccountsExist && (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Lengkap
                            </Badge>
                          )}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {allAccountsExist 
                            ? 'Semua akun standar koperasi sudah tersedia.'
                            : `${missingAccounts.length} akun standar belum dibuat. Klik tombol untuk membuat semua akun yang diperlukan.`
                          }
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleAutoCreate}
                      disabled={isCreating || accountsLoading || allAccountsExist}
                      className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white shrink-0"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Membuat...
                        </>
                      ) : allAccountsExist ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Sudah Lengkap
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Buat {missingAccounts.length} Akun
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {!allAccountsExist && missingAccounts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-emerald-200/50 dark:border-emerald-800/50">
                      <p className="text-xs text-muted-foreground mb-2">Akun yang akan dibuat:</p>
                      <div className="flex flex-wrap gap-1">
                        {missingAccounts.slice(0, 8).map((acc) => (
                          <Badge key={acc.account_code} variant="outline" className="text-xs font-mono">
                            {acc.account_code}
                          </Badge>
                        ))}
                        {missingAccounts.length > 8 && (
                          <Badge variant="outline" className="text-xs">
                            +{missingAccounts.length - 8} lainnya
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Auto-Map Button */}
                <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200/50 dark:border-blue-800/50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                        <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          Auto-Mapping Template Jurnal
                          {mappingStats.configuredLines === mappingStats.totalLines && (
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Lengkap
                            </Badge>
                          )}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {mappingStats.mappableLines > 0 
                            ? `${mappingStats.mappableLines} akun dapat di-mapping otomatis ke template jurnal.`
                            : mappingStats.configuredLines === mappingStats.totalLines
                              ? 'Semua template sudah terhubung dengan akun standar.'
                              : 'Buat akun standar terlebih dahulu untuk mengaktifkan auto-mapping.'
                          }
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {configuredCount}/{totalTemplates} template siap
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {mappingStats.configuredLines}/{mappingStats.totalLines} line terkonfigurasi
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleAutoMap}
                      disabled={isMapping || mappingStats.mappableLines === 0}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shrink-0"
                    >
                      {isMapping ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Mapping...
                        </>
                      ) : mappingStats.configuredLines === mappingStats.totalLines ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Sudah Lengkap
                        </>
                      ) : (
                        <>
                          <Link2 className="h-4 w-4 mr-2" />
                          Map {mappingStats.mappableLines} Akun
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  Berikut adalah akun-akun standar koperasi yang perlu Anda buat di Bagan Akun sebelum mengkonfigurasi template jurnal:
                </div>

                {/* Asset Accounts */}
                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Banknote className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold text-blue-700 dark:text-blue-300 text-sm">Akun Aset (1-xxx)</span>
                    <Badge className="text-xs bg-blue-100 text-blue-700">Bertambah di DEBIT</Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-24">Kode</TableHead>
                        <TableHead>Nama Akun</TableHead>
                        <TableHead>Fungsi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      <TableRow>
                        <TableCell className="font-mono">1-1000</TableCell>
                        <TableCell className="font-medium">Kas</TableCell>
                        <TableCell className="text-muted-foreground">Uang tunai di tangan</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">1-1100</TableCell>
                        <TableCell className="font-medium">Bank</TableCell>
                        <TableCell className="text-muted-foreground">Saldo rekening bank</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">1-2000</TableCell>
                        <TableCell className="font-medium">Piutang Pinjaman Anggota</TableCell>
                        <TableCell className="text-muted-foreground">Pinjaman yang belum dilunasi</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Liability Accounts */}
                <div className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Landmark className="h-4 w-4 text-rose-500" />
                    <span className="font-semibold text-rose-700 dark:text-rose-300 text-sm">Akun Kewajiban (2-xxx)</span>
                    <Badge className="text-xs bg-rose-100 text-rose-700">Bertambah di KREDIT</Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-24">Kode</TableHead>
                        <TableHead>Nama Akun</TableHead>
                        <TableHead>Fungsi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      <TableRow>
                        <TableCell className="font-mono">2-1010</TableCell>
                        <TableCell className="font-medium">Hutang Simpanan Pokok</TableCell>
                        <TableCell className="text-muted-foreground">Simpanan pokok anggota</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">2-1020</TableCell>
                        <TableCell className="font-medium">Hutang Simpanan Wajib</TableCell>
                        <TableCell className="text-muted-foreground">Simpanan wajib anggota</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">2-1030</TableCell>
                        <TableCell className="font-medium">Hutang Simpanan Sukarela</TableCell>
                        <TableCell className="text-muted-foreground">Simpanan sukarela anggota</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Income Accounts */}
                <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2 mb-3">
                    <HandCoins className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm">Akun Pendapatan (4-xxx)</span>
                    <Badge className="text-xs bg-emerald-100 text-emerald-700">Bertambah di KREDIT</Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-24">Kode</TableHead>
                        <TableHead>Nama Akun</TableHead>
                        <TableHead>Fungsi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      <TableRow>
                        <TableCell className="font-mono">4-1000</TableCell>
                        <TableCell className="font-medium">Pendapatan Bunga Pinjaman</TableCell>
                        <TableCell className="text-muted-foreground">Bunga dari angsuran pinjaman</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">4-2000</TableCell>
                        <TableCell className="font-medium">Pendapatan Denda Keterlambatan</TableCell>
                        <TableCell className="text-muted-foreground">Denda angsuran terlambat</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Expense Accounts */}
                <div className="p-3 rounded-lg bg-orange-50/50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="h-4 w-4 text-orange-500" />
                    <span className="font-semibold text-orange-700 dark:text-orange-300 text-sm">Akun Beban (5-xxx)</span>
                    <Badge className="text-xs bg-orange-100 text-orange-700">Bertambah di DEBIT</Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-24">Kode</TableHead>
                        <TableHead>Nama Akun</TableHead>
                        <TableHead>Fungsi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      <TableRow>
                        <TableCell className="font-mono">5-1000</TableCell>
                        <TableCell className="font-medium">Beban Bunga Simpanan Sukarela</TableCell>
                        <TableCell className="text-muted-foreground">Bunga yang dibayar ke anggota</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Templates Tab */}
              <TabsContent value="templates" className="space-y-4 mt-4">
                <div className="text-sm text-muted-foreground mb-4">
                  Berikut adalah template jurnal standar koperasi dan konfigurasi akun yang direkomendasikan:
                </div>

                {/* Savings Templates */}
                <div className="p-4 rounded-lg bg-background border">
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold text-sm">Template Transaksi Simpanan</span>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Simpanan Pokok */}
                    <div className="p-3 rounded bg-muted/50 border">
                      <p className="font-medium text-sm mb-2">Simpanan Pokok / Wajib / Sukarela (Setoran)</p>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">D: Kas/Bank</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200">K: Hutang Simpanan</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Kas bertambah (Debit), Hutang ke anggota bertambah (Kredit)
                      </p>
                    </div>

                    {/* Penarikan Simpanan */}
                    <div className="p-3 rounded bg-muted/50 border">
                      <p className="font-medium text-sm mb-2">Penarikan Simpanan Sukarela</p>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200">D: Hutang Simpanan Sukarela</Badge>
                        <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">D: Beban Bunga (jika ada)</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">K: Kas/Bank</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Hutang ke anggota berkurang (Debit), Kas keluar (Kredit)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Loan Templates */}
                <div className="p-4 rounded-lg bg-background border">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold text-sm">Template Transaksi Pinjaman</span>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Pencairan Pinjaman */}
                    <div className="p-3 rounded bg-muted/50 border">
                      <p className="font-medium text-sm mb-2">Pencairan Pinjaman</p>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">D: Piutang Pinjaman</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">K: Kas/Bank</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Piutang bertambah (Debit), Kas keluar (Kredit)
                      </p>
                    </div>

                    {/* Pembayaran Angsuran */}
                    <div className="p-3 rounded bg-muted/50 border">
                      <p className="font-medium text-sm mb-2">Pembayaran Angsuran (Pokok + Bunga + Denda)</p>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">D: Kas/Bank (total)</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">K: Piutang Pinjaman (pokok)</Badge>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">K: Pendapatan Bunga</Badge>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">K: Pendapatan Denda</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Kas masuk (Debit), Piutang berkurang dan Pendapatan bertambah (Kredit)
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Steps Tab */}
              <TabsContent value="steps" className="space-y-4 mt-4">
                <div className="text-sm text-muted-foreground mb-4">
                  Ikuti langkah-langkah berikut untuk mengkonfigurasi template jurnal:
                </div>

                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-blue-100 text-blue-700">1</Badge>
                      <span className="font-medium text-sm">Buat Akun Standar (Otomatis)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Klik tombol <strong className="text-emerald-600">"Buat Akun Standar Otomatis"</strong> di tab "Akun Standar" 
                      untuk membuat semua akun koperasi yang diperlukan dengan satu klik.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-emerald-100 text-emerald-700">2</Badge>
                      <span className="font-medium text-sm">Auto-Mapping Template (Otomatis)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Setelah akun dibuat, klik tombol <strong className="text-blue-600">"Map Akun"</strong> di tab "Akun Standar" 
                      untuk secara otomatis menghubungkan akun standar ke template jurnal. Anda juga dapat konfigurasi manual jika diperlukan.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-amber-100 text-amber-700">3</Badge>
                      <span className="font-medium text-sm">Aktifkan Template yang Diperlukan</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Gunakan toggle <strong>Aktif</strong> untuk mengaktifkan atau menonaktifkan template. 
                      Hanya template yang aktif dan terkonfigurasi lengkap yang akan membuat jurnal otomatis.
                    </p>
                  </div>

                  {/* Step 4 */}
                  <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-purple-100 text-purple-700">4</Badge>
                      <span className="font-medium text-sm">Verifikasi Status Template</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pastikan semua template yang diperlukan menunjukkan status <strong className="text-emerald-600">Siap</strong> 
                      (badge hijau). Template dengan status <strong className="text-rose-600">Perlu Setup</strong> tidak akan membuat jurnal.
                    </p>
                  </div>

                  {/* Step 5 */}
                  <div className="p-3 rounded-lg bg-slate-50/50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-slate-100 text-slate-700">5</Badge>
                      <span className="font-medium text-sm">Uji Coba dengan Transaksi</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ajukan transaksi test dan setujui sebagai admin. Periksa apakah jurnal otomatis 
                      dibuat dengan benar di menu <strong>Akuntansi → Jurnal Umum</strong>.
                    </p>
                  </div>
                </div>

                {/* Summary Checklist */}
                <div className="p-4 rounded-lg bg-background border mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold text-sm">Checklist Konfigurasi</span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 text-xs">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" readOnly />
                      <span>Akun Kas/Bank sudah dibuat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" readOnly />
                      <span>Akun Hutang Simpanan sudah dibuat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" readOnly />
                      <span>Akun Piutang Pinjaman sudah dibuat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" readOnly />
                      <span>Akun Pendapatan Bunga sudah dibuat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" readOnly />
                      <span>Akun Pendapatan Denda sudah dibuat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" readOnly />
                      <span>Akun Beban Bunga Simpanan sudah dibuat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" readOnly />
                      <span>Semua template sudah dikonfigurasi</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" readOnly />
                      <span>Sudah test dengan transaksi percobaan</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
