import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Download, FileSpreadsheet, FileText, Loader2, Users, Receipt, Database } from 'lucide-react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { 
  fetchAllTransactionsForExport, 
  fetchAllMembersForExport,
  exportToExcel,
  exportToPDF,
  exportMembersToExcel,
  exportMembersToPDF,
  ExportTransaction,
  ExportMember
} from '@/lib/exportUtils';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type ExportType = 'transactions' | 'members';
type ExportFormat = 'excel' | 'pdf';

interface ExportAllDataButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const ExportAllDataButton = ({ 
  variant = 'outline',
  size = 'sm',
  className
}: ExportAllDataButtonProps) => {
  const { t, language } = useThemeLanguage();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<ExportType>('transactions');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setLoadedCount(0);
    setTotalCount(0);
    setProgressText(t('Mengambil data...', 'Fetching data...'));

    try {
      if (exportType === 'transactions') {
        setProgressText(t('Mengambil data transaksi...', 'Fetching transaction data...'));
        
        const transactions = await fetchAllTransactionsForExport((loaded, total) => {
          setLoadedCount(loaded);
          setTotalCount(total);
          setProgress(total > 0 ? (loaded / total) * 100 : 0);
          setProgressText(t(`Mengambil ${loaded} dari ${total} transaksi...`, `Fetching ${loaded} of ${total} transactions...`));
        });

        if (transactions.length === 0) {
          toast.error(t('Tidak ada data transaksi untuk diexport', 'No transaction data to export'));
          return;
        }

        setProgressText(t('Membuat file...', 'Creating file...'));
        setProgress(100);

        if (exportFormat === 'excel') {
          exportToExcel(transactions, 'semua-transaksi', language);
          toast.success(t(`${transactions.length} transaksi berhasil diexport ke Excel`, `${transactions.length} transactions exported to Excel`));
        } else {
          exportToPDF(transactions, 'semua-transaksi', language, t('Laporan Semua Transaksi', 'All Transactions Report'));
          toast.success(t('PDF siap untuk dicetak', 'PDF ready to print'));
        }
      } else {
        setProgressText(t('Mengambil data anggota...', 'Fetching member data...'));
        
        const members = await fetchAllMembersForExport(
          { isActive: true, approvalStatus: 'approved' },
          (loaded, total) => {
            setLoadedCount(loaded);
            setTotalCount(total);
            setProgress(total > 0 ? (loaded / total) * 100 : 0);
            setProgressText(t(`Mengambil ${loaded} dari ${total} anggota...`, `Fetching ${loaded} of ${total} members...`));
          }
        );

        if (members.length === 0) {
          toast.error(t('Tidak ada data anggota untuk diexport', 'No member data to export'));
          return;
        }

        setProgressText(t('Membuat file...', 'Creating file...'));
        setProgress(100);

        if (exportFormat === 'excel') {
          exportMembersToExcel(members, 'data-anggota', language);
          toast.success(t(`${members.length} anggota berhasil diexport ke Excel`, `${members.length} members exported to Excel`));
        } else {
          exportMembersToPDF(members, 'data-anggota', language, t('Data Anggota Koperasi', 'Cooperative Member Data'));
          toast.success(t('PDF siap untuk dicetak', 'PDF ready to print'));
        }
      }

      setIsDialogOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('Gagal mengexport data', 'Failed to export data'));
    } finally {
      setIsExporting(false);
      setProgress(0);
      setProgressText('');
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Database className="mr-2 h-4 w-4" />
          {t('Export Semua Data', 'Export All Data')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('Export Semua Data', 'Export All Data')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Export seluruh data transaksi atau anggota dari database dengan pagination otomatis',
              'Export all transaction or member data from database with automatic pagination'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Data Type Selection */}
          <Tabs value={exportType} onValueChange={(v) => setExportType(v as ExportType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transactions" className="gap-2">
                <Receipt className="h-4 w-4" />
                {t('Transaksi', 'Transactions')}
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-2">
                <Users className="h-4 w-4" />
                {t('Anggota', 'Members')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="transactions" className="mt-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Export semua riwayat transaksi termasuk transaksi pending, disetujui, dan ditolak.',
                    'Export all transaction history including pending, approved, and rejected transactions.'
                  )}
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="members" className="mt-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Export data semua anggota aktif yang sudah disetujui termasuk informasi kontak dan rekening bank.',
                    'Export all active approved members data including contact info and bank account details.'
                  )}
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Format Selection */}
          <div className="space-y-3">
            <Label>{t('Format Export', 'Export Format')}</Label>
            <RadioGroup 
              value={exportFormat} 
              onValueChange={(v) => setExportFormat(v as ExportFormat)}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="flex items-center gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-success" />
                  Excel (.xlsx)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-destructive" />
                  PDF
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Progress */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{progressText}</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {totalCount > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {loadedCount} / {totalCount} {exportType === 'transactions' ? t('transaksi', 'transactions') : t('anggota', 'members')}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsDialogOpen(false)}
            disabled={isExporting}
          >
            {t('Batal', 'Cancel')}
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('Mengexport...', 'Exporting...')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {t('Export', 'Export')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
