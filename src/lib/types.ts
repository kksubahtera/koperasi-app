export type UserRole = 'member' | 'admin';

export type TransactionStatus = 'pending' | 'approved' | 'rejected';

export type TransactionType = 
  | 'simpanan_pokok' 
  | 'simpanan_wajib' 
  | 'simpanan_sukarela' 
  | 'setor_simpanan_wajib'
  | 'setor_simpanan_sukarela'
  | 'penarikan_simpanan_sukarela'
  | 'bayar_angsuran_pinjaman'
  | 'pencairan_pinjaman'
  | 'saldo_awal_pokok'
  | 'saldo_awal_wajib'
  | 'saldo_awal_sukarela'
  | 'saldo_awal_pinjaman';

export type PaymentMethod = 'transfer_bank' | 'e_wallet';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  nik: string;
  address: string;
  bankAccountNumber: string;
  bankAccountName: string;
  profilePhoto?: string;
  role: UserRole;
  memberNumber: string;
  joinDate: string;
  exitDate?: string;
  exitYear?: number;
  isActive: boolean;
  branchId?: string | null;
}

export interface SavingsSummary {
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  totalSimpanan: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  date: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  accountHolderName: string;
  notes?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  // Adjustment fields
  originalAmount?: number | null;
  originalDate?: string | null;
  adjustedBy?: string | null;
  adjustmentReason?: string | null;
  adjustedAt?: string | null;
}

export interface Loan {
  id: string;
  userId: string;
  principalAmount: number;
  tenor: number; // in months
  interestRate: number; // percentage (e.g., 2 for 2%)
  disbursementDate: string;
  remainingPrincipal: number;
  status: 'pending' | 'active' | 'completed' | 'defaulted' | 'rejected';
  applicationDate?: string;
  rejectionReason?: string;
}

export interface LoanInstallment {
  id: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  paidAmount: number;
  paidDate?: string;
  // Status: pending = belum jatuh tempo, unpaid = jatuh tempo belum dibayar, overdue = menunggak (denda diterapkan), paid, partial
  status: 'pending' | 'paid' | 'overdue' | 'partial' | 'unpaid';
  penaltyAmount: number;
  penaltyMonths: number;
  // Adjusted amounts from admin keringanan
  adjustedInterestAmount?: number | null;
  adjustedPenaltyAmount?: number | null;
  adjustmentReason?: string | null;
}

export interface SHURecord {
  id: string;
  userId: string;
  year: number;
  amount: number;
  distributedAt: string;
  notes?: string;
}

export interface CooperativeSummary {
  totalSimpananPokok: number;
  totalSimpananWajib: number;
  totalSimpananSukarela: number;
  totalAssets: number;
  totalCash: number;
  totalReceivables: number;
  totalInterestReceived: number;
  totalPenaltyReceived: number;
  totalOutstandingPrincipal: number;
  totalOutstandingInterest: number;
  totalMembers: number;
  membersWithLoans: number;
  membersDefaulting: number;
}

export interface PenaltyInfo {
  currentMonthPenalty: number;
  accumulatedPenalty: number;
  penaltyHistory: {
    month: string;
    amount: number;
  }[];
}

export type CorrectionType = 
  | 'simpanan_pokok'
  | 'simpanan_wajib' 
  | 'simpanan_sukarela'
  | 'angsuran_pinjaman';

export type CorrectionOperation = 'add' | 'subtract';

export type CorrectionStatus = 'applied' | 'reported' | 'resolved' | 'resolved_approved' | 'resolved_rejected';

export type CorrectionMode = 'nominal' | 'transaction_based';

export interface CorrectionTransaction {
  id: string;
  userId: string;
  correctionType: CorrectionType;
  operation: CorrectionOperation;
  amount: number;
  currentBalance: number;
  newBalance: number;
  reason: string;
  footnote: string;
  installmentId?: string; // For angsuran_pinjaman type
  installmentNumber?: number;
  createdAt: string;
  createdBy: string;
  status: CorrectionStatus;
  reportedAt?: string;
  reportReason?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  // New fields for dual-mode and journal integration
  correctionMode: CorrectionMode;
  transactionId?: string; // Reference to original transaction (for transaction_based mode)
  journalEntryId?: string; // Reference to journal entry created from this correction
}

// ========== MIGRATION TYPES ==========

export type MigrationJournalMode = 'per_transaction' | 'per_batch';

export type InstallmentMigrationStatus = 'paid' | 'partial' | 'unpaid';

export interface InstallmentMigrationEntry {
  rowIndex: number;
  memberNumber: string;
  memberName: string;
  memberId?: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  expectedPrincipal: number;
  expectedInterest: number;
  paidDate?: string;
  principalPaid: number;
  interestPaid: number;
  penaltyPaid: number;
  status: InstallmentMigrationStatus;
  notes?: string;
  // Validation
  isValid: boolean;
  validationErrors: string[];
  validationWarnings: string[];
}

export interface LoanWithInstallmentMigrationEntry {
  rowIndex: number;
  memberNumber: string;
  memberName?: string;
  memberId?: string;
  principalAmount: number;
  tenor: number;
  interestRate: number;
  disbursementDate: string;
  notes?: string;
  installments: InstallmentPaymentEntry[];
  // Validation
  isValid: boolean;
  validationErrors: string[];
  validationWarnings: string[];
}

export interface InstallmentPaymentEntry {
  installmentNumber: number;
  paidDate: string;
  principalPaid: number;
  interestPaid: number;
  penaltyPaid: number;
  status: 'paid' | 'partial';
}

export interface MigrationBatch {
  id: string;
  type: 'installment' | 'savings' | 'loan_with_installment';
  createdAt: string;
  createdBy: string;
  totalRecords: number;
  successCount: number;
  failCount: number;
  journalMode: MigrationJournalMode;
  journalEntryIds: string[];
  notes?: string;
}

export interface InstallmentMigrationResult {
  success: boolean;
  successCount: number;
  failCount: number;
  errors: string[];
  warnings: string[];
  journalEntryIds: string[];
  batchId?: string;
}
