// AD/ART Document Structure
export interface AdArtArticle {
  id: string;
  title: string;
  content: string;
}

export interface AdArtChapter {
  id: string;
  title: string;
  articles: AdArtArticle[];
}

export interface AdArtDocument {
  chapters: AdArtChapter[];
}

// Signatory configuration for official documents
export interface Signatory {
  id: string;
  name: string;
  position: string; // Ketua, Wakil Ketua, Sekretaris, Bendahara, etc.
  signatureBase64?: string;
  isActive: boolean;
}

export const POSITION_OPTIONS = [
  'Ketua',
  'Wakil Ketua',
  'Sekretaris',
  'Bendahara',
  'Pengawas',
  'Pengurus',
  'Penasihat',
] as const;

// Positions that can sign official letters (used for letter selector)
export const SIGNATORY_POSITION_OPTIONS = [
  'Ketua',
  'Wakil Ketua',
  'Sekretaris',
  'Bendahara',
] as const;

export interface MemberNumberFormat {
  prefix: string; // e.g., "MBR", "ANG", or custom
  dateFormat: 'YYYYMMDD' | 'YYYYMM' | 'YYYY' | 'none'; // Date format in number
  separator: string; // e.g., "-", "/", ""
  sequenceLength: number; // Padding for sequence number (4 = 0001)
  useSequential: boolean; // Use sequential counter instead of random
  autoResetYearly: boolean; // Auto reset sequence at new fiscal year
  lastResetYear?: number; // Year when sequence was last reset
  currentSequence?: number; // Current sequence number
}

export interface CooperativeSettings {
  // Identity
  name: string;
  legalNumber: string;
  address: string;
  foundedDate: string;
  copyrightYear: number; // Year for copyright display
  logoUrl?: string;
  logoBase64?: string; // For uploaded logo
  bannerBase64?: string; // For header banner image
  
  // Signature & Stamp for official documents
  signatureBase64?: string; // Chairman signature image (legacy - kept for backward compatibility)
  stampBase64?: string; // Official stamp image
  chairmanName?: string; // Name of the chairman for signature (legacy)
  signatories?: Signatory[]; // Multiple signatories configuration
  customOfficerPositions?: string[]; // Custom officer positions beyond defaults
  
  // Member Number Format
  memberNumberFormat: MemberNumberFormat;
  
  // Vision & Mission
  vision: string;
  mission: string[];
  
  // Services
  services: {
    title: string;
    description: string;
  }[];
  
  // Loan Interest
  interestRate: number; // percentage per month
  interestCalculationMethod: 'flat' | 'effective'; // flat = from initial principal, effective = from remaining principal
  tenorMin: number; // months
  tenorMax: number; // months
  minLoanAmount: number; // minimum loan amount
  maxLoanAmount: number; // maximum loan amount
  maxLoanMultiplier: number; // multiplier of total savings
  latePaymentPenalty: number; // percentage
  latePaymentPenaltyType: 'daily' | 'monthly'; // penalty calculation type
  latePaymentPenaltyBase: 'remaining_installment' | 'remaining_principal'; // penalty base
  penaltyGracePeriodDays: number; // days after due date before penalty is applied (0 = immediate)
  installmentDueDaysAfterDisbursement: number; // days after disbursement for each installment due date (30 = monthly)
  
  // Early Payoff Settings
  earlyPayoffEnabled: boolean; // whether early payoff is allowed
  earlyPayoffRequiresApproval: boolean; // whether early payoff requires admin approval
  earlyPayoffFeeType: 'none' | 'fixed' | 'percentage'; // type of early payoff fee
  earlyPayoffFeeAmount: number; // fixed amount or percentage for early payoff fee
  
  // Loan Requirements
  requireSimpananPokokForLoan: boolean; // whether member must have paid simpanan pokok before applying for loan
  requireMinSimpananWajibForLoan: boolean; // whether member must have minimum simpanan wajib before applying for loan
  minSimpananWajibForLoan: number; // minimum simpanan wajib amount required for loan application
  
  // Savings Rules
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarelaMin: number;
  simpananWajibDueDate: number; // day of month
  withdrawalProcessDays: string;
  
  // Voluntary Savings Interest
  simpananSukarelaInterestRate: number; // percentage per month (0.4%)
  simpananSukarelaInterestCutoffDate: number; // day of month for cutoff (15)
  simpananSukarelaInterestMethod: 'opening_plus_eligible' | 'closing_if_eligible'; // calculation method
  simpananSukarelaClosingDate: number; // day of month for closing (31)
  
  // Voluntary Savings Withdrawal Holding Period
  simpananSukarelaMinHoldingMonths: number; // minimum months before withdrawal is allowed (0 = no restriction)
  
  // AD/ART - Structured format with chapters and articles
  adArtContent: string[]; // Legacy format - kept for backward compatibility
  adContent?: AdArtDocument; // Anggaran Dasar
  artContent?: AdArtDocument; // Anggaran Rumah Tangga
  
  // SHU Distribution Percentages
  shuDistribution: {
    shuAnggota: number; // 60%
    shuAnggotaSimpanan: number; // 70% of shuAnggota
    shuAnggotaJasaUsaha: number; // 30% of shuAnggota (renamed from JasaPinjaman)
    shuPengurus: number; // 15%
    shuPengawas: number; // 5%
    shuPenasihat: number; // 5%
    danaCadangan: number; // 10%
    danaPendidikan: number; // 2.5%
    danaSosial: number; // 2.5%
    danaPembangunan: number; // 0% (optional)
  };
}

// Role assignment for SHU distribution
export interface RoleAssignment {
  id: string;
  name: string;
  role: 'pengurus' | 'pengawas' | 'penasihat';
  isMember: boolean;
  memberId?: string; // If isMember is true
  sharePercentage: number; // Percentage within their role group
}

// Accounting types
export interface IncomeEntry {
  id: string;
  description: string;
  amount: number;
  type: 'manual' | 'bunga_pinjaman' | 'denda_pinjaman' | 'bunga_simpanan_sukarela';
  date: string;
  year: number;
}

export interface ExpenseEntry {
  id: string;
  description: string;
  amount: number;
  type: 'manual' | 'biaya_bunga_simpanan';
  date: string;
  year: number;
}

export interface BalanceSheet {
  year: number;
  
  // ASET LANCAR (Current Assets)
  kasBank: number; // Kas di Bank (calculated: totalHarta - piutangUsaha + pendapatan)
  piutangUsaha: number; // Pinjaman anggota yang belum dibayar (sisa pokok pinjaman)
  totalAsetLancar: number;
  
  // Pendapatan Koperasi (untuk perhitungan Kas)
  pendapatanBungaPinjaman: number; // Bunga pinjaman diterima
  pendapatanDenda: number; // Denda diterima
  
  // HARTA KOPERASI (Cooperative Capital/Equity)
  // Simpanan Pokok
  simpananPokok: number;
  saldoAwalSimpananPokok: number;
  penambahanSimpananPokok: number;
  penguranganSimpananPokok: number;
  
  // Simpanan Wajib
  simpananWajib: number;
  saldoAwalSimpananWajib: number;
  penambahanSimpananWajib: number;
  penguranganSimpananWajib: number;
  
  // Simpanan Sukarela
  simpananSukarela: number;
  saldoAwalSimpananSukarela: number;
  penambahanSimpananSukarela: number;
  penguranganSimpananSukarela: number;
  
  // Dana Cadangan
  danaCadangan: number;
  saldoAwalDanaCadangan: number;
  penambahanDanaCadangan: number;
  penguranganDanaCadangan: number;
  
  // Hibah (Manual Input)
  hibahDonasi: number;
  saldoAwalHibahDonasi: number;
  penambahanHibahDonasi: number;
  penguranganHibahDonasi: number;
  
  // Pinjaman Diterima (Manual Input) - dari Anggota, Koperasi Lain, Lembaga Keuangan
  pinjamanDiterima: number;
  saldoAwalPinjamanDiterima: number;
  penambahanPinjamanDiterima: number;
  penguranganPinjamanDiterima: number;
  
  // Modal Penyertaan (Manual Input)
  modalPenyertaan: number;
  saldoAwalModalPenyertaan: number;
  penambahanModalPenyertaan: number;
  penguranganModalPenyertaan: number;
  
  // Totals
  totalHartaKoperasi: number;
  totalSaldoAwal: number;
  totalPenambahan: number;
  totalPengurangan: number;
}

export interface ProfitLoss {
  year: number;
  // Income
  pendapatanManual: number;
  pendapatanBungaPinjaman: number;
  pendapatanDendaPinjaman: number;
  totalPendapatan: number;
  // Expenses
  biayaManual: number;
  biayaBungaSimpanan: number;
  biayaPenyusutan?: number; // Depreciation expense (optional for backward compatibility)
  totalBiaya: number;
  // Result
  shuBruto: number;
}

export interface MemberSHUDistribution {
  memberId: string;
  memberName: string;
  simpananShare: number;
  jasaUsahaShare: number;
  totalShare: number;
  // Arrears and exclusion status
  hasArrears: boolean;
  arrearsAmount: number;
  isExcluded: boolean;
  exclusionReason?: 'arrears' | 'manual';
  exclusionNote?: string;
  isWithheld: boolean;
  // Exited member info
  isExitedMember?: boolean;
  activeMonths?: number;
  proportionFactor?: number;
}

export interface SHUDistributionResult {
  year: number;
  shuBruto: number;
  // Distribution amounts
  shuAnggotaTotal: number;
  shuAnggotaSimpanan: number;
  shuAnggotaJasaUsaha: number;
  shuPengurus: number;
  shuPengawas: number;
  shuPenasihat: number;
  danaCadangan: number;
  danaPendidikan: number;
  danaSosial: number;
  danaPembangunan: number;
  // Individual distributions
  memberDistributions: MemberSHUDistribution[];
  roleDistributions: {
    assignmentId: string;
    name: string;
    role: 'pengurus' | 'pengawas' | 'penasihat';
    isMember: boolean;
    amount: number;
  }[];
  status: 'draft' | 'confirmed';
  confirmedAt?: string;
  // Summary for withheld SHU
  totalWithheldSHU: number;
  withheldMembersCount: number;
}

export const defaultCooperativeSettings: CooperativeSettings = {
  name: 'Koperasi Sejahtera Bersama',
  legalNumber: 'No. 123/BH/XII/2020',
  address: 'Jl. Merdeka No. 123, Jakarta Selatan',
  foundedDate: '15 Januari 2020',
  copyrightYear: new Date().getFullYear(),
  logoUrl: '',
  logoBase64: '',
  bannerBase64: '',
  signatureBase64: '',
  stampBase64: '',
  chairmanName: '',
  signatories: [
    { id: '1', name: '', position: 'Ketua', signatureBase64: '', isActive: true },
  ],
  customOfficerPositions: [],
  
  memberNumberFormat: {
    prefix: 'MBR',
    dateFormat: 'YYYYMMDD',
    separator: '-',
    sequenceLength: 4,
    useSequential: true,
    autoResetYearly: false,
    lastResetYear: new Date().getFullYear(),
    currentSequence: 0,
  },
  
  vision: 'Menjadi koperasi terpercaya yang mendorong kesejahteraan anggota melalui layanan keuangan yang adil dan transparan.',
  mission: [
    'Memberikan layanan simpan pinjam yang mudah dan terjangkau',
    'Meningkatkan literasi keuangan anggota',
    'Mengelola dana anggota dengan transparan dan akuntabel',
    'Membagikan SHU secara adil kepada seluruh anggota',
  ],
  
  services: [
    { title: 'Simpanan Pokok', description: 'Setoran awal saat mendaftar' },
    { title: 'Simpanan Wajib', description: 'Setoran bulanan wajib' },
    { title: 'Simpanan Sukarela', description: 'Tabungan fleksibel, bisa ditarik kapan saja' },
    { title: 'Pinjaman', description: 'Pinjaman dengan bunga kompetitif' },
  ],
  
  interestRate: 1.5,
  interestCalculationMethod: 'flat',
  tenorMin: 3,
  tenorMax: 24,
  minLoanAmount: 500000,
  maxLoanAmount: 30000000,
  maxLoanMultiplier: 3,
  latePaymentPenalty: 0.5,
  latePaymentPenaltyType: 'daily',
  latePaymentPenaltyBase: 'remaining_installment',
  penaltyGracePeriodDays: 0,
  installmentDueDaysAfterDisbursement: 30,
  
  // Early Payoff Settings
  earlyPayoffEnabled: true,
  earlyPayoffRequiresApproval: true,
  earlyPayoffFeeType: 'none',
  earlyPayoffFeeAmount: 0,
  
  // Loan Requirements
  requireSimpananPokokForLoan: true,
  requireMinSimpananWajibForLoan: false,
  minSimpananWajibForLoan: 100000,
  
  simpananPokok: 500000,
  simpananWajib: 100000,
  simpananSukarelaMin: 50000,
  simpananWajibDueDate: 10,
  withdrawalProcessDays: '1-3 hari kerja',
  
  simpananSukarelaInterestRate: 0.4,
  simpananSukarelaInterestCutoffDate: 15,
  simpananSukarelaInterestMethod: 'opening_plus_eligible',
  simpananSukarelaClosingDate: 31,
  simpananSukarelaMinHoldingMonths: 0, // 0 = no restriction
  
  adArtContent: [], // Legacy - kept for backward compatibility
  adContent: {
    chapters: [
      {
        id: 'ad-1',
        title: 'Nama dan Tempat Kedudukan',
        articles: [
          { id: 'ad-1-1', title: 'Pasal 1', content: 'Koperasi ini bernama sesuai dengan nama yang terdaftar secara resmi.' },
          { id: 'ad-1-2', title: 'Pasal 2', content: 'Koperasi berkedudukan di wilayah yang tercantum dalam akta pendirian.' },
        ]
      },
      {
        id: 'ad-2',
        title: 'Keanggotaan',
        articles: [
          { id: 'ad-2-1', title: 'Pasal 3', content: 'Anggota koperasi adalah Warga Negara Indonesia yang memenuhi syarat keanggotaan.' },
          { id: 'ad-2-2', title: 'Pasal 4', content: 'Anggota wajib membayar simpanan pokok dan simpanan wajib sesuai ketentuan.' },
        ]
      },
    ]
  },
  artContent: {
    chapters: [
      {
        id: 'art-1',
        title: 'Hak dan Kewajiban Anggota',
        articles: [
          { id: 'art-1-1', title: 'Pasal 1', content: 'Anggota berhak mendapatkan SHU sesuai dengan partisipasi dalam kegiatan koperasi.' },
          { id: 'art-1-2', title: 'Pasal 2', content: 'Anggota yang menunggak lebih dari 3 bulan akan dikenakan sanksi sesuai peraturan.' },
        ]
      },
      {
        id: 'art-2',
        title: 'Pengunduran Diri',
        articles: [
          { id: 'art-2-1', title: 'Pasal 3', content: 'Pengunduran diri anggota harus diajukan secara tertulis dan disetujui pengurus.' },
          { id: 'art-2-2', title: 'Pasal 4', content: 'Simpanan pokok akan dikembalikan setelah status keanggotaan berakhir dikurangi kewajiban yang belum diselesaikan.' },
        ]
      },
    ]
  },
  
  shuDistribution: {
    shuAnggota: 60,
    shuAnggotaSimpanan: 70,
    shuAnggotaJasaUsaha: 30,
    shuPengurus: 15,
    shuPengawas: 5,
    shuPenasihat: 5,
    danaCadangan: 10,
    danaPendidikan: 2.5,
    danaSosial: 2.5,
    danaPembangunan: 0,
  },
};

// Cooperative settings are still stored in localStorage (non-sensitive config data)
// The sensitive financial data (income, expense, balance sheets, SHU distributions, role assignments)
// are now stored in the database - see src/hooks/useFinancialData.ts
export const getCooperativeSettings = (): CooperativeSettings => {
  const stored = localStorage.getItem('cooperativeSettings');
  if (stored) {
    const parsed = JSON.parse(stored);
    // Ensure shuDistribution exists (migration for existing data)
    if (!parsed.shuDistribution) {
      parsed.shuDistribution = defaultCooperativeSettings.shuDistribution;
    }
    // Ensure copyrightYear exists (migration for existing data)
    if (!parsed.copyrightYear) {
      parsed.copyrightYear = new Date().getFullYear();
    }
    // Ensure memberNumberFormat exists (migration for existing data)
    if (!parsed.memberNumberFormat) {
      parsed.memberNumberFormat = defaultCooperativeSettings.memberNumberFormat;
    }
    // Ensure adContent and artContent exist (migration for new structured format)
    if (!parsed.adContent) {
      parsed.adContent = defaultCooperativeSettings.adContent;
    }
    if (!parsed.artContent) {
      parsed.artContent = defaultCooperativeSettings.artContent;
    }
    // Ensure adArtContent array exists for legacy support
    if (!parsed.adArtContent) {
      parsed.adArtContent = [];
    }
    return parsed;
  }
  return defaultCooperativeSettings;
};

// Helper function to get default member number format
export const getDefaultMemberNumberFormat = (): MemberNumberFormat => ({
  prefix: 'MBR',
  dateFormat: 'YYYYMMDD',
  separator: '-',
  sequenceLength: 4,
  useSequential: true,
  autoResetYearly: false,
  lastResetYear: new Date().getFullYear(),
  currentSequence: 0,
});

// Generate member number based on format settings
export const generateMemberNumber = (sequenceNumber: number): string => {
  const settings = getCooperativeSettings();
  const format = settings.memberNumberFormat;
  
  const now = new Date();
  let datePart = '';
  
  switch (format.dateFormat) {
    case 'YYYYMMDD':
      datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      break;
    case 'YYYYMM':
      datePart = now.toISOString().slice(0, 7).replace(/-/g, '');
      break;
    case 'YYYY':
      datePart = now.getFullYear().toString();
      break;
    case 'none':
      datePart = '';
      break;
  }
  
  const seqPart = sequenceNumber.toString().padStart(format.sequenceLength, '0');
  
  // Handle "none" separator - use empty string
  const actualSeparator = format.separator === 'none' ? '' : format.separator;
  
  const parts = [format.prefix];
  if (datePart) parts.push(datePart);
  parts.push(seqPart);
  
  return parts.join(actualSeparator);
};

export const saveCooperativeSettings = (settings: CooperativeSettings): void => {
  localStorage.setItem('cooperativeSettings', JSON.stringify(settings));
};

// DEPRECATED: These functions are now handled by database hooks in src/hooks/useFinancialData.ts
// Keeping for backward compatibility but they now just return empty arrays
// Use the hooks instead: useRoleAssignments, useIncomeEntries, useExpenseEntries, useBalanceSheets, useSHUDistributions

export const getRoleAssignments = (): RoleAssignment[] => {
  console.warn('getRoleAssignments is deprecated. Use useRoleAssignments hook instead.');
  return [];
};

export const saveRoleAssignments = (assignments: RoleAssignment[]): void => {
  console.warn('saveRoleAssignments is deprecated. Use useRoleAssignments hook instead.');
};

export const getIncomeEntries = (): IncomeEntry[] => {
  console.warn('getIncomeEntries is deprecated. Use useIncomeEntries hook instead.');
  return [];
};

export const saveIncomeEntries = (entries: IncomeEntry[]): void => {
  console.warn('saveIncomeEntries is deprecated. Use useIncomeEntries hook instead.');
};

export const getExpenseEntries = (): ExpenseEntry[] => {
  console.warn('getExpenseEntries is deprecated. Use useExpenseEntries hook instead.');
  return [];
};

export const saveExpenseEntries = (entries: ExpenseEntry[]): void => {
  console.warn('saveExpenseEntries is deprecated. Use useExpenseEntries hook instead.');
};

export const getBalanceSheets = (): BalanceSheet[] => {
  console.warn('getBalanceSheets is deprecated. Use useBalanceSheets hook instead.');
  return [];
};

export const saveBalanceSheets = (sheets: BalanceSheet[]): void => {
  console.warn('saveBalanceSheets is deprecated. Use useBalanceSheets hook instead.');
};

export const getSHUDistributions = (): SHUDistributionResult[] => {
  console.warn('getSHUDistributions is deprecated. Use useSHUDistributions hook instead.');
  return [];
};

export const saveSHUDistributions = (distributions: SHUDistributionResult[]): void => {
  console.warn('saveSHUDistributions is deprecated. Use useSHUDistributions hook instead.');
};
