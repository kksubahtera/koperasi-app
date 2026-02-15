import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Scale, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { useSHUReconciliation } from '@/hooks/useSHUReconciliation';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';

interface SHUReconciliationWidgetProps {
  year?: number;
  onNavigateToReconciliation?: () => void;
}

export const SHUReconciliationWidget = ({ 
  year = new Date().getFullYear(),
  onNavigateToReconciliation 
}: SHUReconciliationWidgetProps) => {
  const { t } = useThemeLanguage();
  const { result, loading } = useSHUReconciliation(year);

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('Rekonsiliasi SHU', 'SHU Reconciliation')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            {t('Rekonsiliasi SHU', 'SHU Reconciliation')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('Data tidak tersedia', 'Data not available')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const isComplete = result.matchRate === 100 && result.discrepancies.length === 0;
  const hasIssues = result.discrepancies.length > 0;
  const isLowRate = result.matchRate < 80;

  const getStatusBadge = () => {
    if (result.distributionStatus === 'not_found') {
      return (
        <Badge variant="secondary" className="text-xs">
          {t('Belum Ada Distribusi', 'No Distribution')}
        </Badge>
      );
    }
    if (isComplete) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {t('Lengkap', 'Complete')}
        </Badge>
      );
    }
    if (isLowRate) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {t('Perlu Perhatian', 'Needs Attention')}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {t('Ada Selisih', 'Has Discrepancies')}
      </Badge>
    );
  };

  return (
    <Card className={hasIssues && !isComplete ? 'border-amber-200 dark:border-amber-800' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            {t('Rekonsiliasi SHU', 'SHU Reconciliation')} {year}
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Match Rate */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('Kesesuaian', 'Match Rate')}</span>
            <span className="font-medium">{result.matchRate.toFixed(1)}%</span>
          </div>
          <Progress 
            value={result.matchRate} 
            className={`h-2 ${isComplete ? '[&>div]:bg-emerald-500' : isLowRate ? '[&>div]:bg-destructive' : '[&>div]:bg-amber-500'}`}
          />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/50 rounded p-2">
            <span className="text-muted-foreground block">{t('Cocok', 'Matched')}</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {result.matchedCount} {t('anggota', 'members')}
            </span>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <span className="text-muted-foreground block">{t('Selisih', 'Discrepancy')}</span>
            <span className={`font-semibold ${hasIssues ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {result.discrepancies.length} {t('item', 'items')}
            </span>
          </div>
        </div>

        {/* Difference Amount */}
        {result.difference !== 0 && (
          <div className="text-xs bg-amber-50 dark:bg-amber-950/30 rounded p-2 border border-amber-200 dark:border-amber-800">
            <span className="text-muted-foreground">{t('Selisih Total:', 'Total Difference:')}</span>
            <span className="font-semibold text-amber-700 dark:text-amber-400 ml-1">
              Rp {Math.abs(result.difference).toLocaleString('id-ID')}
            </span>
          </div>
        )}

        {/* Navigate Button */}
        {onNavigateToReconciliation && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
            onClick={onNavigateToReconciliation}
          >
            {t('Lihat Detail', 'View Details')}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
