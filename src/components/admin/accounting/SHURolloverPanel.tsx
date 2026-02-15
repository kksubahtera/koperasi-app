import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ArrowRight, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  FileText, 
  History, 
  RefreshCw,
  AlertTriangle,
  Info,
  Loader2,
  HelpCircle
} from 'lucide-react';
import { useSHURollover, RolloverData, RolloverHistory } from '@/hooks/useSHURollover';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface SHURolloverPanelProps {
  selectedYear: number;
  onRolloverComplete?: () => void;
}

export const SHURolloverPanel: React.FC<SHURolloverPanelProps> = ({
  selectedYear,
  onRolloverComplete
}) => {
  const { user } = useAuth();
  const { t } = useThemeLanguage();
  const { 
    loading, 
    getRolloverData, 
    getRolloverHistory, 
    executeRollover,
    checkRolloverExists 
  } = useSHURollover();

  const [rolloverData, setRolloverData] = useState<RolloverData | null>(null);
  const [rolloverHistory, setRolloverHistory] = useState<RolloverHistory[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [alreadyRolledOver, setAlreadyRolledOver] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  const loadData = async () => {
    const [data, history, exists] = await Promise.all([
      getRolloverData(selectedYear),
      getRolloverHistory(),
      checkRolloverExists(selectedYear, selectedYear + 1)
    ]);
    
    setRolloverData(data);
    setRolloverHistory(history);
    setAlreadyRolledOver(exists);
  };

  const handleExecuteRollover = async () => {
    if (!user?.id) return;
    
    setIsExecuting(true);
    const success = await executeRollover(selectedYear, user.id, notes);
    setIsExecuting(false);
    
    if (success) {
      setShowConfirmDialog(false);
      setNotes('');
      loadData();
      onRolloverComplete?.();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  {t('Rollover SHU', 'SHU Rollover')}
                </CardTitle>
                <CardDescription>
                  {t('Pindahkan saldo dana dan SHU ditahan ke tahun berikutnya', 'Transfer fund balances and withheld SHU to the next year')}
                </CardDescription>
              </div>
              {alreadyRolledOver && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('Sudah Di-rollover', 'Already Rolled Over')}
                </Badge>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Preview Card */}
        {rolloverData && !alreadyRolledOver && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t('Preview Rollover', 'Rollover Preview')}: {selectedYear} → {selectedYear + 1}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-muted/50 rounded-lg cursor-help">
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-muted-foreground">{t('Dana Cadangan', 'Reserve Fund')}</p>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="font-semibold">{formatCurrency(rolloverData.danaCadangan)}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{t('Cadangan dari alokasi SHU tahunan untuk pengembangan usaha koperasi', 'Reserve from annual SHU allocation for cooperative business development')}</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-muted/50 rounded-lg cursor-help">
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-muted-foreground">{t('Dana Pendidikan', 'Education Fund')}</p>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="font-semibold">{formatCurrency(rolloverData.danaPendidikan)}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{t('Dana untuk pelatihan dan pendidikan anggota koperasi', 'Fund for training and education of cooperative members')}</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-muted/50 rounded-lg cursor-help">
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-muted-foreground">{t('Dana Sosial', 'Social Fund')}</p>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="font-semibold">{formatCurrency(rolloverData.danaSosial)}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{t('Dana untuk program sosial dan bantuan anggota', 'Fund for social programs and member assistance')}</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-muted/50 rounded-lg cursor-help">
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-muted-foreground">{t('Dana Pembangunan', 'Development Fund')}</p>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="font-semibold">{formatCurrency(rolloverData.danaPembangunan)}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{t('Dana untuk pengembangan fasilitas dan infrastruktur koperasi', 'Fund for cooperative facility and infrastructure development')}</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 cursor-help">
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-muted-foreground">{t('SHU Ditahan', 'Withheld SHU')}</p>
                        <HelpCircle className="h-3 w-3 text-amber-500" />
                      </div>
                      <p className="font-semibold text-amber-700 dark:text-amber-400">
                        {formatCurrency(rolloverData.shuWithheld)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ({rolloverData.withheldMembersCount} {t('anggota', 'members')})
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{t('SHU anggota yang ditahan karena memiliki tunggakan pinjaman. Dapat digunakan untuk membayar tunggakan atau dikembalikan saat lunas.', 'Member SHU withheld due to loan arrears. Can be used to pay off arrears or returned when settled.')}</p>
                  </TooltipContent>
                </Tooltip>
                
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-xs text-muted-foreground">{t('Total Rollover', 'Total Rollover')}</p>
                  <p className="font-bold text-primary">{formatCurrency(rolloverData.totalAmount)}</p>
                </div>
              </div>

              <Separator />

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {t(
                    `Rollover akan membuat jurnal pembukaan otomatis untuk tahun ${selectedYear + 1} dan memindahkan semua saldo dana ke tahun berikutnya.`,
                    `Rollover will create an automatic opening journal for year ${selectedYear + 1} and transfer all fund balances to the next year.`
                  )}
                </AlertDescription>
              </Alert>

              <Button 
                onClick={() => setShowConfirmDialog(true)}
                disabled={loading || rolloverData.totalAmount === 0}
                className="w-full"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                {t(`Lakukan Rollover ke Tahun ${selectedYear + 1}`, `Perform Rollover to Year ${selectedYear + 1}`)}
              </Button>
            </CardContent>
          </Card>
        )}

      {/* Already Rolled Over Message */}
      {alreadyRolledOver && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-400">
            Rollover dari tahun {selectedYear} ke {selectedYear + 1} sudah dilakukan. 
            Lihat riwayat rollover di bawah untuk detail.
          </AlertDescription>
        </Alert>
      )}

      {/* Rollover History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Riwayat Rollover
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rolloverHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Belum ada riwayat rollover</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rolloverHistory.map((history) => (
                <div 
                  key={history.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {history.from_year} → {history.to_year}
                      </Badge>
                      <Badge 
                        variant={history.status === 'completed' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {history.status === 'completed' ? 'Selesai' : history.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(history.created_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Dana Cadangan</p>
                      <p>{formatCurrency(history.dana_cadangan_rollover)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Dana Pendidikan</p>
                      <p>{formatCurrency(history.dana_pendidikan_rollover)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Dana Sosial</p>
                      <p>{formatCurrency(history.dana_sosial_rollover)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Dana Pembangunan</p>
                      <p>{formatCurrency(history.dana_pembangunan_rollover)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">SHU Ditahan</p>
                      <p className="text-amber-600">{formatCurrency(history.shu_withheld_rollover)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-semibold text-primary">{formatCurrency(history.total_rollover_amount)}</p>
                    </div>
                  </div>

                  {history.journal_entry_id && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span>Jurnal pembukaan tersedia</span>
                    </div>
                  )}

                  {history.notes && (
                    <p className="mt-2 text-sm text-muted-foreground italic">
                      "{history.notes}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Konfirmasi Rollover SHU
            </DialogTitle>
            <DialogDescription>
              Anda akan memindahkan saldo dana dan SHU ditahan dari tahun {selectedYear} ke tahun {selectedYear + 1}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {rolloverData && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Detail Rollover:</p>
                <ul className="text-sm space-y-1">
                  <li>• Dana Cadangan: {formatCurrency(rolloverData.danaCadangan)}</li>
                  <li>• Dana Pendidikan: {formatCurrency(rolloverData.danaPendidikan)}</li>
                  <li>• Dana Sosial: {formatCurrency(rolloverData.danaSosial)}</li>
                  <li>• Dana Pembangunan: {formatCurrency(rolloverData.danaPembangunan)}</li>
                  <li>• SHU Ditahan: {formatCurrency(rolloverData.shuWithheld)} ({rolloverData.withheldMembersCount} anggota)</li>
                  <li className="font-semibold pt-2 border-t mt-2">
                    Total: {formatCurrency(rolloverData.totalAmount)}
                  </li>
                </ul>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Catatan (opsional)</label>
              <Textarea
                placeholder="Tambahkan catatan untuk rollover ini..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Proses ini tidak dapat dibatalkan. Pastikan data sudah benar sebelum melanjutkan.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={isExecuting}
            >
              Batal
            </Button>
            <Button 
              onClick={handleExecuteRollover}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Konfirmasi Rollover
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};
