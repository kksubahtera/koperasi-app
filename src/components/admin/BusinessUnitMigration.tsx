import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Plus, 
  Upload, 
  Download, 
  Store, 
  Loader2, 
  Search,
  Trash2,
  Calendar as CalendarIcon,
  FileSpreadsheet,
  AlertCircle,
  Check,
  History
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/mockData';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useBusinessUnitMigration, BusinessUnitMigrationEntry } from '@/hooks/useBusinessUnitMigration';
import { useBusinessUnits } from '@/hooks/useBusinessUnits';
import { useAuth } from '@/contexts/AuthContext';
import { ExcelDropZone } from './ExcelDropZone';
import { ExcelPreviewDialog, PreviewRow, PreviewColumn } from './ExcelPreviewDialog';
import { createAndDownloadExcelFromJson, readExcelFile } from '@/lib/excelUtils';

interface BusinessUnitMigrationProps {
  onBack: () => void;
}

interface MemberOption {
  id: string;
  name: string;
  memberNumber: string;
}

export default function BusinessUnitMigration({ onBack }: BusinessUnitMigrationProps) {
  const { user } = useAuth();
  const { units, loading: unitsLoading } = useBusinessUnits();
  const {
    loading,
    migratedTransactions,
    fetchMigratedTransactions,
    addMigratedTransaction,
    bulkImportTransactions,
    deleteMigratedTransaction,
  } = useBusinessUnitMigration();

  const [activeTab, setActiveTab] = useState('individual');
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyYear, setHistoryYear] = useState<number | undefined>();
  const [historyUnitId, setHistoryUnitId] = useState<string | undefined>();

  // Individual form state
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [transactionDate, setTransactionDate] = useState<Date | undefined>();
  const [transactionType, setTransactionType] = useState('sale');
  const [amount, setAmount] = useState(0);
  const [quantity, setQuantity] = useState<number | undefined>();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Excel import state
  const [previewDialog, setPreviewDialog] = useState<{
    open: boolean;
    data: PreviewRow[];
    columns: PreviewColumn[];
    validRowCount: number;
    invalidRowCount: number;
    warningRowCount: number;
    errors: { row: number; message: string }[];
    warnings: { row: number; message: string }[];
    parsedEntries: BusinessUnitMigrationEntry[];
  } | null>(null);

  // Fetch members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, name, member_number')
          .eq('approval_status', 'approved')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;

        setMembers((data || []).map(p => ({
          id: p.user_id,
          name: p.name,
          memberNumber: p.member_number || '-',
        })));
      } catch (error) {
        console.error('Error fetching members:', error);
        toast.error('Gagal memuat data anggota');
      } finally {
        setMembersLoading(false);
      }
    };

    fetchMembers();
  }, []);

  // Fetch history when tab changes or filters change
  useEffect(() => {
    if (activeTab === 'history') {
      fetchMigratedTransactions(historyYear, historyUnitId);
    }
  }, [activeTab, historyYear, historyUnitId, fetchMigratedTransactions]);

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.memberNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setSelectedMemberId('');
    setSelectedUnitId('');
    setTransactionDate(undefined);
    setTransactionType('sale');
    setAmount(0);
    setQuantity(undefined);
    setDescription('');
  };

  const handleSubmitIndividual = async () => {
    if (!selectedMemberId) {
      toast.error('Pilih anggota terlebih dahulu');
      return;
    }
    if (!selectedUnitId) {
      toast.error('Pilih unit usaha terlebih dahulu');
      return;
    }
    if (!transactionDate) {
      toast.error('Pilih tanggal transaksi');
      return;
    }
    if (amount <= 0) {
      toast.error('Jumlah harus lebih dari 0');
      return;
    }

    const member = members.find(m => m.id === selectedMemberId);
    const unit = units.find(u => u.id === selectedUnitId);

    if (!member || !unit) return;

    setIsSubmitting(true);
    
    const entry: BusinessUnitMigrationEntry = {
      userId: selectedMemberId,
      memberName: member.name,
      memberNumber: member.memberNumber,
      businessUnitId: selectedUnitId,
      businessUnitCode: unit.code,
      businessUnitName: unit.name,
      transactionDate: format(transactionDate, 'yyyy-MM-dd'),
      transactionType,
      amount,
      quantity,
      description: description || undefined,
    };

    const success = await addMigratedTransaction(entry, user?.id);
    
    if (success) {
      resetForm();
    }
    
    setIsSubmitting(false);
  };

  // Download Excel template
  const downloadTemplate = async () => {
    const templateData = [
      {
        'No. Anggota': '001',
        'Nama Anggota': 'Contoh Nama',
        'Kode Unit': 'TK',
        'Tanggal (YYYY-MM-DD)': '2023-06-15',
        'Tipe Transaksi': 'sale',
        'Jumlah': 500000,
        'Quantity': 5,
        'Deskripsi': 'Pembelian sembako',
      },
    ];

    await createAndDownloadExcelFromJson([
      { name: 'Transaksi Unit Usaha', data: templateData, columns: [
        { width: 12 },
        { width: 25 },
        { width: 12 },
        { width: 18 },
        { width: 15 },
        { width: 15 },
        { width: 10 },
        { width: 25 },
      ]}
    ], 'template_migrasi_transaksi_unit_usaha.xlsx');
    toast.success('Template berhasil diunduh');
  };

  // Handle Excel file upload
  const handleExcelFile = useCallback(async (file: File) => {
    try {
      const jsonData = await readExcelFile(file);

      if (jsonData.length === 0) {
        toast.error('File Excel kosong');
        return;
      }

      // Create member lookup maps
      const memberByNumber = new Map(members.map(m => [m.memberNumber?.toLowerCase(), m]));
      const memberByName = new Map(members.map(m => [m.name.toLowerCase(), m]));
      
      // Create unit lookup map
      const unitByCode = new Map(units.map(u => [u.code.toLowerCase(), u]));

      const previewData: PreviewRow[] = [];
        const parsedEntries: BusinessUnitMigrationEntry[] = [];
        const errors: { row: number; message: string }[] = [];
        const warnings: { row: number; message: string }[] = [];
        let validCount = 0;
        let invalidCount = 0;
        let warningCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowNum = i + 2; // Excel row number (1-indexed + header)
          
          const memberNumber = String(row['No. Anggota'] || '').trim();
          const memberName = String(row['Nama Anggota'] || '').trim();
          const unitCode = String(row['Kode Unit'] || '').trim();
          const dateStr = String(row['Tanggal (YYYY-MM-DD)'] || '').trim();
          const txType = String(row['Tipe Transaksi'] || 'sale').trim().toLowerCase();
          const amount = Number(row['Jumlah']) || 0;
          const quantity = row['Quantity'] ? Number(row['Quantity']) : undefined;
          const description = String(row['Deskripsi'] || '').trim();

          // Match member
          let matchedMember = memberByNumber.get(memberNumber.toLowerCase());
          if (!matchedMember) {
            matchedMember = memberByName.get(memberName.toLowerCase());
          }

          // Match unit
          const matchedUnit = unitByCode.get(unitCode.toLowerCase());

          // Validate
          const rowErrors: string[] = [];
          const rowWarnings: string[] = [];

          if (!matchedMember) {
            rowErrors.push('Anggota tidak ditemukan');
          }
          if (!matchedUnit) {
            rowErrors.push('Unit usaha tidak ditemukan');
          }
          if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            rowErrors.push('Format tanggal tidak valid');
          } else {
            const txDate = new Date(dateStr);
            if (isNaN(txDate.getTime())) {
              rowErrors.push('Tanggal tidak valid');
            } else if (txDate > new Date()) {
              rowErrors.push('Tanggal tidak boleh di masa depan');
            }
          }
          if (!['sale', 'purchase', 'service'].includes(txType)) {
            rowErrors.push('Tipe transaksi tidak valid');
          }
          if (amount <= 0) {
            rowErrors.push('Jumlah harus > 0');
          }

          const hasErrors = rowErrors.length > 0;
          const hasWarnings = rowWarnings.length > 0;

          if (hasErrors) {
            invalidCount++;
            errors.push({ row: rowNum, message: rowErrors.join('; ') });
          } else {
            validCount++;
            if (hasWarnings) {
              warningCount++;
              warnings.push({ row: rowNum, message: rowWarnings.join('; ') });
            }

            parsedEntries.push({
              userId: matchedMember!.id,
              memberName: matchedMember!.name,
              memberNumber: matchedMember!.memberNumber,
              businessUnitId: matchedUnit!.id,
              businessUnitCode: matchedUnit!.code,
              businessUnitName: matchedUnit!.name,
              transactionDate: dateStr,
              transactionType: txType,
              amount,
              quantity,
              description: description || undefined,
            });
          }

          previewData.push({
            data: {
              memberNumber,
              memberName,
              matchedMember: matchedMember?.name || '-',
              unitCode,
              matchedUnit: matchedUnit?.name || '-',
              date: dateStr,
              type: txType,
              amount: formatCurrency(amount),
              quantity: quantity?.toString() || '-',
              description: description || '-',
            },
            status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'valid',
            errors: rowErrors,
          });
        }

        const columns: PreviewColumn[] = [
          { key: 'memberNumber', label: 'No. Anggota' },
          { key: 'matchedMember', label: 'Matched Member' },
          { key: 'unitCode', label: 'Kode Unit' },
          { key: 'matchedUnit', label: 'Matched Unit' },
          { key: 'date', label: 'Tanggal' },
          { key: 'type', label: 'Tipe' },
          { key: 'amount', label: 'Jumlah' },
          { key: 'quantity', label: 'Qty' },
        ];

        setPreviewDialog({
          open: true,
          data: previewData,
          columns,
          validRowCount: validCount,
          invalidRowCount: invalidCount,
          warningRowCount: warningCount,
          errors,
          warnings,
          parsedEntries,
        });
    } catch (error) {
      console.error('Error parsing Excel:', error);
      toast.error('Gagal membaca file Excel');
    }
  }, [members, units]);

  const handlePreviewConfirm = async () => {
    if (!previewDialog || previewDialog.parsedEntries.length === 0) return;

    const result = await bulkImportTransactions(previewDialog.parsedEntries, user?.id);
    
    setPreviewDialog(null);
    
    if (result.success > 0) {
      fetchMigratedTransactions(historyYear, historyUnitId);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Yakin ingin menghapus transaksi migrasi ini?')) return;
    
    const success = await deleteMigratedTransaction(id);
    if (success) {
      fetchMigratedTransactions(historyYear, historyUnitId);
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      sale: 'Penjualan',
      purchase: 'Pembelian',
      service: 'Jasa',
    };
    return types[type] || type;
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Migrasi Transaksi Unit Usaha
          </h2>
          <p className="text-sm text-muted-foreground">
            Import riwayat transaksi unit usaha untuk anggota lama
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="individual" className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Input Individual</span>
            <span className="sm:hidden">Individual</span>
          </TabsTrigger>
          <TabsTrigger value="excel" className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import Excel</span>
            <span className="sm:hidden">Excel</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Riwayat Migrasi</span>
            <span className="sm:hidden">Riwayat</span>
          </TabsTrigger>
        </TabsList>

        {/* Individual Input Tab */}
        <TabsContent value="individual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Input Transaksi Individual</CardTitle>
              <CardDescription>
                Tambahkan transaksi unit usaha satu per satu
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Member Selection */}
              <div className="space-y-2">
                <Label>Pilih Anggota *</Label>
                <div className="space-y-2">
                  <SearchInput
                    placeholder="Cari nama atau nomor anggota..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    containerClassName="w-full"
                  />
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[150px] border rounded-md">
                      <div className="p-2 space-y-1">
                        {filteredMembers.slice(0, 50).map(member => (
                          <div
                            key={member.id}
                            onClick={() => setSelectedMemberId(member.id)}
                            className={`p-2 rounded cursor-pointer transition-colors ${
                              selectedMemberId === member.id
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <div className="font-medium text-sm">{member.name}</div>
                            <div className={`text-xs ${
                              selectedMemberId === member.id 
                                ? 'text-primary-foreground/70' 
                                : 'text-muted-foreground'
                            }`}>
                              {member.memberNumber}
                            </div>
                          </div>
                        ))}
                        {filteredMembers.length === 0 && (
                          <p className="text-center text-sm text-muted-foreground py-4">
                            Tidak ada anggota ditemukan
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>

              {/* Unit Selection */}
              <div className="space-y-2">
                <Label>Unit Usaha *</Label>
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih unit usaha" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.filter(u => u.is_active).map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.code} - {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date and Type */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tanggal Transaksi *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {transactionDate 
                          ? format(transactionDate, 'dd MMM yyyy', { locale: idLocale })
                          : 'Pilih tanggal'
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={transactionDate}
                        onSelect={setTransactionDate}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Tipe Transaksi *</Label>
                  <Select value={transactionType} onValueChange={setTransactionType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">Penjualan</SelectItem>
                      <SelectItem value="purchase">Pembelian</SelectItem>
                      <SelectItem value="service">Jasa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Amount and Quantity */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Jumlah (Rp) *</Label>
                  <CurrencyInput
                    value={amount}
                    onChange={setAmount}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quantity (opsional)</Label>
                  <Input
                    type="number"
                    value={quantity || ''}
                    onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Jumlah item"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Deskripsi (opsional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Pembelian sembako"
                />
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmitIndividual}
                disabled={isSubmitting || loading}
                className="w-full gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Tambah Transaksi
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Excel Import Tab */}
        <TabsContent value="excel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Import dari Excel
              </CardTitle>
              <CardDescription>
                Upload file Excel untuk import transaksi secara massal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Download */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span>
                    Download template Excel terlebih dahulu untuk format yang benar
                  </span>
                  <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                </AlertDescription>
              </Alert>

              {/* Info about valid values */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Tipe Transaksi valid:</strong> sale, purchase, service</p>
                <p><strong>Format Tanggal:</strong> YYYY-MM-DD (contoh: 2023-06-15)</p>
                <p><strong>Kode Unit:</strong> Sesuai dengan kode unit usaha yang terdaftar</p>
              </div>

              {/* Drop Zone */}
              <ExcelDropZone
                onFileSelect={handleExcelFile}
                onDownloadTemplate={downloadTemplate}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Riwayat Migrasi Transaksi
              </CardTitle>
              <CardDescription>
                Daftar transaksi unit usaha yang sudah dimigrasi
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Select 
                  value={historyYear?.toString() || ''} 
                  onValueChange={(v) => setHistoryYear(v ? Number(v) : undefined)}
                >
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Semua Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua Tahun</SelectItem>
                    {yearOptions.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select 
                  value={historyUnitId || ''} 
                  onValueChange={(v) => setHistoryUnitId(v || undefined)}
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Semua Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua Unit</SelectItem>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.code} - {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  variant="outline" 
                  onClick={() => fetchMigratedTransactions(historyYear, historyUnitId)}
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  Filter
                </Button>
              </div>

              {/* Table */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : migratedTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Belum ada transaksi migrasi</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="max-h-[400px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Anggota</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Tipe</TableHead>
                          <TableHead className="text-right">Jumlah</TableHead>
                          <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {migratedTransactions.map(tx => (
                          <TableRow key={tx.id}>
                            <TableCell>
                              <div className="font-medium text-sm">{tx.memberName}</div>
                              <div className="text-xs text-muted-foreground">{tx.memberNumber}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{tx.businessUnitCode}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(tx.transactionDate), 'dd MMM yyyy', { locale: idLocale })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {getTransactionTypeLabel(tx.transactionType)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(tx.amount)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              {migratedTransactions.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Total: {migratedTransactions.length} transaksi migrasi
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Excel Preview Dialog */}
      {previewDialog && (
        <ExcelPreviewDialog
          open={previewDialog.open}
          onOpenChange={(open) => !open && setPreviewDialog(null)}
          title="Preview Import Transaksi Unit Usaha"
          description="Verifikasi data transaksi sebelum import ke sistem"
          data={previewDialog.data}
          columns={previewDialog.columns}
          validRowCount={previewDialog.validRowCount}
          invalidRowCount={previewDialog.invalidRowCount}
          warningRowCount={previewDialog.warningRowCount}
          errors={previewDialog.errors.map(e => `Baris ${e.row}: ${e.message}`)}
          warnings={previewDialog.warnings.map(w => `Baris ${w.row}: ${w.message}`)}
          onConfirm={handlePreviewConfirm}
          onCancel={() => setPreviewDialog(null)}
        />
      )}
    </div>
  );
}
