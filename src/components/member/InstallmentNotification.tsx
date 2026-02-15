import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoanInstallment } from '@/lib/types';
import { formatCurrency, formatShortDate } from '@/lib/mockData';
import { AlertTriangle, Bell, Calendar, X } from 'lucide-react';
import { useState } from 'react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';

interface InstallmentNotificationProps {
  installments: LoanInstallment[];
  onDismiss?: () => void;
}

export const InstallmentNotification = ({ installments, onDismiss }: InstallmentNotificationProps) => {
  const { t } = useThemeLanguage();
  const [dismissed, setDismissed] = useState(false);

  const overdueInstallments = installments.filter(i => i.status === 'overdue');
  const unpaidInstallments = installments.filter(i => i.status === 'unpaid');
  const pendingInstallments = installments.filter(i => i.status === 'pending');
  
  // Get upcoming installment (next pending within 7 days)
  const upcomingInstallment = pendingInstallments.find(i => {
    const dueDate = new Date(i.dueDate);
    const today = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  if (dismissed || (overdueInstallments.length === 0 && unpaidInstallments.length === 0 && !upcomingInstallment)) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="space-y-3">
      {/* Overdue Notifications (with penalty) */}
      {overdueInstallments.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-destructive">{t('Angsuran Menunggak!', 'Overdue Installments!')}</p>
                    <Badge variant="destructive">{overdueInstallments.length} {t('angsuran', 'installments')}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('Total tunggakan + denda', 'Total arrears + penalty')}: {formatCurrency(
                      overdueInstallments.reduce((sum, i) => sum + i.totalAmount - i.paidAmount + i.penaltyAmount, 0)
                    )}
                  </p>
                  <div className="mt-2 space-y-1">
                    {overdueInstallments.slice(0, 3).map((installment) => (
                      <p key={installment.id} className="text-xs text-muted-foreground">
                        • {t(`Angsuran ke-${installment.installmentNumber}`, `Installment #${installment.installmentNumber}`)} - {t('Jatuh tempo', 'Due')} {formatShortDate(installment.dueDate)}
                        {installment.penaltyAmount > 0 && (
                          <span className="text-destructive"> (+{formatCurrency(installment.penaltyAmount)} {t('denda', 'penalty')})</span>
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unpaid Notifications (past due but no penalty yet - within grace period) */}
      {unpaidInstallments.length > 0 && overdueInstallments.length === 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-warning">{t('Angsuran Belum Dibayar', 'Unpaid Installments')}</p>
                    <Badge variant="warning">{unpaidInstallments.length} {t('angsuran', 'installments')}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('Sudah jatuh tempo, segera bayar sebelum dikenakan denda', 'Past due, pay before penalty applies')}
                  </p>
                  <div className="mt-2 space-y-1">
                    {unpaidInstallments.slice(0, 3).map((installment) => (
                      <p key={installment.id} className="text-xs text-muted-foreground">
                        • {t(`Angsuran ke-${installment.installmentNumber}`, `Installment #${installment.installmentNumber}`)} - {t('Jatuh tempo', 'Due')} {formatShortDate(installment.dueDate)}
                        {' - '}{formatCurrency(installment.totalAmount - installment.paidAmount)}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Installment Reminder */}
      {upcomingInstallment && overdueInstallments.length === 0 && unpaidInstallments.length === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{t('Pengingat Angsuran', 'Installment Reminder')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`Angsuran ke-${upcomingInstallment.installmentNumber} akan jatuh tempo`, `Installment #${upcomingInstallment.installmentNumber} is due soon`)}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-primary">
                      <Calendar className="h-4 w-4" />
                      {formatShortDate(upcomingInstallment.dueDate)}
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(upcomingInstallment.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};