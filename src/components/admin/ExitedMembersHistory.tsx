import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { 
  UserX, 
  Calendar, 
  CalendarClock, 
  Wallet,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  FileText,
  Download,
  UserCheck,
  Loader2,
  FileSpreadsheet,
  Filter,
  TrendingDown,
  TrendingUp,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDate, formatCurrency } from '@/lib/mockData';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResignationConfirmationLetter } from '@/components/shared/ResignationConfirmationLetter';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FilterSelect } from '@/components/ui/filter-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart
} from 'recharts';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';

interface ResignationRecord {
  id: string;
  user_id: string;
  reason: string;
  total_savings: number;
  simpanan_pokok: number;
  simpanan_wajib: number;
  simpanan_sukarela: number;
  remaining_loan_principal: number;
  total_penalties: number;
  total_arrears: number;
  refund_amount: number;
  status: string;
  processed_at: string | null;
  created_at: string;
  profile?: {
    name: string;
    member_number: string;
    email: string;
    phone: string;
    join_date: string;
    exit_date: string;
  };
}

export const ExitedMembersHistory = () => {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [letterData, setLetterData] = useState<ResignationRecord | null>(null);
  const [reactivatingMember, setReactivatingMember] = useState<ResignationRecord | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch all exited members - both from resignation requests AND manually deactivated profiles
  const { data: resignations = [], isLoading, refetch } = useQuery({
    queryKey: ['exited-members-history'],
    queryFn: async () => {
      // First, get all inactive profiles with exit_date
      const { data: inactiveProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, member_number, email, phone, join_date, exit_date, exit_year')
        .eq('is_active', false)
        .not('exit_date', 'is', null)
        .order('exit_date', { ascending: false });

      if (profilesError) throw profilesError;

      // Get resignation requests for these users
      const userIds = inactiveProfiles?.map(p => p.user_id) || [];
      const { data: resignationData, error: resignationError } = await supabase
        .from('resignation_requests')
        .select('*')
        .in('user_id', userIds)
        .eq('status', 'approved');

      if (resignationError) throw resignationError;

      // Create a map of resignation data by user_id
      const resignationMap = new Map(resignationData?.map(r => [r.user_id, r]) || []);

      // Merge data - use resignation data if available, otherwise create default record
      return (inactiveProfiles || []).map(profile => {
        const resignation = resignationMap.get(profile.user_id);
        
        if (resignation) {
          return {
            ...resignation,
            profile: {
              name: profile.name,
              member_number: profile.member_number,
              email: profile.email,
              phone: profile.phone,
              join_date: profile.join_date,
              exit_date: profile.exit_date,
            }
          };
        }
        
        // For manually deactivated members without resignation request
        return {
          id: profile.user_id,
          user_id: profile.user_id,
          reason: 'Dinonaktifkan oleh admin',
          total_savings: 0,
          simpanan_pokok: 0,
          simpanan_wajib: 0,
          simpanan_sukarela: 0,
          remaining_loan_principal: 0,
          total_penalties: 0,
          total_arrears: 0,
          refund_amount: 0,
          status: 'deactivated',
          processed_at: profile.exit_date,
          created_at: profile.exit_date || new Date().toISOString(),
          profile: {
            name: profile.name,
            member_number: profile.member_number,
            email: profile.email,
            phone: profile.phone,
            join_date: profile.join_date,
            exit_date: profile.exit_date,
          }
        } as ResignationRecord;
      });
    }
  });

  // Get unique years from resignations
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    resignations.forEach(r => {
      const processedDate = r.processed_at ? new Date(r.processed_at) : new Date(r.created_at);
      years.add(processedDate.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [resignations]);

  // Filter resignations by selected year and search query
  const filteredResignations = useMemo(() => {
    let filtered = resignations;

    // Filter by year
    if (selectedYear !== 'all') {
      const year = parseInt(selectedYear);
      filtered = filtered.filter(r => {
        const processedDate = r.processed_at ? new Date(r.processed_at) : new Date(r.created_at);
        return processedDate.getFullYear() === year;
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.profile?.name.toLowerCase().includes(query) ||
        r.profile?.member_number?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [resignations, selectedYear, searchQuery]);

  // Calculate totals based on filtered data
  const filteredTotalRefund = filteredResignations.reduce((sum, r) => sum + r.refund_amount, 0);
  const filteredTotalSavings = filteredResignations.reduce((sum, r) => sum + r.total_savings, 0);

  // Calculate totals for all data
  const totalRefundAmount = resignations.reduce((sum, r) => sum + r.refund_amount, 0);

  // Statistics data for charts
  const yearlyStats = useMemo(() => {
    const stats: Record<number, { year: number; count: number; totalSavings: number; totalRefund: number }> = {};
    
    resignations.forEach(r => {
      const processedDate = r.processed_at ? new Date(r.processed_at) : new Date(r.created_at);
      const year = processedDate.getFullYear();
      
      if (!stats[year]) {
        stats[year] = { year, count: 0, totalSavings: 0, totalRefund: 0 };
      }
      stats[year].count += 1;
      stats[year].totalSavings += r.total_savings;
      stats[year].totalRefund += r.refund_amount;
    });

    return Object.values(stats).sort((a, b) => a.year - b.year);
  }, [resignations]);

  // Monthly stats for selected year or current year
  const monthlyStats = useMemo(() => {
    const targetYear = selectedYear !== 'all' ? parseInt(selectedYear) : new Date().getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const stats = months.map((month, idx) => ({ month, count: 0, refund: 0 }));

    resignations.forEach(r => {
      const processedDate = r.processed_at ? new Date(r.processed_at) : new Date(r.created_at);
      if (processedDate.getFullYear() === targetYear) {
        const monthIdx = processedDate.getMonth();
        stats[monthIdx].count += 1;
        stats[monthIdx].refund += r.refund_amount;
      }
    });

    return stats;
  }, [resignations, selectedYear]);

  // Reason distribution
  const reasonStats = useMemo(() => {
    const reasons: Record<string, number> = {};
    
    filteredResignations.forEach(r => {
      const reason = r.reason.length > 30 ? r.reason.substring(0, 30) + '...' : r.reason;
      reasons[reason] = (reasons[reason] || 0) + 1;
    });

    return Object.entries(reasons)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredResignations]);

  // Colors for pie chart
  const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--info))'];

  // Average stats
  const avgRefundPerMember = resignations.length > 0 ? totalRefundAmount / resignations.length : 0;
  const avgSavingsPerMember = resignations.length > 0 
    ? resignations.reduce((sum, r) => sum + r.total_savings, 0) / resignations.length 
    : 0;

  // Year-over-year comparison stats
  const yearComparison = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const lastYear = thisYear - 1;

    const thisYearData = resignations.filter(r => {
      const processedDate = r.processed_at ? new Date(r.processed_at) : new Date(r.created_at);
      return processedDate.getFullYear() === thisYear;
    });

    const lastYearData = resignations.filter(r => {
      const processedDate = r.processed_at ? new Date(r.processed_at) : new Date(r.created_at);
      return processedDate.getFullYear() === lastYear;
    });

    const thisYearCount = thisYearData.length;
    const lastYearCount = lastYearData.length;
    const thisYearRefund = thisYearData.reduce((sum, r) => sum + r.refund_amount, 0);
    const lastYearRefund = lastYearData.reduce((sum, r) => sum + r.refund_amount, 0);
    const thisYearSavings = thisYearData.reduce((sum, r) => sum + r.total_savings, 0);
    const lastYearSavings = lastYearData.reduce((sum, r) => sum + r.total_savings, 0);
    const thisYearLoanDeduction = thisYearData.reduce((sum, r) => sum + r.remaining_loan_principal + r.total_penalties, 0);
    const lastYearLoanDeduction = lastYearData.reduce((sum, r) => sum + r.remaining_loan_principal + r.total_penalties, 0);

    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      thisYear,
      lastYear,
      count: {
        thisYear: thisYearCount,
        lastYear: lastYearCount,
        change: calcChange(thisYearCount, lastYearCount)
      },
      refund: {
        thisYear: thisYearRefund,
        lastYear: lastYearRefund,
        change: calcChange(thisYearRefund, lastYearRefund)
      },
      savings: {
        thisYear: thisYearSavings,
        lastYear: lastYearSavings,
        change: calcChange(thisYearSavings, lastYearSavings)
      },
      loanDeduction: {
        thisYear: thisYearLoanDeduction,
        lastYear: lastYearLoanDeduction,
        change: calcChange(thisYearLoanDeduction, lastYearLoanDeduction)
      },
      avgRefund: {
        thisYear: thisYearCount > 0 ? thisYearRefund / thisYearCount : 0,
        lastYear: lastYearCount > 0 ? lastYearRefund / lastYearCount : 0,
        change: calcChange(
          thisYearCount > 0 ? thisYearRefund / thisYearCount : 0,
          lastYearCount > 0 ? lastYearRefund / lastYearCount : 0
        )
      }
    };
  }, [resignations]);

  // Helper function to render change indicator
  const renderChangeIndicator = (change: number, inverseColors: boolean = false) => {
    const isPositive = change > 0;
    const isNegative = change < 0;
    const isNeutral = change === 0;

    // For resignations, more = bad (destructive), fewer = good (success)
    // inverseColors flips this logic for financial metrics
    let colorClass = 'text-muted-foreground';
    let bgClass = 'bg-muted';
    let Icon = Minus;

    if (isPositive) {
      colorClass = inverseColors ? 'text-success' : 'text-destructive';
      bgClass = inverseColors ? 'bg-success/10' : 'bg-destructive/10';
      Icon = ArrowUpRight;
    } else if (isNegative) {
      colorClass = inverseColors ? 'text-destructive' : 'text-success';
      bgClass = inverseColors ? 'bg-destructive/10' : 'bg-success/10';
      Icon = ArrowDownRight;
    }

    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${bgClass}`}>
        <Icon className={`h-3 w-3 ${colorClass}`} />
        <span className={`text-xs font-medium ${colorClass}`}>
          {isNeutral ? '0%' : `${Math.abs(change).toFixed(1)}%`}
        </span>
      </div>
    );
  };

  // Export to Excel
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const exportData = filteredResignations.map((r, index) => {
        const processedDate = r.processed_at ? new Date(r.processed_at) : new Date(r.created_at);
        return {
          'No': index + 1,
          'Nama Anggota': r.profile?.name || '-',
          'No. Anggota': r.profile?.member_number || '-',
          'Tanggal Bergabung': r.profile?.join_date ? formatDate(r.profile.join_date) : '-',
          'Tanggal Keluar': formatDate(processedDate.toISOString()),
          'Alasan': r.reason,
          'Simpanan Pokok': r.simpanan_pokok,
          'Simpanan Wajib': r.simpanan_wajib,
          'Simpanan Sukarela': r.simpanan_sukarela,
          'Total Simpanan': r.total_savings,
          'Sisa Pinjaman': r.remaining_loan_principal,
          'Total Denda': r.total_penalties,
          'Dana Dikembalikan': r.refund_amount,
        };
      });

      const fileName = selectedYear === 'all' 
        ? `riwayat-anggota-keluar-semua.xlsx`
        : `riwayat-anggota-keluar-${selectedYear}.xlsx`;

      await createAndDownloadExcelFromJson([
        { name: 'Riwayat Anggota Keluar', data: exportData, columns: [
          { width: 5 },
          { width: 25 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 30 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 18 },
        ]}
      ], fileName);
      
      toast({
        title: 'Export Berhasil',
        description: `Data ${filteredResignations.length} anggota berhasil diexport ke Excel.`,
      });
    } catch (error) {
      toast({
        title: 'Export Gagal',
        description: 'Terjadi kesalahan saat mengexport data.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleReactivate = async () => {
    if (!reactivatingMember) return;

    setIsReactivating(true);
    try {
      // Reactivate member profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_active: true,
          exit_date: null,
          exit_year: null
        })
        .eq('user_id', reactivatingMember.user_id);

      if (profileError) throw profileError;

      // Update resignation status to cancelled/reactivated
      const { error: resignationError } = await supabase
        .from('resignation_requests')
        .update({ status: 'reactivated' })
        .eq('id', reactivatingMember.id);

      if (resignationError) throw resignationError;

      toast({
        title: 'Anggota Diaktifkan Kembali',
        description: `${reactivatingMember.profile?.name} telah diaktifkan kembali sebagai anggota aktif.`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: 'Gagal Reaktivasi',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsReactivating(false);
      setReactivatingMember(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 py-4 sm:py-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Riwayat Anggota Keluar</h1>
        <p className="mt-1 text-sm sm:text-base text-muted-foreground">Data anggota yang telah mengundurkan diri dari koperasi</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{filteredResignations.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {selectedYear === 'all' ? 'Semua Tahun' : `Tahun ${selectedYear}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
                <UserX className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{resignations.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Semua</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-warning/10 shrink-0">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-2xl font-bold text-foreground truncate">
                  {formatCurrency(filteredTotalSavings)}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Simpanan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-success/10 shrink-0">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-2xl font-bold text-foreground truncate">
                  {formatCurrency(filteredTotalRefund)}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Dana Kembali</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Export */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 w-full sm:w-auto">
            {/* Year Filter */}
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <FilterSelect
                value={selectedYear}
                onValueChange={setSelectedYear}
                options={availableYears.map(year => ({ value: year.toString(), label: `Tahun ${year}` }))}
                placeholder="Pilih Tahun"
                allLabel="Semua Tahun"
                triggerClassName="w-full sm:w-[160px]"
                icon={Calendar}
              />
            {/* Search */}
            <SearchInput
              placeholder="Cari nama/no. anggota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="w-full sm:w-64"
            />
          </div>

          {/* Export Button */}
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={isExporting || filteredResignations.length === 0}
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Export Excel
          </Button>
        </div>
      </div>

      {/* Tabs for Data and Statistics */}
      <div className="w-full">
        <Tabs defaultValue="data" className="w-full">
          {/* Custom Tab Navigation with Button Group Styling */}
          <div className="mb-4 sm:mb-6">
            <TabsList className="inline-flex h-auto p-1 sm:p-1.5 bg-muted/50 rounded-lg sm:rounded-xl border border-border/50 gap-0.5 sm:gap-1 w-full sm:w-auto">
              <TabsTrigger 
                value="data" 
                className="
                  relative px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md sm:rounded-lg
                  transition-all duration-200 flex-1 sm:flex-none
                  data-[state=inactive]:bg-transparent 
                  data-[state=inactive]:text-muted-foreground 
                  data-[state=inactive]:hover:bg-muted 
                  data-[state=inactive]:hover:text-foreground
                  data-[state=active]:bg-primary 
                  data-[state=active]:text-primary-foreground 
                  data-[state=active]:shadow-lg 
                  data-[state=active]:shadow-primary/25
                  data-[state=active]:ring-2 
                  data-[state=active]:ring-primary/30
                  flex items-center justify-center gap-1.5 sm:gap-2
                "
              >
                <UserX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Data Anggota</span>
              </TabsTrigger>
              <TabsTrigger 
                value="statistics" 
                className="
                  relative px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md sm:rounded-lg
                  transition-all duration-200 flex-1 sm:flex-none
                  data-[state=inactive]:bg-transparent 
                  data-[state=inactive]:text-muted-foreground 
                  data-[state=inactive]:hover:bg-muted 
                  data-[state=inactive]:hover:text-foreground
                  data-[state=active]:bg-primary 
                  data-[state=active]:text-primary-foreground 
                  data-[state=active]:shadow-lg 
                  data-[state=active]:shadow-primary/25
                  data-[state=active]:ring-2 
                  data-[state=active]:ring-primary/30
                  flex items-center justify-center gap-1.5 sm:gap-2
                "
              >
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Statistik</span>
              </TabsTrigger>
            </TabsList>
          </div>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          {/* Statistics Summary Cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-info/10 shrink-0">
                    <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-info" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-2xl font-bold text-foreground">{yearlyStats.length}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Tahun Tercatat</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm sm:text-lg font-bold text-foreground truncate">{formatCurrency(avgRefundPerMember)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Rata-rata Kembali</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-warning/10 shrink-0">
                    <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm sm:text-lg font-bold text-foreground truncate">{formatCurrency(avgSavingsPerMember)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Rata-rata Simpanan</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-success/10 shrink-0">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-2xl font-bold text-foreground">
                      {yearlyStats.length > 0 ? Math.round(resignations.length / yearlyStats.length) : 0}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Rata-rata/Tahun</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Year-over-Year Comparison */}
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">Perbandingan {yearComparison.thisYear} vs {yearComparison.lastYear}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5">
                {/* Member Count Comparison */}
                <div className="rounded-lg border border-border p-2.5 sm:p-4 space-y-2 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Jumlah Keluar</span>
                    {renderChangeIndicator(yearComparison.count.change)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{yearComparison.thisYear}</span>
                      <span className="text-base sm:text-lg font-bold text-foreground">{yearComparison.count.thisYear}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{yearComparison.lastYear}</span>
                      <span className="text-xs sm:text-sm text-muted-foreground">{yearComparison.count.lastYear}</span>
                    </div>
                  </div>
                </div>

                {/* Total Savings Comparison */}
                <div className="rounded-lg border border-border p-2.5 sm:p-4 space-y-2 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Simpanan</span>
                    {renderChangeIndicator(yearComparison.savings.change)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{yearComparison.thisYear}</span>
                      <span className="text-xs sm:text-lg font-bold text-foreground truncate ml-1">{formatCurrency(yearComparison.savings.thisYear)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{yearComparison.lastYear}</span>
                      <span className="text-xs sm:text-sm text-muted-foreground truncate ml-1">{formatCurrency(yearComparison.savings.lastYear)}</span>
                    </div>
                  </div>
                </div>

                {/* Total Refund Comparison */}
                <div className="rounded-lg border border-border p-2.5 sm:p-4 space-y-2 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Dana Kembali</span>
                    {renderChangeIndicator(yearComparison.refund.change, true)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{yearComparison.thisYear}</span>
                      <span className="text-xs sm:text-lg font-bold text-foreground truncate ml-1">{formatCurrency(yearComparison.refund.thisYear)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{yearComparison.lastYear}</span>
                      <span className="text-xs sm:text-sm text-muted-foreground truncate ml-1">{formatCurrency(yearComparison.refund.lastYear)}</span>
                    </div>
                  </div>
                </div>

                {/* Loan Deduction Comparison */}
                <div className="rounded-lg border border-border p-2.5 sm:p-4 space-y-2 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Potongan</span>
                    {renderChangeIndicator(yearComparison.loanDeduction.change, true)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{yearComparison.thisYear}</span>
                      <span className="text-xs sm:text-lg font-bold text-foreground truncate ml-1">{formatCurrency(yearComparison.loanDeduction.thisYear)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{yearComparison.lastYear}</span>
                      <span className="text-xs sm:text-sm text-muted-foreground truncate ml-1">{formatCurrency(yearComparison.loanDeduction.lastYear)}</span>
                    </div>
                  </div>
                </div>

                {/* Average Refund Comparison */}
                <div className="rounded-lg border border-border p-2.5 sm:p-4 space-y-2 sm:space-y-3 col-span-2 lg:col-span-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Rata-rata</span>
                    {renderChangeIndicator(yearComparison.avgRefund.change, true)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{yearComparison.thisYear}</span>
                      <span className="text-xs sm:text-lg font-bold text-foreground truncate ml-1">{formatCurrency(yearComparison.avgRefund.thisYear)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{yearComparison.lastYear}</span>
                      <span className="text-xs sm:text-sm text-muted-foreground truncate ml-1">{formatCurrency(yearComparison.avgRefund.lastYear)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Yearly Trend Chart */}
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <TrendingDown className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">Tren Pengunduran Diri per Tahun</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {yearlyStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={yearlyStats}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="year" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number, name: string) => [
                          name === 'count' ? `${value} anggota` : formatCurrency(value),
                          name === 'count' ? 'Jumlah' : name === 'totalRefund' ? 'Dana Kembali' : 'Total Simpanan'
                        ]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorCount)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] sm:h-[250px] text-muted-foreground text-sm">
                    Tidak ada data untuk ditampilkan
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monthly Distribution Chart */}
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <BarChart3 className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">Distribusi Bulanan ({selectedYear === 'all' ? new Date().getFullYear() : selectedYear})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value} anggota`, 'Jumlah']}
                    />
                    <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Financial Trend Chart */}
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Wallet className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">Tren Dana Dikembalikan per Tahun</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {yearlyStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={yearlyStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="year" className="text-xs" tick={{ fontSize: 10 }} />
                      <YAxis 
                        className="text-xs" 
                        tickFormatter={(value) => `${(value / 1000000).toFixed(0)}jt`}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [formatCurrency(value), 'Dana Dikembalikan']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="totalRefund" 
                        stroke="hsl(var(--success))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--success))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] sm:h-[250px] text-muted-foreground text-sm">
                    Tidak ada data untuk ditampilkan
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reason Distribution Pie Chart */}
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <PieChart className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">Distribusi Alasan (Top 5)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                {reasonStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie
                        data={reasonStats}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={70}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {reasonStats.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`${value} anggota`, 'Jumlah']}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] sm:h-[250px] text-muted-foreground text-sm">
                    Tidak ada data untuk ditampilkan
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Yearly Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-primary" />
                Ringkasan per Tahun
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Tahun</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Jumlah Anggota</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Total Simpanan</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Dana Dikembalikan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyStats.map((stat) => (
                      <tr key={stat.year} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium text-foreground">{stat.year}</td>
                        <td className="py-3 px-4 text-right text-foreground">{stat.count}</td>
                        <td className="py-3 px-4 text-right text-foreground">{formatCurrency(stat.totalSavings)}</td>
                        <td className="py-3 px-4 text-right text-success font-medium">{formatCurrency(stat.totalRefund)}</td>
                      </tr>
                    ))}
                    {yearlyStats.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          Tidak ada data
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {yearlyStats.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/50 font-medium">
                        <td className="py-3 px-4 text-foreground">Total</td>
                        <td className="py-3 px-4 text-right text-foreground">{resignations.length}</td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {formatCurrency(yearlyStats.reduce((sum, s) => sum + s.totalSavings, 0))}
                        </td>
                        <td className="py-3 px-4 text-right text-success">
                          {formatCurrency(yearlyStats.reduce((sum, s) => sum + s.totalRefund, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="mt-6">
          {/* Member List */}
          <Card>
        <CardContent className="p-4">
          {filteredResignations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserX className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                {searchQuery 
                  ? 'Tidak ada anggota yang sesuai dengan pencarian'
                  : selectedYear === 'all'
                    ? 'Belum ada data anggota keluar'
                    : `Belum ada anggota keluar di tahun ${selectedYear}`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResignations.map((resignation) => {
                const isExpanded = expandedMember === resignation.id;
                const processedDate = resignation.processed_at 
                  ? new Date(resignation.processed_at) 
                  : new Date(resignation.created_at);

                return (
                  <Collapsible
                    key={resignation.id}
                    open={isExpanded}
                    onOpenChange={() => setExpandedMember(isExpanded ? null : resignation.id)}
                  >
                    <div className="rounded-lg border border-border bg-card overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <div className="flex flex-col gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                <span className="text-sm font-semibold text-muted-foreground">
                                  {resignation.profile?.name?.charAt(0) || '?'}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{resignation.profile?.name || 'Unknown'}</p>
                                <p className="text-sm text-muted-foreground">{resignation.profile?.member_number || '-'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="bg-success text-success-foreground">
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Selesai
                              </Badge>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                            <div>
                              <p className="text-muted-foreground">Bergabung</p>
                              <p className="font-medium text-foreground">
                                {resignation.profile?.join_date 
                                  ? formatDate(resignation.profile.join_date) 
                                  : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Tanggal Keluar</p>
                              <p className="font-medium text-foreground">
                                {formatDate(processedDate.toISOString())}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Simpanan</p>
                              <p className="font-medium text-foreground">
                                {formatCurrency(resignation.total_savings)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Dana Dikembalikan</p>
                              <p className="font-medium text-success">
                                {formatCurrency(resignation.refund_amount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t border-border p-4 bg-muted/20 space-y-4">
                          {/* Reason */}
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Alasan Pengunduran Diri</p>
                            <p className="text-sm text-foreground">{resignation.reason}</p>
                          </div>

                          {/* Financial Breakdown */}
                          <div>
                            <h4 className="flex items-center gap-2 font-medium text-foreground mb-3">
                              <Wallet className="h-4 w-4 text-primary" />
                              Rincian Pengembalian Dana
                            </h4>
                            
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-card">
                                <span className="text-muted-foreground">Simpanan Pokok</span>
                                <span className="font-medium text-foreground">{formatCurrency(resignation.simpanan_pokok)}</span>
                              </div>
                              <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-card">
                                <span className="text-muted-foreground">Simpanan Wajib</span>
                                <span className="font-medium text-foreground">{formatCurrency(resignation.simpanan_wajib)}</span>
                              </div>
                              <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-card">
                                <span className="text-muted-foreground">Simpanan Sukarela</span>
                                <span className="font-medium text-foreground">{formatCurrency(resignation.simpanan_sukarela)}</span>
                              </div>
                              <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
                                <span className="font-medium text-foreground">Total Simpanan</span>
                                <span className="font-bold text-primary">{formatCurrency(resignation.total_savings)}</span>
                              </div>

                              {/* Deductions */}
                              {(resignation.remaining_loan_principal > 0 || resignation.total_penalties > 0) && (
                                <>
                                  <div className="border-t border-border my-2 pt-2">
                                    <p className="text-sm font-medium text-destructive mb-2">Potongan</p>
                                  </div>
                                  {resignation.remaining_loan_principal > 0 && (
                                    <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-card">
                                      <span className="text-muted-foreground">Pelunasan Sisa Pinjaman</span>
                                      <span className="font-medium text-destructive">- {formatCurrency(resignation.remaining_loan_principal)}</span>
                                    </div>
                                  )}
                                  {resignation.total_penalties > 0 && (
                                    <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-card">
                                      <span className="text-muted-foreground">Total Denda</span>
                                      <span className="font-medium text-destructive">- {formatCurrency(resignation.total_penalties)}</span>
                                    </div>
                                  )}
                                </>
                              )}

                              {/* Final Amount */}
                              <div className="border-t border-border my-2" />
                              <div className="flex justify-between text-sm py-3 px-3 rounded-lg bg-success/10 border border-success/20">
                                <span className="font-medium text-foreground">Dana Dikembalikan</span>
                                <span className="font-bold text-success">{formatCurrency(resignation.refund_amount)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end pt-2">
                            <Button
                              variant="outline"
                              onClick={() => setLetterData(resignation)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Unduh Surat
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setReactivatingMember(resignation)}
                            >
                              <UserCheck className="mr-2 h-4 w-4" />
                              Aktifkan Kembali
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
        </Tabs>
      </div>

      {/* Letter Download */}
      {letterData && (
        <ResignationConfirmationLetter
          data={{
            id: letterData.id,
            memberName: letterData.profile?.name || 'Unknown',
            memberNumber: letterData.profile?.member_number || '-',
            memberEmail: letterData.profile?.email,
            memberPhone: letterData.profile?.phone,
            joinDate: letterData.profile?.join_date,
            exitDate: letterData.processed_at || letterData.created_at,
            totalSavings: letterData.total_savings,
            totalArrears: letterData.remaining_loan_principal + letterData.total_penalties,
            refundAmount: letterData.refund_amount,
            simpananPokok: letterData.simpanan_pokok,
            simpananWajib: letterData.simpanan_wajib,
            simpananSukarela: letterData.simpanan_sukarela,
            remainingLoanPrincipal: letterData.remaining_loan_principal,
            totalPenalties: letterData.total_penalties,
            reason: letterData.reason,
            approvedDate: letterData.processed_at || undefined
          }}
          open={!!letterData}
          onClose={() => setLetterData(null)}
        />
      )}

      {/* Reactivation Dialog */}
      <AlertDialog open={!!reactivatingMember} onOpenChange={(open) => !open && setReactivatingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aktifkan Kembali Anggota</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin mengaktifkan kembali <strong>{reactivatingMember?.profile?.name}</strong> ({reactivatingMember?.profile?.member_number}) sebagai anggota aktif?
              <br /><br />
              <span className="text-warning">Catatan: Dana yang sudah dikembalikan perlu disetorkan kembali oleh anggota.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReactivating}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivate} disabled={isReactivating}>
              {isReactivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Aktifkan
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
