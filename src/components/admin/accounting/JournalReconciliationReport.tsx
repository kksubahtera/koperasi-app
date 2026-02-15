import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, XCircle, AlertTriangle, FileText, BookOpen, 
  Loader2, RefreshCw, TrendingUp, BarChart3, Calendar,
  ArrowRight, ClipboardCheck
} from 'lucide-react';
import { ExportButtons } from '@/components/ui/export-buttons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatShortDate, getTransactionTypeLabel } from '@/lib/mockData';
import { useAutoJournalFromTransaction, TransactionData } from '@/hooks/useAutoJournalFromTransaction';
import { TemplateType } from '@/hooks/useJournalTemplates';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createAndDownloadExcelAoA } from '@/lib/excelUtils';
import html2canvas from 'html2canvas';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';

interface ReconciliationData {
  totalApprovedTransactions: number;
  totalJournalsCreated: number;
  transactionsWithJournal: number;
  transactionsWithoutJournal: number;
  reconciliationRate: number;
  byType: {
    type: string;
    typeLabel: string;
    approved: number;
    withJournal: number;
    withoutJournal: number;
    rate: number;
  }[];
  discrepancies: {
    id: string;
    type: string;
    amount: number;
    date: string | null;
    memberName: string;
    memberNumber: string | null;
    approvedAt: string | null;
  }[];
}

// Helper to extract journal number from notes
const getJournalNumber = (notes: string | null): string | null => {
  if (!notes) return null;
  const match = notes.match(/Jurnal:\s*(JRN-[\w-]+)/);
  return match ? match[1] : null;
};

export const JournalReconciliationReport = () => {
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [isBulkRegenerating, setIsBulkRegenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const { createJournalOnApproval, getInstallmentData, isTemplateReady } = useAutoJournalFromTransaction();

  // Get period label for export
  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'today': return 'Hari Ini';
      case 'week': return '7 Hari Terakhir';
      case 'month': return '30 Hari Terakhir';
      case 'year': return '1 Tahun Terakhir';
      default: return 'Semua Waktu';
    }
  };

  // Export to Excel
  const handleExportToExcel = async () => {
    if (!reconciliationData) return;
    
    setIsExporting(true);
    try {
      const settings = getCooperativeSettings();
      const data = reconciliationData;
      const now = new Date();
      
      // Summary sheet data
      const summaryData = [
        ['LAPORAN REKONSILIASI JURNAL'],
        [settings.name],
        [`Periode: ${getPeriodLabel()}`],
        [`Tanggal Cetak: ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`],
        [''],
        ['RINGKASAN'],
        ['Keterangan', 'Jumlah'],
        ['Total Transaksi Disetujui', data.totalApprovedTransactions],
        ['Transaksi dengan Jurnal', data.transactionsWithJournal],
        ['Transaksi tanpa Jurnal', data.transactionsWithoutJournal],
        ['Total Jurnal Dibuat', data.totalJournalsCreated],
        ['Tingkat Rekonsiliasi', `${data.reconciliationRate.toFixed(1)}%`],
        ['Status', data.reconciliationRate === 100 ? 'Lengkap' : 'Belum Lengkap'],
      ];

      // By type sheet data
      const byTypeData = [
        ['REKONSILIASI PER JENIS TRANSAKSI'],
        [''],
        ['Jenis Transaksi', 'Total Disetujui', 'Dengan Jurnal', 'Tanpa Jurnal', 'Tingkat (%)'],
        ...data.byType.map(item => [
          item.typeLabel,
          item.approved,
          item.withJournal,
          item.withoutJournal,
          `${item.rate.toFixed(1)}%`
        ])
      ];

      // Discrepancies sheet data
      const discrepanciesData = [
        ['DAFTAR TRANSAKSI TANPA JURNAL'],
        [''],
        ['No', 'Tanggal', 'No Anggota', 'Nama Anggota', 'Jenis Transaksi', 'Jumlah', 'Tanggal Disetujui'],
        ...data.discrepancies.map((item, index) => [
          index + 1,
          item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-',
          item.memberNumber || '-',
          item.memberName,
          getTransactionTypeLabel(item.type as any),
          item.amount,
          item.approvedAt ? new Date(item.approvedAt).toLocaleDateString('id-ID') : '-'
        ])
      ];

      // Create sheets array
      const sheets = [
        { name: 'Ringkasan', data: summaryData },
        { name: 'Per Jenis', data: byTypeData },
      ];

      if (data.discrepancies.length > 0) {
        sheets.push({ name: 'Tanpa Jurnal', data: discrepanciesData });
      }

      const filename = `Rekonsiliasi_Jurnal_${settings.name.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.xlsx`;
      await createAndDownloadExcelAoA(sheets, filename);
      
      toast.success('Berhasil export ke Excel');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Gagal export ke Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to PDF
  const handleExportToPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      const settings = getCooperativeSettings();
      const now = new Date();
      
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const printWindow = window.open('', '_blank');

      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Laporan Rekonsiliasi Jurnal - ${settings.name}</title>
            <style>
              @page { size: A4 portrait; margin: 1cm; }
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .header { 
                text-align: center; 
                margin-bottom: 20px; 
                border-bottom: 2px solid #333;
                padding-bottom: 15px;
              }
              .header h1 { margin: 0; font-size: 20px; font-weight: bold; }
              .header h2 { margin: 5px 0; font-size: 16px; font-weight: normal; }
              .header p { margin: 5px 0; font-size: 12px; color: #666; }
              img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
              .footer { margin-top: 30px; text-align: right; font-size: 11px; color: #666; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${settings.name}</h1>
              <p>${settings.address}</p>
              <h2>Laporan Rekonsiliasi Jurnal</h2>
              <p>Periode: ${getPeriodLabel()}</p>
            </div>
            <img src="${imgData}" />
            <div class="footer">
              <p>Dicetak pada: ${now.toLocaleDateString('id-ID', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
        
        toast.success('Laporan siap dicetak');
      }
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Gagal membuat PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Check and create alert if reconciliation is below threshold
  const checkAndCreateAlert = async (rate: number, withoutJournal: number) => {
    if (rate < 90 && withoutJournal > 0) {
      // Check if there's already a recent unread alert
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: existingAlert } = await supabase
        .from('admin_notifications')
        .select('id')
        .eq('notification_type', 'reconciliation_alert')
        .eq('is_read', false)
        .gte('created_at', oneDayAgo.toISOString())
        .maybeSingle();

      if (!existingAlert) {
        await supabase
          .from('admin_notifications')
          .insert({
            title: 'Peringatan Rekonsiliasi Jurnal',
            message: `Tingkat rekonsiliasi jurnal ${rate.toFixed(1)}% (di bawah 90%). Ada ${withoutJournal} transaksi belum memiliki jurnal.`,
            notification_type: 'reconciliation_alert',
            metadata: {
              reconciliation_rate: rate,
              transactions_without_journal: withoutJournal,
              alert_threshold: 90,
            },
          });
      }
    }
  };

  // Fetch transactions and journals data
  const { data: reconciliationData, isLoading, refetch } = useQuery({
    queryKey: ['journalReconciliation', selectedPeriod],
    queryFn: async (): Promise<ReconciliationData> => {
      // Build date filter
      let dateFilter = {};
      const now = new Date();
      
      if (selectedPeriod === 'today') {
        const today = now.toISOString().split('T')[0];
        dateFilter = { gte: today };
      } else if (selectedPeriod === 'week') {
        const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
        dateFilter = { gte: weekAgo };
      } else if (selectedPeriod === 'month') {
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
        dateFilter = { gte: monthAgo };
      } else if (selectedPeriod === 'year') {
        const yearAgo = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString();
        dateFilter = { gte: yearAgo };
      }

      // Fetch approved transactions
      let query = supabase
        .from('transactions')
        .select(`
          id, type, amount, date, notes, approved_at, installment_id, user_id,
          profiles:user_id(name, member_number)
        `)
        .eq('status', 'approved')
        .order('approved_at', { ascending: false });

      if (selectedPeriod !== 'all' && Object.keys(dateFilter).length > 0) {
        query = query.gte('approved_at', (dateFilter as any).gte);
      }

      const { data: transactions, error } = await query;
      
      if (error) throw error;

      // Fetch total journal entries count
      const { count: journalCount } = await supabase
        .from('journal_entries')
        .select('*', { count: 'exact', head: true });

      // Process data
      const transactionsData = transactions || [];
      const withJournal = transactionsData.filter(t => getJournalNumber(t.notes));
      const withoutJournal = transactionsData.filter(t => !getJournalNumber(t.notes));

      // Group by type
      const typeGroups = transactionsData.reduce((acc, t) => {
        if (!acc[t.type]) {
          acc[t.type] = { approved: 0, withJournal: 0, withoutJournal: 0 };
        }
        acc[t.type].approved++;
        if (getJournalNumber(t.notes)) {
          acc[t.type].withJournal++;
        } else {
          acc[t.type].withoutJournal++;
        }
        return acc;
      }, {} as Record<string, { approved: number; withJournal: number; withoutJournal: number }>);

      const byType = Object.entries(typeGroups).map(([type, data]) => ({
        type,
        typeLabel: getTransactionTypeLabel(type as any),
        ...data,
        rate: data.approved > 0 ? (data.withJournal / data.approved) * 100 : 0,
      }));

      // Map discrepancies
      const discrepancies = withoutJournal.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        date: t.date,
        memberName: (t.profiles as any)?.name || 'Unknown',
        memberNumber: (t.profiles as any)?.member_number || null,
        approvedAt: t.approved_at,
      }));

      const reconciliationRate = transactionsData.length > 0 
        ? (withJournal.length / transactionsData.length) * 100 
        : 100;

      // Check and create alert if below threshold (only for "all" period)
      if (selectedPeriod === 'all') {
        checkAndCreateAlert(reconciliationRate, withoutJournal.length);
      }

      return {
        totalApprovedTransactions: transactionsData.length,
        totalJournalsCreated: journalCount || 0,
        transactionsWithJournal: withJournal.length,
        transactionsWithoutJournal: withoutJournal.length,
        reconciliationRate,
        byType,
        discrepancies,
      };
    },
  });

  // Handle bulk regenerate
  const handleBulkRegenerate = async () => {
    if (!reconciliationData || reconciliationData.discrepancies.length === 0) return;

    // Fetch full transaction data for regeneration
    const { data: fullTransactions } = await supabase
      .from('transactions')
      .select(`
        id, type, amount, user_id, installment_id, notes,
        profiles:user_id(name, member_number)
      `)
      .in('id', reconciliationData.discrepancies.map(d => d.id));

    if (!fullTransactions) return;

    setIsBulkRegenerating(true);
    setBulkProgress({ current: 0, total: fullTransactions.length, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < fullTransactions.length; i++) {
      const transaction = fullTransactions[i];
      const templateType = transaction.type as TemplateType;

      if (!isTemplateReady(templateType)) {
        failedCount++;
        setBulkProgress(prev => ({ ...prev, current: i + 1, failed: failedCount }));
        continue;
      }

      const transactionData: TransactionData = {
        id: transaction.id,
        type: templateType,
        amount: transaction.amount,
        user_id: transaction.user_id,
        memberName: (transaction.profiles as any)?.name || 'Unknown',
        installment_id: transaction.installment_id || undefined,
      };

      let installmentData = undefined;
      if (transaction.type === 'bayar_angsuran_pinjaman' && transaction.installment_id) {
        installmentData = await getInstallmentData(transaction.installment_id) || undefined;
      }

      const result = await createJournalOnApproval(transactionData, installmentData);

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }

      setBulkProgress(prev => ({ 
        ...prev, 
        current: i + 1, 
        success: successCount,
        failed: failedCount 
      }));
    }

    setIsBulkRegenerating(false);

    if (successCount > 0) {
      toast.success(`Berhasil membuat ${successCount} jurnal`, {
        description: failedCount > 0 ? `${failedCount} transaksi gagal` : undefined
      });
      
      await queryClient.invalidateQueries({ queryKey: ['journalReconciliation'] });
      await queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      await queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
    } else if (failedCount > 0) {
      toast.error('Gagal membuat jurnal', {
        description: 'Pastikan template jurnal sudah dikonfigurasi'
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const data = reconciliationData;
  const isFullyReconciled = data?.reconciliationRate === 100;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-primary" />
              Rekonsiliasi Jurnal
            </h2>
            <p className="text-muted-foreground mt-1">
              Perbandingan transaksi approved dengan jurnal yang dibuat
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Waktu</SelectItem>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="week">7 Hari Terakhir</SelectItem>
                <SelectItem value="month">30 Hari Terakhir</SelectItem>
                <SelectItem value="year">1 Tahun Terakhir</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Export Dropdown */}
            <ExportButtons
              onExportExcel={handleExportToExcel}
              onExportPDF={handleExportToPDF}
              disabled={!reconciliationData}
              isExporting={isExporting}
            />
            
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Report Content for PDF Export */}
        <div ref={reportRef}>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Transaksi Disetujui
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.totalApprovedTransactions || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total transaksi dengan status approved
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Dengan Jurnal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {data?.transactionsWithJournal || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Transaksi yang sudah memiliki jurnal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tanpa Jurnal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(data?.transactionsWithoutJournal || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
                {data?.transactionsWithoutJournal || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Transaksi yang belum memiliki jurnal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tingkat Rekonsiliasi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${isFullyReconciled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {data?.reconciliationRate.toFixed(1) || 0}%
              </div>
              <Progress 
                value={data?.reconciliationRate || 0} 
                className="mt-2 h-2"
              />
            </CardContent>
          </Card>
        </div>

        {/* Reconciliation Status */}
        <Card className={isFullyReconciled ? 'border-emerald-200 dark:border-emerald-800' : 'border-amber-200 dark:border-amber-800'}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isFullyReconciled ? (
                  <>
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-emerald-700 dark:text-emerald-400">Rekonsiliasi Lengkap</p>
                      <p className="text-sm text-muted-foreground">Semua transaksi sudah memiliki jurnal yang sesuai</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium text-amber-700 dark:text-amber-400">Rekonsiliasi Belum Lengkap</p>
                      <p className="text-sm text-muted-foreground">
                        {data?.transactionsWithoutJournal} transaksi belum memiliki jurnal
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              {!isFullyReconciled && (data?.transactionsWithoutJournal || 0) > 0 && (
                <Button 
                  onClick={handleBulkRegenerate}
                  disabled={isBulkRegenerating}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isBulkRegenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {bulkProgress.current}/{bulkProgress.total}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Buat Semua Jurnal
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {/* Bulk progress */}
            {isBulkRegenerating && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Membuat jurnal... {bulkProgress.current} dari {bulkProgress.total}</span>
                  <div className="flex gap-3">
                    <span className="text-emerald-600">✓ {bulkProgress.success}</span>
                    {bulkProgress.failed > 0 && (
                      <span className="text-rose-600">✗ {bulkProgress.failed}</span>
                    )}
                  </div>
                </div>
                <Progress value={(bulkProgress.current / bulkProgress.total) * 100} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Type Breakdown */}
        {data?.byType && data.byType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Rekonsiliasi per Jenis Transaksi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jenis Transaksi</TableHead>
                    <TableHead className="text-right">Disetujui</TableHead>
                    <TableHead className="text-right">Dengan Jurnal</TableHead>
                    <TableHead className="text-right">Tanpa Jurnal</TableHead>
                    <TableHead className="text-right">Tingkat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byType.map((item) => (
                    <TableRow key={item.type}>
                      <TableCell className="font-medium">{item.typeLabel}</TableCell>
                      <TableCell className="text-right">{item.approved}</TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                        {item.withJournal}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.withoutJournal > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">{item.withoutJournal}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={item.rate === 100 ? 'success' : 'outline'}
                          className={item.rate === 100 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                          }
                        >
                          {item.rate.toFixed(0)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Discrepancies List */}
        {data?.discrepancies && data.discrepancies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Transaksi Tanpa Jurnal ({data.discrepancies.length})
              </CardTitle>
              <CardDescription>
                Daftar transaksi approved yang belum memiliki entri jurnal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anggota</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead>Tanggal Approval</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.discrepancies.slice(0, 20).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.memberName}</p>
                          <p className="text-xs text-muted-foreground">{item.memberNumber || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTransactionTypeLabel(item.type as any)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.approvedAt ? formatShortDate(item.approvedAt) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.discrepancies.length > 20 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  ... dan {data.discrepancies.length - 20} transaksi lainnya
                </p>
              )}
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </TooltipProvider>
  );
};
