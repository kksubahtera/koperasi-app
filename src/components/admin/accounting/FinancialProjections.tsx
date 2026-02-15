import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useFinancialProjections } from '@/hooks/useFinancialProjections';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ReferenceLine, ComposedChart
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Target, Calculator, 
  ArrowUpRight, ArrowDownRight, Activity, Sparkles,
  Coins, Banknote
} from 'lucide-react';
import { RupiahIcon } from '@/components/ui/rupiah-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { QuickEquationGuide } from './QuickEquationGuide';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatCompact = (value: number) => {
  if (value >= 1000000000) {
    return `Rp ${(value / 1000000000).toFixed(1)}M`;
  } else if (value >= 1000000) {
    return `Rp ${(value / 1000000).toFixed(1)}Jt`;
  } else if (value >= 1000) {
    return `Rp ${(value / 1000).toFixed(1)}Rb`;
  }
  return `Rp ${value}`;
};

export const FinancialProjections = () => {
  const { language } = useThemeLanguage();
  const [projectionMonths, setProjectionMonths] = useState(6);
  const { data, isLoading, error } = useFinancialProjections(projectionMonths);

  const t = {
    title: language === 'id' ? 'Proyeksi Keuangan' : 'Financial Projections',
    description: language === 'id' 
      ? 'Prediksi pendapatan dan pengeluaran berdasarkan data historis' 
      : 'Income and expense predictions based on historical data',
    projectionPeriod: language === 'id' ? 'Periode Proyeksi' : 'Projection Period',
    months: language === 'id' ? 'bulan' : 'months',
    overview: language === 'id' ? 'Ringkasan' : 'Overview',
    trends: language === 'id' ? 'Tren' : 'Trends',
    comparison: language === 'id' ? 'Perbandingan' : 'Comparison',
    income: language === 'id' ? 'Pendapatan' : 'Income',
    expense: language === 'id' ? 'Pengeluaran' : 'Expense',
    profit: language === 'id' ? 'Laba/Rugi' : 'Profit/Loss',
    projected: language === 'id' ? 'Proyeksi' : 'Projected',
    historical: language === 'id' ? 'Historis' : 'Historical',
    avgMonthlyIncome: language === 'id' ? 'Rata-rata Pendapatan Bulanan' : 'Avg Monthly Income',
    avgMonthlyExpense: language === 'id' ? 'Rata-rata Pengeluaran Bulanan' : 'Avg Monthly Expense',
    projectedTotal: language === 'id' ? 'Total Proyeksi' : 'Projected Total',
    growthRate: language === 'id' ? 'Tingkat Pertumbuhan' : 'Growth Rate',
    incomeGrowth: language === 'id' ? 'Pertumbuhan Pendapatan' : 'Income Growth',
    expenseGrowth: language === 'id' ? 'Pertumbuhan Pengeluaran' : 'Expense Growth',
    projectedProfit: language === 'id' ? 'Proyeksi Laba' : 'Projected Profit',
    noData: language === 'id' ? 'Belum ada data historis' : 'No historical data available'
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-3 sm:p-6">
                <Skeleton className="h-3 sm:h-4 w-16 sm:w-24 mb-2" />
                <Skeleton className="h-6 sm:h-8 w-20 sm:w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <Skeleton className="h-[250px] sm:h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6 text-center text-destructive text-sm">
          Error loading projections: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  const { statistics, combinedData, historicalData } = data || {
    statistics: {
      totalHistoricalIncome: 0,
      totalHistoricalExpense: 0,
      totalProjectedIncome: 0,
      totalProjectedExpense: 0,
      avgMonthlyIncome: 0,
      avgMonthlyExpense: 0,
      incomeGrowth: 0,
      expenseGrowth: 0,
      projectedProfit: 0
    },
    combinedData: [],
    historicalData: []
  };

  const hasData = historicalData && historicalData.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Reference Guide */}
      <QuickEquationGuide variant="projections" />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-1.5 sm:gap-2">
            <Sparkles className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
            {t.title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">{t.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground">{t.projectionPeriod}:</span>
          <Select 
            value={projectionMonths.toString()} 
            onValueChange={(v) => setProjectionMonths(Number(v))}
          >
            <SelectTrigger className="w-[100px] sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3" className="text-sm">3 {t.months}</SelectItem>
              <SelectItem value="6" className="text-sm">6 {t.months}</SelectItem>
              <SelectItem value="12" className="text-sm">12 {t.months}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <Activity className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <p className="text-sm sm:text-lg font-medium text-muted-foreground">{t.noData}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2">
              {language === 'id' 
                ? 'Tambahkan data pendapatan dan pengeluaran untuk melihat proyeksi'
                : 'Add income and expense data to see projections'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <span className="text-[10px] sm:text-sm font-medium text-muted-foreground truncate pr-1">{t.avgMonthlyIncome}</span>
                  <RupiahIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 shrink-0" />
                </div>
                <p className="text-base sm:text-2xl font-bold text-emerald-600 truncate">
                  {formatCompact(statistics.avgMonthlyIncome)}
                </p>
                <div className="flex items-center gap-0.5 sm:gap-1 mt-1.5 sm:mt-2 text-[10px] sm:text-sm">
                  {statistics.incomeGrowth >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 text-destructive shrink-0" />
                  )}
                  <span className={statistics.incomeGrowth >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                    {statistics.incomeGrowth.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground hidden sm:inline">{t.growthRate}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-200 dark:border-rose-800">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <span className="text-[10px] sm:text-sm font-medium text-muted-foreground truncate pr-1">{t.avgMonthlyExpense}</span>
                  <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600 shrink-0" />
                </div>
                <p className="text-base sm:text-2xl font-bold text-rose-600 truncate">
                  {formatCompact(statistics.avgMonthlyExpense)}
                </p>
                <div className="flex items-center gap-0.5 sm:gap-1 mt-1.5 sm:mt-2 text-[10px] sm:text-sm">
                  {statistics.expenseGrowth <= 0 ? (
                    <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-destructive shrink-0" />
                  )}
                  <span className={statistics.expenseGrowth <= 0 ? 'text-emerald-600' : 'text-destructive'}>
                    {Math.abs(statistics.expenseGrowth).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground hidden sm:inline">{t.growthRate}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <span className="text-[10px] sm:text-sm font-medium text-muted-foreground truncate pr-1">{t.projectedTotal}</span>
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0" />
                </div>
                <p className="text-base sm:text-2xl font-bold text-blue-600 truncate">
                  {formatCompact(statistics.totalProjectedIncome)}
                </p>
                <p className="text-[10px] sm:text-sm text-muted-foreground mt-1.5 sm:mt-2 truncate">
                  {projectionMonths} {t.months} {t.income.toLowerCase()}
                </p>
              </CardContent>
            </Card>

            <Card className={`bg-gradient-to-br ${statistics.projectedProfit >= 0 
              ? 'from-primary/10 to-primary/5 border-primary/20' 
              : 'from-destructive/10 to-destructive/5 border-destructive/20'}`}>
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <span className="text-[10px] sm:text-sm font-medium text-muted-foreground truncate pr-1">{t.projectedProfit}</span>
                  <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                </div>
                <p className={`text-base sm:text-2xl font-bold truncate ${statistics.projectedProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCompact(statistics.projectedProfit)}
                </p>
                <Badge variant={statistics.projectedProfit >= 0 ? 'default' : 'destructive'} className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs">
                  {statistics.projectedProfit >= 0 
                    ? (language === 'id' ? 'Laba' : 'Profit')
                    : (language === 'id' ? 'Rugi' : 'Loss')}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-9 sm:h-10">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">{t.overview}</TabsTrigger>
              <TabsTrigger value="trends" className="text-xs sm:text-sm">{t.trends}</TabsTrigger>
              <TabsTrigger value="comparison" className="text-xs sm:text-sm">{t.comparison}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-3 sm:mt-4">
              <Card>
                <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-3">
                  <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
                    {language === 'id' ? 'Tren Pendapatan & Pengeluaran' : 'Income & Expense Trends'}
                  </CardTitle>
                  <CardDescription className="text-[10px] sm:text-sm">
                    {language === 'id' 
                      ? 'Data historis dan proyeksi (area lebih terang = proyeksi)'
                      : 'Historical data and projections (lighter area indicates projections)'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                  <ResponsiveContainer width="100%" height={280} className="sm:!h-[400px]">
                    <ComposedChart data={combinedData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 9 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        tickFormatter={formatCompact}
                        tick={{ fontSize: 9 }}
                        width={50}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{ fontWeight: 'bold', fontSize: 12 }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: 11
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <ReferenceLine 
                        x={combinedData.find(d => d.isProjection)?.month} 
                        stroke="hsl(var(--muted-foreground))" 
                        strokeDasharray="5 5"
                        label={{ value: t.projected, position: 'top', fontSize: 10 }}
                      />
                      <defs>
                        <linearGradient id="incomeGradientMain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="expenseGradientMain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="income"
                        name={t.income}
                        fill="url(#incomeGradientMain)"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="expense"
                        name={t.expense}
                        fill="url(#expenseGradientMain)"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        fillOpacity={0.6}
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        name={t.profit}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#3b82f6', strokeWidth: 1, stroke: '#fff' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="mt-3 sm:mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <Card>
                  <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-3">
                    <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-emerald-600 text-sm sm:text-base">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                      {t.incomeGrowth}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-6">
                    <ResponsiveContainer width="100%" height={220} className="sm:!h-[300px]">
                      <AreaChart data={combinedData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fontSize: 8 }}
                          angle={-45}
                          textAnchor="end"
                          height={50}
                          interval="preserveStartEnd"
                        />
                        <YAxis tickFormatter={formatCompact} tick={{ fontSize: 9 }} width={45} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: 11 }} />
                        <defs>
                          <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="income"
                          name={t.income}
                          stroke="#10b981"
                          fill="url(#incomeGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-3">
                    <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-rose-600 text-sm sm:text-base">
                      <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
                      {t.expenseGrowth}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-6">
                    <ResponsiveContainer width="100%" height={220} className="sm:!h-[300px]">
                      <AreaChart data={combinedData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fontSize: 8 }}
                          angle={-45}
                          textAnchor="end"
                          height={50}
                          interval="preserveStartEnd"
                        />
                        <YAxis tickFormatter={formatCompact} tick={{ fontSize: 9 }} width={45} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: 11 }} />
                        <defs>
                          <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="expense"
                          name={t.expense}
                          stroke="#f43f5e"
                          fill="url(#expenseGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="comparison" className="mt-3 sm:mt-4">
              <Card>
                <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-3">
                  <CardTitle className="text-sm sm:text-base">
                    {language === 'id' ? 'Perbandingan Bulanan' : 'Monthly Comparison'}
                  </CardTitle>
                  <CardDescription className="text-[10px] sm:text-sm">
                    {language === 'id' 
                      ? 'Perbandingan pendapatan vs pengeluaran per bulan'
                      : 'Income vs expense comparison per month'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                  <ResponsiveContainer width="100%" height={280} className="sm:!h-[400px]">
                    <BarChart data={combinedData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 9 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        interval="preserveStartEnd"
                      />
                      <YAxis tickFormatter={formatCompact} tick={{ fontSize: 9 }} width={50} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: 11
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar 
                        dataKey="income" 
                        name={t.income} 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="expense" 
                        name={t.expense} 
                        fill="#f43f5e" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};
