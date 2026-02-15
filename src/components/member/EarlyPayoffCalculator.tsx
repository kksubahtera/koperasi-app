import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Banknote,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  FileCheck,
  Loader2,
  Info,
} from 'lucide-react';
import { Loan, LoanInstallment } from '@/lib/types';
import { formatCurrency, formatShortDate } from '@/lib/mockData';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useEarlyPayoff } from '@/hooks/useEarlyPayoff';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';

interface EarlyPayoffCalculatorProps {
  loan: Loan;
  installments: LoanInstallment[];
  onSuccess?: () => void;
}

export const EarlyPayoffCalculator = ({ loan, installments, onSuccess }: EarlyPayoffCalculatorProps) => {
  const { t } = useThemeLanguage();
  const settings = getCooperativeSettings();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  
  const {
    calculateEarlyPayoff,
    submitEarlyPayoffRequest,
    canRequestEarlyPayoff,
    requiresApproval,
    isSubmitting,
  } = useEarlyPayoff();

  // Only calculate if loan is active
  const calculation = useMemo(() => {
    if (loan.status !== 'active') return null;
    return calculateEarlyPayoff(loan, installments);
  }, [loan, installments, calculateEarlyPayoff]);

  if (!canRequestEarlyPayoff || loan.status !== 'active' || !calculation) {
    return null;
  }

  const handleSubmit = async () => {
    const success = await submitEarlyPayoffRequest(
      loan.id,
      calculation.totalPayoffAmount,
      calculation,
      loan,
      notes || undefined
    );
    
    if (success) {
      setIsDialogOpen(false);
      setNotes('');
      onSuccess?.();
    }
  };

  const earlyPayoffFeeLabel = useMemo(() => {
    if (settings.earlyPayoffFeeType === 'none') return null;
    if (settings.earlyPayoffFeeType === 'fixed') {
      return `Biaya Pelunasan Dini (Tetap)`;
    }
    return `Biaya Pelunasan Dini (${settings.earlyPayoffFeeAmount}% dari sisa pokok)`;
  }, [settings.earlyPayoffFeeType, settings.earlyPayoffFeeAmount]);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote className="h-5 w-5 text-primary" />
          {t('Pelunasan Dini', 'Early Payoff')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Alert */}
        <Alert className="bg-info/10 border-info/30">
          <Info className="h-4 w-4 text-info" />
          <AlertDescription className="text-xs">
            {t(
              'Dengan pelunasan dini, Anda membayar sisa pokok + bunga periode berjalan + bunga/denda periode sebelumnya yang belum dibayar. Bunga periode mendatang ditiadakan.',
              'With early payoff, you pay remaining principal + current period interest + unpaid previous interest/penalties. Future interest is waived.'
            )}
          </AlertDescription>
        </Alert>

        {/* Calculation Summary */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('Sisa Pokok Pinjaman', 'Remaining Principal')}</span>
            <span className="font-medium">{formatCurrency(calculation.remainingPrincipal)}</span>
          </div>
          
          {/* Overdue Interest from previous periods */}
          {calculation.overdueInterest > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>{t('Bunga Periode Sebelumnya', 'Previous Period Interest')}</span>
              <span className="font-medium">{formatCurrency(calculation.overdueInterest)}</span>
            </div>
          )}
          
          {/* Overdue Penalty from previous periods */}
          {calculation.overduePenalty > 0 && (
            <div className="flex justify-between text-destructive">
              <span>{t('Denda Periode Sebelumnya', 'Previous Period Penalty')}</span>
              <span className="font-medium">{formatCurrency(calculation.overduePenalty)}</span>
            </div>
          )}

          {/* Already paid for overdue installments */}
          {calculation.overdueAlreadyPaid > 0 && (
            <div className="flex justify-between text-success">
              <span>{t('Sudah Dibayar (Tertunggak)', 'Already Paid (Overdue)')}</span>
              <span className="font-medium">-{formatCurrency(calculation.overdueAlreadyPaid)}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('Bunga Periode Berjalan', 'Current Period Interest')}</span>
            <span className="font-medium">{formatCurrency(calculation.currentPeriodInterest)}</span>
          </div>
          
          {calculation.currentPeriodPenalty > 0 && (
            <div className="flex justify-between text-destructive">
              <span>{t('Denda Periode Berjalan', 'Current Period Penalty')}</span>
              <span className="font-medium">{formatCurrency(calculation.currentPeriodPenalty)}</span>
            </div>
          )}

          {/* Already paid for current installment */}
          {calculation.currentAlreadyPaid > 0 && (
            <div className="flex justify-between text-success">
              <span>{t('Sudah Dibayar (Berjalan)', 'Already Paid (Current)')}</span>
              <span className="font-medium">-{formatCurrency(calculation.currentAlreadyPaid)}</span>
            </div>
          )}
          
          {calculation.earlyPayoffFee > 0 && earlyPayoffFeeLabel && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{earlyPayoffFeeLabel}</span>
              <span className="font-medium">{formatCurrency(calculation.earlyPayoffFee)}</span>
            </div>
          )}
          
          {/* Show overdue installments count if any */}
          {calculation.overdueInstallments && calculation.overdueInstallments.length > 0 && (
            <div className="text-xs text-amber-600 bg-amber-500/10 p-2 rounded">
              {t(
                `${calculation.overdueInstallments.length} angsuran tertunggak yang harus dibayar`,
                `${calculation.overdueInstallments.length} overdue installment(s) must be paid`
              )}
            </div>
          )}

          {/* Payment info badge */}
          {(calculation.overdueAlreadyPaid > 0 || calculation.currentAlreadyPaid > 0) && (
            <div className="text-xs p-2 rounded bg-info/10 border border-info/30 space-y-1">
              <div className="flex items-center gap-1 text-info font-medium">
                <Info className="h-3 w-3" />
                {t('Keterangan Pembayaran', 'Payment Details')}
              </div>
              <p className="text-muted-foreground">
                {t(
                  `Total sudah dibayar: ${formatCurrency(calculation.overdueAlreadyPaid + calculation.currentAlreadyPaid)}. Sisa tagihan sudah diperhitungkan dalam total pelunasan.`,
                  `Total already paid: ${formatCurrency(calculation.overdueAlreadyPaid + calculation.currentAlreadyPaid)}. Remaining balance is included in total.`
                )}
              </p>
            </div>
          )}
          
          <Separator className="my-2" />
          
          <div className="flex justify-between text-base font-semibold">
            <span>{t('Total Pelunasan', 'Total Payoff')}</span>
            <span className="text-primary">{formatCurrency(calculation.totalPayoffAmount)}</span>
          </div>
        </div>

        {/* Waived Interest Info */}
        {calculation.waivedInterest > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10 border border-success/20">
            <TrendingDown className="h-4 w-4 text-success shrink-0" />
            <div className="text-xs">
              <span className="text-success font-medium">
                {t('Penghematan Bunga: ', 'Interest Savings: ')}
                {formatCurrency(calculation.waivedInterest)}
              </span>
              <p className="text-muted-foreground">
                {t('Bunga yang tidak perlu dibayar karena pelunasan dini', 'Interest waived due to early payoff')}
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2">
              <Calculator className="h-4 w-4" />
              {t('Ajukan Pelunasan Dini', 'Request Early Payoff')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                {t('Konfirmasi Pelunasan Dini', 'Confirm Early Payoff')}
              </DialogTitle>
              <DialogDescription>
                {requiresApproval 
                  ? t('Pengajuan akan dikirim ke pengurus koperasi untuk persetujuan.', 'Request will be sent to cooperative management for approval.')
                  : t('Pelunasan akan langsung diproses.', 'Payoff will be processed immediately.')
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Detail Summary */}
              <div className="p-3 rounded-lg bg-muted/50 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('Sisa Pokok', 'Principal')}</span>
                  <span>{formatCurrency(calculation.remainingPrincipal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('Bunga Berjalan', 'Current Interest')}</span>
                  <span>{formatCurrency(calculation.currentPeriodInterest)}</span>
                </div>
                {calculation.currentPeriodPenalty > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>{t('Denda', 'Penalty')}</span>
                    <span>{formatCurrency(calculation.currentPeriodPenalty)}</span>
                  </div>
                )}
                {calculation.earlyPayoffFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('Biaya Pelunasan', 'Payoff Fee')}</span>
                    <span>{formatCurrency(calculation.earlyPayoffFee)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-primary">
                  <span>{t('Total Bayar', 'Total')}</span>
                  <span>{formatCurrency(calculation.totalPayoffAmount)}</span>
                </div>
              </div>

              {/* Savings Highlight */}
              {calculation.waivedInterest > 0 && (
                <Alert className="bg-success/10 border-success/30">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertTitle className="text-success">
                    {t('Penghematan', 'Savings')}
                  </AlertTitle>
                  <AlertDescription className="text-sm">
                    {t(
                      `Anda menghemat ${formatCurrency(calculation.waivedInterest)} bunga yang tidak perlu dibayar.`,
                      `You save ${formatCurrency(calculation.waivedInterest)} in interest.`
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">{t('Catatan (opsional)', 'Notes (optional)')}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('Tambahkan catatan jika diperlukan...', 'Add notes if needed...')}
                  rows={2}
                />
              </div>

              {requiresApproval && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {t(
                      'Pengajuan akan diverifikasi oleh pengurus koperasi. Anda akan menerima notifikasi setelah disetujui.',
                      'Request will be verified by cooperative management. You will receive notification after approval.'
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('Batal', 'Cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('Memproses...', 'Processing...')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t('Ajukan Pelunasan', 'Submit Request')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approval Badge */}
        {requiresApproval && (
          <div className="flex justify-center">
            <Badge variant="outline" className="text-xs">
              {t('Memerlukan persetujuan pengurus koperasi', 'Requires cooperative management approval')}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
