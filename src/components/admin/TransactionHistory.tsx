import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/filter-select';
import { formatCurrency, formatShortDate, getTransactionTypeLabel } from '@/lib/mockData';
import { 
  CheckCircle, XCircle, Clock, User, Loader2, 
  FileText, BookOpen, AlertCircle, ExternalLink, History, RefreshCw
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InfiniteScrollLoader } from '@/components/shared/InfiniteScrollLoader';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { ExportButton } from '@/components/shared/ExportButton';
import { ExportTransaction } from '@/lib/exportUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAutoJournalFromTransaction, TransactionData } from '@/hooks/useAutoJournalFromTransaction';
import { TemplateType } from '@/hooks/useJournalTemplates';
import { toast } from 'sonner';

interface TransactionWithProfile {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  date: string | null;
  status: string;
  payment_method: string;
  account_holder_name: string | null;
  notes: string | null;
  created_at: string | null;
  approved_at?: string | null;
  installment_id: string | null;
  profiles: {
    name: string;
    member_number: string | null;
  } | null;
}

interface TransactionHistoryProps {
  transactions: TransactionWithProfile[];
  isLoading?: boolean;
  isFetchingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => Promise<void>;
}

// Helper to extract journal number from notes
const getJournalNumber = (notes: string | null): string | null => {
  if (!notes) return null;
  const match = notes.match(/Jurnal:\s*(JRN-[\w-]+)/);
  return match ? match[1] : null;
};

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'approved':
      return (
        <Badge variant="success" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          <CheckCircle className="mr-1 h-3 w-3" />
          Disetujui
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="destructive" className="bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
          <XCircle className="mr-1 h-3 w-3" />
          Ditolak
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      );
  }
};

// Journal status indicator component
const JournalIndicator = ({ 
  notes, 
  transaction,
  onRegenerate 
}: { 
  notes: string | null; 
  transaction: TransactionWithProfile;
  onRegenerate: (transaction: TransactionWithProfile) => Promise<void>;
}) => {
  const journalNumber = getJournalNumber(notes);
  const [showDetail, setShowDetail] = useState(false);
  const [journalDetail, setJournalDetail] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleViewJournal = async () => {
    if (!journalNumber) return;
    
    setIsLoadingDetail(true);
    try {
      const { data: journal } = await supabase
        .from('journal_entries')
        .select(`
          *,
          lines:journal_entry_lines(
            id, debit_amount, credit_amount, description,
            account:chart_of_accounts(account_code, account_name)
          )
        `)
        .eq('entry_number', journalNumber)
        .maybeSingle();
      
      if (journal) {
        setJournalDetail(journal);
        setShowDetail(true);
      }
    } catch (error) {
      console.error('Error fetching journal:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate(transaction);
    } finally {
      setIsRegenerating(false);
    }
  };
  
  if (journalNumber) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
              onClick={handleViewJournal}
              disabled={isLoadingDetail}
            >
              {isLoadingDetail ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <BookOpen className="h-3 w-3 mr-1" />
                  <span className="text-xs font-mono">{journalNumber}</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Jurnal otomatis sudah dibuat. Klik untuk lihat detail.</p>
          </TooltipContent>
        </Tooltip>
        
        {/* Journal Detail Dialog */}
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Detail Jurnal {journalNumber}
              </DialogTitle>
            </DialogHeader>
            {journalDetail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tanggal</p>
                    <p className="font-medium">{formatShortDate(journalDetail.entry_date)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant="success" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {journalDetail.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Keterangan</p>
                  <p className="font-medium">{journalDetail.description}</p>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">Akun</th>
                        <th className="px-3 py-2 text-right">Debit</th>
                        <th className="px-3 py-2 text-right">Kredit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {journalDetail.lines?.map((line: any) => (
                        <tr key={line.id}>
                          <td className="px-3 py-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {line.account?.account_code}
                            </span>
                            <span className="ml-2">{line.account?.account_name}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 font-medium">
                      <tr>
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(journalDetail.total_debit)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(journalDetail.total_credit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/50"
          onClick={handleRegenerate}
          disabled={isRegenerating}
        >
          {isRegenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-1" />
              <span className="text-xs">Buat Jurnal</span>
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Jurnal belum dibuat. Klik untuk generate jurnal sekarang.</p>
      </TooltipContent>
    </Tooltip>
  );
};

export const TransactionHistory = ({ 
  transactions, 
  isLoading, 
  isFetchingMore, 
  hasMore, 
  onLoadMore, 
  onRefresh 
}: TransactionHistoryProps) => {
  const { t } = useThemeLanguage();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { createJournalOnApproval, getInstallmentData, isTemplateReady } = useAutoJournalFromTransaction();

  // Handle regenerate journal
  const handleRegenerateJournal = async (transaction: TransactionWithProfile) => {
    const templateType = transaction.type as TemplateType;
    
    // Check if template is ready
    if (!isTemplateReady(templateType)) {
      toast.error('Template jurnal belum dikonfigurasi', {
        description: 'Silakan konfigurasi template jurnal terlebih dahulu di menu Akuntansi > Template Jurnal'
      });
      return;
    }

    const transactionData: TransactionData = {
      id: transaction.id,
      type: templateType,
      amount: transaction.amount,
      user_id: transaction.user_id,
      memberName: transaction.profiles?.name || 'Unknown',
      installment_id: transaction.installment_id || undefined,
    };

    // Get installment data if needed
    let installmentData = undefined;
    if (transaction.type === 'bayar_angsuran_pinjaman' && transaction.installment_id) {
      installmentData = await getInstallmentData(transaction.installment_id) || undefined;
    }

    const result = await createJournalOnApproval(transactionData, installmentData);

    if (result.success && result.journalNumber) {
      toast.success('Jurnal berhasil dibuat', {
        description: `Nomor jurnal: ${result.journalNumber}`
      });
      
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      await queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
      
      if (onRefresh) {
        await onRefresh();
      }
    } else {
      toast.error('Gagal membuat jurnal', {
        description: 'Pastikan template jurnal sudah dikonfigurasi dengan benar'
      });
    }
  };

  // Filter to non-pending transactions
  const historyTransactions = transactions.filter(t => t.status !== 'pending');
  
  const filteredTransactions = historyTransactions.filter(t => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      t.profiles?.name?.toLowerCase().includes(searchLower) ||
      t.profiles?.member_number?.toLowerCase().includes(searchLower) ||
      getTransactionTypeLabel(t.type as any).toLowerCase().includes(searchLower) ||
      (t.notes && t.notes.toLowerCase().includes(searchLower));
    
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Get transactions without journal
  const transactionsWithoutJournal = useMemo(() => {
    return historyTransactions.filter(t => 
      t.status === 'approved' && !getJournalNumber(t.notes)
    );
  }, [historyTransactions]);

  // Bulk regenerate state
  const [isBulkRegenerating, setIsBulkRegenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  // Handle bulk regenerate
  const handleBulkRegenerate = async () => {
    if (transactionsWithoutJournal.length === 0) return;

    setIsBulkRegenerating(true);
    setBulkProgress({ current: 0, total: transactionsWithoutJournal.length, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < transactionsWithoutJournal.length; i++) {
      const transaction = transactionsWithoutJournal[i];
      const templateType = transaction.type as TemplateType;

      // Check if template is ready
      if (!isTemplateReady(templateType)) {
        failedCount++;
        setBulkProgress(prev => ({ ...prev, current: i + 1, failed: failedCount }));
        continue;
      }

      const transactionData: TransactionData = {
        id: transaction.id,
        type: templateType,
        amount: transaction.amount,
        user_id: transaction.user_id,
        memberName: transaction.profiles?.name || 'Unknown',
        installment_id: transaction.installment_id || undefined,
      };

      // Get installment data if needed
      let installmentData = undefined;
      if (transaction.type === 'bayar_angsuran_pinjaman' && transaction.installment_id) {
        installmentData = await getInstallmentData(transaction.installment_id) || undefined;
      }

      const result = await createJournalOnApproval(transactionData, installmentData);

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }

      setBulkProgress(prev => ({ 
        ...prev, 
        current: i + 1, 
        success: successCount,
        failed: failedCount 
      }));
    }

    setIsBulkRegenerating(false);

    if (successCount > 0) {
      toast.success(`Berhasil membuat ${successCount} jurnal`, {
        description: failedCount > 0 ? `${failedCount} transaksi gagal (template belum dikonfigurasi)` : undefined
      });
      
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      await queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
      
      if (onRefresh) {
        await onRefresh();
      }
    } else if (failedCount > 0) {
      toast.error('Gagal membuat jurnal', {
        description: 'Pastikan semua template jurnal sudah dikonfigurasi dengan benar'
      });
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const approved = historyTransactions.filter(t => t.status === 'approved');
    const withJournal = approved.filter(t => getJournalNumber(t.notes));
    
    return {
      total: historyTransactions.length,
      approved: approved.length,
      rejected: historyTransactions.filter(t => t.status === 'rejected').length,
      withJournal: withJournal.length,
      withoutJournal: approved.length - withJournal.length,
    };
  }, [historyTransactions]);

  // Prepare export data
  const exportData: ExportTransaction[] = useMemo(() => 
    filteredTransactions.map(t => ({
      id: t.id,
      memberName: t.profiles?.name || undefined,
      memberNumber: t.profiles?.member_number || undefined,
      type: t.type,
      amount: t.amount,
      date: t.date,
      status: t.status,
      paymentMethod: t.payment_method,
      accountHolderName: t.account_holder_name,
      notes: t.notes,
      createdAt: t.created_at,
    })), [filteredTransactions]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="p-3 sm:p-4 md:p-6">
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <History className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                <span className="truncate">{t('Riwayat Transaksi', 'Transaction History')}</span>
              </CardTitle>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground truncate">
                {historyTransactions.length} {t('transaksi selesai diproses', 'transactions processed')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Bulk regenerate button */}
              {stats.withoutJournal > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkRegenerate}
                      disabled={isBulkRegenerating}
                      className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950/50"
                    >
                      {isBulkRegenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {bulkProgress.current}/{bulkProgress.total}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Buat Semua Jurnal ({stats.withoutJournal})
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Buat jurnal untuk semua transaksi yang belum memiliki jurnal</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* Stats badges */}
              <div className="flex gap-1">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <BookOpen className="h-3 w-3 mr-1" />
                  {stats.withJournal} jurnal
                </Badge>
                {stats.withoutJournal > 0 && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {stats.withoutJournal} tanpa jurnal
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Bulk progress indicator */}
          {isBulkRegenerating && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">
                  Membuat jurnal... {bulkProgress.current} dari {bulkProgress.total}
                </span>
                <div className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ✓ {bulkProgress.success}
                  </span>
                  {bulkProgress.failed > 0 && (
                    <span className="text-rose-600 dark:text-rose-400">
                      ✗ {bulkProgress.failed}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mt-3 sm:mt-4">
            <SearchInput
              placeholder={t('Cari transaksi...', 'Search transactions...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              containerClassName="flex-1"
            />
            <div className="flex gap-1.5 sm:gap-2">
              <FilterSelect
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={[
                  { value: 'approved', label: 'Disetujui' },
                  { value: 'rejected', label: 'Ditolak' },
                ]}
                placeholder="Status"
                allLabel="Semua Status"
                triggerClassName="w-full sm:w-36 md:w-40 text-xs sm:text-sm"
              />
              <ExportButton 
                transactions={exportData}
                filename="riwayat-transaksi"
                title={t('Riwayat Transaksi', 'Transaction History')}
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {isMobile && onRefresh ? (
            <PullToRefresh onRefresh={onRefresh} className="max-h-[60vh]">
              {filteredTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {search ? 'Tidak ada transaksi yang cocok' : 'Belum ada riwayat transaksi'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredTransactions.map((transaction) => (
                    <TransactionRow 
                      key={transaction.id} 
                      transaction={transaction} 
                      onRegenerate={handleRegenerateJournal}
                    />
                  ))}
                  <InfiniteScrollLoader
                    isFetching={isFetchingMore || false}
                    hasMore={hasMore || false}
                    onLoadMore={onLoadMore}
                  />
                </div>
              )}
            </PullToRefresh>
          ) : (
            filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {search ? 'Tidak ada transaksi yang cocok' : 'Belum ada riwayat transaksi'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTransactions.map((transaction) => (
                  <TransactionRow 
                    key={transaction.id} 
                    transaction={transaction} 
                    onRegenerate={handleRegenerateJournal}
                  />
                ))}
                <InfiniteScrollLoader
                  isFetching={isFetchingMore || false}
                  hasMore={hasMore || false}
                  onLoadMore={onLoadMore}
                />
              </div>
            )
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

// Separate row component for cleaner code
const TransactionRow = ({ 
  transaction, 
  onRegenerate 
}: { 
  transaction: TransactionWithProfile;
  onRegenerate: (transaction: TransactionWithProfile) => Promise<void>;
}) => {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">{transaction.profiles?.name || 'Unknown'}</p>
          <p className="text-sm text-muted-foreground">{transaction.profiles?.member_number || '-'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={transaction.status} />
            <span className="text-sm text-muted-foreground">
              {getTransactionTypeLabel(transaction.type as any)}
            </span>
            {/* Journal indicator for approved transactions */}
            {transaction.status === 'approved' && (
              <JournalIndicator 
                notes={transaction.notes} 
                transaction={transaction}
                onRegenerate={onRegenerate}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <p className="text-lg font-bold text-foreground">
          {formatCurrency(transaction.amount)}
        </p>
        <p className="text-sm text-muted-foreground">
          {transaction.date ? formatShortDate(transaction.date) : '-'}
        </p>
        <p className="text-xs text-muted-foreground">
          via {transaction.payment_method === 'transfer_bank' ? 'Transfer Bank' : 'E-Wallet'}
        </p>
      </div>
    </div>
  );
};
