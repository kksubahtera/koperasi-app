import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/filter-select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/mockData';
import { useExecutiveDashboard, KPIData, Alert } from '@/hooks/useExecutiveDashboard';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import {
  TrendingUp, TrendingDown, AlertTriangle, AlertCircle, Info,
  Users, Banknote, PieChart, Activity, ArrowUpRight,
  ArrowDownRight, Minus, RefreshCw, BarChart3, Wallet, Building2,
  FileDown, Printer
} from 'lucide-react';
import { RupiahIcon } from '@/components/ui/rupiah-icon';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FinancialHealthWidget } from './FinancialHealthWidget';
import { ReconciliationWidget } from './ReconciliationWidget';

interface ExecutiveDashboardProps {
  onNavigateToReconciliation?: () => void;
}

const currentYear = new Date().getFullYear();

const KPICard = ({ kpi, t }: { kpi: KPIData; t: (id: string, en: string) => string }) => {
  const formatValue = (value: number, format: string) => {
    if (format === 'currency') return formatCurrency(value);
    if (format === 'percent') return `${value.toFixed(2)}%`;
    return value.toLocaleString('id-ID');
  };

  const getTrendIcon = () => {
    if (kpi.trend === 'up') return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    if (kpi.trend === 'down') return <ArrowDownRight className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getCategoryIcon = () => {
    switch (kpi.category) {
      case 'income': return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'expense': return <TrendingDown className="h-5 w-5 text-red-600" />;
      case 'asset': return <Wallet className="h-5 w-5 text-blue-600" />;
      case 'liability': return <Building2 className="h-5 w-5 text-orange-600" />;
      case 'member': return <Users className="h-5 w-5 text-purple-600" />;
      case 'loan': return <Banknote className="h-5 w-5 text-amber-600" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  const getCategoryColor = () => {
    switch (kpi.category) {
      case 'income': return 'border-l-green-500';
      case 'expense': return 'border-l-red-500';
      case 'asset': return 'border-l-blue-500';
      case 'liability': return 'border-l-orange-500';
      case 'member': return 'border-l-purple-500';
      case 'loan': return 'border-l-amber-500';
      default: return 'border-l-muted';
    }
  };

  // Translate KPI labels
  const getTranslatedLabel = (label: string) => {
    const translations: Record<string, string> = {
      'Total Pendapatan': 'Total Income',
      'Total Biaya': 'Total Expenses',
      'SHU Bruto': 'Gross SHU',
      'Total Simpanan': 'Total Savings',
      'Piutang Pinjaman': 'Loan Receivables',
      'Rasio NPL': 'NPL Ratio',
      'Jumlah Anggota': 'Member Count',
      'Pinjaman Aktif': 'Active Loans',
    };
    return t(label, translations[label] || label);
  };

  return (
    <Card className={cn("border-l-4 transition-all hover:shadow-md min-h-[100px] sm:min-h-[120px]", getCategoryColor())}>
      <CardContent className="py-3 sm:py-4 px-3 sm:px-6 h-full flex items-center">
        <div className="w-full">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="shrink-0">{getCategoryIcon()}</span>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{getTranslatedLabel(kpi.label)}</p>
              </div>
              <p className="text-lg sm:text-2xl font-bold truncate">{formatValue(kpi.value, kpi.format)}</p>
            </div>
            {kpi.changePercent !== 0 && (
              <div className={cn(
                "flex items-center gap-0.5 sm:gap-1 rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium shrink-0",
                kpi.trend === 'up' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                kpi.trend === 'down' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                "bg-muted text-muted-foreground"
              )}>
                {getTrendIcon()}
                <span className="hidden xs:inline">{Math.abs(kpi.changePercent).toFixed(1)}%</span>
              </div>
            )}
          </div>
          {kpi.previousValue > 0 && kpi.format === 'currency' && (
            <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-muted-foreground truncate">
              {t('Tahun lalu', 'Last year')}: {formatValue(kpi.previousValue, kpi.format)}
            </p>
          )}
          {kpi.id === 'member-count' && kpi.change > 0 && (
            <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-muted-foreground">
              {kpi.change} {t('pendaftaran menunggu', 'pending registrations')}
            </p>
          )}
          {kpi.id === 'loan-count' && kpi.previousValue > 0 && (
            <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-red-500">
              {kpi.previousValue} {t('pinjaman bermasalah', 'problem loans')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const AlertCard = ({ alert, t }: { alert: Alert; t: (id: string, en: string) => string }) => {
  const getAlertStyles = () => {
    switch (alert.type) {
      case 'critical':
        return {
          bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
          icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
          badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
          icon: <AlertCircle className="h-5 w-5 text-amber-600" />,
          badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
          icon: <Info className="h-5 w-5 text-blue-600" />,
          badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
        };
    }
  };

  const styles = getAlertStyles();
  const typeLabel = alert.type === 'critical' ? t('Kritis', 'Critical') : 
                   alert.type === 'warning' ? t('Peringatan', 'Warning') : t('Info', 'Info');

  return (
    <div className={cn("rounded-lg border p-3 sm:p-4 transition-all hover:shadow-sm", styles.bg)}>
      <div className="flex items-start gap-2 sm:gap-3">
        <span className="shrink-0 mt-0.5">{styles.icon}</span>
        <div className="flex-1 space-y-0.5 sm:space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-xs sm:text-sm">{alert.title}</h4>
            <Badge variant="secondary" className={cn("text-[10px] sm:text-xs", styles.badge)}>
              {typeLabel}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{alert.message}</p>
        </div>
      </div>
    </div>
  );
};

export const ExecutiveDashboard = ({ onNavigateToReconciliation }: ExecutiveDashboardProps = {}) => {
  const { t } = useThemeLanguage();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const {
    loading,
    summary,
    kpis,
    alerts,
    criticalAlerts,
    warningAlerts,
    infoAlerts,
    monthlyTrends,
    refetch
  } = useExecutiveDashboard(selectedYear);

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    
    setIsExporting(true);
    toast.info(t('Menyiapkan laporan PDF...', 'Preparing PDF report...'));
    
    try {
      const settings = getCooperativeSettings();
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Header
      pdf.setFillColor(59, 130, 246); // Blue
      pdf.rect(0, 0, pageWidth, 35, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(settings.name, pageWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Laporan Dashboard Eksekutif', pageWidth / 2, 22, { align: 'center' });
      pdf.text(`Tahun Buku ${selectedYear}`, pageWidth / 2, 28, { align: 'center' });
      
      yPos = 45;

      // Report Info
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(9);
      const printDate = new Date().toLocaleDateString('id-ID', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      pdf.text(`Dicetak: ${printDate}`, margin, yPos);
      pdf.text(`Alamat: ${settings.address}`, pageWidth - margin, yPos, { align: 'right' });
      
      yPos += 10;

      // Section: Ringkasan Keuangan
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RINGKASAN KEUANGAN', margin, yPos);
      yPos += 8;

      // KPI Table
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      
      const kpiTableData = [
        ['Metrik', 'Nilai', 'Trend'],
        ['Total Aset', formatCurrency(summary.totalAset), '-'],
        ['Total Simpanan', formatCurrency(summary.totalSimpanan), '-'],
        ['Piutang Pinjaman', formatCurrency(summary.totalPiutang), '-'],
        ['SHU Bruto', formatCurrency(summary.shuBruto), summary.shuBruto >= 0 ? '✓ Positif' : '✗ Negatif'],
        ['Rasio NPL', `${summary.nplRatio.toFixed(2)}%`, summary.nplRatio <= 5 ? '✓ Aman' : '⚠ Perhatian'],
        ['Jumlah Anggota Aktif', summary.memberCount.toString(), '-'],
        ['Pinjaman Aktif', summary.loanCount.toString(), '-'],
      ];

      const colWidths = [60, 60, 45];
      const rowHeight = 7;
      let tableY = yPos;

      // Table Header
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, tableY, colWidths[0] + colWidths[1] + colWidths[2], rowHeight, 'F');
      pdf.setFont('helvetica', 'bold');
      let xPos = margin + 2;
      kpiTableData[0].forEach((cell, i) => {
        pdf.text(cell, xPos, tableY + 5);
        xPos += colWidths[i];
      });
      tableY += rowHeight;

      // Table Body
      pdf.setFont('helvetica', 'normal');
      for (let i = 1; i < kpiTableData.length; i++) {
        if (i % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, tableY, colWidths[0] + colWidths[1] + colWidths[2], rowHeight, 'F');
        }
        xPos = margin + 2;
        kpiTableData[i].forEach((cell, j) => {
          pdf.text(cell, xPos, tableY + 5);
          xPos += colWidths[j];
        });
        tableY += rowHeight;
      }

      // Table Border
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(margin, yPos, colWidths[0] + colWidths[1] + colWidths[2], tableY - yPos);

      yPos = tableY + 15;

      // Section: Alerts
      if (alerts.length > 0) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('PERHATIAN DIPERLUKAN', margin, yPos);
        yPos += 8;

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');

        alerts.forEach((alert, idx) => {
          if (yPos > pageHeight - 30) {
            pdf.addPage();
            yPos = margin;
          }

          // Alert box
          const alertColor = alert.type === 'critical' ? [254, 226, 226] : 
                            alert.type === 'warning' ? [254, 243, 199] : [219, 234, 254];
          pdf.setFillColor(alertColor[0], alertColor[1], alertColor[2]);
          pdf.roundedRect(margin, yPos, pageWidth - 2 * margin, 18, 2, 2, 'F');

          const textColor = alert.type === 'critical' ? [185, 28, 28] : 
                           alert.type === 'warning' ? [180, 83, 9] : [30, 64, 175];
          pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
          
          const typeLabel = alert.type === 'critical' ? '[KRITIS]' : 
                           alert.type === 'warning' ? '[PERINGATAN]' : '[INFO]';
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${typeLabel} ${alert.title}`, margin + 3, yPos + 6);
          
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(80, 80, 80);
          const messageLines = pdf.splitTextToSize(alert.message, pageWidth - 2 * margin - 6);
          pdf.text(messageLines[0], margin + 3, yPos + 13);
          
          yPos += 22;
        });

        yPos += 5;
      }

      // Section: KPI Details
      if (yPos > pageHeight - 80) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('DETAIL KPI', margin, yPos);
      yPos += 8;

      const kpiDetailsTable = [
        ['Metrik', 'Nilai Saat Ini', 'Nilai Sebelumnya', 'Perubahan'],
        ...kpis.map(kpi => [
          kpi.label,
          kpi.format === 'currency' ? formatCurrency(kpi.value) : 
            kpi.format === 'percent' ? `${kpi.value.toFixed(2)}%` : kpi.value.toString(),
          kpi.previousValue > 0 ? (kpi.format === 'currency' ? formatCurrency(kpi.previousValue) : kpi.previousValue.toString()) : '-',
          kpi.changePercent !== 0 ? `${kpi.changePercent > 0 ? '+' : ''}${kpi.changePercent.toFixed(1)}%` : '-'
        ])
      ];

      const detailColWidths = [50, 45, 45, 35];
      tableY = yPos;

      // Table Header
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, tableY, detailColWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      xPos = margin + 2;
      kpiDetailsTable[0].forEach((cell, i) => {
        pdf.text(cell, xPos, tableY + 5);
        xPos += detailColWidths[i];
      });
      tableY += rowHeight;

      // Table Body
      pdf.setFont('helvetica', 'normal');
      for (let i = 1; i < kpiDetailsTable.length; i++) {
        if (tableY > pageHeight - 20) {
          pdf.addPage();
          tableY = margin;
        }
        if (i % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, tableY, detailColWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
        }
        xPos = margin + 2;
        kpiDetailsTable[i].forEach((cell, j) => {
          pdf.text(cell || '-', xPos, tableY + 5);
          xPos += detailColWidths[j];
        });
        tableY += rowHeight;
      }

      // Table Border
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(margin, yPos, detailColWidths.reduce((a, b) => a + b, 0), tableY - yPos);

      yPos = tableY + 15;

      // Section: Monthly Trends Table
      if (yPos > pageHeight - 80) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('TREND BULANAN', margin, yPos);
      yPos += 8;

      const trendTable = [
        ['Bulan', 'Pendapatan', 'Biaya', 'SHU'],
        ...monthlyTrends.map(t => [
          t.period,
          formatCurrency(t.pendapatan),
          formatCurrency(t.biaya),
          formatCurrency(t.shu)
        ])
      ];

      const trendColWidths = [30, 50, 50, 50];
      tableY = yPos;

      // Table Header
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, tableY, trendColWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      xPos = margin + 2;
      trendTable[0].forEach((cell, i) => {
        pdf.text(cell, xPos, tableY + 5);
        xPos += trendColWidths[i];
      });
      tableY += rowHeight;

      // Table Body
      pdf.setFont('helvetica', 'normal');
      for (let i = 1; i < trendTable.length; i++) {
        if (tableY > pageHeight - 20) {
          pdf.addPage();
          tableY = margin;
        }
        if (i % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, tableY, trendColWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
        }
        xPos = margin + 2;
        trendTable[i].forEach((cell, j) => {
          pdf.text(cell, xPos, tableY + 5);
          xPos += trendColWidths[j];
        });
        tableY += rowHeight;
      }

      // Table Border
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(margin, yPos, trendColWidths.reduce((a, b) => a + b, 0), tableY - yPos);

      // Footer on all pages
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Halaman ${i} dari ${totalPages} | ${settings.name} | Laporan Dashboard Eksekutif ${selectedYear}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // Save PDF
      pdf.save(`Dashboard_Eksekutif_${settings.name.replace(/\s+/g, '_')}_${selectedYear}.pdf`);
      toast.success(t('Laporan PDF berhasil dibuat', 'PDF report created successfully'));
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t('Gagal membuat laporan PDF', 'Failed to create PDF report'));
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6" ref={dashboardRef}>
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            <span className="truncate">{t('Dashboard Eksekutif', 'Executive Dashboard')}</span>
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
            {t('Ringkasan KPI, trend keuangan, dan alert yang membutuhkan perhatian', 'KPI summary, financial trends, and alerts requiring attention')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportPDF}
            disabled={isExporting}
            className="gap-1.5 h-8 text-xs sm:text-sm"
          >
            <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">{isExporting ? t('Menyiapkan...', 'Preparing...') : 'Export'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={refetch} className="gap-1.5 h-8 text-xs sm:text-sm">
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">{t('Refresh', 'Refresh')}</span>
          </Button>
          <FilterSelect
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
            options={[currentYear, currentYear - 1, currentYear - 2].map(y => ({ value: String(y), label: String(y) }))}
            showAllOption={false}
            triggerClassName="w-20 sm:w-28 h-8 text-xs sm:text-sm"
          />
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-lg flex-wrap">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 shrink-0" />
              <span>{t('Perhatian', 'Attention')}</span>
              <Badge variant="secondary" className="text-[10px] sm:text-xs">
                {criticalAlerts.length > 0 && <span className="text-red-600 mr-1">{criticalAlerts.length} {t('Kritis', 'Critical')}</span>}
                {warningAlerts.length > 0 && <span className="text-amber-600 mr-1">{warningAlerts.length} {t('Peringatan', 'Warning')}</span>}
                {infoAlerts.length > 0 && <span className="text-blue-600">{infoAlerts.length} Info</span>}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <ScrollArea className="max-h-48 sm:max-h-64">
              <div className="space-y-2 sm:space-y-3">
                {criticalAlerts.map(alert => <AlertCard key={alert.id} alert={alert} t={t} />)}
                {warningAlerts.map(alert => <AlertCard key={alert.id} alert={alert} t={t} />)}
                {infoAlerts.map(alert => <AlertCard key={alert.id} alert={alert} t={t} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards - Responsive Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.slice(0, 4).map(kpi => <KPICard key={kpi.id} kpi={kpi} t={t} />)}
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.slice(4).map(kpi => <KPICard key={kpi.id} kpi={kpi} t={t} />)}
      </div>

      {/* Widgets Section - Reconciliation & Financial Health */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <ReconciliationWidget onNavigateToReconciliation={onNavigateToReconciliation} />
        <div className="lg:col-span-2">
          <FinancialHealthWidget year={selectedYear} />
        </div>
      </div>

      {/* Charts Section - Stack on Mobile */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {/* Revenue vs Expense Trend */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <span className="truncate">{t('Trend Pendapatan vs Biaya', 'Income vs Expense Trend')}</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">{t('Perbandingan bulanan tahun', 'Monthly comparison for year')} {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6 pt-0">
            <div className="h-[180px] sm:h-[220px] md:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrends} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis 
                    tick={{ fontSize: 8 }} 
                    tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`}
                    width={35}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                  <Bar dataKey="pendapatan" name={t('Pendapatan', 'Income')} fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="biaya" name={t('Biaya', 'Expenses')} fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="shu" name="SHU" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Simpanan & Pinjaman Trend */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <PieChart className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <span className="truncate">{t('Trend Simpanan & Pinjaman', 'Savings & Loans Trend')}</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">{t('Pertumbuhan kumulatif tahun', 'Cumulative growth for year')} {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6 pt-0">
            <div className="h-[180px] sm:h-[220px] md:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrends} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis 
                    tick={{ fontSize: 8 }} 
                    tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`}
                    width={35}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                  <Area 
                    type="monotone" 
                    dataKey="simpanan" 
                    name={t('Simpanan', 'Savings')} 
                    stroke="hsl(var(--chart-3))" 
                    fill="hsl(var(--chart-3))" 
                    fillOpacity={0.3}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="pinjaman" 
                    name={t('Pinjaman', 'Loans')} 
                    stroke="hsl(var(--chart-4))" 
                    fill="hsl(var(--chart-4))" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats - Responsive Grid */}
      <Card>
        <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <span>{t('Ringkasan Keuangan', 'Financial Summary')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
          <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-2.5 sm:p-3 md:p-4 border border-blue-500/20">
              <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-xs font-medium truncate">{t('Total Aset', 'Total Assets')}</span>
              </div>
              <p className="text-sm sm:text-lg md:text-xl font-bold truncate">{formatCurrency(summary.totalAset)}</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-green-500/10 to-green-600/5 p-2.5 sm:p-3 md:p-4 border border-green-500/20">
              <div className="flex items-center gap-1.5 text-green-600 mb-1">
                <RupiahIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-xs font-medium truncate">{t('Total Simpanan', 'Total Savings')}</span>
              </div>
              <p className="text-sm sm:text-lg md:text-xl font-bold truncate">{formatCurrency(summary.totalSimpanan)}</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-2.5 sm:p-3 md:p-4 border border-amber-500/20">
              <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                <Banknote className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-xs font-medium truncate">{t('Piutang', 'Receivables')}</span>
              </div>
              <p className="text-sm sm:text-lg md:text-xl font-bold truncate">{formatCurrency(summary.totalPiutang)}</p>
            </div>
            <div className={cn(
              "rounded-lg p-2.5 sm:p-3 md:p-4 border",
              summary.shuBruto >= 0 
                ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20" 
                : "bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20"
            )}>
              <div className={cn("flex items-center gap-1.5 mb-1", summary.shuBruto >= 0 ? "text-primary" : "text-red-600")}>
                <RupiahIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-xs font-medium truncate">SHU Bruto</span>
              </div>
              <p className="text-sm sm:text-lg md:text-xl font-bold truncate">{formatCurrency(summary.shuBruto)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
