import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loan, LoanInstallment } from '@/lib/types';
import { formatCurrency, formatShortDate } from '@/lib/mockData';
import { 
  CreditCard, 
  Wallet,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Target,
  Percent,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';

interface LoanDashboardProps {
  loans: Loan[];
  installments: LoanInstallment[];
}

export const LoanDashboard = ({ loans, installments }: LoanDashboardProps) => {
  const { t } = useThemeLanguage();
  
  // Get interest calculation method from cooperative settings
  // This reads from localStorage which is synced when admin saves settings
  const settings = getCooperativeSettings();
  const interestMethod = settings.interestCalculationMethod || 'flat';

  const activeLoans = loans.filter(l => l.status === 'active');
  const completedLoans = loans.filter(l => l.status === 'completed');

  // Calculate summary statistics
  const summary = useMemo(() => {
    const activeInstallments = installments.filter(i => 
      activeLoans.some(l => l.id === i.loanId)
    );

    // Total pokok pinjaman
    const totalLoanAmount = activeLoans.reduce((sum, l) => sum + l.principalAmount, 0);
    
    // Total yang harus dibayar (pokok + bunga + denda) dari semua angsuran
    const totalInstallmentAmount = activeInstallments.reduce(
      (sum, i) => sum + i.totalAmount + i.penaltyAmount, 0
    );
    
    // Total yang sudah dibayar dari semua installments (termasuk partial)
    const totalPaid = activeInstallments.reduce(
      (sum, i) => sum + i.paidAmount, 0
    );
    
    // Sisa yang harus dibayar
    const totalRemaining = totalInstallmentAmount - totalPaid;
    
    const paidInstallments = activeInstallments.filter(i => i.status === 'paid');
    const overdueInstallments = activeInstallments.filter(i => i.status === 'overdue');
    const partialInstallments = activeInstallments.filter(i => i.status === 'partial');
    const pendingInstallments = activeInstallments.filter(i => 
      i.status === 'pending' || i.status === 'partial' || i.status === 'unpaid'
    );
    
    const totalPenalty = activeInstallments.reduce((sum, i) => sum + i.penaltyAmount, 0);
    
    // Next due installment
    const nextDue = pendingInstallments
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

    // Progress berdasarkan total terbayar vs total yang harus dibayar
    const paymentProgress = totalInstallmentAmount > 0 
      ? (totalPaid / totalInstallmentAmount) * 100 
      : 0;

    return {
      totalLoanAmount,
      totalInstallmentAmount,
      totalRemaining,
      totalPaid,
      paymentProgress,
      paidCount: paidInstallments.length,
      partialCount: partialInstallments.length,
      overdueCount: overdueInstallments.length,
      pendingCount: pendingInstallments.length,
      totalPenalty,
      nextDue,
      totalInstallments: activeInstallments.length,
      completedLoansCount: completedLoans.length,
    };
  }, [activeLoans, completedLoans, installments]);

  if (activeLoans.length === 0 && completedLoans.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CreditCard className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-lg font-medium text-foreground">{t('Tidak Ada Data Pinjaman', 'No Loan Data')}</p>
          <p className="text-sm text-muted-foreground">{t('Anda belum memiliki pinjaman aktif', 'You have no active loans')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards - Compact 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/40 min-h-[72px] sm:min-h-[80px]">
          <CardContent className="p-3 h-full flex items-center">
            <div className="flex items-center gap-2 w-full">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{t('Total Pinjaman', 'Total Loan')}</p>
                <p className="text-sm font-bold truncate">{formatCurrency(summary.totalLoanAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 min-h-[72px] sm:min-h-[80px]">
          <CardContent className="p-3 h-full flex items-center">
            <div className="flex items-center gap-2 w-full">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 shrink-0">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{t('Sudah Dibayar', 'Paid')}</p>
                <p className="text-sm font-bold text-success truncate">{formatCurrency(summary.totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 min-h-[72px] sm:min-h-[80px]">
          <CardContent className="p-3 h-full flex items-center">
            <div className="flex items-center gap-2 w-full">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{t('Sisa Angsuran', 'Remaining')}</p>
                <p className="text-sm font-bold truncate">{formatCurrency(summary.totalRemaining)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("border-border/40 min-h-[72px] sm:min-h-[80px]", summary.totalPenalty > 0 && "border-destructive/40")}>
          <CardContent className="p-3 h-full flex items-center">
            <div className="flex items-center gap-2 w-full">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                summary.totalPenalty > 0 ? "bg-destructive/10" : "bg-success/10"
              )}>
                {summary.totalPenalty > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{t('Denda', 'Penalty')}</p>
                <p className={cn("text-sm font-bold truncate", summary.totalPenalty > 0 && "text-destructive")}>
                  {formatCurrency(summary.totalPenalty)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Card - Compact */}
      <Card className="border-border/40">
        <CardContent className="p-4 space-y-3">
          {/* Interest Method - Inline */}
          <div className="flex items-center gap-2 text-xs">
            <Percent className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">{t('Metode', 'Method')}:</span>
            <span className="font-medium text-primary">
              {interestMethod === 'effective' 
                ? t('Efektif', 'Effective')
                : t('Flat', 'Flat')
              }
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {summary.paidCount}/{summary.totalInstallments} {t('angsuran', 'installments')}
              </span>
              <span className="font-bold text-primary">
                {summary.paymentProgress.toFixed(0)}%
              </span>
            </div>
            <Progress value={summary.paymentProgress} className="h-2" />
          </div>
          
          {/* Next Due - Inline */}
          {summary.nextDue && (
            <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-md p-2">
              <CalendarClock className="h-3.5 w-3.5 text-warning" />
              <span className="text-muted-foreground">{t('Berikutnya', 'Next')}:</span>
              <span className="font-medium">{formatCurrency(summary.nextDue.totalAmount + summary.nextDue.penaltyAmount)}</span>
              <span className="text-muted-foreground">-</span>
              <span className="text-muted-foreground">{formatShortDate(summary.nextDue.dueDate)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Loans - Compact */}
      {completedLoans.length > 0 && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-success">{t('Pinjaman Selesai', 'Completed')}</span>
              <Badge variant="success" className="text-xs">{completedLoans.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {completedLoans.map(loan => (
                <div key={loan.id} className="bg-card rounded-md px-2 py-1 border text-xs">
                  <span className="font-medium">{formatCurrency(loan.principalAmount)}</span>
                  <span className="text-muted-foreground ml-1">({loan.tenor}bln)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
