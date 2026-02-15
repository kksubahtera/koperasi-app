import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Calendar, TrendingUp, Info, Loader2, AlertCircle, PenLine, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/mockData';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useSavingsInterest } from '@/hooks/useSavingsInterest';
import { useCriticalSettings } from '@/hooks/useSettingsChangeLogs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { CarouselApi } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';

interface SavingsInterestHistoryProps {
  simpananSukarela: number;
}

// Gradient colors for each card
const gradientColors = [
  'from-emerald-500 via-teal-500 to-green-400', // Green-Teal
  'from-teal-500 via-emerald-400 to-lime-400', // Teal-Pistachio
  'from-green-500 via-emerald-500 to-teal-400', // Green-Emerald
  'from-lime-500 via-green-500 to-emerald-400', // Pistachio-Green
  'from-emerald-400 via-green-500 to-teal-500', // Emerald-Teal
  'from-teal-400 via-lime-400 to-green-500', // Teal-Pistachio-Green
];

export const SavingsInterestHistory = ({ simpananSukarela }: SavingsInterestHistoryProps) => {
  const { t } = useThemeLanguage();
  const { 
    interestHistory, 
    totalInterestEarned, 
    pendingInterest,
    currentMonthEligibleBalance,
    isLoading, 
    error 
  } = useSavingsInterest();
  const { settings: criticalSettings } = useCriticalSettings();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  // Get cutoff date from localStorage
  const localSettings = JSON.parse(localStorage.getItem('cooperativeSettings') || '{}');
  const cutoffDate = localSettings.simpananSukarelaInterestCutoffDate || 15;
  const interestRate = criticalSettings?.simpananSukarelaInterestRate ?? localSettings.simpananSukarelaInterestRate ?? 0.4;

  // Get current month data for header
  const currentMonthData = useMemo(() => {
    return interestHistory.find(r => r.status === 'pending');
  }, [interestHistory]);

  // Calculate this month's net deposits (deposits - withdrawals)
  const thisMonthNetDeposits = useMemo(() => {
    if (!currentMonthData) return 0;
    const totalDeposits = currentMonthData.depositsBeforeCutoff + currentMonthData.depositsAfterCutoff;
    const totalWithdrawals = currentMonthData.withdrawals || 0;
    return totalDeposits - totalWithdrawals;
  }, [currentMonthData]);

  // Calculate this month's total deposits (gross)
  const thisMonthDeposits = useMemo(() => {
    if (!currentMonthData) return 0;
    return currentMonthData.depositsBeforeCutoff + currentMonthData.depositsAfterCutoff;
  }, [currentMonthData]);

  // Check if there are withdrawals this month
  const thisMonthWithdrawals = useMemo(() => {
    return currentMonthData?.withdrawals || 0;
  }, [currentMonthData]);

  // Filter to only show paid history (past months) - always show 6 months
  const displayHistory = useMemo(() => {
    // Get only paid history (exclude current month pending)
    const paidHistory = interestHistory.filter(record => record.status === 'paid');
    return paidHistory;
  }, [interestHistory]);

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
  }, [api]);

  // Set up carousel events
  useEffect(() => {
    if (!api) return;
    api.on('select', onSelect);
    onSelect();
    return () => {
      api.off('select', onSelect);
    };
  }, [api, onSelect]);

  // Calculate actual pending interest based on current balance
  const actualPendingInterest = useMemo(() => {
    if (simpananSukarela > 0 && pendingInterest === 0) {
      return Math.round(simpananSukarela * (interestRate / 100));
    }
    return pendingInterest;
  }, [simpananSukarela, pendingInterest, interestRate]);

  if (isLoading) {
    return (
      <Card className="border-emerald-400/30 overflow-hidden">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/20 overflow-hidden">
        <CardContent className="flex items-center justify-center py-12 gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-transparent overflow-hidden shadow-lg bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-lime-500/10">
      {/* Header with gradient */}
      <CardHeader className="bg-gradient-to-r from-emerald-600 via-teal-500 to-green-500 text-white p-3 sm:p-4 pb-3 sm:pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-lg">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            {t('Riwayat Bunga Simpanan Sukarela', 'Voluntary Savings Interest History')}
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-80" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  {t(
                    `Bunga ${interestRate}% dihitung dari saldo eligible pada periode pencatatan setiap bulan. Data diambil dari database real-time.`,
                    `${interestRate}% interest is calculated from eligible balance during the recording period each month. Data is fetched from real-time database.`
                  )}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Summary Stats - This Month's Deposits & Estimated Interest */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-3 sm:mt-4">
          <div className="rounded-lg bg-white/15 backdrop-blur-sm p-2 sm:p-3">
            <p className="text-[10px] sm:text-xs opacity-80">
              {t('Setor Bulan Ini', 'This Month Deposits')}
            </p>
            <div className="flex flex-col">
              <p className="text-base sm:text-xl font-bold">
                {thisMonthNetDeposits >= 0 ? `+${formatCurrency(thisMonthNetDeposits)}` : formatCurrency(thisMonthNetDeposits)}
              </p>
              {thisMonthWithdrawals > 0 && (
                <p className="text-[9px] sm:text-[10px] opacity-70">
                  ({t('setor', 'deposit')}: +{formatCurrency(thisMonthDeposits)}, {t('tarik', 'withdraw')}: -{formatCurrency(thisMonthWithdrawals)})
                </p>
              )}
            </div>
          </div>
          <div className="rounded-lg bg-white/15 backdrop-blur-sm p-2 sm:p-3">
            <p className="text-[10px] sm:text-xs opacity-80">
              {t('Estimasi Bunga', 'Estimated Interest')}
            </p>
            <p className="text-base sm:text-xl font-bold">
              +{formatCurrency(Math.round(simpananSukarela * (interestRate / 100)))}
            </p>
          </div>
        </div>

        {/* Current Month Details */}
        <div className="mt-2 sm:mt-3 p-1.5 sm:p-2 rounded bg-white/10 backdrop-blur-sm text-[10px] sm:text-xs">
          <p className="opacity-90">
            {t('Saldo simpanan sukarela saat ini', 'Current voluntary savings balance')}: <strong>{formatCurrency(simpananSukarela)}</strong>
          </p>
          <div className="flex items-center gap-1 opacity-70 mt-0.5 sm:mt-1">
            <span>{t('Saldo eligible bulan ini', 'This month eligible balance')}: {formatCurrency(simpananSukarela)}</span>
            {currentMonthEligibleBalance > 0 && currentMonthEligibleBalance !== simpananSukarela && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-3 w-3 text-yellow-300" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {t(
                        'Menggunakan saldo aktual karena ada ketidaksesuaian data historis',
                        'Using actual balance due to historical data inconsistency'
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-3 sm:p-4">
        {displayHistory.length > 0 ? (
          <>
            <Carousel
              setApi={setApi}
              className="w-full"
              opts={{
                align: 'start',
                loop: displayHistory.length > 1,
              }}
              plugins={displayHistory.length > 1 ? [
                Autoplay({
                  delay: 4000,
                  stopOnInteraction: true,
                  stopOnMouseEnter: true,
                }),
              ] : []}
            >
              <CarouselContent className="-ml-2">
                {displayHistory.map((record, index) => {
                  const gradientClass = gradientColors[index % gradientColors.length];
                  
                  return (
                    <CarouselItem key={`${record.month}-${record.year}`} className="pl-2 basis-[85%] sm:basis-1/2 lg:basis-1/3">
                      <div className={`h-full rounded-xl bg-gradient-to-br ${gradientClass} p-[1.5px] sm:p-[2px] shadow-md sm:shadow-lg transition-all duration-300 hover:scale-[1.01] sm:hover:scale-[1.02] hover:shadow-lg sm:hover:shadow-xl`}>
                        <div className="h-full rounded-[10px] bg-card/95 backdrop-blur-sm p-2.5 sm:p-4 space-y-2 sm:space-y-3">
                          {/* Month Header */}
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className={`flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gradient-to-br ${gradientClass}`}>
                              <Calendar className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-foreground text-sm sm:text-lg truncate">
                                {record.month}
                              </p>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                {record.year}
                              </p>
                            </div>
                          </div>

                          {/* Interest Earned */}
                          <div className={`rounded-lg bg-gradient-to-r ${gradientClass} p-2 sm:p-3 text-white`}>
                            <p className="text-[10px] sm:text-xs opacity-80">{t('Bunga Diperoleh', 'Interest Earned')}</p>
                            <p className="text-lg sm:text-2xl font-bold">+{formatCurrency(record.interestEarned)}</p>
                          </div>

                          {/* Details */}
                          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                            <div className="p-1.5 sm:p-2 rounded-lg bg-muted/50 relative">
                              <p className="text-muted-foreground truncate">{t('Saldo Eligible', 'Eligible Balance')}</p>
                              <p className="font-semibold text-foreground">{formatCurrency(record.eligibleBalance)}</p>
                              {record.hasCorrections && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <PenLine className="absolute top-1 right-1 h-3 w-3 text-warning" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">{t('Disesuaikan dengan koreksi', 'Adjusted with corrections')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-100/50 dark:bg-emerald-900/30 relative">
                              <p className="text-muted-foreground truncate">{t('Setor Eligible', 'Eligible Deposit')}</p>
                              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {record.depositsBeforeCutoff > 0 ? `+${formatCurrency(record.depositsBeforeCutoff)}` : '-'}
                              </p>
                              {record.hasCorrections && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <PenLine className="absolute top-1 right-1 h-3 w-3 text-warning" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">{t('Disesuaikan dengan koreksi', 'Adjusted with corrections')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            <div className="p-1.5 sm:p-2 rounded-lg bg-muted/50">
                              <p className="text-muted-foreground">{t('Rate', 'Rate')}</p>
                              <p className="font-semibold text-foreground">{record.interestRate}%</p>
                            </div>
                            <div className="p-1.5 sm:p-2 rounded-lg bg-muted/50">
                              <p className="text-muted-foreground">{t('Penarikan', 'Withdrawals')}</p>
                              <p className={`font-semibold ${record.withdrawals > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {record.withdrawals > 0 ? `-${formatCurrency(record.withdrawals)}` : '-'}
                              </p>
                            </div>
                          </div>

                          {/* Transactions */}
                          {record.transactions.length > 0 && (
                            <div className="space-y-1 max-h-20 sm:max-h-24 overflow-y-auto">
                              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">{t('Transaksi', 'Transactions')}</p>
                              {record.transactions.slice(0, 3).map((tx, txIndex) => (
                                <div key={txIndex} className={`flex justify-between text-[10px] sm:text-xs p-1 sm:p-1.5 rounded ${tx.isCorrected ? 'bg-warning/20 border border-warning/30' : 'bg-muted/30'}`}>
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    {format(new Date(tx.date), 'dd MMM', { locale: localeId })}
                                    {tx.beforeCutoff && tx.type === 'deposit' && (
                                      <span className="text-emerald-500">★</span>
                                    )}
                                    {tx.isCorrected && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <PenLine className="h-2.5 w-2.5 text-warning" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">{t('Transaksi dikoreksi', 'Corrected transaction')}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </span>
                                  <span className={tx.type === 'withdrawal' ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}>
                                    {tx.type === 'withdrawal' ? '-' : '+'}{formatCurrency(tx.amount)}
                                  </span>
                                </div>
                              ))}
                              {record.transactions.length > 3 && (
                                <p className="text-[10px] sm:text-xs text-center text-muted-foreground">
                                  +{record.transactions.length - 3} {t('lainnya', 'more')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              
              {/* Navigation - only show if more than 1 item */}
              {displayHistory.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-4">
                  <CarouselPrevious className="relative inset-auto translate-x-0 translate-y-0 h-7 w-7 sm:h-8 sm:w-8 bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 hover:from-emerald-600 hover:to-teal-600" />
                  
                  {/* Dots indicator */}
                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3">
                    {displayHistory.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => api?.scrollTo(index)}
                        className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                          current === index 
                            ? 'w-4 sm:w-6 bg-gradient-to-r from-emerald-500 to-teal-500' 
                            : 'w-1.5 sm:w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                        }`}
                      />
                    ))}
                  </div>
                  
                  <CarouselNext className="relative inset-auto translate-x-0 translate-y-0 h-7 w-7 sm:h-8 sm:w-8 bg-gradient-to-r from-teal-500 to-green-500 text-white border-0 hover:from-teal-600 hover:to-green-600" />
                </div>
              )}
            </Carousel>
          </>
        ) : (
          <div className="text-center py-6 sm:py-8 text-muted-foreground">
            <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-30" />
            <p className="text-sm sm:text-base">{t('Belum ada riwayat bunga', 'No interest history yet')}</p>
            <p className="text-[10px] sm:text-xs mt-1.5 sm:mt-2">
              {t(
                'Bunga akan dihitung berdasarkan saldo simpanan sukarela Anda setiap tutup buku bulanan.',
                'Interest will be calculated based on your voluntary savings balance at each monthly closing.'
              )}
            </p>
          </div>
        )}
        
        {/* Footer Info */}
        <div className="mt-3 sm:mt-4 p-2 sm:p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
          <div className="flex items-start gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="space-y-0.5 sm:space-y-1">
              <p>
                {t(
                  `Bunga dihitung setiap tutup buku bulanan. Deposit tanggal 1-${cutoffDate} mendapat bunga bulan tersebut.`,
                  `Interest calculated at monthly closing. Deposits from 1st-${cutoffDate}th receive interest for that month.`
                )}
              </p>
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                {t('★ = Deposit eligible untuk bunga bulan tersebut', '★ = Deposit eligible for that month\'s interest')}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
