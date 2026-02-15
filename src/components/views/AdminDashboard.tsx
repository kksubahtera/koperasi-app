import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/mockData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { FinancialCharts } from '@/components/admin/FinancialCharts';
import { useCooperativeSummary } from '@/hooks/useCooperativeSummary';
import { ExportAllDataButton } from '@/components/shared/ExportAllDataButton';
import { 
  ClipboardCheck, 
  Users, 
  Building2, 
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  BookOpen,
  Flag,
  Wallet,
  LayoutDashboard,
  BarChart3,
  FileArchive,
  Database,
  UserMinus,
  CreditCard,
  Copy,
  X,
  UserCog,
  ShieldCheck,
  Settings,
  UserCheck,
  Scale
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (view: string) => void;
  pendingRegistrations?: number;
}

export const AdminDashboard = ({ onNavigate, pendingRegistrations = 0 }: AdminDashboardProps) => {
  const { user } = useAuth();
  const { t } = useThemeLanguage();
  const queryClient = useQueryClient();
  const [reportedCorrections, setReportedCorrections] = useState(0);
  const [pendingTransactionsCount, setPendingTransactionsCount] = useState(0);
  const [pendingResignationsCount, setPendingResignationsCount] = useState(0);
  const [exitedMembersCount, setExitedMembersCount] = useState(0);
  const [issuedLettersCount, setIssuedLettersCount] = useState(0);
  const [shuActivitiesCount, setShuActivitiesCount] = useState(0);
  const [underpaymentCount, setUnderpaymentCount] = useState(0);
  const [duplicateCorrectionCount, setDuplicateCorrectionCount] = useState(0);
  const [duplicateCorrectionAmount, setDuplicateCorrectionAmount] = useState(0);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'charts'>('overview');
  const [adminCount, setAdminCount] = useState(0);
  const [adminNames, setAdminNames] = useState<string[]>([]);
  const [unclaimedAccountsCount, setUnclaimedAccountsCount] = useState(0);
  const [officersBreakdown, setOfficersBreakdown] = useState<{
    pengurus: string[];
    pengawas: string[];
    penasihat: string[];
  }>({ pengurus: [], pengawas: [], penasihat: [] });
  const [officersPulsing, setOfficersPulsing] = useState(false);
  const [adminPulsing, setAdminPulsing] = useState(false);
  const { summary, refetch: refetchSummary } = useCooperativeSummary();

  const fetchDashboardData = async () => {
    // Fetch counts in parallel - split into two batches to avoid TS2589
    const [
      correctionsResult,
      transactionsResult,
      resignationsResult,
      exitedMembersResult,
      loanLettersResult,
      withdrawalLettersResult
    ] = await Promise.all([
      // Reported corrections
      supabase
        .from('corrections')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'reported'),
      // Pending transactions
      supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      // Pending resignations
      supabase
        .from('resignation_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      // Exited members (inactive profiles)
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', false)
        .not('exit_date', 'is', null),
      // Loan letters (active/completed loans)
      supabase
        .from('loans')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'completed']),
      // Withdrawal letters (approved withdrawals)
      supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'penarikan_simpanan_sukarela')
        .eq('status', 'approved'),
    ]);

    const [
      refundLettersResult,
      shuActivitiesResult,
      partialInstallmentsResult,
      appliedCorrectionsResult
    ] = await Promise.all([
      // Refund letters (exited members)
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', false)
        .not('exit_date', 'is', null),
      // SHU fund activities for current year
      supabase
        .from('shu_fund_activities')
        .select('*', { count: 'exact', head: true })
        .eq('year', new Date().getFullYear()),
      // Partial installments (underpayments)
      supabase
        .from('loan_installments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'partial'),
      // Applied corrections for duplicate detection
      supabase
        .from('corrections')
        .select('transaction_id, correction_type, amount, operation, correction_mode')
        .eq('status', 'applied')
        .eq('correction_mode', 'transaction_based')
        .not('transaction_id', 'is', null),
    ]);

    // Separate query for unclaimed migrated accounts
    const unclaimedAccountsResult = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_migrated_account', true)
      .eq('must_change_password', true);

    // Fetch admin users with names from profiles
    const adminRolesResult = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    
    let fetchedAdminNames: string[] = [];
    if (adminRolesResult.data && adminRolesResult.data.length > 0) {
      const adminUserIds = adminRolesResult.data.map((r: any) => r.user_id);
      const adminProfilesResult = await supabase
        .from('profiles')
        .select('name')
        .in('user_id', adminUserIds);
      
      if (adminProfilesResult.data) {
        fetchedAdminNames = adminProfilesResult.data.map((p: any) => p.name).filter(Boolean);
      }
    }
    
    // Fetch officers breakdown by role with names
    const officersResult = await supabase
      .from('role_assignments' as any)
      .select('role, name');
    
    setReportedCorrections(correctionsResult.count || 0);
    setPendingTransactionsCount(transactionsResult.count || 0);
    setPendingResignationsCount(resignationsResult.count || 0);
    setExitedMembersCount(exitedMembersResult.count || 0);
    // Calculate total letters from multiple sources
    const totalLetters = (loanLettersResult.count || 0) + 
                         (withdrawalLettersResult.count || 0) + 
                         (refundLettersResult.count || 0);
    setIssuedLettersCount(totalLetters);
    setShuActivitiesCount(shuActivitiesResult.count || 0);
    setUnderpaymentCount(partialInstallmentsResult.count || 0);
    setAdminCount(fetchedAdminNames.length);
    setAdminNames(fetchedAdminNames);
    setUnclaimedAccountsCount(unclaimedAccountsResult.count || 0);
    
    // Calculate officers breakdown with names
    if (officersResult.data) {
      const breakdown: { pengurus: string[]; pengawas: string[]; penasihat: string[] } = { 
        pengurus: [], 
        pengawas: [], 
        penasihat: [] 
      };
      officersResult.data.forEach((item: any) => {
        if (item.role === 'pengurus') breakdown.pengurus.push(item.name);
        else if (item.role === 'pengawas') breakdown.pengawas.push(item.name);
        else if (item.role === 'penasihat') breakdown.penasihat.push(item.name);
      });
      setOfficersBreakdown(breakdown);
    }

    // Detect duplicate corrections
    if (appliedCorrectionsResult.data) {
      const groups = new Map<string, { count: number; amount: number }>();
      appliedCorrectionsResult.data.forEach((cor: any) => {
        const key = `${cor.transaction_id}|${cor.correction_type}|${cor.amount}|${cor.operation}`;
        if (!groups.has(key)) {
          groups.set(key, { count: 0, amount: cor.amount });
        }
        groups.get(key)!.count++;
      });

      let totalDuplicates = 0;
      let totalExcessAmount = 0;
      groups.forEach(({ count, amount }) => {
        if (count > 1) {
          totalDuplicates += count - 1;
          totalExcessAmount += amount * (count - 1);
        }
      });

      setDuplicateCorrectionCount(totalDuplicates);
      setDuplicateCorrectionAmount(totalExcessAmount);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Real-time subscription for admin dashboard updates
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          console.log('[Realtime] Transactions updated');
          fetchDashboardData();
          refetchSummary();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loans' },
        () => {
          console.log('[Realtime] Loans updated');
          fetchDashboardData();
          refetchSummary();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          console.log('[Realtime] Profiles updated');
          fetchDashboardData();
          refetchSummary();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'corrections' },
        () => {
          console.log('[Realtime] Corrections updated');
          fetchDashboardData();
        }
      )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'resignation_requests' },
          () => {
            console.log('[Realtime] Resignation requests updated');
            fetchDashboardData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'loan_installments' },
          () => {
            console.log('[Realtime] Loan installments updated');
            fetchDashboardData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_roles' },
          (payload) => {
            console.log('[Realtime] User roles updated');
            fetchDashboardData();
            // Trigger pulse animation for admin
            setAdminPulsing(true);
            setTimeout(() => setAdminPulsing(false), 2000);
            // Show toast notification
            const eventType = payload.eventType;
            toast({
              title: '🔔 Admin Data Updated',
              description: eventType === 'INSERT' 
                ? 'New admin has been added' 
                : eventType === 'DELETE' 
                  ? 'Admin has been removed' 
                  : 'Admin data has been modified',
            });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'role_assignments' },
          (payload) => {
            console.log('[Realtime] Role assignments updated');
            fetchDashboardData();
            // Trigger pulse animation for officers
            setOfficersPulsing(true);
            setTimeout(() => setOfficersPulsing(false), 2000);
            // Show toast notification
            const eventType = payload.eventType;
            toast({
              title: '🔔 Officers Data Updated',
              description: eventType === 'INSERT' 
                ? 'New officer has been added' 
                : eventType === 'DELETE' 
                  ? 'Officer has been removed' 
                  : 'Officer data has been modified',
            });
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchSummary]);
  
  if (!user) return null;

  const quickStats = [
    {
      title: t('Pembukuan', 'Accounting'),
      value: new Date().getFullYear(),
      subtitle: t('Neraca, L/R, SHU', 'Balance Sheet, P&L, Dividend'),
      icon: BookOpen,
      color: 'text-info',
      bgColor: 'bg-info/10',
      onClick: () => onNavigate('accounting'),
    },
    {
      title: t('Pendaftaran Baru', 'New Registrations'),
      value: pendingRegistrations,
      subtitle: t('Menunggu persetujuan', 'Awaiting approval'),
      icon: Users,
      color: 'text-info',
      bgColor: 'bg-info/10',
      onClick: () => onNavigate('registrations'),
    },
    {
      title: t('Transaksi Tertunda', 'Pending Transactions'),
      value: pendingTransactionsCount,
      subtitle: t('Menunggu verifikasi', 'Awaiting verification'),
      icon: ClipboardCheck,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      onClick: () => onNavigate('verify'),
    },
    {
      title: t('Laporan Koreksi', 'Correction Reports'),
      value: reportedCorrections,
      subtitle: t('Perlu ditinjau', 'Needs review'),
      icon: Flag,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      onClick: () => onNavigate('correction-reports'),
    },
    {
      title: t('Total Anggota', 'Total Members'),
      value: summary.totalMembers,
      subtitle: t(`${summary.membersWithLoans} memiliki pinjaman`, `${summary.membersWithLoans} have loans`),
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      onClick: () => onNavigate('members'),
    },
    {
      title: t('Anggota Menunggak', 'Defaulting Members'),
      value: summary.membersDefaulting,
      subtitle: t('Perlu perhatian', 'Needs attention'),
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      onClick: () => onNavigate('overdue-dashboard'),
    },
    {
      title: t('Kurang Bayar', 'Underpayments'),
      value: underpaymentCount,
      subtitle: t('Angsuran sebagian', 'Partial installments'),
      icon: CreditCard,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      onClick: () => onNavigate('underpayment-tracking'),
    },
    {
      title: t('Pengunduran Diri', 'Resignations'),
      value: pendingResignationsCount,
      subtitle: t('Permintaan keluar anggota', 'Membership exit requests'),
      icon: UserMinus,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      onClick: () => onNavigate('resignation-management'),
    },
    {
      title: t('Riwayat Keluar', 'Exit History'),
      value: exitedMembersCount,
      subtitle: t('Anggota yang telah keluar', 'Members who have exited'),
      icon: Users,
      color: 'text-slate-500',
      bgColor: 'bg-slate-500/10',
      onClick: () => onNavigate('exited-members-history'),
    },
    {
      title: t('Total Aset', 'Total Assets'),
      value: formatCurrency(summary.totalAssets),
      subtitle: t('Aset koperasi', 'Cooperative assets'),
      icon: Building2,
      color: 'text-success',
      bgColor: 'bg-success/10',
      onClick: () => onNavigate('summary'),
    },
    {
      title: t('Aktivitas Dana SHU', 'Dividend Fund Activities'),
      value: shuActivitiesCount,
      subtitle: t(`Tahun ${new Date().getFullYear()}`, `Year ${new Date().getFullYear()}`),
      icon: Wallet,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      onClick: () => onNavigate('shu-activities'),
    },
    {
      title: t('Arsip Surat', 'Letter Archive'),
      value: issuedLettersCount,
      subtitle: t('Pinjaman, Penarikan, Keluar', 'Loans, Withdrawals, Exits'),
      icon: FileArchive,
      color: 'text-teal-500',
      bgColor: 'bg-teal-500/10',
      onClick: () => onNavigate('letter-archive'),
    },
    {
      title: t('Pengurus Koperasi', 'Cooperative Officers'),
      value: officersBreakdown.pengurus.length + officersBreakdown.pengawas.length + officersBreakdown.penasihat.length,
      subtitle: null, // Will use custom render
      subtitleBadges: officersBreakdown,
      icon: UserCog,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      onClick: () => onNavigate('officers-management'),
      tooltip: officersBreakdown,
      isPulsing: officersPulsing,
    },
    {
      title: t('Manajemen Admin', 'Admin Management'),
      value: adminCount,
      subtitle: t('Akun administrator', 'Administrator accounts'),
      icon: ShieldCheck,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
      onClick: () => onNavigate('admin-management'),
      isPulsing: adminPulsing,
      adminTooltip: adminNames,
    },
    {
      title: t('Migrasi Data', 'Data Migration'),
      value: '💾',
      subtitle: t('Data awal koperasi', 'Initial cooperative data'),
      icon: Database,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      onClick: () => onNavigate('data-migration'),
    },
    {
      title: t('Laporan Migrasi', 'Migration Reports'),
      value: unclaimedAccountsCount > 0 ? unclaimedAccountsCount : '📋',
      subtitle: t('Akun & rekonsiliasi data', 'Accounts & data reconciliation'),
      icon: Scale,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      onClick: () => onNavigate('migration-reports'),
    },
  ];

  // Kas = Total Simpanan - Piutang (uang yang tidak dipinjamkan ke anggota)
  const totalSimpanan = summary.totalSimpananPokok + summary.totalSimpananWajib + summary.totalSimpananSukarela;
  const kas = totalSimpanan - summary.totalReceivables;
  
  const financialHighlights = [
    {
      label: t('Total Simpanan', 'Total Savings'),
      value: totalSimpanan,
    },
    {
      label: t('Kas (Tidak Dipinjamkan)', 'Cash (Not Loaned)'),
      value: kas > 0 ? kas : 0,
    },
    {
      label: t('Piutang (Dipinjamkan)', 'Receivables (Loaned)'),
      value: summary.totalReceivables,
    },
    {
      label: t('Pendapatan Bunga', 'Interest Income'),
      value: summary.totalInterestReceived,
    },
  ];

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      {/* Duplicate Correction Alert */}
      {duplicateCorrectionCount > 0 && showDuplicateAlert && (
        <Alert variant="destructive" className="animate-fade-in border-destructive/50 bg-destructive/10">
          <Copy className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            <span>{t('Koreksi Duplikat Terdeteksi', 'Duplicate Corrections Detected')}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 -mr-2"
              onClick={() => setShowDuplicateAlert(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </AlertTitle>
          <AlertDescription className="mt-1">
            <p className="text-sm">
              {t('Ditemukan', 'Found')} <strong>{duplicateCorrectionCount}</strong> {t('koreksi duplikat dengan kelebihan', 'duplicate corrections with excess amount of')}{' '}
              <strong>{formatCurrency(duplicateCorrectionAmount)}</strong>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={() => onNavigate('correction-reports')}
            >
              {t('Bersihkan Sekarang', 'Clean Up Now')}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Welcome - More compact on mobile */}
      <div className="animate-fade-in flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">
            {t('Beranda Admin', 'Admin Dashboard')}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            {t('Kelola dan pantau aktivitas koperasi', 'Manage and monitor cooperative activities')}
          </p>
        </div>
        <ExportAllDataButton />
      </div>

      {/* Tab Navigation - Compact on mobile */}
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <TooltipProvider delayDuration={300}>
            <div className="inline-flex w-auto gap-0.5 sm:gap-1 bg-muted/50 p-0.5 sm:p-1 rounded-lg border border-border/50">
              {[
                { value: 'overview', icon: LayoutDashboard, labelId: 'Ringkasan', labelEn: 'Overview' },
                { value: 'charts', icon: BarChart3, labelId: 'Grafik', labelEn: 'Charts' },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;
                return (
                  <Button
                    key={tab.value}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab(tab.value as 'overview' | 'charts')}
                    className={`
                      gap-1 sm:gap-1.5 px-2.5 sm:px-3 md:px-4 py-1 sm:py-1.5 h-7 sm:h-8 text-[11px] sm:text-xs md:text-sm font-medium
                      transition-all duration-200 rounded-md sm:rounded-lg
                      ${isActive 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                      }
                    `}
                  >
                    <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                    <span>{t(tab.labelId, tab.labelEn)}</span>
                  </Button>
                );
              })}
            </div>
          </TooltipProvider>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-3 sm:space-y-4 md:space-y-6 animate-fade-in">
            {/* Quick Stats - Compact 2-column grid on mobile */}
            <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
              {quickStats.map((stat, index) => {
                const Icon = stat.icon;
                const hasTooltip = 'tooltip' in stat && stat.tooltip;
                
                const cardContent = (
                  <Card 
                    key={stat.title}
                    className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 animate-slide-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                    onClick={stat.onClick}
                  >
                    <CardContent className="p-2.5 sm:p-3 md:p-4">
                      <div className="flex items-start justify-between gap-1">
                        <div className={`flex h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 items-center justify-center rounded-lg ${stat.bgColor} shrink-0`}>
                          <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 ${stat.color}`} />
                        </div>
                        <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
                      </div>
                      <div className="mt-1.5 sm:mt-2 md:mt-3">
                        <p className="text-base sm:text-lg md:text-xl font-bold text-foreground truncate leading-tight">{stat.value}</p>
                        <p className="text-[10px] sm:text-xs md:text-sm font-medium text-foreground truncate leading-tight mt-0.5">{stat.title}</p>
                        {'subtitleBadges' in stat && stat.subtitleBadges ? (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {(stat.subtitleBadges as { pengurus: string[]; pengawas: string[]; penasihat: string[] }).pengurus.length > 0 && (
                              <Badge variant="outline" className={`text-[8px] sm:text-[9px] px-1 py-0 h-3.5 sm:h-4 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 transition-all ${'isPulsing' in stat && stat.isPulsing ? 'animate-pulse ring-2 ring-indigo-400/50' : ''}`}>
                                {(stat.subtitleBadges as { pengurus: string[]; pengawas: string[]; penasihat: string[] }).pengurus.length} Directors
                              </Badge>
                            )}
                            {(stat.subtitleBadges as { pengurus: string[]; pengawas: string[]; penasihat: string[] }).pengawas.length > 0 && (
                              <Badge variant="outline" className={`text-[8px] sm:text-[9px] px-1 py-0 h-3.5 sm:h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 transition-all ${'isPulsing' in stat && stat.isPulsing ? 'animate-pulse ring-2 ring-emerald-400/50' : ''}`}>
                                {(stat.subtitleBadges as { pengurus: string[]; pengawas: string[]; penasihat: string[] }).pengawas.length} Supervisors
                              </Badge>
                            )}
                            {(stat.subtitleBadges as { pengurus: string[]; pengawas: string[]; penasihat: string[] }).penasihat.length > 0 && (
                              <Badge variant="outline" className={`text-[8px] sm:text-[9px] px-1 py-0 h-3.5 sm:h-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 transition-all ${'isPulsing' in stat && stat.isPulsing ? 'animate-pulse ring-2 ring-amber-400/50' : ''}`}>
                                {(stat.subtitleBadges as { pengurus: string[]; pengawas: string[]; penasihat: string[] }).penasihat.length} Advisors
                              </Badge>
                            )}
                            {(stat.subtitleBadges as { pengurus: string[]; pengawas: string[]; penasihat: string[] }).pengurus.length === 0 && 
                             (stat.subtitleBadges as { pengurus: string[]; pengawas: string[]; penasihat: string[] }).pengawas.length === 0 && 
                             (stat.subtitleBadges as { pengurus: string[]; pengawas: string[]; penasihat: string[] }).penasihat.length === 0 && (
                              <span className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground">No officers yet</span>
                            )}
                          </div>
                        ) : (
                          <p className={`text-[9px] sm:text-[10px] md:text-xs text-muted-foreground truncate leading-tight ${'isPulsing' in stat && stat.isPulsing ? 'animate-pulse' : ''}`}>{stat.subtitle}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );

                if (hasTooltip && stat.tooltip) {
                  const tooltipData = stat.tooltip as { pengurus: string[]; pengawas: string[]; penasihat: string[] };
                  const hasAnyOfficers = tooltipData.pengurus.length > 0 || tooltipData.pengawas.length > 0 || tooltipData.penasihat.length > 0;
                  
                  return (
                    <Tooltip key={stat.title}>
                      <TooltipTrigger asChild>
                        {cardContent}
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs p-3">
                        {hasAnyOfficers ? (
                          <div className="space-y-2 text-xs">
                            {tooltipData.pengurus.length > 0 && (
                              <div>
                                <p className="font-semibold text-indigo-600 dark:text-indigo-400">Directors:</p>
                                <p className="text-muted-foreground">{tooltipData.pengurus.join(', ')}</p>
                              </div>
                            )}
                            {tooltipData.pengawas.length > 0 && (
                              <div>
                                <p className="font-semibold text-emerald-600 dark:text-emerald-400">Supervisors:</p>
                                <p className="text-muted-foreground">{tooltipData.pengawas.join(', ')}</p>
                              </div>
                            )}
                            {tooltipData.penasihat.length > 0 && (
                              <div>
                                <p className="font-semibold text-amber-600 dark:text-amber-400">Advisors:</p>
                                <p className="text-muted-foreground">{tooltipData.penasihat.join(', ')}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-xs">No officers registered yet</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                // Admin tooltip
                if ('adminTooltip' in stat && stat.adminTooltip) {
                  const adminList = stat.adminTooltip as string[];
                  
                  return (
                    <Tooltip key={stat.title}>
                      <TooltipTrigger asChild>
                        {cardContent}
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs p-3">
                        {adminList.length > 0 ? (
                          <div className="text-xs">
                            <p className="font-semibold text-violet-600 dark:text-violet-400 mb-1">Administrators:</p>
                            <p className="text-muted-foreground">{adminList.join(', ')}</p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-xs">No administrators registered yet</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return cardContent;
              })}
            </div>

            {/* Financial Highlights - More compact */}
            <Card variant="gradient">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center gap-2 mb-3 sm:mb-4 md:mb-6">
                  <div className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xs sm:text-sm md:text-base font-semibold text-foreground truncate">Financial Summary</h2>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Financial overview</p>
                  </div>
                </div>
                
                <div className="grid gap-2 sm:gap-2.5 md:gap-4 grid-cols-2 lg:grid-cols-4">
                  {financialHighlights.map((item) => (
                    <div key={item.label} className="rounded-lg bg-card p-2 sm:p-3 md:p-4">
                      <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground truncate leading-tight">{item.label}</p>
                      <p className="mt-0.5 text-xs sm:text-sm md:text-lg font-bold text-foreground truncate leading-tight">{formatCurrency(item.value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        )}

        {activeTab === 'charts' && (
          <div className="animate-fade-in">
            <FinancialCharts />
          </div>
        )}
      </div>
    </div>
  );
};
