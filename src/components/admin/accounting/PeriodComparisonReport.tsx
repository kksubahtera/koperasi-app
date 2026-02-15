import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, TrendingUp, TrendingDown, Minus, BarChart3, LineChart, AlertCircle } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart as RechartsLineChart, Line, Legend, Area, AreaChart, ComposedChart } from 'recharts';
import { usePeriodComparisonData, YearlyComparisonData } from '@/hooks/usePeriodComparisonData';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';
import { toast } from 'sonner';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatPercentage = (value: number) => {
  if (!isFinite(value) || isNaN(value)) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const PeriodComparisonReport = () => {
  const currentYear = new Date().getFullYear();
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
  
  const { loading, monthlyData, yearlyData, hasData } = usePeriodComparisonData(selectedYear);

  // Calculate period-over-period changes
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Chart configurations
  const chartConfig = {
    pendapatan: { label: 'Pendapatan', color: 'hsl(var(--chart-1))' },
    biaya: { label: 'Biaya', color: 'hsl(var(--chart-2))' },
    labaRugi: { label: 'Laba/Rugi', color: 'hsl(var(--chart-3))' },
    simpananPokok: { label: 'Simp. Pokok', color: 'hsl(var(--chart-4))' },
    simpananWajib: { label: 'Simp. Wajib', color: 'hsl(var(--chart-5))' },
    simpananSukarela: { label: 'Simp. Sukarela', color: 'hsl(var(--primary))' },
    totalSimpanan: { label: 'Total Simpanan', color: 'hsl(var(--chart-1))' },
    shu: { label: 'SHU', color: 'hsl(var(--chart-3))' },
  };

  const renderTrendIcon = (change: number) => {
    if (change > 2) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < -2) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const handleExportExcel = async () => {
    if (viewMode === 'monthly') {
      const wsData = monthlyData.map((m, idx) => ({
        'Bulan': MONTH_NAMES[idx],
        'Pendapatan': m.pendapatan,
        'Biaya': m.biaya,
        'Laba/Rugi': m.labaRugi,
        'Simpanan Pokok': m.simpananPokok,
        'Simpanan Wajib': m.simpananWajib,
        'Simpanan Sukarela': m.simpananSukarela,
        'Piutang': m.pinjaman,
      }));
      await createAndDownloadExcelFromJson(
        [{ name: `Data Bulanan ${selectedYear}`, data: wsData }],
        `Laporan_Perbandingan_${selectedYear}.xlsx`
      );
    } else {
      const wsData = yearlyData.map(y => ({
        'Tahun': y.year,
        'Pendapatan': y.pendapatan,
        'Biaya': y.biaya,
        'Laba/Rugi': y.labaRugi,
        'Simpanan Pokok': y.simpananPokok,
        'Simpanan Wajib': y.simpananWajib,
        'Simpanan Sukarela': y.simpananSukarela,
        'Total Simpanan': y.totalSimpanan,
        'Piutang': y.piutang,
        'SHU': y.shu,
      }));
      await createAndDownloadExcelFromJson(
        [{ name: 'Perbandingan Tahunan', data: wsData }],
        `Laporan_Perbandingan_Tahunan.xlsx`
      );
    }
    
    toast.success('Data berhasil diekspor ke Excel');
  };

  const renderChart = (data: any[], xKey: string, dataKeys: string[]) => {
    const ChartComponent = chartType === 'bar' ? ComposedChart : (chartType === 'line' ? RechartsLineChart : AreaChart);
    
    // Check if all data is zero
    const allZero = data.every(d => dataKeys.every(key => d[key] === 0));
    
    if (allZero) {
      return (
        <div className="h-[350px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Belum ada data untuk periode ini</p>
          </div>
        </div>
      );
    }
    
    return (
      <ChartContainer config={chartConfig} className="h-[350px] w-full">
        <ChartComponent data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis 
            className="text-xs" 
            tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(0)}jt` : `${(value / 1000).toFixed(0)}rb`}
          />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
          <Legend />
          {dataKeys.map((key, idx) => {
            const color = chartConfig[key as keyof typeof chartConfig]?.color || `hsl(var(--chart-${idx + 1}))`;
            if (chartType === 'bar') {
              return <Bar key={key} dataKey={key} fill={color} radius={4} name={chartConfig[key as keyof typeof chartConfig]?.label || key} />;
            } else if (chartType === 'line') {
              return <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={{ r: 4 }} name={chartConfig[key as keyof typeof chartConfig]?.label || key} />;
            } else {
              return <Area key={key} type="monotone" dataKey={key} fill={color} fillOpacity={0.3} stroke={color} name={chartConfig[key as keyof typeof chartConfig]?.label || key} />;
            }
          })}
        </ChartComponent>
      </ChartContainer>
    );
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Skeleton className="h-6 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Laporan Perbandingan Keuangan</h2>
          <p className="text-sm text-muted-foreground">Analisis tren keuangan antar periode</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'monthly' | 'yearly')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Bulanan</SelectItem>
              <SelectItem value="yearly">Tahunan</SelectItem>
            </SelectContent>
          </Select>
          
          {viewMode === 'monthly' && (
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <div className="flex border rounded-lg overflow-hidden">
            <Button 
              variant={chartType === 'bar' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setChartType('bar')}
              className="rounded-none"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button 
              variant={chartType === 'line' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setChartType('line')}
              className="rounded-none"
            >
              <LineChart className="h-4 w-4" />
            </Button>
          </div>
          
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Empty data warning */}
      {!hasData && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Belum Ada Data Keuangan</AlertTitle>
          <AlertDescription>
            Data keuangan untuk periode ini masih kosong. Laporan perbandingan akan menampilkan data setelah ada transaksi, 
            entri pendapatan/biaya, atau simpanan yang tercatat di sistem.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="pendapatan-biaya" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 rounded-lg">
          <TabsTrigger 
            value="pendapatan-biaya"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 rounded-md px-4 py-2 transition-all"
          >
            Pendapatan & Biaya
          </TabsTrigger>
          <TabsTrigger 
            value="simpanan"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 rounded-md px-4 py-2 transition-all"
          >
            Simpanan
          </TabsTrigger>
          <TabsTrigger 
            value="ringkasan"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 rounded-md px-4 py-2 transition-all"
          >
            Ringkasan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendapatan-biaya" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Tren Pendapatan & Biaya {viewMode === 'monthly' ? `Tahun ${selectedYear}` : '3 Tahun Terakhir'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewMode === 'monthly' 
                ? renderChart(monthlyData, 'monthName', ['pendapatan', 'biaya', 'labaRugi'])
                : renderChart(yearlyData.map(y => ({ ...y, yearStr: String(y.year) })), 'yearStr', ['pendapatan', 'biaya', 'labaRugi'])
              }
            </CardContent>
          </Card>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detail Perbandingan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{viewMode === 'monthly' ? 'Bulan' : 'Tahun'}</TableHead>
                      <TableHead className="text-right">Pendapatan</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                      <TableHead className="text-right">Biaya</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                      <TableHead className="text-right">Laba/Rugi</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(viewMode === 'monthly' ? monthlyData : yearlyData).map((item, idx, arr) => {
                      const prev = idx > 0 ? arr[idx - 1] : null;
                      const pendapatanChange = prev ? calculateChange(item.pendapatan, prev.pendapatan) : 0;
                      const biayaChange = prev ? calculateChange(item.biaya, prev.biaya) : 0;
                      const labaRugiChange = prev ? calculateChange(item.labaRugi, prev.labaRugi) : 0;
                      
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {viewMode === 'monthly' ? MONTH_NAMES[idx] : (item as YearlyComparisonData).year}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.pendapatan)}</TableCell>
                          <TableCell className="text-right">
                            {idx > 0 && (
                              <span className="flex items-center justify-end gap-1">
                                {renderTrendIcon(pendapatanChange)}
                                <span className={pendapatanChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {formatPercentage(pendapatanChange)}
                                </span>
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.biaya)}</TableCell>
                          <TableCell className="text-right">
                            {idx > 0 && (
                              <span className="flex items-center justify-end gap-1">
                                {renderTrendIcon(-biayaChange)}
                                <span className={biayaChange <= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {formatPercentage(biayaChange)}
                                </span>
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <span className={item.labaRugi >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatCurrency(item.labaRugi)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {idx > 0 && (
                              <span className="flex items-center justify-end gap-1">
                                {renderTrendIcon(labaRugiChange)}
                                <span className={labaRugiChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {formatPercentage(labaRugiChange)}
                                </span>
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simpanan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Tren Simpanan {viewMode === 'monthly' ? `Tahun ${selectedYear}` : '3 Tahun Terakhir'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewMode === 'monthly' 
                ? renderChart(monthlyData, 'monthName', ['simpananPokok', 'simpananWajib', 'simpananSukarela'])
                : renderChart(yearlyData.map(y => ({ ...y, yearStr: String(y.year) })), 'yearStr', ['simpananPokok', 'simpananWajib', 'simpananSukarela'])
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detail Simpanan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{viewMode === 'monthly' ? 'Bulan' : 'Tahun'}</TableHead>
                      <TableHead className="text-right">Simp. Pokok</TableHead>
                      <TableHead className="text-right">Simp. Wajib</TableHead>
                      <TableHead className="text-right">Simp. Sukarela</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Pertumbuhan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(viewMode === 'monthly' ? monthlyData : yearlyData).map((item, idx, arr) => {
                      const total = item.simpananPokok + item.simpananWajib + item.simpananSukarela;
                      const prev = idx > 0 ? arr[idx - 1] : null;
                      const prevTotal = prev ? prev.simpananPokok + prev.simpananWajib + prev.simpananSukarela : 0;
                      const change = prev ? calculateChange(total, prevTotal) : 0;
                      
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {viewMode === 'monthly' ? MONTH_NAMES[idx] : (item as YearlyComparisonData).year}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.simpananPokok)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.simpananWajib)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.simpananSukarela)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                          <TableCell className="text-right">
                            {idx > 0 && (
                              <Badge variant={change >= 0 ? 'default' : 'destructive'} className="gap-1">
                                {renderTrendIcon(change)}
                                {formatPercentage(change)}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ringkasan" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {viewMode === 'yearly' && yearlyData.length >= 2 && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pertumbuhan Pendapatan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {renderTrendIcon(calculateChange(yearlyData[2]?.pendapatan || 0, yearlyData[0]?.pendapatan || 0))}
                      <span className="text-2xl font-bold">
                        {formatPercentage(calculateChange(yearlyData[2]?.pendapatan || 0, yearlyData[0]?.pendapatan || 0))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">vs 2 tahun lalu</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pertumbuhan Simpanan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {renderTrendIcon(calculateChange(yearlyData[2]?.totalSimpanan || 0, yearlyData[0]?.totalSimpanan || 0))}
                      <span className="text-2xl font-bold">
                        {formatPercentage(calculateChange(yearlyData[2]?.totalSimpanan || 0, yearlyData[0]?.totalSimpanan || 0))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">vs 2 tahun lalu</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pertumbuhan SHU</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {renderTrendIcon(calculateChange(yearlyData[2]?.shu || 0, yearlyData[0]?.shu || 0))}
                      <span className="text-2xl font-bold">
                        {formatPercentage(calculateChange(yearlyData[2]?.shu || 0, yearlyData[0]?.shu || 0))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">vs 2 tahun lalu</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Rasio Biaya</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {yearlyData[2]?.pendapatan > 0 
                          ? ((yearlyData[2].biaya / yearlyData[2].pendapatan) * 100).toFixed(1) 
                          : '0'}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Biaya / Pendapatan</p>
                  </CardContent>
                </Card>
              </>
            )}

            {viewMode === 'monthly' && monthlyData.length >= 2 && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendapatan {selectedYear}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency(monthlyData.reduce((sum, m) => sum + m.pendapatan, 0))}
                    </span>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Biaya {selectedYear}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold text-red-600">
                      {formatCurrency(monthlyData.reduce((sum, m) => sum + m.biaya, 0))}
                    </span>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Laba Bersih {selectedYear}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold">
                      {formatCurrency(monthlyData.reduce((sum, m) => sum + m.labaRugi, 0))}
                    </span>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Bulan Terbaik</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold">
                      {monthlyData.some(m => m.labaRugi > 0) 
                        ? MONTH_NAMES[monthlyData.reduce((maxIdx, m, idx, arr) => m.labaRugi > arr[maxIdx].labaRugi ? idx : maxIdx, 0)]
                        : '-'
                      }
                    </span>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Year over Year Comparison */}
          {viewMode === 'yearly' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Perbandingan Tahunan</CardTitle>
              </CardHeader>
              <CardContent>
                {renderChart(yearlyData.map(y => ({ ...y, yearStr: String(y.year) })), 'yearStr', ['totalSimpanan', 'shu'])}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
