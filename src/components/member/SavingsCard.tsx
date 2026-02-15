import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/mockData';
import { SavingsSummary } from '@/lib/types';
import { Wallet, Coins, Banknote, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';

interface SavingsCardProps {
  savings: SavingsSummary;
  isInactive?: boolean;
  exitDate?: string;
  showTotal?: boolean;
}

export const SavingsCard = ({ savings, isInactive = false, exitDate, showTotal = false }: SavingsCardProps) => {
  const { t } = useThemeLanguage();
  const settings = getCooperativeSettings();

  const savingsBreakdown = [
    {
      label: t('Simpanan Pokok', 'Principal Savings'),
      amount: savings.simpananPokok,
      icon: Coins,
      description: t('Satu kali saat bergabung', 'One-time upon joining'),
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      label: t('Simpanan Wajib', 'Mandatory Savings'),
      amount: savings.simpananWajib,
      icon: Wallet,
      description: `${formatCurrency(settings.simpananWajib)}/${t('bulan', 'month')}`,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: t('Simpanan Sukarela', 'Voluntary Savings'),
      amount: savings.simpananSukarela,
      icon: Banknote,
      description: `Min. ${formatCurrency(settings.simpananSukarelaMin)}`,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Inactive Notice */}
      {isInactive && (
        <div className="flex items-start gap-3 rounded-lg border border-muted-foreground/30 bg-muted/50 p-4">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium text-muted-foreground">{t('Status Keanggotaan: Tidak Aktif', 'Membership Status: Inactive')}</p>
            <p className="text-sm text-muted-foreground/80">
              {t('Data simpanan akhir saat keluar dari koperasi', 'Final savings data upon leaving the cooperative')}
              {exitDate && ` (${exitDate})`}
            </p>
          </div>
        </div>
      )}

      {/* Total Card - Only show if showTotal is true (for homepage) */}
      {showTotal && (
        <Card 
          variant={isInactive ? 'default' : 'primary'} 
          className={cn(
            "overflow-hidden",
            isInactive && "bg-muted/50 border-muted-foreground/20"
          )}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn(
                  "text-sm",
                  isInactive ? "text-muted-foreground" : "opacity-90"
                )}>
                  {t('Total Simpanan', 'Total Savings')} {isInactive && t('(Akhir)', '(Final)')}
                </p>
                <p className={cn(
                  "mt-1 text-3xl font-bold",
                  isInactive && "text-muted-foreground"
                )}>
                  {formatCurrency(savings.totalSimpanan)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakdown Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {savingsBreakdown.map((item) => {
          const Icon = item.icon;
          return (
            <Card 
              key={item.label} 
              className={cn(
                "group",
                isInactive 
                  ? "bg-muted/30 border-muted-foreground/20" 
                  : "hover:border-primary/30"
              )}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    isInactive ? "bg-muted" : item.bgColor
                  )}>
                    <Icon className={cn(
                      "h-5 w-5",
                      isInactive ? "text-muted-foreground" : item.color
                    )} />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className={cn(
                    "mt-1 text-xl font-bold",
                    isInactive ? "text-muted-foreground" : "text-foreground"
                  )}>
                    {formatCurrency(item.amount)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};