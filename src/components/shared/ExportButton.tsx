import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Download, FileSpreadsheet, FileText, Loader2, CalendarIcon, CalendarDays, CalendarRange } from 'lucide-react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { ExportTransaction, exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { toast } from 'sonner';
import { format, isAfter, isBefore, startOfDay, endOfDay, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths } from 'date-fns';
import { id as localeId, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

type QuickPreset = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'all';

interface ExportButtonProps {
  transactions: ExportTransaction[];
  filename?: string;
  title?: string;
  disabled?: boolean;
}

export const ExportButton = ({ 
  transactions, 
  filename = 'laporan-transaksi',
  title,
  disabled = false 
}: ExportButtonProps) => {
  const { t, language } = useThemeLanguage();
  const [isExporting, setIsExporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [activePreset, setActivePreset] = useState<QuickPreset>('all');

  const locale = language === 'id' ? localeId : enUS;
  const today = new Date();

  const quickPresets: { key: QuickPreset; label: { id: string; en: string } }[] = [
    { key: 'all', label: { id: 'Semua', en: 'All' } },
    { key: 'today', label: { id: 'Hari Ini', en: 'Today' } },
    { key: 'yesterday', label: { id: 'Kemarin', en: 'Yesterday' } },
    { key: 'thisWeek', label: { id: 'Minggu Ini', en: 'This Week' } },
    { key: 'lastWeek', label: { id: 'Minggu Lalu', en: 'Last Week' } },
    { key: 'thisMonth', label: { id: 'Bulan Ini', en: 'This Month' } },
    { key: 'lastMonth', label: { id: 'Bulan Lalu', en: 'Last Month' } },
    { key: 'thisYear', label: { id: 'Tahun Ini', en: 'This Year' } },
  ];

  const applyPreset = (preset: QuickPreset) => {
    setActivePreset(preset);
    
    switch (preset) {
      case 'all':
        setStartDate(undefined);
        setEndDate(undefined);
        break;
      case 'today':
        setStartDate(startOfDay(today));
        setEndDate(endOfDay(today));
        break;
      case 'yesterday':
        const yesterday = subDays(today, 1);
        setStartDate(startOfDay(yesterday));
        setEndDate(endOfDay(yesterday));
        break;
      case 'thisWeek':
        setStartDate(startOfWeek(today, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(today, { weekStartsOn: 1 }));
        break;
      case 'lastWeek':
        const lastWeekDate = subDays(startOfWeek(today, { weekStartsOn: 1 }), 1);
        setStartDate(startOfWeek(lastWeekDate, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(lastWeekDate, { weekStartsOn: 1 }));
        break;
      case 'thisMonth':
        setStartDate(startOfMonth(today));
        setEndDate(endOfMonth(today));
        break;
      case 'lastMonth':
        const lastMonthDate = subMonths(today, 1);
        setStartDate(startOfMonth(lastMonthDate));
        setEndDate(endOfMonth(lastMonthDate));
        break;
      case 'thisYear':
        setStartDate(startOfYear(today));
        setEndDate(endOfYear(today));
        break;
    }
  };

  const handleCustomDateChange = (type: 'start' | 'end', date: Date | undefined) => {
    setActivePreset('all'); // Reset preset when custom date is selected
    if (type === 'start') {
      setStartDate(date);
    } else {
      setEndDate(date);
    }
  };

  const filterTransactionsByDate = (txs: ExportTransaction[]): ExportTransaction[] => {
    if (!startDate && !endDate) return txs;

    return txs.filter(tx => {
      if (!tx.date) return false;
      
      const txDate = startOfDay(parseISO(tx.date));
      
      if (startDate && isBefore(txDate, startOfDay(startDate))) {
        return false;
      }
      
      if (endDate && isAfter(txDate, endOfDay(endDate))) {
        return false;
      }
      
      return true;
    });
  };

  const filteredTransactions = filterTransactionsByDate(transactions);

  const handleExportExcel = async () => {
    if (filteredTransactions.length === 0) {
      toast.error(t('Tidak ada data dalam rentang tanggal yang dipilih', 'No data in selected date range'));
      return;
    }

    setIsExporting(true);
    try {
      const dateRange = startDate || endDate 
        ? `-${startDate ? format(startDate, 'yyyyMMdd') : 'awal'}-${endDate ? format(endDate, 'yyyyMMdd') : 'akhir'}`
        : '';
      exportToExcel(filteredTransactions, `${filename}${dateRange}`, language);
      toast.success(t('File Excel berhasil diunduh', 'Excel file downloaded successfully'));
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('Gagal mengexport file', 'Failed to export file'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (filteredTransactions.length === 0) {
      toast.error(t('Tidak ada data dalam rentang tanggal yang dipilih', 'No data in selected date range'));
      return;
    }

    setIsExporting(true);
    try {
      const dateRangeTitle = startDate || endDate
        ? ` (${startDate ? format(startDate, 'dd/MM/yyyy') : '...'} - ${endDate ? format(endDate, 'dd/MM/yyyy') : '...'})`
        : '';
      const dateRange = startDate || endDate 
        ? `-${startDate ? format(startDate, 'yyyyMMdd') : 'awal'}-${endDate ? format(endDate, 'yyyyMMdd') : 'akhir'}`
        : '';
      exportToPDF(filteredTransactions, `${filename}${dateRange}`, language, `${title || t('Laporan Transaksi', 'Transaction Report')}${dateRangeTitle}`);
      toast.success(t('PDF siap untuk dicetak', 'PDF ready to print'));
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('Gagal mengexport PDF', 'Failed to export PDF'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearDates = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setActivePreset('all');
  };

  const getDateRangeText = () => {
    if (!startDate && !endDate) {
      return t('Semua tanggal', 'All dates');
    }
    if (startDate && endDate) {
      return `${format(startDate, 'dd MMM yyyy', { locale })} - ${format(endDate, 'dd MMM yyyy', { locale })}`;
    }
    if (startDate) {
      return `${t('Dari', 'From')} ${format(startDate, 'dd MMM yyyy', { locale })}`;
    }
    if (endDate) {
      return `${t('Sampai', 'Until')} ${format(endDate, 'dd MMM yyyy', { locale })}`;
    }
    return '';
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          disabled={disabled || transactions.length === 0}
        >
          <Download className="h-4 w-4" />
          {t('Export', 'Export')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Export Laporan', 'Export Report')}</DialogTitle>
          <DialogDescription>
            {t('Pilih rentang tanggal dan format export', 'Select date range and export format')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {t('Filter Cepat', 'Quick Filter')}
            </Label>
            <div className="flex flex-wrap gap-2">
              {quickPresets.map((preset) => (
                <Button
                  key={preset.key}
                  variant={activePreset === preset.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset(preset.key)}
                  className="text-xs"
                >
                  {language === 'id' ? preset.label.id : preset.label.en}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4" />
              {t('Rentang Tanggal Kustom', 'Custom Date Range')}
            </Label>
            <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t('Dari', 'From')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd/MM/yyyy') : t('Pilih tanggal', 'Pick date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => handleCustomDateChange('start', date)}
                    disabled={(date) => endDate ? isAfter(date, endDate) : false}
                    locale={locale}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t('Sampai', 'To')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd/MM/yyyy') : t('Pilih tanggal', 'Pick date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => handleCustomDateChange('end', date)}
                    disabled={(date) => startDate ? isBefore(date, startDate) : false}
                    locale={locale}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('Rentang Tanggal', 'Date Range')}:</span>
              <span className="font-medium">{getDateRangeText()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('Total Transaksi', 'Total Transactions')}:</span>
              <span className="font-medium">{filteredTransactions.length} {t('transaksi', 'transactions')}</span>
            </div>
            {(startDate || endDate) && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-2 text-xs"
                onClick={handleClearDates}
              >
                {t('Reset Filter Tanggal', 'Reset Date Filter')}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={isExporting || filteredTransactions.length === 0}
            className="w-full sm:w-auto gap-2"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-success" />
            )}
            {t('Export Excel', 'Export Excel')}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={isExporting || filteredTransactions.length === 0}
            className="w-full sm:w-auto gap-2"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 text-destructive" />
            )}
            {t('Export PDF', 'Export PDF')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
