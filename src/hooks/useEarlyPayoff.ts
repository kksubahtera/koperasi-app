import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loan, LoanInstallment } from '@/lib/types';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';

interface EarlyPayoffCalculation {
  remainingPrincipal: number;
  currentPeriodInterest: number;
  currentPeriodPenalty: number;
  overdueInterest: number;      // Bunga dari periode sebelumnya yang belum dibayar
  overduePenalty: number;       // Denda dari periode sebelumnya yang belum dibayar
  earlyPayoffFee: number;
  totalPayoffAmount: number;
  waivedInterest: number;
  currentInstallment: LoanInstallment | null;
  overdueInstallments: LoanInstallment[];  // Angsuran yang sudah jatuh tempo tapi belum dibayar
  overdueAlreadyPaid: number;   // Jumlah yang sudah dibayar untuk angsuran tertunggak
  currentAlreadyPaid: number;   // Jumlah yang sudah dibayar untuk angsuran berjalan
  overdueRemaining: number;     // Sisa yang harus dibayar dari angsuran tertunggak
  currentRemaining: number;     // Sisa yang harus dibayar dari angsuran berjalan
}

interface UseEarlyPayoffReturn {
  calculation: EarlyPayoffCalculation | null;
  isCalculating: boolean;
  isSubmitting: boolean;
  canRequestEarlyPayoff: boolean;
  requiresApproval: boolean;
  calculateEarlyPayoff: (loan: Loan, installments: LoanInstallment[]) => EarlyPayoffCalculation;
  submitEarlyPayoffRequest: (
    loanId: string, 
    amount: number, 
    calculation: EarlyPayoffCalculation,
    loan: Loan,
    notes?: string
  ) => Promise<boolean>;
}

export type { EarlyPayoffCalculation };

export const useEarlyPayoff = (): UseEarlyPayoffReturn => {
  const { user } = useAuth();
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const settings = getCooperativeSettings();
  
  const canRequestEarlyPayoff = settings.earlyPayoffEnabled ?? true;
  const requiresApproval = settings.earlyPayoffRequiresApproval ?? true;
  const earlyPayoffFeeType = settings.earlyPayoffFeeType ?? 'none';
  const earlyPayoffFeeAmount = settings.earlyPayoffFeeAmount ?? 0;

  const calculateEarlyPayoff = (loan: Loan, installments: LoanInstallment[]): EarlyPayoffCalculation => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get unpaid installments for this loan, sorted by installment number
    const unpaidInstallments = installments
      .filter(i => i.loanId === loan.id && i.status !== 'paid')
      .sort((a, b) => a.installmentNumber - b.installmentNumber);
    
    // Separate overdue installments (already past due date) from current/future
    const overdueInstallments: LoanInstallment[] = [];
    let currentInstallment: LoanInstallment | null = null;
    const futureInstallments: LoanInstallment[] = [];
    
    for (const inst of unpaidInstallments) {
      const dueDate = new Date(inst.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      
      if (dueDate < today) {
        // Overdue - past due date
        overdueInstallments.push(inst);
      } else if (!currentInstallment) {
        // Current period - first installment that's not yet overdue
        currentInstallment = inst;
      } else {
        // Future installments
        futureInstallments.push(inst);
      }
    }
    
    // If no current installment but there are overdue ones, the first overdue is "current"
    if (!currentInstallment && overdueInstallments.length > 0) {
      currentInstallment = overdueInstallments.pop() || null;
    }
    
    // Calculate remaining principal
    const remainingPrincipal = loan.remainingPrincipal;
    
    // Current period interest and penalty
    const currentPeriodInterest = currentInstallment?.interestAmount || 0;
    const currentPeriodPenalty = currentInstallment?.penaltyAmount || 0;
    
    // Overdue interest and penalty from previous periods (must be paid)
    const overdueInterest = overdueInstallments.reduce((sum, i) => sum + i.interestAmount, 0);
    const overduePenalty = overdueInstallments.reduce((sum, i) => sum + (i.penaltyAmount || 0), 0);
    
    // Calculate amounts already paid for overdue and current installments
    const overdueAlreadyPaid = overdueInstallments.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
    const currentAlreadyPaid = currentInstallment?.paidAmount || 0;
    
    // Calculate total due for overdue installments
    const totalOverdueDue = overdueInstallments.reduce((sum, i) => 
      sum + i.totalAmount + (i.penaltyAmount || 0), 0);
    
    // Calculate remaining amounts after partial payments
    const overdueRemaining = Math.max(0, totalOverdueDue - overdueAlreadyPaid);
    
    // Calculate remaining for current installment
    const currentTotalDue = (currentInstallment?.totalAmount || 0) + (currentInstallment?.penaltyAmount || 0);
    const currentRemaining = Math.max(0, currentTotalDue - currentAlreadyPaid);
    
    // Calculate early payoff fee based on settings
    let earlyPayoffFee = 0;
    if (earlyPayoffFeeType === 'fixed') {
      earlyPayoffFee = earlyPayoffFeeAmount;
    } else if (earlyPayoffFeeType === 'percentage') {
      earlyPayoffFee = (remainingPrincipal * earlyPayoffFeeAmount) / 100;
    }
    
    // Total amount to pay for early payoff:
    // Remaining principal + remaining from current installment (after partial payment) 
    // + remaining from overdue (after partial payments) + fee
    // Note: remainingPrincipal already accounts for principal from paid installments
    // So we need to add only interest/penalty portions that haven't been paid
    const totalPayoffAmount = 
      remainingPrincipal + 
      overdueRemaining + 
      currentRemaining + 
      earlyPayoffFee -
      // Subtract principal components since they're already in remainingPrincipal
      overdueInstallments.reduce((sum, i) => sum + i.principalAmount, 0) -
      (currentInstallment?.principalAmount || 0);
    
    // Calculate waived interest (future interest that would have been paid - not including current)
    const waivedInterest = futureInstallments.reduce((sum, i) => sum + i.interestAmount, 0);
    
    return {
      remainingPrincipal,
      currentPeriodInterest,
      currentPeriodPenalty,
      overdueInterest,
      overduePenalty,
      earlyPayoffFee,
      totalPayoffAmount,
      waivedInterest,
      currentInstallment,
      overdueInstallments,
      overdueAlreadyPaid,
      currentAlreadyPaid,
      overdueRemaining,
      currentRemaining,
    };
  };

  const submitEarlyPayoffRequest = async (
    loanId: string, 
    amount: number, 
    calculation: EarlyPayoffCalculation,
    loan: Loan,
    notes?: string
  ): Promise<boolean> => {
    if (!user?.id) {
      toast.error('Silakan login terlebih dahulu');
      return false;
    }

    setIsSubmitting(true);
    
    try {
      // Create metadata for the early payoff to be parsed in reports
      const metadata = {
        pelunasan_dini: true,
        loanId: loanId,
        principalAmount: loan.principalAmount,
        remainingPrincipal: calculation.remainingPrincipal,
        currentInterest: calculation.currentPeriodInterest,
        currentPenalty: calculation.currentPeriodPenalty,
        overdueInterest: calculation.overdueInterest,
        overduePenalty: calculation.overduePenalty,
        totalInterestPaid: calculation.currentPeriodInterest + calculation.overdueInterest,
        totalPenaltyPaid: calculation.currentPeriodPenalty + calculation.overduePenalty,
        earlyPayoffFee: calculation.earlyPayoffFee,
        interestSaved: calculation.waivedInterest,
        originalTenor: loan.tenor,
        overdueInstallmentsCount: calculation.overdueInstallments?.length || 0,
        paidInstallments: loan.tenor - (calculation.currentInstallment ? 
          (loan.tenor - calculation.currentInstallment.installmentNumber + 1) : 0),
        remainingInstallments: calculation.currentInstallment ? 
          (loan.tenor - calculation.currentInstallment.installmentNumber + 1) : 0,
      };

      // Create early payoff notes as JSON for easy parsing
      const earlyPayoffNotes = JSON.stringify({
        type: 'pelunasan_dini',
        loan_id: loanId,
        user_notes: notes || '',
        ...metadata
      });

      // Create a transaction for early payoff
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'bayar_angsuran_pinjaman',
          amount: amount,
          payment_method: 'transfer_bank',
          status: requiresApproval ? 'pending' : 'approved',
          notes: earlyPayoffNotes,
          account_holder_name: user.name || '',
        })
        .select()
        .single();

      if (error) throw error;

      // Create admin notification for early payoff request
      await supabase.from('admin_notifications').insert({
        title: 'Pengajuan Pelunasan Dini',
        message: `Anggota mengajukan pelunasan dini pinjaman sebesar Rp ${amount.toLocaleString('id-ID')}. Penghematan bunga: Rp ${calculation.waivedInterest.toLocaleString('id-ID')}`,
        notification_type: 'early_payoff_request',
        metadata: {
          loan_id: loanId,
          transaction_id: data.id,
          amount: amount,
          user_id: user.id,
          interest_saved: calculation.waivedInterest,
          ...metadata,
        },
      });

      if (requiresApproval) {
        toast.success('Pengajuan pelunasan dini berhasil dikirim. Menunggu persetujuan admin.');
      } else {
        toast.success('Pelunasan dini berhasil diproses.');
      }
      
      return true;
    } catch (error) {
      console.error('Error submitting early payoff:', error);
      toast.error('Gagal mengajukan pelunasan dini');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    calculation: null,
    isCalculating,
    isSubmitting,
    canRequestEarlyPayoff,
    requiresApproval,
    calculateEarlyPayoff,
    submitEarlyPayoffRequest,
  };
};
