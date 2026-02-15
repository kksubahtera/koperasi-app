import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Gift, 
  Calendar,
  TrendingDown,
  Users,
  FileText,
  Download,
  BookOpen
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useJournalTemplates, createJournalFromTransaction } from '@/hooks/useJournalTemplates';
import { useQueryClient } from '@tanstack/react-query';

interface AdjustmentRecord {
  id: string;
  installment_id: string;
  loan_id: string;
  user_id: string;
  original_interest_amount: number;
  original_penalty_amount: number;
  adjusted_interest_amount: number;
  adjusted_penalty_amount: number;
  interest_reduction: number;
  penalty_reduction: number;
  reason: string;
  adjusted_by: string | null;
  created_at: string;
  member_name?: string;
  member_number?: string;
  installment_number?: number;
}

interface MonthlySummary {
  month: string;
  year: number;
  monthNum: number;
  totalInterestReduction: number;
  totalPenaltyReduction: number;
  totalReduction: number;
  adjustmentCount: number;
  memberCount: number;
  hasJournal: boolean;
}

export const LoanAdjustmentReport = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { getTemplateByType } = useJournalTemplates();
  
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [journalStatuses, setJournalStatuses] = useState<Record<string, boolean>>({});
  const [isCreatingJournal, setIsCreatingJournal] = useState<string | null>(null);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  useEffect(() => {
    fetchAdjustments();
  }, [selectedYear]);

  const fetchAdjustments = async () => {
    setIsLoading(true);
    try {
      // Fetch adjustment history for the selected year
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      const { data: adjustmentData, error: adjustmentError } = await supabase
        .from('loan_adjustment_history')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false });

      if (adjustmentError) throw adjustmentError;

      // Fetch member profiles for display
      const userIds = [...new Set(adjustmentData?.map(a => a.user_id) || [])];
      let profilesMap: Record<string, { name: string; member_number: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name, member_number')
          .in('user_id', userIds);
        
        profiles?.forEach(p => {
          profilesMap[p.user_id] = { name: p.name, member_number: p.member_number || '-' };
        });
      }

      // Fetch installment numbers
      const installmentIds = [...new Set(adjustmentData?.map(a => a.installment_id) || [])];
      let installmentMap: Record<string, number> = {};
      
      if (installmentIds.length > 0) {
        const { data: installments } = await supabase
          .from('loan_installments')
          .select('id, installment_number')
          .in('id', installmentIds);
        
        installments?.forEach(i => {
          installmentMap[i.id] = i.installment_number;
        });
      }

      // Combine data
      const enrichedData = adjustmentData?.map(adj => ({
        ...adj,
        member_name: profilesMap[adj.user_id]?.name || 'Unknown',
        member_number: profilesMap[adj.user_id]?.member_number || '-',
        installment_number: installmentMap[adj.installment_id] || 0,
      })) || [];

      setAdjustments(enrichedData);

      // Check for existing journals
      await checkJournalStatuses();
    } catch (error) {
      console.error('Error fetching adjustments:', error);
      toast({
        title: 'Gagal Memuat Data',
        description: 'Terjadi kesalahan saat memuat data keringanan.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkJournalStatuses = async () => {
    try {
      // Check for journals with reference_type = 'keringanan_pinjaman'
      const { data: journals } = await supabase
        .from('journal_entries')
        .select('reference_id, reference_type')
        .eq('reference_type', 'keringanan_pinjaman')
        .gte('entry_date', `${selectedYear}-01-01`)
        .lte('entry_date', `${selectedYear}-12-31`);

      const statuses: Record<string, boolean> = {};
      journals?.forEach(j => {
        if (j.reference_id) {
          statuses[j.reference_id] = true;
        }
      });
      setJournalStatuses(statuses);
    } catch (error) {
      console.error('Error checking journal statuses:', error);
    }
  };

  // Group adjustments by month
  const monthlySummaries: MonthlySummary[] = useMemo(() => {
    const summaryMap = new Map<string, MonthlySummary>();

    adjustments.forEach(adj => {
      const date = new Date(adj.created_at);
      const monthNum = date.getMonth();
      const key = `${selectedYear}-${monthNum}`;

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          month: monthNames[monthNum],
          year: selectedYear,
          monthNum,
          totalInterestReduction: 0,
          totalPenaltyReduction: 0,
          totalReduction: 0,
          adjustmentCount: 0,
          memberCount: 0,
          hasJournal: journalStatuses[key] || false,
        });
      }

      const summary = summaryMap.get(key)!;
      summary.totalInterestReduction += adj.interest_reduction;
      summary.totalPenaltyReduction += adj.penalty_reduction;
      summary.totalReduction += adj.interest_reduction + adj.penalty_reduction;
      summary.adjustmentCount += 1;
    });

    // Calculate unique members per month
    const membersByMonth = new Map<string, Set<string>>();
    adjustments.forEach(adj => {
      const date = new Date(adj.created_at);
      const key = `${selectedYear}-${date.getMonth()}`;
      if (!membersByMonth.has(key)) {
        membersByMonth.set(key, new Set());
      }
      membersByMonth.get(key)!.add(adj.user_id);
    });

    membersByMonth.forEach((members, key) => {
      const summary = summaryMap.get(key);
      if (summary) {
        summary.memberCount = members.size;
        summary.hasJournal = journalStatuses[key] || false;
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.monthNum - a.monthNum);
  }, [adjustments, selectedYear, journalStatuses]);

  // Yearly totals
  const yearlyTotals = useMemo(() => {
    return {
      totalInterestReduction: adjustments.reduce((sum, a) => sum + a.interest_reduction, 0),
      totalPenaltyReduction: adjustments.reduce((sum, a) => sum + a.penalty_reduction, 0),
      totalReduction: adjustments.reduce((sum, a) => sum + a.interest_reduction + a.penalty_reduction, 0),
      adjustmentCount: adjustments.length,
      memberCount: new Set(adjustments.map(a => a.user_id)).size,
    };
  }, [adjustments]);

  const handleCreateJournal = async (summary: MonthlySummary) => {
    if (!user) return;
    
    const key = `${summary.year}-${summary.monthNum}`;
    setIsCreatingJournal(key);

    try {
      // Generate journal entry number
      const { data: entryNumber } = await supabase.rpc('generate_journal_entry_number');

      // Create journal entry
      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber || `JRN-KEL-${summary.year}${String(summary.monthNum + 1).padStart(2, '0')}`,
          entry_date: new Date(summary.year, summary.monthNum + 1, 0).toISOString().split('T')[0], // Last day of month
          description: `Keringanan Pinjaman ${summary.month} ${summary.year}`,
          reference_type: 'keringanan_pinjaman',
          reference_id: key,
          status: 'posted',
          total_debit: summary.totalReduction,
          total_credit: summary.totalReduction,
          is_balanced: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (journalError) throw journalError;

      // Get or create accounts for journal lines
      // We need: Beban Keringanan Pinjaman (expense) and Piutang Bunga (asset reduction)
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('id, account_code, account_name, account_type')
        .or('account_code.eq.6500,account_code.eq.1300');

      let bebanKeringananId = accounts?.find(a => a.account_code === '6500')?.id;
      let piutangBungaId = accounts?.find(a => a.account_code === '1300')?.id;

      // Create accounts if they don't exist
      if (!bebanKeringananId) {
        const { data: newAccount } = await supabase
          .from('chart_of_accounts')
          .insert({
            account_code: '6500',
            account_name: 'Beban Keringanan Pinjaman',
            account_type: 'expense',
            description: 'Beban dari keringanan bunga dan denda pinjaman',
            is_active: true,
            is_system: true,
          })
          .select()
          .single();
        bebanKeringananId = newAccount?.id;
      }

      if (!piutangBungaId) {
        const { data: newAccount } = await supabase
          .from('chart_of_accounts')
          .insert({
            account_code: '1300',
            account_name: 'Piutang Bunga',
            account_type: 'asset',
            description: 'Piutang bunga dari pinjaman anggota',
            is_active: true,
            is_system: true,
          })
          .select()
          .single();
        piutangBungaId = newAccount?.id;
      }

      // Create journal entry lines
      const journalLines = [];
      
      if (bebanKeringananId) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: bebanKeringananId,
          description: `Keringanan bunga: ${formatCurrency(summary.totalInterestReduction)}, denda: ${formatCurrency(summary.totalPenaltyReduction)}`,
          debit_amount: summary.totalReduction,
          credit_amount: 0,
        });
      }

      if (piutangBungaId) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: piutangBungaId,
          description: `Pengurangan piutang bunga/denda dari keringanan`,
          debit_amount: 0,
          credit_amount: summary.totalReduction,
        });
      }

      if (journalLines.length > 0) {
        await supabase.from('journal_entry_lines').insert(journalLines);
      }

      setJournalStatuses(prev => ({ ...prev, [key]: true }));
      
      toast({
        title: 'Jurnal Berhasil Dibuat',
        description: `Jurnal keringanan ${summary.month} ${summary.year} telah dibuat dengan nomor ${journalEntry.entry_number}.`,
      });

      await queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    } catch (error) {
      console.error('Error creating journal:', error);
      toast({
        title: 'Gagal Membuat Jurnal',
        description: 'Terjadi kesalahan saat membuat jurnal keringanan.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingJournal(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Laporan Keringanan Pinjaman</h1>
          <p className="text-muted-foreground">Rekap keringanan bunga dan denda per periode</p>
        </div>
        <Select
          value={String(selectedYear)}
          onValueChange={(val) => setSelectedYear(parseInt(val))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={String(year)}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <TrendingDown className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(yearlyTotals.totalReduction)}</p>
                <p className="text-sm text-muted-foreground">Total Keringanan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Gift className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{yearlyTotals.adjustmentCount}</p>
                <p className="text-sm text-muted-foreground">Total Keringanan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{yearlyTotals.memberCount}</p>
                <p className="text-sm text-muted-foreground">Anggota Dibantu</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{monthlySummaries.length}</p>
                <p className="text-sm text-muted-foreground">Bulan Aktif</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rekap Bulanan {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlySummaries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Tidak ada data keringanan pada tahun {selectedYear}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bulan</TableHead>
                    <TableHead className="text-right">Keringanan Bunga</TableHead>
                    <TableHead className="text-right">Keringanan Denda</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Jumlah</TableHead>
                    <TableHead className="text-center">Anggota</TableHead>
                    <TableHead className="text-center">Jurnal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlySummaries.map((summary) => (
                    <TableRow key={`${summary.year}-${summary.monthNum}`}>
                      <TableCell className="font-medium">{summary.month}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(summary.totalInterestReduction)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(summary.totalPenaltyReduction)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatCurrency(summary.totalReduction)}
                      </TableCell>
                      <TableCell className="text-center">{summary.adjustmentCount}</TableCell>
                      <TableCell className="text-center">{summary.memberCount}</TableCell>
                      <TableCell className="text-center">
                        {summary.hasJournal ? (
                          <Badge className="bg-green-600">Tercatat</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateJournal(summary)}
                            disabled={isCreatingJournal === `${summary.year}-${summary.monthNum}`}
                          >
                            {isCreatingJournal === `${summary.year}-${summary.monthNum}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <BookOpen className="h-4 w-4 mr-1" />
                                Buat Jurnal
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL {selectedYear}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(yearlyTotals.totalInterestReduction)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(yearlyTotals.totalPenaltyReduction)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(yearlyTotals.totalReduction)}
                    </TableCell>
                    <TableCell className="text-center">{yearlyTotals.adjustmentCount}</TableCell>
                    <TableCell className="text-center">{yearlyTotals.memberCount}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Table */}
      {adjustments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Detail Keringanan {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Anggota</TableHead>
                    <TableHead className="text-center">Angsuran</TableHead>
                    <TableHead className="text-right">Keringanan Bunga</TableHead>
                    <TableHead className="text-right">Keringanan Denda</TableHead>
                    <TableHead>Alasan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.slice(0, 50).map((adj) => (
                    <TableRow key={adj.id}>
                      <TableCell className="text-sm">
                        {new Date(adj.created_at).toLocaleDateString('id-ID')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{adj.member_name}</p>
                          <p className="text-xs text-muted-foreground">{adj.member_number}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">#{adj.installment_number}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(adj.interest_reduction)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(adj.penalty_reduction)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {adj.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {adjustments.length > 50 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Menampilkan 50 dari {adjustments.length} data
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
