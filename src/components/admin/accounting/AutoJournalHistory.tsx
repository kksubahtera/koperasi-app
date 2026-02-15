import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilterSelect } from '@/components/ui/filter-select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { 
  Loader2, Zap, FileText, ExternalLink, Eye, 
  ArrowRight, Calendar, User, Banknote, ChevronLeft, ChevronRight,
  Download, Filter, X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency, formatShortDate, getTransactionTypeLabel, formatDate } from '@/lib/mockData';
import { QuickEquationGuide } from './QuickEquationGuide';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { createAndDownloadExcelMixed, createAndDownloadExcelAoA } from '@/lib/excelUtils';
import { toast } from 'sonner';

interface AutoJournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  reference_type: string;
  reference_id: string | null;
  total_debit: number;
  total_credit: number;
  status: string;
  created_at: string;
  lines?: {
    id: string;
    account_id: string;
    debit_amount: number;
    credit_amount: number;
    description: string | null;
    account?: {
      account_code: string;
      account_name: string;
    };
  }[];
  transaction?: {
    id: string;
    type: string;
    amount: number;
    date: string;
    status: string;
    user_id: string;
    profiles?: {
      name: string;
      member_number: string | null;
    };
  };
}

const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  simpanan_pokok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  simpanan_wajib: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  simpanan_sukarela: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  setor_simpanan_wajib: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  setor_simpanan_sukarela: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  penarikan_simpanan_sukarela: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400',
  pencairan_pinjaman: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
  bayar_angsuran_pinjaman: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
};

type PeriodPreset = 'all' | 'this-month' | 'last-month' | 'this-year' | 'custom';

export const AutoJournalHistory = () => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<AutoJournalEntry | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  // Period filter state
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  // Fetch auto-generated journal entries (where reference_type = 'transaction')
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['auto-journal-history'],
    queryFn: async () => {
      const { data: journalEntries, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('reference_type', 'transaction')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch related transaction data
      const entriesWithTransactions: AutoJournalEntry[] = [];
      
      for (const entry of journalEntries || []) {
        let transaction = null;
        
        if (entry.reference_id) {
          // Try to find transaction by looking in notes or by matching description
          const { data: txData } = await supabase
            .from('transactions')
            .select('id, type, amount, date, status, user_id')
            .eq('status', 'approved')
            .order('approved_at', { ascending: false })
            .limit(1);
          
          // Match transaction by description pattern
          const descMatch = entry.description.match(/- (.+)$/);
          if (descMatch) {
            const memberName = descMatch[1];
            const { data: profileData } = await supabase
              .from('profiles')
              .select('user_id, name, member_number')
              .ilike('name', `%${memberName}%`)
              .limit(1);
            
            if (profileData && profileData.length > 0) {
              const { data: matchedTx } = await supabase
                .from('transactions')
                .select('id, type, amount, date, status, user_id')
                .eq('user_id', profileData[0].user_id)
                .eq('status', 'approved')
                .order('approved_at', { ascending: false })
                .limit(1);
              
              if (matchedTx && matchedTx.length > 0) {
                transaction = {
                  ...matchedTx[0],
                  profiles: {
                    name: profileData[0].name,
                    member_number: profileData[0].member_number
                  }
                };
              }
            }
          }
        }
        
        entriesWithTransactions.push({
          ...entry,
          transaction: transaction || undefined
        });
      }
      
      return entriesWithTransactions;
    }
  });

  // Fetch entry lines when viewing details
  const fetchEntryLines = async (entryId: string) => {
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select(`
        id, account_id, debit_amount, credit_amount, description,
        account:chart_of_accounts(account_code, account_name)
      `)
      .eq('journal_entry_id', entryId);
    
    return lines?.map(line => ({
      ...line,
      account: line.account || undefined
    })) || [];
  };

  const handleViewDetail = async (entry: AutoJournalEntry) => {
    const lines = await fetchEntryLines(entry.id);
    setSelectedEntry({ ...entry, lines });
    setShowDetailDialog(true);
  };

  // Handle period preset changes
  const handlePeriodPresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    
    switch (preset) {
      case 'this-month':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        setStartDate(startOfMonth(lastMonth));
        setEndDate(endOfMonth(lastMonth));
        break;
      case 'this-year':
        setStartDate(startOfYear(now));
        setEndDate(endOfYear(now));
        break;
      case 'all':
        setStartDate(undefined);
        setEndDate(undefined);
        break;
      case 'custom':
        // Keep current dates for custom
        break;
    }
  };

  const clearPeriodFilter = () => {
    setPeriodPreset('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = 
        entry.entry_number.toLowerCase().includes(search.toLowerCase()) ||
        entry.description.toLowerCase().includes(search.toLowerCase()) ||
        entry.transaction?.profiles?.name?.toLowerCase().includes(search.toLowerCase());
      
      const matchesType = filterType === 'all' || 
        entry.description.toLowerCase().includes(filterType.toLowerCase());
      
      // Period filter
      let matchesPeriod = true;
      if (startDate || endDate) {
        const entryDate = new Date(entry.entry_date);
        if (startDate && entryDate < startDate) matchesPeriod = false;
        if (endDate && entryDate > endDate) matchesPeriod = false;
      }
      
      return matchesSearch && matchesType && matchesPeriod;
    });
  }, [entries, search, filterType, startDate, endDate]);

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / pageSize);
  const paginatedEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize);

  // Statistics based on filtered entries
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);
    
    return {
      total: filteredEntries.length,
      today: filteredEntries.filter(e => e.entry_date === today).length,
      thisMonth: filteredEntries.filter(e => e.entry_date.startsWith(thisMonth)).length,
      totalAmount: filteredEntries.reduce((sum, e) => sum + e.total_debit, 0),
    };
  }, [filteredEntries]);

  // Extract transaction type from description
  const getTransactionType = (description: string): string => {
    if (description.includes('Simpanan Pokok')) return 'simpanan_pokok';
    if (description.includes('Setor Simpanan Wajib') || description.includes('Simpanan Wajib')) return 'simpanan_wajib';
    if (description.includes('Setor Simpanan Sukarela') || description.includes('Simpanan Sukarela')) return 'simpanan_sukarela';
    if (description.includes('Penarikan')) return 'penarikan_simpanan_sukarela';
    if (description.includes('Pencairan')) return 'pencairan_pinjaman';
    if (description.includes('Angsuran')) return 'bayar_angsuran_pinjaman';
    return 'simpanan_wajib';
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (filteredEntries.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    try {
      // Fetch all entry lines for export
      const entriesWithLines = await Promise.all(
        filteredEntries.map(async (entry) => {
          const lines = await fetchEntryLines(entry.id);
          return { ...entry, lines };
        })
      );

      // Prepare journal entries sheet data
      const journalHeaders = [
        'No',
        'No. Jurnal',
        'Tanggal',
        'Tipe Transaksi',
        'Keterangan',
        'Total Debit',
        'Total Kredit',
        'Status',
        'Dibuat Pada'
      ];

      const journalData = entriesWithLines.map((entry, index) => [
        index + 1,
        entry.entry_number,
        formatDate(entry.entry_date),
        getTransactionTypeLabel(getTransactionType(entry.description) as any),
        entry.description,
        entry.total_debit,
        entry.total_credit,
        'Otomatis',
        formatDate(entry.created_at)
      ]);

      // Prepare journal lines sheet data
      const linesHeaders = [
        'No. Jurnal',
        'Tanggal',
        'Kode Akun',
        'Nama Akun',
        'Keterangan Baris',
        'Debit',
        'Kredit'
      ];

      const linesData: (string | number)[][] = [];
      entriesWithLines.forEach(entry => {
        entry.lines?.forEach(line => {
          linesData.push([
            entry.entry_number,
            formatDate(entry.entry_date),
            line.account?.account_code || '-',
            line.account?.account_name || '-',
            line.description || entry.description,
            line.debit_amount,
            line.credit_amount
          ]);
        });
      });

      // Add summary sheet data
      const periodLabel = startDate && endDate 
        ? `${format(startDate, 'dd MMM yyyy', { locale: idLocale })} - ${format(endDate, 'dd MMM yyyy', { locale: idLocale })}`
        : 'Semua Periode';

      const totalDebit = filteredEntries.reduce((sum, e) => sum + e.total_debit, 0);
      const totalCredit = filteredEntries.reduce((sum, e) => sum + e.total_credit, 0);

      const summaryData = [
        ['Laporan Jurnal Otomatis', ''],
        ['', ''],
        ['Periode', periodLabel],
        ['Total Jurnal', filteredEntries.length],
        ['', ''],
        ['Total Debit', formatCurrency(totalDebit)],
        ['Total Kredit', formatCurrency(totalCredit)],
        ['', ''],
        ['Tanggal Export', formatDate(new Date().toISOString())],
      ];

      // Generate filename with period
      let filename = 'jurnal-otomatis';
      if (startDate && endDate) {
        filename += `-${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`;
      }
      filename += `-${format(new Date(), 'yyyyMMdd')}.xlsx`;

      await createAndDownloadExcelAoA(
        [
          { name: 'Jurnal Otomatis', data: [journalHeaders, ...journalData] },
          { name: 'Detail Baris Jurnal', data: [linesHeaders, ...linesData] },
          { name: 'Ringkasan', data: summaryData }
        ],
        filename
      );
      toast.success(`Berhasil mengekspor ${filteredEntries.length} jurnal ke Excel`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Gagal mengekspor data');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Riwayat Jurnal Otomatis
          </h3>
          <p className="text-sm text-muted-foreground">
            Log semua jurnal yang dibuat otomatis dari transaksi anggota
          </p>
        </div>
        <Button onClick={handleExportExcel} className="gap-2" disabled={filteredEntries.length === 0}>
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {/* Period Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter Periode:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterSelect
                value={periodPreset}
                onValueChange={(v) => handlePeriodPresetChange(v as PeriodPreset)}
                options={[
                  { value: 'this-month', label: 'Bulan Ini' },
                  { value: 'last-month', label: 'Bulan Lalu' },
                  { value: 'this-year', label: 'Tahun Ini' },
                  { value: 'custom', label: 'Kustom' },
                ]}
                placeholder="Pilih periode"
                allLabel="Semua Periode"
                triggerClassName="w-40"
              />

              {(periodPreset === 'custom' || startDate || endDate) && (
                <DateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={(date) => {
                    setStartDate(date);
                    setPeriodPreset('custom');
                  }}
                  onEndDateChange={(date) => {
                    setEndDate(date);
                    setPeriodPreset('custom');
                  }}
                  onClear={clearPeriodFilter}
                  dateFormat="dd/MM/yyyy"
                  buttonClassName="w-36"
                />
              )}
            </div>

            {(startDate || endDate) && (
              <Badge variant="secondary" className="gap-1">
                <Calendar className="h-3 w-3" />
                {startDate && format(startDate, 'dd MMM yyyy', { locale: idLocale })}
                {startDate && endDate && ' - '}
                {endDate && format(endDate, 'dd MMM yyyy', { locale: idLocale })}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Guide */}
      <QuickEquationGuide variant="journal-templates" />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Jurnal</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Calendar className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.today}</p>
                <p className="text-xs text-muted-foreground">Hari Ini</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.thisMonth}</p>
                <p className="text-xs text-muted-foreground">Bulan Ini</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Banknote className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(stats.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">Total Nominal</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Daftar Jurnal Otomatis
            </CardTitle>
            <div className="flex items-center gap-2">
              <SearchInput
                placeholder="Cari jurnal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                containerClassName="w-full sm:w-64"
              />
              <FilterSelect
                value={filterType}
                onValueChange={setFilterType}
                options={[
                  { value: 'simpanan', label: 'Simpanan' },
                  { value: 'angsuran', label: 'Angsuran' },
                  { value: 'penarikan', label: 'Penarikan' },
                ]}
                placeholder="Filter tipe"
                allLabel="Semua Tipe"
                triggerClassName="w-48"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {paginatedEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {search ? 'Tidak ada jurnal yang cocok' : 'Belum ada jurnal otomatis'}
              </p>
            </div>
          ) : (
            <>
              <ResponsiveTable>
                <Table>
                  <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>No. Jurnal</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Tipe Transaksi</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEntries.map((entry) => {
                    const txType = getTransactionType(entry.description);
                    const colorClass = TRANSACTION_TYPE_COLORS[txType] || 'bg-gray-100 text-gray-700';
                    
                    return (
                      <TableRow key={entry.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {entry.entry_number}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatShortDate(entry.entry_date)}
                        </TableCell>
                        <TableCell>
                          <Badge className={colorClass}>
                            {getTransactionTypeLabel(txType as any)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate text-sm">
                            {entry.description}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(entry.total_debit)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="outline" 
                            className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            Otomatis
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewDetail(entry)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </ResponsiveTable>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, filteredEntries.length)} dari {filteredEntries.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      {page} / {totalPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detail Jurnal: {selectedEntry?.entry_number}
            </DialogTitle>
            <DialogDescription>
              Jurnal otomatis yang dibuat dari transaksi anggota
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4 mt-4">
              {/* Entry Info */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border">
                <div>
                  <p className="text-xs text-muted-foreground">Tanggal</p>
                  <p className="font-medium">{formatShortDate(selectedEntry.entry_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-medium">{formatCurrency(selectedEntry.total_debit)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Keterangan</p>
                  <p className="font-medium">{selectedEntry.description}</p>
                </div>
              </div>

              {/* Journal Lines */}
              <div>
                <p className="text-sm font-medium mb-2">Detail Jurnal</p>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Akun</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Kredit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedEntry.lines?.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                {line.account?.account_code}
                              </Badge>
                              <span className="text-sm">{line.account?.account_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(selectedEntry.lines?.reduce((s, l) => s + l.debit_amount, 0) || 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(selectedEntry.lines?.reduce((s, l) => s + l.credit_amount, 0) || 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Transaction Link */}
              {selectedEntry.transaction && (
                <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium flex items-center gap-2 mb-2">
                    <User className="h-4 w-4" />
                    Transaksi Terkait
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedEntry.transaction.profiles?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedEntry.transaction.profiles?.member_number} • {getTransactionTypeLabel(selectedEntry.transaction.type as any)}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600">
                      {selectedEntry.transaction.status}
                    </Badge>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
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
