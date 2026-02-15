import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/mockData';
import { ProfitLoss, IncomeEntry, ExpenseEntry } from '@/lib/cooperativeSettings';
import { TrendingUp, TrendingDown, Calculator, ArrowUp, ArrowDown, Building2, Info, BookOpen, CheckCircle2 } from 'lucide-react';
import { TermTooltip, AccountingEquationDisplay } from '@/components/shared/TermTooltip';
import { INCOME_STATEMENT_TERMINOLOGY } from '@/lib/accountingTerminology';
import { Badge } from '@/components/ui/badge';
import { QuickEquationGuide } from './QuickEquationGuide';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProfitLossViewProps {
  profitLoss: ProfitLoss & { biayaPenyusutan?: number };
  incomeEntries: IncomeEntry[];
  expenseEntries: ExpenseEntry[];
}

export const ProfitLossView = ({ profitLoss, incomeEntries, expenseEntries }: ProfitLossViewProps) => {
  const yearIncomes = incomeEntries.filter(e => e.year === profitLoss.year);
  const yearExpenses = expenseEntries.filter(e => e.year === profitLoss.year);

  const isProfit = profitLoss.shuBruto > 0;
  const biayaPenyusutan = profitLoss.biayaPenyusutan || 0;

  // Check if entries have journal integration
  const hasJournalIntegration = yearIncomes.some(i => i.type === 'manual') || yearExpenses.some(e => e.type === 'manual');

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Reference Accounting Equation Guide */}
      <QuickEquationGuide variant="profit-loss" />
      {/* Header with Terminology Info */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">
            <TermTooltip term="labaRugi" showIcon iconSize="sm">
              Laporan Laba Rugi
            </TermTooltip>
          </h2>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">Tahun Buku {profitLoss.year}</p>
        
        {/* Accounting Equation for P&L */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground bg-muted/30 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg cursor-help">
                <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="font-mono">SHU = Pendapatan − Beban</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p className="font-medium mb-1">Rumus Laba Rugi</p>
              <p className="text-xs text-muted-foreground">
                Sisa Hasil Usaha (SHU) = Total Pendapatan dikurangi Total Beban/Biaya. 
                Istilah lain: Laba Bersih, Net Income, Profit/Loss.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Journal Integration Notice */}
      {hasJournalIntegration && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-2.5 sm:py-3 px-3 sm:px-4">
            <div className="flex items-start sm:items-center gap-2 text-green-600 text-xs sm:text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span>
                <strong>Terintegrasi dengan Jurnal:</strong> Data pendapatan dan beban manual sudah dicatat dalam jurnal umum
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Income Section */}
      <Card className="border-green-500/20">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-green-600">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            <TermTooltip term="pendapatan" showIcon iconSize="sm">
              PENDAPATAN
            </TermTooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3 px-3 sm:px-6">
          {/* Pendapatan Bunga Pinjaman */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg bg-green-500/5 p-2.5 sm:p-3 gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <ArrowUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="text-xs sm:text-sm text-left cursor-help">
                    Pendapatan Bunga Pinjaman
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">Pendapatan Bunga Pinjaman</p>
                    <p className="text-xs text-muted-foreground">
                      Dihitung otomatis dari cicilan pinjaman yang dibayar.
                      Termasuk: Interest Income, Loan Interest Revenue.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge variant="outline" className="text-[10px] sm:text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                Otomatis
              </Badge>
            </div>
            <span className="font-medium text-green-600 text-xs sm:text-sm ml-5 sm:ml-0">{formatCurrency(profitLoss.pendapatanBungaPinjaman)}</span>
          </div>

          {/* Pendapatan Denda */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg bg-green-500/5 p-2.5 sm:p-3 gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <ArrowUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="text-xs sm:text-sm text-left cursor-help">
                    Pendapatan Denda Pinjaman
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">Pendapatan Denda</p>
                    <p className="text-xs text-muted-foreground">
                      Dihitung otomatis dari denda keterlambatan cicilan.
                      Termasuk: Penalty Income, Late Fee Revenue.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge variant="outline" className="text-[10px] sm:text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                Otomatis
              </Badge>
            </div>
            <span className="font-medium text-green-600 text-xs sm:text-sm ml-5 sm:ml-0">{formatCurrency(profitLoss.pendapatanDendaPinjaman)}</span>
          </div>

          {/* Pendapatan Lainnya (Manual) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg bg-green-500/5 p-2.5 sm:p-3 gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <ArrowUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="text-xs sm:text-sm text-left cursor-help">
                    Pendapatan Lainnya
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">Pendapatan Lainnya (Manual)</p>
                    <p className="text-xs text-muted-foreground">
                      Input manual dari form Pendapatan & Beban.
                      Otomatis tercatat dalam jurnal umum.
                      Termasuk: Other Income, Miscellaneous Revenue.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {yearIncomes.filter(i => i.type === 'manual').length > 0 && (
                <Badge variant="outline" className="text-[10px] sm:text-xs bg-green-500/10 text-green-600 border-green-500/20">
                  <BookOpen className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                  Jurnal
                </Badge>
              )}
            </div>
            <span className="font-medium text-green-600 text-xs sm:text-sm ml-5 sm:ml-0">{formatCurrency(profitLoss.pendapatanManual)}</span>
          </div>
          
          {/* Detail Pendapatan Manual */}
          {yearIncomes.filter(i => i.type === 'manual').length > 0 && (
            <div className="ml-4 sm:ml-5 mt-1.5 sm:mt-2 space-y-1 border-l-2 border-green-500/20 pl-2.5 sm:pl-3">
              {yearIncomes.filter(i => i.type === 'manual').map(income => (
                <div key={income.id} className="flex justify-between text-[10px] sm:text-xs text-muted-foreground gap-2">
                  <span className="truncate">{income.description}</span>
                  <span className="flex-shrink-0">{formatCurrency(income.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Total Pendapatan */}
          <div className="mt-3 sm:mt-4 flex items-center justify-between border-t pt-3 sm:pt-4">
            <span className="font-bold text-sm sm:text-base">
              <TermTooltip term="totalPendapatan">
                Total Pendapatan
              </TermTooltip>
            </span>
            <span className="text-sm sm:text-lg font-bold text-green-600">{formatCurrency(profitLoss.totalPendapatan)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Expense Section */}
      <Card className="border-red-500/20">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-red-600">
            <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
            <TermTooltip term="beban" showIcon iconSize="sm">
              BIAYA USAHA
            </TermTooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3 px-3 sm:px-6">
          {/* Biaya Bunga Simpanan */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg bg-red-500/5 p-2.5 sm:p-3 gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <ArrowDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="text-xs sm:text-sm text-left cursor-help">
                    Biaya Bunga Simpanan Sukarela
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">Biaya Bunga Simpanan</p>
                    <p className="text-xs text-muted-foreground">
                      Dihitung otomatis dari bunga simpanan sukarela anggota.
                      Termasuk: Interest Expense, Savings Interest Cost.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge variant="outline" className="text-[10px] sm:text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                Otomatis
              </Badge>
            </div>
            <span className="font-medium text-red-600 text-xs sm:text-sm ml-5 sm:ml-0">{formatCurrency(profitLoss.biayaBungaSimpanan)}</span>
          </div>

          {/* Biaya Operasional (Manual) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg bg-red-500/5 p-2.5 sm:p-3 gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <ArrowDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="text-xs sm:text-sm text-left cursor-help">
                    Biaya Operasional
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">Biaya Operasional (Manual)</p>
                    <p className="text-xs text-muted-foreground">
                      Input manual dari form Pendapatan & Beban.
                      Otomatis tercatat dalam jurnal umum.
                      Termasuk: Operating Expenses, General & Admin Expenses.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {yearExpenses.filter(e => e.type === 'manual').length > 0 && (
                <Badge variant="outline" className="text-[10px] sm:text-xs bg-green-500/10 text-green-600 border-green-500/20">
                  <BookOpen className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                  Jurnal
                </Badge>
              )}
            </div>
            <span className="font-medium text-red-600 text-xs sm:text-sm ml-5 sm:ml-0">{formatCurrency(profitLoss.biayaManual)}</span>
          </div>
          
          {/* Depreciation Expense */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg bg-orange-500/5 p-2.5 sm:p-3 border border-orange-500/20 gap-1.5 sm:gap-2">
            <div className="flex items-start sm:items-center gap-1.5 sm:gap-2 flex-wrap">
              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 mt-0.5 sm:mt-0" />
              <div className="flex-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="text-xs sm:text-sm text-left cursor-help">
                      Beban Penyusutan Aset Tetap
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">Beban Penyusutan</p>
                      <p className="text-xs text-muted-foreground">
                        Dihitung otomatis berdasarkan aset tetap aktif.
                        Metode: Garis Lurus (Straight-Line).
                        Termasuk: Depreciation Expense, Asset Amortization.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Dihitung otomatis dari aset aktif</p>
              </div>
              <Badge variant="outline" className="text-[10px] sm:text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                Otomatis
              </Badge>
            </div>
            <span className="font-medium text-orange-600 text-xs sm:text-sm ml-5 sm:ml-0">{formatCurrency(biayaPenyusutan)}</span>
          </div>
          
          {/* Detail Biaya Manual */}
          {yearExpenses.filter(e => e.type === 'manual').length > 0 && (
            <div className="ml-4 sm:ml-5 mt-1.5 sm:mt-2 space-y-1 border-l-2 border-red-500/20 pl-2.5 sm:pl-3">
              {yearExpenses.filter(e => e.type === 'manual').map(expense => (
                <div key={expense.id} className="flex justify-between text-[10px] sm:text-xs text-muted-foreground gap-2">
                  <span className="truncate">{expense.description}</span>
                  <span className="flex-shrink-0">{formatCurrency(expense.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Total Biaya */}
          <div className="mt-3 sm:mt-4 flex items-center justify-between border-t pt-3 sm:pt-4">
            <span className="font-bold text-sm sm:text-base">
              <TermTooltip term="totalBeban">
                Total Biaya
              </TermTooltip>
            </span>
            <span className="text-sm sm:text-lg font-bold text-red-600">{formatCurrency(profitLoss.totalBiaya)}</span>
          </div>
        </CardContent>
      </Card>

      {/* SHU Result */}
      <Card className={isProfit ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}>
        <CardContent className="py-4 sm:py-6 px-3 sm:px-6">
          <div className="flex flex-col items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Calculator className="h-5 w-5 sm:h-6 sm:w-6" />
              <TermTooltip term="shuBruto" showIcon iconSize="sm">
                <span className="text-sm sm:text-lg font-medium">Sisa Hasil Usaha (SHU)</span>
              </TermTooltip>
            </div>
            <span className={`text-xl sm:text-3xl font-bold ${isProfit ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(profitLoss.shuBruto)}
            </span>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              {isProfit ? 'Surplus - Siap didistribusikan' : 'Defisit - Tidak ada SHU'}
            </p>
            {biayaPenyusutan > 0 && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 sm:mt-2 text-center">
                * Termasuk beban penyusutan {formatCurrency(biayaPenyusutan)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Source Info */}
      <Card className="border-muted">
        <CardContent className="py-3 sm:py-4 px-3 sm:px-6">
          <h4 className="text-xs sm:text-sm font-medium mb-2 flex items-center gap-1.5 sm:gap-2">
            <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            Sumber Data Laporan
          </h4>
          <div className="grid gap-2 text-[10px] sm:text-xs text-muted-foreground">
            <div className="flex items-start gap-1.5 sm:gap-2">
              <Badge variant="outline" className="text-[10px] sm:text-xs bg-blue-500/10 text-blue-600 border-blue-500/20 shrink-0">
                Otomatis
              </Badge>
              <span>Pendapatan bunga, denda, biaya bunga simpanan, dan penyusutan dihitung otomatis dari data transaksi.</span>
            </div>
            <div className="flex items-start gap-1.5 sm:gap-2">
              <Badge variant="outline" className="text-[10px] sm:text-xs bg-green-500/10 text-green-600 border-green-500/20 shrink-0">
                <BookOpen className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                Jurnal
              </Badge>
              <span>Pendapatan dan biaya manual tercatat dalam jurnal umum dengan double-entry bookkeeping.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};