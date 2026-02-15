import { formatCurrency, formatDate } from './mockData';

// Template variable definitions
export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  sample: string;
}

export interface TemplateVariableCategory {
  id: string;
  label: string;
  icon: string;
  variables: TemplateVariable[];
  applicableTo: string[]; // letter_type values
}

export const TEMPLATE_VARIABLES: TemplateVariableCategory[] = [
  {
    id: 'common',
    label: 'Umum',
    icon: '📋',
    applicableTo: ['loan_approval', 'withdrawal', 'resignation', 'refund', 'loan_settlement'],
    variables: [
      { key: '{sapaan}', label: 'Sapaan', description: 'Bapak/Ibu sesuai gender', sample: 'Bapak' },
      { key: '{nama_anggota}', label: 'Nama Anggota', description: 'Nama lengkap anggota', sample: 'Budi Santoso' },
      { key: '{nomor_anggota}', label: 'Nomor Anggota', description: 'Nomor keanggotaan', sample: '2024-001' },
      { key: '{tanggal_hari_ini}', label: 'Tanggal Hari Ini', description: 'Tanggal saat ini', sample: '8 Januari 2026' },
      { key: '{nama_koperasi}', label: 'Nama Koperasi', description: 'Nama koperasi', sample: 'Koperasi Sejahtera' },
      { key: '{alamat_koperasi}', label: 'Alamat Koperasi', description: 'Alamat koperasi', sample: 'Jl. Merdeka No. 123' },
      { key: '{tanggal_bergabung}', label: 'Tanggal Bergabung', description: 'Tanggal anggota bergabung', sample: '1 Januari 2024' },
    ],
  },
  {
    id: 'loan',
    label: 'Pinjaman',
    icon: '💰',
    applicableTo: ['loan_approval', 'loan_settlement'],
    variables: [
      { key: '{jumlah_pinjaman}', label: 'Jumlah Pinjaman', description: 'Jumlah pinjaman (Rupiah)', sample: 'Rp 5.000.000' },
      { key: '{tenor}', label: 'Jangka Waktu', description: 'Jangka waktu pinjaman (bulan)', sample: '12 Bulan' },
      { key: '{bunga_persen}', label: 'Suku Bunga', description: 'Suku bunga per bulan (%)', sample: '1,5%' },
      { key: '{angsuran_pokok}', label: 'Angsuran Pokok', description: 'Angsuran pokok per bulan', sample: 'Rp 416.667' },
      { key: '{angsuran_bunga}', label: 'Angsuran Bunga', description: 'Angsuran bunga per bulan', sample: 'Rp 75.000' },
      { key: '{angsuran_bulanan}', label: 'Total Angsuran', description: 'Total angsuran per bulan', sample: 'Rp 491.667' },
      { key: '{tanggal_pencairan}', label: 'Tanggal Pencairan', description: 'Tanggal pencairan pinjaman', sample: '10 Januari 2026' },
      { key: '{tanggal_jatuh_tempo}', label: 'Tanggal Jatuh Tempo', description: 'Tanggal jatuh tempo terakhir', sample: '10 Januari 2027' },
      { key: '{sisa_pinjaman}', label: 'Sisa Pinjaman', description: 'Sisa pokok pinjaman', sample: 'Rp 2.500.000' },
    ],
  },
  {
    id: 'savings',
    label: 'Simpanan',
    icon: '🏦',
    applicableTo: ['withdrawal', 'resignation', 'refund'],
    variables: [
      { key: '{total_simpanan}', label: 'Total Simpanan', description: 'Total seluruh simpanan', sample: 'Rp 10.000.000' },
      { key: '{simpanan_pokok}', label: 'Simpanan Pokok', description: 'Simpanan pokok', sample: 'Rp 1.000.000' },
      { key: '{simpanan_wajib}', label: 'Simpanan Wajib', description: 'Simpanan wajib', sample: 'Rp 6.000.000' },
      { key: '{simpanan_sukarela}', label: 'Simpanan Sukarela', description: 'Simpanan sukarela', sample: 'Rp 3.000.000' },
      { key: '{jumlah_penarikan}', label: 'Jumlah Penarikan', description: 'Jumlah yang ditarik', sample: 'Rp 1.000.000' },
      { key: '{sisa_simpanan}', label: 'Sisa Simpanan', description: 'Sisa simpanan setelah transaksi', sample: 'Rp 9.000.000' },
    ],
  },
  {
    id: 'resignation',
    label: 'Pengunduran Diri',
    icon: '📝',
    applicableTo: ['resignation', 'refund'],
    variables: [
      { key: '{tanggal_pengunduran}', label: 'Tanggal Pengunduran', description: 'Tanggal pengunduran diri', sample: '15 Desember 2025' },
      { key: '{alasan_pengunduran}', label: 'Alasan Pengunduran', description: 'Alasan pengunduran diri', sample: 'Pindah domisili' },
      { key: '{total_pengembalian}', label: 'Total Pengembalian', description: 'Total dana yang dikembalikan', sample: 'Rp 9.500.000' },
      { key: '{potongan_pinjaman}', label: 'Potongan Pinjaman', description: 'Potongan untuk pinjaman aktif', sample: 'Rp 500.000' },
    ],
  },
];

// Get variables applicable to a specific letter type
export function getVariablesForLetterType(letterType: string): TemplateVariableCategory[] {
  return TEMPLATE_VARIABLES.filter(category => 
    category.applicableTo.includes(letterType)
  );
}

// Get all variable keys as a flat list for a letter type
export function getAllVariableKeys(letterType: string): string[] {
  return getVariablesForLetterType(letterType)
    .flatMap(category => category.variables.map(v => v.key));
}

// Sample data for preview
export interface TemplateData {
  member?: {
    name?: string;
    memberNumber?: string;
    joinDate?: string;
    gender?: 'male' | 'female' | string;
  };
  loan?: {
    amount?: number;
    tenor?: number;
    interestRate?: number;
    disbursementDate?: string;
    remainingPrincipal?: number;
  };
  savings?: {
    principal?: number;
    mandatory?: number;
    voluntary?: number;
    total?: number;
    withdrawalAmount?: number;
    remainingBalance?: number;
  };
  resignation?: {
    date?: string;
    reason?: string;
    totalRefund?: number;
    loanDeduction?: number;
  };
  cooperative?: {
    name?: string;
    address?: string;
  };
}

// Sample data for preview
export const SAMPLE_DATA: TemplateData = {
  member: {
    name: 'Budi Santoso',
    memberNumber: '2024-001',
    joinDate: '2024-01-01',
    gender: 'male',
  },
  loan: {
    amount: 5000000,
    tenor: 12,
    interestRate: 0.015,
    disbursementDate: '2026-01-10',
    remainingPrincipal: 2500000,
  },
  savings: {
    principal: 1000000,
    mandatory: 6000000,
    voluntary: 3000000,
    total: 10000000,
    withdrawalAmount: 1000000,
    remainingBalance: 9000000,
  },
  resignation: {
    date: '2025-12-15',
    reason: 'Pindah domisili',
    totalRefund: 9500000,
    loanDeduction: 500000,
  },
  cooperative: {
    name: 'Koperasi Sejahtera',
    address: 'Jl. Merdeka No. 123, Jakarta',
  },
};

// Parse template text and replace variables with actual data
export function parseTemplateVariables(
  template: string,
  data: TemplateData,
  useSampleData: boolean = false
): string {
  if (!template) return '';

  const actualData = useSampleData ? SAMPLE_DATA : data;
  let result = template;

  // Helper to get greeting based on gender
  const getGreeting = (gender?: string): string => {
    if (gender === 'female' || gender === 'perempuan' || gender === 'wanita') return 'Ibu';
    if (gender === 'male' || gender === 'laki-laki' || gender === 'pria') return 'Bapak';
    return 'Bapak/Ibu'; // Default if gender unknown
  };

  // Common variables
  result = result.replace(/{sapaan}/g, getGreeting(actualData.member?.gender));
  result = result.replace(/{nama_anggota}/g, actualData.member?.name || '-');
  result = result.replace(/{nomor_anggota}/g, actualData.member?.memberNumber || '-');
  result = result.replace(/{tanggal_hari_ini}/g, formatDate(new Date().toISOString()));
  result = result.replace(/{nama_koperasi}/g, actualData.cooperative?.name || '-');
  result = result.replace(/{alamat_koperasi}/g, actualData.cooperative?.address || '-');
  result = result.replace(/{tanggal_bergabung}/g, actualData.member?.joinDate ? formatDate(actualData.member.joinDate) : '-');

  // Loan variables
  if (actualData.loan) {
    const loan = actualData.loan;
    const monthlyPrincipal = loan.amount && loan.tenor ? loan.amount / loan.tenor : 0;
    const monthlyInterest = loan.amount && loan.interestRate ? loan.amount * loan.interestRate : 0;
    
    result = result.replace(/{jumlah_pinjaman}/g, loan.amount ? formatCurrency(loan.amount) : '-');
    result = result.replace(/{tenor}/g, loan.tenor ? `${loan.tenor} Bulan` : '-');
    result = result.replace(/{bunga_persen}/g, loan.interestRate ? `${(loan.interestRate * 100).toFixed(1)}%` : '-');
    result = result.replace(/{angsuran_pokok}/g, monthlyPrincipal ? formatCurrency(monthlyPrincipal) : '-');
    result = result.replace(/{angsuran_bunga}/g, monthlyInterest ? formatCurrency(monthlyInterest) : '-');
    result = result.replace(/{angsuran_bulanan}/g, formatCurrency(monthlyPrincipal + monthlyInterest));
    result = result.replace(/{tanggal_pencairan}/g, loan.disbursementDate ? formatDate(loan.disbursementDate) : '-');
    result = result.replace(/{sisa_pinjaman}/g, loan.remainingPrincipal !== undefined ? formatCurrency(loan.remainingPrincipal) : '-');
    
    // Calculate maturity date
    if (loan.disbursementDate && loan.tenor) {
      const disbursement = new Date(loan.disbursementDate);
      disbursement.setMonth(disbursement.getMonth() + loan.tenor);
      result = result.replace(/{tanggal_jatuh_tempo}/g, formatDate(disbursement.toISOString()));
    } else {
      result = result.replace(/{tanggal_jatuh_tempo}/g, '-');
    }
  }

  // Savings variables
  if (actualData.savings) {
    const savings = actualData.savings;
    result = result.replace(/{total_simpanan}/g, savings.total ? formatCurrency(savings.total) : '-');
    result = result.replace(/{simpanan_pokok}/g, savings.principal ? formatCurrency(savings.principal) : '-');
    result = result.replace(/{simpanan_wajib}/g, savings.mandatory ? formatCurrency(savings.mandatory) : '-');
    result = result.replace(/{simpanan_sukarela}/g, savings.voluntary ? formatCurrency(savings.voluntary) : '-');
    result = result.replace(/{jumlah_penarikan}/g, savings.withdrawalAmount ? formatCurrency(savings.withdrawalAmount) : '-');
    result = result.replace(/{sisa_simpanan}/g, savings.remainingBalance !== undefined ? formatCurrency(savings.remainingBalance) : '-');
  }

  // Resignation variables
  if (actualData.resignation) {
    const resignation = actualData.resignation;
    result = result.replace(/{tanggal_pengunduran}/g, resignation.date ? formatDate(resignation.date) : '-');
    result = result.replace(/{alasan_pengunduran}/g, resignation.reason || '-');
    result = result.replace(/{total_pengembalian}/g, resignation.totalRefund ? formatCurrency(resignation.totalRefund) : '-');
    result = result.replace(/{potongan_pinjaman}/g, resignation.loanDeduction ? formatCurrency(resignation.loanDeduction) : '-');
  }

  return result;
}

// Highlight variables in text for display
export function highlightVariables(text: string): string {
  if (!text) return '';
  
  // Match all {variable_name} patterns
  return text.replace(/\{[a-z_]+\}/g, (match) => {
    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">${match}</span>`;
  });
}
