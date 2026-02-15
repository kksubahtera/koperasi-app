import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

import { Loader2, Download, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Building2, Banknote, Coins, CreditCard, RefreshCw, Users, FileText, Receipt } from 'lucide-react';
import { useCashFlowCalculation, CashFlowCategory, CashFlowItem } from '@/hooks/useCashFlowCalculation';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { createAndDownloadExcel } from '@/lib/excelUtils';
import { QuickEquationGuide } from './QuickEquationGuide';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getSourceBadge = (source: CashFlowItem['source']) => {
  switch (source) {
    case 'transaction':
      return <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">Transaksi</Badge>;
    case 'loan':
      return <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">Pinjaman</Badge>;
    case 'installment':
      return <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Angsuran</Badge>;
    case 'journal':
      return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">Jurnal</Badge>;
    case 'manual':
      return <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">Manual</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">-</Badge>;
  }
};

export const CashFlowStatement = () => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const { cashFlow, cashFlowItems, statistics, loading, refetch } = useCashFlowCalculation(selectedYear);

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  const exportToExcel = async () => {
    if (!cashFlow) return;

    const data = [
      ['LAPORAN ARUS KAS', '', '', ''],
      ['Periode: Tahun ' + selectedYear, '', '', ''],
      ['Dihitung Otomatis dari Data Transaksi & Pinjaman', '', '', ''],
      ['', '', '', ''],
      ['ARUS KAS DARI AKTIVITAS OPERASI', '', '', ''],
      ['Keterangan', 'Sumber', 'Tanggal', 'Jumlah'],
      ['--- Penerimaan ---', '', '', formatCurrency(cashFlow.operating.totalInflow)],
      ...cashFlow.operating.items
        .filter(i => i.type === 'inflow')
        .map(i => [i.description, i.source, i.date, formatCurrency(i.amount)]),
      ['--- Pengeluaran ---', '', '', formatCurrency(cashFlow.operating.totalOutflow)],
      ...cashFlow.operating.items
        .filter(i => i.type === 'outflow')
        .map(i => [i.description, i.source, i.date, `(${formatCurrency(i.amount)})`]),
      ['Arus Kas Bersih dari Aktivitas Operasi', '', '', formatCurrency(cashFlow.operating.netFlow)],
      ['', '', '', ''],
      ['ARUS KAS DARI AKTIVITAS INVESTASI', '', '', ''],
      ['--- Penerimaan ---', '', '', formatCurrency(cashFlow.investing.totalInflow)],
      ...cashFlow.investing.items
        .filter(i => i.type === 'inflow')
        .map(i => [i.description, i.source, i.date, formatCurrency(i.amount)]),
      ['--- Pengeluaran ---', '', '', formatCurrency(cashFlow.investing.totalOutflow)],
      ...cashFlow.investing.items
        .filter(i => i.type === 'outflow')
        .map(i => [i.description, i.source, i.date, `(${formatCurrency(i.amount)})`]),
      ['Arus Kas Bersih dari Aktivitas Investasi', '', '', formatCurrency(cashFlow.investing.netFlow)],
      ['', '', '', ''],
      ['ARUS KAS DARI AKTIVITAS PENDANAAN', '', '', ''],
      ['--- Penerimaan ---', '', '', formatCurrency(cashFlow.financing.totalInflow)],
      ...cashFlow.financing.items
        .filter(i => i.type === 'inflow')
        .map(i => [i.description, i.source, i.date, formatCurrency(i.amount)]),
      ['--- Pengeluaran ---', '', '', formatCurrency(cashFlow.financing.totalOutflow)],
      ...cashFlow.financing.items
        .filter(i => i.type === 'outflow')
        .map(i => [i.description, i.source, i.date, `(${formatCurrency(i.amount)})`]),
      ['Arus Kas Bersih dari Aktivitas Pendanaan', '', '', formatCurrency(cashFlow.financing.netFlow)],
      ['', '', '', ''],
      ['RINGKASAN', '', '', ''],
      ['Kenaikan (Penurunan) Kas Bersih', '', '', formatCurrency(cashFlow.netCashFlow)],
      ['Saldo Kas Awal Periode', '', '', formatCurrency(cashFlow.openingBalance)],
      ['Saldo Kas Akhir Periode', '', '', formatCurrency(cashFlow.closingBalance)],
    ];

    await createAndDownloadExcel(
      [{ name: 'Arus Kas', data }],
      `Laporan_Arus_Kas_${selectedYear}.xlsx`
    );
  };

  const renderCategorySection = (
    title: string,
    icon: React.ReactNode,
    data: CashFlowCategory,
    colorClass: string
  ) => {
    const inflows = data.items.filter(i => i.type === 'inflow');
    const outflows = data.items.filter(i => i.type === 'outflow');

    return (
      <Card className="mb-3 sm:mb-4">
        <CardHeader className="py-3 sm:py-4 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2 flex-wrap">
            {icon}
            <span className="truncate">{title}</span>
            <Badge variant="outline" className="ml-1 sm:ml-2 font-normal text-[10px] sm:text-xs">
              {data.items.length} transaksi
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[10px] sm:text-xs">Keterangan</TableHead>
                  <TableHead className="w-16 sm:w-24 text-[10px] sm:text-xs hidden sm:table-cell">Sumber</TableHead>
                  <TableHead className="w-20 sm:w-28 text-[10px] sm:text-xs hidden md:table-cell">Tanggal</TableHead>
                  <TableHead className="text-right w-24 sm:w-40 text-[10px] sm:text-xs">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Inflows */}
                {inflows.length > 0 && (
                  <>
                    <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
                      <TableCell colSpan={1} className="font-medium text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm p-2 sm:p-4">
                        <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
                        Penerimaan
                      </TableCell>
                      <TableCell className="hidden sm:table-cell"></TableCell>
                      <TableCell className="hidden md:table-cell"></TableCell>
                      <TableCell className="text-right font-medium text-emerald-600 text-[10px] sm:text-sm p-2 sm:p-4">
                        {formatCurrency(data.totalInflow)}
                      </TableCell>
                    </TableRow>
                    {inflows.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="pl-4 sm:pl-8 text-[10px] sm:text-sm p-2 sm:p-4">
                          <span className="line-clamp-1">{item.description}</span>
                          {item.memberName && (
                            <span className="text-muted-foreground ml-1">
                              <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline" />
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell p-2 sm:p-4">{getSourceBadge(item.source)}</TableCell>
                        <TableCell className="text-[10px] sm:text-sm text-muted-foreground hidden md:table-cell p-2 sm:p-4">
                          {item.date ? format(new Date(item.date), 'dd MMM', { locale: id }) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[10px] sm:text-sm text-emerald-600 p-2 sm:p-4">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                
                {/* Outflows */}
                {outflows.length > 0 && (
                  <>
                    <TableRow className="bg-rose-50/50 dark:bg-rose-900/10">
                      <TableCell colSpan={1} className="font-medium text-rose-700 dark:text-rose-400 text-xs sm:text-sm p-2 sm:p-4">
                        <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
                        Pengeluaran
                      </TableCell>
                      <TableCell className="hidden sm:table-cell"></TableCell>
                      <TableCell className="hidden md:table-cell"></TableCell>
                      <TableCell className="text-right font-medium text-rose-600 text-[10px] sm:text-sm p-2 sm:p-4">
                        ({formatCurrency(data.totalOutflow)})
                      </TableCell>
                    </TableRow>
                    {outflows.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="pl-4 sm:pl-8 text-[10px] sm:text-sm p-2 sm:p-4">
                          <span className="line-clamp-1">{item.description}</span>
                          {item.memberName && (
                            <span className="text-muted-foreground ml-1">
                              <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline" />
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell p-2 sm:p-4">{getSourceBadge(item.source)}</TableCell>
                        <TableCell className="text-[10px] sm:text-sm text-muted-foreground hidden md:table-cell p-2 sm:p-4">
                          {item.date ? format(new Date(item.date), 'dd MMM', { locale: id }) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[10px] sm:text-sm text-rose-600 p-2 sm:p-4">
                          ({formatCurrency(item.amount)})
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                
                {/* Empty state */}
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6 sm:py-8 text-xs sm:text-sm">
                      Tidak ada transaksi pada kategori ini
                    </TableCell>
                  </TableRow>
                )}
                
                {/* Net */}
                <TableRow className={`font-bold border-t-2 ${colorClass}`}>
                  <TableCell colSpan={1} className="text-xs sm:text-sm p-2 sm:p-4">Arus Kas Bersih</TableCell>
                  <TableCell className="hidden sm:table-cell"></TableCell>
                  <TableCell className="hidden md:table-cell"></TableCell>
                  <TableCell className={`text-right font-mono text-[10px] sm:text-sm p-2 sm:p-4 ${data.netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(data.netFlow)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Reference Cash Flow Guide */}
      <QuickEquationGuide variant="cash-flow" />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold">Laporan Arus Kas</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Metode Langsung - Auto-calculated dari Transaksi & Pinjaman
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <Label className="text-[10px] sm:text-xs">Tahun:</Label>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-20 sm:w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" onClick={refetch} className="h-8 w-8" title="Refresh">
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button variant="outline" onClick={exportToExcel} className="h-8 text-xs px-2 sm:px-3">
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border-blue-200 min-h-[80px] sm:min-h-[100px]">
            <CardContent className="py-3 sm:py-4 px-3 sm:px-6 h-full flex items-center">
              <div className="flex items-center gap-2 sm:gap-3 w-full">
                <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total Transaksi</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-600">{statistics.totalTransactions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border-amber-200 min-h-[80px] sm:min-h-[100px]">
            <CardContent className="py-3 sm:py-4 px-3 sm:px-6 h-full flex items-center">
              <div className="flex items-center gap-2 sm:gap-3 w-full">
                <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10">
                  <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Aktivitas Operasi</p>
                  <p className="text-lg sm:text-xl font-bold text-amber-600">{statistics.operatingItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border-purple-200 min-h-[80px] sm:min-h-[100px]">
            <CardContent className="py-3 sm:py-4 px-3 sm:px-6 h-full flex items-center">
              <div className="flex items-center gap-2 sm:gap-3 w-full">
                <div className="p-1.5 sm:p-2 rounded-lg bg-purple-500/10">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Aktivitas Investasi</p>
                  <p className="text-lg sm:text-xl font-bold text-purple-600">{statistics.investingItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200 min-h-[80px] sm:min-h-[100px]">
            <CardContent className="py-3 sm:py-4 px-3 sm:px-6 h-full flex items-center">
              <div className="flex items-center gap-2 sm:gap-3 w-full">
                <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10">
                  <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Aktivitas Pendanaan</p>
                  <p className="text-lg sm:text-xl font-bold text-green-600">{statistics.financingItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary Cards */}
      {cashFlow && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 min-h-[80px] sm:min-h-[100px]">
            <CardContent className="py-3 sm:py-4 px-3 sm:px-6 h-full flex items-center">
              <div className="flex items-center gap-2 sm:gap-3 w-full">
                <Wallet className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Saldo Awal</p>
                  <p className="text-sm sm:text-xl font-bold text-blue-600 truncate">{formatCurrency(cashFlow.openingBalance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`${cashFlow.netCashFlow >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800'} min-h-[80px] sm:min-h-[100px]`}>
            <CardContent className="py-3 sm:py-4 px-3 sm:px-6 h-full flex items-center">
              <div className="flex items-center gap-2 sm:gap-3 w-full">
                {cashFlow.netCashFlow >= 0 ? (
                  <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600 flex-shrink-0" />
                ) : (
                  <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-rose-600 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Perubahan Kas</p>
                  <p className={`text-sm sm:text-xl font-bold truncate ${cashFlow.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(cashFlow.netCashFlow)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 min-h-[80px] sm:min-h-[100px]">
            <CardContent className="py-3 sm:py-4 px-3 sm:px-6 h-full flex items-center">
              <div className="flex items-center gap-2 sm:gap-3 w-full">
                <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Saldo Akhir</p>
                  <p className="text-sm sm:text-xl font-bold text-purple-600 truncate">{formatCurrency(cashFlow.closingBalance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="min-h-[80px] sm:min-h-[100px]">
            <CardContent className="py-3 sm:py-4 px-3 sm:px-6 h-full flex items-center">
              <div className="text-[10px] sm:text-sm space-y-0.5 sm:space-y-1 w-full">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Operasi:</span>
                  <span className={cashFlow.operating.netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {formatCurrency(cashFlow.operating.netFlow)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Investasi:</span>
                  <span className={cashFlow.investing.netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {formatCurrency(cashFlow.investing.netFlow)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pendanaan:</span>
                  <span className={cashFlow.financing.netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {formatCurrency(cashFlow.financing.netFlow)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash Flow Sections */}
      {cashFlow && (
        <>
          {renderCategorySection(
            'Arus Kas dari Aktivitas Operasi',
            <Banknote className="h-5 w-5 text-amber-600" />,
            cashFlow.operating,
            'bg-amber-50 dark:bg-amber-900/20'
          )}

          {renderCategorySection(
            'Arus Kas dari Aktivitas Investasi',
            <CreditCard className="h-5 w-5 text-blue-600" />,
            cashFlow.investing,
            'bg-blue-50 dark:bg-blue-900/20'
          )}

          {renderCategorySection(
            'Arus Kas dari Aktivitas Pendanaan',
            <Coins className="h-5 w-5 text-purple-600" />,
            cashFlow.financing,
            'bg-purple-50 dark:bg-purple-900/20'
          )}

          {/* Summary */}
          <Card className="border-2 border-primary/20">
            <CardHeader className="py-3 sm:py-4 px-3 sm:px-6 bg-primary/5">
              <CardTitle className="text-sm sm:text-base">Ringkasan Arus Kas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-xs sm:text-sm p-2 sm:p-4">Kenaikan (Penurunan) Kas Bersih</TableCell>
                      <TableCell className={`text-right font-bold text-xs sm:text-sm p-2 sm:p-4 ${cashFlow.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(cashFlow.netCashFlow)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-xs sm:text-sm p-2 sm:p-4">Saldo Kas Awal Periode</TableCell>
                      <TableCell className="text-right font-mono text-xs sm:text-sm p-2 sm:p-4">{formatCurrency(cashFlow.openingBalance)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-primary/5 font-bold">
                      <TableCell className="text-xs sm:text-sm p-2 sm:p-4">Saldo Kas Akhir Periode</TableCell>
                      <TableCell className="text-right text-sm sm:text-lg p-2 sm:p-4">{formatCurrency(cashFlow.closingBalance)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {cashFlowItems.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 sm:py-12 text-center text-muted-foreground">
            <Wallet className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
            <p className="text-sm sm:text-base">Belum ada data arus kas untuk periode ini</p>
            <p className="text-xs sm:text-sm mt-2">Data akan muncul setelah ada transaksi simpanan, pinjaman, atau angsuran yang disetujui</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
