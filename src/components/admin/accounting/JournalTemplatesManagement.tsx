import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, Settings, ArrowRight, RefreshCw, Check, X, Info, Zap, HelpCircle, History, Database, Building2 } from 'lucide-react';
import { useJournalTemplates, JournalTemplate, TemplateType } from '@/hooks/useJournalTemplates';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { QuickEquationGuide } from './QuickEquationGuide';
import { JournalTemplateConfigGuide } from './JournalTemplateConfigGuide';
import { JournalTemplateAuditLogComponent } from './JournalTemplateAuditLog';
import { BusinessUnitJournalTemplatesManagement } from './BusinessUnitJournalTemplatesManagement';

const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  simpanan_pokok: 'Simpanan Pokok',
  simpanan_wajib: 'Simpanan Wajib',
  simpanan_sukarela: 'Simpanan Sukarela',
  setor_simpanan_wajib: 'Setor Simpanan Wajib',
  setor_simpanan_sukarela: 'Setor Simpanan Sukarela',
  penarikan_simpanan_sukarela: 'Penarikan Simpanan Sukarela',
  pencairan_pinjaman: 'Pencairan Pinjaman',
  bayar_angsuran_pinjaman: 'Pembayaran Angsuran',
  // Migration templates
  saldo_awal_pokok: 'Saldo Awal Simpanan Pokok',
  saldo_awal_wajib: 'Saldo Awal Simpanan Wajib',
  saldo_awal_sukarela: 'Saldo Awal Simpanan Sukarela',
  saldo_awal_pinjaman: 'Saldo Awal Pinjaman',
};

// Penjelasan standar akuntansi koperasi untuk setiap tipe template
const TEMPLATE_TOOLTIPS: Record<TemplateType, { debit: string; kredit: string; penjelasan: string }> = {
  simpanan_pokok: {
    debit: 'Kas/Bank bertambah karena menerima uang dari anggota',
    kredit: 'Hutang Simpanan Pokok bertambah karena koperasi berkewajiban mengembalikan dana ini',
    penjelasan: 'Simpanan pokok dibayar satu kali saat mendaftar sebagai anggota. Ini adalah modal dasar anggota di koperasi.',
  },
  simpanan_wajib: {
    debit: 'Kas/Bank bertambah karena menerima uang dari anggota',
    kredit: 'Hutang Simpanan Wajib bertambah karena koperasi berkewajiban mengembalikan dana ini',
    penjelasan: 'Simpanan wajib dibayar rutin (biasanya bulanan) selama menjadi anggota. Nominal biasanya tetap setiap bulan.',
  },
  simpanan_sukarela: {
    debit: 'Kas/Bank bertambah karena menerima uang dari anggota',
    kredit: 'Hutang Simpanan Sukarela bertambah karena koperasi berkewajiban mengembalikan dana ini',
    penjelasan: 'Simpanan sukarela dapat disetor kapan saja dengan jumlah bebas. Bisa ditarik sewaktu-waktu.',
  },
  setor_simpanan_wajib: {
    debit: 'Kas/Bank bertambah karena menerima uang dari anggota',
    kredit: 'Hutang Simpanan Wajib bertambah karena koperasi berkewajiban mengembalikan dana ini',
    penjelasan: 'Sama dengan Simpanan Wajib - setoran rutin bulanan. Tipe ini untuk pembayaran berkala.',
  },
  setor_simpanan_sukarela: {
    debit: 'Kas/Bank bertambah karena menerima uang dari anggota',
    kredit: 'Hutang Simpanan Sukarela bertambah karena koperasi berkewajiban mengembalikan dana ini',
    penjelasan: 'Sama dengan Simpanan Sukarela - setoran bebas kapan saja dengan jumlah fleksibel.',
  },
  penarikan_simpanan_sukarela: {
    debit: 'Hutang Simpanan Sukarela berkurang karena kewajiban ke anggota sudah dipenuhi',
    kredit: 'Kas/Bank berkurang karena membayar penarikan ke anggota',
    penjelasan: 'Penarikan simpanan sukarela mengurangi saldo simpanan anggota dan kas koperasi.',
  },
  pencairan_pinjaman: {
    debit: 'Piutang Pinjaman bertambah karena ada tagihan ke anggota',
    kredit: 'Kas/Bank berkurang karena dana dicairkan ke anggota',
    penjelasan: 'Pencairan pinjaman menciptakan piutang (hak tagih) koperasi kepada anggota.',
  },
  bayar_angsuran_pinjaman: {
    debit: 'Kas/Bank bertambah karena menerima pembayaran dari anggota',
    kredit: 'Piutang Pinjaman berkurang (pokok), Pendapatan Bunga bertambah (bunga), Pendapatan Denda (jika ada)',
    penjelasan: 'Angsuran terdiri dari pokok (mengurangi piutang) dan bunga (menambah pendapatan). Denda dikenakan jika terlambat bayar.',
  },
  // Migration templates
  saldo_awal_pokok: {
    debit: 'Modal Migrasi/Saldo Awal sebagai offset untuk menyeimbangkan neraca',
    kredit: 'Hutang Simpanan Pokok bertambah karena data anggota lama dimigrasi',
    penjelasan: 'Jurnal migrasi untuk saldo awal simpanan pokok anggota yang datanya dipindahkan dari sistem lama.',
  },
  saldo_awal_wajib: {
    debit: 'Modal Migrasi/Saldo Awal sebagai offset untuk menyeimbangkan neraca',
    kredit: 'Hutang Simpanan Wajib bertambah karena data anggota lama dimigrasi',
    penjelasan: 'Jurnal migrasi untuk saldo awal simpanan wajib anggota yang datanya dipindahkan dari sistem lama.',
  },
  saldo_awal_sukarela: {
    debit: 'Modal Migrasi/Saldo Awal sebagai offset untuk menyeimbangkan neraca',
    kredit: 'Hutang Simpanan Sukarela bertambah karena data anggota lama dimigrasi',
    penjelasan: 'Jurnal migrasi untuk saldo awal simpanan sukarela anggota yang datanya dipindahkan dari sistem lama.',
  },
  saldo_awal_pinjaman: {
    debit: 'Piutang Pinjaman bertambah karena ada tagihan dari anggota lama yang dimigrasi',
    kredit: 'Modal Migrasi/Saldo Awal sebagai offset untuk menyeimbangkan neraca',
    penjelasan: 'Jurnal migrasi untuk saldo awal piutang pinjaman anggota yang datanya dipindahkan dari sistem lama.',
  },
};

const TEMPLATE_CATEGORIES = {
  simpanan: ['simpanan_pokok', 'simpanan_wajib', 'simpanan_sukarela', 'setor_simpanan_wajib', 'setor_simpanan_sukarela', 'penarikan_simpanan_sukarela'],
  pinjaman: ['pencairan_pinjaman', 'bayar_angsuran_pinjaman'],
  migrasi: ['saldo_awal_pokok', 'saldo_awal_wajib', 'saldo_awal_sukarela', 'saldo_awal_pinjaman'],
};

export const JournalTemplatesManagement = () => {
  const { templates, loading, updateTemplateLine, toggleTemplate, resetToDefaults } = useJournalTemplates();
  const { accounts, loading: accountsLoading } = useChartOfAccounts();
  const [selectedTemplate, setSelectedTemplate] = useState<JournalTemplate | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  if (loading || accountsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Group accounts by type for easier selection
  const assetAccounts = accounts.filter(a => a.account_type === 'asset' && a.is_active);
  const liabilityAccounts = accounts.filter(a => a.account_type === 'liability' && a.is_active);
  const incomeAccounts = accounts.filter(a => a.account_type === 'income' && a.is_active);

  const getAccountOptions = (isDebit: boolean, templateType: TemplateType) => {
    // For debit entries in savings/installment receipts: use asset accounts (kas/bank)
    // For credit entries in savings: use liability accounts (simpanan)
    // For income entries: use income accounts
    
    if (templateType === 'penarikan_simpanan_sukarela') {
      // Withdrawal: Debit simpanan (liability), Credit kas (asset)
      return isDebit ? liabilityAccounts : assetAccounts;
    }
    
    if (templateType === 'pencairan_pinjaman') {
      // Loan disbursement: Debit piutang (asset), Credit kas (asset)
      return assetAccounts;
    }
    
    if (templateType === 'bayar_angsuran_pinjaman') {
      if (isDebit) return assetAccounts; // Kas/Bank
      // Credit could be piutang (asset) or pendapatan (income)
      return [...assetAccounts, ...incomeAccounts];
    }
    
    // Default for savings deposits: Debit kas (asset), Credit simpanan (liability)
    return isDebit ? assetAccounts : liabilityAccounts;
  };

  const isTemplateConfigured = (template: JournalTemplate) => {
    return template.lines.every(line => line.accountId);
  };

  const handleConfigureTemplate = (template: JournalTemplate) => {
    setSelectedTemplate(template);
    setShowConfigDialog(true);
  };

  const handleUpdateLine = (lineIndex: number, accountId: string) => {
    if (selectedTemplate) {
      updateTemplateLine(selectedTemplate.id, lineIndex, accountId);
      // Update local state
      const account = accounts.find(a => a.id === accountId);
      setSelectedTemplate(prev => {
        if (!prev) return null;
        const newLines = [...prev.lines];
        newLines[lineIndex] = {
          ...newLines[lineIndex],
          accountId,
          accountCode: account?.account_code,
          accountName: account?.account_name,
        };
        return { ...prev, lines: newLines };
      });
    }
  };

  const renderTemplateCategory = (title: string, icon: React.ReactNode, templateTypes: string[]) => {
    const categoryTemplates = templates.filter(t => templateTypes.includes(t.type));
    
    return (
      <Card className="mb-4">
        <CardHeader className="py-4">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">Aktif</TableHead>
                <TableHead>Tipe Transaksi</TableHead>
                <TableHead>Jurnal Debit</TableHead>
                <TableHead className="text-center">→</TableHead>
                <TableHead>Jurnal Kredit</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryTemplates.map(template => {
                const configured = isTemplateConfigured(template);
                const debitLines = template.lines.filter(l => l.isDebit);
                const creditLines = template.lines.filter(l => !l.isDebit);
                const tooltip = TEMPLATE_TOOLTIPS[template.type];
                
                return (
                  <TableRow key={template.id} className={!template.isActive ? 'opacity-50' : ''}>
                    <TableCell>
                      <Switch 
                        checked={template.isActive} 
                        onCheckedChange={() => toggleTemplate(template.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="font-medium">{template.name}</p>
                          <p className="text-xs text-muted-foreground">{template.description}</p>
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs p-3">
                              <div className="space-y-2 text-xs">
                                <p className="font-semibold text-sm">{template.name}</p>
                                <p className="text-muted-foreground">{tooltip.penjelasan}</p>
                                <div className="pt-2 border-t space-y-1">
                                  <p><span className="font-medium text-emerald-600">Debit:</span> {tooltip.debit}</p>
                                  <p><span className="font-medium text-rose-600">Kredit:</span> {tooltip.kredit}</p>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell>
                      {debitLines.map((line, idx) => (
                        <div key={idx} className="text-sm">
                          {line.accountCode ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {line.accountCode} - {line.accountName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic">Belum dikonfigurasi</span>
                          )}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="text-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                    </TableCell>
                    <TableCell>
                      {creditLines.map((line, idx) => (
                        <div key={idx} className="text-sm mb-1">
                          {line.accountCode ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {line.accountCode} - {line.accountName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic">Belum dikonfigurasi</span>
                          )}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      {configured ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <Check className="h-3 w-3 mr-1" />
                          Siap
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <X className="h-3 w-3 mr-1" />
                          Perlu Setup
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleConfigureTemplate(template)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const configuredCount = templates.filter(t => isTemplateConfigured(t) && t.isActive).length;
  const totalActive = templates.filter(t => t.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Template Jurnal Otomatis
          </h3>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Database className="h-3 w-3" />
            Konfigurasi tersimpan di database dan tersinkron antar admin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {configuredCount}/{totalActive} Template Siap
          </Badge>
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset Default
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 rounded-lg flex-wrap">
          <TabsTrigger 
            value="templates" 
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 rounded-md px-4 py-2 transition-all"
          >
            <Settings className="h-4 w-4" />
            Simpan Pinjam
          </TabsTrigger>
          <TabsTrigger 
            value="business-units" 
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 rounded-md px-4 py-2 transition-all"
          >
            <Building2 className="h-4 w-4" />
            Unit Usaha Lain
          </TabsTrigger>
          <TabsTrigger 
            value="audit" 
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 rounded-md px-4 py-2 transition-all"
          >
            <History className="h-4 w-4" />
            Riwayat Perubahan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          {/* Configuration Guide */}
          <JournalTemplateConfigGuide />

          {/* Quick Equation Guide */}
          <QuickEquationGuide variant="journal-templates" />

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Integrasi dengan Transaksi Anggota</AlertTitle>
            <AlertDescription>
              Template ini terintegrasi dengan transaksi yang diajukan anggota. 
              Saat admin menyetujui transaksi, jurnal akan otomatis dibuat berdasarkan template yang aktif dan terkonfigurasi.
            </AlertDescription>
          </Alert>

          {/* Savings Templates */}
          {renderTemplateCategory(
            'Transaksi Simpanan', 
            <FileText className="h-4 w-4 text-emerald-600" />,
            TEMPLATE_CATEGORIES.simpanan
          )}

          {/* Loan Templates */}
          {renderTemplateCategory(
            'Transaksi Pinjaman', 
            <FileText className="h-4 w-4 text-blue-600" />,
            TEMPLATE_CATEGORIES.pinjaman
          )}

          {/* Migration Templates */}
          {renderTemplateCategory(
            'Transaksi Migrasi', 
            <FileText className="h-4 w-4 text-purple-600" />,
            TEMPLATE_CATEGORIES.migrasi
          )}
        </TabsContent>

        <TabsContent value="business-units" className="space-y-6">
          <BusinessUnitJournalTemplatesManagement />
        </TabsContent>

        <TabsContent value="audit">
          <JournalTemplateAuditLogComponent />
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Konfigurasi Template: {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Pilih akun yang sesuai untuk setiap baris jurnal
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4 mt-4">
              {selectedTemplate.lines.map((line, idx) => (
                <div key={idx} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Badge variant={line.isDebit ? 'default' : 'secondary'} className="text-xs">
                      {line.isDebit ? 'DEBIT' : 'KREDIT'}
                    </Badge>
                    {line.description}
                  </Label>
                  <Select 
                    value={line.accountId || 'none'} 
                    onValueChange={(v) => handleUpdateLine(idx, v === 'none' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih akun..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Pilih Akun --</SelectItem>
                      {getAccountOptions(line.isDebit, selectedTemplate.type).map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_code} - {acc.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Preview Jurnal:</p>
                <div className="bg-muted rounded-lg p-3 font-mono text-sm">
                  {selectedTemplate.lines.map((line, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className={line.isDebit ? '' : 'pl-4'}>
                        {line.accountCode || '????'} - {line.accountName || 'Belum dipilih'}
                      </span>
                      <span className={line.isDebit ? 'text-emerald-600' : 'text-rose-600'}>
                        {line.isDebit ? 'D' : 'K'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
