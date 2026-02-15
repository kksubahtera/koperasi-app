import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { CheckCircle2, Clock, FileText } from 'lucide-react';
import { RefundConfirmationLetter } from '@/components/shared/RefundConfirmationLetter';
import { useUserSavings } from '@/hooks/useUserSavings';
import { useUserLoans } from '@/hooks/useUserLoans';

interface RefundNotificationProps {
  refundStatus: 'pending' | 'completed';
  refundDate?: string;
}

export const RefundNotification = ({ refundStatus, refundDate }: RefundNotificationProps) => {
  const { user } = useAuth();
  const { t } = useThemeLanguage();
  const [showLetter, setShowLetter] = useState(false);

  // Fetch real data from database
  const { savings } = useUserSavings();
  const { loans, installments } = useUserLoans();

  if (!user) return null;

  // Get active loan and calculate arrears
  const userLoan = loans.find(l => l.status === 'active');
  const userInstallments = userLoan 
    ? installments.filter(i => i.loanId === userLoan.id)
    : [];

  const overdueInstallments = userInstallments.filter(i => i.status === 'overdue');
  const totalPenalties = overdueInstallments.reduce((sum, i) => sum + (i.penaltyAmount || 0), 0);
  const remainingPrincipal = userLoan?.remainingPrincipal || 0;
  const totalArrears = remainingPrincipal + totalPenalties;

  const netAmount = savings.totalSimpanan - totalArrears;
  const hasShortfall = netAmount < 0;
  const refundAmount = hasShortfall ? 0 : netAmount;
  const shortfallAmount = hasShortfall ? Math.abs(netAmount) : 0;

  if (refundStatus === 'completed') {
    return (
      <>
        <Alert className={hasShortfall ? "border-warning/30 bg-warning/5" : "border-success/30 bg-success/5"}>
          <CheckCircle2 className={`h-4 w-4 ${hasShortfall ? 'text-warning' : 'text-success'}`} />
          <AlertTitle className={hasShortfall ? "text-warning" : "text-success"}>
            {hasShortfall 
              ? t('Proses Pengunduran Diri Selesai', 'Resignation Process Completed') 
              : t('Dana Telah Dikembalikan', 'Funds Have Been Returned')}
          </AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {hasShortfall ? (
                <p className="text-sm text-muted-foreground">
                  {t(
                    `Proses pengunduran diri Anda telah selesai. Anda telah melunasi kekurangan sebesar`,
                    `Your resignation process is complete. You have paid the shortfall of`
                  )}{' '}
                  <strong className="text-warning">{formatCurrency(shortfallAmount)}</strong>.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('Dana simpanan Anda sebesar', 'Your savings of')}{' '}
                  <strong className="text-success">{formatCurrency(refundAmount)}</strong>{' '}
                  {t('telah ditransfer ke rekening terdaftar pada', 'have been transferred to your registered account on')}{' '}
                  {refundDate ? formatDate(refundDate) : '-'}.
                </p>
              )}
              <div className="mt-3 rounded-lg bg-card/50 p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('Simpanan Pokok', 'Principal Savings')}</span>
                  <span className="text-foreground">{formatCurrency(savings.simpananPokok)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('Simpanan Wajib', 'Mandatory Savings')}</span>
                  <span className="text-foreground">{formatCurrency(savings.simpananWajib)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('Simpanan Sukarela', 'Voluntary Savings')}</span>
                  <span className="text-foreground">{formatCurrency(savings.simpananSukarela)}</span>
                </div>
                {totalArrears > 0 && (
                  <div className="flex justify-between text-xs border-t border-border pt-1.5 mt-1.5">
                    <span className="text-muted-foreground">{t('Total Tunggakan', 'Total Arrears')}</span>
                    <span className="text-destructive">- {formatCurrency(totalArrears)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium border-t border-border pt-1.5 mt-1.5">
                  <span className="text-foreground">
                    {hasShortfall 
                      ? t('Kekurangan Dibayar', 'Shortfall Paid') 
                      : t('Total Dikembalikan', 'Total Refunded')}
                  </span>
                  <span className={hasShortfall ? 'text-warning' : 'text-success'}>
                    {hasShortfall ? formatCurrency(shortfallAmount) : formatCurrency(refundAmount)}
                  </span>
                </div>
              </div>
              <Button 
                onClick={() => setShowLetter(true)}
                variant="outline"
                size="sm"
                className="w-full mt-3"
              >
                <FileText className="mr-2 h-4 w-4" />
                {t('Unduh Surat Konfirmasi', 'Download Confirmation Letter')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        <RefundConfirmationLetter
          open={showLetter}
          onClose={() => setShowLetter(false)}
          refund={{
            id: user.id,
            memberName: user.name,
            memberNumber: user.memberNumber,
            exitDate: user.exitDate || new Date().toISOString(),
            simpananPokok: savings.simpananPokok,
            simpananWajib: savings.simpananWajib,
            simpananSukarela: savings.simpananSukarela,
            totalSavings: savings.totalSimpanan,
            loanOutstanding: totalArrears,
            totalRefund: refundAmount,
            refundDate: refundDate || new Date().toISOString().split('T')[0],
          }}
        />
      </>
    );
  }

  return (
    <Alert className="border-warning/30 bg-warning/5">
      <Clock className="h-4 w-4 text-warning" />
      <AlertTitle className="text-warning">{t('Menunggu Pengembalian Dana', 'Awaiting Fund Refund')}</AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-2">
          <p className="text-sm text-muted-foreground">
            {t('Pengajuan pengunduran diri Anda telah disetujui.', 'Your resignation request has been approved.')}{' '}
            {hasShortfall 
              ? t('Silakan lunasi kekurangan untuk menyelesaikan proses.', 'Please pay the shortfall to complete the process.')
              : t('Dana simpanan sedang dalam proses pengembalian ke rekening terdaftar.', 'Your savings are being processed for transfer to your registered account.')}
          </p>
          <div className="mt-3 rounded-lg bg-card/50 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {hasShortfall 
                  ? t('Kekurangan yang Harus Dibayar', 'Shortfall to Pay') 
                  : t('Estimasi Dana Kembali', 'Estimated Refund')}
              </span>
              <span className={`font-bold ${hasShortfall ? 'text-destructive' : 'text-foreground'}`}>
                {hasShortfall ? formatCurrency(shortfallAmount) : formatCurrency(refundAmount)}
              </span>
            </div>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
