import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { formatCurrency, formatShortDate, getTransactionTypeLabel } from '@/lib/mockData';
import { CheckCircle, XCircle, Clock, User, Loader2, FileText, Zap, AlertTriangle, Banknote, PenLine, Calendar, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { ExportButton } from '@/components/shared/ExportButton';
import { ExportTransaction } from '@/lib/exportUtils';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useJournalTemplates, createJournalFromTransaction, TemplateType } from '@/hooks/useJournalTemplates';
import { WithdrawalConfirmation } from '@/components/shared/WithdrawalConfirmation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InfiniteScrollLoader, ListItemSkeleton } from '@/components/shared/InfiniteScrollLoader';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { useReconciliationAlert } from '@/hooks/useReconciliationAlert';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkTransactionAdjustment } from './BulkTransactionAdjustment';

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
  installment_id: string | null;
  profiles: {
    name: string;
    member_number: string | null;
  } | null;
}

interface VerificationListProps {
  transactions: TransactionWithProfile[];
  isLoading?: boolean;
  isFetchingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => Promise<void>;
}

export const VerificationList = ({ transactions, isLoading, isFetchingMore, hasMore, onLoadMore, onRefresh }: VerificationListProps) => {
  const { user } = useAuth();
  const { t, language } = useThemeLanguage();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { templates, getTemplateByType } = useJournalTemplates();
  const { checkAndAlertIfNeeded } = useReconciliationAlert();
  const [search, setSearch] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [withdrawalConfirmation, setWithdrawalConfirmation] = useState<{
    transaction: TransactionWithProfile;
    remainingBalance: number;
  } | null>(null);
  
  // Adjustment state
  const [adjustingTransaction, setAdjustingTransaction] = useState<TransactionWithProfile | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustDate, setAdjustDate] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState('');
  const [autoApproveAfterAdjust, setAutoApproveAfterAdjust] = useState(true);
  
  // Bulk adjustment state
  const [showBulkAdjustment, setShowBulkAdjustment] = useState(false);

  const pendingTransactions = transactions.filter(t => t.status === 'pending');
  
  const filteredTransactions = pendingTransactions.filter(t => {
    const searchLower = search.toLowerCase();
    return (
      t.profiles?.name?.toLowerCase().includes(searchLower) ||
      t.profiles?.member_number?.toLowerCase().includes(searchLower) ||
      getTransactionTypeLabel(t.type as any).toLowerCase().includes(searchLower)
    );
  });

  // Check template configuration status
  const templateStatus = useMemo(() => {
    const activeTemplates = templates.filter(t => t.isActive);
    const configured = activeTemplates.filter(t => t.lines.every(l => l.accountId));
    return {
      total: activeTemplates.length,
      configured: configured.length,
      allConfigured: configured.length === activeTemplates.length,
    };
  }, [templates]);

  // Check if a specific transaction type has configured template
  const isTemplateConfigured = (type: string): boolean => {
    const template = templates.find(t => t.type === type && t.isActive);
    if (!template) return false;
    return template.lines.every(l => l.accountId);
  };

  // Check if transaction is early payoff
  const isEarlyPayoffTransaction = (notes: string | null): boolean => {
    if (!notes) return false;
    try {
      const notesData = JSON.parse(notes);
      return notesData.type === 'pelunasan_dini';
    } catch {
      return notes.includes('pelunasan_dini');
    }
  };

  // Get early payoff details
  const getEarlyPayoffDetails = (notes: string | null): { interestSaved?: number } | null => {
    if (!notes) return null;
    try {
      const notesData = JSON.parse(notes);
      if (notesData.type === 'pelunasan_dini') {
        return { interestSaved: notesData.interestSaved || 0 };
      }
    } catch {
      // Not JSON
    }
    return null;
  };

  // Prepare export data for all transactions (not just pending)
  const exportData: ExportTransaction[] = useMemo(() => 
    transactions.map(t => ({
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
    })), [transactions]);

  const handleApprove = async (id: string) => {
    if (!user) return;
    
    setProcessingId(id);

    // Fetch fresh transaction data from database to ensure we use latest values (after any adjustments)
    const { data: freshData, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !freshData) {
      console.error('Error fetching transaction:', fetchError);
      toast.error('Gagal mengambil data transaksi terbaru');
      setProcessingId(null);
      return;
    }

    // Fetch profile separately
    const { data: profileData } = await supabase
      .from('profiles')
      .select('name, member_number')
      .eq('user_id', freshData.user_id)
      .single();

    const transaction = {
      id: freshData.id,
      user_id: freshData.user_id,
      type: freshData.type,
      amount: freshData.amount,
      date: freshData.date,
      status: freshData.status,
      payment_method: freshData.payment_method,
      account_holder_name: freshData.account_holder_name,
      notes: freshData.notes,
      installment_id: freshData.installment_id,
      profiles: profileData ? { name: profileData.name, member_number: profileData.member_number } : null,
    } as TransactionWithProfile;
    
    try {
      // For withdrawal transactions, get current savings balance first
      let remainingBalance = 0;
      if (transaction.type === 'penarikan_simpanan_sukarela') {
        const { data: savingsData } = await supabase
          .from('savings_summary')
          .select('simpanan_sukarela')
          .eq('user_id', transaction.user_id)
          .maybeSingle();
        
        if (savingsData) {
          // The remaining balance will be after the withdrawal is processed
          remainingBalance = Math.max(0, (Number(savingsData.simpanan_sukarela) || 0) - transaction.amount);
        }
      }

      // Update transaction status
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq('id', id);

      if (error) throw error;

      // Variables for journal entry
      let principalAmount = 0;
      let interestAmount = 0;
      let penaltyAmount = 0;

      // Track overpayment distribution for notification
      const overpaymentDistribution: Array<{ installmentNumber: number; amount: number }> = [];
      let totalOverpayment = 0;

      // If it's a loan payment, update the installment
      if (transaction.type === 'bayar_angsuran_pinjaman' && transaction.installment_id) {
        // Get current installment data
        const { data: installment } = await supabase
          .from('loan_installments')
          .select('*, loans(id, user_id, remaining_principal)')
          .eq('id', transaction.installment_id)
          .maybeSingle();

        if (installment) {
          principalAmount = installment.principal_amount || 0;
          interestAmount = installment.interest_amount || 0;
          penaltyAmount = installment.penalty_amount || 0;
          
          const totalDue = installment.total_amount + (installment.penalty_amount || 0) - (installment.paid_amount || 0);
          let paymentAmount = transaction.amount;
          let paidForThisInstallment = Math.min(paymentAmount, totalDue);
          let excessAmount = paymentAmount - totalDue;
          
          const newPaidAmount = (installment.paid_amount || 0) + paidForThisInstallment;
          
          let newStatus: 'pending' | 'paid' | 'partial' = 'partial';
          if (newPaidAmount >= installment.total_amount + (installment.penalty_amount || 0)) {
            newStatus = 'paid';
          }

          // Update current installment
          const { error: installmentError } = await supabase
            .from('loan_installments')
            .update({
              paid_amount: newPaidAmount,
              paid_date: new Date().toISOString().split('T')[0],
              status: newStatus,
            })
            .eq('id', transaction.installment_id);

          if (installmentError) {
            console.error('Error updating installment:', installmentError);
          }

          // Send admin notification for partial payment (underpayment)
          if (newStatus === 'partial') {
            const memberName = transaction.profiles?.name || 'Unknown';
            const memberNumber = transaction.profiles?.member_number || '-';
            const shortfall = totalDue - paidForThisInstallment;
            
            await supabase.from('admin_notifications').insert({
              title: 'Pembayaran Angsuran Kurang Bayar',
              message: `Anggota ${memberName} (${memberNumber}) membayar angsuran #${installment.installment_number} sebesar ${formatCurrency(paidForThisInstallment)} dari total ${formatCurrency(totalDue)}. Kekurangan: ${formatCurrency(shortfall)}. Jatuh tempo: ${formatShortDate(installment.due_date)}`,
              notification_type: 'partial_installment_payment',
              metadata: {
                user_id: transaction.user_id,
                member_name: memberName,
                member_number: memberNumber,
                loan_id: installment.loan_id,
                installment_id: installment.id,
                installment_number: installment.installment_number,
                due_date: installment.due_date,
                total_due: totalDue,
                paid_amount: paidForThisInstallment,
                shortfall_amount: shortfall,
                transaction_id: transaction.id,
              }
            });
          }

          // Track principal paid for loan update
          let totalPrincipalPaid = newStatus === 'paid' ? installment.principal_amount : 0;

          // Handle overpayment - apply to next installments
          if (excessAmount > 0 && installment.loans) {
            totalOverpayment = excessAmount;
            
            // Get all unpaid installments for this loan, ordered by installment number
            const { data: nextInstallments } = await supabase
              .from('loan_installments')
              .select('*')
              .eq('loan_id', installment.loan_id)
              .neq('id', transaction.installment_id)
              .in('status', ['pending', 'overdue', 'partial'])
              .order('installment_number', { ascending: true });

            if (nextInstallments && nextInstallments.length > 0) {
              for (const nextInst of nextInstallments) {
                if (excessAmount <= 0) break;
                
                const nextDue = nextInst.total_amount + (nextInst.penalty_amount || 0) - (nextInst.paid_amount || 0);
                const applyAmount = Math.min(excessAmount, nextDue);
                
                const nextNewPaidAmount = (nextInst.paid_amount || 0) + applyAmount;
                let nextNewStatus: 'pending' | 'paid' | 'partial' = 'partial';
                if (nextNewPaidAmount >= nextInst.total_amount + (nextInst.penalty_amount || 0)) {
                  nextNewStatus = 'paid';
                  totalPrincipalPaid += nextInst.principal_amount;
                }

                // Update next installment
                await supabase
                  .from('loan_installments')
                  .update({
                    paid_amount: nextNewPaidAmount,
                    paid_date: new Date().toISOString().split('T')[0],
                    status: nextNewStatus,
                  })
                  .eq('id', nextInst.id);

                overpaymentDistribution.push({
                  installmentNumber: nextInst.installment_number,
                  amount: applyAmount
                });

                excessAmount -= applyAmount;
              }
            }

            // Handle remaining excess after all installments are paid (refund via transaction)
            let refundAmount = 0;
            if (excessAmount > 0) {
              refundAmount = excessAmount;
              
              // Create refund transaction (trigger will update savings_summary)
              await supabase
                .from('transactions')
                .insert({
                  user_id: transaction.user_id,
                  type: 'setor_simpanan_sukarela' as const,
                  amount: refundAmount,
                  status: 'approved' as const,
                  payment_method: 'transfer_bank' as const,
                  notes: `Refund kelebihan bayar angsuran ke simpanan sukarela`,
                  approved_at: new Date().toISOString(),
                } as any);
            }
          }

          // Update loan remaining principal
          if (totalPrincipalPaid > 0 && installment.loans) {
            const newRemainingPrincipal = Math.max(0, (installment.loans.remaining_principal || 0) - totalPrincipalPaid);
            
            // Check if all installments are paid
            const { data: unpaidCount } = await supabase
              .from('loan_installments')
              .select('id', { count: 'exact' })
              .eq('loan_id', installment.loan_id)
              .neq('status', 'paid');

            const isLoanCompleted = unpaidCount?.length === 0 || newRemainingPrincipal <= 0;

            const { error: loanError } = await supabase
              .from('loans')
              .update({
                remaining_principal: newRemainingPrincipal,
                status: isLoanCompleted ? 'completed' : 'active',
              })
              .eq('id', installment.loan_id);

            if (loanError) {
              console.error('Error updating loan:', loanError);
            }

            // If loan is completed, check if member has withheld SHU and notify admin
            if (isLoanCompleted) {
              // Check for withheld SHU records for this member
              const { data: withheldRecords } = await supabase
                .from('shu_withheld')
                .select('*')
                .eq('user_id', transaction.user_id)
                .eq('status', 'withheld');

              if (withheldRecords && withheldRecords.length > 0) {
                const totalWithheld = withheldRecords.reduce((sum, r) => sum + (r.shu_amount || 0), 0);
                const memberName = transaction.profiles?.name || 'Unknown';
                const memberNumber = transaction.profiles?.member_number || '-';

                // Send notification to admin
                await supabase.from('admin_notifications').insert({
                  title: 'Tunggakan Dilunasi - SHU Siap Dirilis',
                  message: `Anggota ${memberName} (${memberNumber}) telah melunasi semua tunggakan. SHU yang ditahan sebesar Rp ${totalWithheld.toLocaleString('id-ID')} siap untuk dirilis.`,
                  notification_type: 'arrears_cleared_shu_ready',
                  metadata: {
                    user_id: transaction.user_id,
                    member_name: memberName,
                    member_number: memberNumber,
                    loan_id: installment.loan_id,
                    withheld_shu_amount: totalWithheld,
                    withheld_years: withheldRecords.map(r => r.year),
                  }
                });
              }
            }
          }

          // Create notification for member about overpayment
          if (totalOverpayment > 0) {
            let notificationMessage = '';
            let notificationType = 'loan_overpayment';
            
            // Check how excess was handled
            const distributedAmount = overpaymentDistribution.reduce((sum, d) => sum + d.amount, 0);
            const refundedAmount = totalOverpayment - distributedAmount;

            if (overpaymentDistribution.length > 0 && refundedAmount > 0) {
              // Both distribution and refund
              const distributionText = overpaymentDistribution
                .map(d => `Angsuran #${d.installmentNumber}: Rp ${d.amount.toLocaleString('id-ID')}`)
                .join(', ');
              notificationMessage = `Kelebihan pembayaran sebesar Rp ${totalOverpayment.toLocaleString('id-ID')} telah diproses. Diterapkan ke: ${distributionText}. Sisa Rp ${refundedAmount.toLocaleString('id-ID')} dikembalikan ke simpanan sukarela Anda.`;
            } else if (overpaymentDistribution.length > 0) {
              // Only distribution
              const distributionText = overpaymentDistribution
                .map(d => `Angsuran #${d.installmentNumber}: Rp ${d.amount.toLocaleString('id-ID')}`)
                .join(', ');
              notificationMessage = `Kelebihan pembayaran sebesar Rp ${totalOverpayment.toLocaleString('id-ID')} telah diterapkan ke angsuran berikutnya: ${distributionText}`;
            } else {
              // Only refund (no more installments)
              notificationMessage = `Kelebihan pembayaran sebesar Rp ${totalOverpayment.toLocaleString('id-ID')} telah dikembalikan ke simpanan sukarela Anda karena tidak ada angsuran yang tersisa.`;
              notificationType = 'loan_overpayment_refund';
            }
            
            await supabase.from('member_notifications').insert({
              user_id: transaction.user_id,
              title: refundedAmount > 0 ? 'Kelebihan Bayar Dikembalikan' : 'Kelebihan Bayar Diterapkan',
              message: notificationMessage,
              notification_type: notificationType,
              metadata: {
                transaction_id: transaction.id,
                overpayment_amount: totalOverpayment,
                distribution: overpaymentDistribution,
                refund_amount: refundedAmount
              }
            });
          }
        }
      }

      // Check if this is an early payoff transaction - complete the loan and send notification
      if (transaction.notes?.includes('pelunasan_dini')) {
        try {
          // Parse the early payoff metadata from notes
          const notesData = JSON.parse(transaction.notes);
          if (notesData.type === 'pelunasan_dini' && notesData.loan_id) {
            const loanId = notesData.loan_id;
            
            // Mark all remaining installments as paid
            const { error: installmentsError } = await supabase
              .from('loan_installments')
              .update({
                status: 'paid',
                paid_amount: supabase.rpc ? undefined : 0, // Will be handled below
                paid_date: new Date().toISOString().split('T')[0],
              })
              .eq('loan_id', loanId)
              .neq('status', 'paid');
            
            if (installmentsError) {
              console.error('Error updating installments for early payoff:', installmentsError);
            }
            
            // Update each unpaid installment with correct paid_amount
            const { data: unpaidInstallments } = await supabase
              .from('loan_installments')
              .select('id, total_amount, penalty_amount')
              .eq('loan_id', loanId);
            
            if (unpaidInstallments) {
              for (const inst of unpaidInstallments) {
                await supabase
                  .from('loan_installments')
                  .update({
                    paid_amount: inst.total_amount + (inst.penalty_amount || 0),
                    status: 'paid',
                    paid_date: new Date().toISOString().split('T')[0],
                  })
                  .eq('id', inst.id);
              }
            }
            
            // Mark loan as completed
            const { error: loanError } = await supabase
              .from('loans')
              .update({
                status: 'completed',
                remaining_principal: 0,
              })
              .eq('id', loanId);
            
            if (loanError) {
              console.error('Error completing loan for early payoff:', loanError);
            }
            
            // Send notification to member
            await supabase.from('member_notifications').insert({
              user_id: transaction.user_id,
              title: 'Pelunasan Dini Disetujui',
              message: `Pengajuan pelunasan dini pinjaman Anda sebesar Rp ${transaction.amount.toLocaleString('id-ID')} telah disetujui dan diverifikasi. Pinjaman Anda telah lunas.`,
              notification_type: 'early_payoff_approved',
              metadata: {
                transaction_id: transaction.id,
                loan_id: loanId,
                amount: transaction.amount,
                interest_saved: notesData.interestSaved || 0,
              }
            });
            
            // Update journal amounts for early payoff
            principalAmount = notesData.remainingPrincipal || 0;
            interestAmount = (notesData.currentInterest || 0) + (notesData.overdueInterest || 0);
            penaltyAmount = (notesData.currentPenalty || 0) + (notesData.overduePenalty || 0) + (notesData.earlyPayoffFee || 0);
          }
        } catch (e) {
          console.error('Error processing early payoff:', e);
        }
      }

      // Create automatic journal entry from template
      const templateType = transaction.type as TemplateType;
      const template = getTemplateByType(templateType);
      
      if (template) {
        const memberName = transaction.profiles?.name || 'Unknown';
        const description = getTransactionTypeLabel(transaction.type as any);
        
        const journalEntry = await createJournalFromTransaction(
          templateType,
          transaction.amount,
          description,
          memberName,
          template,
          undefined, // businessUnitId - could be added later
          transaction.type === 'bayar_angsuran_pinjaman' 
            ? { principalAmount, interestAmount, penaltyAmount }
            : undefined
        );
        
        if (journalEntry) {
          // Save journal number to transaction notes (include overpayment info if any)
          let notesText = `Jurnal: ${journalEntry.entry_number}`;
          if (overpaymentDistribution.length > 0) {
            notesText += ` | Kelebihan Rp ${totalOverpayment.toLocaleString('id-ID')} diterapkan ke: ${overpaymentDistribution.map(d => `#${d.installmentNumber}`).join(', ')}`;
          }
          
          await supabase
            .from('transactions')
            .update({ notes: notesText })
            .eq('id', id);
          
          console.log('Auto-journal created:', journalEntry.entry_number);
          
          if (overpaymentDistribution.length > 0) {
            toast.success(`Transaksi disetujui & jurnal ${journalEntry.entry_number} dibuat`, {
              description: `Kelebihan Rp ${totalOverpayment.toLocaleString('id-ID')} diterapkan ke ${overpaymentDistribution.length} angsuran berikutnya`
            });
          } else {
            toast.success(`Transaksi disetujui & jurnal ${journalEntry.entry_number} dibuat`);
          }
        } else {
          if (overpaymentDistribution.length > 0) {
            toast.success('Transaksi disetujui', {
              description: `Kelebihan Rp ${totalOverpayment.toLocaleString('id-ID')} diterapkan ke ${overpaymentDistribution.length} angsuran berikutnya`
            });
          } else {
            toast.success('Transaksi disetujui (template jurnal belum dikonfigurasi)');
          }
        }
      } else {
        if (overpaymentDistribution.length > 0) {
          toast.success('Transaksi disetujui', {
            description: `Kelebihan Rp ${totalOverpayment.toLocaleString('id-ID')} diterapkan ke ${overpaymentDistribution.length} angsuran berikutnya`
          });
        } else {
          toast.success('Transaksi disetujui');
        }
      }
      
      // For withdrawal transactions, show confirmation letter dialog
      if (transaction.type === 'penarikan_simpanan_sukarela') {
        setWithdrawalConfirmation({
          transaction,
          remainingBalance
        });
      }
      
      // Create notification for member (skip for early payoff and overpayment which already have their own notifications)
      const isEarlyPayoff = transaction.notes?.includes('pelunasan_dini');
      const hasOverpayment = overpaymentDistribution.length > 0;
      
      if (!isEarlyPayoff && !hasOverpayment) {
        const transactionTypeLabel = getTransactionTypeLabel(transaction.type as any);
        await supabase.from('member_notifications').insert({
          user_id: transaction.user_id,
          title: 'Transaksi Disetujui',
          message: `Transaksi ${transactionTypeLabel} sebesar Rp ${transaction.amount.toLocaleString('id-ID')} telah disetujui.`,
          notification_type: 'transaction_approved',
          metadata: {
            transaction_id: transaction.id,
            transaction_type: transaction.type,
            amount: transaction.amount,
          }
        });
      }
      
      await queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['user-loans'] });
      await queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      
      // Refresh the list immediately so approved transaction moves to history
      if (onRefresh) {
        await onRefresh();
      }
      
      // Check reconciliation rate and alert if below 90%
      checkAndAlertIfNeeded(90);
    } catch (error) {
      console.error('Error approving transaction:', error);
      toast.error('Gagal menyetujui transaksi');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) {
      toast.error('Mohon isi alasan penolakan');
      return;
    }

    setProcessingId(rejectingId);
    
    // Get the transaction to check if it's early payoff
    const transaction = pendingTransactions.find(t => t.id === rejectingId);

    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'rejected',
          rejection_reason: rejectReason.trim(),
        })
        .eq('id', rejectingId);

      if (error) throw error;

      // Check if this is an early payoff transaction and send rejection notification
      if (transaction?.notes?.includes('pelunasan_dini')) {
        try {
          const notesData = JSON.parse(transaction.notes);
          if (notesData.type === 'pelunasan_dini') {
            await supabase.from('member_notifications').insert({
              user_id: transaction.user_id,
              title: 'Pelunasan Dini Ditolak',
              message: `Pengajuan pelunasan dini pinjaman Anda sebesar Rp ${transaction.amount.toLocaleString('id-ID')} ditolak. Alasan: ${rejectReason.trim()}`,
              notification_type: 'early_payoff_rejected',
              metadata: {
                transaction_id: transaction.id,
                loan_id: notesData.loan_id,
                amount: transaction.amount,
                rejection_reason: rejectReason.trim()
              }
            });
          }
        } catch (e) {
          // Notes is not JSON, skip
        }
      } else if (transaction) {
        // Create rejection notification for regular transactions
        const transactionTypeLabel = getTransactionTypeLabel(transaction.type as any);
        await supabase.from('member_notifications').insert({
          user_id: transaction.user_id,
          title: 'Transaksi Ditolak',
          message: `Transaksi ${transactionTypeLabel} sebesar Rp ${transaction.amount.toLocaleString('id-ID')} ditolak. Alasan: ${rejectReason.trim()}`,
          notification_type: 'transaction_rejected',
          metadata: {
            transaction_id: transaction.id,
            transaction_type: transaction.type,
            amount: transaction.amount,
            rejection_reason: rejectReason.trim()
          }
        });
      }

      toast.success('Transaksi ditolak');
      await queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
      
      // Refresh the list immediately so rejected transaction moves to history
      if (onRefresh) {
        await onRefresh();
      }
      
      setRejectingId(null);
      setRejectReason('');
    } catch (error) {
      console.error('Error rejecting transaction:', error);
      toast.error('Gagal menolak transaksi');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle adjustment
  const openAdjustDialog = (transaction: TransactionWithProfile) => {
    setAdjustingTransaction(transaction);
    setAdjustAmount(transaction.amount);
    setAdjustDate(transaction.date || new Date().toISOString().split('T')[0]);
    setAdjustReason('');
    setAutoApproveAfterAdjust(true);
  };

  const handleAdjustTransaction = async (shouldApprove: boolean) => {
    if (!adjustingTransaction || !user) return;
    
    if (!adjustReason.trim()) {
      toast.error('Mohon isi alasan penyesuaian');
      return;
    }

    const hasAmountChange = adjustAmount !== adjustingTransaction.amount;
    const hasDateChange = adjustDate !== adjustingTransaction.date;

    if (!hasAmountChange && !hasDateChange) {
      toast.error('Tidak ada perubahan yang dilakukan');
      return;
    }

    setProcessingId(adjustingTransaction.id);

    try {
      // Update transaction with original values and new adjusted values
      const updateData: any = {
        original_amount: adjustingTransaction.amount,
        original_date: adjustingTransaction.date,
        amount: adjustAmount,
        date: adjustDate,
        adjusted_by: user.id,
        adjustment_reason: adjustReason.trim(),
        adjusted_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', adjustingTransaction.id);

      if (error) throw error;

      // Send notification to member about adjustment
      const transactionTypeLabel = getTransactionTypeLabel(adjustingTransaction.type as any);
      let adjustmentDetails = '';
      if (hasAmountChange) {
        adjustmentDetails += `Nominal: Rp ${adjustingTransaction.amount.toLocaleString('id-ID')} → Rp ${adjustAmount.toLocaleString('id-ID')}`;
      }
      if (hasDateChange) {
        if (adjustmentDetails) adjustmentDetails += '. ';
        adjustmentDetails += `Tanggal: ${formatShortDate(adjustingTransaction.date || '')} → ${formatShortDate(adjustDate)}`;
      }

      await supabase.from('member_notifications').insert({
        user_id: adjustingTransaction.user_id,
        title: shouldApprove ? 'Transaksi Disetujui dengan Penyesuaian' : 'Transaksi Disesuaikan',
        message: `Transaksi ${transactionTypeLabel} Anda telah disesuaikan. ${adjustmentDetails}. Alasan: ${adjustReason.trim()}`,
        notification_type: 'transaction_adjusted',
        metadata: {
          transaction_id: adjustingTransaction.id,
          transaction_type: adjustingTransaction.type,
          original_amount: adjustingTransaction.amount,
          new_amount: adjustAmount,
          original_date: adjustingTransaction.date,
          new_date: adjustDate,
          adjustment_reason: adjustReason.trim(),
        }
      });

      // Close dialog and reset state
      setAdjustingTransaction(null);
      setAdjustAmount(0);
      setAdjustDate('');
      setAdjustReason('');

      if (shouldApprove) {
        // Proceed with approval using updated values
        toast.success('Penyesuaian disimpan, melanjutkan persetujuan...');
        setProcessingId(null);
        // Call approve with the transaction id - it will fetch updated data
        await handleApprove(adjustingTransaction.id);
      } else {
        toast.success('Penyesuaian berhasil disimpan');
        await queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
        if (onRefresh) {
          await onRefresh();
        }
        setProcessingId(null);
      }
    } catch (error) {
      console.error('Error adjusting transaction:', error);
      toast.error('Gagal menyesuaikan transaksi');
      setProcessingId(null);
    }
  };

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
      <>
      {/* Template Status Alert */}
      {!templateStatus.allConfigured && pendingTransactions.length > 0 && (
        <Alert className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            <span className="font-medium">{templateStatus.total - templateStatus.configured} template jurnal</span> belum dikonfigurasi. 
            Transaksi yang disetujui tidak akan otomatis membuat jurnal. 
            <button 
              onClick={() => {
                // Navigate to accounting view first, then switch to journal templates tab
                window.dispatchEvent(new CustomEvent('navigate-to-accounting'));
                // Small delay to ensure accounting view is rendered before switching tab
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('navigate-to-journal-templates'));
                }, 100);
              }}
              className="ml-1 underline font-medium hover:text-amber-900 dark:hover:text-amber-200"
            >
              Konfigurasi sekarang →
            </button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="p-3 sm:p-4 md:p-6">
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base sm:text-lg">{t('Verifikasi Transaksi', 'Transaction Verification')}</CardTitle>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                {pendingTransactions.length} {t('transaksi menunggu verifikasi', 'transactions pending verification')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Badge 
                variant={templateStatus.allConfigured ? 'default' : 'outline'} 
                className={`text-[10px] sm:text-xs ${templateStatus.allConfigured 
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                  : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400'
                }`}
              >
                <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                <span className="hidden sm:inline">Jurnal Otomatis:</span> {templateStatus.configured}/{templateStatus.total}
              </Badge>
              {pendingTransactions.length > 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBulkAdjustment(true)}
                      className="gap-1.5 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Bulk Rekonsiliasi</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Penyesuaian massal dari file rekonsiliasi bank</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <SearchInput
                placeholder={t('Cari transaksi...', 'Search transactions...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                containerClassName="w-full sm:w-56 md:w-64"
              />
              <ExportButton 
                transactions={exportData}
                filename="laporan-transaksi-semua"
                title={t('Laporan Semua Transaksi', 'All Transactions Report')}
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
                    <CheckCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {search ? 'Tidak ada transaksi yang cocok' : 'Semua transaksi sudah diverifikasi'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredTransactions.map((transaction) => {
                    const isProcessing = processingId === transaction.id;
                    
                    return (
                      <div
                        key={transaction.id}
                        className="flex flex-col gap-3 p-3 sm:p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-2.5 sm:gap-3">
                          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                            <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm sm:text-base text-foreground truncate">{transaction.profiles?.name || 'Unknown'}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">{transaction.profiles?.member_number || '-'}</p>
                            <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <Badge variant="pending" className="text-[10px] sm:text-xs h-5 sm:h-6">
                                <Clock className="mr-0.5 sm:mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                Menunggu
                              </Badge>
                              {isEarlyPayoffTransaction(transaction.notes) ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800">
                                      <Banknote className="h-3 w-3 mr-1" />
                                      Pelunasan Dini
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      Pengajuan pelunasan pinjaman sebelum jatuh tempo
                                      {getEarlyPayoffDetails(transaction.notes)?.interestSaved ? (
                                        <span className="block text-emerald-400">
                                          Hemat bunga: {formatCurrency(getEarlyPayoffDetails(transaction.notes)?.interestSaved || 0)}
                                        </span>
                                      ) : null}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {getTransactionTypeLabel(transaction.type as any)}
                                </span>
                              )}
                              {isTemplateConfigured(transaction.type) ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                                      <Zap className="h-3 w-3 mr-1" />
                                      Auto-Jurnal
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Jurnal akan dibuat otomatis saat disetujui</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Manual
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Template jurnal belum dikonfigurasi</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-3">
                          <div className="text-right">
                            <p className="text-lg font-bold text-foreground">
                              {formatCurrency(transaction.amount)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {transaction.date ? formatShortDate(transaction.date) : '-'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              via {transaction.payment_method === 'transfer_bank' ? 'Transfer Bank' : 'E-Wallet'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              a.n. {transaction.account_holder_name || '-'}
                            </p>
                            {isEarlyPayoffTransaction(transaction.notes) && (
                              <p className="text-xs font-medium text-violet-600 dark:text-violet-400 mt-1">
                                Total Pelunasan
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openAdjustDialog(transaction)}
                                  disabled={isProcessing}
                                >
                                  <PenLine className="mr-1 h-4 w-4" />
                                  <span className="hidden sm:inline">Sesuaikan</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Sesuaikan nominal atau tanggal transaksi</p>
                              </TooltipContent>
                            </Tooltip>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setRejectingId(transaction.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="mr-1 h-4 w-4" />
                              )}
                              Tolak
                            </Button>
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleApprove(transaction.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="mr-1 h-4 w-4" />
                              )}
                              Setujui
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Infinite scroll loader */}
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
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {search ? 'Tidak ada transaksi yang cocok' : 'Semua transaksi sudah diverifikasi'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTransactions.map((transaction) => {
                  const isProcessing = processingId === transaction.id;
                  
                  return (
                    <div
                      key={transaction.id}
                      className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{transaction.profiles?.name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{transaction.profiles?.member_number || '-'}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="pending">
                              <Clock className="mr-1 h-3 w-3" />
                              Menunggu
                            </Badge>
                            {isEarlyPayoffTransaction(transaction.notes) ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800">
                                    <Banknote className="h-3 w-3 mr-1" />
                                    Pelunasan Dini
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    Pengajuan pelunasan pinjaman sebelum jatuh tempo
                                    {getEarlyPayoffDetails(transaction.notes)?.interestSaved ? (
                                      <span className="block text-emerald-400">
                                        Hemat bunga: {formatCurrency(getEarlyPayoffDetails(transaction.notes)?.interestSaved || 0)}
                                      </span>
                                    ) : null}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {getTransactionTypeLabel(transaction.type as any)}
                              </span>
                            )}
                            {isTemplateConfigured(transaction.type) ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                                    <Zap className="h-3 w-3 mr-1" />
                                    Auto-Jurnal
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Jurnal akan dibuat otomatis saat disetujui</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Manual
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Template jurnal belum dikonfigurasi</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">
                            {formatCurrency(transaction.amount)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {transaction.date ? formatShortDate(transaction.date) : '-'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            via {transaction.payment_method === 'transfer_bank' ? 'Transfer Bank' : 'E-Wallet'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            a.n. {transaction.account_holder_name || '-'}
                          </p>
                          {isEarlyPayoffTransaction(transaction.notes) && (
                            <p className="text-xs font-medium text-violet-600 dark:text-violet-400 mt-1">
                              Total Pelunasan
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openAdjustDialog(transaction)}
                                disabled={isProcessing}
                              >
                                <PenLine className="mr-1 h-4 w-4" />
                                <span className="hidden sm:inline">Sesuaikan</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Sesuaikan nominal atau tanggal transaksi</p>
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setRejectingId(transaction.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="mr-1 h-4 w-4" />
                            )}
                            Tolak
                          </Button>
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleApprove(transaction.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="mr-1 h-4 w-4" />
                            )}
                            Setujui
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Infinite scroll loader */}
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

      {/* Reject Dialog */}
      <Dialog open={!!rejectingId} onOpenChange={() => setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Transaksi</DialogTitle>
            <DialogDescription>
              Berikan alasan penolakan transaksi ini
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Contoh: Tidak sesuai dengan mutasi rekening"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingId(null)}>
              Batal
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={processingId === rejectingId}
            >
              {processingId === rejectingId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Tolak Transaksi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Confirmation Letter Dialog */}
      {withdrawalConfirmation && (
        <WithdrawalConfirmation
          withdrawal={{
            id: withdrawalConfirmation.transaction.id,
            amount: withdrawalConfirmation.transaction.amount,
            date: withdrawalConfirmation.transaction.date || new Date().toISOString(),
            approvedAt: new Date().toISOString(),
            memberName: withdrawalConfirmation.transaction.profiles?.name || '',
            memberNumber: withdrawalConfirmation.transaction.profiles?.member_number || '',
            paymentMethod: withdrawalConfirmation.transaction.payment_method,
            remainingBalance: withdrawalConfirmation.remainingBalance,
          }}
          open={!!withdrawalConfirmation}
          onClose={() => setWithdrawalConfirmation(null)}
        />
      )}

      {/* Adjustment Dialog */}
      <Dialog open={!!adjustingTransaction} onOpenChange={() => setAdjustingTransaction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              Penyesuaian Transaksi
            </DialogTitle>
            <DialogDescription>
              Sesuaikan nominal atau tanggal transaksi sebelum menyetujui
            </DialogDescription>
          </DialogHeader>

          {adjustingTransaction && (
            <div className="space-y-4">
              {/* Member Info */}
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="font-medium">{adjustingTransaction.profiles?.name || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">{adjustingTransaction.profiles?.member_number || '-'}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {getTransactionTypeLabel(adjustingTransaction.type as any)}
                </p>
              </div>

              {/* Amount Adjustment */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span>Nominal</span>
                  {adjustAmount !== adjustingTransaction.amount && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                      Diubah
                    </Badge>
                  )}
                </Label>
                <div className="text-xs text-muted-foreground mb-1">
                  Asli: {formatCurrency(adjustingTransaction.amount)}
                </div>
                <CurrencyInput
                  value={adjustAmount}
                  onChange={setAdjustAmount}
                  placeholder="Nominal baru"
                />
              </div>

              {/* Date Adjustment */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Tanggal</span>
                  {adjustDate !== adjustingTransaction.date && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                      Diubah
                    </Badge>
                  )}
                </Label>
                <div className="text-xs text-muted-foreground mb-1">
                  Asli: {adjustingTransaction.date ? formatShortDate(adjustingTransaction.date) : '-'}
                </div>
                <Input
                  type="date"
                  value={adjustDate}
                  onChange={(e) => setAdjustDate(e.target.value)}
                />
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label className="text-destructive">Alasan Penyesuaian *</Label>
                <Textarea
                  placeholder="Contoh: Nominal tidak sesuai mutasi bank, tanggal transfer berbeda"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Auto-approve checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-approve"
                  checked={autoApproveAfterAdjust}
                  onCheckedChange={(checked) => setAutoApproveAfterAdjust(checked as boolean)}
                />
                <label htmlFor="auto-approve" className="text-sm cursor-pointer">
                  Langsung setujui setelah penyesuaian
                </label>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setAdjustingTransaction(null)}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAdjustTransaction(false)}
              disabled={processingId === adjustingTransaction?.id || !adjustReason.trim()}
              className="w-full sm:w-auto"
            >
              {processingId === adjustingTransaction?.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Simpan Saja
            </Button>
            <Button
              variant="success"
              onClick={() => handleAdjustTransaction(true)}
              disabled={processingId === adjustingTransaction?.id || !adjustReason.trim()}
              className="w-full sm:w-auto"
            >
              {processingId === adjustingTransaction?.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Simpan & Setujui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Adjustment Dialog */}
      <BulkTransactionAdjustment
        open={showBulkAdjustment}
        onOpenChange={setShowBulkAdjustment}
        pendingTransactions={pendingTransactions}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
          if (onRefresh) {
            await onRefresh();
          }
        }}
      />
      </>
    </TooltipProvider>
  );
};
