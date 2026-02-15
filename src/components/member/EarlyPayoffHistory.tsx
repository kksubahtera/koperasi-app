import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency, formatShortDate } from '@/lib/mockData';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useUserTransactions } from '@/hooks/useUserTransactions';
import { 
  ArrowLeft, 
  Banknote, 
  CheckCircle, 
  Clock, 
  XCircle, 
  TrendingDown,
  Sparkles,
  Calendar,
  Info
} from 'lucide-react';

interface EarlyPayoffHistoryProps {
  onBack: () => void;
}

interface EarlyPayoffData {
  id: string;
  amount: number;
  status: string;
  date: string | null;
  createdAt: string | null;
  loanId?: string;
  principalAmount?: number;
  remainingPrincipal?: number;
  interestSaved?: number;
  totalInterestPaid?: number;
  totalPenaltyPaid?: number;
  earlyPayoffFee?: number;
  originalTenor?: number;
  paidInstallments?: number;
  remainingInstallments?: number;
  userNotes?: string;
}

export const EarlyPayoffHistory = ({ onBack }: EarlyPayoffHistoryProps) => {
  const { t } = useThemeLanguage();
  const { transactions, isLoading } = useUserTransactions();

  // Filter and parse early payoff transactions
  const earlyPayoffTransactions = useMemo((): EarlyPayoffData[] => {
    return transactions
      .filter(tx => {
        if (!tx.notes) return false;
        try {
          const notesData = JSON.parse(tx.notes);
          return notesData.type === 'pelunasan_dini';
        } catch {
          return tx.notes.includes('pelunasan_dini');
        }
      })
      .map(tx => {
        let data: EarlyPayoffData = {
          id: tx.id,
          amount: tx.amount,
          status: tx.status,
          date: tx.date,
          createdAt: tx.createdAt,
        };

        try {
          const notesData = JSON.parse(tx.notes || '{}');
          if (notesData.type === 'pelunasan_dini') {
            data = {
              ...data,
              loanId: notesData.loan_id,
              principalAmount: notesData.principalAmount,
              remainingPrincipal: notesData.remainingPrincipal,
              interestSaved: notesData.interestSaved,
              totalInterestPaid: notesData.totalInterestPaid,
              totalPenaltyPaid: notesData.totalPenaltyPaid,
              earlyPayoffFee: notesData.earlyPayoffFee,
              originalTenor: notesData.originalTenor,
              paidInstallments: notesData.paidInstallments,
              remainingInstallments: notesData.remainingInstallments,
              userNotes: notesData.user_notes,
            };
          }
        } catch {
          // Notes is not JSON
        }

        return data;
      })
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
  }, [transactions]);

  // Calculate totals
  const totals = useMemo(() => {
    const approved = earlyPayoffTransactions.filter(tx => tx.status === 'approved');
    return {
      totalPayoffs: earlyPayoffTransactions.length,
      approvedPayoffs: approved.length,
      totalSaved: approved.reduce((sum, tx) => sum + (tx.interestSaved || 0), 0),
      totalPaid: approved.reduce((sum, tx) => sum + tx.amount, 0),
    };
  }, [earlyPayoffTransactions]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('Disetujui', 'Approved')}
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="pending">
            <Clock className="h-3 w-3 mr-1" />
            {t('Menunggu', 'Pending')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            {t('Ditolak', 'Rejected')}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('Riwayat Pelunasan Dini', 'Early Payoff History')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('Catatan pelunasan pinjaman sebelum jatuh tempo', 'Records of early loan settlements')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {totals.totalPayoffs > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
                  <Banknote className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('Total Pengajuan', 'Total Requests')}</p>
              <p className="text-xl font-bold">{totals.totalPayoffs}</p>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('Disetujui', 'Approved')}</p>
              <p className="text-xl font-bold">{totals.approvedPayoffs}</p>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                  <TrendingDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('Total Dibayar', 'Total Paid')}</p>
              <p className="text-lg font-bold">{formatCurrency(totals.totalPaid)}</p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-200 dark:bg-emerald-900/50 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                </div>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                {t('Total Penghematan', 'Total Savings')}
              </p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(totals.totalSaved)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Early Payoff List */}
      {earlyPayoffTransactions.length === 0 ? (
        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Banknote className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-center">
              {t('Belum ada riwayat pelunasan dini', 'No early payoff history yet')}
            </p>
            <p className="text-sm text-muted-foreground/70 text-center mt-1">
              {t('Pengajuan pelunasan dini akan muncul di sini', 'Early payoff requests will appear here')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {earlyPayoffTransactions.map((payoff) => (
            <Card key={payoff.id} className="border-border/40 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
                      <Banknote className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {t('Pelunasan Dini', 'Early Payoff')}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {payoff.createdAt ? formatShortDate(payoff.createdAt) : '-'}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(payoff.status)}
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-4">
                {/* Amount */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">
                    {t('Total Pelunasan', 'Total Payoff')}
                  </span>
                  <span className="text-lg font-bold">{formatCurrency(payoff.amount)}</span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {payoff.remainingPrincipal !== undefined && (
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-muted-foreground text-xs">
                        {t('Sisa Pokok', 'Remaining Principal')}
                      </p>
                      <p className="font-semibold">{formatCurrency(payoff.remainingPrincipal)}</p>
                    </div>
                  )}
                  
                  {payoff.totalInterestPaid !== undefined && (
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-muted-foreground text-xs">
                        {t('Bunga Dibayar', 'Interest Paid')}
                      </p>
                      <p className="font-semibold">{formatCurrency(payoff.totalInterestPaid)}</p>
                    </div>
                  )}
                  
                  {payoff.totalPenaltyPaid !== undefined && payoff.totalPenaltyPaid > 0 && (
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-muted-foreground text-xs">
                        {t('Denda Dibayar', 'Penalty Paid')}
                      </p>
                      <p className="font-semibold">{formatCurrency(payoff.totalPenaltyPaid)}</p>
                    </div>
                  )}
                  
                  {payoff.earlyPayoffFee !== undefined && payoff.earlyPayoffFee > 0 && (
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-muted-foreground text-xs">
                        {t('Biaya Pelunasan', 'Payoff Fee')}
                      </p>
                      <p className="font-semibold">{formatCurrency(payoff.earlyPayoffFee)}</p>
                    </div>
                  )}
                </div>

                {/* Interest Saved Highlight */}
                {payoff.interestSaved !== undefined && payoff.interestSaved > 0 && payoff.status === 'approved' && (
                  <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="text-emerald-800 dark:text-emerald-300">
                      <span className="font-medium">{t('Penghematan Bunga:', 'Interest Saved:')}</span>{' '}
                      <span className="font-bold">{formatCurrency(payoff.interestSaved)}</span>
                      {payoff.remainingInstallments && (
                        <span className="block text-sm mt-1">
                          {t(`Anda menghemat bunga dari ${payoff.remainingInstallments} angsuran tersisa`, 
                             `You saved interest from ${payoff.remainingInstallments} remaining installments`)}
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Installment Info */}
                {(payoff.originalTenor || payoff.paidInstallments !== undefined) && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {payoff.originalTenor && (
                      <span>
                        {t('Tenor:', 'Tenor:')} {payoff.originalTenor} {t('bulan', 'months')}
                      </span>
                    )}
                    {payoff.paidInstallments !== undefined && (
                      <span>
                        {t('Sudah dibayar:', 'Already paid:')} {payoff.paidInstallments} {t('angsuran', 'installments')}
                      </span>
                    )}
                  </div>
                )}

                {/* User Notes */}
                {payoff.userNotes && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                    <p className="text-xs text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1 mb-1">
                      <Info className="h-3 w-3" />
                      {t('Catatan', 'Notes')}
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-300">{payoff.userNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
