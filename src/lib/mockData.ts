import { 
  User, 
  Transaction, 
  Loan, 
  LoanInstallment, 
  SHURecord, 
  SavingsSummary,
  CooperativeSummary 
} from './types';

export const mockUsers: User[] = [
  {
    id: '1',
    name: 'Ahmad Rizki Pratama',
    email: 'ahmad.rizki@email.com',
    phone: '081234567890',
    nik: '3271234567890001',
    address: 'Jl. Merdeka No. 10, Jakarta Selatan',
    bankAccountNumber: '1234567890',
    bankAccountName: 'Ahmad Rizki Pratama',
    role: 'member',
    memberNumber: 'KOP-2024-001',
    joinDate: '2024-01-15',
    isActive: true,
  },
  {
    id: '2',
    name: 'Siti Nurhaliza',
    email: 'siti.nur@email.com',
    phone: '081234567891',
    nik: '3271234567890002',
    address: 'Jl. Sudirman No. 25, Jakarta Pusat',
    bankAccountNumber: '0987654321',
    bankAccountName: 'Siti Nurhaliza',
    role: 'member',
    memberNumber: 'KOP-2024-002',
    joinDate: '2024-02-20',
    isActive: true,
  },
  {
    id: '3',
    name: 'Dewi Lestari',
    email: 'dewi.lestari@email.com',
    phone: '081234567892',
    nik: '3271234567890003',
    address: 'Jl. Gatot Subroto No. 15, Bandung',
    bankAccountNumber: '5678901234',
    bankAccountName: 'Dewi Lestari',
    role: 'member',
    memberNumber: 'KOP-2023-015',
    joinDate: '2023-06-10',
    exitDate: '2024-03-15',
    exitYear: 2024,
    isActive: false,
  },
  {
    id: '4',
    name: 'Rudi Hermawan',
    email: 'rudi.hermawan@email.com',
    phone: '081234567893',
    nik: '3271234567890004',
    address: 'Jl. Ahmad Yani No. 30, Surabaya',
    bankAccountNumber: '1122334455',
    bankAccountName: 'Rudi Hermawan',
    role: 'member',
    memberNumber: 'KOP-2022-008',
    joinDate: '2022-04-20',
    exitDate: '2023-12-01',
    exitYear: 2023,
    isActive: false,
  },
  // New test accounts
  {
    id: '5',
    name: 'Andi Wijaya',
    email: 'andi.wijaya@email.com',
    phone: '081234567894',
    nik: '3271234567890005',
    address: 'Jl. Diponegoro No. 5, Semarang',
    bankAccountNumber: '2233445566',
    bankAccountName: 'Andi Wijaya',
    role: 'member',
    memberNumber: 'KOP-2024-003',
    joinDate: '2024-03-01',
    isActive: true,
  },
  {
    id: '6',
    name: 'Maya Sari',
    email: 'maya.sari@email.com',
    phone: '081234567895',
    nik: '3271234567890006',
    address: 'Jl. Pahlawan No. 20, Yogyakarta',
    bankAccountNumber: '3344556677',
    bankAccountName: 'Maya Sari',
    role: 'member',
    memberNumber: 'KOP-2024-004',
    joinDate: '2024-04-15',
    isActive: true,
  },
  {
    id: 'admin1',
    name: 'Budi Santoso',
    email: 'admin@koperasi.com',
    phone: '081234567899',
    nik: '3271234567890099',
    address: 'Jl. Thamrin No. 1, Jakarta Pusat',
    bankAccountNumber: '9999888877',
    bankAccountName: 'Budi Santoso',
    role: 'admin',
    memberNumber: 'KOP-ADM-001',
    joinDate: '2023-01-01',
    isActive: true,
  },
];

export const mockSavings: Record<string, SavingsSummary> = {
  '1': {
    simpananPokok: 200000,
    simpananWajib: 600000, // 12 months
    simpananSukarela: 1500000,
    totalSimpanan: 2300000,
  },
  '2': {
    simpananPokok: 200000,
    simpananWajib: 500000, // 10 months
    simpananSukarela: 800000,
    totalSimpanan: 1500000,
  },
  '3': {
    simpananPokok: 200000,
    simpananWajib: 450000,
    simpananSukarela: 350000,
    totalSimpanan: 1000000,
  },
  '4': {
    simpananPokok: 200000,
    simpananWajib: 600000,
    simpananSukarela: 200000,
    totalSimpanan: 1000000,
  },
  // Andi - has loan with arrears, savings < arrears (will have shortfall)
  '5': {
    simpananPokok: 200000,
    simpananWajib: 300000,
    simpananSukarela: 100000,
    totalSimpanan: 600000,
  },
  // Maya - no loan, clean resignation
  '6': {
    simpananPokok: 200000,
    simpananWajib: 400000,
    simpananSukarela: 500000,
    totalSimpanan: 1100000,
  },
};

export const mockTransactions: Transaction[] = [
  {
    id: 'trx-001',
    userId: '1',
    type: 'simpanan_pokok',
    amount: 200000,
    date: '2024-01-15',
    status: 'approved',
    paymentMethod: 'transfer_bank',
    accountHolderName: 'Ahmad Rizki Pratama',
    createdAt: '2024-01-15T10:00:00Z',
    approvedAt: '2024-01-15T14:00:00Z',
    approvedBy: 'admin1',
  },
  {
    id: 'trx-002',
    userId: '1',
    type: 'simpanan_wajib',
    amount: 50000,
    date: '2024-02-01',
    status: 'approved',
    paymentMethod: 'transfer_bank',
    accountHolderName: 'Ahmad Rizki Pratama',
    createdAt: '2024-02-01T09:00:00Z',
    approvedAt: '2024-02-01T15:00:00Z',
    approvedBy: 'admin1',
  },
  {
    id: 'trx-003',
    userId: '1',
    type: 'simpanan_sukarela',
    amount: 500000,
    date: '2024-03-10',
    status: 'approved',
    paymentMethod: 'transfer_bank',
    accountHolderName: 'Ahmad Rizki Pratama',
    createdAt: '2024-03-10T11:00:00Z',
    approvedAt: '2024-03-10T16:00:00Z',
    approvedBy: 'admin1',
  },
  {
    id: 'trx-004',
    userId: '1',
    type: 'simpanan_wajib',
    amount: 150000, // 3 months
    date: '2024-12-20',
    status: 'pending',
    paymentMethod: 'transfer_bank',
    accountHolderName: 'Ahmad Rizki Pratama',
    createdAt: '2024-12-20T08:00:00Z',
  },
  {
    id: 'trx-005',
    userId: '2',
    type: 'bayar_angsuran_pinjaman',
    amount: 220000,
    date: '2024-12-15',
    status: 'pending',
    paymentMethod: 'transfer_bank',
    accountHolderName: 'Siti Nurhaliza',
    notes: 'Angsuran bulan Desember',
    createdAt: '2024-12-15T10:00:00Z',
  },
];

export const mockLoans: Loan[] = [
  {
    id: 'loan-001',
    userId: '2',
    principalAmount: 3000000,
    tenor: 15,
    interestRate: 2,
    disbursementDate: '2024-06-01',
    remainingPrincipal: 2200000,
    status: 'active',
  },
  // Andi has a loan with significant arrears
  {
    id: 'loan-002',
    userId: '5',
    principalAmount: 2000000,
    tenor: 10,
    interestRate: 2,
    disbursementDate: '2024-03-01',
    remainingPrincipal: 1400000,
    status: 'active',
  },
  // Completed loan for Budi (userId: 2) - historical
  {
    id: 'loan-003',
    userId: '2',
    principalAmount: 2000000,
    tenor: 6,
    interestRate: 2,
    disbursementDate: '2023-06-01',
    remainingPrincipal: 0,
    status: 'completed',
  },
  // Completed loan for Ani (userId: 5)
  {
    id: 'loan-004',
    userId: '5',
    principalAmount: 1500000,
    tenor: 5,
    interestRate: 2,
    disbursementDate: '2023-08-01',
    remainingPrincipal: 0,
    status: 'completed',
  },
];

export const mockInstallments: LoanInstallment[] = [
  {
    id: 'inst-001',
    loanId: 'loan-001',
    installmentNumber: 1,
    dueDate: '2024-07-01',
    principalAmount: 200000,
    interestAmount: 60000, // 2% of 3000000
    totalAmount: 260000,
    paidAmount: 260000,
    paidDate: '2024-06-28',
    status: 'paid',
    penaltyAmount: 0,
    penaltyMonths: 0,
  },
  {
    id: 'inst-002',
    loanId: 'loan-001',
    installmentNumber: 2,
    dueDate: '2024-08-01',
    principalAmount: 200000,
    interestAmount: 56000, // 2% of 2800000
    totalAmount: 256000,
    paidAmount: 256000,
    paidDate: '2024-07-30',
    status: 'paid',
    penaltyAmount: 0,
    penaltyMonths: 0,
  },
  {
    id: 'inst-003',
    loanId: 'loan-001',
    installmentNumber: 3,
    dueDate: '2024-09-01',
    principalAmount: 200000,
    interestAmount: 52000, // 2% of 2600000
    totalAmount: 252000,
    paidAmount: 252000,
    paidDate: '2024-09-05',
    status: 'paid',
    penaltyAmount: 0,
    penaltyMonths: 0,
  },
  {
    id: 'inst-004',
    loanId: 'loan-001',
    installmentNumber: 4,
    dueDate: '2024-10-01',
    principalAmount: 200000,
    interestAmount: 48000, // 2% of 2400000
    totalAmount: 248000,
    paidAmount: 248000,
    paidDate: '2024-10-02',
    status: 'paid',
    penaltyAmount: 0,
    penaltyMonths: 0,
  },
  {
    id: 'inst-005',
    loanId: 'loan-001',
    installmentNumber: 5,
    dueDate: '2024-11-01',
    principalAmount: 200000,
    interestAmount: 44000, // 2% of 2200000
    totalAmount: 244000,
    paidAmount: 0,
    status: 'overdue',
    penaltyAmount: 12200, // 0.5% * 2 months
    penaltyMonths: 2,
  },
  {
    id: 'inst-006',
    loanId: 'loan-001',
    installmentNumber: 6,
    dueDate: '2024-12-01',
    principalAmount: 200000,
    interestAmount: 40000, // 2% of 2000000
    totalAmount: 240000,
    paidAmount: 0,
    status: 'overdue',
    penaltyAmount: 6000, // 0.5% * 1 month
    penaltyMonths: 1,
  },
  // Future installments for loan-001
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `inst-00${7 + i}`,
    loanId: 'loan-001',
    installmentNumber: 7 + i,
    dueDate: new Date(2025, i, 1).toISOString().split('T')[0],
    principalAmount: 200000,
    interestAmount: Math.round((2000000 - (i * 200000)) * 0.02),
    totalAmount: 200000 + Math.round((2000000 - (i * 200000)) * 0.02),
    paidAmount: 0,
    status: 'pending' as const,
    penaltyAmount: 0,
    penaltyMonths: 0,
  })),
  // Installments for Andi's loan (loan-002) - has significant arrears
  {
    id: 'inst-a01',
    loanId: 'loan-002',
    installmentNumber: 1,
    dueDate: '2024-04-01',
    principalAmount: 200000,
    interestAmount: 40000,
    totalAmount: 240000,
    paidAmount: 240000,
    paidDate: '2024-04-01',
    status: 'paid' as const,
    penaltyAmount: 0,
    penaltyMonths: 0,
  },
  {
    id: 'inst-a02',
    loanId: 'loan-002',
    installmentNumber: 2,
    dueDate: '2024-05-01',
    principalAmount: 200000,
    interestAmount: 36000,
    totalAmount: 236000,
    paidAmount: 236000,
    paidDate: '2024-05-01',
    status: 'paid' as const,
    penaltyAmount: 0,
    penaltyMonths: 0,
  },
  {
    id: 'inst-a03',
    loanId: 'loan-002',
    installmentNumber: 3,
    dueDate: '2024-06-01',
    principalAmount: 200000,
    interestAmount: 32000,
    totalAmount: 232000,
    paidAmount: 232000,
    paidDate: '2024-06-01',
    status: 'paid' as const,
    penaltyAmount: 0,
    penaltyMonths: 0,
  },
  // Overdue installments for Andi
  {
    id: 'inst-a04',
    loanId: 'loan-002',
    installmentNumber: 4,
    dueDate: '2024-07-01',
    principalAmount: 200000,
    interestAmount: 28000,
    totalAmount: 228000,
    paidAmount: 0,
    status: 'overdue' as const,
    penaltyAmount: 34200, // accumulated
    penaltyMonths: 6,
  },
  {
    id: 'inst-a05',
    loanId: 'loan-002',
    installmentNumber: 5,
    dueDate: '2024-08-01',
    principalAmount: 200000,
    interestAmount: 24000,
    totalAmount: 224000,
    paidAmount: 0,
    status: 'overdue' as const,
    penaltyAmount: 28000,
    penaltyMonths: 5,
  },
  {
    id: 'inst-a06',
    loanId: 'loan-002',
    installmentNumber: 6,
    dueDate: '2024-09-01',
    principalAmount: 200000,
    interestAmount: 20000,
    totalAmount: 220000,
    paidAmount: 0,
    status: 'overdue' as const,
    penaltyAmount: 22000,
    penaltyMonths: 4,
  },
  {
    id: 'inst-a07',
    loanId: 'loan-002',
    installmentNumber: 7,
    dueDate: '2024-10-01',
    principalAmount: 200000,
    interestAmount: 16000,
    totalAmount: 216000,
    paidAmount: 0,
    status: 'overdue' as const,
    penaltyAmount: 16200,
    penaltyMonths: 3,
  },
];

export const mockSHURecords: SHURecord[] = [
  {
    id: 'shu-001',
    userId: '1',
    year: 2023,
    amount: 150000,
    distributedAt: '2023-12-28',
    notes: 'SHU Tahun Buku 2023',
  },
];

export const mockCooperativeSummary: CooperativeSummary = {
  totalSimpananPokok: 10000000,
  totalSimpananWajib: 25000000,
  totalSimpananSukarela: 45000000,
  totalAssets: 120000000,
  totalCash: 35000000,
  totalReceivables: 28000000,
  totalInterestReceived: 8500000,
  totalPenaltyReceived: 350000,
  totalOutstandingPrincipal: 2200000,
  totalOutstandingInterest: 524000,
  totalMembers: 50,
  membersWithLoans: 12,
  membersDefaulting: 3,
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const formatShortDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const getTransactionTypeLabel = (type: Transaction['type'] | undefined | null, language: 'id' | 'en' = 'id'): string => {
  if (!type) return language === 'id' ? 'Tidak Diketahui' : 'Unknown';
  
  const labels: Record<Transaction['type'], { id: string; en: string }> = {
    simpanan_pokok: { id: 'Simpanan Pokok', en: 'Principal Savings' },
    simpanan_wajib: { id: 'Simpanan Wajib', en: 'Mandatory Savings' },
    simpanan_sukarela: { id: 'Simpanan Sukarela', en: 'Voluntary Savings' },
    setor_simpanan_wajib: { id: 'Setor Simpanan Wajib', en: 'Mandatory Savings Deposit' },
    setor_simpanan_sukarela: { id: 'Setor Simpanan Sukarela', en: 'Voluntary Savings Deposit' },
    penarikan_simpanan_sukarela: { id: 'Penarikan Simpanan Sukarela', en: 'Voluntary Savings Withdrawal' },
    bayar_angsuran_pinjaman: { id: 'Bayar Angsuran Pinjaman', en: 'Loan Installment Payment' },
    pencairan_pinjaman: { id: 'Pencairan Pinjaman', en: 'Loan Disbursement' },
    saldo_awal_pokok: { id: 'Saldo Awal Simpanan Pokok', en: 'Initial Principal Savings Balance' },
    saldo_awal_wajib: { id: 'Saldo Awal Simpanan Wajib', en: 'Initial Mandatory Savings Balance' },
    saldo_awal_sukarela: { id: 'Saldo Awal Simpanan Sukarela', en: 'Initial Voluntary Savings Balance' },
    saldo_awal_pinjaman: { id: 'Saldo Awal Pinjaman', en: 'Initial Loan Balance' },
  };
  return labels[type]?.[language] ?? (language === 'id' ? 'Tidak Diketahui' : 'Unknown');
};

export const getStatusLabel = (status: Transaction['status'] | undefined | null, language: 'id' | 'en' = 'id'): string => {
  if (!status) return language === 'id' ? 'Tidak Diketahui' : 'Unknown';
  
  const labels: Record<Transaction['status'], { id: string; en: string }> = {
    pending: { id: 'Menunggu Verifikasi', en: 'Pending Verification' },
    approved: { id: 'Disetujui', en: 'Approved' },
    rejected: { id: 'Ditolak', en: 'Rejected' },
  };
  return labels[status]?.[language] ?? (language === 'id' ? 'Tidak Diketahui' : 'Unknown');
};
