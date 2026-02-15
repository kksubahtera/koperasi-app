import { useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ExportButtons } from '@/components/ui/export-buttons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOverdueStatistics, OverdueHandlingStatus } from '@/hooks/useOverdueStatistics';
import { AlertTriangle, Users, Clock, TrendingDown, RefreshCw, AlertCircle, XCircle, Phone, Loader2, CheckCircle, Settings, MoreHorizontal, Filter } from 'lucide-react';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { toast } from 'sonner';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const COLORS = {
  '1-3_months': 'hsl(var(--chart-3))',
  '3-6_months': 'hsl(var(--chart-2))',
  '6+_months': 'hsl(var(--destructive))'
};

const CATEGORY_LABELS = {
  '1-3_months': '1-3 Bulan',
  '3-6_months': '3-6 Bulan',
  '6+_months': '> 6 Bulan'
};

const STATUS_CONFIG: Record<OverdueHandlingStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Belum Ditangani', color: 'bg-muted text-muted-foreground', icon: <Clock className="h-3 w-3" /> },
  contacted: { label: 'Sudah Dihubungi', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300', icon: <Phone className="h-3 w-3" /> },
  in_progress: { label: 'Dalam Penanganan', color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300', icon: <Settings className="h-3 w-3" /> },
  resolved: { label: 'Selesai', color: 'bg-green-500/20 text-green-700 dark:text-green-300', icon: <CheckCircle className="h-3 w-3" /> },
  escalated: { label: 'Dieskalasi', color: 'bg-red-500/20 text-red-700 dark:text-red-300', icon: <AlertTriangle className="h-3 w-3" /> }
};

export const OverdueDashboard = () => {
  const { loading, statistics, membersByCategory, refetch, updateHandlingStatus } = useOverdueStatistics();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [notesDialog, setNotesDialog] = useState<{ open: boolean; loanId: string; userId: string; status: OverdueHandlingStatus; currentNotes: string }>({
    open: false, loanId: '', userId: '', status: 'pending', currentNotes: ''
  });
  const [notes, setNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<OverdueHandlingStatus | 'all'>('all');

  // Filter members based on status filter
  const filteredStatistics = useMemo(() => {
    if (statusFilter === 'all') {
      return statistics;
    }
    
    const filteredMembers = statistics.members.filter(m => {
      const memberStatus = m.handling?.status || 'pending';
      return memberStatus === statusFilter;
    });
    
    return {
      ...statistics,
      members: filteredMembers,
      total: filteredMembers.length,
      category1to3: filteredMembers.filter(m => m.category === '1-3_months').length,
      category3to6: filteredMembers.filter(m => m.category === '3-6_months').length,
      category6plus: filteredMembers.filter(m => m.category === '6+_months').length,
      totalOverdueAmount: filteredMembers.reduce((sum, m) => sum + m.overdueAmount, 0)
    };
  }, [statistics, statusFilter]);

  const filteredMembersByCategory = useMemo(() => {
    if (statusFilter === 'all') {
      return membersByCategory;
    }
    
    return {
      '1-3_months': membersByCategory['1-3_months'].filter(m => (m.handling?.status || 'pending') === statusFilter),
      '3-6_months': membersByCategory['3-6_months'].filter(m => (m.handling?.status || 'pending') === statusFilter),
      '6+_months': membersByCategory['6+_months'].filter(m => (m.handling?.status || 'pending') === statusFilter)
    };
  }, [membersByCategory, statusFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleStatusChange = async (loanId: string, userId: string, status: OverdueHandlingStatus, withNotes = false) => {
    if (withNotes) {
      setNotesDialog({ open: true, loanId, userId, status, currentNotes: '' });
      setNotes('');
      return;
    }
    
    setUpdatingStatus(loanId);
    const success = await updateHandlingStatus(loanId, userId, status);
    if (success) {
      toast.success(`Status berhasil diubah ke "${STATUS_CONFIG[status].label}"`);
    } else {
      toast.error('Gagal mengubah status');
    }
    setUpdatingStatus(null);
  };

  const handleSaveWithNotes = async () => {
    setUpdatingStatus(notesDialog.loanId);
    const success = await updateHandlingStatus(notesDialog.loanId, notesDialog.userId, notesDialog.status, notes);
    if (success) {
      toast.success(`Status berhasil diubah ke "${STATUS_CONFIG[notesDialog.status].label}"`);
      setNotesDialog({ open: false, loanId: '', userId: '', status: 'pending', currentNotes: '' });
      setNotes('');
    } else {
      toast.error('Gagal mengubah status');
    }
    setUpdatingStatus(null);
  };

  const pieChartData = [
    { name: '1-3 Bulan', value: filteredStatistics.category1to3, color: COLORS['1-3_months'] },
    { name: '3-6 Bulan', value: filteredStatistics.category3to6, color: COLORS['3-6_months'] },
    { name: '> 6 Bulan', value: filteredStatistics.category6plus, color: COLORS['6+_months'] }
  ].filter(d => d.value > 0);

  const barChartData = [
    { 
      category: '1-3 Bulan', 
      jumlah: filteredStatistics.category1to3,
      total: filteredMembersByCategory['1-3_months'].reduce((sum, m) => sum + m.overdueAmount, 0)
    },
    { 
      category: '3-6 Bulan', 
      jumlah: filteredStatistics.category3to6,
      total: filteredMembersByCategory['3-6_months'].reduce((sum, m) => sum + m.overdueAmount, 0)
    },
    { 
      category: '> 6 Bulan', 
      jumlah: filteredStatistics.category6plus,
      total: filteredMembersByCategory['6+_months'].reduce((sum, m) => sum + m.overdueAmount, 0)
    }
  ];

  // Export to Excel
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      // Summary sheet
      const summaryData = [
        { 'Kategori': 'Total Anggota Menunggak', 'Nilai': statistics.total },
        { 'Kategori': 'Tunggakan 1-3 Bulan', 'Nilai': statistics.category1to3 },
        { 'Kategori': 'Tunggakan 3-6 Bulan', 'Nilai': statistics.category3to6 },
        { 'Kategori': 'Tunggakan > 6 Bulan', 'Nilai': statistics.category6plus },
        { 'Kategori': 'Total Nilai Tunggakan', 'Nilai': statistics.totalOverdueAmount },
      ];
      
      // All members sheet
      const allMembersData = statistics.members.map((m, idx) => ({
        'No': idx + 1,
        'No. Anggota': m.memberNumber,
        'Nama': m.memberName,
        'Kategori': CATEGORY_LABELS[m.category],
        'Pokok Pinjaman': m.principalAmount,
        'Angsuran Tertunggak': m.overdueInstallments,
        'Nilai Tunggakan': m.overdueAmount,
        'Lama Tunggakan (Bulan)': m.overdueMonths,
        'Jatuh Tempo Tertua': format(new Date(m.oldestDueDate), 'dd/MM/yyyy'),
      }));
      
      // Build sheets array
      const sheets: { name: string; data: Record<string, any>[] }[] = [
        { name: 'Ringkasan', data: summaryData },
        { name: 'Semua Tunggakan', data: allMembersData },
      ];
      
      // Category-specific sheets
      (['1-3_months', '3-6_months', '6+_months'] as const).forEach(category => {
        const categoryMembers = membersByCategory[category];
        if (categoryMembers.length > 0) {
          const categoryData = categoryMembers.map((m, idx) => ({
            'No': idx + 1,
            'No. Anggota': m.memberNumber,
            'Nama': m.memberName,
            'Pokok Pinjaman': m.principalAmount,
            'Angsuran Tertunggak': m.overdueInstallments,
            'Nilai Tunggakan': m.overdueAmount,
            'Lama Tunggakan (Bulan)': m.overdueMonths,
            'Jatuh Tempo Tertua': format(new Date(m.oldestDueDate), 'dd/MM/yyyy'),
          }));
          sheets.push({ name: CATEGORY_LABELS[category], data: categoryData });
        }
      });
      
      const fileName = `Laporan_Tunggakan_${format(new Date(), 'yyyyMMdd')}.xlsx`;
      await createAndDownloadExcelFromJson(sheets, fileName);
      toast.success('Laporan berhasil diekspor ke Excel');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Gagal mengekspor ke Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Title
      doc.setFontSize(16);
      doc.text('Laporan Tunggakan Pinjaman', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Tanggal: ${format(new Date(), 'dd MMMM yyyy', { locale: idLocale })}`, pageWidth / 2, 28, { align: 'center' });
      
      // Summary
      doc.setFontSize(12);
      doc.text('Ringkasan', 14, 40);
      
      autoTable(doc, {
        startY: 45,
        head: [['Kategori', 'Jumlah', 'Nilai Tunggakan']],
        body: [
          ['Tunggakan 1-3 Bulan', statistics.category1to3.toString(), formatCurrency(membersByCategory['1-3_months'].reduce((sum, m) => sum + m.overdueAmount, 0))],
          ['Tunggakan 3-6 Bulan', statistics.category3to6.toString(), formatCurrency(membersByCategory['3-6_months'].reduce((sum, m) => sum + m.overdueAmount, 0))],
          ['Tunggakan > 6 Bulan', statistics.category6plus.toString(), formatCurrency(membersByCategory['6+_months'].reduce((sum, m) => sum + m.overdueAmount, 0))],
          ['Total', statistics.total.toString(), formatCurrency(statistics.totalOverdueAmount)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 },
      });
      
      // Detail table
      const finalY = (doc as any).lastAutoTable.finalY || 80;
      doc.setFontSize(12);
      doc.text('Detail Anggota Menunggak', 14, finalY + 15);
      
      autoTable(doc, {
        startY: finalY + 20,
        head: [['No', 'No. Anggota', 'Nama', 'Kategori', 'Angsuran', 'Nilai Tunggakan', 'Lama']],
        body: statistics.members.map((m, idx) => [
          (idx + 1).toString(),
          m.memberNumber,
          m.memberName,
          CATEGORY_LABELS[m.category],
          `${m.overdueInstallments}x`,
          formatCurrency(m.overdueAmount),
          `${m.overdueMonths} bln`,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 25 },
          2: { cellWidth: 40 },
          3: { cellWidth: 25 },
          4: { cellWidth: 20 },
          5: { cellWidth: 35 },
          6: { cellWidth: 18 },
        },
      });
      
      const fileName = `Laporan_Tunggakan_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(fileName);
      toast.success('Laporan berhasil diekspor ke PDF');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast.error('Gagal mengekspor ke PDF');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-foreground">Dashboard Tunggakan</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Ringkasan anggota dengan tunggakan pinjaman</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OverdueHandlingStatus | 'all')}>
            <SelectTrigger className="w-[140px] sm:w-[180px] h-8 sm:h-10 text-xs sm:text-sm">
              <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">Belum Ditangani</SelectItem>
              <SelectItem value="contacted">Sudah Dihubungi</SelectItem>
              <SelectItem value="in_progress">Dalam Penanganan</SelectItem>
              <SelectItem value="escalated">Dieskalasi</SelectItem>
              <SelectItem value="resolved">Selesai</SelectItem>
            </SelectContent>
          </Select>
          <ExportButtons
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
            disabled={statistics.members.length === 0}
            isExporting={isExporting}
            className="h-8 sm:h-10 text-xs sm:text-sm"
          />
          <Button variant="outline" size="sm" className="h-8 sm:h-10 text-xs sm:text-sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 sm:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Active Filter Badge */}
      {statusFilter !== 'all' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs sm:text-sm text-muted-foreground">Filter aktif:</span>
          <Badge variant="outline" className={`gap-1 text-xs ${STATUS_CONFIG[statusFilter].color}`}>
            {STATUS_CONFIG[statusFilter].icon}
            {STATUS_CONFIG[statusFilter].label}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')} className="h-6 px-2 text-xs">
            Hapus Filter
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
              Total Menunggak
            </CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold">{filteredStatistics.total}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">anggota</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium text-yellow-600 dark:text-yellow-400">
              1-3 Bulan
            </CardTitle>
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600 dark:text-yellow-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {filteredStatistics.category1to3}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">anggota</p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium text-orange-600 dark:text-orange-400">
              3-6 Bulan
            </CardTitle>
            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">
              {filteredStatistics.category3to6}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">anggota</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium text-destructive">
              &gt; 6 Bulan
            </CardTitle>
            <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-destructive">
              {filteredStatistics.category6plus}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">anggota</p>
          </CardContent>
        </Card>
      </div>

      {/* Total Overdue Amount */}
      <Card className="bg-gradient-to-r from-destructive/10 to-orange-500/10 border-destructive/30">
        <CardContent className="py-3 sm:py-6 px-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Tunggakan</p>
              <p className="text-xl sm:text-3xl font-bold text-destructive">
                {formatCurrency(filteredStatistics.totalOverdueAmount)}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 sm:h-12 sm:w-12 text-destructive/40" />
          </div>
        </CardContent>
      </Card>

      {/* Charts and Tables */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            onClick={() => setActiveTab('overview')}
            size="sm"
            className="text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-4"
          >
            Ringkasan
          </Button>
          <Button
            variant={activeTab === '1-3_months' ? 'default' : 'outline'}
            onClick={() => setActiveTab('1-3_months')}
            size="sm"
            className="text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-4"
          >
            1-3 Bln
            {filteredStatistics.category1to3 > 0 && (
              <Badge variant="secondary" className="ml-1 sm:ml-2 text-[8px] sm:text-xs h-4 sm:h-5 px-1 sm:px-1.5">{filteredStatistics.category1to3}</Badge>
            )}
          </Button>
          <Button
            variant={activeTab === '3-6_months' ? 'default' : 'outline'}
            onClick={() => setActiveTab('3-6_months')}
            size="sm"
            className="text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-4"
          >
            3-6 Bln
            {filteredStatistics.category3to6 > 0 && (
              <Badge variant="secondary" className="ml-1 sm:ml-2 text-[8px] sm:text-xs h-4 sm:h-5 px-1 sm:px-1.5">{filteredStatistics.category3to6}</Badge>
            )}
          </Button>
          <Button
            variant={activeTab === '6+_months' ? 'default' : 'outline'}
            onClick={() => setActiveTab('6+_months')}
            size="sm"
            className="text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-4"
          >
            &gt;6 Bln
            {filteredStatistics.category6plus > 0 && (
              <Badge variant="destructive" className="ml-1 sm:ml-2 text-[8px] sm:text-xs h-4 sm:h-5 px-1 sm:px-1.5">{filteredStatistics.category6plus}</Badge>
            )}
          </Button>
        </div>

        {activeTab === 'overview' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Pie Chart */}
            <Card>
              <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                <CardTitle className="text-sm sm:text-base">Distribusi Tunggakan</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200} className="sm:!h-[300px]">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] sm:h-[300px] text-muted-foreground">
                    <div className="text-center">
                      <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-xs sm:text-sm">Tidak ada data tunggakan</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bar Chart */}
            <Card>
              <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                <CardTitle className="text-sm sm:text-base">Jumlah & Nilai Tunggakan</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <ResponsiveContainer width="100%" height={200} className="sm:!h-[300px]">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} className="text-[8px] sm:text-xs" />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={30} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} width={35} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'jumlah' ? `${value} anggota` : formatCurrency(value),
                        name === 'jumlah' ? 'Jumlah Anggota' : 'Total Tunggakan'
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar yAxisId="left" dataKey="jumlah" name="Jumlah Anggota" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="total" name="Total Tunggakan" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Summary Table */}
          {filteredStatistics.members.length > 0 && (
            <Card>
              <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                <CardTitle className="text-sm sm:text-base">Daftar Anggota Menunggak</CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {/* Mobile Card View */}
                <div className="sm:hidden space-y-2 p-3">
                  {filteredStatistics.members.slice(0, 10).map((member) => {
                    const handlingStatus = member.handling?.status || 'pending';
                    const statusConfig = STATUS_CONFIG[handlingStatus];
                    return (
                      <div key={member.loanId} className="border rounded-lg p-3 bg-card space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{member.memberName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{member.memberNumber}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" disabled={updatingStatus === member.loanId}>
                                {updatingStatus === member.loanId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-3 w-3" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'contacted')}>
                                <Phone className="h-4 w-4 mr-2" />
                                Sudah Dihubungi
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'in_progress', true)}>
                                <Settings className="h-4 w-4 mr-2" />
                                Dalam Penanganan
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'escalated', true)}>
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Eskalasi
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'resolved', true)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Selesai
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            variant={member.category === '6+_months' ? 'destructive' : 'secondary'}
                            className={`text-[10px] ${
                              member.category === '3-6_months' 
                                ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300' 
                                : member.category === '1-3_months'
                                ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                                : ''
                            }`}
                          >
                            {CATEGORY_LABELS[member.category]}
                          </Badge>
                          <Badge variant="outline" className={`gap-1 text-[10px] ${statusConfig.color}`}>
                            {statusConfig.icon}
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t">
                          <span className="text-xs text-muted-foreground">{member.overdueMonths} bulan tunggakan</span>
                          <span className="font-bold text-destructive text-sm">{formatCurrency(member.overdueAmount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block">
                  <ResponsiveTable>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs p-4">No. Anggota</TableHead>
                          <TableHead className="text-xs p-4">Nama</TableHead>
                          <TableHead className="text-xs p-4">Kategori</TableHead>
                          <TableHead className="text-xs p-4 hidden md:table-cell">Status</TableHead>
                          <TableHead className="text-xs p-4 text-right">Tunggakan</TableHead>
                          <TableHead className="text-xs p-4">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStatistics.members.slice(0, 10).map((member) => {
                          const handlingStatus = member.handling?.status || 'pending';
                          const statusConfig = STATUS_CONFIG[handlingStatus];
                          return (
                            <TableRow key={member.loanId}>
                              <TableCell className="font-mono text-sm p-4">{member.memberNumber}</TableCell>
                              <TableCell className="font-medium text-sm p-4">{member.memberName}</TableCell>
                              <TableCell className="p-4">
                                <Badge 
                                  variant={member.category === '6+_months' ? 'destructive' : 'secondary'}
                                  className={`text-xs ${
                                    member.category === '3-6_months' 
                                      ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300 hover:bg-orange-500/30' 
                                      : member.category === '1-3_months'
                                      ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/30'
                                      : ''
                                  }`}
                                >
                                  {CATEGORY_LABELS[member.category]}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell p-4">
                                <Badge variant="outline" className={`gap-1 text-xs ${statusConfig.color}`}>
                                  {statusConfig.icon}
                                  {statusConfig.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium text-destructive text-sm p-4">
                                {formatCurrency(member.overdueAmount)}
                              </TableCell>
                              <TableCell className="p-4">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" disabled={updatingStatus === member.loanId}>
                                      {updatingStatus === member.loanId ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <MoreHorizontal className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'contacted')}>
                                      <Phone className="h-4 w-4 mr-2" />
                                      Sudah Dihubungi
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'in_progress', true)}>
                                      <Settings className="h-4 w-4 mr-2" />
                                      Dalam Penanganan
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'escalated', true)}>
                                      <AlertTriangle className="h-4 w-4 mr-2" />
                                      Eskalasi
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'resolved', true)}>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Selesai
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ResponsiveTable>
                </div>
                {filteredStatistics.members.length > 10 && (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center mt-3 sm:mt-4 px-3 sm:px-0 pb-3 sm:pb-0">
                    Menampilkan 10 dari {filteredStatistics.members.length} anggota.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        )}

        {(['1-3_months', '3-6_months', '6+_months'] as const).map((category) => (
          activeTab === category && (
            <Card key={category}>
              <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  {category === '1-3_months' && <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />}
                  {category === '3-6_months' && <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />}
                  {category === '6+_months' && <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />}
                  <span className="hidden sm:inline">Anggota Tunggakan</span> {CATEGORY_LABELS[category]}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {filteredMembersByCategory[category].length > 0 ? (
                  <>
                    {/* Mobile Card View */}
                    <div className="sm:hidden space-y-2 p-3">
                      {filteredMembersByCategory[category].map((member) => {
                        const handlingStatus = member.handling?.status || 'pending';
                        const statusConfig = STATUS_CONFIG[handlingStatus];
                        return (
                          <div key={member.loanId} className="border rounded-lg p-3 bg-card space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{member.memberName}</p>
                                <p className="text-xs text-muted-foreground font-mono">{member.memberNumber}</p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" disabled={updatingStatus === member.loanId}>
                                    {updatingStatus === member.loanId ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <MoreHorizontal className="h-3 w-3" />
                                    )}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'contacted')}>
                                    <Phone className="h-4 w-4 mr-2" />
                                    Sudah Dihubungi
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'in_progress', true)}>
                                    <Settings className="h-4 w-4 mr-2" />
                                    Dalam Penanganan
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'escalated', true)}>
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    Eskalasi
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'resolved', true)}>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Selesai
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`gap-1 text-[10px] ${statusConfig.color}`}>
                                {statusConfig.icon}
                                {statusConfig.label}
                              </Badge>
                              {member.handling?.notes && (
                                <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={member.handling.notes}>
                                  {member.handling.notes}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t text-xs">
                              <div className="space-y-0.5">
                                <p className="text-muted-foreground">{member.overdueMonths} bulan tunggakan</p>
                                <p className="text-muted-foreground">Jatuh tempo: {format(new Date(member.oldestDueDate), 'dd MMM yy', { locale: idLocale })}</p>
                              </div>
                              <span className="font-bold text-destructive text-base">{formatCurrency(member.overdueAmount)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden sm:block">
                      <ResponsiveTable>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs p-4">No. Anggota</TableHead>
                              <TableHead className="text-xs p-4">Nama</TableHead>
                              <TableHead className="text-xs p-4 hidden md:table-cell">Status</TableHead>
                              <TableHead className="text-xs p-4 text-right">Tunggakan</TableHead>
                              <TableHead className="text-xs p-4">Lama</TableHead>
                              <TableHead className="text-xs p-4 hidden lg:table-cell">Jatuh Tempo</TableHead>
                              <TableHead className="text-xs p-4">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredMembersByCategory[category].map((member) => {
                              const handlingStatus = member.handling?.status || 'pending';
                              const statusConfig = STATUS_CONFIG[handlingStatus];
                              return (
                                <TableRow key={member.loanId}>
                                  <TableCell className="font-mono text-sm p-4">{member.memberNumber}</TableCell>
                                  <TableCell className="font-medium text-sm p-4">{member.memberName}</TableCell>
                                  <TableCell className="hidden md:table-cell p-4">
                                    <Badge variant="outline" className={`gap-1 text-xs ${statusConfig.color}`}>
                                      {statusConfig.icon}
                                      {statusConfig.label}
                                    </Badge>
                                    {member.handling?.notes && (
                                      <p className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate" title={member.handling.notes}>
                                        {member.handling.notes}
                                      </p>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-destructive text-sm p-4">
                                    {formatCurrency(member.overdueAmount)}
                                  </TableCell>
                                  <TableCell className="text-sm p-4">{member.overdueMonths} bln</TableCell>
                                  <TableCell className="hidden lg:table-cell text-sm p-4">
                                    {format(new Date(member.oldestDueDate), 'dd MMM yy', { locale: idLocale })}
                                  </TableCell>
                                  <TableCell className="p-4">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" disabled={updatingStatus === member.loanId}>
                                          {updatingStatus === member.loanId ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <MoreHorizontal className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'contacted')}>
                                          <Phone className="h-4 w-4 mr-2" />
                                          Sudah Dihubungi
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'in_progress', true)}>
                                          <Settings className="h-4 w-4 mr-2" />
                                          Dalam Penanganan
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'escalated', true)}>
                                          <AlertTriangle className="h-4 w-4 mr-2" />
                                          Eskalasi
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleStatusChange(member.loanId, member.userId, 'resolved', true)}>
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          Selesai
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ResponsiveTable>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground px-3">
                    <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-xs sm:text-sm">Tidak ada anggota dengan tunggakan {CATEGORY_LABELS[category]}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        ))}
      </div>

      {/* Notes Dialog */}
      <Dialog open={notesDialog.open} onOpenChange={(open) => !open && setNotesDialog({ ...notesDialog, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catatan Penanganan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status baru:</span>
              <Badge variant="outline" className={`gap-1 ${STATUS_CONFIG[notesDialog.status].color}`}>
                {STATUS_CONFIG[notesDialog.status].icon}
                {STATUS_CONFIG[notesDialog.status].label}
              </Badge>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Catatan (opsional)</Label>
              <Textarea
                id="notes"
                placeholder="Tambahkan catatan penanganan..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialog({ ...notesDialog, open: false })}>
              Batal
            </Button>
            <Button onClick={handleSaveWithNotes} disabled={updatingStatus === notesDialog.loanId}>
              {updatingStatus === notesDialog.loanId && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
