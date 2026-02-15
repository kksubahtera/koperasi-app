import { LoanInstallment } from '@/lib/types';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';

export interface PenaltyCalculation {
  daysLate: number;
  monthsLate: number;
  penaltyAmount: number;
  penaltyRate: number;
  penaltyBase: number;
}

/**
 * Calculate late payment penalty for an installment
 */
export const calculateInstallmentPenalty = (
  installment: LoanInstallment,
  loanPrincipalAmount: number,
  asOfDate: Date = new Date()
): PenaltyCalculation => {
  const settings = getCooperativeSettings();
  const dueDate = new Date(installment.dueDate);
  const gracePeriodDays = settings.penaltyGracePeriodDays || 0;
  
  // Calculate the date when penalty starts (due date + grace period)
  const penaltyStartDate = new Date(dueDate);
  penaltyStartDate.setDate(penaltyStartDate.getDate() + gracePeriodDays);
  
  // If already paid or not yet past grace period, no penalty
  if (installment.status === 'paid' || asOfDate <= penaltyStartDate) {
    return {
      daysLate: 0,
      monthsLate: 0,
      penaltyAmount: 0,
      penaltyRate: settings.latePaymentPenalty,
      penaltyBase: 0,
    };
  }

  // Calculate days late (from when penalty starts, not from due date)
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLate = Math.floor((asOfDate.getTime() - penaltyStartDate.getTime()) / msPerDay);
  const monthsLate = Math.ceil(daysLate / 30);

  // Determine penalty base amount
  let penaltyBase: number;
  if (settings.latePaymentPenaltyBase === 'remaining_principal') {
    // Penalty based on remaining loan principal
    penaltyBase = loanPrincipalAmount;
  } else {
    // Penalty based on remaining installment amount
    penaltyBase = installment.totalAmount - installment.paidAmount;
  }

  // Calculate penalty amount
  let penaltyAmount: number;
  const penaltyRate = settings.latePaymentPenalty / 100; // Convert percentage to decimal

  if (settings.latePaymentPenaltyType === 'daily') {
    // Daily penalty: rate per day
    penaltyAmount = penaltyBase * penaltyRate * daysLate;
  } else {
    // Monthly penalty: rate per month (rounded up)
    penaltyAmount = penaltyBase * penaltyRate * monthsLate;
  }

  // Round to nearest rupiah
  penaltyAmount = Math.round(penaltyAmount);

  return {
    daysLate,
    monthsLate,
    penaltyAmount,
    penaltyRate: settings.latePaymentPenalty,
    penaltyBase,
  };
};

/**
 * Update installment with calculated penalty
 * Status logic:
 * - pending: belum jatuh tempo
 * - unpaid: sudah jatuh tempo tapi masih dalam masa tenggang (belum ada denda)
 * - overdue: menunggak (denda sudah diterapkan, lewat masa tenggang)
 * - paid: lunas
 * - partial: dibayar sebagian
 */
export const applyPenaltyToInstallment = (
  installment: LoanInstallment,
  loanPrincipalAmount: number,
  asOfDate: Date = new Date()
): LoanInstallment => {
  const settings = getCooperativeSettings();
  const penalty = calculateInstallmentPenalty(installment, loanPrincipalAmount, asOfDate);
  
  const dueDate = new Date(installment.dueDate);
  const gracePeriodDays = settings.penaltyGracePeriodDays || 0;
  
  // Calculate grace period end date
  const gracePeriodEndDate = new Date(dueDate);
  gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + gracePeriodDays);
  
  // Skip status update for paid installments
  if (installment.status === 'paid') {
    return {
      ...installment,
      penaltyAmount: 0,
      penaltyMonths: 0,
    };
  }
  
  // Determine status based on date and penalty
  let status = installment.status;
  
  if (installment.status === 'pending' || installment.status === 'unpaid' || installment.status === 'overdue') {
    if (asOfDate <= dueDate) {
      // Belum jatuh tempo
      status = 'pending';
    } else if (asOfDate > dueDate && asOfDate <= gracePeriodEndDate) {
      // Sudah jatuh tempo tapi masih dalam masa tenggang (belum ada denda)
      status = 'unpaid';
    } else if (asOfDate > gracePeriodEndDate) {
      // Lewat masa tenggang = menunggak (denda diterapkan)
      status = 'overdue';
    }
  }

  return {
    ...installment,
    penaltyAmount: penalty.penaltyAmount,
    penaltyMonths: penalty.monthsLate,
    status,
  };
};

/**
 * Format penalty description for display
 */
export const formatPenaltyDescription = (
  daysLate: number,
  monthsLate: number,
  penaltyType: 'daily' | 'monthly',
  penaltyRate: number
): string => {
  if (daysLate === 0) return '';
  
  if (penaltyType === 'daily') {
    return `Denda ${penaltyRate}%/hari x ${daysLate} hari`;
  } else {
    return `Denda ${penaltyRate}%/bulan x ${monthsLate} bulan`;
  }
};
