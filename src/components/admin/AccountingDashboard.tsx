import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Printer, CalendarCheck, Loader2, FileSpreadsheet, FileText } from 'lucide-react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { MonthlyClosingDialog } from './MonthlyClosingDialog';
import { RupiahIcon } from '@/components/ui/rupiah-icon';
import { BalanceSheetView } from './accounting/BalanceSheetView';
import { ProfitLossView } from './accounting/ProfitLossView';
import { SHUDistributionView } from './accounting/SHUDistributionView';
import { RoleManagement } from './accounting/RoleManagement';
import { IncomeExpenseForm } from './accounting/IncomeExpenseForm';
import { SHUChartView } from './accounting/SHUChartView';
import { InterestReportView } from './accounting/InterestReportView';
import { BusinessUnitsManagement } from './accounting/BusinessUnitsManagement';
import { ChartOfAccountsManagement } from './accounting/ChartOfAccountsManagement';
import { JournalEntriesManagement } from './accounting/JournalEntriesManagement';
import { BusinessUnitReportCombined } from './accounting/BusinessUnitReportCombined';
import { CashBankBook } from './accounting/CashBankBook';
import { JournalTemplatesManagement } from './accounting/JournalTemplatesManagement';
import { CashFlowStatement } from './accounting/CashFlowStatement';
import { BankReconciliation } from './accounting/BankReconciliation';
import { AdminNotificationsPanel } from './AdminNotificationsPanel';
import { PeriodComparisonReport } from './accounting/PeriodComparisonReport';
import { FinancialProjections } from './accounting/FinancialProjections';
import { FinancialRatiosView } from './accounting/FinancialRatiosView';
import { FixedAssetDepreciation } from './accounting/FixedAssetDepreciation';
import { ExecutiveDashboard } from './accounting/ExecutiveDashboard';
import { AccountingMenu } from './accounting/AccountingMenu';
import { AutoJournalHistory } from './accounting/AutoJournalHistory';
import { AccountingGuide } from './accounting/AccountingGuide';
import { JournalReconciliationReport } from './accounting/JournalReconciliationReport';
import { EarlyPayoffReport } from './accounting/EarlyPayoffReport';
import { LoanAdjustmentReport } from './accounting/LoanAdjustmentReport';
import { WithheldSHUManagement } from './accounting/WithheldSHUManagement';
import { SHURolloverPanel } from './accounting/SHURolloverPanel';
import { OverdueDashboard } from './OverdueDashboard';
import { BalanceReconciliationDashboard } from './BalanceReconciliationDashboard';
import { SavingsAuditTrail } from './SavingsAuditTrail';
import { CrossYearLoanReport } from './accounting/CrossYearLoanReport';
import { ExitedMemberSHUReport } from './accounting/ExitedMemberSHUReport';
import { OverpaymentReport } from './OverpaymentReport';
import { InstallmentReport } from './InstallmentReport';
import { CollateralReport } from './CollateralReport';
import { VerificationList } from './VerificationList';
import { SHUReconciliationReport } from './accounting/SHUReconciliationReport';
import { QuickActionsPanel } from './accounting/QuickActionsPanel';
import { usePendingTransactionCount } from '@/hooks/usePendingTransactionCount';
import { useAllTransactions } from '@/hooks/useAllTransactions';
import {
  BalanceSheet, ProfitLoss, SHUDistributionResult,
  getCooperativeSettings
} from '@/lib/cooperativeSettings';
import { useBalanceSheetCalculation } from '@/hooks/useBalanceSheetCalculation';
import { useProfitLossCalculation, useIncomeExpenseEntries } from '@/hooks/useProfitLossCalculation';
import { useSHUCalculation } from '@/hooks/useSHUCalculation';
import { 
  exportBalanceSheetToExcel, 
  exportProfitLossToExcel, 
  printReportToPDF 
} from '@/lib/financialReportExport';
import { toast } from 'sonner';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';

interface AccountingDashboardProps {
  onBack: () => void;
  initialTab?: string;
}

export const AccountingDashboard = ({ onBack, initialTab }: AccountingDashboardProps) => {
  const { t } = useThemeLanguage();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState(initialTab || 'eksekutif');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showMonthlyClosing, setShowMonthlyClosing] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  // Pending transactions for verification
  const { count: pendingCount } = usePendingTransactionCount();
  const { transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useAllTransactions();

  // Listen for navigation events to switch tabs
  useEffect(() => {
    const handleNavigateToSHUWithheld = () => {
      setActiveTab('shu-withheld');
    };

    const handleNavigateToJournalTemplates = () => {
      setActiveTab('jurnal-template');
    };

    window.addEventListener('navigate-to-shu-withheld', handleNavigateToSHUWithheld);
    window.addEventListener('navigate-to-journal-templates', handleNavigateToJournalTemplates);

    return () => {
      window.removeEventListener('navigate-to-shu-withheld', handleNavigateToSHUWithheld);
      window.removeEventListener('navigate-to-journal-templates', handleNavigateToJournalTemplates);
    };
  }, []);

  const settings = getCooperativeSettings();
  
  // Use new hooks that fetch from Supabase with auto-calculation
  const { balanceSheet, loading: loadingBalance } = useBalanceSheetCalculation(selectedYear);
  const { profitLoss, loading: loadingPL } = useProfitLossCalculation(selectedYear);
  const { incomeEntries, expenseEntries } = useIncomeExpenseEntries(selectedYear);
  const { distribution: shuDistribution, confirmDistribution, loading: loadingSHU } = useSHUCalculation(
    selectedYear, 
    profitLoss?.shuBruto || 0
  );

  const isLoading = loadingBalance || loadingPL || loadingSHU;

  // Handle SHU confirmation
  const handleConfirmSHU = async (confirmed: SHUDistributionResult) => {
    await confirmDistribution();
  };

  // Generate historical data for charts (simplified)
  const generateHistoricalData = () => {
    const years = [currentYear - 2, currentYear - 1, currentYear];
    const baseSHU = profitLoss?.shuBruto || 0;
    const baseModal = balanceSheet?.totalHartaKoperasi || 0;
    return years.map((year, index) => ({
      year,
      shuBruto: Math.round(baseSHU * (0.7 + index * 0.15)),
      totalModal: Math.round(baseModal * (0.75 + index * 0.125)),
      simpananPokok: Math.round((balanceSheet?.simpananPokok || 0) * (0.8 + index * 0.1)),
      simpananWajib: Math.round((balanceSheet?.simpananWajib || 0) * (0.75 + index * 0.125)),
      simpananSukarela: Math.round((balanceSheet?.simpananSukarela || 0) * (0.7 + index * 0.15)),
      danaCadangan: Math.round((balanceSheet?.danaCadangan || 0) * (0.6 + index * 0.2)),
    }));
  };

  const historicalData = generateHistoricalData();

  // Print to PDF function using utility
  const handlePrintPDF = async (
    reportType?: 'neraca' | 'labarugi' | 'aruskas' | 'shu',
    orientation: 'portrait' | 'landscape' = 'portrait'
  ) => {
    if (!printRef.current) return;
    
    const type = reportType || (activeTab as 'neraca' | 'labarugi' | 'aruskas' | 'shu');
    setIsPrinting(true);
    toast.info(t(`Menyiapkan dokumen PDF (${orientation === 'landscape' ? 'Landscape' : 'Portrait'})...`, `Preparing PDF document (${orientation})...`));

    try {
      const success = await printReportToPDF(printRef, type, selectedYear, orientation);
      if (success) {
        toast.success(t('Dokumen PDF siap dicetak', 'PDF document ready to print'));
      } else {
        toast.error(t('Gagal membuat PDF', 'Failed to create PDF'));
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error generating PDF:', error);
      toast.error(t('Gagal membuat PDF', 'Failed to create PDF'));
    } finally {
      setIsPrinting(false);
    }
  };

  // Export to Excel based on active tab
  const handleExportExcel = (reportType: 'neraca' | 'labarugi' | 'shu') => {
    setIsExporting(true);
    
    try {
      switch (reportType) {
        case 'neraca':
          if (!balanceSheet) {
            toast.error(t('Data neraca belum tersedia', 'Balance sheet data not available'));
            return;
          }
          exportBalanceSheetToExcel(balanceSheet, selectedYear);
          toast.success(t('Neraca berhasil diekspor ke Excel', 'Balance sheet exported to Excel'));
          break;
          
        case 'labarugi':
          if (!profitLoss) {
            toast.error(t('Data laba rugi belum tersedia', 'Profit/Loss data not available'));
            return;
          }
          exportProfitLossToExcel(profitLoss, incomeEntries, expenseEntries, selectedYear);
          toast.success(t('Laba Rugi berhasil diekspor ke Excel', 'Profit/Loss exported to Excel'));
          break;
          
        case 'shu':
          if (!shuDistribution) {
            toast.error(t('Data SHU belum tersedia', 'SHU data not available'));
            return;
          }
          exportSHUToExcel();
          break;
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error exporting:', error);
      toast.error(t('Gagal mengekspor data', 'Failed to export data'));
    } finally {
      setIsExporting(false);
    }
  };

  // Export SHU to Excel
  const exportSHUToExcel = async () => {
    if (!shuDistribution) return;
    
    const coopSettings = getCooperativeSettings();
    const memberDistributions = shuDistribution.memberDistributions || [];
    
    const memberData = memberDistributions.map((m, idx) => ({
      'No': idx + 1,
      'Nama Anggota': m.memberName,
      'SHU Jasa Simpanan': m.simpananShare,
      'SHU Jasa Usaha': m.jasaUsahaShare,
      'Total SHU': m.totalShare,
    }));

    memberData.push({
      'No': null as any,
      'Nama Anggota': 'TOTAL',
      'SHU Jasa Simpanan': memberDistributions.reduce((sum, m) => sum + m.simpananShare, 0),
      'SHU Jasa Usaha': memberDistributions.reduce((sum, m) => sum + m.jasaUsahaShare, 0),
      'Total SHU': memberDistributions.reduce((sum, m) => sum + m.totalShare, 0),
    });

    const roleData = shuDistribution.roleDistributions.map((r, idx) => ({
      'No': idx + 1,
      'Nama': r.name,
      'Jabatan': r.role === 'pengurus' ? 'Pengurus' : r.role === 'pengawas' ? 'Pengawas' : 'Penasihat',
      'Status Anggota': r.isMember ? 'Ya' : 'Tidak',
      'Jumlah SHU': r.amount,
    }));

    const summaryData = [
      { 'Keterangan': 'SHU Bruto', 'Nilai': shuDistribution.shuBruto },
      { 'Keterangan': `SHU Anggota`, 'Nilai': shuDistribution.shuAnggotaTotal },
      { 'Keterangan': `Dana Cadangan`, 'Nilai': shuDistribution.danaCadangan },
    ];

    type SheetDataItem = { name: string; data: Record<string, any>[] };
    const sheets: SheetDataItem[] = [
      { name: 'Ringkasan SHU', data: summaryData },
      { name: 'SHU Anggota', data: memberData },
    ];
    
    if (roleData.length > 0) {
      sheets.push({ name: 'SHU Pengurus', data: roleData });
    }
    
    await createAndDownloadExcelFromJson(sheets, `SHU_${coopSettings.name.replace(/\s+/g, '_')}_${selectedYear}.xlsx`);
    toast.success(t('Data SHU berhasil diekspor ke Excel', 'SHU data exported to Excel'));
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">{t('Pembukuan Koperasi', 'Cooperative Accounting')}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{t('Neraca, Laba Rugi, dan Distribusi SHU', 'Balance Sheet, Income Statement, and SHU Distribution')}</p>
          </div>
        </div>
        
        {/* Action Buttons - Responsive Grid */}
        <div className="flex flex-wrap items-center gap-2 pl-11 sm:pl-0">
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => setShowMonthlyClosing(true)}
            className="gap-1.5 h-8 text-xs sm:text-sm"
          >
            <CalendarCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">{t('Tutup Buku', 'Close Book')}</span>
            <span className="xs:hidden">{t('Tutup', 'Close')}</span>
          </Button>
          
          {/* Export Excel Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 h-8 text-xs sm:text-sm"
                disabled={isExporting}
              >
              <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{isExporting ? t('Mengekspor...', 'Exporting...') : 'Excel'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => handleExportExcel('neraca')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t('Neraca Keuangan', 'Balance Sheet')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportExcel('labarugi')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t('Laba Rugi', 'Income Statement')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportExcel('shu')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t('Distribusi SHU', 'SHU Distribution')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Print PDF Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 h-8 text-xs sm:text-sm"
                disabled={isPrinting}
              >
              <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{isPrinting ? t('Menyiapkan...', 'Preparing...') : 'PDF'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{t('Portrait (Standar)', 'Portrait (Standard)')}</div>
              <DropdownMenuItem onClick={() => handlePrintPDF('neraca', 'portrait')}>
                <FileText className="h-4 w-4 mr-2" />
                {t('Neraca Keuangan', 'Balance Sheet')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrintPDF('labarugi', 'portrait')}>
                <FileText className="h-4 w-4 mr-2" />
                {t('Laba Rugi', 'Income Statement')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrintPDF('aruskas', 'portrait')}>
                <FileText className="h-4 w-4 mr-2" />
                {t('Arus Kas', 'Cash Flow')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrintPDF('shu', 'portrait')}>
                <FileText className="h-4 w-4 mr-2" />
                {t('Distribusi SHU', 'SHU Distribution')}
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{t('Landscape (Tabel Lebar)', 'Landscape (Wide Table)')}</div>
              <DropdownMenuItem onClick={() => handlePrintPDF('neraca', 'landscape')}>
                <FileText className="h-4 w-4 mr-2" />
                {t('Neraca Keuangan', 'Balance Sheet')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrintPDF('labarugi', 'landscape')}>
                <FileText className="h-4 w-4 mr-2" />
                {t('Laba Rugi', 'Income Statement')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrintPDF('aruskas', 'landscape')}>
                <FileText className="h-4 w-4 mr-2" />
                {t('Arus Kas', 'Cash Flow')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrintPDF('shu', 'landscape')}>
                <FileText className="h-4 w-4 mr-2" />
                {t('Distribusi SHU', 'SHU Distribution')}
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={() => handlePrintPDF(undefined, 'portrait')}>
                <Printer className="h-4 w-4 mr-2" />
                {t('Cetak Aktif (Portrait)', 'Print Active (Portrait)')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrintPDF(undefined, 'landscape')}>
                <Printer className="h-4 w-4 mr-2" />
                {t('Cetak Aktif (Landscape)', 'Print Active (Landscape)')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-20 sm:w-28 h-8 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Categorized Menu - Sticky */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b pb-3 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-2">
        <AccountingMenu activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Guide */}
      <AccountingGuide />

      {/* Content */}
      <div ref={printRef} className="mt-4 md:mt-6">
        {activeTab === 'eksekutif' && <div className="animate-fade-in"><ExecutiveDashboard onNavigateToReconciliation={() => setActiveTab('rekonjurnal')} /></div>}
        {activeTab === 'notif' && <div className="animate-fade-in"><AdminNotificationsPanel /></div>}
        {activeTab === 'verifikasi' && (
          <div className="animate-fade-in">
            <VerificationList 
              transactions={transactions} 
              isLoading={transactionsLoading}
              onRefresh={async () => { await refetchTransactions(); }}
            />
          </div>
        )}
        {activeTab === 'neraca' && <div className="animate-fade-in"><BalanceSheetView balanceSheet={balanceSheet} /></div>}
        {activeTab === 'labarugi' && <div className="animate-fade-in"><ProfitLossView profitLoss={profitLoss} incomeEntries={incomeEntries} expenseEntries={expenseEntries} /></div>}
        {activeTab === 'perbandingan' && <div className="animate-fade-in"><PeriodComparisonReport /></div>}
        {activeTab === 'proyeksi' && <div className="animate-fade-in"><FinancialProjections /></div>}
        {activeTab === 'laporan' && <div className="animate-fade-in"><BusinessUnitReportCombined /></div>}
        {activeTab === 'aruskas' && <div className="animate-fade-in"><CashFlowStatement /></div>}
        {activeTab === 'rasio' && <div className="animate-fade-in"><FinancialRatiosView year={selectedYear} /></div>}
        {activeTab === 'kasbank' && <div className="animate-fade-in"><CashBankBook /></div>}
        {activeTab === 'rekonbank' && <div className="animate-fade-in"><BankReconciliation /></div>}
        {activeTab === 'rekonjurnal' && <div className="animate-fade-in"><JournalReconciliationReport /></div>}
        {activeTab === 'jurnal' && <div className="animate-fade-in"><JournalEntriesManagement /></div>}
        {activeTab === 'auto-jurnal' && <div className="animate-fade-in"><AutoJournalHistory /></div>}
        {activeTab === 'jurnal-template' && <div className="animate-fade-in"><JournalTemplatesManagement /></div>}
        {activeTab === 'coa' && <div className="animate-fade-in"><ChartOfAccountsManagement /></div>}
        {activeTab === 'unit' && <div className="animate-fade-in"><BusinessUnitsManagement /></div>}
        {activeTab === 'aset' && <div className="animate-fade-in"><FixedAssetDepreciation /></div>}
        {activeTab === 'input' && <div className="animate-fade-in"><IncomeExpenseForm year={selectedYear} /></div>}
        {activeTab === 'bunga' && <div className="animate-fade-in"><InterestReportView /></div>}
        {activeTab === 'shu-ditahan' && <div className="animate-fade-in"><WithheldSHUManagement /></div>}
        {activeTab === 'shu-rollover' && <div className="animate-fade-in"><SHURolloverPanel selectedYear={selectedYear} /></div>}
        {activeTab === 'shu-rekonsiliasi' && <div className="animate-fade-in"><SHUReconciliationReport /></div>}
        {activeTab === 'shu' && shuDistribution && <div className="animate-fade-in"><SHUDistributionView distribution={shuDistribution} onConfirm={handleConfirmSHU} settings={settings} /></div>}
        {activeTab === 'shu-anggota-keluar' && <div className="animate-fade-in"><ExitedMemberSHUReport year={selectedYear} /></div>}
        {activeTab === 'shu' && !shuDistribution && !loadingSHU && (
          <Card className="p-8 text-center animate-fade-in">
            <CardContent>
              <p className="text-muted-foreground mb-4">{t(`Data SHU belum tersedia. Pastikan data Laba Rugi sudah dihitung untuk tahun ${selectedYear}.`, `SHU data not available. Please ensure Profit/Loss data is calculated for year ${selectedYear}.`)}</p>
              <p className="text-sm text-muted-foreground">{t('SHU Bruto', 'Gross SHU')}: {profitLoss?.shuBruto ? `Rp ${profitLoss.shuBruto.toLocaleString('id-ID')}` : 'Rp 0'}</p>
            </CardContent>
          </Card>
        )}
        {activeTab === 'shu' && loadingSHU && (
          <div className="flex items-center justify-center h-64 animate-fade-in">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {activeTab === 'grafik' && <div className="animate-fade-in"><SHUChartView historicalData={historicalData} currentYear={selectedYear} /></div>}
        {activeTab === 'peran' && <div className="animate-fade-in"><RoleManagement /></div>}
        {activeTab === 'pelunasan-dini' && <div className="animate-fade-in"><EarlyPayoffReport /></div>}
        {activeTab === 'keringanan' && <div className="animate-fade-in"><LoanAdjustmentReport /></div>}
        {activeTab === 'pinjaman-lintas' && <div className="animate-fade-in"><CrossYearLoanReport /></div>}
        {activeTab === 'tunggakan' && <div className="animate-fade-in"><OverdueDashboard /></div>}
        {activeTab === 'rekonsaldo' && <div className="animate-fade-in"><BalanceReconciliationDashboard /></div>}
        {activeTab === 'audit-simpanan' && <div className="animate-fade-in"><SavingsAuditTrail onBack={() => setActiveTab('eksekutif')} /></div>}
        {activeTab === 'kelebihan-bayar' && <div className="animate-fade-in"><OverpaymentReport onBack={() => setActiveTab('eksekutif')} /></div>}
        {activeTab === 'laporan-angsuran' && <div className="animate-fade-in"><InstallmentReport /></div>}
        {activeTab === 'agunan' && <div className="animate-fade-in"><CollateralReport onBack={() => setActiveTab('eksekutif')} /></div>}
      </div>

      {/* Quick Actions Panel */}
      <QuickActionsPanel
        pendingCount={pendingCount}
        onCreateJournal={() => setActiveTab('jurnal')}
        onViewPending={() => setActiveTab('verifikasi')}
        onReconcile={() => setActiveTab('rekonsaldo')}
        onExport={() => handleExportExcel('neraca')}
        onConfigureTemplates={() => setActiveTab('jurnal-template')}
      />

      <MonthlyClosingDialog 
        open={showMonthlyClosing} 
        onOpenChange={setShowMonthlyClosing}
      />
    </div>
  );
};
