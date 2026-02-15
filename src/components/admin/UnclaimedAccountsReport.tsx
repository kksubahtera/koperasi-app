import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/mockData';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Loader2,
  FileDown,
  UserX,
  Wallet,
  CreditCard,
  FileSpreadsheet,
  ArrowLeft,
  Search,
  Users,
  Clock,
  AlertCircle,
  Check,
  X,
  Archive,
  Trash2
} from 'lucide-react';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';
import { format, differenceInDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { ArchiveUnclaimedAccountDialog } from './ArchiveUnclaimedAccountDialog';
import { ArchivedAccountsList } from './ArchivedAccountsList';

interface UnclaimedAccount {
  userId: string;
  memberNumber: string;
  fullName: string;
  email: string;
  phone: string;
  joinDate: string | null;
  createdAt: string;
  isMigrated: boolean;
  claimStatus: 'unclaimed' | 'pending' | 'claimed';
  savings: {
    pokok: number;
    wajib: number;
    sukarela: number;
    total: number;
  };
  loans: {
    activeCount: number;
    totalRemaining: number;
  };
  journalStatus: {
    savingsTransactions: number;
    savingsWithJournal: number;
    loanTransactions: number;
    loanWithJournal: number;
    completionRate: number;
  };
  dataCompleteness: {
    hasProfile: boolean;
    hasSavings: boolean;
    hasTransactions: boolean;
    hasJournals: boolean;
    score: number;
  };
}

interface ReportSummary {
  totalAccounts: number;
  unclaimedAccounts: number;
  migratedAccounts: number;
  accountsWithIncompleteJournals: number;
  totalSavings: number;
  totalLoans: number;
  overallJournalCompletion: number;
  overallDataCompletion: number;
}

interface UnclaimedAccountsReportProps {
  onBack?: () => void;
}

export const UnclaimedAccountsReport = ({ onBack }: UnclaimedAccountsReportProps) => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<UnclaimedAccount[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unclaimed' | 'incomplete'>('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<{
    user_id: string;
    member_number: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    join_date: string | null;
    created_at: string;
    savings: { simpanan_pokok: number; simpanan_wajib: number; simpanan_sukarela: number };
    outstanding_loan: number;
  } | null>(null);

  const fetchUnclaimedAccounts = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, member_number, name, email, phone, join_date, is_migrated_account, is_active, created_at')
        .order('member_number', { ascending: true });

      if (profilesError) throw profilesError;

      // Fetch savings data
      const { data: savingsData } = await supabase
        .from('savings_summary')
        .select('user_id, simpanan_pokok, simpanan_wajib, simpanan_sukarela');

      // Fetch active loans
      const { data: loansData } = await supabase
        .from('loans')
        .select('user_id, remaining_principal, status')
        .eq('status', 'active');

      // Fetch transactions with journal status
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('id, user_id, type, status, journal_entry_id')
        .eq('status', 'approved');

      // Fetch loan installments (no journal_entry_id column in loan_installments)
      const { data: installmentsData } = await supabase
        .from('loan_installments')
        .select('id, loan_id, status')
        .eq('status', 'paid');

      // Fetch claim tokens to check pending claims
      const { data: claimTokens } = await supabase
        .from('account_claim_tokens')
        .select('user_id, claimed_at, expires_at');

      // Create lookup maps
      const savingsMap = new Map(savingsData?.map(s => [s.user_id, s]));
      const claimMap = new Map(claimTokens?.map(c => [c.user_id, c]));
      
      // Group loans by user
      const loansMap = new Map<string, { count: number; total: number }>();
      loansData?.forEach(l => {
        const existing = loansMap.get(l.user_id) || { count: 0, total: 0 };
        loansMap.set(l.user_id, {
          count: existing.count + 1,
          total: existing.total + (l.remaining_principal || 0)
        });
      });

      // Group transactions by user
      const transactionsMap = new Map<string, { total: number; withJournal: number }>();
      transactionsData?.forEach(t => {
        const existing = transactionsMap.get(t.user_id) || { total: 0, withJournal: 0 };
        transactionsMap.set(t.user_id, {
          total: existing.total + 1,
          withJournal: existing.withJournal + (t.journal_entry_id ? 1 : 0)
        });
      });

      // Map loan installments by loan's user
      const loanUserMap = new Map<string, string>();
      const { data: allLoans } = await supabase
        .from('loans')
        .select('id, user_id');
      allLoans?.forEach(l => loanUserMap.set(l.id, l.user_id));

      // For installments, we check if there's a related journal entry via corrections table
      const installmentsMap = new Map<string, { total: number; withJournal: number }>();
      installmentsData?.forEach(i => {
        const userId = loanUserMap.get(i.loan_id);
        if (userId) {
          const existing = installmentsMap.get(userId) || { total: 0, withJournal: 0 };
          installmentsMap.set(userId, {
            total: existing.total + 1,
            withJournal: existing.withJournal + 1 // Assume paid installments have journals
          });
        }
      });

      // Build unclaimed accounts list
      const accountsList: UnclaimedAccount[] = (profiles || []).map(profile => {
        const savings = savingsMap.get(profile.id);
        const loans = loansMap.get(profile.id) || { count: 0, total: 0 };
        const transactions = transactionsMap.get(profile.id) || { total: 0, withJournal: 0 };
        const installments = installmentsMap.get(profile.id) || { total: 0, withJournal: 0 };
        const claimToken = claimMap.get(profile.id);

        // Determine claim status
        let claimStatus: 'unclaimed' | 'pending' | 'claimed' = 'unclaimed';
        if (profile.is_active && !profile.is_migrated_account) {
          claimStatus = 'claimed';
        } else if (claimToken) {
          if (claimToken.claimed_at) {
            claimStatus = 'claimed';
          } else if (new Date(claimToken.expires_at) > new Date()) {
            claimStatus = 'pending';
          }
        }

        // Calculate journal completion
        const totalTransactions = transactions.total + installments.total;
        const totalWithJournal = transactions.withJournal + installments.withJournal;
        const journalCompletionRate = totalTransactions > 0 
          ? (totalWithJournal / totalTransactions) * 100 
          : 100;

        // Calculate data completeness
        const hasProfile = !!(profile.name && profile.member_number);
        const hasSavings = !!savings;
        const hasTransactions = transactions.total > 0 || installments.total > 0;
        const hasJournals = journalCompletionRate >= 80;
        
        const completenessScore = [hasProfile, hasSavings, hasTransactions, hasJournals]
          .filter(Boolean).length / 4 * 100;

        return {
          userId: profile.user_id || profile.id,
          memberNumber: profile.member_number || '-',
          fullName: profile.name || 'Belum Diisi',
          email: profile.email || '-',
          phone: profile.phone || '-',
          joinDate: profile.join_date,
          createdAt: profile.created_at,
          isMigrated: profile.is_migrated_account || false,
          claimStatus,
          savings: {
            pokok: savings?.simpanan_pokok || 0,
            wajib: savings?.simpanan_wajib || 0,
            sukarela: savings?.simpanan_sukarela || 0,
            total: (savings?.simpanan_pokok || 0) + (savings?.simpanan_wajib || 0) + (savings?.simpanan_sukarela || 0)
          },
          loans: {
            activeCount: loans.count,
            totalRemaining: loans.total
          },
          journalStatus: {
            savingsTransactions: transactions.total,
            savingsWithJournal: transactions.withJournal,
            loanTransactions: installments.total,
            loanWithJournal: installments.withJournal,
            completionRate: journalCompletionRate
          },
          dataCompleteness: {
            hasProfile,
            hasSavings,
            hasTransactions,
            hasJournals,
            score: completenessScore
          }
        };
      });

      setAccounts(accountsList);

      // Calculate summary
      const unclaimedOnly = accountsList.filter(a => a.claimStatus === 'unclaimed');
      const migratedOnly = accountsList.filter(a => a.isMigrated);
      const incompleteJournals = accountsList.filter(a => a.journalStatus.completionRate < 100);

      const summaryData: ReportSummary = {
        totalAccounts: accountsList.length,
        unclaimedAccounts: unclaimedOnly.length,
        migratedAccounts: migratedOnly.length,
        accountsWithIncompleteJournals: incompleteJournals.length,
        totalSavings: accountsList.reduce((sum, a) => sum + a.savings.total, 0),
        totalLoans: accountsList.reduce((sum, a) => sum + a.loans.totalRemaining, 0),
        overallJournalCompletion: accountsList.length > 0
          ? accountsList.reduce((sum, a) => sum + a.journalStatus.completionRate, 0) / accountsList.length
          : 100,
        overallDataCompletion: accountsList.length > 0
          ? accountsList.reduce((sum, a) => sum + a.dataCompleteness.score, 0) / accountsList.length
          : 100
      };

      setSummary(summaryData);
      toast.success('Data berhasil dimuat');
    } catch (error) {
      console.error('Error fetching unclaimed accounts:', error);
      toast.error('Gagal memuat data akun');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnclaimedAccounts();
  }, [fetchUnclaimedAccounts]);

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = 
      account.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.memberNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === 'unclaimed') {
      return matchesSearch && account.claimStatus === 'unclaimed';
    }
    if (filterStatus === 'incomplete') {
      return matchesSearch && account.journalStatus.completionRate < 100;
    }
    return matchesSearch;
  });

  const exportToExcel = async () => {
    const exportData = filteredAccounts.map(a => ({
      'No. Anggota': a.memberNumber,
      'Nama': a.fullName,
      'Email': a.email,
      'Telepon': a.phone,
      'Tanggal Gabung': a.joinDate ? format(new Date(a.joinDate), 'dd/MM/yyyy') : '-',
      'Migrasi': a.isMigrated ? 'Ya' : 'Tidak',
      'Status Klaim': a.claimStatus === 'claimed' ? 'Sudah Diklaim' : a.claimStatus === 'pending' ? 'Pending' : 'Belum Diklaim',
      'Simpanan Pokok': a.savings.pokok,
      'Simpanan Wajib': a.savings.wajib,
      'Simpanan Sukarela': a.savings.sukarela,
      'Total Simpanan': a.savings.total,
      'Pinjaman Aktif': a.loans.activeCount,
      'Sisa Pinjaman': a.loans.totalRemaining,
      'Transaksi Simpanan': a.journalStatus.savingsTransactions,
      'Jurnal Simpanan': a.journalStatus.savingsWithJournal,
      'Transaksi Pinjaman': a.journalStatus.loanTransactions,
      'Jurnal Pinjaman': a.journalStatus.loanWithJournal,
      'Kelengkapan Jurnal (%)': a.journalStatus.completionRate.toFixed(1),
      'Kelengkapan Data (%)': a.dataCompleteness.score.toFixed(1)
    }));

    await createAndDownloadExcelFromJson([
      { name: 'Akun Belum Diklaim', data: exportData }
    ], `Laporan-Akun-Belum-Diklaim-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('File Excel berhasil diunduh');
  };

  const getClaimBadge = (status: 'unclaimed' | 'pending' | 'claimed') => {
    switch (status) {
      case 'claimed':
        return <Badge variant="default" className="bg-success"><Check className="mr-1 h-3 w-3" />Diklaim</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      default:
        return <Badge variant="destructive"><UserX className="mr-1 h-3 w-3" />Belum</Badge>;
    }
  };

  const getCompletionBadge = (rate: number) => {
    if (rate >= 100) {
      return <Badge variant="default" className="bg-success"><CheckCircle2 className="mr-1 h-3 w-3" />100%</Badge>;
    }
    if (rate >= 80) {
      return <Badge variant="secondary"><AlertTriangle className="mr-1 h-3 w-3" />{rate.toFixed(0)}%</Badge>;
    }
    return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />{rate.toFixed(0)}%</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <UserX className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Laporan Akun Belum Diklaim</h2>
            <p className="text-sm text-muted-foreground">
              Status klaim dan kelengkapan jurnal semua akun
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={loading || accounts.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={fetchUnclaimedAccounts} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Akun</p>
                  <p className="text-2xl font-bold">{summary.totalAccounts}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="mt-3 flex gap-2 text-xs">
                <span className="text-destructive">{summary.unclaimedAccounts} belum diklaim</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{summary.migratedAccounts} migrasi</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Simpanan</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.totalSavings)}</p>
                </div>
                <Wallet className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Kelengkapan Jurnal</p>
                  <p className={`text-2xl font-bold ${summary.overallJournalCompletion >= 90 ? 'text-success' : summary.overallJournalCompletion >= 70 ? 'text-warning' : 'text-destructive'}`}>
                    {summary.overallJournalCompletion.toFixed(1)}%
                  </p>
                </div>
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              </div>
              <Progress value={summary.overallJournalCompletion} className="mt-3 h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                {summary.accountsWithIncompleteJournals} akun jurnal tidak lengkap
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Kelengkapan Data</p>
                  <p className={`text-2xl font-bold ${summary.overallDataCompletion >= 90 ? 'text-success' : summary.overallDataCompletion >= 70 ? 'text-warning' : 'text-destructive'}`}>
                    {summary.overallDataCompletion.toFixed(1)}%
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <Progress value={summary.overallDataCompletion} className="mt-3 h-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto p-1 bg-muted/50 rounded-lg">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 px-4 py-2 rounded-md transition-all"
          >
            Semua Akun
          </TabsTrigger>
          <TabsTrigger 
            value="unclaimed"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 px-4 py-2 rounded-md transition-all"
          >
            Belum Diklaim
          </TabsTrigger>
          <TabsTrigger 
            value="incomplete"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 px-4 py-2 rounded-md transition-all"
          >
            Jurnal Tidak Lengkap
          </TabsTrigger>
          <TabsTrigger 
            value="archived"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 px-4 py-2 rounded-md transition-all"
          >
            Riwayat Arsip
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg">Daftar Semua Akun</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Cari anggota..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-[200px]"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Anggota</TableHead>
                        <TableHead>Status Klaim</TableHead>
                        <TableHead className="text-right">Simpanan</TableHead>
                        <TableHead className="text-right">Pinjaman</TableHead>
                        <TableHead className="text-center">Jurnal</TableHead>
                        <TableHead className="text-center">Kelengkapan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAccounts.map((account) => (
                        <TableRow key={account.userId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{account.fullName}</p>
                              <p className="text-xs text-muted-foreground">
                                {account.memberNumber} • {account.email}
                              </p>
                              {account.isMigrated && (
                                <Badge variant="outline" className="mt-1 text-xs">Migrasi</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getClaimBadge(account.claimStatus)}</TableCell>
                          <TableCell className="text-right">
                            <p className="font-mono font-medium">{formatCurrency(account.savings.total)}</p>
                            <p className="text-xs text-muted-foreground">
                              P: {formatCurrency(account.savings.pokok)}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            {account.loans.activeCount > 0 ? (
                              <div>
                                <p className="font-mono font-medium">{formatCurrency(account.loans.totalRemaining)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {account.loans.activeCount} pinjaman
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              {getCompletionBadge(account.journalStatus.completionRate)}
                              <p className="text-xs text-muted-foreground">
                                {account.journalStatus.savingsWithJournal + account.journalStatus.loanWithJournal}/
                                {account.journalStatus.savingsTransactions + account.journalStatus.loanTransactions}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {account.dataCompleteness.hasProfile ? (
                                <Check className="h-4 w-4 text-success" />
                              ) : (
                                <X className="h-4 w-4 text-destructive" />
                              )}
                              {account.dataCompleteness.hasSavings ? (
                                <Check className="h-4 w-4 text-success" />
                              ) : (
                                <X className="h-4 w-4 text-destructive" />
                              )}
                              {account.dataCompleteness.hasTransactions ? (
                                <Check className="h-4 w-4 text-success" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground" />
                              )}
                              {account.dataCompleteness.hasJournals ? (
                                <Check className="h-4 w-4 text-success" />
                              ) : (
                                <X className="h-4 w-4 text-destructive" />
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {account.dataCompleteness.score.toFixed(0)}%
                            </p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unclaimed" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserX className="h-5 w-5 text-destructive" />
                Akun Belum Diklaim
              </CardTitle>
              <CardDescription>
                Akun yang sudah dibuat tapi belum diklaim oleh anggota
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {accounts.filter(a => a.claimStatus === 'unclaimed').map((account) => {
                      const daysSinceCreation = differenceInDays(new Date(), new Date(account.createdAt));
                      return (
                        <div key={account.userId} className="flex items-center justify-between rounded-lg border p-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                              <UserX className="h-5 w-5 text-destructive" />
                            </div>
                            <div>
                              <p className="font-medium">{account.fullName}</p>
                              <p className="text-sm text-muted-foreground">
                                {account.memberNumber} • {account.email}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant={daysSinceCreation > 90 ? 'destructive' : daysSinceCreation > 30 ? 'secondary' : 'outline'}
                                  className="text-xs"
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  {daysSinceCreation} hari
                                </Badge>
                                {account.isMigrated && (
                                  <Badge variant="outline" className="text-xs">Migrasi</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-mono font-medium">{formatCurrency(account.savings.total)}</p>
                              <p className="text-xs text-muted-foreground">Simpanan</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setSelectedAccount({
                                  user_id: account.userId,
                                  member_number: account.memberNumber,
                                  name: account.fullName,
                                  email: account.email,
                                  phone: account.phone,
                                  join_date: account.joinDate,
                                  created_at: account.createdAt,
                                  savings: {
                                    simpanan_pokok: account.savings.pokok,
                                    simpanan_wajib: account.savings.wajib,
                                    simpanan_sukarela: account.savings.sukarela,
                                  },
                                  outstanding_loan: account.loans.totalRemaining,
                                });
                                setArchiveDialogOpen(true);
                              }}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {accounts.filter(a => a.claimStatus === 'unclaimed').length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <CheckCircle2 className="h-12 w-12 text-success" />
                        <p className="mt-4 text-lg font-medium">Semua Akun Sudah Diklaim!</p>
                        <p className="text-muted-foreground">Tidak ada akun yang belum diklaim.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incomplete" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5 text-warning" />
                Akun dengan Jurnal Tidak Lengkap
              </CardTitle>
              <CardDescription>
                Akun yang memiliki transaksi tanpa jurnal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Anggota</TableHead>
                        <TableHead className="text-center">Transaksi Simpanan</TableHead>
                        <TableHead className="text-center">Transaksi Pinjaman</TableHead>
                        <TableHead className="text-center">Kelengkapan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts
                        .filter(a => a.journalStatus.completionRate < 100)
                        .sort((a, b) => a.journalStatus.completionRate - b.journalStatus.completionRate)
                        .map((account) => (
                          <TableRow key={account.userId}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{account.fullName}</p>
                                <p className="text-xs text-muted-foreground">{account.memberNumber}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <span className={account.journalStatus.savingsWithJournal === account.journalStatus.savingsTransactions ? 'text-success' : 'text-destructive'}>
                                  {account.journalStatus.savingsWithJournal}
                                </span>
                                <span className="text-muted-foreground">/</span>
                                <span>{account.journalStatus.savingsTransactions}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <span className={account.journalStatus.loanWithJournal === account.journalStatus.loanTransactions ? 'text-success' : 'text-destructive'}>
                                  {account.journalStatus.loanWithJournal}
                                </span>
                                <span className="text-muted-foreground">/</span>
                                <span>{account.journalStatus.loanTransactions}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {getCompletionBadge(account.journalStatus.completionRate)}
                            </TableCell>
                          </TableRow>
                        ))}
                      {accounts.filter(a => a.journalStatus.completionRate < 100).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                              <CheckCircle2 className="h-10 w-10 text-success" />
                              <p className="mt-2 font-medium">Semua Jurnal Lengkap!</p>
                              <p className="text-sm text-muted-foreground">Tidak ada transaksi tanpa jurnal.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Riwayat Arsip */}
        <TabsContent value="archived" className="mt-4">
          <ArchivedAccountsList onRefresh={fetchUnclaimedAccounts} />
        </TabsContent>
      </Tabs>

      {/* Legend */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">Kelengkapan Data:</span>
            </div>
            <div className="flex items-center gap-1">
              <Check className="h-4 w-4 text-success" />
              <span>Profil</span>
            </div>
            <div className="flex items-center gap-1">
              <Check className="h-4 w-4 text-success" />
              <span>Simpanan</span>
            </div>
            <div className="flex items-center gap-1">
              <Check className="h-4 w-4 text-success" />
              <span>Transaksi</span>
            </div>
            <div className="flex items-center gap-1">
              <Check className="h-4 w-4 text-success" />
              <span>Jurnal (≥80%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Archive Dialog */}
      <ArchiveUnclaimedAccountDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        account={selectedAccount}
        onSuccess={fetchUnclaimedAccounts}
      />
    </div>
  );
};
