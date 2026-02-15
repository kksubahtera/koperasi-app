import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useCriticalSettings } from '@/hooks/useSettingsChangeLogs';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Download, FileSpreadsheet, Loader2, Coins, Users, Calendar, TrendingUp, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { QuickEquationGuide } from './QuickEquationGuide';

interface MemberInterestDetail {
  userId: string;
  memberName: string;
  memberNumber: string;
  openingBalance: number;
  depositsBeforeCutoff: number;
  eligibleBalance: number;
  interestRate: number;
  interestAmount: number;
}

interface MonthlyInterestReport {
  period: string;
  periodName: string;
  year: number;
  totalInterestExpense: number;
  memberCount: number;
  expenseEntryId: string;
}

export function InterestReportView() {
  const { settings: criticalSettings } = useCriticalSettings();
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState<MonthlyInterestReport[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [memberDetails, setMemberDetails] = useState<MemberInterestDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [memberCountByPeriod, setMemberCountByPeriod] = useState<Record<string, number>>({});

  // Fetch all closed periods from expense_entries and member counts
  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        // Fetch expense entries
        const { data: expenseEntries, error } = await supabase
          .from('expense_entries')
          .select('*')
          .eq('type', 'bunga_simpanan_sukarela')
          .order('date', { ascending: false });

        if (error) throw error;

        // Fetch member counts per period from interest_notifications
        const { data: notifications, error: notifError } = await supabase
          .from('interest_notifications')
          .select('period');

        if (notifError) throw notifError;

        // Count members per period
        const countMap: Record<string, number> = {};
        (notifications || []).forEach(n => {
          countMap[n.period] = (countMap[n.period] || 0) + 1;
        });
        setMemberCountByPeriod(countMap);

        const reportList: MonthlyInterestReport[] = (expenseEntries || []).map(entry => {
          // Extract period from description (format: "... - Bulan Tahun [YYYY-MM]")
          const periodMatch = entry.description.match(/\[(\d{4}-\d{2})\]/);
          const period = periodMatch ? periodMatch[1] : format(new Date(entry.date), 'yyyy-MM');
          const periodDate = new Date(period + '-01');
          
          return {
            period,
            periodName: format(periodDate, 'MMMM yyyy', { locale: localeId }),
            year: entry.year,
            totalInterestExpense: Number(entry.amount),
            memberCount: countMap[period] || 0,
            expenseEntryId: entry.id,
          };
        });

        setReports(reportList);
        
        if (reportList.length > 0 && !selectedPeriod) {
          setSelectedPeriod(reportList[0].period);
        }
      } catch (err) {
        console.error('Error fetching interest reports:', err);
        toast.error('Gagal memuat laporan bunga');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, []);

  // Fetch member details when period changes
  useEffect(() => {
    if (!selectedPeriod) return;

    const fetchMemberDetails = async () => {
      setLoadingDetails(true);
      try {
        // Get interest notifications for this period
        const { data: notifications, error: notifError } = await supabase
          .from('interest_notifications')
          .select('*')
          .eq('period', selectedPeriod);

        if (notifError) throw notifError;

        if (notifications && notifications.length > 0) {
          // Get member profiles for the user IDs
          const userIds = notifications.map(n => n.user_id);
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, name, member_number')
            .in('user_id', userIds);

          if (profilesError) throw profilesError;

          const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

          const details: MemberInterestDetail[] = notifications.map(notif => {
            const profile = profileMap.get(notif.user_id);
            return {
              userId: notif.user_id,
              memberName: profile?.name || 'Unknown',
              memberNumber: profile?.member_number || '-',
              openingBalance: 0, // Not stored in notifications
              depositsBeforeCutoff: 0, // Not stored in notifications
              eligibleBalance: Number(notif.eligible_balance),
              interestRate: Number(notif.interest_rate),
              interestAmount: Number(notif.interest_amount),
            };
          });

          setMemberDetails(details.sort((a, b) => b.interestAmount - a.interestAmount));
        } else {
          // If no notifications exist, try to recalculate
          setMemberDetails([]);
        }
      } catch (err) {
        console.error('Error fetching member details:', err);
        toast.error('Gagal memuat rincian anggota');
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchMemberDetails();
  }, [selectedPeriod]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleExportExcel = async () => {
    if (memberDetails.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const selectedReport = reports.find(r => r.period === selectedPeriod);
    const interestRate = criticalSettings?.simpananSukarelaInterestRate ?? 0.4;

    // Prepare data for Excel
    const excelData = memberDetails.map((member, idx) => ({
      'No': idx + 1,
      'No. Anggota': member.memberNumber,
      'Nama Anggota': member.memberName,
      'Saldo Eligible (Rp)': member.eligibleBalance,
      'Bunga (%)': member.interestRate,
      'Bunga Diterima (Rp)': member.interestAmount,
    }));

    // Add summary row
    const totalInterest = memberDetails.reduce((sum, m) => sum + m.interestAmount, 0);
    const totalEligible = memberDetails.reduce((sum, m) => sum + m.eligibleBalance, 0);
    
    excelData.push({
      'No': null as any,
      'No. Anggota': '',
      'Nama Anggota': 'TOTAL',
      'Saldo Eligible (Rp)': totalEligible,
      'Bunga (%)': interestRate,
      'Bunga Diterima (Rp)': totalInterest,
    });

    // Create summary sheet data
    const summaryData = [
      { 'Keterangan': 'Periode', 'Nilai': selectedReport?.periodName || selectedPeriod },
      { 'Keterangan': 'Jumlah Anggota', 'Nilai': memberDetails.length },
      { 'Keterangan': 'Tingkat Bunga', 'Nilai': `${interestRate}%` },
      { 'Keterangan': 'Total Saldo Eligible', 'Nilai': formatCurrency(totalEligible) },
      { 'Keterangan': 'Total Bunga Dibayar', 'Nilai': formatCurrency(totalInterest) },
      { 'Keterangan': 'Tanggal Cetak', 'Nilai': format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeId }) },
    ];

    // Save file
    const fileName = `Laporan_Bunga_Simpanan_${selectedPeriod}.xlsx`;
    await createAndDownloadExcelFromJson([
      { name: 'Rincian Bunga', data: excelData },
      { name: 'Ringkasan', data: summaryData },
    ], fileName);
    toast.success('Laporan berhasil diekspor ke Excel');
  };

  const handleExportAllPeriods = async () => {
    if (reports.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    toast.info('Menyiapkan laporan semua periode...');

    try {
      const allData: any[] = [];

      // Fetch all notifications
      const { data: allNotifications, error: notifError } = await supabase
        .from('interest_notifications')
        .select('*')
        .order('period', { ascending: false });

      if (notifError) throw notifError;

      // Get all unique user IDs
      const userIds = [...new Set(allNotifications?.map(n => n.user_id) || [])];
      
      // Fetch all profiles at once
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Process all notifications
      (allNotifications || []).forEach(notif => {
        const profile = profileMap.get(notif.user_id);
        allData.push({
          'Periode': notif.period_name,
          'No. Anggota': profile?.member_number || '-',
          'Nama Anggota': profile?.name || 'Unknown',
          'Saldo Eligible (Rp)': Number(notif.eligible_balance),
          'Bunga (%)': Number(notif.interest_rate),
          'Bunga Diterima (Rp)': Number(notif.interest_amount),
        });
      });

      if (allData.length === 0) {
        toast.error('Tidak ada data bunga tersedia');
        return;
      }

      // Create summary per period
      const periodSummary = reports.map(r => ({
        'Periode': r.periodName,
        'Total Bunga (Rp)': r.totalInterestExpense,
      }));

      // Save file
      await createAndDownloadExcelFromJson([
        { name: 'Semua Periode', data: allData },
        { name: 'Ringkasan Per Periode', data: periodSummary },
      ], `Laporan_Bunga_Simpanan_Semua_Periode.xlsx`);
      toast.success('Laporan semua periode berhasil diekspor');
    } catch (err) {
      console.error('Error exporting all periods:', err);
      toast.error('Gagal mengekspor laporan');
    }
  };

  const selectedReport = reports.find(r => r.period === selectedPeriod);
  const totalInterest = memberDetails.reduce((sum, m) => sum + m.interestAmount, 0);
  const totalEligible = memberDetails.reduce((sum, m) => sum + m.eligibleBalance, 0);
  const avgInterest = memberDetails.length > 0 ? totalInterest / memberDetails.length : 0;

  // Prepare chart data - sorted by period ascending
  const chartData = useMemo(() => {
    return [...reports]
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(report => {
        const count = memberCountByPeriod[report.period] || report.memberCount;
        const avgBunga = count > 0 ? report.totalInterestExpense / count : 0;
        return {
          period: report.period,
          periodName: format(new Date(report.period + '-01'), 'MMM yy', { locale: localeId }),
          totalBunga: report.totalInterestExpense,
          jumlahAnggota: count,
          rataRataBunga: Math.round(avgBunga),
          fullPeriodName: report.periodName,
        };
      });
  }, [reports, memberCountByPeriod]);

  const formatChartCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}jt`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}rb`;
    }
    return value.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-medium text-sm">{data.fullPeriodName}</p>
          {payload.map((entry: any, index: number) => {
            let label = '';
            let value = '';
            if (entry.name === 'totalBunga') {
              label = 'Total Bunga';
              value = formatCurrency(entry.value);
            } else if (entry.name === 'jumlahAnggota') {
              label = 'Jumlah Anggota';
              value = entry.value + ' orang';
            } else if (entry.name === 'rataRataBunga') {
              label = 'Rata-rata Bunga';
              value = formatCurrency(entry.value);
            }
            return (
              <p key={index} className="text-sm mt-1" style={{ color: entry.color }}>
                {label}: {value}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">Belum Ada Data</h3>
          <p className="text-sm text-muted-foreground text-center max-w-xs mt-2">
            Belum ada tutup buku bulanan yang dilakukan. Jalankan tutup buku untuk membuat laporan bunga.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <QuickEquationGuide variant="interest-report" />
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Laporan Bunga Simpanan Sukarela</h3>
            <p className="text-sm text-muted-foreground">{reports.length} periode tersedia</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Pilih periode" />
            </SelectTrigger>
            <SelectContent>
              {reports.map(report => (
                <SelectItem key={report.period} value={report.period}>
                  {report.periodName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={handleExportExcel} title="Export periode ini">
            <Download className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleExportAllPeriods} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Semua</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Periode</span>
            </div>
            <p className="text-lg font-semibold mt-1">{selectedReport?.periodName}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Jumlah Anggota</span>
            </div>
            <p className="text-lg font-semibold mt-1">{memberDetails.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Saldo Eligible</span>
            </div>
            <p className="text-lg font-semibold mt-1">{formatCurrency(totalEligible)}</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Bunga</span>
            </div>
            <p className="text-lg font-semibold mt-1 text-primary">{formatCurrency(totalInterest)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Interest Trend Chart */}
          <Card>
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Tren Bunga Simpanan Sukarela
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBunga" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="periodName" 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tickFormatter={formatChartCurrency}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                      width={55}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="totalBunga"
                      name="totalBunga"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#colorBunga)"
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5, stroke: 'hsl(var(--primary))', strokeWidth: 2, fill: 'hsl(var(--background))' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span>Total Bunga per Bulan</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Member Count Chart */}
          <Card>
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                Jumlah Anggota Penerima Bunga
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAnggota" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis 
                      dataKey="periodName" 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                      width={35}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="jumlahAnggota"
                      name="jumlahAnggota"
                      fill="url(#colorAnggota)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-600" />
                  <span>Jumlah Anggota per Bulan</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average Interest Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-600" />
                Rata-rata Bunga per Anggota
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRataRata" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="periodName" 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tickFormatter={formatChartCurrency}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                      width={55}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="rataRataBunga"
                      name="rataRataBunga"
                      stroke="hsl(45, 93%, 47%)"
                      strokeWidth={2}
                      fill="url(#colorRataRata)"
                      dot={{ fill: 'hsl(45, 93%, 47%)', strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5, stroke: 'hsl(45, 93%, 47%)', strokeWidth: 2, fill: 'hsl(var(--background))' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Rata-rata Bunga per Anggota</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Member Details Table */}
      <Card>
        <CardHeader className="py-3 border-b">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Rincian Per Anggota</span>
            {loadingDetails && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">No</TableHead>
                  <TableHead>No. Anggota</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="text-right">Saldo Eligible</TableHead>
                  <TableHead className="text-center">Bunga</TableHead>
                  <TableHead className="text-right">Bunga Diterima</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberDetails.length === 0 && !loadingDetails ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Tidak ada data rincian untuk periode ini
                    </TableCell>
                  </TableRow>
                ) : (
                  memberDetails.map((member, idx) => (
                    <TableRow key={member.userId}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {member.memberNumber}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{member.memberName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(member.eligibleBalance)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{member.interestRate}%</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        +{formatCurrency(member.interestAmount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {memberDetails.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={3} className="text-right">TOTAL</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalEligible)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-emerald-600">
                      +{formatCurrency(totalInterest)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
