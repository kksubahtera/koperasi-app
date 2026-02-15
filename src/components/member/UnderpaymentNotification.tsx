import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoanInstallment, SavingsSummary } from '@/lib/types';
import { formatCurrency } from '@/lib/mockData';
import { Wallet, CreditCard, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';

interface UnderpaymentNotificationProps {
  installments: LoanInstallment[];
  savings: SavingsSummary;
  expectedMonthlySaving: number; // Expected simpanan wajib per month (e.g., 50000)
  monthsJoined: number; // Number of months since joining
  onDismiss?: () => void;
}

export const UnderpaymentNotification = ({ 
  installments, 
  savings, 
  expectedMonthlySaving,
  monthsJoined,
  onDismiss 
}: UnderpaymentNotificationProps) => {
  const { t } = useThemeLanguage();
  const [dismissed, setDismissed] = useState<{ savings: boolean; installment: boolean }>({
    savings: false,
    installment: false,
  });

  // Check for underpaid mandatory savings (simpanan wajib)
  const expectedSimpananWajib = expectedMonthlySaving * monthsJoined;
  const actualSimpananWajib = savings.simpananWajib;
  const savingsShortfall = expectedSimpananWajib - actualSimpananWajib;
  const hasSavingsUnderpayment = savingsShortfall > 0;

  // Check for partial payment installments
  const partialInstallments = installments.filter(i => i.status === 'partial');
  const totalInstallmentShortfall = partialInstallments.reduce(
    (sum, i) => sum + (i.totalAmount - i.paidAmount), 0
  );
  const hasInstallmentUnderpayment = partialInstallments.length > 0;

  const handleDismissSavings = () => {
    setDismissed(prev => ({ ...prev, savings: true }));
  };

  const handleDismissInstallment = () => {
    setDismissed(prev => ({ ...prev, installment: true }));
  };

  if ((!hasSavingsUnderpayment || dismissed.savings) && 
      (!hasInstallmentUnderpayment || dismissed.installment)) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Underpaid Mandatory Savings */}
      {hasSavingsUnderpayment && !dismissed.savings && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="py-4 px-4 sm:py-5 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10 shrink-0">
                  <Wallet className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-warning">{t('Simpanan Wajib Kurang!', 'Mandatory Savings Underpaid!')}</p>
                    <Badge variant="outline" className="border-warning text-warning">
                      {Math.ceil(savingsShortfall / expectedMonthlySaving)} {t('bulan', 'months')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(
                      `Simpanan wajib Anda kurang ${formatCurrency(savingsShortfall)} dari yang seharusnya.`,
                      `Your mandatory savings is ${formatCurrency(savingsShortfall)} short of the expected amount.`
                    )}
                  </p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p>• {t('Seharusnya', 'Expected')}: {formatCurrency(expectedSimpananWajib)} ({monthsJoined} {t('bulan', 'months')} × {formatCurrency(expectedMonthlySaving)})</p>
                    <p>• {t('Tercatat', 'Recorded')}: {formatCurrency(actualSimpananWajib)}</p>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleDismissSavings}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Underpaid Installments */}
      {hasInstallmentUnderpayment && !dismissed.installment && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardContent className="py-4 px-4 sm:py-5 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 shrink-0">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-orange-600">{t('Angsuran Kurang Bayar!', 'Installment Underpaid!')}</p>
                    <Badge variant="outline" className="border-orange-500 text-orange-600">
                      {partialInstallments.length} {t('angsuran', 'installments')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('Total kekurangan pembayaran angsuran', 'Total installment underpayment')}: {formatCurrency(totalInstallmentShortfall)}
                  </p>
                  <div className="mt-2 space-y-1">
                    {partialInstallments.slice(0, 3).map((installment) => (
                      <p key={installment.id} className="text-xs text-muted-foreground">
                        • {t(`Angsuran ke-${installment.installmentNumber}`, `Installment #${installment.installmentNumber}`)}: {t('dibayar', 'paid')} {formatCurrency(installment.paidAmount)} {t('dari', 'of')} {formatCurrency(installment.totalAmount)}
                        <span className="text-orange-600 font-medium"> ({t('kurang', 'short')} {formatCurrency(installment.totalAmount - installment.paidAmount)})</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleDismissInstallment}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};