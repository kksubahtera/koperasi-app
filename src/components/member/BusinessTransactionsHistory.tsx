import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Store, 
  ShoppingCart, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Package
} from 'lucide-react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { formatCurrency } from '@/lib/mockData';
import { useUserBusinessTransactions, BusinessUnitSummary } from '@/hooks/useUserBusinessTransactions';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface BusinessTransactionsHistoryProps {
  onBack: () => void;
}

export const BusinessTransactionsHistory = ({ onBack }: BusinessTransactionsHistoryProps) => {
  const { t, language } = useThemeLanguage();
  const { summaryByUnit, loading, error } = useUserBusinessTransactions();
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  const toggleUnit = (unitId: string) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) {
      newExpanded.delete(unitId);
    } else {
      newExpanded.add(unitId);
    }
    setExpandedUnits(newExpanded);
  };

  const getTransactionTypeLabel = (type: string) => {
    const types: Record<string, { id: string; en: string }> = {
      sale: { id: 'Penjualan', en: 'Sale' },
      purchase: { id: 'Pembelian', en: 'Purchase' },
      service: { id: 'Jasa', en: 'Service' },
    };
    return types[type]?.[language] || type;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'd MMM yyyy', { locale: language === 'id' ? idLocale : undefined });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold">
            {t('Riwayat Transaksi Unit Usaha', 'Business Unit Transaction History')}
          </h2>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold">
            {t('Riwayat Transaksi Unit Usaha', 'Business Unit Transaction History')}
          </h2>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {t('Gagal memuat data transaksi', 'Failed to load transaction data')}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-semibold">
          {t('Riwayat Transaksi Unit Usaha', 'Business Unit Transaction History')}
        </h2>
      </div>

      <p className="text-sm text-muted-foreground">
        {t(
          'Daftar transaksi Anda di setiap unit usaha koperasi yang berkontribusi pada perhitungan SHU Jasa Usaha.',
          'List of your transactions in each cooperative business unit that contributes to your Business SHU calculation.'
        )}
      </p>

      {summaryByUnit.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Store className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {t(
                'Belum ada transaksi di unit usaha koperasi',
                'No transactions in cooperative business units yet'
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                'Transaksi Anda di unit usaha akan ditampilkan di sini',
                'Your transactions in business units will be displayed here'
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {summaryByUnit.map((unit) => (
            <Card key={unit.id}>
              <Collapsible open={expandedUnits.has(unit.id)} onOpenChange={() => toggleUnit(unit.id)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Store className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{unit.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">{unit.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-primary">{formatCurrency(unit.totalAmount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {unit.totalTransactions} {t('transaksi', 'transactions')}
                          </p>
                        </div>
                        {expandedUnits.has(unit.id) ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="border-t pt-3 space-y-2">
                      {unit.transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded bg-chart-2/10">
                              {tx.transactionType === 'sale' ? (
                                <ShoppingCart className="h-4 w-4 text-chart-2" />
                              ) : (
                                <Package className="h-4 w-4 text-chart-2" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {tx.description || getTransactionTypeLabel(tx.transactionType)}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatDate(tx.transactionDate)}
                                {tx.quantity && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {tx.quantity} {t('item', 'items')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="font-semibold text-sm">{formatCurrency(tx.amount)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
