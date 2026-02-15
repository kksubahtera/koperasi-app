import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';

interface HistoricalData {
  year: number;
  shuBruto: number;
  totalModal: number;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  danaCadangan: number;
}

interface SHUChartViewProps {
  historicalData: HistoricalData[];
  currentYear: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--info))', 'hsl(var(--success))'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const SHUChartView = ({ historicalData, currentYear }: SHUChartViewProps) => {
  // Prepare data for SHU trend chart
  const shuTrendData = historicalData.map(d => ({
    year: String(d.year),
    'SHU Bruto': d.shuBruto,
  }));

  // Prepare data for modal growth chart
  const modalGrowthData = historicalData.map(d => ({
    year: String(d.year),
    'Simpanan Pokok': d.simpananPokok,
    'Simpanan Wajib': d.simpananWajib,
    'Simpanan Sukarela': d.simpananSukarela,
    'Dana Cadangan': d.danaCadangan,
  }));

  // Prepare data for current year composition pie chart
  const currentYearData = historicalData.find(d => d.year === currentYear);
  const pieData = currentYearData ? [
    { name: 'Simpanan Pokok', value: currentYearData.simpananPokok },
    { name: 'Simpanan Wajib', value: currentYearData.simpananWajib },
    { name: 'Simpanan Sukarela', value: currentYearData.simpananSukarela },
    { name: 'Dana Cadangan', value: currentYearData.danaCadangan },
  ] : [];

  // Calculate growth percentages
  const getGrowthPercentage = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  const currentIdx = historicalData.findIndex(d => d.year === currentYear);
  const prevData = currentIdx > 0 ? historicalData[currentIdx - 1] : null;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">Grafik & Visualisasi</h2>
        <p className="text-muted-foreground">Tren SHU dan Pertumbuhan Modal</p>
      </div>

      {/* Growth Summary Cards */}
      {currentYearData && prevData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Pertumbuhan SHU</p>
              <p className="text-2xl font-bold text-primary">
                {getGrowthPercentage(currentYearData.shuBruto, prevData.shuBruto)}%
              </p>
              <p className="text-xs text-muted-foreground">vs tahun lalu</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Pertumbuhan Modal</p>
              <p className="text-2xl font-bold text-secondary">
                {getGrowthPercentage(currentYearData.totalModal, prevData.totalModal)}%
              </p>
              <p className="text-xs text-muted-foreground">vs tahun lalu</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Modal {currentYear}</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(currentYearData.totalModal)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">SHU {currentYear}</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(currentYearData.shuBruto)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* SHU Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              Tren SHU (3 Tahun Terakhir)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={shuTrendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="year" className="text-xs" />
                  <YAxis 
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}jt`}
                    className="text-xs"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="SHU Bruto" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Modal Composition Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="h-5 w-5 text-secondary" />
              Komposisi Modal {currentYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Growth Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-info" />
            Pertumbuhan Modal per Tahun
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modalGrowthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="year" className="text-xs" />
                <YAxis 
                  tickFormatter={(value) => `${(value / 1000000).toFixed(0)}jt`}
                  className="text-xs"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="Simpanan Pokok" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="Simpanan Wajib" stackId="a" fill="hsl(var(--secondary))" />
                <Bar dataKey="Simpanan Sukarela" stackId="a" fill="hsl(var(--accent))" />
                <Bar dataKey="Dana Cadangan" stackId="a" fill="hsl(var(--info))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Historis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Tahun</th>
                  <th className="text-right py-2 px-3 font-medium">SHU Bruto</th>
                  <th className="text-right py-2 px-3 font-medium">Total Modal</th>
                  <th className="text-right py-2 px-3 font-medium">Simpanan Pokok</th>
                  <th className="text-right py-2 px-3 font-medium">Simpanan Wajib</th>
                  <th className="text-right py-2 px-3 font-medium">Simpanan Sukarela</th>
                  <th className="text-right py-2 px-3 font-medium">Dana Cadangan</th>
                </tr>
              </thead>
              <tbody>
                {historicalData.map((data) => (
                  <tr key={data.year} className={`border-b ${data.year === currentYear ? 'bg-primary/5' : ''}`}>
                    <td className="py-2 px-3 font-medium">{data.year}</td>
                    <td className="text-right py-2 px-3">{formatCurrency(data.shuBruto)}</td>
                    <td className="text-right py-2 px-3">{formatCurrency(data.totalModal)}</td>
                    <td className="text-right py-2 px-3">{formatCurrency(data.simpananPokok)}</td>
                    <td className="text-right py-2 px-3">{formatCurrency(data.simpananWajib)}</td>
                    <td className="text-right py-2 px-3">{formatCurrency(data.simpananSukarela)}</td>
                    <td className="text-right py-2 px-3">{formatCurrency(data.danaCadangan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
