import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend,
  ComposedChart
} from 'recharts';
import { useDashboardFinancialData } from '@/hooks/useDashboardFinancialData';
import { useSavingsGrowthByType } from '@/hooks/useSavingsGrowthByType';
import { TrendingUp, PieChart as PieChartIcon, BarChart3, Users, Loader2, Wallet, Calendar } from 'lucide-react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatShort = (value: number) => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}M`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}jt`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}rb`;
  return value.toString();
};

export const FinancialCharts = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  // Generate year options (current year and 4 years back)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  const {
    loading,
    monthlyTrends,
    savingsComposition,
    loanStatus,
    memberStats,
    yearlyComparison,
  } = useDashboardFinancialData();

  const {
    loading: savingsGrowthLoading,
    savingsGrowthByType,
    totals: savingsGrowthTotals,
  } = useSavingsGrowthByType(selectedYear);

  const chartConfig = {
    pendapatan: { label: 'Pendapatan', color: 'hsl(var(--chart-1))' },
    biaya: { label: 'Biaya', color: 'hsl(var(--chart-2))' },
    simpanan: { label: 'Simpanan', color: 'hsl(var(--chart-3))' },
    pinjaman: { label: 'Pinjaman', color: 'hsl(var(--chart-4))' },
    shu: { label: 'SHU', color: 'hsl(var(--chart-5))' },
    pokok: { label: 'Simpanan Pokok', color: 'hsl(var(--chart-1))' },
    wajib: { label: 'Simpanan Wajib', color: 'hsl(var(--chart-2))' },
    sukarela: { label: 'Simpanan Sukarela', color: 'hsl(var(--chart-3))' },
  };

  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="font-medium text-foreground mb-2">{label}</p>
        {payload.map((item: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{item.name}:</span>
            <span className="font-medium">{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Memuat data keuangan...</span>
      </div>
    );
  }

  // Check if there's any data
  const hasData = monthlyTrends.length > 0 || savingsComposition.some(s => s.value > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Belum Ada Data</h3>
        <p className="text-muted-foreground max-w-md">
          Grafik akan ditampilkan setelah ada transaksi simpanan, pinjaman, atau jurnal keuangan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Data Source Info */}
      <div className="rounded-lg border border-success/30 bg-success/5 p-2.5 sm:p-3 text-xs sm:text-sm text-muted-foreground">
        <strong className="text-success">✓ Data Real:</strong> Grafik menampilkan data dari database.
      </div>

      {/* Main Charts Grid - Stack on mobile */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Monthly Trend Chart */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <CardTitle className="text-sm sm:text-base md:text-lg truncate">Tren Pendapatan & Biaya {currentYear}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6 pt-0">
            <ChartContainer config={chartConfig} className="h-[180px] sm:h-[220px] md:h-[260px] w-full">
              <ComposedChart data={monthlyTrends} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={formatShort} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 8 }} width={32} />
                <ChartTooltip content={renderCustomTooltip} />
                <Legend 
                  formatter={(value) => <span className="text-[9px] sm:text-[10px] text-foreground">{value}</span>}
                  wrapperStyle={{ paddingTop: '4px', fontSize: '9px' }}
                />
                <Bar dataKey="pendapatan" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} name="Pendapatan" isAnimationActive={false} />
                <Bar dataKey="biaya" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} name="Biaya" isAnimationActive={false} />
                <Line type="monotone" dataKey="simpanan" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name="Simpanan" isAnimationActive={false} />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Yearly Comparison */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <CardTitle className="text-sm sm:text-base md:text-lg truncate">Perbandingan 3 Tahun</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6 pt-0">
            <ChartContainer config={chartConfig} className="h-[180px] sm:h-[220px] md:h-[260px] w-full">
              <BarChart data={yearlyComparison} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="year" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                <YAxis tickFormatter={formatShort} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 8 }} width={32} />
                <ChartTooltip content={renderCustomTooltip} />
                <Legend 
                  formatter={(value) => <span className="text-[9px] sm:text-[10px] text-foreground">{value}</span>}
                  wrapperStyle={{ paddingTop: '4px', fontSize: '9px' }}
                />
                <Bar dataKey="pendapatan" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} name="Pendapatan" isAnimationActive={false} />
                <Bar dataKey="biaya" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} name="Biaya" isAnimationActive={false} />
                <Bar dataKey="shu" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} name="SHU" isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Pie Charts Row - 2 columns on tablet, 3 on desktop, stack on mobile */}
      <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Savings Composition */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <CardTitle className="text-sm sm:text-base truncate">Komposisi Simpanan</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="h-[120px] sm:h-[140px] md:h-[150px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={savingsComposition}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={45}
                    paddingAngle={2}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {savingsComposition.map((entry, index) => (
                      <Cell key={`savings-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', fontSize: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5 border-t pt-2">
              {savingsComposition.map((item, idx) => (
                <div key={`savings-legend-${idx}`} className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-foreground font-medium truncate">{item.name}</span>
                  </div>
                  <span className="font-semibold text-foreground shrink-0 ml-2">{formatShort(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Loan Status */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <CardTitle className="text-sm sm:text-base truncate">Status Pinjaman</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="h-[120px] sm:h-[140px] md:h-[150px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={loanStatus.length > 0 ? loanStatus : [{ name: 'Belum ada', value: 1, color: 'hsl(var(--muted))' }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={45}
                    paddingAngle={2}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {(loanStatus.length > 0 ? loanStatus : [{ name: 'Belum ada', value: 1, color: 'hsl(var(--muted))' }]).map((entry, index) => (
                      <Cell key={`loan-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    formatter={(value: number) => `${value} pinjaman`}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', fontSize: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5 border-t pt-2">
              {loanStatus.length > 0 ? loanStatus.map((item, idx) => (
                <div key={`loan-legend-${idx}`} className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-foreground font-medium truncate">{item.name}</span>
                  </div>
                  <span className="font-semibold text-foreground shrink-0 ml-2">{item.value}</span>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground text-center py-2">Belum ada data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Member Stats */}
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <CardTitle className="text-sm sm:text-base truncate">Statistik Anggota</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="h-[140px] sm:h-[160px] md:h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberStats} layout="vertical" margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} width={60} />
                  <ChartTooltip 
                    formatter={(value: number) => `${value} anggota`}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', fontSize: '10px' }}
                  />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    {memberStats.map((entry, index) => (
                      <Cell key={`member-cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Savings Growth by Type Chart */}
      <Card>
        <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <CardTitle className="text-sm sm:text-base md:text-lg truncate">Pertumbuhan Simpanan</CardTitle>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                <SelectTrigger className="w-[80px] sm:w-[100px] h-7 sm:h-8 text-xs sm:text-sm">
                  <SelectValue placeholder="Tahun" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            Kumulatif simpanan tahun {selectedYear}
          </p>
        </CardHeader>
        <CardContent className="p-2 sm:p-4 md:p-6 pt-0">
          {savingsGrowthLoading ? (
            <div className="flex items-center justify-center h-[180px] sm:h-[220px] md:h-[260px]">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="ml-2 text-xs text-muted-foreground">Memuat...</span>
            </div>
          ) : savingsGrowthByType.length === 0 || savingsGrowthTotals.total === 0 ? (
            <div className="flex flex-col items-center justify-center h-[180px] sm:h-[220px] md:h-[260px] text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-xs sm:text-sm text-muted-foreground">
                Belum ada transaksi simpanan di tahun {selectedYear}
              </p>
            </div>
          ) : (
            <>
              {/* Summary Cards - Compact on mobile */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
                <div className="rounded-lg bg-chart-1/10 p-2 text-center">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">Pokok</p>
                  <p className="text-xs sm:text-sm font-bold text-foreground">{formatShort(savingsGrowthTotals.pokok)}</p>
                </div>
                <div className="rounded-lg bg-chart-2/10 p-2 text-center">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">Wajib</p>
                  <p className="text-xs sm:text-sm font-bold text-foreground">{formatShort(savingsGrowthTotals.wajib)}</p>
                </div>
                <div className="rounded-lg bg-chart-3/10 p-2 text-center">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">Sukarela</p>
                  <p className="text-xs sm:text-sm font-bold text-foreground">{formatShort(savingsGrowthTotals.sukarela)}</p>
                </div>
              </div>
              <ChartContainer config={chartConfig} className="h-[180px] sm:h-[220px] md:h-[260px] w-full">
                <AreaChart data={savingsGrowthByType} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pokokGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="wajibGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="sukarelaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={formatShort} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 8 }} width={32} />
                  <ChartTooltip content={renderCustomTooltip} />
                  <Legend 
                    formatter={(value) => <span className="text-[9px] sm:text-[10px] text-foreground">{value}</span>}
                    wrapperStyle={{ paddingTop: '4px', fontSize: '9px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="pokok" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#pokokGradient)"
                    name="Simpanan Pokok"
                    isAnimationActive={false}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="wajib" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#wajibGradient)"
                    name="Simpanan Wajib"
                    isAnimationActive={false}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sukarela" 
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#sukarelaGradient)"
                    name="Simpanan Sukarela"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ChartContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* Savings Trend Area Chart */}
      <Card>
        <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
            <CardTitle className="text-sm sm:text-base md:text-lg truncate">Tren Simpanan vs Pinjaman {currentYear}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-4 md:p-6 pt-0">
          <ChartContainer config={chartConfig} className="h-[160px] sm:h-[200px] md:h-[240px] w-full">
            <AreaChart data={monthlyTrends} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="simpananGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pinjamanGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={formatShort} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 8 }} width={32} />
              <ChartTooltip content={renderCustomTooltip} />
              <Legend 
                formatter={(value) => <span className="text-[9px] sm:text-[10px] text-foreground">{value}</span>}
                wrapperStyle={{ paddingTop: '4px', fontSize: '9px' }}
              />
              <Area 
                type="monotone" 
                dataKey="simpanan" 
                stroke="hsl(var(--chart-3))" 
                fillOpacity={1} 
                fill="url(#simpananGradient)"
                name="Simpanan"
                isAnimationActive={false}
              />
              <Area 
                type="monotone" 
                dataKey="pinjaman" 
                stroke="hsl(var(--chart-4))" 
                fillOpacity={1} 
                fill="url(#pinjamanGradient)"
                name="Pinjaman"
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};
