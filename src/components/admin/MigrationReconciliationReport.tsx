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
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/mockData';
import { toast } from 'sonner';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Loader2,
  FileDown,
  Scale,
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileSpreadsheet,
  ArrowLeft,
  Clock,
  Database,
  Users,
  Trash2
} from 'lucide-react';
import { createAndDownloadExcelAoA } from '@/lib/excelUtils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface MigrationSnapshot {
  timestamp: string;
  type: 'before' | 'after';
  batchId?: string;
  savings: {
    totalPokok: number;
    totalWajib: number;
    totalSukarela: number;
    total: number;
    memberCount: number;
  };
  loans: {
    totalPrincipal: number;
    totalRemaining: number;
    totalInterestPaid: number;
    loanCount: number;
  };
  coa: {
    simpananPokok: number;
    simpananWajib: number;
    simpananSukarela: number;
    piutangPinjaman: number;
    pendapatanBunga: number;
    kas: number;
  };
  journals: {
    totalCount: number;
    totalDebit: number;
    totalCredit: number;
  };
}

interface ReconciliationComparison {
  before: MigrationSnapshot | null;
  after: MigrationSnapshot | null;
  differences: {
    savings: {
      pokok: number;
      wajib: number;
      sukarela: number;
      total: number;
      memberDiff: number;
    };
    loans: {
      principal: number;
      remaining: number;
      interestPaid: number;
      loanDiff: number;
    };
    coa: {
      simpananPokok: number;
      simpananWajib: number;
      simpananSukarela: number;
      piutangPinjaman: number;
      pendapatanBunga: number;
      kas: number;
    };
    journals: {
      count: number;
      debit: number;
      credit: number;
    };
  };
  isBalanced: boolean;
  discrepancies: string[];
}

interface MigrationReconciliationReportProps {
  onBack?: () => void;
}

export const MigrationReconciliationReport = ({ onBack }: MigrationReconciliationReportProps) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentSnapshot, setCurrentSnapshot] = useState<MigrationSnapshot | null>(null);
  const [savedSnapshots, setSavedSnapshots] = useState<MigrationSnapshot[]>([]);
  const [comparison, setComparison] = useState<ReconciliationComparison | null>(null);
  const [selectedBeforeId, setSelectedBeforeId] = useState<string>('');
  const [selectedAfterId, setSelectedAfterId] = useState<string>('');
  const [snapshotToDelete, setSnapshotToDelete] = useState<MigrationSnapshot | null>(null);

  // Capture current database snapshot
  const captureSnapshot = useCallback(async (type: 'before' | 'after', batchId?: string): Promise<MigrationSnapshot | null> => {
    setLoading(true);
    try {
      // Fetch savings data
      const { data: savingsData } = await supabase
        .from('savings_summary')
        .select('simpanan_pokok, simpanan_wajib, simpanan_sukarela, user_id');

      // Fetch loan data
      const { data: loanData } = await supabase
        .from('loans')
        .select('principal_amount, remaining_principal, status');

      // Fetch installment payments
      const { data: installmentData } = await supabase
        .from('loan_installments')
        .select('interest_amount, paid_amount, status')
        .eq('status', 'paid');

      // Fetch COA balances
      const { data: coaData } = await supabase
        .from('chart_of_accounts')
        .select('account_code, account_name, balance')
        .in('account_code', ['1-1000', '1-1100', '1-2000', '2-1010', '2-1020', '2-1030', '4-1000', '4-1010']);

      // Fetch journal entries
      const { data: journalData } = await supabase
        .from('journal_entries')
        .select('total_debit, total_credit, status')
        .eq('status', 'posted');

      // Calculate totals
      const savings = {
        totalPokok: savingsData?.reduce((sum, s) => sum + (s.simpanan_pokok || 0), 0) || 0,
        totalWajib: savingsData?.reduce((sum, s) => sum + (s.simpanan_wajib || 0), 0) || 0,
        totalSukarela: savingsData?.reduce((sum, s) => sum + (s.simpanan_sukarela || 0), 0) || 0,
        total: 0,
        memberCount: new Set(savingsData?.map(s => s.user_id)).size,
      };
      savings.total = savings.totalPokok + savings.totalWajib + savings.totalSukarela;

      const activeLoans = loanData?.filter(l => l.status === 'active') || [];
      const loans = {
        totalPrincipal: activeLoans.reduce((sum, l) => sum + (l.principal_amount || 0), 0),
        totalRemaining: activeLoans.reduce((sum, l) => sum + (l.remaining_principal || 0), 0),
        totalInterestPaid: installmentData?.reduce((sum, i) => sum + (i.interest_amount || 0), 0) || 0,
        loanCount: activeLoans.length,
      };

      const coaMap = new Map(coaData?.map(c => [c.account_code, c.balance || 0]));
      const coa = {
        simpananPokok: coaMap.get('2-1010') || 0,
        simpananWajib: coaMap.get('2-1020') || 0,
        simpananSukarela: coaMap.get('2-1030') || 0,
        piutangPinjaman: coaMap.get('1-2000') || 0,
        pendapatanBunga: coaMap.get('4-1000') || coaMap.get('4-1010') || 0,
        kas: (coaMap.get('1-1000') || 0) + (coaMap.get('1-1100') || 0),
      };

      const journals = {
        totalCount: journalData?.length || 0,
        totalDebit: journalData?.reduce((sum, j) => sum + (j.total_debit || 0), 0) || 0,
        totalCredit: journalData?.reduce((sum, j) => sum + (j.total_credit || 0), 0) || 0,
      };

      const snapshot: MigrationSnapshot = {
        timestamp: new Date().toISOString(),
        type,
        batchId,
        savings,
        loans,
        coa,
        journals,
      };

      setCurrentSnapshot(snapshot);
      return snapshot;
    } catch (error) {
      console.error('Error capturing snapshot:', error);
      toast.error('Gagal mengambil snapshot data');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Save snapshot to local storage
  const saveSnapshot = useCallback((snapshot: MigrationSnapshot) => {
    const snapshots = JSON.parse(localStorage.getItem('migration_snapshots') || '[]');
    snapshots.unshift(snapshot);
    // Keep only last 20 snapshots
    const trimmed = snapshots.slice(0, 20);
    localStorage.setItem('migration_snapshots', JSON.stringify(trimmed));
    setSavedSnapshots(trimmed);
    toast.success(`Snapshot ${snapshot.type === 'before' ? 'sebelum' : 'sesudah'} migrasi tersimpan`);
  }, []);

  // Load saved snapshots
  const loadSnapshots = useCallback(() => {
    const snapshots = JSON.parse(localStorage.getItem('migration_snapshots') || '[]');
    setSavedSnapshots(snapshots);
  }, []);

  // Delete single snapshot
  const deleteSnapshot = useCallback((timestamp: string) => {
    const snapshots = JSON.parse(localStorage.getItem('migration_snapshots') || '[]');
    const filtered = snapshots.filter((s: MigrationSnapshot) => s.timestamp !== timestamp);
    localStorage.setItem('migration_snapshots', JSON.stringify(filtered));
    setSavedSnapshots(filtered);
    
    // Clear comparison if deleted snapshot was used
    if (selectedBeforeId === timestamp || selectedAfterId === timestamp) {
      setComparison(null);
      if (selectedBeforeId === timestamp) setSelectedBeforeId('');
      if (selectedAfterId === timestamp) setSelectedAfterId('');
    }
    
    setSnapshotToDelete(null);
    toast.success('Snapshot berhasil dihapus');
  }, [selectedBeforeId, selectedAfterId]);

  // Compare two snapshots
  const compareSnapshots = useCallback((before: MigrationSnapshot, after: MigrationSnapshot): ReconciliationComparison => {
    const differences = {
      savings: {
        pokok: after.savings.totalPokok - before.savings.totalPokok,
        wajib: after.savings.totalWajib - before.savings.totalWajib,
        sukarela: after.savings.totalSukarela - before.savings.totalSukarela,
        total: after.savings.total - before.savings.total,
        memberDiff: after.savings.memberCount - before.savings.memberCount,
      },
      loans: {
        principal: after.loans.totalPrincipal - before.loans.totalPrincipal,
        remaining: after.loans.totalRemaining - before.loans.totalRemaining,
        interestPaid: after.loans.totalInterestPaid - before.loans.totalInterestPaid,
        loanDiff: after.loans.loanCount - before.loans.loanCount,
      },
      coa: {
        simpananPokok: after.coa.simpananPokok - before.coa.simpananPokok,
        simpananWajib: after.coa.simpananWajib - before.coa.simpananWajib,
        simpananSukarela: after.coa.simpananSukarela - before.coa.simpananSukarela,
        piutangPinjaman: after.coa.piutangPinjaman - before.coa.piutangPinjaman,
        pendapatanBunga: after.coa.pendapatanBunga - before.coa.pendapatanBunga,
        kas: after.coa.kas - before.coa.kas,
      },
      journals: {
        count: after.journals.totalCount - before.journals.totalCount,
        debit: after.journals.totalDebit - before.journals.totalDebit,
        credit: after.journals.totalCredit - before.journals.totalCredit,
      },
    };

    const discrepancies: string[] = [];

    // Check savings vs COA consistency
    if (Math.abs(differences.savings.pokok - differences.coa.simpananPokok) > 1) {
      discrepancies.push(`Selisih Simpanan Pokok: Data +${formatCurrency(differences.savings.pokok)} vs COA +${formatCurrency(differences.coa.simpananPokok)}`);
    }
    if (Math.abs(differences.savings.wajib - differences.coa.simpananWajib) > 1) {
      discrepancies.push(`Selisih Simpanan Wajib: Data +${formatCurrency(differences.savings.wajib)} vs COA +${formatCurrency(differences.coa.simpananWajib)}`);
    }
    if (Math.abs(differences.savings.sukarela - differences.coa.simpananSukarela) > 1) {
      discrepancies.push(`Selisih Simpanan Sukarela: Data +${formatCurrency(differences.savings.sukarela)} vs COA +${formatCurrency(differences.coa.simpananSukarela)}`);
    }

    // Check loan vs COA consistency
    if (Math.abs(differences.loans.remaining - differences.coa.piutangPinjaman) > 1) {
      discrepancies.push(`Selisih Piutang: Loan Data +${formatCurrency(differences.loans.remaining)} vs COA +${formatCurrency(differences.coa.piutangPinjaman)}`);
    }

    // Check journal balance
    if (Math.abs(differences.journals.debit - differences.journals.credit) > 1) {
      discrepancies.push(`Jurnal tidak seimbang: Debit +${formatCurrency(differences.journals.debit)} vs Credit +${formatCurrency(differences.journals.credit)}`);
    }

    return {
      before,
      after,
      differences,
      isBalanced: discrepancies.length === 0,
      discrepancies,
    };
  }, []);

  // Perform comparison from selected snapshots
  const performComparison = useCallback(() => {
    if (!selectedBeforeId || !selectedAfterId) {
      toast.error('Pilih snapshot sebelum dan sesudah untuk dibandingkan');
      return;
    }

    const before = savedSnapshots.find(s => s.timestamp === selectedBeforeId);
    const after = savedSnapshots.find(s => s.timestamp === selectedAfterId);

    if (!before || !after) {
      toast.error('Snapshot tidak ditemukan');
      return;
    }

    const result = compareSnapshots(before, after);
    setComparison(result);
    setActiveTab('comparison');
  }, [selectedBeforeId, selectedAfterId, savedSnapshots, compareSnapshots]);

  // Export comparison to Excel
  const exportToExcel = useCallback(async () => {
    if (!comparison) {
      toast.error('Tidak ada data perbandingan untuk diekspor');
      return;
    }

    // Summary sheet
    const summaryData = [
      ['LAPORAN REKONSILIASI MIGRASI'],
      [''],
      ['Snapshot Sebelum:', format(new Date(comparison.before!.timestamp), 'dd MMMM yyyy HH:mm', { locale: id })],
      ['Snapshot Sesudah:', format(new Date(comparison.after!.timestamp), 'dd MMMM yyyy HH:mm', { locale: id })],
      ['Status:', comparison.isBalanced ? 'SEIMBANG' : 'ADA SELISIH'],
      [''],
      ['RINGKASAN PERUBAHAN'],
      [''],
      ['Kategori', 'Sebelum', 'Sesudah', 'Perubahan'],
      ['Simpanan Pokok', comparison.before!.savings.totalPokok, comparison.after!.savings.totalPokok, comparison.differences.savings.pokok],
      ['Simpanan Wajib', comparison.before!.savings.totalWajib, comparison.after!.savings.totalWajib, comparison.differences.savings.wajib],
      ['Simpanan Sukarela', comparison.before!.savings.totalSukarela, comparison.after!.savings.totalSukarela, comparison.differences.savings.sukarela],
      ['Total Simpanan', comparison.before!.savings.total, comparison.after!.savings.total, comparison.differences.savings.total],
      [''],
      ['Piutang Pinjaman', comparison.before!.loans.totalRemaining, comparison.after!.loans.totalRemaining, comparison.differences.loans.remaining],
      ['Pendapatan Bunga', comparison.before!.loans.totalInterestPaid, comparison.after!.loans.totalInterestPaid, comparison.differences.loans.interestPaid],
      [''],
      ['Jurnal Entries', comparison.before!.journals.totalCount, comparison.after!.journals.totalCount, comparison.differences.journals.count],
      ['Total Debit', comparison.before!.journals.totalDebit, comparison.after!.journals.totalDebit, comparison.differences.journals.debit],
      ['Total Credit', comparison.before!.journals.totalCredit, comparison.after!.journals.totalCredit, comparison.differences.journals.credit],
    ];

    // COA Comparison sheet
    const coaData = [
      ['PERBANDINGAN BUKU BESAR (COA)'],
      [''],
      ['Akun', 'Sebelum', 'Sesudah', 'Perubahan'],
      ['Kas & Bank', comparison.before!.coa.kas, comparison.after!.coa.kas, comparison.differences.coa.kas],
      ['Piutang Pinjaman', comparison.before!.coa.piutangPinjaman, comparison.after!.coa.piutangPinjaman, comparison.differences.coa.piutangPinjaman],
      ['Simpanan Pokok', comparison.before!.coa.simpananPokok, comparison.after!.coa.simpananPokok, comparison.differences.coa.simpananPokok],
      ['Simpanan Wajib', comparison.before!.coa.simpananWajib, comparison.after!.coa.simpananWajib, comparison.differences.coa.simpananWajib],
      ['Simpanan Sukarela', comparison.before!.coa.simpananSukarela, comparison.after!.coa.simpananSukarela, comparison.differences.coa.simpananSukarela],
      ['Pendapatan Bunga', comparison.before!.coa.pendapatanBunga, comparison.after!.coa.pendapatanBunga, comparison.differences.coa.pendapatanBunga],
    ];

    const sheets: any[] = [
      { name: 'Ringkasan', data: summaryData },
      { name: 'Buku Besar', data: coaData },
    ];

    // Discrepancies sheet
    if (comparison.discrepancies.length > 0) {
      const discData = [
        ['DAFTAR KETIDAKSESUAIAN'],
        [''],
        ...comparison.discrepancies.map((d, i) => [i + 1, d]),
      ];
      sheets.push({ name: 'Ketidaksesuaian', data: discData });
    }

    await createAndDownloadExcelAoA(sheets, `Rekonsiliasi-Migrasi-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`);
    toast.success('Laporan berhasil diekspor');
  }, [comparison]);

  // Load snapshots on mount
  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const renderDifferenceValue = (value: number, isCurrency = true) => {
    const isPositive = value > 0;
    const isZero = Math.abs(value) < 1;
    
    return (
      <div className={`flex items-center gap-1 font-mono ${isZero ? 'text-muted-foreground' : isPositive ? 'text-success' : 'text-destructive'}`}>
        {!isZero && (isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
        {isPositive && '+'}
        {isCurrency ? formatCurrency(value) : value.toLocaleString('id-ID')}
      </div>
    );
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
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Laporan Rekonsiliasi Migrasi</h2>
            <p className="text-sm text-muted-foreground">
              Bandingkan data sebelum dan sesudah import
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {comparison && (
            <Button variant="outline" onClick={exportToExcel}>
              <FileDown className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 gap-1 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger 
            value="overview"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 transition-all"
          >
            <Database className="mr-2 h-4 w-4" />
            Snapshot
          </TabsTrigger>
          <TabsTrigger 
            value="comparison"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 transition-all"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Perbandingan
          </TabsTrigger>
          <TabsTrigger 
            value="history"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 transition-all"
          >
            <Clock className="mr-2 h-4 w-4" />
            Riwayat
          </TabsTrigger>
        </TabsList>

        {/* Snapshot Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Capture Before */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/20">
                    <span className="text-sm font-bold text-warning">1</span>
                  </div>
                  Snapshot Sebelum Import
                </CardTitle>
                <CardDescription>
                  Ambil snapshot data sebelum melakukan migrasi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={async () => {
                    const snapshot = await captureSnapshot('before');
                    if (snapshot) saveSnapshot(snapshot);
                  }}
                  disabled={loading}
                  className="w-full"
                  variant="outline"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="mr-2 h-4 w-4" />
                  )}
                  Ambil Snapshot Sebelum
                </Button>
              </CardContent>
            </Card>

            {/* Capture After */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/20">
                    <span className="text-sm font-bold text-success">2</span>
                  </div>
                  Snapshot Sesudah Import
                </CardTitle>
                <CardDescription>
                  Ambil snapshot data setelah migrasi selesai
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={async () => {
                    const snapshot = await captureSnapshot('after');
                    if (snapshot) saveSnapshot(snapshot);
                  }}
                  disabled={loading}
                  className="w-full"
                  variant="outline"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="mr-2 h-4 w-4" />
                  )}
                  Ambil Snapshot Sesudah
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Current Snapshot Preview */}
          {currentSnapshot && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preview Snapshot Terbaru</CardTitle>
                <CardDescription>
                  {format(new Date(currentSnapshot.timestamp), 'dd MMMM yyyy HH:mm:ss', { locale: id })} - 
                  <Badge variant="outline" className="ml-2">
                    {currentSnapshot.type === 'before' ? 'Sebelum' : 'Sesudah'}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wallet className="h-4 w-4" />
                      Total Simpanan
                    </div>
                    <p className="mt-1 text-xl font-bold">{formatCurrency(currentSnapshot.savings.total)}</p>
                    <p className="text-xs text-muted-foreground">{currentSnapshot.savings.memberCount} anggota</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CreditCard className="h-4 w-4" />
                      Piutang Pinjaman
                    </div>
                    <p className="mt-1 text-xl font-bold">{formatCurrency(currentSnapshot.loans.totalRemaining)}</p>
                    <p className="text-xs text-muted-foreground">{currentSnapshot.loans.loanCount} pinjaman aktif</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileSpreadsheet className="h-4 w-4" />
                      Jurnal Entries
                    </div>
                    <p className="mt-1 text-xl font-bold">{currentSnapshot.journals.totalCount.toLocaleString('id-ID')}</p>
                    <p className="text-xs text-muted-foreground">Total entry posted</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BarChart3 className="h-4 w-4" />
                      Kas & Bank
                    </div>
                    <p className="mt-1 text-xl font-bold">{formatCurrency(currentSnapshot.coa.kas)}</p>
                    <p className="text-xs text-muted-foreground">Saldo COA</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Compare */}
          {savedSnapshots.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bandingkan Snapshot</CardTitle>
                <CardDescription>Pilih dua snapshot untuk dibandingkan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Snapshot Sebelum</label>
                    <select
                      value={selectedBeforeId}
                      onChange={(e) => setSelectedBeforeId(e.target.value)}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Pilih snapshot...</option>
                      {savedSnapshots.map((s) => (
                        <option key={s.timestamp} value={s.timestamp}>
                          {format(new Date(s.timestamp), 'dd MMM yyyy HH:mm', { locale: id })} 
                          {' '}({s.type === 'before' ? 'Sebelum' : 'Sesudah'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Snapshot Sesudah</label>
                    <select
                      value={selectedAfterId}
                      onChange={(e) => setSelectedAfterId(e.target.value)}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Pilih snapshot...</option>
                      {savedSnapshots.map((s) => (
                        <option key={s.timestamp} value={s.timestamp}>
                          {format(new Date(s.timestamp), 'dd MMM yyyy HH:mm', { locale: id })} 
                          {' '}({s.type === 'before' ? 'Sebelum' : 'Sesudah'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button 
                  onClick={performComparison}
                  disabled={!selectedBeforeId || !selectedAfterId}
                  className="w-full"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Bandingkan Snapshot
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4 mt-4">
          {comparison ? (
            <>
              {/* Status Banner */}
              <Card className={comparison.isBalanced ? 'border-success/50 bg-success/5' : 'border-destructive/50 bg-destructive/5'}>
                <CardContent className="flex items-center gap-4 py-4">
                  {comparison.isBalanced ? (
                    <CheckCircle2 className="h-10 w-10 text-success" />
                  ) : (
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">
                      {comparison.isBalanced ? 'Data Seimbang' : 'Ditemukan Ketidaksesuaian'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {comparison.isBalanced 
                        ? 'Semua perubahan data konsisten dengan perubahan buku besar'
                        : `${comparison.discrepancies.length} masalah ditemukan`
                      }
                    </p>
                  </div>
                  <Badge variant={comparison.isBalanced ? 'default' : 'destructive'}>
                    {comparison.isBalanced ? 'PASS' : 'FAIL'}
                  </Badge>
                </CardContent>
              </Card>

              {/* Discrepancies List */}
              {comparison.discrepancies.length > 0 && (
                <Card className="border-destructive/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-5 w-5" />
                      Daftar Ketidaksesuaian
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {comparison.discrepancies.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Comparison Tables */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Savings Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Wallet className="h-5 w-5 text-primary" />
                      Perbandingan Simpanan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Jenis</TableHead>
                          <TableHead className="text-right">Sebelum</TableHead>
                          <TableHead className="text-right">Sesudah</TableHead>
                          <TableHead className="text-right">Perubahan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Simpanan Pokok</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.savings.totalPokok)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.savings.totalPokok)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.savings.pokok)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Simpanan Wajib</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.savings.totalWajib)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.savings.totalWajib)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.savings.wajib)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Simpanan Sukarela</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.savings.totalSukarela)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.savings.totalSukarela)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.savings.sukarela)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50 font-medium">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.savings.total)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.savings.total)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.savings.total)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Jumlah Anggota</TableCell>
                          <TableCell className="text-right">{comparison.before!.savings.memberCount}</TableCell>
                          <TableCell className="text-right">{comparison.after!.savings.memberCount}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.savings.memberDiff, false)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Loans Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CreditCard className="h-5 w-5 text-primary" />
                      Perbandingan Pinjaman
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kategori</TableHead>
                          <TableHead className="text-right">Sebelum</TableHead>
                          <TableHead className="text-right">Sesudah</TableHead>
                          <TableHead className="text-right">Perubahan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Total Pokok</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.loans.totalPrincipal)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.loans.totalPrincipal)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.loans.principal)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Sisa Piutang</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.loans.totalRemaining)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.loans.totalRemaining)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.loans.remaining)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Bunga Terbayar</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.loans.totalInterestPaid)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.loans.totalInterestPaid)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.loans.interestPaid)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Jumlah Pinjaman</TableCell>
                          <TableCell className="text-right">{comparison.before!.loans.loanCount}</TableCell>
                          <TableCell className="text-right">{comparison.after!.loans.loanCount}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.loans.loanDiff, false)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* COA Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      Perbandingan Buku Besar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Akun</TableHead>
                          <TableHead className="text-right">Sebelum</TableHead>
                          <TableHead className="text-right">Sesudah</TableHead>
                          <TableHead className="text-right">Perubahan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Kas & Bank</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.coa.kas)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.coa.kas)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.coa.kas)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Piutang Pinjaman</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.coa.piutangPinjaman)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.coa.piutangPinjaman)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.coa.piutangPinjaman)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Simpanan Pokok</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.coa.simpananPokok)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.coa.simpananPokok)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.coa.simpananPokok)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Simpanan Wajib</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.coa.simpananWajib)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.coa.simpananWajib)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.coa.simpananWajib)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Simpanan Sukarela</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.coa.simpananSukarela)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.coa.simpananSukarela)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.coa.simpananSukarela)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Pendapatan Bunga</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.coa.pendapatanBunga)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.coa.pendapatanBunga)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.coa.pendapatanBunga)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Journal Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Perbandingan Jurnal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metrik</TableHead>
                          <TableHead className="text-right">Sebelum</TableHead>
                          <TableHead className="text-right">Sesudah</TableHead>
                          <TableHead className="text-right">Perubahan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Jumlah Entry</TableCell>
                          <TableCell className="text-right">{comparison.before!.journals.totalCount.toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right">{comparison.after!.journals.totalCount.toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.journals.count, false)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Total Debit</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.journals.totalDebit)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.journals.totalDebit)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.journals.debit)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Total Credit</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.before!.journals.totalCredit)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(comparison.after!.journals.totalCredit)}</TableCell>
                          <TableCell className="text-right">{renderDifferenceValue(comparison.differences.journals.credit)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-medium">Balance (D-C)</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(comparison.before!.journals.totalDebit - comparison.before!.journals.totalCredit)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(comparison.after!.journals.totalDebit - comparison.after!.journals.totalCredit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderDifferenceValue(comparison.differences.journals.debit - comparison.differences.journals.credit)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">Belum Ada Perbandingan</h3>
                <p className="text-muted-foreground">
                  Ambil snapshot sebelum dan sesudah migrasi, lalu bandingkan.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setActiveTab('overview')}
                >
                  Ke Tab Snapshot
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Riwayat Snapshot</CardTitle>
                  <CardDescription>
                    Daftar snapshot yang tersimpan (maks 20 terbaru)
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem('migration_snapshots');
                    setSavedSnapshots([]);
                    toast.success('Riwayat snapshot dihapus');
                  }}
                  disabled={savedSnapshots.length === 0}
                >
                  Hapus Semua
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {savedSnapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">Belum ada snapshot tersimpan</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {savedSnapshots.map((snapshot, idx) => (
                      <div 
                        key={snapshot.timestamp} 
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${snapshot.type === 'before' ? 'bg-warning/20' : 'bg-success/20'}`}>
                            <Database className={`h-5 w-5 ${snapshot.type === 'before' ? 'text-warning' : 'text-success'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {format(new Date(snapshot.timestamp), 'dd MMMM yyyy HH:mm:ss', { locale: id })}
                              </p>
                              <Badge variant={snapshot.type === 'before' ? 'secondary' : 'default'}>
                                {snapshot.type === 'before' ? 'Sebelum' : 'Sesudah'}
                              </Badge>
                            </div>
                            <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {snapshot.savings.memberCount} anggota
                              </span>
                              <span className="flex items-center gap-1">
                                <Wallet className="h-3 w-3" />
                                {formatCurrency(snapshot.savings.total)}
                              </span>
                              <span className="flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                {snapshot.loans.loanCount} pinjaman
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setSnapshotToDelete(snapshot)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      {snapshotToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Hapus Snapshot</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Apakah Anda yakin ingin menghapus snapshot ini?
            </p>
            <div className="mt-4 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Badge variant={snapshotToDelete.type === 'before' ? 'secondary' : 'default'}>
                  {snapshotToDelete.type === 'before' ? 'Sebelum' : 'Sesudah'}
                </Badge>
                <span className="text-sm">
                  {format(new Date(snapshotToDelete.timestamp), 'dd MMMM yyyy HH:mm', { locale: id })}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Total Simpanan: {formatCurrency(snapshotToDelete.savings.total)}
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSnapshotToDelete(null)}>
                Batal
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteSnapshot(snapshotToDelete.timestamp)}
              >
                Hapus
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
