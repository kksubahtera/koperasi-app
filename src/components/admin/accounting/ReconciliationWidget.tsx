import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ClipboardCheck, CheckCircle, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';

interface ReconciliationWidgetProps {
  onNavigateToReconciliation?: () => void;
}

// Helper to extract journal number from notes
const getJournalNumber = (notes: string | null): string | null => {
  if (!notes) return null;
  const match = notes.match(/Jurnal:\s*(JRN-[\w-]+)/);
  return match ? match[1] : null;
};

export const ReconciliationWidget = ({ onNavigateToReconciliation }: ReconciliationWidgetProps) => {
  const { t } = useThemeLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ['reconciliationWidget'],
    queryFn: async () => {
      // Fetch approved transactions
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('id, notes')
        .eq('status', 'approved');
      
      if (error) throw error;

      const transactionsData = transactions || [];
      const withJournal = transactionsData.filter(t => getJournalNumber(t.notes));
      const withoutJournal = transactionsData.filter(t => !getJournalNumber(t.notes));

      const reconciliationRate = transactionsData.length > 0 
        ? (withJournal.length / transactionsData.length) * 100 
        : 100;

      return {
        total: transactionsData.length,
        withJournal: withJournal.length,
        withoutJournal: withoutJournal.length,
        rate: reconciliationRate,
      };
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isFullyReconciled = data?.rate === 100;
  const isLow = (data?.rate || 0) < 90;

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      isFullyReconciled 
        ? "border-l-4 border-l-emerald-500" 
        : isLow 
          ? "border-l-4 border-l-red-500"
          : "border-l-4 border-l-amber-500"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            {t('Rekonsiliasi Jurnal', 'Journal Reconciliation')}
          </div>
          {isFullyReconciled ? (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle className="h-3 w-3 mr-1" />
              {t('Lengkap', 'Complete')}
            </Badge>
          ) : (
            <Badge variant="secondary" className={cn(
              isLow 
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            )}>
              <AlertTriangle className="h-3 w-3 mr-1" />
              {data?.withoutJournal} Pending
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className={cn(
              "text-2xl font-bold",
              isFullyReconciled 
                ? "text-emerald-600 dark:text-emerald-400"
                : isLow
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
            )}>
              {data?.rate.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">
              {data?.withJournal}/{data?.total} {t('transaksi', 'transactions')}
            </span>
          </div>
          <Progress 
            value={data?.rate || 0} 
            className={cn(
              "h-2",
              isFullyReconciled 
                ? "[&>div]:bg-emerald-500"
                : isLow
                  ? "[&>div]:bg-red-500"
                  : "[&>div]:bg-amber-500"
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
              {data?.withJournal || 0}
            </p>
            <p className="text-xs text-muted-foreground">{t('Dengan Jurnal', 'With Journal')}</p>
          </div>
          <div className="space-y-1">
            <p className={cn(
              "text-lg font-semibold",
              (data?.withoutJournal || 0) > 0 
                ? "text-amber-600 dark:text-amber-400" 
                : "text-muted-foreground"
            )}>
              {data?.withoutJournal || 0}
            </p>
            <p className="text-xs text-muted-foreground">{t('Tanpa Jurnal', 'Without Journal')}</p>
          </div>
        </div>

        {onNavigateToReconciliation && (
          <Button 
            variant="ghost" 
            className="w-full text-sm" 
            onClick={onNavigateToReconciliation}
          >
            {t('Lihat Detail Rekonsiliasi', 'View Reconciliation Details')}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
