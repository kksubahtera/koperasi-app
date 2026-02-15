import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CurrencyInput } from '@/components/ui/currency-input';
import { TransactionType, PaymentMethod, LoanInstallment, Loan, Transaction } from '@/lib/types';
import { toast } from 'sonner';
import { Send, Loader2, AlertTriangle, Clock, Lock } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';
import { useWithdrawalEligibility } from '@/hooks/useWithdrawalEligibility';

// Rate limiting constants
const SUBMIT_COOLDOWN_MS = 3000; // 3 seconds between submissions
const MAX_SUBMISSIONS_PER_MINUTE = 5;

interface TransactionFormProps {
  hasLoan?: boolean;
  loan?: Loan | null;
  installments?: LoanInstallment[];
  voluntarySavings?: number;
  onSuccess?: () => void;
}

export const TransactionForm = ({ 
  hasLoan = false, 
  loan,
  installments = [],
  voluntarySavings = 0,
  onSuccess 
}: TransactionFormProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useThemeLanguage();
  const [isLoading, setIsLoading] = useState(false);
  
  // Rate limiting state
  const lastSubmitTime = useRef<number>(0);
  const submissionCount = useRef<number>(0);
  const minuteStart = useRef<number>(Date.now());
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  // Cooldown timer effect
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setTimeout(() => {
        setCooldownRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownRemaining]);
  
  const [formData, setFormData] = useState<{
    type?: TransactionType;
    amount?: number;
    date: string;
    paymentMethod: PaymentMethod;
    accountHolderName: string;
    notes: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'transfer_bank',
    accountHolderName: user?.bankAccountName || '',
    notes: '',
  });

  // Get withdrawal eligibility info
  const { 
    eligibleAmount, 
    lockedAmount, 
    minHoldingMonths,
    isLoading: isLoadingEligibility 
  } = useWithdrawalEligibility(user?.id);

  // Auto-fill account holder name from user profile when user data loads
  useEffect(() => {
    if (user?.bankAccountName && !formData.accountHolderName) {
      setFormData(prev => ({ ...prev, accountHolderName: user.bankAccountName || '' }));
    }
  }, [user?.bankAccountName]);
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string>('');

  const transactionTypes = [
    { value: 'setor_simpanan_wajib', label: t('Setor Simpanan Wajib', 'Deposit Mandatory Savings'), minAmount: 50000, category: 'deposit' },
    { value: 'setor_simpanan_sukarela', label: t('Setor Simpanan Sukarela', 'Deposit Voluntary Savings'), minAmount: 50000, category: 'deposit' },
    { value: 'penarikan_simpanan_sukarela', label: t('Penarikan Simpanan Sukarela', 'Withdraw Voluntary Savings'), minAmount: 50000, category: 'withdrawal' },
    { value: 'bayar_angsuran_pinjaman', label: t('Bayar Angsuran Pinjaman', 'Pay Loan Installment'), minAmount: 0, category: 'loan' },
  ];

  const paymentMethods = [
    { value: 'transfer_bank', label: t('Transfer Bank', 'Bank Transfer') },
    { value: 'e_wallet', label: 'E-Wallet' },
  ];

  const availableTypes = transactionTypes.filter(type => {
    if (type.value === 'bayar_angsuran_pinjaman') return hasLoan;
    return true;
  });

  // Get unpaid installments (overdue first, then unpaid, then pending)
  const unpaidInstallments = useMemo(() => {
    return installments
      .filter(inst => inst.status === 'overdue' || inst.status === 'unpaid' || inst.status === 'pending' || inst.status === 'partial')
      .sort((a, b) => {
        // Overdue first (with penalty)
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (a.status !== 'overdue' && b.status === 'overdue') return 1;
        // Then unpaid (past due but no penalty yet)
        if (a.status === 'unpaid' && b.status !== 'unpaid' && b.status !== 'overdue') return -1;
        if (a.status !== 'unpaid' && a.status !== 'overdue' && b.status === 'unpaid') return 1;
        // Then by installment number
        return a.installmentNumber - b.installmentNumber;
      });
  }, [installments]);

  // Calculate selected installment details
  const selectedInstallment = useMemo(() => {
    return unpaidInstallments.find(inst => inst.id === selectedInstallmentId);
  }, [unpaidInstallments, selectedInstallmentId]);

  // Calculate expected amount for selected installment
  const expectedAmount = useMemo(() => {
    if (!selectedInstallment) return 0;
    const remaining = selectedInstallment.totalAmount - selectedInstallment.paidAmount;
    return remaining + selectedInstallment.penaltyAmount;
  }, [selectedInstallment]);

  // Check if amount is underpaid
  const underpaymentAmount = useMemo(() => {
    if (formData.type !== 'bayar_angsuran_pinjaman' || !selectedInstallment || !formData.amount) {
      return 0;
    }
    const shortfall = expectedAmount - formData.amount;
    return shortfall > 0 ? shortfall : 0;
  }, [formData.type, formData.amount, expectedAmount, selectedInstallment]);

  // Check if amount is overpaid
  const overpaymentAmount = useMemo(() => {
    if (formData.type !== 'bayar_angsuran_pinjaman' || !selectedInstallment || !formData.amount) {
      return 0;
    }
    const excess = formData.amount - expectedAmount;
    return excess > 0 ? excess : 0;
  }, [formData.type, formData.amount, expectedAmount, selectedInstallment]);

  // Get next unpaid installments for overpayment info
  const nextInstallmentsForOverpayment = useMemo(() => {
    if (!overpaymentAmount || !selectedInstallment) return [];
    
    const nextInsts = unpaidInstallments
      .filter(inst => inst.installmentNumber > selectedInstallment.installmentNumber)
      .sort((a, b) => a.installmentNumber - b.installmentNumber);
    
    let remaining = overpaymentAmount;
    const affected: Array<{ installmentNumber: number; amount: number }> = [];
    
    for (const inst of nextInsts) {
      if (remaining <= 0) break;
      const dueAmount = inst.totalAmount - inst.paidAmount + inst.penaltyAmount;
      const appliedAmount = Math.min(remaining, dueAmount);
      affected.push({ installmentNumber: inst.installmentNumber, amount: appliedAmount });
      remaining -= appliedAmount;
    }
    
    return affected;
  }, [overpaymentAmount, selectedInstallment, unpaidInstallments]);

  // Check withdrawal against voluntary savings
  const withdrawalExceedsSavings = useMemo(() => {
    if (formData.type !== 'penarikan_simpanan_sukarela' || !formData.amount) return false;
    return formData.amount > voluntarySavings;
  }, [formData.type, formData.amount, voluntarySavings]);

  // Check withdrawal against eligible amount (considering holding period)
  const withdrawalExceedsEligible = useMemo(() => {
    if (formData.type !== 'penarikan_simpanan_sukarela' || !formData.amount) return false;
    if (minHoldingMonths === 0) return false; // No holding period restriction
    return formData.amount > eligibleAmount;
  }, [formData.type, formData.amount, eligibleAmount, minHoldingMonths]);

  // Get due date from loan disbursement date
  const getDueDateDay = () => {
    if (!loan) return 1;
    const disbursementDate = new Date(loan.disbursementDate);
    return disbursementDate.getDate();
  };

  // Check rate limiting
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    
    // Reset minute counter if a minute has passed
    if (now - minuteStart.current > 60000) {
      minuteStart.current = now;
      submissionCount.current = 0;
    }
    
    // Check cooldown
    const timeSinceLastSubmit = now - lastSubmitTime.current;
    if (timeSinceLastSubmit < SUBMIT_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((SUBMIT_COOLDOWN_MS - timeSinceLastSubmit) / 1000);
      setCooldownRemaining(remainingSeconds);
      toast.error(t(
        `Mohon tunggu ${remainingSeconds} detik sebelum mengajukan transaksi lagi`,
        `Please wait ${remainingSeconds} seconds before submitting another transaction`
      ));
      return false;
    }
    
    // Check max submissions per minute
    if (submissionCount.current >= MAX_SUBMISSIONS_PER_MINUTE) {
      toast.error(t(
        'Anda telah mencapai batas maksimal pengajuan transaksi. Mohon tunggu sebentar.',
        'You have reached the maximum submission limit. Please wait a moment.'
      ));
      return false;
    }
    
    return true;
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Rate limit check
    if (!checkRateLimit()) {
      return;
    }
    
    if (!user) {
      toast.error(t('Anda harus login terlebih dahulu', 'You must be logged in'));
      return;
    }

    if (!formData.type || !formData.amount || !formData.date || !formData.accountHolderName.trim()) {
      toast.error(t('Mohon lengkapi semua field yang diperlukan', 'Please fill in all required fields'));
      return;
    }

    // For loan payments, require installment selection
    if (formData.type === 'bayar_angsuran_pinjaman' && !selectedInstallmentId) {
      toast.error(t('Mohon pilih periode angsuran yang akan dibayar', 'Please select the installment period to pay'));
      return;
    }

    const selectedType = transactionTypes.find(t => t.value === formData.type);
    if (selectedType && formData.amount < selectedType.minAmount) {
      toast.error(t(`Minimal ${selectedType.label} adalah ${formatCurrency(selectedType.minAmount)}`, `Minimum ${selectedType.label} is ${formatCurrency(selectedType.minAmount)}`));
      return;
    }

    // Check if withdrawal exceeds savings
    if (withdrawalExceedsSavings) {
      toast.error(t(`Penarikan melebihi saldo simpanan sukarela (${formatCurrency(voluntarySavings)})`, `Withdrawal exceeds voluntary savings balance (${formatCurrency(voluntarySavings)})`));
      return;
    }

    // Check if withdrawal exceeds eligible amount (holding period)
    if (withdrawalExceedsEligible) {
      toast.error(
        t(
          `Penarikan melebihi saldo yang sudah mengendap ${minHoldingMonths} bulan. Saldo yang bisa ditarik: ${formatCurrency(eligibleAmount)}`,
          `Withdrawal exceeds balance held for ${minHoldingMonths} months. Available for withdrawal: ${formatCurrency(eligibleAmount)}`
        )
      );
      return;
    }

    setIsLoading(true);
    
    // Update rate limiting trackers
    lastSubmitTime.current = Date.now();
    submissionCount.current += 1;

    try {
      // Insert transaction to database
      const { data: insertedData, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: formData.type as 'simpanan_pokok' | 'simpanan_wajib' | 'simpanan_sukarela' | 'setor_simpanan_wajib' | 'setor_simpanan_sukarela' | 'penarikan_simpanan_sukarela' | 'bayar_angsuran_pinjaman',
          amount: formData.amount,
          date: formData.date,
          payment_method: formData.paymentMethod,
          account_holder_name: formData.accountHolderName.trim(),
          notes: formData.notes.trim() || null,
          status: 'pending',
          installment_id: formData.type === 'bayar_angsuran_pinjaman' ? selectedInstallmentId : null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Optimistic update - add transaction to cache immediately
      if (insertedData) {
        const newTransaction: Transaction = {
          id: insertedData.id,
          userId: insertedData.user_id,
          type: insertedData.type,
          amount: Number(insertedData.amount),
          date: insertedData.date || '',
          status: insertedData.status || 'pending',
          paymentMethod: insertedData.payment_method,
          accountHolderName: insertedData.account_holder_name || '',
          notes: insertedData.notes || undefined,
          createdAt: insertedData.created_at || '',
          approvedAt: insertedData.approved_at || undefined,
          approvedBy: insertedData.approved_by || undefined,
          rejectionReason: insertedData.rejection_reason || undefined,
        };

        // Add to cache immediately so it shows in transaction list
        queryClient.setQueryData(['user-transactions', user.id], (oldData: Transaction[] | undefined) => {
          return oldData ? [newTransaction, ...oldData] : [newTransaction];
        });
      }

      // Show underpayment warning but still allow submission
      if (underpaymentAmount > 0) {
        toast.warning(t('Transaksi diajukan dengan kurang bayar', 'Transaction submitted with underpayment'), {
          description: t(`Kurang bayar: ${formatCurrency(underpaymentAmount)}. Akan dicatat sebagai pembayaran sebagian.`, `Underpayment: ${formatCurrency(underpaymentAmount)}. Will be recorded as partial payment.`),
        });
      } else {
        toast.success(t('Transaksi berhasil diajukan', 'Transaction submitted successfully'), {
          description: t('Menunggu verifikasi dari admin', 'Waiting for admin verification'),
        });
      }

      // Also invalidate to ensure data stays in sync
      queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['all-transactions'] });

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'transfer_bank',
        accountHolderName: '',
        notes: '',
      });
      setSelectedInstallmentId('');
      
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting transaction:', error);
      toast.error(t('Gagal mengajukan transaksi', 'Failed to submit transaction'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-base font-medium">{t('Input Transaksi', 'Input Transaction')}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {t('Data yang diinput harus sesuai dengan transaksi yang dilakukan di bank. Pengurus akan melakukan verifikasi.', 
             'The data entered must match the bank transaction. The management will verify.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Transaction Type & Amount - Compact Row */}
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={formData.type}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, type: value as TransactionType, amount: undefined }));
                setSelectedInstallmentId('');
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={t('Jenis', 'Type')} />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map(type => (
                  <SelectItem key={type.value} value={type.value} className="text-sm">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <CurrencyInput
              id="amount"
              placeholder={t('Nominal', 'Amount')}
              value={formData.amount || 0}
              onChange={(value) => setFormData(prev => ({ ...prev, amount: value }))}
              className="h-9 text-sm"
            />
          </div>

          {/* Voluntary Savings Balance Info */}
          {formData.type === 'penarikan_simpanan_sukarela' && (
            <div className="space-y-2 -mt-1">
              <p className="text-xs text-muted-foreground">
                {t('Saldo', 'Balance')}: {formatCurrency(voluntarySavings)}
              </p>
              {minHoldingMonths > 0 && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 border border-border text-xs">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-muted-foreground">
                      {t(
                        `Simpanan sukarela harus mengendap minimal ${minHoldingMonths} bulan sebelum bisa ditarik.`,
                        `Voluntary savings must be held for at least ${minHoldingMonths} months before withdrawal.`
                      )}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="text-primary font-medium">
                        {t('Bisa ditarik', 'Available')}: {formatCurrency(eligibleAmount)}
                      </span>
                      {lockedAmount > 0 && (
                        <span className="text-muted-foreground">
                          {t('Terkunci', 'Locked')}: {formatCurrency(lockedAmount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {withdrawalExceedsEligible && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">
                    {t(
                      `Jumlah penarikan melebihi saldo yang sudah mengendap ${minHoldingMonths} bulan. Maksimal yang bisa ditarik: ${formatCurrency(eligibleAmount)}`,
                      `Withdrawal amount exceeds balance held for ${minHoldingMonths} months. Maximum available: ${formatCurrency(eligibleAmount)}`
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Installment Selection - Only for loan payments */}
          {formData.type === 'bayar_angsuran_pinjaman' && unpaidInstallments.length > 0 && (
            <Select
              value={selectedInstallmentId}
              onValueChange={(value) => {
                setSelectedInstallmentId(value);
                const inst = unpaidInstallments.find(i => i.id === value);
                if (inst) {
                  const remaining = inst.totalAmount - inst.paidAmount + inst.penaltyAmount;
                  setFormData(prev => ({ ...prev, amount: remaining }));
                }
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={t('Pilih cicilan', 'Select installment')} />
              </SelectTrigger>
              <SelectContent>
                {unpaidInstallments.map(inst => (
                  <SelectItem key={inst.id} value={inst.id} className="text-sm">
                    {t(`#${inst.installmentNumber}`, `#${inst.installmentNumber}`)}
                    {inst.status === 'overdue' && ` (${t('Menunggak', 'Overdue')})`}
                    {inst.status === 'unpaid' && ` (${t('Belum Dibayar', 'Unpaid')})`}
                    {inst.status === 'partial' && ` (${t('Sebagian', 'Partial')})`}
                    {' - '}{formatCurrency(inst.totalAmount - inst.paidAmount + inst.penaltyAmount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date & Payment Method - Compact Row */}
          <div className="grid grid-cols-2 gap-2">
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="h-9 text-sm"
            />
            <Select
              value={formData.paymentMethod}
              onValueChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value as PaymentMethod }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map(method => (
                  <SelectItem key={method.value} value={method.value} className="text-sm">
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Installment Details - Compact */}
          {selectedInstallment && (() => {
            const settings = getCooperativeSettings();
            const dueDate = new Date(selectedInstallment.dueDate);
            const today = new Date();
            const isOverdue = today > dueDate && selectedInstallment.status !== 'paid';
            const daysLate = isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;
            
            return (
              <div className={`rounded-md border p-3 text-xs space-y-1.5 ${isOverdue ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {t(`Angsuran #${selectedInstallment.installmentNumber}`, `Installment #${selectedInstallment.installmentNumber}`)}
                  </span>
                  {isOverdue && (
                    <span className="flex items-center gap-1 text-destructive">
                      <Clock className="h-3 w-3" />
                      {t(`${daysLate} hari`, `${daysLate} days`)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                  <span>{t('Pokok', 'Principal')}: {formatCurrency(selectedInstallment.principalAmount)}</span>
                  <span>{t('Bunga', 'Interest')}: {formatCurrency(selectedInstallment.interestAmount)}</span>
                  {selectedInstallment.penaltyAmount > 0 && (
                    <span className="text-destructive">{t('Denda', 'Penalty')}: {formatCurrency(selectedInstallment.penaltyAmount)}</span>
                  )}
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-border/50">
                  <span className="text-muted-foreground">{t('Total', 'Total')}:</span>
                  <span className="font-semibold text-sm text-primary">{formatCurrency(expectedAmount)}</span>
                </div>
              </div>
            );
          })()}

          {/* Underpayment Warning - Compact */}
          {underpaymentAmount > 0 && (
            <Alert variant="destructive" className="py-2 px-3">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">
                {t('Kurang Bayar', 'Underpayment')}: {formatCurrency(underpaymentAmount)}
              </AlertDescription>
            </Alert>
          )}

          {/* Overpayment Info - Show how excess will be applied */}
          {overpaymentAmount > 0 && (
            <Alert className="py-2 px-3 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
              <AlertTriangle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-xs text-blue-800 dark:text-blue-300">
                <div className="space-y-1">
                  <div className="font-medium">
                    {t('Kelebihan Bayar', 'Overpayment')}: {formatCurrency(overpaymentAmount)}
                  </div>
                  {nextInstallmentsForOverpayment.length > 0 ? (
                    <div>
                      {t('Akan diterapkan ke angsuran berikutnya:', 'Will be applied to next installments:')}
                      <ul className="mt-1 list-disc list-inside">
                        {nextInstallmentsForOverpayment.map(inst => (
                          <li key={inst.installmentNumber}>
                            #{inst.installmentNumber}: {formatCurrency(inst.amount)}
                          </li>
                        ))}
                      </ul>
                      {(() => {
                        const distributedAmount = nextInstallmentsForOverpayment.reduce((sum, inst) => sum + inst.amount, 0);
                        const remainingExcess = overpaymentAmount - distributedAmount;
                        if (remainingExcess > 0) {
                          return (
                            <p className="mt-1 text-blue-600 dark:text-blue-400">
                              {t(`Sisa ${formatCurrency(remainingExcess)} akan dikembalikan ke simpanan sukarela.`, 
                                 `Remaining ${formatCurrency(remainingExcess)} will be refunded to voluntary savings.`)}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    <div>
                      {t('Tidak ada angsuran berikutnya. Kelebihan akan dikembalikan ke simpanan sukarela Anda.', 
                         'No next installments. Excess will be refunded to your voluntary savings.')}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Withdrawal exceeds savings warning */}
          {withdrawalExceedsSavings && (
            <Alert variant="destructive" className="py-2 px-3">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">
                {t(`Melebihi saldo: ${formatCurrency(voluntarySavings)}`, `Exceeds balance: ${formatCurrency(voluntarySavings)}`)}
              </AlertDescription>
            </Alert>
          )}

          {/* Account Holder Name */}
          <div className="space-y-1.5">
            <Label htmlFor="accountHolderName" className="text-xs font-medium text-muted-foreground">
              {t('Nama Pengirim (sesuai rekening bank)', 'Sender Name (as per bank account)')}
            </Label>
            <Input
              id="accountHolderName"
              placeholder={t('Nama pemilik rekening pengirim', 'Sender account holder name')}
              value={formData.accountHolderName}
              onChange={(e) => setFormData(prev => ({ ...prev, accountHolderName: e.target.value }))}
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              {t('Nama ini akan dicocokkan dengan mutasi bank oleh admin', 'This name will be matched with bank statement by admin')}
            </p>
          </div>

          {/* Notes - Compact */}
          <Textarea
            id="notes"
            placeholder={t('Catatan (opsional)', 'Notes (optional)')}
            rows={2}
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="text-sm resize-none"
          />

          <Button type="submit" className="w-full h-9 text-sm" disabled={isLoading || withdrawalExceedsSavings}>
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('Memproses...', 'Processing...')}
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                {t('Ajukan', 'Submit')}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
