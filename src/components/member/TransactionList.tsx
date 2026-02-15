import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Transaction, CorrectionType, CorrectionStatus } from '@/lib/types';
import { formatCurrency, formatShortDate, getTransactionTypeLabel, getStatusLabel, formatDate } from '@/lib/mockData';
import { ArrowDownLeft, ArrowUpRight, Clock, CheckCircle, XCircle, Receipt, PenLine, Flag, AlertTriangle, CheckCircle2, ArrowUpDown, Filter, Wallet, CreditCard, ArrowDown, FileText, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { TransactionReceipt } from './TransactionReceipt';
import { ExportButton } from '@/components/shared/ExportButton';
import { ExportTransaction } from '@/lib/exportUtils';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WithdrawalConfirmation } from '@/components/shared/WithdrawalConfirmation';
import { useUserSavings } from '@/hooks/useUserSavings';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TransactionListProps {
  transactions: Transaction[];
  showAll?: boolean;
}

interface CorrectionFromDB {
  id: string;
  user_id: string;
  correction_type: CorrectionType;
  operation: 'add' | 'subtract';
  amount: number;
  current_balance: number;
  new_balance: number;
  reason: string;
  footnote: string | null;
  installment_id: string | null;
  installment_number: number | null;
  created_at: string;
  created_by: string | null;
  status: CorrectionStatus;
  reported_at: string | null;
  report_reason: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  correction_mode: 'nominal' | 'transaction_based' | null;
  transaction_id: string | null;
  // Joined from transactions table
  original_tx_date?: string | null;
  original_tx_type?: string | null;
  original_tx_amount?: number | null;
}

type FilterType = 'semua' | 'simpanan' | 'angsuran' | 'penarikan' | 'koreksi';

const correctionTypeLabels: Record<CorrectionType, { id: string; en: string }> = {
  'simpanan_pokok': { id: 'Simpanan Pokok', en: 'Principal Savings' },
  'simpanan_wajib': { id: 'Simpanan Wajib', en: 'Mandatory Savings' },
  'simpanan_sukarela': { id: 'Simpanan Sukarela', en: 'Voluntary Savings' },
  'angsuran_pinjaman': { id: 'Angsuran Pinjaman', en: 'Loan Installment' },
};

const correctionStatusLabels: Record<CorrectionStatus, { label: { id: string; en: string }; variant: 'success' | 'warning' | 'secondary' }> = {
  'applied': { label: { id: 'Diterapkan', en: 'Applied' }, variant: 'success' },
  'reported': { label: { id: 'Dilaporkan', en: 'Reported' }, variant: 'warning' },
  'resolved': { label: { id: 'Diselesaikan', en: 'Resolved' }, variant: 'secondary' },
  'resolved_approved': { label: { id: 'Disetujui', en: 'Approved' }, variant: 'success' },
  'resolved_rejected': { label: { id: 'Ditolak', en: 'Rejected' }, variant: 'secondary' },
};

const filterLabels: Record<FilterType, { id: string; en: string }> = {
  'semua': { id: 'Semua', en: 'All' },
  'simpanan': { id: 'Simpanan', en: 'Savings' },
  'angsuran': { id: 'Angsuran', en: 'Installment' },
  'penarikan': { id: 'Penarikan', en: 'Withdrawal' },
  'koreksi': { id: 'Koreksi', en: 'Correction' },
};

type CombinedItem = 
  | { type: 'transaction'; data: Transaction; date: Date }
  | { type: 'correction'; data: CorrectionFromDB; date: Date };

export const TransactionList = ({ transactions, showAll = false }: TransactionListProps) => {
  const { t, language } = useThemeLanguage();
  const { user } = useAuth();
  const { savings } = useUserSavings();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Transaction | null>(null);
  const [corrections, setCorrections] = useState<CorrectionFromDB[]>([]);
  const [selectedCorrection, setSelectedCorrection] = useState<CorrectionFromDB | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [filter, setFilter] = useState<FilterType>('semua');

  // Fetch corrections from database
  const fetchCorrections = async () => {
    if (!user) return;
    
    // Fetch corrections with original transaction info for transaction-based corrections
    const { data, error } = await supabase
      .from('corrections')
      .select(`
        *,
        transactions:transaction_id (
          date,
          type,
          amount
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching corrections:', error);
      return;
    }
    
    // Map the joined transaction data to flat structure
    const mappedData = (data || []).map((item: any) => ({
      ...item,
      original_tx_date: item.transactions?.date || null,
      original_tx_type: item.transactions?.type || null,
      original_tx_amount: item.transactions?.amount || null,
      transactions: undefined // Remove nested object
    })) as CorrectionFromDB[];
    
    setCorrections(mappedData);
  };

  useEffect(() => {
    fetchCorrections();
  }, [user]);

  // Realtime subscription for corrections
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`corrections-member-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'corrections',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[Realtime] Member corrections changed:', payload.eventType);
          fetchCorrections();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Combine and sort transactions and corrections
  const combinedItems = useMemo(() => {
    const items: CombinedItem[] = [];
    
    transactions.forEach(tx => {
      items.push({
        type: 'transaction',
        data: tx,
        // Use createdAt for consistent sorting with corrections (both use full timestamps)
        date: new Date(tx.createdAt || tx.date)
      });
    });
    
    corrections.forEach(c => {
      items.push({
        type: 'correction',
        data: c,
        date: new Date(c.created_at)
      });
    });
    
    // Sort by date descending
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return items;
  }, [transactions, corrections]);

  // Filter items based on selected filter
  const filteredItems = useMemo(() => {
    if (filter === 'semua') return combinedItems;
    
    return combinedItems.filter(item => {
      if (filter === 'koreksi') {
        return item.type === 'correction';
      }
      
      if (item.type === 'correction') return false;
      
      const tx = item.data as Transaction;
      
      if (filter === 'simpanan') {
        return ['simpanan_pokok', 'simpanan_wajib', 'simpanan_sukarela', 'setor_simpanan_wajib', 'setor_simpanan_sukarela'].includes(tx.type);
      }
      
      if (filter === 'angsuran') {
        return tx.type === 'bayar_angsuran_pinjaman';
      }
      
      if (filter === 'penarikan') {
        return tx.type === 'penarikan_simpanan_sukarela';
      }
      
      return true;
    });
  }, [combinedItems, filter]);

  // Use all filtered items for scrollable view
  const displayItems = filteredItems;

  // Prepare export data
  const exportData: ExportTransaction[] = useMemo(() => 
    transactions.map(tx => ({
      id: tx.id,
      memberName: user?.name,
      memberNumber: user?.memberNumber,
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      status: tx.status,
      paymentMethod: tx.paymentMethod,
      accountHolderName: tx.accountHolderName,
      notes: tx.notes,
      createdAt: tx.createdAt,
    })), [transactions, user]);

  const handleReportCorrection = async () => {
    if (!selectedCorrection || !reportReason.trim()) {
      toast.error(t('Alasan laporan harus diisi', 'Report reason is required'));
      return;
    }
    
    const { error } = await supabase
      .from('corrections')
      .update({
        status: 'reported',
        reported_at: new Date().toISOString(),
        report_reason: reportReason.trim()
      })
      .eq('id', selectedCorrection.id);
    
    if (error) {
      console.error('Error reporting correction:', error);
      toast.error(t('Gagal mengirim laporan', 'Failed to submit report'));
      return;
    }
    
    toast.success(t('Laporan berhasil dikirim. Admin akan meninjau koreksi ini.', 'Report submitted successfully. Admin will review this correction.'));
    
    // Update local state
    setCorrections(prev => prev.map(c => 
      c.id === selectedCorrection.id 
        ? { ...c, status: 'reported' as CorrectionStatus, reported_at: new Date().toISOString(), report_reason: reportReason.trim() }
        : c
    ));
    
    setShowReportDialog(false);
    setSelectedCorrection(null);
    setReportReason('');
  };

  const getStatusVariant = (status: Transaction['status']) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending':
        return 'pending';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'approved':
        return CheckCircle;
      case 'rejected':
        return XCircle;
      case 'pending':
        return Clock;
      default:
        return Clock;
    }
  };

  const isDebit = (type: Transaction['type']) => {
    return type === 'penarikan_simpanan_sukarela';
  };

  const getFilterIcon = (filterType: FilterType) => {
    switch (filterType) {
      case 'simpanan': return Wallet;
      case 'angsuran': return CreditCard;
      case 'penarikan': return ArrowDown;
      case 'koreksi': return PenLine;
      default: return Filter;
    }
  };

  // Parse overpayment info from transaction notes
  const parseOverpaymentInfo = (notes: string | undefined) => {
    if (!notes) return null;
    
    // Check for overpayment pattern in notes
    const overpaymentMatch = notes.match(/Kelebihan Rp ([\d.,]+) diterapkan ke: ([#\d,\s]+)/);
    if (overpaymentMatch) {
      const amount = parseInt(overpaymentMatch[1].replace(/[.,]/g, ''));
      const installments = overpaymentMatch[2].split(',').map(s => s.trim());
      return { amount, installments, type: 'distributed' as const };
    }
    
    return null;
  };

  const renderTransactionItem = (transaction: Transaction, index: number) => {
    const StatusIcon = getStatusIcon(transaction.status);
    const debit = isDebit(transaction.type);
    const isApprovedWithdrawal = transaction.type === 'penarikan_simpanan_sukarela' && transaction.status === 'approved';
    const isApprovedLoanPayment = transaction.type === 'bayar_angsuran_pinjaman' && transaction.status === 'approved';
    const overpaymentInfo = parseOverpaymentInfo(transaction.notes);
    const hasAdjustment = transaction.originalAmount !== undefined || transaction.originalDate !== undefined;

    return (
      <div
        key={`tx-${transaction.id}`}
        className={cn(
          "px-6 py-4 transition-colors hover:bg-muted/50",
          "animate-slide-up"
        )}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
            debit ? "bg-destructive/10" : "bg-success/10"
          )}>
            {debit ? (
              <ArrowUpRight className="h-5 w-5 text-destructive" />
            ) : (
              <ArrowDownLeft className="h-5 w-5 text-success" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {getTransactionTypeLabel(transaction.type, language)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatShortDate(transaction.date)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <p className={cn(
              "text-sm font-semibold",
              debit ? "text-destructive" : "text-success"
            )}>
              {debit ? '-' : '+'}{formatCurrency(transaction.amount)}
            </p>
            <Badge variant={getStatusVariant(transaction.status)} className="text-xs">
              <StatusIcon className="mr-1 h-3 w-3" />
              {getStatusLabel(transaction.status, language)}
            </Badge>
            {hasAdjustment && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                <PenLine className="mr-1 h-3 w-3" />
                {t('Disesuaikan', 'Adjusted')}
              </Badge>
            )}
          </div>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setSelectedTransaction(transaction)}
              title={t('Bukti Pembayaran', 'Payment Receipt')}
            >
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </Button>
            
            {isApprovedWithdrawal && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setSelectedWithdrawal(transaction)}
                title={t('Surat Konfirmasi', 'Confirmation Letter')}
              >
                <FileText className="h-4 w-4 text-primary" />
              </Button>
            )}
          </div>
        </div>

        {/* Overpayment distribution info for loan payments */}
        {isApprovedLoanPayment && overpaymentInfo && (
          <div className="mt-3 ml-14">
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-xs border border-blue-200 dark:border-blue-800">
              <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-blue-800 dark:text-blue-300">
                  {t('Kelebihan Bayar Diterapkan', 'Overpayment Applied')}
                </p>
                <p className="text-blue-700 dark:text-blue-400">
                  {t(`Kelebihan ${formatCurrency(overpaymentInfo.amount)} telah diterapkan ke angsuran:`, 
                     `Excess of ${formatCurrency(overpaymentInfo.amount)} applied to installments:`)}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {overpaymentInfo.installments.map((inst, i) => (
                    <Badge key={i} variant="outline" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                      {inst}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show rejection reason */}
        {transaction.status === 'rejected' && transaction.rejectionReason && (
          <div className="mt-3 ml-14">
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs border border-destructive/20">
              <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-destructive">{t('Alasan Penolakan', 'Rejection Reason')}</p>
                <p className="text-muted-foreground">{transaction.rejectionReason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Show adjustment info */}
        {hasAdjustment && transaction.status === 'approved' && (
          <div className="mt-3 ml-14">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs border border-amber-200 dark:border-amber-800">
              <PenLine className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {t('Transaksi Disesuaikan oleh Admin', 'Transaction Adjusted by Admin')}
                </p>
                <div className="text-amber-700 dark:text-amber-400 space-y-0.5">
                  {transaction.originalAmount !== undefined && transaction.originalAmount !== null && transaction.originalAmount !== transaction.amount && (
                    <p>
                      {t('Nominal', 'Amount')}: {formatCurrency(transaction.originalAmount)} → {formatCurrency(transaction.amount)}
                    </p>
                  )}
                  {transaction.originalDate && transaction.originalDate !== transaction.date && (
                    <p>
                      {t('Tanggal', 'Date')}: {formatShortDate(transaction.originalDate)} → {formatShortDate(transaction.date)}
                    </p>
                  )}
                  {transaction.adjustmentReason && (
                    <p className="text-amber-600 dark:text-amber-500 mt-1">
                      {t('Alasan', 'Reason')}: {transaction.adjustmentReason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCorrectionItem = (correction: CorrectionFromDB, index: number) => {
    const difference = correction.operation === 'add' ? correction.amount : -correction.amount;
    
    return (
      <div
        key={`cor-${correction.id}`}
        className={cn(
          "px-6 py-4 transition-colors hover:bg-muted/50",
          "animate-slide-up"
        )}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
            correction.operation === 'add' ? 'bg-success/10' : 'bg-destructive/10'
          )}>
            <PenLine className={cn(
              "h-5 w-5",
              correction.operation === 'add' ? 'text-success' : 'text-destructive'
            )} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground truncate">
                {t('Koreksi', 'Correction')}: {language === 'id' 
                  ? correctionTypeLabels[correction.correction_type].id 
                  : correctionTypeLabels[correction.correction_type].en}
                {correction.installment_number && ` #${correction.installment_number}`}
              </p>
              {correction.correction_mode === 'transaction_based' && (
                <Badge variant="outline" className="text-xs">
                  {t('Berbasis Transaksi', 'Transaction Based')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(correction.created_at)}
            </p>
            {/* Show original transaction date for transaction-based corrections */}
            {correction.correction_mode === 'transaction_based' && correction.original_tx_date && (
              <p className="text-xs text-warning mt-0.5">
                {t('Transaksi dikoreksi', 'Corrected transaction')}: {formatDate(correction.original_tx_date)}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
            <p className={cn(
              "text-sm font-semibold",
              difference >= 0 ? 'text-success' : 'text-destructive'
            )}>
              {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
            </p>
            <Badge variant={correctionStatusLabels[correction.status].variant} className="text-xs">
              {language === 'id' 
                ? correctionStatusLabels[correction.status].label.id 
                : correctionStatusLabels[correction.status].label.en}
            </Badge>
          </div>

          {/* Report button - only show for applied corrections */}
          {correction.status === 'applied' ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => {
                setSelectedCorrection(correction);
                setShowReportDialog(true);
              }}
              title={t('Laporkan Koreksi', 'Report Correction')}
            >
              <Flag className="h-4 w-4 text-warning" />
            </Button>
          ) : (
            <div className="w-10" /> // Placeholder for alignment
          )}
        </div>

        {/* Expanded details for correction */}
        <div className="mt-3 ml-14 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-muted/50 p-2">
              <p className="text-muted-foreground">{t('Saldo Sebelum', 'Balance Before')}</p>
              <p className="font-medium">{formatCurrency(correction.current_balance)}</p>
            </div>
            <div className="rounded bg-muted/50 p-2">
              <p className="text-muted-foreground">{t('Saldo Sesudah', 'Balance After')}</p>
              <p className="font-medium">{formatCurrency(correction.new_balance)}</p>
            </div>
          </div>

          <div className="text-xs">
            <p className="text-muted-foreground">{t('Alasan', 'Reason')}:</p>
            <p>{correction.reason}</p>
          </div>

          {correction.footnote && (
            <div className="flex items-start gap-2 rounded bg-primary/5 p-2 text-xs border-l-2 border-primary">
              <ArrowUpDown className="h-3 w-3 text-primary mt-0.5 shrink-0" />
              <p className="text-muted-foreground italic">{correction.footnote}</p>
            </div>
          )}

          {correction.status === 'reported' && (
            <div className="flex items-start gap-2 rounded bg-warning/10 p-2 text-xs border-l-2 border-warning">
              <Flag className="h-3 w-3 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-warning">{t('Laporan sedang ditinjau', 'Report under review')}</p>
                {correction.report_reason && (
                  <p className="text-muted-foreground">{correction.report_reason}</p>
                )}
              </div>
            </div>
          )}

          {(correction.status === 'resolved' || correction.status === 'resolved_approved' || correction.status === 'resolved_rejected') && correction.resolution_note && (
            <div className={cn(
              "flex items-start gap-2 rounded p-2 text-xs border-l-2",
              correction.status === 'resolved_rejected' 
                ? "bg-destructive/10 border-destructive" 
                : "bg-success/10 border-success"
            )}>
              <CheckCircle2 className={cn(
                "h-3 w-3 mt-0.5 shrink-0",
                correction.status === 'resolved_rejected' ? "text-destructive" : "text-success"
              )} />
              <div>
                <p className={cn(
                  "font-medium",
                  correction.status === 'resolved_rejected' ? "text-destructive" : "text-success"
                )}>
                  {correction.status === 'resolved_rejected' 
                    ? t('Laporan Ditolak', 'Report Rejected')
                    : t('Laporan Disetujui', 'Report Approved')}
                </p>
                <p className="text-muted-foreground">{correction.resolution_note}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const FilterIcon = getFilterIcon(filter);

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">{t('Riwayat Transaksi', 'Transaction History')}</CardTitle>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FilterIcon className="h-4 w-4" />
                    {language === 'id' ? filterLabels[filter].id : filterLabels[filter].en}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(filterLabels) as FilterType[]).map((key) => {
                    const Icon = getFilterIcon(key);
                    return (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => setFilter(key)}
                        className={cn(filter === key && "bg-accent")}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {language === 'id' ? filterLabels[key].id : filterLabels[key].en}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <ExportButton 
                transactions={exportData}
                filename="riwayat-transaksi"
                title={t('Riwayat Transaksi Saya', 'My Transaction History')}
              />
            </div>
          </div>
          
          {corrections.length > 0 && (
            <div className="mt-2 rounded-lg border border-muted bg-muted/30 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Jika Anda merasa koreksi tidak sesuai, gunakan tombol bendera untuk mengajukan peninjauan.',
                    'If you feel a correction is incorrect, use the flag button to request a review.'
                  )}
                </p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {filter === 'semua' 
                  ? t('Belum ada transaksi', 'No transactions yet')
                  : t('Tidak ada data untuk filter ini', 'No data for this filter')}
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px]">
                <div className="divide-y divide-border">
                  {displayItems.map((item, index) => {
                    if (item.type === 'transaction') {
                      return renderTransactionItem(item.data as Transaction, index);
                    } else {
                      return renderCorrectionItem(item.data as CorrectionFromDB, index);
                    }
                  })}
                </div>
              </ScrollArea>
              
              {/* Footer with count */}
              {displayItems.length > 5 && (
                <div className="p-3 border-t border-border bg-muted/30">
                  <p className="text-xs text-center text-muted-foreground">
                    {t(`Total ${filteredItems.length} transaksi`, `Total ${filteredItems.length} transactions`)}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Transaction Receipt Dialog */}
      {selectedTransaction && (
        <TransactionReceipt
          transaction={selectedTransaction}
          open={!!selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}

      {/* Withdrawal Confirmation Letter Dialog */}
      {selectedWithdrawal && (
        <WithdrawalConfirmation
          withdrawal={{
            id: selectedWithdrawal.id,
            amount: selectedWithdrawal.amount,
            date: selectedWithdrawal.date,
            approvedAt: selectedWithdrawal.approvedAt,
            memberName: user?.name || '',
            memberNumber: user?.memberNumber || '',
            paymentMethod: selectedWithdrawal.paymentMethod,
            remainingBalance: savings.simpananSukarela,
          }}
          open={!!selectedWithdrawal}
          onClose={() => setSelectedWithdrawal(null)}
        />
      )}

      {/* Report Correction Dialog */}
      <AlertDialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Laporkan Koreksi', 'Report Correction')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Jelaskan mengapa Anda merasa koreksi ini tidak sesuai. Admin akan meninjau laporan Anda.',
                'Explain why you feel this correction is incorrect. Admin will review your report.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {selectedCorrection && (
            <div className="rounded-lg border p-3 bg-muted/50 my-2">
              <p className="text-sm text-muted-foreground">{t('Koreksi yang dilaporkan', 'Correction being reported')}:</p>
              <p className="font-medium">
                {language === 'id' 
                  ? correctionTypeLabels[selectedCorrection.correction_type].id 
                  : correctionTypeLabels[selectedCorrection.correction_type].en}
              </p>
              <p className="text-sm">
                {selectedCorrection.operation === 'add' 
                  ? t('Penambahan', 'Addition') 
                  : t('Pengurangan', 'Subtraction')}: {' '}
                <span className={selectedCorrection.operation === 'add' ? 'text-success' : 'text-destructive'}>
                  {selectedCorrection.operation === 'add' ? '+' : '-'}{formatCurrency(selectedCorrection.amount)}
                </span>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="report-reason">{t('Alasan Laporan', 'Report Reason')}</Label>
            <Textarea
              id="report-reason"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder={t(
                'Jelaskan mengapa koreksi ini tidak sesuai...',
                'Explain why this correction is incorrect...'
              )}
              rows={4}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setReportReason('');
              setSelectedCorrection(null);
            }}>
              {t('Batal', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleReportCorrection}>
              {t('Kirim Laporan', 'Submit Report')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
