import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Landmark, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  Gift,
  Lightbulb,
  Target,
  Calendar,
  History,
  Store
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { formatCurrency } from '@/lib/mockData';
import { getCooperativeSettings, getSHUDistributions } from '@/lib/cooperativeSettings';
import { useUserSHUEstimate } from '@/hooks/useUserSHUEstimate';
import { useUserSavings } from '@/hooks/useUserSavings';
import { useUserLoans } from '@/hooks/useUserLoans';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useState } from 'react';


interface ProfileDashboardProps {
  onNavigate?: (view: string) => void;
  interestHistoryComponent?: React.ReactNode;
}

export const ProfileDashboard = ({ onNavigate, interestHistoryComponent }: ProfileDashboardProps) => {
  const { user } = useAuth();
  const { t } = useThemeLanguage();
  const settings = getCooperativeSettings();
  const { estimate: shuEstimate, loading: shuLoading } = useUserSHUEstimate();
  const { savings, isLoading: savingsLoading } = useUserSavings();
  const { loans, installments, isLoading: loansLoading } = useUserLoans();

  if (!user) return null;

  // Use real data from hooks
  const userSavings = savings;
  const userLoan = loans.find(l => l.status === 'active');
  const userInstallments = userLoan ? installments.filter(i => i.loanId === userLoan.id) : [];

  // Generate savings growth data (simulated monthly data)
  const savingsGrowthData = useMemo(() => {
    const currentDate = new Date();
    const data = [];
    let cumulativeSimpananWajib = 0;
    let cumulativeSimpananSukarela = 0;
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthLabel = date.toLocaleDateString('id-ID', { month: 'short' });
      
      // Simulate gradual growth
      const growthFactor = (12 - i) / 12;
      cumulativeSimpananWajib = Math.round(userSavings.simpananWajib * growthFactor);
      cumulativeSimpananSukarela = Math.round(userSavings.simpananSukarela * growthFactor * (0.7 + Math.random() * 0.6));
      
      data.push({
        month: monthLabel,
        simpananWajib: cumulativeSimpananWajib,
        simpananSukarela: cumulativeSimpananSukarela,
        total: userSavings.simpananPokok + cumulativeSimpananWajib + cumulativeSimpananSukarela,
      });
    }
    return data;
  }, [userSavings]);

  // Calculate installment progress
  const paidInstallmentsCount = userInstallments.filter(i => i.status === 'paid').length;
  const totalInstallments = userInstallments.length;
  const overdueInstallments = userInstallments.filter(i => i.status === 'overdue');
  const partialInstallments = userInstallments.filter(i => i.status === 'partial');
  const unpaidInstallments = userInstallments.filter(i => i.status === 'unpaid');
  const pendingInstallments = userInstallments.filter(i => i.status === 'pending');

  // Find next due date (first unpaid, pending, partial, or overdue installment)
  const nextInstallment = userInstallments
    .filter(i => i.status !== 'paid')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  // Calculate total paid and remaining - include ALL paidAmount (including partial payments)
  const totalPaid = userInstallments.reduce((sum, i) => sum + i.paidAmount, 0);
  const totalInstallmentAmount = userInstallments.reduce((sum, i) => sum + i.totalAmount + i.penaltyAmount, 0);
  const totalRemaining = totalInstallmentAmount - totalPaid;
  const totalPenalty = userInstallments.reduce((sum, i) => sum + i.penaltyAmount, 0);
  
  // Calculate total shortfall (kurang bayar) from partial payments
  const totalShortfall = partialInstallments.reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);
  
  // Progress berdasarkan total uang terbayar vs total yang harus dibayar
  const paymentProgress = totalInstallmentAmount > 0 ? (totalPaid / totalInstallmentAmount) * 100 : 0;

  // Use real SHU estimate from hook (removed mock calculation)
  const distributions = getSHUDistributions();
  const confirmedDistributions = distributions.filter(d => d.status === 'confirmed');
  const lastSHU = confirmedDistributions.length > 0 
    ? confirmedDistributions[confirmedDistributions.length - 1]
    : null;

  // Generate contextual insights
  const insights = useMemo(() => {
    const messages: { type: 'success' | 'warning' | 'info'; message: string }[] = [];
    
    // Savings insights
    if (userSavings.simpananSukarela > 0) {
      const monthlyInterest = Math.round(userSavings.simpananSukarela * (settings.simpananSukarelaInterestRate / 100));
      messages.push({
        type: 'success',
        message: t(
          `Simpanan sukarela Anda menghasilkan bunga sekitar ${formatCurrency(monthlyInterest)}/bulan`,
          `Your voluntary savings earn approximately ${formatCurrency(monthlyInterest)}/month`
        ),
      });
    } else {
      messages.push({
        type: 'info',
        message: t(
          'Pertimbangkan menabung di simpanan sukarela untuk mendapatkan bunga bulanan',
          'Consider saving in voluntary savings to earn monthly interest'
        ),
      });
    }

    // Loan insights
    if (userLoan) {
      if (overdueInstallments.length > 0) {
        messages.push({
          type: 'warning',
          message: t(
            `Anda memiliki ${overdueInstallments.length} angsuran tertunggak dengan denda ${formatCurrency(totalPenalty)}`,
            `You have ${overdueInstallments.length} overdue installments with ${formatCurrency(totalPenalty)} penalty`
          ),
        });
      } else if (paidInstallmentsCount > 0) {
        messages.push({
          type: 'success',
          message: t(
            `Pembayaran angsuran Anda lancar! Sudah ${paidInstallmentsCount} dari ${totalInstallments} angsuran`,
            `Your installments are on track! ${paidInstallmentsCount} of ${totalInstallments} paid`
          ),
        });
      }
    }

    // SHU insights
    if (shuEstimate && shuEstimate.estimatedTotalSHU > 0) {
      messages.push({
        type: 'info',
        message: t(
          `Estimasi SHU Anda tahun ini sekitar ${formatCurrency(shuEstimate.estimatedTotalSHU)}`,
          `Your estimated SHU this year is approximately ${formatCurrency(shuEstimate.estimatedTotalSHU)}`
        ),
      });
    }

    // Membership duration insight
    const joinDate = new Date(user.joinDate);
    const membershipMonths = Math.floor((new Date().getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (membershipMonths >= 12) {
      const years = Math.floor(membershipMonths / 12);
      messages.push({
        type: 'success',
        message: t(
          `Terima kasih telah menjadi anggota selama ${years} tahun!`,
          `Thank you for being a member for ${years} year${years > 1 ? 's' : ''}!`
        ),
      });
    }

    return messages;
  }, [userSavings, userLoan, overdueInstallments, shuEstimate, totalPenalty, paidInstallmentsCount, totalInstallments, settings, user, t]);

  const isDataLoading = savingsLoading || loansLoading;

  // Animation delay increments for staggered entrance
  const getAnimationDelay = (index: number) => `${index * 150}ms`;

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      {/* 1. Installment Progress - Only show if user has loan */}
      {userLoan && (
        <Card 
          id="installment-section" 
          className="overflow-hidden border-0 shadow-lg scroll-mt-4 animate-fade-in opacity-0"
          style={{ animationDelay: getAnimationDelay(0), animationFillMode: 'forwards' }}
        >
          <CardHeader className="pb-3 sm:pb-4 border-b border-border/50 p-3 sm:p-4 md:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-warning/10 shrink-0">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm sm:text-base md:text-lg font-semibold truncate">
                  {t('Progress Angsuran', 'Installment Progress')}
                </CardTitle>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                  {t('Status pembayaran pinjaman', 'Your loan payment status')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-3 sm:pt-4 md:pt-6 space-y-3 sm:space-y-4 md:space-y-5 p-3 sm:p-4 md:p-6">
            {/* Progress Bar */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{t('Progress Pembayaran', 'Payment Progress')}</span>
                <Badge variant={paymentProgress >= 100 ? "default" : "secondary"} className="font-mono text-[10px] sm:text-xs shrink-0">
                  {paidInstallmentsCount}/{totalInstallments}
                </Badge>
              </div>
              <div className="relative">
                <Progress value={paymentProgress} className="h-2 sm:h-3 rounded-full" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-0">
                  <span className="text-[10px] sm:text-xs font-bold text-muted-foreground">{Math.round(paymentProgress)}%</span>
                </div>
              </div>
            </div>
            
            {/* Stats Grid - 2x2 Layout */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Kiri Atas: Sudah Dibayar */}
              <div className="p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-success/5 border border-success/20">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-success/70 font-medium truncate">{t('Sudah Dibayar', 'Paid')}</p>
                <p className="mt-0.5 sm:mt-1 text-sm sm:text-base md:text-lg font-bold text-success truncate">{formatCurrency(totalPaid)}</p>
              </div>
              
              {/* Kanan Atas: Sisa Angsuran */}
              <div className="p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-muted/30 border border-border/50">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">{t('Sisa Angsuran', 'Remaining')}</p>
                <p className="mt-0.5 sm:mt-1 text-sm sm:text-base md:text-lg font-bold text-foreground truncate">{formatCurrency(totalRemaining)}</p>
              </div>
              
              {/* Kiri Bawah: Kurang Bayar */}
              <div className={`p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl ${totalShortfall > 0 ? 'bg-warning/5 border border-warning/20' : 'bg-muted/30 border border-border/50'}`}>
                <p className={`text-[9px] sm:text-[10px] uppercase tracking-wider font-medium truncate ${totalShortfall > 0 ? 'text-warning/70' : 'text-muted-foreground'}`}>
                  {t('Kurang Bayar', 'Shortfall')}
                </p>
                <p className={`mt-0.5 sm:mt-1 text-sm sm:text-base md:text-lg font-bold truncate ${totalShortfall > 0 ? 'text-warning' : 'text-foreground'}`}>
                  {totalShortfall > 0 ? formatCurrency(totalShortfall) : 'Rp 0'}
                </p>
                {totalShortfall > 0 && (
                  <p className="text-[9px] sm:text-xs text-muted-foreground truncate">
                    {partialInstallments.length} {t('angsuran', 'installment(s)')}
                  </p>
                )}
              </div>
              
              {/* Kanan Bawah: Jatuh Tempo Berikutnya */}
              {nextInstallment ? (
                <div className={`p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl ${nextInstallment.status === 'overdue' ? 'bg-destructive/5 border border-destructive/20' : 'bg-primary/5 border border-primary/20'}`}>
                  <p className={`text-[9px] sm:text-[10px] uppercase tracking-wider font-medium truncate ${nextInstallment.status === 'overdue' ? 'text-destructive/70' : 'text-primary/70'}`}>
                    {t('Jatuh Tempo', 'Next Due')}
                  </p>
                  <p className={`mt-0.5 sm:mt-1 text-sm sm:text-base md:text-lg font-bold truncate ${nextInstallment.status === 'overdue' ? 'text-destructive' : 'text-primary'}`}>
                    {new Date(nextInstallment.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-[9px] sm:text-xs text-muted-foreground truncate">
                    #{nextInstallment.installmentNumber} {t('dari', 'of')} {totalInstallments}
                  </p>
                </div>
              ) : (
                <div className="p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-success/5 border border-success/20">
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-success/70 font-medium truncate">
                    {t('Jatuh Tempo', 'Next Due')}
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-sm sm:text-base md:text-lg font-bold text-success truncate">
                    {t('Lunas', 'Paid Off')}
                  </p>
                </div>
              )}
            </div>
            
            {/* Total Denda - Full width if exists */}
            {totalPenalty > 0 && (
              <div className="p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-destructive/5 border border-destructive/20">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-destructive/70 font-medium">{t('Total Denda', 'Penalty')}</p>
                <p className="mt-0.5 sm:mt-1 text-sm sm:text-base md:text-lg font-bold text-destructive">{formatCurrency(totalPenalty)}</p>
              </div>
            )}

            {/* Overdue Alert - Compact on mobile */}
            {overdueInstallments.length > 0 && (
              <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-destructive/5 border border-destructive/20">
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-destructive/10 shrink-0">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-destructive truncate">
                    {t(`${overdueInstallments.length} Angsuran Tertunggak`, `${overdueInstallments.length} Overdue`)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {t('Segera bayar untuk hindari denda', 'Pay to avoid penalties')}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2. Interest History Component (passed from parent) */}
      {interestHistoryComponent && (
        <div 
          id="interest-history" 
          className="scroll-mt-4 animate-fade-in opacity-0"
          style={{ animationDelay: getAnimationDelay(userLoan ? 1 : 0), animationFillMode: 'forwards' }}
        >
          {interestHistoryComponent}
        </div>
      )}

      {/* 3. Savings Growth Chart */}
      <Card 
        id="savings-growth" 
        className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card via-card to-muted/20 scroll-mt-4 animate-fade-in opacity-0"
        style={{ 
          animationDelay: getAnimationDelay((userLoan ? 1 : 0) + (interestHistoryComponent ? 1 : 0) + 1), 
          animationFillMode: 'forwards' 
        }}
      >
        <CardHeader className="pb-3 sm:pb-4 border-b border-border/50 p-3 sm:p-4 md:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-primary/10 shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm sm:text-base md:text-lg font-semibold truncate">
                  {t('Pertumbuhan Simpanan', 'Savings Growth')}
                </CardTitle>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                  {t('12 bulan terakhir', 'Last 12 months')}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-base sm:text-lg md:text-2xl font-bold text-foreground">
                {formatCurrency(userSavings.totalSimpanan)}
              </p>
              <p className="text-[9px] sm:text-xs text-muted-foreground">{t('Total', 'Total')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3 sm:pt-4 md:pt-6 p-3 sm:p-4 md:p-6">
          {savingsLoading ? (
            <div className="space-y-3 sm:space-y-4">
              <Skeleton className="h-36 sm:h-44 md:h-48 w-full rounded-xl" />
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Skeleton className="h-14 sm:h-16 md:h-20 w-full rounded-lg sm:rounded-xl" />
                <Skeleton className="h-14 sm:h-16 md:h-20 w-full rounded-lg sm:rounded-xl" />
                <Skeleton className="h-14 sm:h-16 md:h-20 w-full rounded-lg sm:rounded-xl" />
              </div>
            </div>
          ) : (
            <>
              <div className="h-36 sm:h-44 md:h-48 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={savingsGrowthData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWajibModern" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                      </linearGradient>
                      <linearGradient id="colorSukarelaModern" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4}/>
                        <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                      dy={10}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(0)}jt`}
                      width={40}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: 'none',
                        borderRadius: '10px',
                        boxShadow: '0 4px 20px hsl(var(--foreground) / 0.1)',
                        padding: '8px 12px',
                        fontSize: '11px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
                      itemStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="simpananWajib" 
                      name={t('Simpanan Wajib', 'Mandatory')}
                      stroke="hsl(var(--primary))" 
                      fill="url(#colorWajibModern)" 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="simpananSukarela" 
                      name={t('Simpanan Sukarela', 'Voluntary')}
                      stroke="hsl(var(--chart-2))" 
                      fill="url(#colorSukarelaModern)" 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'hsl(var(--chart-2))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              {/* Legend - Compact on mobile */}
              <div className="mt-3 sm:mt-4 flex items-center justify-center gap-4 sm:gap-6">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-primary" />
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{t('Wajib', 'Mandatory')}</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-success" />
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{t('Sukarela', 'Voluntary')}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 4. SHU Estimation */}
      <Card 
        id="shu-section" 
        className="overflow-hidden border-0 shadow-lg scroll-mt-4 animate-fade-in opacity-0"
        style={{ 
          animationDelay: getAnimationDelay((userLoan ? 1 : 0) + (interestHistoryComponent ? 1 : 0) + 2), 
          animationFillMode: 'forwards' 
        }}
      >
        <CardHeader className="pb-3 sm:pb-4 border-b border-border/50 p-3 sm:p-4 md:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-accent/10 shrink-0">
                <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm sm:text-base md:text-lg font-semibold truncate">
                  {t('Estimasi SHU', 'SHU Estimate')}
                </CardTitle>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                  {t('Perkiraan pembagian hasil', 'Estimated surplus')}
                </p>
              </div>
            </div>
            <TooltipProvider>
              <TooltipUI>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-lg sm:rounded-xl hover:bg-muted shrink-0"
                    onClick={() => onNavigate?.('shu')}
                  >
                    <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{t('Lihat Riwayat', 'View History')}</p>
                </TooltipContent>
              </TooltipUI>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="pt-3 sm:pt-4 md:pt-6 p-3 sm:p-4 md:p-6">
          {shuLoading ? (
            <div className="space-y-3 sm:space-y-4">
              <Skeleton className="h-16 sm:h-20 w-full rounded-xl" />
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <Skeleton className="h-20 sm:h-24 w-full rounded-xl" />
                <Skeleton className="h-20 sm:h-24 w-full rounded-xl" />
              </div>
            </div>
          ) : shuEstimate ? (
            <>
              {/* Main Estimate - Compact on mobile */}
              <div className="text-center py-4 sm:py-5 md:py-6 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-accent/10 via-primary/5 to-transparent border border-accent/20">
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  {t('Total Estimasi', 'Total Estimate')}
                </p>
                <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl md:text-4xl font-bold text-accent">
                  {formatCurrency(shuEstimate.estimatedTotalSHU)}
                </p>
                <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-muted-foreground">
                  {t('Berdasarkan simpanan saat ini', 'Based on current savings')}
                </p>
              </div>
              
              {/* Breakdown - Compact grid */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-3 sm:mt-4">
                <div 
                  className="p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-primary/5 border border-primary/20 cursor-pointer transition-all duration-300 hover:bg-primary/10 hover:shadow-md group"
                  onClick={() => onNavigate?.('loans')}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                    <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-primary/10 group-hover:scale-110 transition-transform">
                      <Landmark className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">{t('Jasa Simpanan', 'Savings')}</p>
                  </div>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-primary">{formatCurrency(shuEstimate.estimatedSimpananSHU)}</p>
                </div>
                <div 
                  className="p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-success/5 border border-success/20 cursor-pointer transition-all duration-300 hover:bg-success/10 hover:shadow-md group"
                  onClick={() => onNavigate?.('business-transactions')}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                    <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-success/10 group-hover:scale-110 transition-transform">
                      <Store className="h-3 w-3 sm:h-4 sm:w-4 text-success" />
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">{t('Jasa Usaha', 'Business')}</p>
                  </div>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-success">{formatCurrency(shuEstimate.estimatedUsahaSHU)}</p>
                </div>
              </div>

              {/* Info Note - Compact */}
              <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-muted/30 border border-border/50">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-muted shrink-0">
                    <Target className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                    {t(
                      `SHU: ${shuEstimate.shuSettings.shuAnggotaSimpanan}% simpanan + ${shuEstimate.shuSettings.shuAnggotaJasaUsaha}% jasa usaha. Distribusi setelah RAT.`,
                      `SHU: ${shuEstimate.shuSettings.shuAnggotaSimpanan}% savings + ${shuEstimate.shuSettings.shuAnggotaJasaUsaha}% business. Distribution after RAT.`
                    )}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <Gift className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-30" />
              <p className="text-xs sm:text-sm">{t('Data tidak tersedia', 'Data unavailable')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Contextual Insights */}
      <Card 
        id="insights-section" 
        className="overflow-hidden border-0 shadow-lg scroll-mt-4 animate-fade-in opacity-0"
        style={{ 
          animationDelay: getAnimationDelay((userLoan ? 1 : 0) + (interestHistoryComponent ? 1 : 0) + 3), 
          animationFillMode: 'forwards' 
        }}
      >
        <CardHeader className="pb-3 sm:pb-4 border-b border-border/50 p-3 sm:p-4 md:p-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-warning/10 shrink-0">
              <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm sm:text-base md:text-lg font-semibold truncate">
                {t('Insight untuk Anda', 'Insights for You')}
              </CardTitle>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                {t('Tips dan informasi', 'Tips and info')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3 sm:pt-4 md:pt-6 space-y-2 sm:space-y-3 p-3 sm:p-4 md:p-6">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl animate-fade-in transition-all duration-300 ${
                insight.type === 'success' 
                  ? 'bg-success/5 border border-success/20' 
                  : insight.type === 'warning' 
                    ? 'bg-destructive/5 border border-destructive/20'
                    : 'bg-muted/30 border border-border/50'
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0 ${
                insight.type === 'success' 
                  ? 'bg-success/10' 
                  : insight.type === 'warning' 
                    ? 'bg-destructive/10'
                    : 'bg-warning/10'
              }`}>
                {insight.type === 'success' ? (
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success" />
                ) : insight.type === 'warning' ? (
                  <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                ) : (
                  <Lightbulb className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-warning" />
                )}
              </div>
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">{insight.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
