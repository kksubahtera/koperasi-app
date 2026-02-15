/**
 * Sistem Terminologi Akuntansi Terpadu
 * 
 * File ini berisi mapping istilah akuntansi yang setara untuk:
 * 1. Konsistensi terminologi di seluruh aplikasi
 * 2. Validasi duplikasi akun berdasarkan sinonim
 * 3. Tooltip/info yang menampilkan istilah alternatif
 */

// ============================================
// TIPE DATA
// ============================================

export type AccountTypeCode = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface TerminologyEntry {
  /** Istilah standar yang digunakan di aplikasi */
  standard: string;
  /** Semua istilah yang setara (termasuk standar) */
  synonyms: string[];
  /** Deskripsi singkat */
  description: string;
  /** Kode tipe akun jika berlaku */
  accountType?: AccountTypeCode;
}

export interface AccountTypeTerminology {
  code: AccountTypeCode;
  standard: string;
  synonyms: string[];
  description: string;
  color: string;
  bgColor: string;
}

// ============================================
// MAPPING TIPE AKUN UTAMA
// ============================================

export const ACCOUNT_TYPE_TERMINOLOGY: Record<AccountTypeCode, AccountTypeTerminology> = {
  asset: {
    code: 'asset',
    standard: 'Aset',
    synonyms: ['Aset', 'Aktiva', 'Harta', 'Asset', 'Assets'],
    description: 'Sumber daya yang dimiliki dan memberikan manfaat ekonomi di masa depan',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  liability: {
    code: 'liability',
    standard: 'Kewajiban',
    synonyms: ['Kewajiban', 'Liabilitas', 'Utang', 'Hutang', 'Liability', 'Liabilities'],
    description: 'Kewajiban yang harus dibayar kepada pihak lain',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  equity: {
    code: 'equity',
    standard: 'Modal',
    synonyms: ['Modal', 'Ekuitas', 'Equity', 'Capital', 'Kekayaan Bersih'],
    description: 'Hak residual atas aset setelah dikurangi kewajiban (Aset - Kewajiban)',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  income: {
    code: 'income',
    standard: 'Pendapatan',
    synonyms: ['Pendapatan', 'Penghasilan', 'Revenue', 'Income', 'Pemasukan'],
    description: 'Kenaikan manfaat ekonomi selama periode akuntansi',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
  },
  expense: {
    code: 'expense',
    standard: 'Beban',
    synonyms: ['Beban', 'Biaya', 'Expense', 'Cost', 'Pengeluaran'],
    description: 'Penurunan manfaat ekonomi selama periode akuntansi',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
  },
};

// ============================================
// MAPPING ISTILAH NERACA (BALANCE SHEET)
// ============================================

export const BALANCE_SHEET_TERMINOLOGY: Record<string, TerminologyEntry> = {
  // Sisi Aktiva/Aset
  aktiva: {
    standard: 'Aktiva',
    synonyms: ['Aktiva', 'Aset', 'Harta', 'Asset', 'Assets'],
    description: 'Sisi kiri neraca yang menunjukkan kepemilikan sumber daya',
    accountType: 'asset',
  },
  asetLancar: {
    standard: 'Aset Lancar',
    synonyms: ['Aset Lancar', 'Aktiva Lancar', 'Current Assets', 'Harta Lancar'],
    description: 'Aset yang dapat dikonversi menjadi kas dalam satu tahun',
    accountType: 'asset',
  },
  asetTetap: {
    standard: 'Aset Tetap',
    synonyms: ['Aset Tetap', 'Aktiva Tetap', 'Fixed Assets', 'Harta Tetap', 'Property Plant Equipment'],
    description: 'Aset berwujud yang digunakan dalam operasi lebih dari satu tahun',
    accountType: 'asset',
  },
  kas: {
    standard: 'Kas',
    synonyms: ['Kas', 'Cash', 'Uang Tunai', 'Tunai'],
    description: 'Uang tunai yang tersedia',
    accountType: 'asset',
  },
  bank: {
    standard: 'Bank',
    synonyms: ['Bank', 'Simpanan Bank', 'Cash in Bank', 'Rekening Bank'],
    description: 'Dana yang disimpan di bank',
    accountType: 'asset',
  },
  piutang: {
    standard: 'Piutang',
    synonyms: ['Piutang', 'Receivables', 'Accounts Receivable', 'Tagihan'],
    description: 'Hak tagih atas pihak lain',
    accountType: 'asset',
  },
  
  // Sisi Pasiva (Kewajiban + Modal)
  pasiva: {
    standard: 'Pasiva',
    synonyms: ['Pasiva', 'Kewajiban dan Modal', 'Liabilities and Equity', 'Utang dan Modal'],
    description: 'Sisi kanan neraca yang menunjukkan sumber pendanaan (Kewajiban + Modal)',
  },
  kewajiban: {
    standard: 'Kewajiban',
    synonyms: ['Kewajiban', 'Liabilitas', 'Utang', 'Hutang', 'Liabilities'],
    description: 'Kewajiban yang harus dibayar',
    accountType: 'liability',
  },
  kewajibanJangkaPendek: {
    standard: 'Kewajiban Jangka Pendek',
    synonyms: ['Kewajiban Jangka Pendek', 'Utang Lancar', 'Current Liabilities', 'Hutang Jangka Pendek'],
    description: 'Kewajiban yang jatuh tempo dalam satu tahun',
    accountType: 'liability',
  },
  kewajibanJangkaPanjang: {
    standard: 'Kewajiban Jangka Panjang',
    synonyms: ['Kewajiban Jangka Panjang', 'Utang Jangka Panjang', 'Long-term Liabilities', 'Hutang Jangka Panjang'],
    description: 'Kewajiban yang jatuh tempo lebih dari satu tahun',
    accountType: 'liability',
  },
  modal: {
    standard: 'Modal',
    synonyms: ['Modal', 'Ekuitas', 'Equity', 'Capital', 'Kekayaan Bersih', 'Net Worth'],
    description: 'Kekayaan bersih pemilik (Aset - Kewajiban)',
    accountType: 'equity',
  },
  
  // Komponen Modal Koperasi
  simpananPokok: {
    standard: 'Simpanan Pokok',
    synonyms: ['Simpanan Pokok', 'Modal Pokok', 'Initial Deposit', 'Principal Savings'],
    description: 'Simpanan awal anggota saat bergabung koperasi',
    accountType: 'equity',
  },
  simpananWajib: {
    standard: 'Simpanan Wajib',
    synonyms: ['Simpanan Wajib', 'Mandatory Savings', 'Iuran Wajib'],
    description: 'Simpanan rutin yang wajib dibayar anggota',
    accountType: 'equity',
  },
  simpananSukarela: {
    standard: 'Simpanan Sukarela',
    synonyms: ['Simpanan Sukarela', 'Voluntary Savings', 'Tabungan Sukarela'],
    description: 'Simpanan yang besarnya ditentukan sendiri oleh anggota',
    accountType: 'equity',
  },
  danaCadangan: {
    standard: 'Dana Cadangan',
    synonyms: ['Dana Cadangan', 'Cadangan', 'Reserve Fund', 'Retained Earnings', 'Laba Ditahan'],
    description: 'Dana yang disisihkan dari SHU untuk penguatan modal dan menutup kerugian',
    accountType: 'equity',
  },
  danaPendidikan: {
    standard: 'Dana Pendidikan',
    synonyms: ['Dana Pendidikan', 'Education Fund', 'Dana Pelatihan', 'Dana Pengembangan SDM'],
    description: 'Dana untuk kegiatan pendidikan dan pelatihan anggota/pengurus',
    accountType: 'equity',
  },
  danaSosial: {
    standard: 'Dana Sosial',
    synonyms: ['Dana Sosial', 'Social Fund', 'Dana Kesejahteraan', 'Dana Bantuan'],
    description: 'Dana untuk kegiatan sosial dan bantuan kepada anggota/masyarakat',
    accountType: 'equity',
  },
  danaPembangunan: {
    standard: 'Dana Pembangunan',
    synonyms: ['Dana Pembangunan', 'Development Fund', 'Dana Pengembangan Usaha', 'Dana Investasi'],
    description: 'Dana untuk pengembangan dan pembangunan usaha koperasi',
    accountType: 'equity',
  },
  shu: {
    standard: 'SHU',
    synonyms: ['SHU', 'Sisa Hasil Usaha', 'Surplus', 'Net Income', 'Laba Bersih', 'Keuntungan'],
    description: 'Selisih pendapatan dikurangi beban dalam satu periode',
    accountType: 'equity',
  },
  shuAnggota: {
    standard: 'SHU Anggota',
    synonyms: ['SHU Anggota', 'Bagian SHU Anggota', 'Member SHU Share', 'Pembagian SHU'],
    description: 'Bagian SHU yang dibagikan kepada anggota berdasarkan kontribusi',
  },
  shuJasaSimpanan: {
    standard: 'SHU Jasa Simpanan',
    synonyms: ['SHU Jasa Simpanan', 'SHU Simpanan', 'Savings-based SHU', 'SHU Modal'],
    description: 'Bagian SHU berdasarkan proporsi simpanan pokok dan wajib anggota',
  },
  shuJasaUsaha: {
    standard: 'SHU Jasa Usaha',
    synonyms: ['SHU Jasa Usaha', 'SHU Pinjaman', 'Service-based SHU', 'SHU Transaksi'],
    description: 'Bagian SHU berdasarkan kontribusi transaksi/pinjaman anggota',
  },
  shuPengurus: {
    standard: 'SHU Pengurus',
    synonyms: ['SHU Pengurus', 'Bagian Pengurus', 'Management Share', 'Insentif Pengurus'],
    description: 'Bagian SHU untuk pengurus sebagai penghargaan atas pengelolaan koperasi',
  },
  shuPengawas: {
    standard: 'SHU Pengawas',
    synonyms: ['SHU Pengawas', 'Bagian Pengawas', 'Supervisor Share', 'Insentif Pengawas'],
    description: 'Bagian SHU untuk pengawas sebagai penghargaan atas pengawasan koperasi',
  },
  shuPenasihat: {
    standard: 'SHU Penasihat',
    synonyms: ['SHU Penasihat', 'Bagian Penasihat', 'Advisor Share', 'Insentif Penasihat'],
    description: 'Bagian SHU untuk penasihat sebagai penghargaan atas bimbingan koperasi',
  },
};

// ============================================
// MAPPING ISTILAH LAPORAN LABA RUGI
// ============================================

export const INCOME_STATEMENT_TERMINOLOGY: Record<string, TerminologyEntry> = {
  // Laporan Laba Rugi
  labaRugi: {
    standard: 'Laporan Laba Rugi',
    synonyms: ['Laporan Laba Rugi', 'Income Statement', 'Profit & Loss', 'P&L', 'Laporan Penghasilan'],
    description: 'Laporan yang menunjukkan kinerja keuangan selama periode tertentu',
  },
  
  // Pendapatan
  pendapatan: {
    standard: 'Pendapatan',
    synonyms: ['Pendapatan', 'Penghasilan', 'Revenue', 'Income', 'Pemasukan', 'Penerimaan'],
    description: 'Penghasilan dari kegiatan usaha',
    accountType: 'income',
  },
  totalPendapatan: {
    standard: 'Total Pendapatan',
    synonyms: ['Total Pendapatan', 'Total Revenue', 'Gross Revenue', 'Jumlah Pendapatan'],
    description: 'Jumlah seluruh pendapatan dalam periode tertentu',
    accountType: 'income',
  },
  pendapatanBunga: {
    standard: 'Pendapatan Bunga',
    synonyms: ['Pendapatan Bunga', 'Pendapatan Jasa', 'Interest Income', 'Jasa Pinjaman'],
    description: 'Pendapatan dari bunga pinjaman',
    accountType: 'income',
  },
  pendapatanLainnya: {
    standard: 'Pendapatan Lainnya',
    synonyms: ['Pendapatan Lainnya', 'Pendapatan Lain-lain', 'Other Income', 'Miscellaneous Revenue'],
    description: 'Pendapatan selain dari kegiatan usaha utama',
    accountType: 'income',
  },
  
  // Beban
  beban: {
    standard: 'Beban',
    synonyms: ['Beban', 'Biaya', 'Expense', 'Cost', 'Pengeluaran', 'Ongkos', 'Biaya Usaha'],
    description: 'Pengorbanan ekonomi untuk menghasilkan pendapatan',
    accountType: 'expense',
  },
  totalBeban: {
    standard: 'Total Beban',
    synonyms: ['Total Beban', 'Total Biaya', 'Total Expenses', 'Jumlah Biaya'],
    description: 'Jumlah seluruh beban/biaya dalam periode tertentu',
    accountType: 'expense',
  },
  bebanOperasional: {
    standard: 'Beban Operasional',
    synonyms: ['Beban Operasional', 'Biaya Operasional', 'Operating Expenses', 'Biaya Usaha', 'OpEx'],
    description: 'Beban yang terkait langsung dengan operasi usaha',
    accountType: 'expense',
  },
  bebanAdministrasi: {
    standard: 'Beban Administrasi',
    synonyms: ['Beban Administrasi', 'Biaya Administrasi', 'Administrative Expenses', 'Biaya Kantor', 'G&A'],
    description: 'Beban administrasi dan umum',
    accountType: 'expense',
  },
  penyusutan: {
    standard: 'Penyusutan',
    synonyms: ['Penyusutan', 'Depresiasi', 'Depreciation', 'Amortisasi', 'Beban Penyusutan'],
    description: 'Alokasi biaya perolehan aset tetap selama masa manfaat',
    accountType: 'expense',
  },
  
  // SHU
  shuBruto: {
    standard: 'Sisa Hasil Usaha (SHU)',
    synonyms: ['SHU', 'Sisa Hasil Usaha', 'Laba Bersih', 'Net Income', 'Profit', 'Surplus', 'Keuntungan', 'Laba/Rugi'],
    description: 'Selisih antara pendapatan dan beban. Rumus: SHU = Pendapatan - Beban',
  },
};

// ============================================
// FUNGSI HELPER
// ============================================

/**
 * Normalisasi string untuk perbandingan
 */
export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/gi, '')
    .replace(/\s+/g, ' ');
};

/**
 * Cek apakah dua istilah adalah sinonim
 */
export const areSynonyms = (term1: string, term2: string): boolean => {
  const normalized1 = normalizeString(term1);
  const normalized2 = normalizeString(term2);
  
  if (normalized1 === normalized2) return true;
  
  // Check in all terminology entries
  const allTerminologies = [
    ...Object.values(ACCOUNT_TYPE_TERMINOLOGY),
    ...Object.values(BALANCE_SHEET_TERMINOLOGY),
    ...Object.values(INCOME_STATEMENT_TERMINOLOGY),
  ];
  
  for (const entry of allTerminologies) {
    const normalizedSynonyms = entry.synonyms.map(normalizeString);
    if (normalizedSynonyms.includes(normalized1) && normalizedSynonyms.includes(normalized2)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Dapatkan istilah standar dari sinonim
 */
export const getStandardTerm = (term: string): string | null => {
  const normalized = normalizeString(term);
  
  const allTerminologies = [
    ...Object.values(ACCOUNT_TYPE_TERMINOLOGY),
    ...Object.values(BALANCE_SHEET_TERMINOLOGY),
    ...Object.values(INCOME_STATEMENT_TERMINOLOGY),
  ];
  
  for (const entry of allTerminologies) {
    if (entry.synonyms.map(normalizeString).includes(normalized)) {
      return entry.standard;
    }
  }
  
  return null;
};

/**
 * Dapatkan semua sinonim untuk suatu istilah
 */
export const getSynonyms = (term: string): string[] | null => {
  const normalized = normalizeString(term);
  
  const allTerminologies = [
    ...Object.values(ACCOUNT_TYPE_TERMINOLOGY),
    ...Object.values(BALANCE_SHEET_TERMINOLOGY),
    ...Object.values(INCOME_STATEMENT_TERMINOLOGY),
  ];
  
  for (const entry of allTerminologies) {
    if (entry.synonyms.map(normalizeString).includes(normalized)) {
      return entry.synonyms;
    }
  }
  
  return null;
};

/**
 * Dapatkan deskripsi untuk suatu istilah
 */
export const getTermDescription = (term: string): string | null => {
  const normalized = normalizeString(term);
  
  const allTerminologies = [
    ...Object.values(ACCOUNT_TYPE_TERMINOLOGY),
    ...Object.values(BALANCE_SHEET_TERMINOLOGY),
    ...Object.values(INCOME_STATEMENT_TERMINOLOGY),
  ];
  
  for (const entry of allTerminologies) {
    if (entry.synonyms.map(normalizeString).includes(normalized)) {
      return entry.description;
    }
  }
  
  return null;
};

/**
 * Format tooltip text dengan istilah alternatif
 */
export const formatTermTooltip = (term: string): string => {
  const synonyms = getSynonyms(term);
  const description = getTermDescription(term);
  
  if (!synonyms && !description) return term;
  
  let tooltip = '';
  
  if (synonyms && synonyms.length > 1) {
    const alternatives = synonyms.filter(s => normalizeString(s) !== normalizeString(term));
    if (alternatives.length > 0) {
      tooltip += `Juga dikenal sebagai: ${alternatives.join(', ')}`;
    }
  }
  
  if (description) {
    if (tooltip) tooltip += '\n\n';
    tooltip += description;
  }
  
  return tooltip || term;
};

/**
 * Cek duplikasi nama akun berdasarkan sinonim
 * @returns Array of potential duplicate account names
 */
export const checkAccountNameDuplication = (
  newName: string, 
  existingNames: string[]
): string[] => {
  const duplicates: string[] = [];
  const normalizedNew = normalizeString(newName);
  
  for (const existing of existingNames) {
    const normalizedExisting = normalizeString(existing);
    
    // Exact match
    if (normalizedNew === normalizedExisting) {
      duplicates.push(existing);
      continue;
    }
    
    // Synonym match
    if (areSynonyms(newName, existing)) {
      duplicates.push(existing);
    }
  }
  
  return duplicates;
};

/**
 * Validasi nama akun dan return warning jika ada potensi duplikasi
 */
export const validateAccountName = (
  newName: string,
  existingNames: string[]
): { isValid: boolean; warning?: string; duplicates?: string[] } => {
  if (!newName.trim()) {
    return { isValid: false, warning: 'Nama akun tidak boleh kosong' };
  }
  
  if (newName.length > 100) {
    return { isValid: false, warning: 'Nama akun maksimal 100 karakter' };
  }
  
  const duplicates = checkAccountNameDuplication(newName, existingNames);
  
  if (duplicates.length > 0) {
    return {
      isValid: false,
      warning: `Nama akun mungkin duplikasi dengan: ${duplicates.join(', ')}`,
      duplicates,
    };
  }
  
  return { isValid: true };
};

/**
 * Dapatkan tipe akun dari terminology
 */
export const getAccountTypeFromTerm = (term: string): AccountTypeCode | null => {
  const normalized = normalizeString(term);
  
  const allTerminologies = [
    ...Object.values(BALANCE_SHEET_TERMINOLOGY),
    ...Object.values(INCOME_STATEMENT_TERMINOLOGY),
  ];
  
  for (const entry of allTerminologies) {
    if (entry.synonyms.map(normalizeString).includes(normalized)) {
      return entry.accountType || null;
    }
  }
  
  return null;
};

/**
 * Format tipe akun dengan tooltip
 */
export const getAccountTypeDisplay = (type: AccountTypeCode): {
  label: string;
  tooltip: string;
  color: string;
  bgColor: string;
} => {
  const terminology = ACCOUNT_TYPE_TERMINOLOGY[type];
  return {
    label: terminology.standard,
    tooltip: formatTermTooltip(terminology.standard),
    color: terminology.color,
    bgColor: terminology.bgColor,
  };
};

// ============================================
// PERSAMAAN AKUNTANSI
// ============================================

export const ACCOUNTING_EQUATIONS = {
  balanceSheet: {
    formula: 'Aktiva = Pasiva',
    expanded: 'Aset = Kewajiban + Modal',
    alternative: 'Harta = Utang + Ekuitas',
    description: 'Persamaan dasar akuntansi yang harus selalu seimbang',
  },
  equity: {
    formula: 'Modal = Aktiva - Pasiva',
    expanded: 'Ekuitas = Aset - Kewajiban',
    alternative: 'Kekayaan Bersih = Harta - Utang',
    description: 'Hak residual pemilik atas aset setelah dikurangi kewajiban',
  },
  profitLoss: {
    formula: 'SHU = Pendapatan - Beban',
    expanded: 'Laba/Rugi = Penghasilan - Biaya',
    alternative: 'Surplus/Defisit = Pemasukan - Pengeluaran',
    description: 'Hasil usaha dalam satu periode akuntansi',
  },
};
