import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { 
  Building2, Calendar as CalendarIcon, TrendingUp, User, ShoppingCart, Package, Wrench, Ticket, Loader2, Filter
} from 'lucide-react';
import { ExportButtons } from '@/components/ui/export-buttons';
import { RupiahIcon } from '@/components/ui/rupiah-icon';
import { useBusinessUnits } from '@/hooks/useBusinessUnits';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { escapeHtml } from '@/lib/exportUtils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell
} from 'recharts';
import { createAndDownloadExcelMixed } from '@/lib/excelUtils';
import { toast } from 'sonner';

interface TransactionData {
  id: string;
  user_id: string;
  business_unit_id: string;
  transaction_date: string;
  transaction_type: string;
  description: string | null;
  amount: number;
  quantity: number;
  is_member_transaction: boolean;
  notes: string | null;
  user_name: string;
  member_number: string;
  unit_name: string;
  unit_code: string;
}

interface UnitSummary {
  unitId: string;
  unitCode: string;
  unitName: string;
  totalTransactions: number;
  totalAmount: number;
  memberTransactions: number;
  memberAmount: number;
  nonMemberTransactions: number;
  nonMemberAmount: number;
}

interface MemberSummary {
  userId: string;
  userName: string;
  memberNumber: string;
  totalAmount: number;
  transactionCount: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const getTransactionTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    purchase: 'Belanja',
    deposit: 'Setor Produk',
    service: 'Jasa',
    ticket: 'Tiket/Paket',
  };
  return labels[type] || type;
};

const getTransactionTypeIcon = (type: string) => {
  switch (type) {
    case 'purchase': return <ShoppingCart className="h-4 w-4" />;
    case 'deposit': return <Package className="h-4 w-4" />;
    case 'service': return <Wrench className="h-4 w-4" />;
    case 'ticket': return <Ticket className="h-4 w-4" />;
    default: return <RupiahIcon className="h-4 w-4" />;
  }
};

type PeriodPreset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

export const BusinessUnitReport = () => {
  const { units, loading: unitsLoading } = useBusinessUnits();
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [onlyMemberTransactions, setOnlyMemberTransactions] = useState(false);

  // Period presets
  useEffect(() => {
    const now = new Date();
    switch (periodPreset) {
      case 'this_month':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        setStartDate(startOfMonth(lastMonth));
        setEndDate(endOfMonth(lastMonth));
        break;
      case 'this_quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
        setStartDate(quarterStart);
        setEndDate(quarterEnd);
        break;
      case 'this_year':
        setStartDate(startOfYear(now));
        setEndDate(endOfYear(now));
        break;
    }
  }, [periodPreset]);

  // Fetch transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('business_unit_transactions')
          .select(`
            *,
            profiles:user_id (name, member_number),
            business_units:business_unit_id (name, code)
          `)
          .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
          .lte('transaction_date', format(endDate, 'yyyy-MM-dd'))
          .order('transaction_date', { ascending: false });

        if (selectedUnit !== 'all') {
          query = query.eq('business_unit_id', selectedUnit);
        }

        if (onlyMemberTransactions) {
          query = query.eq('is_member_transaction', true);
        }

        const { data, error } = await query;

        if (error) {
          // Hanya log error, jangan tampilkan toast untuk query normal
          console.error('Error fetching transactions:', error);
          setTransactions([]);
          return;
        }

        // Data kosong adalah kondisi normal, bukan error
        if (!data || data.length === 0) {
          setTransactions([]);
          return;
        }

        const formatted: TransactionData[] = data.map((t: any) => ({
          id: t.id,
          user_id: t.user_id,
          business_unit_id: t.business_unit_id,
          transaction_date: t.transaction_date,
          transaction_type: t.transaction_type,
          description: t.description,
          amount: t.amount,
          quantity: t.quantity || 1,
          is_member_transaction: t.is_member_transaction,
          notes: t.notes,
          user_name: t.profiles?.name || (t.is_member_transaction ? 'Unknown' : 'Non-Anggota'),
          member_number: t.profiles?.member_number || '-',
          unit_name: t.business_units?.name || 'Unknown',
          unit_code: t.business_units?.code || '-',
        }));

        setTransactions(formatted);
      } catch (error) {
        // Catch unexpected errors only
        console.error('Unexpected error fetching transactions:', error);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [startDate, endDate, selectedUnit, onlyMemberTransactions]);

  // Calculate summaries
  const unitSummaries = useMemo((): UnitSummary[] => {
    const summaryMap = new Map<string, UnitSummary>();
    
    transactions.forEach(tx => {
      if (!summaryMap.has(tx.business_unit_id)) {
        summaryMap.set(tx.business_unit_id, {
          unitId: tx.business_unit_id,
          unitCode: tx.unit_code,
          unitName: tx.unit_name,
          totalTransactions: 0,
          totalAmount: 0,
          memberTransactions: 0,
          memberAmount: 0,
          nonMemberTransactions: 0,
          nonMemberAmount: 0,
        });
      }
      
      const summary = summaryMap.get(tx.business_unit_id)!;
      summary.totalTransactions++;
      summary.totalAmount += tx.amount;
      
      if (tx.is_member_transaction) {
        summary.memberTransactions++;
        summary.memberAmount += tx.amount;
      } else {
        summary.nonMemberTransactions++;
        summary.nonMemberAmount += tx.amount;
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [transactions]);

  const memberSummaries = useMemo((): MemberSummary[] => {
    const memberMap = new Map<string, MemberSummary>();
    
    transactions.filter(tx => tx.is_member_transaction).forEach(tx => {
      if (!memberMap.has(tx.user_id)) {
        memberMap.set(tx.user_id, {
          userId: tx.user_id,
          userName: tx.user_name,
          memberNumber: tx.member_number,
          totalAmount: 0,
          transactionCount: 0,
        });
      }
      
      const summary = memberMap.get(tx.user_id)!;
      summary.totalAmount += tx.amount;
      summary.transactionCount++;
    });

    return Array.from(memberMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [transactions]);

  const totals = useMemo(() => ({
    totalTransactions: transactions.length,
    totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
    memberAmount: transactions.filter(t => t.is_member_transaction).reduce((sum, t) => sum + t.amount, 0),
    memberCount: memberSummaries.length,
  }), [transactions, memberSummaries]);

  // Chart data
  const pieChartData = unitSummaries.map((s, idx) => ({
    name: s.unitCode,
    value: s.totalAmount,
    fill: COLORS[idx % COLORS.length],
  }));

  const barChartData = unitSummaries.map(s => ({
    name: s.unitCode,
    anggota: s.memberAmount,
    nonAnggota: s.nonMemberAmount,
  }));

  // Export functions
  const handleExportExcel = async () => {
    // Summary sheet
    const summaryData = [
      ['LAPORAN REKAP TRANSAKSI UNIT USAHA'],
      [''],
      ['Periode', `${format(startDate, 'dd MMMM yyyy', { locale: localeId })} - ${format(endDate, 'dd MMMM yyyy', { locale: localeId })}`],
      ['Unit Usaha', selectedUnit === 'all' ? 'Semua Unit' : units.find(u => u.id === selectedUnit)?.name || '-'],
      [''],
      ['RINGKASAN'],
      ['Total Transaksi', totals.totalTransactions],
      ['Total Nilai', totals.totalAmount],
      ['Nilai Anggota (SHU)', totals.memberAmount],
      ['Jumlah Anggota Aktif', totals.memberCount],
      [''],
    ];

    // Per Unit data
    const unitData = [
      ['Kode Unit', 'Nama Unit', 'Jml Transaksi', 'Total Nilai', 'Transaksi Anggota', 'Nilai Anggota', 'Transaksi Non-Anggota', 'Nilai Non-Anggota'],
      ...unitSummaries.map(s => [s.unitCode, s.unitName, s.totalTransactions, s.totalAmount, s.memberTransactions, s.memberAmount, s.nonMemberTransactions, s.nonMemberAmount])
    ];

    // Per Member data
    const memberData = [
      ['No. Anggota', 'Nama Anggota', 'Jml Transaksi', 'Total Nilai'],
      ...memberSummaries.map(m => [m.memberNumber, m.userName, m.transactionCount, m.totalAmount])
    ];

    // Detail transactions data
    const detailData = [
      ['Tanggal', 'Unit', 'Nama', 'No. Anggota', 'Jenis', 'Keterangan', 'Nilai', 'Anggota?', 'Catatan'],
      ...transactions.map(tx => [tx.transaction_date, tx.unit_code, tx.user_name, tx.member_number, getTransactionTypeLabel(tx.transaction_type), tx.description || '-', tx.amount, tx.is_member_transaction ? 'Ya' : 'Tidak', tx.notes || '-'])
    ];

    const filename = `Rekap_Unit_Usaha_${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}.xlsx`;
    await createAndDownloadExcelMixed([
      { name: 'Ringkasan', type: 'aoa', data: summaryData },
      { name: 'Per Unit', type: 'aoa', data: unitData },
      { name: 'Per Anggota', type: 'aoa', data: memberData },
      { name: 'Detail Transaksi', type: 'aoa', data: detailData },
    ], filename);
    toast.success('Laporan Excel berhasil diunduh');
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup diblokir. Izinkan popup untuk mencetak.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Laporan Rekap Unit Usaha</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; font-size: 11px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .header h1 { font-size: 18px; margin-bottom: 5px; }
          .header p { color: #666; font-size: 12px; }
          .period { background: #f5f5f5; padding: 10px; margin-bottom: 20px; border-radius: 4px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .summary-card { background: #f9f9f9; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #e0e0e0; }
          .summary-card .label { font-size: 10px; color: #666; margin-bottom: 4px; }
          .summary-card .value { font-size: 16px; font-weight: bold; }
          .section { margin-bottom: 20px; }
          .section h3 { font-size: 13px; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #ddd; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { padding: 8px 6px; text-align: left; border-bottom: 1px solid #e0e0e0; }
          th { background: #f5f5f5; font-weight: 600; }
          .amount { text-align: right; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 9px; }
          .badge-green { background: #d1fae5; color: #059669; }
          .badge-gray { background: #f3f4f6; color: #6b7280; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>LAPORAN REKAP TRANSAKSI UNIT USAHA</h1>
          <p>Koperasi</p>
        </div>

        <div class="period">
          <strong>Periode:</strong> ${format(startDate, 'dd MMMM yyyy', { locale: localeId })} - ${format(endDate, 'dd MMMM yyyy', { locale: localeId })}
          ${selectedUnit !== 'all' ? `<br><strong>Unit:</strong> ${units.find(u => u.id === selectedUnit)?.name || '-'}` : ''}
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="label">Total Transaksi</div>
            <div class="value">${totals.totalTransactions}</div>
          </div>
          <div class="summary-card">
            <div class="label">Total Nilai</div>
            <div class="value">${formatCurrency(totals.totalAmount)}</div>
          </div>
          <div class="summary-card">
            <div class="label">Kontribusi SHU Anggota</div>
            <div class="value" style="color: #059669;">${formatCurrency(totals.memberAmount)}</div>
          </div>
          <div class="summary-card">
            <div class="label">Anggota Aktif</div>
            <div class="value">${totals.memberCount}</div>
          </div>
        </div>

        <div class="section">
          <h3>Rekap Per Unit Usaha</h3>
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Unit</th>
                <th class="amount">Transaksi</th>
                <th class="amount">Total Nilai</th>
                <th class="amount">Nilai Anggota</th>
              </tr>
            </thead>
            <tbody>
              ${unitSummaries.map(s => `
                <tr>
                  <td><strong>${escapeHtml(s.unitCode)}</strong></td>
                  <td>${escapeHtml(s.unitName)}</td>
                  <td class="amount">${s.totalTransactions}</td>
                  <td class="amount">${formatCurrency(s.totalAmount)}</td>
                  <td class="amount" style="color: #059669;">${formatCurrency(s.memberAmount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h3>Top 10 Anggota (Kontribusi SHU)</h3>
          <table>
            <thead>
              <tr>
                <th>No. Anggota</th>
                <th>Nama</th>
                <th class="amount">Transaksi</th>
                <th class="amount">Total Nilai</th>
              </tr>
            </thead>
            <tbody>
              ${memberSummaries.slice(0, 10).map(m => `
                <tr>
                  <td>${escapeHtml(m.memberNumber)}</td>
                  <td>${escapeHtml(m.userName)}</td>
                  <td class="amount">${m.transactionCount}</td>
                  <td class="amount">${formatCurrency(m.totalAmount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeId })}</p>
        </div>

        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (unitsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Period Preset */}
            <div className="space-y-2">
              <Label>Periode</Label>
              <Select value={periodPreset} onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">Bulan Ini</SelectItem>
                  <SelectItem value="last_month">Bulan Lalu</SelectItem>
                  <SelectItem value="this_quarter">Kuartal Ini</SelectItem>
                  <SelectItem value="this_year">Tahun Ini</SelectItem>
                  <SelectItem value="custom">Kustom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label>Dari Tanggal</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd MMM yyyy", { locale: localeId }) : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => { if (d) { setStartDate(d); setPeriodPreset('custom'); } }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>Sampai Tanggal</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd MMM yyyy", { locale: localeId }) : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(d) => { if (d) { setEndDate(d); setPeriodPreset('custom'); } }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Unit Filter */}
            <div className="space-y-2">
              <Label>Unit Usaha</Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger>
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Pilih Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Unit</SelectItem>
                  {units.filter(u => u.code !== 'SP').map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.code} - {unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="memberOnly"
                checked={onlyMemberTransactions}
                onChange={(e) => setOnlyMemberTransactions(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="memberOnly" className="text-sm cursor-pointer">
                Hanya transaksi anggota (kontribusi SHU)
              </Label>
            </div>
            <ExportButtons
              onExportExcel={handleExportExcel}
              onExportPDF={handleExportPDF}
              showDropdown={false}
              excelLabel="Export Excel"
              pdfLabel="Export PDF"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.totalTransactions}</p>
                <p className="text-sm text-muted-foreground">Total Transaksi</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <RupiahIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totals.totalAmount)}</p>
                <p className="text-sm text-muted-foreground">Total Nilai</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totals.memberAmount)}</p>
                <p className="text-sm text-muted-foreground">Kontribusi SHU</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <User className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.memberCount}</p>
                <p className="text-sm text-muted-foreground">Anggota Aktif</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Tidak Ada Data</p>
            <p className="text-sm">Tidak ada transaksi unit usaha pada periode ini</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Ringkasan</TabsTrigger>
            <TabsTrigger value="per-unit">Per Unit</TabsTrigger>
            <TabsTrigger value="per-member">Per Anggota</TabsTrigger>
            <TabsTrigger value="detail">Detail Transaksi</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribusi Nilai Per Unit</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPie>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Anggota vs Non-Anggota</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="anggota" name="Anggota (SHU)" fill="#22c55e" />
                      <Bar dataKey="nonAnggota" name="Non-Anggota" fill="#94a3b8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="per-unit">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rekap Per Unit Usaha</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Transaksi</TableHead>
                      <TableHead className="text-right">Total Nilai</TableHead>
                      <TableHead className="text-right">Anggota</TableHead>
                      <TableHead className="text-right">Nilai Anggota</TableHead>
                      <TableHead className="text-right">Non-Anggota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unitSummaries.map((s) => (
                      <TableRow key={s.unitId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{s.unitCode}</Badge>
                            <span className="font-medium">{s.unitName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{s.totalTransactions}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(s.totalAmount)}</TableCell>
                        <TableCell className="text-right">{s.memberTransactions}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium">{formatCurrency(s.memberAmount)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(s.nonMemberAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="per-member">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kontribusi Per Anggota (SHU Jasa Usaha)</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No. Anggota</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead className="text-right">Transaksi</TableHead>
                        <TableHead className="text-right">Total Nilai</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberSummaries.map((m) => (
                        <TableRow key={m.userId}>
                          <TableCell className="font-mono text-sm">{m.memberNumber}</TableCell>
                          <TableCell className="font-medium">{m.userName}</TableCell>
                          <TableCell className="text-right">{m.transactionCount}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">{formatCurrency(m.totalAmount)}</TableCell>
                        </TableRow>
                      ))}
                      {memberSummaries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Tidak ada transaksi anggota
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detail">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detail Transaksi</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Jenis</TableHead>
                        <TableHead className="text-right">Nilai</TableHead>
                        <TableHead>SHU</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{tx.unit_code}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{tx.user_name}</p>
                              {tx.is_member_transaction && (
                                <p className="text-xs text-muted-foreground">{tx.member_number}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getTransactionTypeIcon(tx.transaction_type)}
                              <span className="text-sm">{getTransactionTypeLabel(tx.transaction_type)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(tx.amount)}</TableCell>
                          <TableCell>
                            {tx.is_member_transaction ? (
                              <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Ya</Badge>
                            ) : (
                              <Badge variant="secondary">Tidak</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
