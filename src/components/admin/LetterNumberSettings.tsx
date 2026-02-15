import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  useLetterNumberSettings, 
  useLetterSequences, 
  useIssuedLetters,
  LetterNumberSettings as LetterSettings,
  ResetPeriod,
  DynamicSource,
  generatePreviewNumber 
} from '@/hooks/useLetterNumbering';
import { useBranches } from '@/hooks/useBranches';
import { useBusinessUnits } from '@/hooks/useBusinessUnits';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { FileText, Hash, Calendar, Save, Loader2, History, RefreshCw, Settings, ListOrdered, Plus, Info, Wand2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/mockData';
import { TabNavigation, TabItem } from '@/components/shared/TabNavigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const PLACEHOLDERS = [
  { key: '{SEQ}', label: 'Nomor Urut', description: 'Nomor urut 3 digit (001, 002, ...)' },
  { key: '{PREFIX}', label: 'Prefix Surat', description: 'Prefix jenis surat (SP, PL, PS, PD)' },
  { key: '{MONTH}', label: 'Bulan Romawi', description: 'Bulan dalam angka Romawi (I, II, XII)' },
  { key: '{MONTH_NUM}', label: 'Bulan Angka', description: 'Bulan dalam angka (01, 02, 12)' },
  { key: '{YEAR}', label: 'Tahun Penuh', description: 'Tahun 4 digit (2026)' },
  { key: '{YEAR_SHORT}', label: 'Tahun Pendek', description: 'Tahun 2 digit (26)' },
  { key: '{PREFIX_GLOBAL}', label: 'Prefix Global', description: 'Prefix awal (circumfix)' },
  { key: '{SUFFIX_GLOBAL}', label: 'Suffix Global', description: 'Suffix akhir (circumfix)' },
  { key: '{INFIX}', label: 'Infix', description: 'Teks tengah (statis/dinamis)' },
  { key: '{BRANCH_CODE}', label: 'Kode Cabang', description: 'Kode cabang koperasi' },
  { key: '{UNIT_CODE}', label: 'Kode Unit', description: 'Kode unit usaha' },
];

export const LetterNumberSettings = () => {
  const { t } = useThemeLanguage();
  const { settings, loading, saveSettings } = useLetterNumberSettings();
  const { sequences, loading: seqLoading, refetch: refetchSequences } = useLetterSequences();
  const { letters, loading: lettersLoading, fetchLetters } = useIssuedLetters();
  const { branches } = useBranches();
  const { units: businessUnits } = useBusinessUnits();
  
  const [formData, setFormData] = useState<LetterSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');
  const [letterTypeFilter, setLetterTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (!loading) {
      setFormData(settings);
    }
  }, [settings, loading]);

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(formData);
    setSaving(false);
  };

  const insertPlaceholder = (placeholder: string) => {
    const currentFormat = formData.customFormat || '';
    const separator = currentFormat && !currentFormat.endsWith('/') ? '/' : '';
    setFormData({ 
      ...formData, 
      customFormat: currentFormat + separator + placeholder,
      numberFormat: 'custom'
    });
  };

  const getPreviewContext = () => {
    // Get sample branch and unit for preview (with null safety)
    const sampleBranch = branches?.find(b => b.is_active);
    const sampleUnit = businessUnits?.find(u => u.is_active);
    
    return {
      branchCode: sampleBranch?.code || 'CAB01',
      branchName: sampleBranch?.name || 'Cabang Utama',
      unitCode: sampleUnit?.code || 'SP',
      unitName: sampleUnit?.name || 'Simpan Pinjam',
    };
  };

  const getLetterTypeName = (type: string) => {
    switch (type) {
      case 'loan_approval': return t('Persetujuan Pinjaman', 'Loan Approval');
      case 'loan_settlement': return t('Pelunasan Pinjaman', 'Loan Settlement');
      case 'withdrawal': return t('Penarikan Simpanan', 'Withdrawal');
      case 'resignation': return t('Pengunduran Diri', 'Resignation');
      default: return type;
    }
  };

  const filteredLetters = letterTypeFilter === 'all' 
    ? letters 
    : letters.filter(l => l.letter_type === letterTypeFilter);

  const tabs: TabItem[] = [
    { value: 'settings', icon: Settings, label: t('Pengaturan Format', 'Format Settings') },
    { value: 'sequences', icon: ListOrdered, label: t('Status Urutan', 'Sequence Status') },
    { value: 'history', icon: History, label: t('Riwayat Surat', 'Letter History') },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Hash className="h-5 w-5" />
          {t('Pengaturan Nomor Surat', 'Letter Number Settings')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('Konfigurasi format dan penomoran surat resmi koperasi', 'Configure official cooperative letter format and numbering')}
        </p>
      </div>

      {/* Tabs */}
      <TabNavigation 
        tabs={tabs} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6 animate-fade-in">
          {/* Basic Settings & Prefix */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Basic Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t('Pengaturan Dasar', 'Basic Settings')}
                </CardTitle>
                <CardDescription>
                  {t('Periode reset dan format dasar', 'Reset period and basic format')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('Periode Reset Urutan', 'Sequence Reset Period')}</Label>
                  <Select 
                    value={formData.resetPeriod} 
                    onValueChange={(value: ResetPeriod) => setFormData({ ...formData, resetPeriod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yearly">{t('Tahunan (Reset setiap tahun)', 'Yearly (Reset every year)')}</SelectItem>
                      <SelectItem value="monthly">{t('Bulanan (Reset setiap bulan)', 'Monthly (Reset every month)')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('Mode Format', 'Format Mode')}</Label>
                  <Select 
                    value={formData.numberFormat} 
                    onValueChange={(value: 'prefix_first' | 'number_first' | 'custom') => setFormData({ ...formData, numberFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number_first">{t('Nomor Urut Dahulu (001/SP/2026)', 'Number First (001/SP/2026)')}</SelectItem>
                      <SelectItem value="prefix_first">{t('Prefix Dahulu (SP/001/2026)', 'Prefix First (SP/001/2026)')}</SelectItem>
                      <SelectItem value="custom">{t('Format Kustom (Template)', 'Custom Format (Template)')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('Tampilkan Bulan Romawi', 'Show Roman Month')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('Menambahkan bulan dalam format Romawi (I, II, XII)', 'Add month in Roman format (I, II, XII)')}
                    </p>
                  </div>
                  <Switch
                    checked={formData.includeRomanMonth}
                    onCheckedChange={(checked) => setFormData({ ...formData, includeRomanMonth: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Letter Type Prefixes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('Prefix Jenis Surat', 'Letter Type Prefixes')}
                </CardTitle>
                <CardDescription>
                  {t('Kode prefix untuk setiap jenis surat', 'Prefix codes for each letter type')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('Persetujuan Pinjaman', 'Loan Approval')}</Label>
                    <Input 
                      value={formData.loanApprovalPrefix} 
                      onChange={(e) => setFormData({ ...formData, loanApprovalPrefix: e.target.value.toUpperCase() })}
                      maxLength={5}
                      placeholder="SP"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('Pelunasan Pinjaman', 'Loan Settlement')}</Label>
                    <Input 
                      value={formData.loanSettlementPrefix} 
                      onChange={(e) => setFormData({ ...formData, loanSettlementPrefix: e.target.value.toUpperCase() })}
                      maxLength={5}
                      placeholder="PL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('Penarikan Simpanan', 'Withdrawal')}</Label>
                    <Input 
                      value={formData.withdrawalPrefix} 
                      onChange={(e) => setFormData({ ...formData, withdrawalPrefix: e.target.value.toUpperCase() })}
                      maxLength={5}
                      placeholder="PS"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('Pengunduran Diri', 'Resignation')}</Label>
                    <Input 
                      value={formData.resignationPrefix} 
                      onChange={(e) => setFormData({ ...formData, resignationPrefix: e.target.value.toUpperCase() })}
                      maxLength={5}
                      placeholder="PD"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Circumfix & Infix Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                {t('Circumfix & Infix', 'Circumfix & Infix')}
              </CardTitle>
              <CardDescription>
                {t('Prefix/suffix global dan infix dengan opsi statis atau dinamis', 'Global prefix/suffix and infix with static or dynamic options')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Prefix & Suffix Global */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {t('Prefix Global (Awal)', 'Global Prefix (Start)')}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('Teks yang ditambahkan di awal nomor surat', 'Text added at the beginning of letter number')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input 
                    value={formData.prefixGlobal} 
                    onChange={(e) => setFormData({ ...formData, prefixGlobal: e.target.value.toUpperCase() })}
                    placeholder={t('Contoh: KSPPS', 'Example: KSPPS')}
                    maxLength={20}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {t('Suffix Global (Akhir)', 'Global Suffix (End)')}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('Teks yang ditambahkan di akhir nomor surat', 'Text added at the end of letter number')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <div className="space-y-2">
                    <Select 
                      value={formData.suffixSource} 
                      onValueChange={(value: DynamicSource) => setFormData({ ...formData, suffixSource: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('Sumber suffix', 'Suffix source')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="static">{t('Statis (Teks Manual)', 'Static (Manual Text)')}</SelectItem>
                        <SelectItem value="branch">{t('Dinamis (Kode Cabang)', 'Dynamic (Branch Code)')}</SelectItem>
                        <SelectItem value="unit">{t('Dinamis (Kode Unit Usaha)', 'Dynamic (Unit Code)')}</SelectItem>
                        <SelectItem value="none">{t('Tidak Ada', 'None')}</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.suffixSource === 'static' && (
                      <Input 
                        value={formData.suffixGlobal} 
                        onChange={(e) => setFormData({ ...formData, suffixGlobal: e.target.value.toUpperCase() })}
                        placeholder={t('Contoh: BMT', 'Example: BMT')}
                        maxLength={20}
                      />
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Infix Settings */}
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {t('Sumber Infix', 'Infix Source')}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('Teks yang disisipkan di tengah nomor surat', 'Text inserted in the middle of letter number')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Select 
                      value={formData.infixSource} 
                      onValueChange={(value: DynamicSource) => setFormData({ ...formData, infixSource: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('Pilih sumber infix', 'Select infix source')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="static">{t('Statis (Teks Manual)', 'Static (Manual Text)')}</SelectItem>
                        <SelectItem value="branch">{t('Dinamis (Kode Cabang)', 'Dynamic (Branch Code)')}</SelectItem>
                        <SelectItem value="unit">{t('Dinamis (Kode Unit Usaha)', 'Dynamic (Unit Code)')}</SelectItem>
                        <SelectItem value="none">{t('Tidak Ada', 'None')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.infixSource === 'static' && (
                    <div className="space-y-2">
                      <Label>{t('Teks Infix (Statis)', 'Infix Text (Static)')}</Label>
                      <Input 
                        value={formData.infix} 
                        onChange={(e) => setFormData({ ...formData, infix: e.target.value.toUpperCase() })}
                        placeholder={t('Contoh: PUSAT', 'Example: PUSAT')}
                        maxLength={20}
                      />
                    </div>
                  )}
                </div>

                {(formData.infixSource === 'branch' || formData.suffixSource === 'branch') && branches && branches.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-2">{t('Cabang tersedia:', 'Available branches:')}</p>
                    <div className="flex flex-wrap gap-1">
                      {branches.filter(b => b.is_active).map(b => (
                        <Badge key={b.id} variant="outline" className="text-xs font-mono">
                          {b.code} - {b.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(formData.infixSource === 'unit' || formData.suffixSource === 'unit') && businessUnits && businessUnits.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-2">{t('Unit usaha tersedia:', 'Available business units:')}</p>
                    <div className="flex flex-wrap gap-1">
                      {businessUnits.filter(u => u.is_active).map(u => (
                        <Badge key={u.id} variant="outline" className="text-xs font-mono">
                          {u.code} - {u.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Custom Format Template */}
          {formData.numberFormat === 'custom' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('Template Format Kustom', 'Custom Format Template')}
                </CardTitle>
                <CardDescription>
                  {t('Buat format nomor surat sesuai kebutuhan menggunakan placeholder', 'Create letter number format as needed using placeholders')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('Template Format', 'Format Template')}</Label>
                  <Textarea 
                    value={formData.customFormat}
                    onChange={(e) => setFormData({ ...formData, customFormat: e.target.value })}
                    placeholder="{PREFIX_GLOBAL}/{SEQ}/{PREFIX}/{MONTH}/{YEAR}/{SUFFIX_GLOBAL}"
                    className="font-mono text-sm"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('Gunakan tombol di bawah untuk menambahkan placeholder', 'Use buttons below to add placeholders')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t('Tambah Placeholder:', 'Add Placeholder:')}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PLACEHOLDERS.map((p) => (
                      <TooltipProvider key={p.key}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              type="button"
                              variant="outline" 
                              size="sm"
                              className="h-7 text-xs font-mono"
                              onClick={() => insertPlaceholder(p.key)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              {p.label}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-mono text-xs">{p.key}</p>
                            <p className="text-xs text-muted-foreground">{p.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </div>

                <Button 
                  type="button"
                  variant="secondary" 
                  size="sm"
                  onClick={() => setFormData({ ...formData, customFormat: '' })}
                >
                  {t('Reset Template', 'Reset Template')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t('Preview Format', 'Format Preview')}
              </CardTitle>
              <CardDescription>
                {t('Contoh nomor surat yang akan dihasilkan', 'Example of generated letter numbers')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('Persetujuan Pinjaman', 'Loan Approval')}:</span>
                  <Badge variant="outline" className="font-mono">
                    {generatePreviewNumber(formData, 'loan_approval', getPreviewContext())}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('Penarikan Simpanan', 'Withdrawal')}:</span>
                  <Badge variant="outline" className="font-mono">
                    {generatePreviewNumber(formData, 'withdrawal', getPreviewContext())}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('Pengunduran Diri', 'Resignation')}:</span>
                  <Badge variant="outline" className="font-mono">
                    {generatePreviewNumber(formData, 'resignation', getPreviewContext())}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('Pelunasan Pinjaman', 'Loan Settlement')}:</span>
                  <Badge variant="outline" className="font-mono">
                    {generatePreviewNumber(formData, 'loan_settlement', getPreviewContext())}
                  </Badge>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• {t('Nomor urut akan direset otomatis sesuai periode yang dipilih', 'Sequence will reset automatically based on selected period')}</p>
                <p>• {t('Setiap surat yang diunduh akan mendapat nomor unik', 'Each downloaded letter will get a unique number')}</p>
                <p>• {t('Semua nomor surat tersimpan di database untuk audit', 'All letter numbers are saved in database for audit')}</p>
                {(formData.infixSource === 'branch' || formData.suffixSource === 'branch') && (
                  <p>• {t('Kode cabang akan diambil dari cabang admin yang login', 'Branch code will be taken from logged-in admin branch')}</p>
                )}
                {(formData.infixSource === 'unit' || formData.suffixSource === 'unit') && (
                  <p>• {t('Kode unit usaha akan diambil dari unit usaha terkait', 'Unit code will be taken from related business unit')}</p>
                )}
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('Simpan Pengaturan', 'Save Settings')}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sequences Tab */}
      {activeTab === 'sequences' && (
        <Card className="animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t('Status Urutan Surat', 'Letter Sequence Status')}</CardTitle>
              <CardDescription>
                {t('Urutan nomor surat saat ini per jenis dan periode', 'Current letter sequence per type and period')}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refetchSequences} disabled={seqLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${seqLoading ? 'animate-spin' : ''}`} />
              {t('Refresh', 'Refresh')}
            </Button>
          </CardHeader>
          <CardContent>
            {seqLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sequences.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('Belum ada urutan surat yang dibuat', 'No letter sequences created yet')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Jenis Surat', 'Letter Type')}</TableHead>
                    <TableHead>{t('Tahun', 'Year')}</TableHead>
                    <TableHead>{t('Bulan', 'Month')}</TableHead>
                    <TableHead className="text-right">{t('Urutan Terakhir', 'Last Sequence')}</TableHead>
                    <TableHead>{t('Diperbarui', 'Updated')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sequences.map((seq) => (
                    <TableRow key={seq.id}>
                      <TableCell>
                        <Badge variant="secondary">{getLetterTypeName(seq.letter_type)}</Badge>
                      </TableCell>
                      <TableCell>{seq.year}</TableCell>
                      <TableCell>{seq.month ? seq.month : '-'}</TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {String(seq.current_sequence).padStart(3, '0')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(seq.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card className="animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                {t('Riwayat Surat Terbit', 'Issued Letters History')}
              </CardTitle>
              <CardDescription>
                {t('Daftar semua surat yang telah diterbitkan', 'List of all issued letters')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={letterTypeFilter} onValueChange={setLetterTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('Filter jenis', 'Filter type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('Semua Jenis', 'All Types')}</SelectItem>
                  <SelectItem value="loan_approval">{t('Persetujuan Pinjaman', 'Loan Approval')}</SelectItem>
                  <SelectItem value="loan_settlement">{t('Pelunasan Pinjaman', 'Loan Settlement')}</SelectItem>
                  <SelectItem value="withdrawal">{t('Penarikan Simpanan', 'Withdrawal')}</SelectItem>
                  <SelectItem value="resignation">{t('Pengunduran Diri', 'Resignation')}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => fetchLetters()} disabled={lettersLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${lettersLoading ? 'animate-spin' : ''}`} />
                {t('Refresh', 'Refresh')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lettersLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLetters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('Belum ada surat yang diterbitkan', 'No letters issued yet')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Nomor Surat', 'Letter Number')}</TableHead>
                    <TableHead>{t('Jenis', 'Type')}</TableHead>
                    <TableHead>{t('Nama Anggota', 'Member Name')}</TableHead>
                    <TableHead>{t('No. Anggota', 'Member No.')}</TableHead>
                    <TableHead>{t('Tanggal Terbit', 'Issue Date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLetters.map((letter) => (
                    <TableRow key={letter.id}>
                      <TableCell className="font-mono font-semibold">{letter.letter_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getLetterTypeName(letter.letter_type)}</Badge>
                      </TableCell>
                      <TableCell>{letter.member_name}</TableCell>
                      <TableCell>{letter.member_number || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(letter.issued_date)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
