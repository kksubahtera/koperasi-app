import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Database as DatabaseIcon, 
  Users, 
  Wallet, 
  CreditCard, 
  Building2, 
  Shield,
  AlertCircle,
  Save,
  Loader2,
  Plus,
  Trash2,
  FileSpreadsheet,
  ChevronDown,
  Calendar,
  BookOpen,
  Download,
  Upload,
  UserPlus,
  Link,
  SkipForward,
  Edit
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import BulkMemberImport from './BulkMemberImport';
import AdminMemberCreation from './AdminMemberCreation';
import MigrationDataMatching from './MigrationDataMatching';
import InstallmentMigration from './InstallmentMigration';
import SavingsMigrationEnhanced from './SavingsMigrationEnhanced';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { format, addDays, addMonths, startOfMonth, setDate, isValid } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/mockData';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';
import { OpeningJournalManager } from './OpeningJournalManager';
import { ExcelDropZone } from './ExcelDropZone';
import { ExcelPreviewDialog, PreviewRow, PreviewColumn } from './ExcelPreviewDialog';
import { MigrationRollback, createMigrationBackup } from './MigrationRollback';
import { MigrationHistory, saveMigrationHistory } from './MigrationHistory';
import MigrationSaldoCorrection from './MigrationSaldoCorrection';
import BusinessUnitMigration from './BusinessUnitMigration';
import IndividualLoanMigration from './IndividualLoanMigration';
import { readExcelFile, createAndDownloadExcelFromJson, createAndDownloadExcelMixed } from '@/lib/excelUtils';

// Mapping akun standar koperasi ke Chart of Accounts
const ACCOUNT_MAPPING = {
  // ASET (AKTIVA)
  asset: {
    kas: { code: '1.1.01', name: 'Kas', type: 'asset' as const },
    bank: { code: '1.1.02', name: 'Bank', type: 'asset' as const },
    piutangPinjaman: { code: '1.1.03', name: 'Piutang Pinjaman Anggota', type: 'asset' as const },
    persediaan: { code: '1.1.04', name: 'Persediaan Barang', type: 'asset' as const },
    piutangLainnya: { code: '1.1.05', name: 'Piutang Lainnya', type: 'asset' as const },
    biayaDibayarDimuka: { code: '1.1.06', name: 'Biaya Dibayar Dimuka', type: 'asset' as const },
    tanah: { code: '1.2.01', name: 'Tanah', type: 'asset' as const },
    bangunan: { code: '1.2.02', name: 'Bangunan', type: 'asset' as const },
    akumPenyusutanBangunan: { code: '1.2.03', name: 'Akumulasi Penyusutan Bangunan', type: 'asset' as const },
    peralatanKantor: { code: '1.2.04', name: 'Peralatan Kantor', type: 'asset' as const },
    akumPenyusutanPeralatan: { code: '1.2.05', name: 'Akumulasi Penyusutan Peralatan', type: 'asset' as const },
    kendaraan: { code: '1.2.06', name: 'Kendaraan', type: 'asset' as const },
    akumPenyusutanKendaraan: { code: '1.2.07', name: 'Akumulasi Penyusutan Kendaraan', type: 'asset' as const },
    asetLainnya: { code: '1.3.01', name: 'Aset Lainnya', type: 'asset' as const },
  },
  // KEWAJIBAN (LIABILITAS)
  liability: {
    hutangUsaha: { code: '2.1.01', name: 'Hutang Usaha', type: 'liability' as const },
    hutangBunga: { code: '2.1.02', name: 'Hutang Bunga', type: 'liability' as const },
    hutangPajak: { code: '2.1.03', name: 'Hutang Pajak', type: 'liability' as const },
    pendapatanDiterimaDimuka: { code: '2.1.04', name: 'Pendapatan Diterima Dimuka', type: 'liability' as const },
    pinjamanBank: { code: '2.2.01', name: 'Pinjaman Bank', type: 'liability' as const },
    pinjamanKoperasiLain: { code: '2.2.02', name: 'Pinjaman Koperasi Lain', type: 'liability' as const },
    pinjamanAnggota: { code: '2.2.03', name: 'Pinjaman Diterima dari Anggota', type: 'liability' as const },
  },
  // MODAL (EKUITAS)
  equity: {
    simpananPokok: { code: '3.1.01', name: 'Simpanan Pokok', type: 'equity' as const },
    simpananWajib: { code: '3.1.02', name: 'Simpanan Wajib', type: 'equity' as const },
    simpananSukarela: { code: '3.1.03', name: 'Simpanan Sukarela', type: 'equity' as const },
    danaCadangan: { code: '3.2.01', name: 'Dana Cadangan', type: 'equity' as const },
    danaPendidikan: { code: '3.2.02', name: 'Dana Pendidikan', type: 'equity' as const },
    danaSosial: { code: '3.2.03', name: 'Dana Sosial', type: 'equity' as const },
    danaPembangunan: { code: '3.2.04', name: 'Dana Pembangunan', type: 'equity' as const },
    shuTahunBerjalan: { code: '3.3.01', name: 'SHU Tahun Berjalan', type: 'equity' as const },
    hibahDonasi: { code: '3.4.01', name: 'Hibah dan Donasi', type: 'equity' as const },
    modalPenyertaan: { code: '3.4.02', name: 'Modal Penyertaan', type: 'equity' as const },
  },
};

// Helper function to get or create account
const getOrCreateAccount = async (
  accountCode: string, 
  accountName: string, 
  accountType: 'asset' | 'liability' | 'equity',
  initialBalance: number = 0
): Promise<string | null> => {
  // Check if account exists
  const { data: existing } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('account_code', accountCode)
    .maybeSingle();

  if (existing) {
    // Update balance if needed
    if (initialBalance !== 0) {
      await supabase
        .from('chart_of_accounts')
        .update({ balance: initialBalance })
        .eq('id', existing.id);
    }
    return existing.id;
  }

  // Create new account
  const { data: newAccount, error } = await supabase
    .from('chart_of_accounts')
    .insert([{
      account_code: accountCode,
      account_name: accountName,
      account_type: accountType,
      balance: initialBalance,
      is_active: true,
      is_system: true,
    }])
    .select('id')
    .single();

  if (error) {
    console.error('Error creating account:', error);
    return null;
  }

  return newAccount.id;
};

// Interface for journal line
interface OpeningJournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

// Interface for journal preview line (without accountId)
interface JournalPreviewLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface DataMigrationWizardProps {
  onBack: () => void;
}

interface MemberSavingsEntry {
  id: string;
  userId: string;
  memberName: string;
  memberNumber: string;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
}

interface LoanMigrationEntry {
  id: string;
  tempId: string;
  userId: string;
  memberName: string;
  principalAmount: number;
  tenor: number;
  interestRate: number;
  paidInstallments: number;
  remainingPrincipal: number;
  disbursementDate: string; // Added disbursement date
}

// ASET (Aktiva) - Sesuai standar akuntansi koperasi
interface AssetEntry {
  // Aset Lancar
  kas: number;
  bank: number;
  persediaan: number; // Barang dagangan/persediaan
  piutangLainnya: number; // Piutang selain pinjaman anggota
  biayaDibayarDimuka: number;
  // Aset Tetap
  tanah: number;
  bangunan: number;
  akumulasiPenyusutanBangunan: number;
  peralatanKantor: number;
  akumulasiPenyusutanPeralatan: number;
  kendaraan: number;
  akumulasiPenyusutanKendaraan: number;
  // Aset Lainnya
  asetLainnya: number;
}

// PASIVA (Kewajiban + Modal) - Sesuai standar akuntansi koperasi
interface LiabilityEntry {
  // Kewajiban Jangka Pendek
  hutangUsaha: number;
  hutangBunga: number;
  hutangPajak: number;
  pendapatanDiterimaDimuka: number;
  // Kewajiban Jangka Panjang
  pinjamanBank: number;
  pinjamanKoperasiLain: number;
  pinjamanAnggota: number; // Pinjaman diterima dari anggota
}

interface EquityEntry {
  // Modal Sendiri
  simpananPokok: number; // Dari langkah 2
  simpananWajib: number; // Dari langkah 2
  simpananSukarela: number; // Dari langkah 2
  danaCadangan: number;
  danaPendidikan: number;
  danaSosial: number;
  danaPembangunan: number;
  shuTahunBerjalan: number;
  // Modal Lainnya
  hibahDonasi: number;
  modalPenyertaan: number;
}

const STEPS = [
  { id: 0, title: 'Registrasi Anggota', icon: Users, description: 'Import atau buat akun anggota sebelum migrasi data' },
  { id: 1, title: 'Saldo Awal Ekuitas', icon: Building2, description: 'Input saldo awal modal koperasi' },
  { id: 2, title: 'Simpanan Anggota', icon: Wallet, description: 'Import data simpanan anggota' },
  { id: 3, title: 'Pinjaman Anggota', icon: CreditCard, description: 'Import data pinjaman aktif' },
  { id: 4, title: 'Konfirmasi', icon: Check, description: 'Review dan simpan data' },
];

// Component to preview installment schedule
const InstallmentSchedulePreview = ({ loan }: { loan: LoanMigrationEntry }) => {
  const [isOpen, setIsOpen] = useState(false);
  const settings = getCooperativeSettings();
  const dueDaysInterval = settings.installmentDueDaysAfterDisbursement || 30;
  
  const monthlyPrincipal = loan.principalAmount / loan.tenor;
  const monthlyInterest = loan.principalAmount * loan.interestRate;
  const monthlyTotal = monthlyPrincipal + monthlyInterest;
  const disbursementDate = new Date(loan.disbursementDate);
  
  // Generate installment schedule
  const installments = Array.from({ length: loan.tenor }, (_, i) => {
    const installmentNumber = i + 1;
    const dueDate = addDays(disbursementDate, installmentNumber * dueDaysInterval);
    const isPaid = installmentNumber <= loan.paidInstallments;
    
    return {
      number: installmentNumber,
      dueDate,
      principal: monthlyPrincipal,
      interest: monthlyInterest,
      total: monthlyTotal,
      isPaid,
    };
  });
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Preview Jadwal Angsuran ({loan.tenor} kali)</span>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Interval: <strong>{dueDaysInterval} hari</strong> dari pencairan
            </span>
            <span className="text-muted-foreground">
              Angsuran/bulan: <strong>{formatCurrency(monthlyTotal)}</strong>
            </span>
          </div>
          <div className="max-h-[300px] overflow-auto rounded-md border bg-background">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-[60px] text-center">No.</TableHead>
                  <TableHead>Tanggal Jatuh Tempo</TableHead>
                  <TableHead className="text-right">Pokok</TableHead>
                  <TableHead className="text-right">Bunga</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((inst) => (
                  <TableRow key={inst.number} className={inst.isPaid ? 'bg-green-50/50 dark:bg-green-900/10' : ''}>
                    <TableCell className="text-center font-medium">{inst.number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(inst.dueDate, 'dd MMM yyyy', { locale: id })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(inst.principal)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(inst.interest)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inst.total)}</TableCell>
                    <TableCell className="text-center">
                      {inst.isPaid ? (
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                          <Check className="h-3 w-3 mr-1" />
                          Lunas
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Belum Bayar
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
            <div className="p-2 rounded bg-background border">
              <p className="text-muted-foreground">Total Pokok</p>
              <p className="font-semibold">{formatCurrency(loan.principalAmount)}</p>
            </div>
            <div className="p-2 rounded bg-background border">
              <p className="text-muted-foreground">Total Bunga</p>
              <p className="font-semibold">{formatCurrency(monthlyInterest * loan.tenor)}</p>
            </div>
            <div className="p-2 rounded bg-primary/10 border border-primary/20">
              <p className="text-muted-foreground">Total Pinjaman</p>
              <p className="font-semibold text-primary">{formatCurrency((monthlyPrincipal + monthlyInterest) * loan.tenor)}</p>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const DataMigrationWizard = ({ onBack }: DataMigrationWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [memberRegistrationMode, setMemberRegistrationMode] = useState<'bulk' | 'single' | 'matching' | 'skip'>('bulk');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const currentYear = new Date().getFullYear();
  const [migrationYear, setMigrationYear] = useState(currentYear);
  
  // State for sub-migration views
  const [showInstallmentMigration, setShowInstallmentMigration] = useState(false);
  const [showSavingsMigration, setShowSavingsMigration] = useState(false);
  
  // State for existing opening journals check
  const [existingOpeningJournals, setExistingOpeningJournals] = useState<{
    id: string;
    entry_number: string;
    entry_date: string;
    total_debit: number;
  }[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  
  // File input refs
  const savingsFileInputRef = useRef<HTMLInputElement>(null);
  const loansFileInputRef = useRef<HTMLInputElement>(null);
  
  // Members list
  const [members, setMembers] = useState<{ id: string; name: string; memberNumber: string }[]>([]);
  
  // Step 1: Asset data (Aktiva)
  const [assetData, setAssetData] = useState<AssetEntry>({
    // Aset Lancar
    kas: 0,
    bank: 0,
    persediaan: 0,
    piutangLainnya: 0,
    biayaDibayarDimuka: 0,
    // Aset Tetap
    tanah: 0,
    bangunan: 0,
    akumulasiPenyusutanBangunan: 0,
    peralatanKantor: 0,
    akumulasiPenyusutanPeralatan: 0,
    kendaraan: 0,
    akumulasiPenyusutanKendaraan: 0,
    // Aset Lainnya
    asetLainnya: 0,
  });
  
  // Liability data (Kewajiban)
  const [liabilityData, setLiabilityData] = useState<LiabilityEntry>({
    // Kewajiban Jangka Pendek
    hutangUsaha: 0,
    hutangBunga: 0,
    hutangPajak: 0,
    pendapatanDiterimaDimuka: 0,
    // Kewajiban Jangka Panjang
    pinjamanBank: 0,
    pinjamanKoperasiLain: 0,
    pinjamanAnggota: 0,
  });
  
  // Equity data (Modal)
  const [equityData, setEquityData] = useState<EquityEntry>({
    // Modal Sendiri
    simpananPokok: 0,
    simpananWajib: 0,
    simpananSukarela: 0,
    danaCadangan: 0,
    danaPendidikan: 0,
    danaSosial: 0,
    danaPembangunan: 0,
    shuTahunBerjalan: 0,
    // Modal Lainnya
    hibahDonasi: 0,
    modalPenyertaan: 0,
  });
  
  // Step 2: Member savings
  const [savingsEntries, setSavingsEntries] = useState<MemberSavingsEntry[]>([]);
  
  // Step 3: Loan data
  const [loanEntries, setLoanEntries] = useState<LoanMigrationEntry[]>([]);

  // ===== EXCEL IMPORT/EXPORT FUNCTIONS =====

  // Download savings template
  const downloadSavingsTemplate = async () => {
    const templateData = savingsEntries.map(entry => ({
      'No. Anggota': entry.memberNumber,
      'Nama Anggota': entry.memberName,
      'Simpanan Pokok': entry.simpananPokok || 0,
      'Simpanan Wajib': entry.simpananWajib || 0,
      'Simpanan Sukarela': entry.simpananSukarela || 0,
    }));

    try {
      await createAndDownloadExcelFromJson(
        [{
          name: 'Simpanan Anggota',
          data: templateData,
          columns: [
            { width: 15 },  // No. Anggota
            { width: 30 },  // Nama Anggota
            { width: 18 },  // Simpanan Pokok
            { width: 18 },  // Simpanan Wajib
            { width: 18 },  // Simpanan Sukarela
          ],
        }],
        `Template_Simpanan_Migrasi_${migrationYear}.xlsx`
      );
      toast.success('Template simpanan berhasil diunduh');
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Gagal membuat template');
    }
  };

  // Download loans template
  const downloadLoansTemplate = async () => {
    const templateData = members.map(m => ({
      'No. Anggota': m.memberNumber,
      'Nama Anggota': m.name,
      'Pokok Pinjaman': 0,
      'Tenor (bulan)': 12,
      'Bunga per Bulan (%)': 2,
      'Sudah Dibayar (angsuran ke-)': 0,
      'Tanggal Pencairan (YYYY-MM-DD)': format(new Date(), 'yyyy-MM-dd'),
    }));

    // Add example row
    if (templateData.length === 0) {
      templateData.push({
        'No. Anggota': 'MBR-20240101-0001',
        'Nama Anggota': 'Contoh Nama',
        'Pokok Pinjaman': 5000000,
        'Tenor (bulan)': 12,
        'Bunga per Bulan (%)': 2,
        'Sudah Dibayar (angsuran ke-)': 3,
        'Tanggal Pencairan (YYYY-MM-DD)': '2024-01-15',
      });
    }

    // Add instruction data
    const instructions = [
      { 'Petunjuk Pengisian': 'PETUNJUK IMPORT DATA PINJAMAN' },
      { 'Petunjuk Pengisian': '' },
      { 'Petunjuk Pengisian': '1. Isi data pinjaman aktif pada sheet "Pinjaman Anggota"' },
      { 'Petunjuk Pengisian': '2. No. Anggota harus sesuai dengan data anggota yang terdaftar' },
      { 'Petunjuk Pengisian': '3. Pokok Pinjaman: total pinjaman awal (tanpa bunga)' },
      { 'Petunjuk Pengisian': '4. Tenor: jangka waktu pinjaman dalam bulan' },
      { 'Petunjuk Pengisian': '5. Bunga per Bulan: dalam persen (contoh: 2 untuk 2%)' },
      { 'Petunjuk Pengisian': '6. Sudah Dibayar: jumlah angsuran yang sudah dibayar' },
      { 'Petunjuk Pengisian': '7. Tanggal Pencairan: format YYYY-MM-DD (contoh: 2024-01-15)' },
      { 'Petunjuk Pengisian': '' },
      { 'Petunjuk Pengisian': 'Hapus baris yang tidak memiliki pinjaman aktif' },
    ];

    try {
      await createAndDownloadExcelMixed(
        [
          {
            name: 'Pinjaman Anggota',
            type: 'json',
            data: templateData,
            columns: [20, 30, 18, 15, 20, 25, 28],
          },
          {
            name: 'Petunjuk',
            type: 'json',
            data: instructions,
            columns: [60],
          },
        ],
        `Template_Pinjaman_Migrasi_${migrationYear}.xlsx`
      );
      toast.success('Template pinjaman berhasil diunduh');
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Gagal membuat template');
    }
  };

  // Validation errors state
  const [importErrors, setImportErrors] = useState<{ type: 'savings' | 'loans'; errors: string[] } | null>(null);


  // Preview dialog state
  const [previewDialog, setPreviewDialog] = useState<{
    open: boolean;
    type: 'savings' | 'loans';
    data: PreviewRow[];
    columns: PreviewColumn[];
    validRowCount: number;
    invalidRowCount: number;
    warningRowCount: number;
    errors: string[];
    warnings: string[];
    rawData: any[];
  } | null>(null);

  // Validation helper functions
  const validateSavingsRow = (row: any, rowIndex: number): string[] => {
    const errors: string[] = [];
    const rowNum = rowIndex + 2; // +2 because Excel row 1 is header, and we're 0-indexed

    // Check required fields
    if (!row['No. Anggota'] && !row['Nama Anggota']) {
      errors.push(`Baris ${rowNum}: No. Anggota atau Nama Anggota harus diisi`);
    }

    // Validate numeric fields
    const numericFields = ['Simpanan Pokok', 'Simpanan Wajib', 'Simpanan Sukarela'];
    numericFields.forEach(field => {
      const value = row[field];
      if (value !== undefined && value !== null && value !== '') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors.push(`Baris ${rowNum}: ${field} harus berupa angka (nilai: "${value}")`);
        } else if (numValue < 0) {
          errors.push(`Baris ${rowNum}: ${field} tidak boleh negatif`);
        }
      }
    });

    return errors;
  };

  const validateLoansRow = (row: any, rowIndex: number): string[] => {
    const errors: string[] = [];
    const rowNum = rowIndex + 2;

    // Check required field - No. Anggota
    if (!row['No. Anggota']) {
      errors.push(`Baris ${rowNum}: No. Anggota wajib diisi`);
      return errors; // Return early as other validations depend on this
    }

    // Check if member exists
    const memberNumber = String(row['No. Anggota']).trim();
    const member = members.find(m => m.memberNumber === memberNumber);
    if (!member) {
      errors.push(`Baris ${rowNum}: Anggota dengan No. "${memberNumber}" tidak ditemukan`);
    }

    // Validate Pokok Pinjaman
    const principalAmount = row['Pokok Pinjaman'];
    if (principalAmount === undefined || principalAmount === null || principalAmount === '') {
      errors.push(`Baris ${rowNum}: Pokok Pinjaman wajib diisi`);
    } else {
      const numValue = Number(principalAmount);
      if (isNaN(numValue)) {
        errors.push(`Baris ${rowNum}: Pokok Pinjaman harus berupa angka (nilai: "${principalAmount}")`);
      } else if (numValue <= 0) {
        errors.push(`Baris ${rowNum}: Pokok Pinjaman harus lebih dari 0`);
      }
    }

    // Validate Tenor
    const tenor = row['Tenor (bulan)'];
    if (tenor !== undefined && tenor !== null && tenor !== '') {
      const numValue = Number(tenor);
      if (isNaN(numValue)) {
        errors.push(`Baris ${rowNum}: Tenor harus berupa angka (nilai: "${tenor}")`);
      } else if (numValue <= 0 || !Number.isInteger(numValue)) {
        errors.push(`Baris ${rowNum}: Tenor harus bilangan bulat positif`);
      } else if (numValue > 120) {
        errors.push(`Baris ${rowNum}: Tenor maksimal 120 bulan`);
      }
    }

    // Validate Bunga
    const bunga = row['Bunga per Bulan (%)'];
    if (bunga !== undefined && bunga !== null && bunga !== '') {
      const numValue = Number(bunga);
      if (isNaN(numValue)) {
        errors.push(`Baris ${rowNum}: Bunga per Bulan harus berupa angka (nilai: "${bunga}")`);
      } else if (numValue < 0) {
        errors.push(`Baris ${rowNum}: Bunga per Bulan tidak boleh negatif`);
      } else if (numValue > 100) {
        errors.push(`Baris ${rowNum}: Bunga per Bulan maksimal 100%`);
      }
    }

    // Validate Sudah Dibayar
    const paidInstallments = row['Sudah Dibayar (angsuran ke-)'];
    const tenorValue = Number(tenor) || 12;
    if (paidInstallments !== undefined && paidInstallments !== null && paidInstallments !== '') {
      const numValue = Number(paidInstallments);
      if (isNaN(numValue)) {
        errors.push(`Baris ${rowNum}: Sudah Dibayar harus berupa angka (nilai: "${paidInstallments}")`);
      } else if (numValue < 0 || !Number.isInteger(numValue)) {
        errors.push(`Baris ${rowNum}: Sudah Dibayar harus bilangan bulat non-negatif`);
      } else if (numValue > tenorValue) {
        errors.push(`Baris ${rowNum}: Sudah Dibayar (${numValue}) tidak boleh melebihi Tenor (${tenorValue})`);
      }
    }

    // Validate Tanggal Pencairan
    const disbursementDate = row['Tanggal Pencairan (YYYY-MM-DD)'];
    if (disbursementDate !== undefined && disbursementDate !== null && disbursementDate !== '') {
      // Check if it's an Excel date serial number
      if (typeof disbursementDate !== 'number') {
        const dateStr = String(disbursementDate).trim();
        // Check format YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
          errors.push(`Baris ${rowNum}: Format Tanggal Pencairan harus YYYY-MM-DD (nilai: "${dateStr}")`);
        } else {
          // Validate actual date
          const parsedDate = new Date(dateStr);
          if (isNaN(parsedDate.getTime())) {
            errors.push(`Baris ${rowNum}: Tanggal Pencairan tidak valid`);
          }
        }
      }
    }

    return errors;
  };

  // Parse Excel file and show preview for savings
  const handleSavingsImport = async (fileOrEvent: File | React.ChangeEvent<HTMLInputElement>) => {
    const file = fileOrEvent instanceof File ? fileOrEvent : fileOrEvent.target.files?.[0];
    if (!file) return;

    // Reset previous errors
    setImportErrors(null);

    try {
      const jsonData = await readExcelFile(file);

      if (jsonData.length === 0) {
        setImportErrors({ type: 'savings', errors: ['File Excel kosong atau tidak memiliki data'] });
        toast.error('File Excel kosong');
        return;
      }

      // Check required columns
      const firstRow = jsonData[0] as any;
      const requiredColumns = ['No. Anggota', 'Nama Anggota'];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      if (missingColumns.length > 0) {
        setImportErrors({ 
          type: 'savings', 
          errors: [`Kolom yang diperlukan tidak ditemukan: ${missingColumns.join(', ')}`] 
        });
        toast.error('Format file tidak sesuai');
        return;
      }

      // Validate all rows and prepare preview data
      const allErrors: string[] = [];
      const allWarnings: string[] = [];
      let validCount = 0;
      let invalidCount = 0;
      let warningCount = 0;

      const previewData: PreviewRow[] = jsonData.map((row: any, index) => {
        const rowErrors = validateSavingsRow(row, index);
        const rowNum = index + 2;

        // Check if member exists
        const memberNumber = row['No. Anggota'];
        const memberName = row['Nama Anggota'];
        const memberExists = savingsEntries.some(entry => 
          entry.memberNumber === memberNumber || 
          entry.memberName?.toLowerCase() === memberName?.toLowerCase()
        );

        const rowWarnings: string[] = [];
        if (!memberExists && (memberNumber || memberName)) {
          rowWarnings.push(`Anggota tidak ditemukan: ${memberNumber || memberName}`);
          allWarnings.push(`Baris ${rowNum}: Anggota "${memberNumber || memberName}" tidak ditemukan di daftar anggota`);
        }

        if (rowErrors.length > 0) {
          invalidCount++;
          allErrors.push(...rowErrors);
        } else if (rowWarnings.length > 0) {
          warningCount++;
          validCount++; // Warnings are still importable
        } else {
          validCount++;
        }

        return {
          _rowIndex: rowNum,
          _errors: rowErrors.length > 0 ? rowErrors : undefined,
          _warnings: rowWarnings.length > 0 ? rowWarnings : undefined,
          'No. Anggota': memberNumber,
          'Nama Anggota': memberName,
          'Simpanan Pokok': row['Simpanan Pokok'] || 0,
          'Simpanan Wajib': row['Simpanan Wajib'] || 0,
          'Simpanan Sukarela': row['Simpanan Sukarela'] || 0,
        };
      });

      // Define columns for preview
      const columns: PreviewColumn[] = [
        { key: 'No. Anggota', label: 'No. Anggota', type: 'text' },
        { key: 'Nama Anggota', label: 'Nama Anggota', type: 'text' },
        { key: 'Simpanan Pokok', label: 'Simpanan Pokok', type: 'currency' },
        { key: 'Simpanan Wajib', label: 'Simpanan Wajib', type: 'currency' },
        { key: 'Simpanan Sukarela', label: 'Simpanan Sukarela', type: 'currency' },
      ];

      // Open preview dialog
      setPreviewDialog({
        open: true,
        type: 'savings',
        data: previewData,
        columns,
        validRowCount: validCount,
        invalidRowCount: invalidCount,
        warningRowCount: warningCount,
        errors: allErrors,
        warnings: allWarnings,
        rawData: jsonData,
      });

    } catch (error) {
      console.error('Error reading Excel:', error);
      setImportErrors({ type: 'savings', errors: ['Gagal membaca file Excel. Pastikan format file benar.'] });
      toast.error('Gagal membaca file Excel');
    }
    
    // Reset input only if it was from an input element
    if (!(fileOrEvent instanceof File) && savingsFileInputRef.current) {
      savingsFileInputRef.current.value = '';
    }
  };

  // Confirm savings import from preview
  const confirmSavingsImport = () => {
    if (!previewDialog || previewDialog.type !== 'savings') return;

    const jsonData = previewDialog.rawData;
    let updatedCount = 0;
    
    const updatedEntries = savingsEntries.map((entry) => {
      const matchingRow = jsonData.find((row: any) => 
        row['No. Anggota'] === entry.memberNumber || 
        row['Nama Anggota']?.toLowerCase() === entry.memberName.toLowerCase()
      ) as any;

      if (matchingRow) {
        // Only update if row has no errors
        const rowIndex = jsonData.indexOf(matchingRow);
        const previewRow = previewDialog.data.find(p => p._rowIndex === rowIndex + 2);
        if (previewRow && (!previewRow._errors || previewRow._errors.length === 0)) {
          updatedCount++;
          return {
            ...entry,
            simpananPokok: Number(matchingRow['Simpanan Pokok']) || 0,
            simpananWajib: Number(matchingRow['Simpanan Wajib']) || 0,
            simpananSukarela: Number(matchingRow['Simpanan Sukarela']) || 0,
          };
        }
      }
      return entry;
    });

    setSavingsEntries(updatedEntries);
    setPreviewDialog(null);
    toast.success(`Berhasil import ${updatedCount} data simpanan anggota`);
  };

  // Parse Excel file and show preview for loans
  const handleLoansImport = async (fileOrEvent: File | React.ChangeEvent<HTMLInputElement>) => {
    const file = fileOrEvent instanceof File ? fileOrEvent : fileOrEvent.target.files?.[0];
    if (!file) return;

    // Reset previous errors
    setImportErrors(null);

    try {
      const jsonData = await readExcelFile(file);

      if (jsonData.length === 0) {
        setImportErrors({ type: 'loans', errors: ['File Excel kosong atau tidak memiliki data'] });
        toast.error('File Excel kosong');
        return;
      }

      // Check required columns
      const firstRow = jsonData[0] as any;
      const requiredColumns = ['No. Anggota', 'Pokok Pinjaman'];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      if (missingColumns.length > 0) {
        setImportErrors({ 
          type: 'loans', 
          errors: [`Kolom yang diperlukan tidak ditemukan: ${missingColumns.join(', ')}`] 
        });
        toast.error('Format file tidak sesuai');
        return;
      }

      // Filter rows with data (skip empty rows)
      const dataRows = jsonData.filter((row: any) => {
        const principal = row['Pokok Pinjaman'];
        return principal !== undefined && principal !== null && principal !== '' && Number(principal) > 0;
      });

      if (dataRows.length === 0) {
        setImportErrors({ type: 'loans', errors: ['Tidak ada data pinjaman valid (Pokok Pinjaman > 0)'] });
        toast.warning('Tidak ada data pinjaman valid');
        return;
      }

      // Validate all rows and prepare preview data
      const allErrors: string[] = [];
      const allWarnings: string[] = [];
      let validCount = 0;
      let invalidCount = 0;
      let warningCount = 0;

      const previewData: PreviewRow[] = dataRows.map((row: any, index) => {
        const rowErrors = validateLoansRow(row, index);
        const rowNum = index + 2;

        // Parse disbursement date
        let disbursementDate = row['Tanggal Pencairan (YYYY-MM-DD)'] || format(new Date(), 'yyyy-MM-dd');
        if (typeof disbursementDate === 'number') {
          const excelEpoch = new Date(1899, 11, 30);
          const date = new Date(excelEpoch.getTime() + disbursementDate * 24 * 60 * 60 * 1000);
          disbursementDate = format(date, 'yyyy-MM-dd');
        }

        const rowWarnings: string[] = [];
        
        if (rowErrors.length > 0) {
          invalidCount++;
          allErrors.push(...rowErrors);
        } else if (rowWarnings.length > 0) {
          warningCount++;
          validCount++;
        } else {
          validCount++;
        }

        return {
          _rowIndex: rowNum,
          _errors: rowErrors.length > 0 ? rowErrors : undefined,
          _warnings: rowWarnings.length > 0 ? rowWarnings : undefined,
          'No. Anggota': row['No. Anggota'],
          'Nama Anggota': row['Nama Anggota'],
          'Pokok Pinjaman': row['Pokok Pinjaman'],
          'Tenor (bulan)': row['Tenor (bulan)'] || 12,
          'Bunga per Bulan (%)': row['Bunga per Bulan (%)'] || 2,
          'Sudah Dibayar': row['Sudah Dibayar (angsuran ke-)'] || 0,
          'Tanggal Pencairan': disbursementDate,
        };
      });

      // Define columns for preview
      const columns: PreviewColumn[] = [
        { key: 'No. Anggota', label: 'No. Anggota', type: 'text' },
        { key: 'Nama Anggota', label: 'Nama Anggota', type: 'text' },
        { key: 'Pokok Pinjaman', label: 'Pokok Pinjaman', type: 'currency' },
        { key: 'Tenor (bulan)', label: 'Tenor', type: 'number' },
        { key: 'Bunga per Bulan (%)', label: 'Bunga (%)', type: 'number' },
        { key: 'Sudah Dibayar', label: 'Sudah Dibayar', type: 'number' },
        { key: 'Tanggal Pencairan', label: 'Tgl Pencairan', type: 'date' },
      ];

      // Open preview dialog
      setPreviewDialog({
        open: true,
        type: 'loans',
        data: previewData,
        columns,
        validRowCount: validCount,
        invalidRowCount: invalidCount,
        warningRowCount: warningCount,
        errors: allErrors,
        warnings: allWarnings,
        rawData: dataRows,
      });

    } catch (error) {
      console.error('Error reading Excel:', error);
      setImportErrors({ type: 'loans', errors: ['Gagal membaca file Excel. Pastikan format file benar.'] });
      toast.error('Gagal membaca file Excel');
    }
    
    // Reset input only if it was from an input element
    if (!(fileOrEvent instanceof File) && loansFileInputRef.current) {
      loansFileInputRef.current.value = '';
    }
  };

  // Confirm loans import from preview
  const confirmLoansImport = () => {
    if (!previewDialog || previewDialog.type !== 'loans') return;

    const dataRows = previewDialog.rawData;
    const newLoans: LoanMigrationEntry[] = [];

    dataRows.forEach((row: any, index) => {
      // Only process valid rows
      const previewRow = previewDialog.data.find(p => p._rowIndex === index + 2);
      if (previewRow && previewRow._errors && previewRow._errors.length > 0) {
        return; // Skip invalid rows
      }

      const memberNumber = String(row['No. Anggota']).trim();
      const principalAmount = Number(row['Pokok Pinjaman']);
      
      const member = members.find(m => m.memberNumber === memberNumber);
      if (!member) return;

      const tenor = Number(row['Tenor (bulan)']) || 12;
      const interestRate = (Number(row['Bunga per Bulan (%)']) || 2) / 100;
      const paidInstallments = Number(row['Sudah Dibayar (angsuran ke-)']) || 0;
      let disbursementDate = row['Tanggal Pencairan (YYYY-MM-DD)'] || format(new Date(), 'yyyy-MM-dd');
      
      // Handle Excel date serial number
      if (typeof disbursementDate === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + disbursementDate * 24 * 60 * 60 * 1000);
        disbursementDate = format(date, 'yyyy-MM-dd');
      }

      const monthlyPrincipal = principalAmount / tenor;
      const remainingPrincipal = principalAmount - (monthlyPrincipal * paidInstallments);

      newLoans.push({
        id: crypto.randomUUID(),
        tempId: crypto.randomUUID(),
        userId: member.id,
        memberName: member.name,
        principalAmount,
        tenor,
        interestRate,
        paidInstallments,
        remainingPrincipal,
        disbursementDate,
      });
    });

    if (newLoans.length > 0) {
      setLoanEntries(prev => [...prev, ...newLoans]);
      toast.success(`Berhasil import ${newLoans.length} data pinjaman`);
    }
    
    setPreviewDialog(null);
  };

  // Handle preview confirm based on type
  const handlePreviewConfirm = () => {
    if (!previewDialog) return;
    
    if (previewDialog.type === 'savings') {
      confirmSavingsImport();
    } else {
      confirmLoansImport();
    }
  };

  // Handle preview cancel
  const handlePreviewCancel = () => {
    setPreviewDialog(null);
  };


  // Component to display import errors
  const ImportErrorDisplay = ({ type }: { type: 'savings' | 'loans' }) => {
    if (!importErrors || importErrors.type !== type || importErrors.errors.length === 0) {
      return null;
    }

    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-2">Error pada data import:</div>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {importErrors.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
          {importErrors.errors.length >= 10 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Hanya menampilkan 10 error pertama. Perbaiki error ini dan coba import lagi.
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  };
  
  // State for re-migration validation
  const [existingMigrationTransactions, setExistingMigrationTransactions] = useState<{
    userId: string;
    memberName: string;
    transactionCount: number;
  }[]>([]);
  const [showReMigrationWarning, setShowReMigrationWarning] = useState(false);

  // Check for existing opening journals for the selected year
  const checkExistingOpeningJournals = async (year: number) => {
    const { data } = await supabase
      .from('journal_entries')
      .select('id, entry_number, entry_date, total_debit')
      .eq('reference_type', 'opening_balance')
      .gte('entry_date', `${year}-01-01`)
      .lte('entry_date', `${year}-12-31`);
    
    if (data && data.length > 0) {
      setExistingOpeningJournals(data);
      setShowDuplicateWarning(true);
    } else {
      setExistingOpeningJournals([]);
      setShowDuplicateWarning(false);
    }
  };
  
  // Check for existing migration transactions (saldo_awal_*)
  const checkExistingMigrationTransactions = async () => {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        user_id,
        type,
        profiles!inner(name)
      `)
      .in('type', ['saldo_awal_pokok', 'saldo_awal_wajib', 'saldo_awal_sukarela'])
      .eq('status', 'approved');
    
    if (error) {
      console.error('Error checking migration transactions:', error);
      return;
    }

    if (transactions && transactions.length > 0) {
      // Group by user
      const userTransactions = transactions.reduce((acc, t) => {
        if (!acc[t.user_id]) {
          acc[t.user_id] = {
            userId: t.user_id,
            memberName: (t.profiles as any)?.name || 'Unknown',
            transactionCount: 0,
          };
        }
        acc[t.user_id].transactionCount++;
        return acc;
      }, {} as Record<string, { userId: string; memberName: string; transactionCount: number }>);

      const existingList = Object.values(userTransactions);
      if (existingList.length > 0) {
        setExistingMigrationTransactions(existingList);
        setShowReMigrationWarning(true);
      }
    }
  };
  
  // Load members on mount
  useState(() => {
    const loadMembers = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .eq('approval_status', 'approved')
        .eq('is_active', true);
      
      if (data) {
        setMembers(data.map(m => ({
          id: m.user_id,
          name: m.name,
          memberNumber: m.member_number || '',
        })));
        
        // Initialize savings entries
        setSavingsEntries(data.map(m => ({
          id: crypto.randomUUID(),
          userId: m.user_id,
          memberName: m.name,
          memberNumber: m.member_number || '',
          simpananPokok: 0,
          simpananWajib: 0,
          simpananSukarela: 0,
        })));
      }
      setIsLoading(false);
      
      // Check for existing opening journals
      await checkExistingOpeningJournals(currentYear);
      
      // Check for existing migration transactions
      await checkExistingMigrationTransactions();
    };
    loadMembers();
  });
  
  // Re-check when migration year changes
  const handleMigrationYearChange = async (year: number) => {
    setMigrationYear(year);
    await checkExistingOpeningJournals(year);
  };

  // Calculate totals - Simpanan dari anggota
  const totalSimpananPokok = savingsEntries.reduce((sum, e) => sum + e.simpananPokok, 0);
  const totalSimpananWajib = savingsEntries.reduce((sum, e) => sum + e.simpananWajib, 0);
  const totalSimpananSukarela = savingsEntries.reduce((sum, e) => sum + e.simpananSukarela, 0);
  const totalSimpanan = totalSimpananPokok + totalSimpananWajib + totalSimpananSukarela;
  
  // Piutang pinjaman = sisa pokok pinjaman anggota
  const totalPiutangPinjaman = loanEntries.reduce((sum, e) => sum + e.remainingPrincipal, 0);
  
  // AKTIVA (Aset)
  const totalAsetLancar = assetData.kas + assetData.bank + assetData.persediaan + 
                          assetData.piutangLainnya + assetData.biayaDibayarDimuka + totalPiutangPinjaman;
  
  const nilaiAsetTetapBruto = assetData.tanah + assetData.bangunan + assetData.peralatanKantor + assetData.kendaraan;
  const totalAkumulasiPenyusutan = assetData.akumulasiPenyusutanBangunan + assetData.akumulasiPenyusutanPeralatan + assetData.akumulasiPenyusutanKendaraan;
  const nilaiAsetTetapBersih = nilaiAsetTetapBruto - totalAkumulasiPenyusutan;
  
  const totalAktiva = totalAsetLancar + nilaiAsetTetapBersih + assetData.asetLainnya;
  
  // PASIVA (Kewajiban + Modal)
  const totalKewajibanJangkaPendek = liabilityData.hutangUsaha + liabilityData.hutangBunga + 
                                     liabilityData.hutangPajak + liabilityData.pendapatanDiterimaDimuka;
  const totalKewajibanJangkaPanjang = liabilityData.pinjamanBank + liabilityData.pinjamanKoperasiLain + liabilityData.pinjamanAnggota;
  const totalKewajiban = totalKewajibanJangkaPendek + totalKewajibanJangkaPanjang;
  
  // Modal - Simpanan diambil dari data anggota di step 2
  const totalDanaAlokasi = equityData.danaCadangan + equityData.danaPendidikan + equityData.danaSosial + equityData.danaPembangunan;
  const totalModalLainnya = equityData.hibahDonasi + equityData.modalPenyertaan;
  const totalModal = totalSimpanan + totalDanaAlokasi + totalModalLainnya + equityData.shuTahunBerjalan;
  
  const totalPasiva = totalKewajiban + totalModal;
  
  // Balance check
  const balanceDifference = totalAktiva - totalPasiva;
  const isBalanced = Math.abs(balanceDifference) < 1; // Allow Rp 1 tolerance for rounding

  // Add loan entry
  const addLoanEntry = () => {
    const today = new Date().toISOString().split('T')[0];
    setLoanEntries([...loanEntries, {
      id: crypto.randomUUID(),
      tempId: crypto.randomUUID(),
      userId: '',
      memberName: '',
      principalAmount: 0,
      tenor: 12,
      interestRate: 0.02,
      paidInstallments: 0,
      remainingPrincipal: 0,
      disbursementDate: today,
    }]);
  };

  // Remove loan entry
  const removeLoanEntry = (id: string) => {
    setLoanEntries(loanEntries.filter(e => e.id !== id));
  };

  // Update loan entry
  const updateLoanEntry = (id: string, field: keyof LoanMigrationEntry, value: any) => {
    setLoanEntries(loanEntries.map(e => {
      if (e.id === id) {
        const updated = { ...e, [field]: value };
        
        // Auto-calculate remaining principal
        if (field === 'principalAmount' || field === 'paidInstallments' || field === 'tenor') {
          const monthlyPrincipal = updated.principalAmount / updated.tenor;
          updated.remainingPrincipal = updated.principalAmount - (monthlyPrincipal * updated.paidInstallments);
        }
        
        // Update member name when userId changes
        if (field === 'userId') {
          const member = members.find(m => m.id === value);
          updated.memberName = member?.name || '';
        }
        
        return updated;
      }
      return e;
    }));
  };

  // Update savings entry
  const updateSavingsEntry = (id: string, field: keyof MemberSavingsEntry, value: number) => {
    setSavingsEntries(savingsEntries.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  // Generate journal preview lines (for display only, doesn't create accounts)
  const generateJournalPreview = (): JournalPreviewLine[] => {
    const lines: JournalPreviewLine[] = [];

    // === DEBIT ENTRIES (ASET) ===
    if (assetData.kas > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.kas.code, accountName: ACCOUNT_MAPPING.asset.kas.name, debit: assetData.kas, credit: 0 });
    }
    if (assetData.bank > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.bank.code, accountName: ACCOUNT_MAPPING.asset.bank.name, debit: assetData.bank, credit: 0 });
    }
    if (totalPiutangPinjaman > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.piutangPinjaman.code, accountName: ACCOUNT_MAPPING.asset.piutangPinjaman.name, debit: totalPiutangPinjaman, credit: 0 });
    }
    if (assetData.persediaan > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.persediaan.code, accountName: ACCOUNT_MAPPING.asset.persediaan.name, debit: assetData.persediaan, credit: 0 });
    }
    if (assetData.piutangLainnya > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.piutangLainnya.code, accountName: ACCOUNT_MAPPING.asset.piutangLainnya.name, debit: assetData.piutangLainnya, credit: 0 });
    }
    if (assetData.biayaDibayarDimuka > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.biayaDibayarDimuka.code, accountName: ACCOUNT_MAPPING.asset.biayaDibayarDimuka.name, debit: assetData.biayaDibayarDimuka, credit: 0 });
    }
    if (assetData.tanah > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.tanah.code, accountName: ACCOUNT_MAPPING.asset.tanah.name, debit: assetData.tanah, credit: 0 });
    }
    if (assetData.bangunan > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.bangunan.code, accountName: ACCOUNT_MAPPING.asset.bangunan.name, debit: assetData.bangunan, credit: 0 });
    }
    if (assetData.akumulasiPenyusutanBangunan > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.akumPenyusutanBangunan.code, accountName: ACCOUNT_MAPPING.asset.akumPenyusutanBangunan.name, debit: 0, credit: assetData.akumulasiPenyusutanBangunan });
    }
    if (assetData.peralatanKantor > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.peralatanKantor.code, accountName: ACCOUNT_MAPPING.asset.peralatanKantor.name, debit: assetData.peralatanKantor, credit: 0 });
    }
    if (assetData.akumulasiPenyusutanPeralatan > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.akumPenyusutanPeralatan.code, accountName: ACCOUNT_MAPPING.asset.akumPenyusutanPeralatan.name, debit: 0, credit: assetData.akumulasiPenyusutanPeralatan });
    }
    if (assetData.kendaraan > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.kendaraan.code, accountName: ACCOUNT_MAPPING.asset.kendaraan.name, debit: assetData.kendaraan, credit: 0 });
    }
    if (assetData.akumulasiPenyusutanKendaraan > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.akumPenyusutanKendaraan.code, accountName: ACCOUNT_MAPPING.asset.akumPenyusutanKendaraan.name, debit: 0, credit: assetData.akumulasiPenyusutanKendaraan });
    }
    if (assetData.asetLainnya > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.asset.asetLainnya.code, accountName: ACCOUNT_MAPPING.asset.asetLainnya.name, debit: assetData.asetLainnya, credit: 0 });
    }

    // === CREDIT ENTRIES (KEWAJIBAN) ===
    if (liabilityData.hutangUsaha > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.liability.hutangUsaha.code, accountName: ACCOUNT_MAPPING.liability.hutangUsaha.name, debit: 0, credit: liabilityData.hutangUsaha });
    }
    if (liabilityData.hutangBunga > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.liability.hutangBunga.code, accountName: ACCOUNT_MAPPING.liability.hutangBunga.name, debit: 0, credit: liabilityData.hutangBunga });
    }
    if (liabilityData.hutangPajak > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.liability.hutangPajak.code, accountName: ACCOUNT_MAPPING.liability.hutangPajak.name, debit: 0, credit: liabilityData.hutangPajak });
    }
    if (liabilityData.pendapatanDiterimaDimuka > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.liability.pendapatanDiterimaDimuka.code, accountName: ACCOUNT_MAPPING.liability.pendapatanDiterimaDimuka.name, debit: 0, credit: liabilityData.pendapatanDiterimaDimuka });
    }
    if (liabilityData.pinjamanBank > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.liability.pinjamanBank.code, accountName: ACCOUNT_MAPPING.liability.pinjamanBank.name, debit: 0, credit: liabilityData.pinjamanBank });
    }
    if (liabilityData.pinjamanKoperasiLain > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.liability.pinjamanKoperasiLain.code, accountName: ACCOUNT_MAPPING.liability.pinjamanKoperasiLain.name, debit: 0, credit: liabilityData.pinjamanKoperasiLain });
    }
    if (liabilityData.pinjamanAnggota > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.liability.pinjamanAnggota.code, accountName: ACCOUNT_MAPPING.liability.pinjamanAnggota.name, debit: 0, credit: liabilityData.pinjamanAnggota });
    }

    // === CREDIT ENTRIES (MODAL / EKUITAS) ===
    if (totalSimpananPokok > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.equity.simpananPokok.code, accountName: ACCOUNT_MAPPING.equity.simpananPokok.name, debit: 0, credit: totalSimpananPokok });
    }
    if (totalSimpananWajib > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.equity.simpananWajib.code, accountName: ACCOUNT_MAPPING.equity.simpananWajib.name, debit: 0, credit: totalSimpananWajib });
    }
    if (totalSimpananSukarela > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.equity.simpananSukarela.code, accountName: ACCOUNT_MAPPING.equity.simpananSukarela.name, debit: 0, credit: totalSimpananSukarela });
    }
    if (equityData.danaCadangan > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.equity.danaCadangan.code, accountName: ACCOUNT_MAPPING.equity.danaCadangan.name, debit: 0, credit: equityData.danaCadangan });
    }
    if (equityData.danaPendidikan > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.equity.danaPendidikan.code, accountName: ACCOUNT_MAPPING.equity.danaPendidikan.name, debit: 0, credit: equityData.danaPendidikan });
    }
    if (equityData.danaSosial > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.equity.danaSosial.code, accountName: ACCOUNT_MAPPING.equity.danaSosial.name, debit: 0, credit: equityData.danaSosial });
    }
    if (equityData.danaPembangunan > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.equity.danaPembangunan.code, accountName: ACCOUNT_MAPPING.equity.danaPembangunan.name, debit: 0, credit: equityData.danaPembangunan });
    }
    if (equityData.shuTahunBerjalan > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.equity.shuTahunBerjalan.code, accountName: ACCOUNT_MAPPING.equity.shuTahunBerjalan.name, debit: 0, credit: equityData.shuTahunBerjalan });
    }
    if (equityData.hibahDonasi > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.equity.hibahDonasi.code, accountName: ACCOUNT_MAPPING.equity.hibahDonasi.name, debit: 0, credit: equityData.hibahDonasi });
    }
    if (equityData.modalPenyertaan > 0) {
      lines.push({ accountCode: ACCOUNT_MAPPING.equity.modalPenyertaan.code, accountName: ACCOUNT_MAPPING.equity.modalPenyertaan.name, debit: 0, credit: equityData.modalPenyertaan });
    }

    return lines;
  };

  const journalPreviewLines = generateJournalPreview();
  const totalDebit = journalPreviewLines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = journalPreviewLines.reduce((sum, l) => sum + l.credit, 0);

  // Create opening journal entry with account mapping
  const createOpeningJournalEntry = async (): Promise<boolean> => {
    try {
      // First, delete existing opening journals for this year to prevent duplicates
      if (existingOpeningJournals.length > 0) {
        for (const existingJournal of existingOpeningJournals) {
          // Get existing journal lines to reverse account balances
          const { data: existingLines } = await supabase
            .from('journal_entry_lines')
            .select('account_id, debit_amount, credit_amount')
            .eq('journal_entry_id', existingJournal.id);
          
          // Reverse the account balances
          if (existingLines) {
            for (const line of existingLines) {
              const { data: account } = await supabase
                .from('chart_of_accounts')
                .select('balance, account_type')
                .eq('id', line.account_id)
                .single();
              
              if (account) {
                // Reverse: for assets/expenses, subtract debits and add credits
                // For liabilities/equity/income, add debits and subtract credits
                const isDebitNormal = ['asset', 'expense'].includes(account.account_type);
                let newBalance = account.balance;
                
                if (isDebitNormal) {
                  newBalance = account.balance - line.debit_amount + line.credit_amount;
                } else {
                  newBalance = account.balance + line.debit_amount - line.credit_amount;
                }
                
                await supabase
                  .from('chart_of_accounts')
                  .update({ balance: newBalance })
                  .eq('id', line.account_id);
              }
            }
          }
          
          // Delete journal entry lines first
          await supabase
            .from('journal_entry_lines')
            .delete()
            .eq('journal_entry_id', existingJournal.id);
          
          // Delete the journal entry
          await supabase
            .from('journal_entries')
            .delete()
            .eq('id', existingJournal.id);
        }
        
        console.log(`Deleted ${existingOpeningJournals.length} existing opening journal(s) for year ${migrationYear}`);
      }
      
      const journalLines: OpeningJournalLine[] = [];
      
      // === DEBIT ENTRIES (ASET) ===
      
      // Kas
      if (assetData.kas > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.kas.code,
          ACCOUNT_MAPPING.asset.kas.name,
          ACCOUNT_MAPPING.asset.kas.type,
          assetData.kas
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.kas.code,
            accountName: ACCOUNT_MAPPING.asset.kas.name,
            debit: assetData.kas,
            credit: 0,
          });
        }
      }

      // Bank
      if (assetData.bank > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.bank.code,
          ACCOUNT_MAPPING.asset.bank.name,
          ACCOUNT_MAPPING.asset.bank.type,
          assetData.bank
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.bank.code,
            accountName: ACCOUNT_MAPPING.asset.bank.name,
            debit: assetData.bank,
            credit: 0,
          });
        }
      }

      // Piutang Pinjaman Anggota
      if (totalPiutangPinjaman > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.piutangPinjaman.code,
          ACCOUNT_MAPPING.asset.piutangPinjaman.name,
          ACCOUNT_MAPPING.asset.piutangPinjaman.type,
          totalPiutangPinjaman
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.piutangPinjaman.code,
            accountName: ACCOUNT_MAPPING.asset.piutangPinjaman.name,
            debit: totalPiutangPinjaman,
            credit: 0,
          });
        }
      }

      // Persediaan
      if (assetData.persediaan > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.persediaan.code,
          ACCOUNT_MAPPING.asset.persediaan.name,
          ACCOUNT_MAPPING.asset.persediaan.type,
          assetData.persediaan
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.persediaan.code,
            accountName: ACCOUNT_MAPPING.asset.persediaan.name,
            debit: assetData.persediaan,
            credit: 0,
          });
        }
      }

      // Piutang Lainnya
      if (assetData.piutangLainnya > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.piutangLainnya.code,
          ACCOUNT_MAPPING.asset.piutangLainnya.name,
          ACCOUNT_MAPPING.asset.piutangLainnya.type,
          assetData.piutangLainnya
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.piutangLainnya.code,
            accountName: ACCOUNT_MAPPING.asset.piutangLainnya.name,
            debit: assetData.piutangLainnya,
            credit: 0,
          });
        }
      }

      // Biaya Dibayar Dimuka
      if (assetData.biayaDibayarDimuka > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.biayaDibayarDimuka.code,
          ACCOUNT_MAPPING.asset.biayaDibayarDimuka.name,
          ACCOUNT_MAPPING.asset.biayaDibayarDimuka.type,
          assetData.biayaDibayarDimuka
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.biayaDibayarDimuka.code,
            accountName: ACCOUNT_MAPPING.asset.biayaDibayarDimuka.name,
            debit: assetData.biayaDibayarDimuka,
            credit: 0,
          });
        }
      }

      // Aset Tetap - Tanah
      if (assetData.tanah > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.tanah.code,
          ACCOUNT_MAPPING.asset.tanah.name,
          ACCOUNT_MAPPING.asset.tanah.type,
          assetData.tanah
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.tanah.code,
            accountName: ACCOUNT_MAPPING.asset.tanah.name,
            debit: assetData.tanah,
            credit: 0,
          });
        }
      }

      // Bangunan
      if (assetData.bangunan > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.bangunan.code,
          ACCOUNT_MAPPING.asset.bangunan.name,
          ACCOUNT_MAPPING.asset.bangunan.type,
          assetData.bangunan
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.bangunan.code,
            accountName: ACCOUNT_MAPPING.asset.bangunan.name,
            debit: assetData.bangunan,
            credit: 0,
          });
        }
      }

      // Akumulasi Penyusutan Bangunan (Credit - Kontra Akun)
      if (assetData.akumulasiPenyusutanBangunan > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.akumPenyusutanBangunan.code,
          ACCOUNT_MAPPING.asset.akumPenyusutanBangunan.name,
          ACCOUNT_MAPPING.asset.akumPenyusutanBangunan.type,
          -assetData.akumulasiPenyusutanBangunan
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.akumPenyusutanBangunan.code,
            accountName: ACCOUNT_MAPPING.asset.akumPenyusutanBangunan.name,
            debit: 0,
            credit: assetData.akumulasiPenyusutanBangunan,
          });
        }
      }

      // Peralatan Kantor
      if (assetData.peralatanKantor > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.peralatanKantor.code,
          ACCOUNT_MAPPING.asset.peralatanKantor.name,
          ACCOUNT_MAPPING.asset.peralatanKantor.type,
          assetData.peralatanKantor
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.peralatanKantor.code,
            accountName: ACCOUNT_MAPPING.asset.peralatanKantor.name,
            debit: assetData.peralatanKantor,
            credit: 0,
          });
        }
      }

      // Akumulasi Penyusutan Peralatan (Credit - Kontra Akun)
      if (assetData.akumulasiPenyusutanPeralatan > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.akumPenyusutanPeralatan.code,
          ACCOUNT_MAPPING.asset.akumPenyusutanPeralatan.name,
          ACCOUNT_MAPPING.asset.akumPenyusutanPeralatan.type,
          -assetData.akumulasiPenyusutanPeralatan
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.akumPenyusutanPeralatan.code,
            accountName: ACCOUNT_MAPPING.asset.akumPenyusutanPeralatan.name,
            debit: 0,
            credit: assetData.akumulasiPenyusutanPeralatan,
          });
        }
      }

      // Kendaraan
      if (assetData.kendaraan > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.kendaraan.code,
          ACCOUNT_MAPPING.asset.kendaraan.name,
          ACCOUNT_MAPPING.asset.kendaraan.type,
          assetData.kendaraan
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.kendaraan.code,
            accountName: ACCOUNT_MAPPING.asset.kendaraan.name,
            debit: assetData.kendaraan,
            credit: 0,
          });
        }
      }

      // Akumulasi Penyusutan Kendaraan (Credit - Kontra Akun)
      if (assetData.akumulasiPenyusutanKendaraan > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.akumPenyusutanKendaraan.code,
          ACCOUNT_MAPPING.asset.akumPenyusutanKendaraan.name,
          ACCOUNT_MAPPING.asset.akumPenyusutanKendaraan.type,
          -assetData.akumulasiPenyusutanKendaraan
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.akumPenyusutanKendaraan.code,
            accountName: ACCOUNT_MAPPING.asset.akumPenyusutanKendaraan.name,
            debit: 0,
            credit: assetData.akumulasiPenyusutanKendaraan,
          });
        }
      }

      // Aset Lainnya
      if (assetData.asetLainnya > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.asset.asetLainnya.code,
          ACCOUNT_MAPPING.asset.asetLainnya.name,
          ACCOUNT_MAPPING.asset.asetLainnya.type,
          assetData.asetLainnya
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.asset.asetLainnya.code,
            accountName: ACCOUNT_MAPPING.asset.asetLainnya.name,
            debit: assetData.asetLainnya,
            credit: 0,
          });
        }
      }

      // === CREDIT ENTRIES (KEWAJIBAN) ===

      // Hutang Usaha
      if (liabilityData.hutangUsaha > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.liability.hutangUsaha.code,
          ACCOUNT_MAPPING.liability.hutangUsaha.name,
          ACCOUNT_MAPPING.liability.hutangUsaha.type,
          liabilityData.hutangUsaha
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.liability.hutangUsaha.code,
            accountName: ACCOUNT_MAPPING.liability.hutangUsaha.name,
            debit: 0,
            credit: liabilityData.hutangUsaha,
          });
        }
      }

      // Hutang Bunga
      if (liabilityData.hutangBunga > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.liability.hutangBunga.code,
          ACCOUNT_MAPPING.liability.hutangBunga.name,
          ACCOUNT_MAPPING.liability.hutangBunga.type,
          liabilityData.hutangBunga
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.liability.hutangBunga.code,
            accountName: ACCOUNT_MAPPING.liability.hutangBunga.name,
            debit: 0,
            credit: liabilityData.hutangBunga,
          });
        }
      }

      // Hutang Pajak
      if (liabilityData.hutangPajak > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.liability.hutangPajak.code,
          ACCOUNT_MAPPING.liability.hutangPajak.name,
          ACCOUNT_MAPPING.liability.hutangPajak.type,
          liabilityData.hutangPajak
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.liability.hutangPajak.code,
            accountName: ACCOUNT_MAPPING.liability.hutangPajak.name,
            debit: 0,
            credit: liabilityData.hutangPajak,
          });
        }
      }

      // Pendapatan Diterima Dimuka
      if (liabilityData.pendapatanDiterimaDimuka > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.liability.pendapatanDiterimaDimuka.code,
          ACCOUNT_MAPPING.liability.pendapatanDiterimaDimuka.name,
          ACCOUNT_MAPPING.liability.pendapatanDiterimaDimuka.type,
          liabilityData.pendapatanDiterimaDimuka
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.liability.pendapatanDiterimaDimuka.code,
            accountName: ACCOUNT_MAPPING.liability.pendapatanDiterimaDimuka.name,
            debit: 0,
            credit: liabilityData.pendapatanDiterimaDimuka,
          });
        }
      }

      // Pinjaman Bank
      if (liabilityData.pinjamanBank > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.liability.pinjamanBank.code,
          ACCOUNT_MAPPING.liability.pinjamanBank.name,
          ACCOUNT_MAPPING.liability.pinjamanBank.type,
          liabilityData.pinjamanBank
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.liability.pinjamanBank.code,
            accountName: ACCOUNT_MAPPING.liability.pinjamanBank.name,
            debit: 0,
            credit: liabilityData.pinjamanBank,
          });
        }
      }

      // Pinjaman Koperasi Lain
      if (liabilityData.pinjamanKoperasiLain > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.liability.pinjamanKoperasiLain.code,
          ACCOUNT_MAPPING.liability.pinjamanKoperasiLain.name,
          ACCOUNT_MAPPING.liability.pinjamanKoperasiLain.type,
          liabilityData.pinjamanKoperasiLain
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.liability.pinjamanKoperasiLain.code,
            accountName: ACCOUNT_MAPPING.liability.pinjamanKoperasiLain.name,
            debit: 0,
            credit: liabilityData.pinjamanKoperasiLain,
          });
        }
      }

      // Pinjaman dari Anggota
      if (liabilityData.pinjamanAnggota > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.liability.pinjamanAnggota.code,
          ACCOUNT_MAPPING.liability.pinjamanAnggota.name,
          ACCOUNT_MAPPING.liability.pinjamanAnggota.type,
          liabilityData.pinjamanAnggota
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.liability.pinjamanAnggota.code,
            accountName: ACCOUNT_MAPPING.liability.pinjamanAnggota.name,
            debit: 0,
            credit: liabilityData.pinjamanAnggota,
          });
        }
      }

      // === CREDIT ENTRIES (MODAL / EKUITAS) ===

      // Simpanan Pokok
      if (totalSimpananPokok > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.equity.simpananPokok.code,
          ACCOUNT_MAPPING.equity.simpananPokok.name,
          ACCOUNT_MAPPING.equity.simpananPokok.type,
          totalSimpananPokok
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.equity.simpananPokok.code,
            accountName: ACCOUNT_MAPPING.equity.simpananPokok.name,
            debit: 0,
            credit: totalSimpananPokok,
          });
        }
      }

      // Simpanan Wajib
      if (totalSimpananWajib > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.equity.simpananWajib.code,
          ACCOUNT_MAPPING.equity.simpananWajib.name,
          ACCOUNT_MAPPING.equity.simpananWajib.type,
          totalSimpananWajib
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.equity.simpananWajib.code,
            accountName: ACCOUNT_MAPPING.equity.simpananWajib.name,
            debit: 0,
            credit: totalSimpananWajib,
          });
        }
      }

      // Simpanan Sukarela
      if (totalSimpananSukarela > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.equity.simpananSukarela.code,
          ACCOUNT_MAPPING.equity.simpananSukarela.name,
          ACCOUNT_MAPPING.equity.simpananSukarela.type,
          totalSimpananSukarela
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.equity.simpananSukarela.code,
            accountName: ACCOUNT_MAPPING.equity.simpananSukarela.name,
            debit: 0,
            credit: totalSimpananSukarela,
          });
        }
      }

      // Dana Cadangan
      if (equityData.danaCadangan > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.equity.danaCadangan.code,
          ACCOUNT_MAPPING.equity.danaCadangan.name,
          ACCOUNT_MAPPING.equity.danaCadangan.type,
          equityData.danaCadangan
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.equity.danaCadangan.code,
            accountName: ACCOUNT_MAPPING.equity.danaCadangan.name,
            debit: 0,
            credit: equityData.danaCadangan,
          });
        }
      }

      // Dana Pendidikan
      if (equityData.danaPendidikan > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.equity.danaPendidikan.code,
          ACCOUNT_MAPPING.equity.danaPendidikan.name,
          ACCOUNT_MAPPING.equity.danaPendidikan.type,
          equityData.danaPendidikan
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.equity.danaPendidikan.code,
            accountName: ACCOUNT_MAPPING.equity.danaPendidikan.name,
            debit: 0,
            credit: equityData.danaPendidikan,
          });
        }
      }

      // Dana Sosial
      if (equityData.danaSosial > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.equity.danaSosial.code,
          ACCOUNT_MAPPING.equity.danaSosial.name,
          ACCOUNT_MAPPING.equity.danaSosial.type,
          equityData.danaSosial
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.equity.danaSosial.code,
            accountName: ACCOUNT_MAPPING.equity.danaSosial.name,
            debit: 0,
            credit: equityData.danaSosial,
          });
        }
      }

      // Dana Pembangunan
      if (equityData.danaPembangunan > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.equity.danaPembangunan.code,
          ACCOUNT_MAPPING.equity.danaPembangunan.name,
          ACCOUNT_MAPPING.equity.danaPembangunan.type,
          equityData.danaPembangunan
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.equity.danaPembangunan.code,
            accountName: ACCOUNT_MAPPING.equity.danaPembangunan.name,
            debit: 0,
            credit: equityData.danaPembangunan,
          });
        }
      }

      // SHU Tahun Berjalan
      if (equityData.shuTahunBerjalan > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.equity.shuTahunBerjalan.code,
          ACCOUNT_MAPPING.equity.shuTahunBerjalan.name,
          ACCOUNT_MAPPING.equity.shuTahunBerjalan.type,
          equityData.shuTahunBerjalan
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.equity.shuTahunBerjalan.code,
            accountName: ACCOUNT_MAPPING.equity.shuTahunBerjalan.name,
            debit: 0,
            credit: equityData.shuTahunBerjalan,
          });
        }
      }

      // Hibah Donasi
      if (equityData.hibahDonasi > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.equity.hibahDonasi.code,
          ACCOUNT_MAPPING.equity.hibahDonasi.name,
          ACCOUNT_MAPPING.equity.hibahDonasi.type,
          equityData.hibahDonasi
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.equity.hibahDonasi.code,
            accountName: ACCOUNT_MAPPING.equity.hibahDonasi.name,
            debit: 0,
            credit: equityData.hibahDonasi,
          });
        }
      }

      // Modal Penyertaan
      if (equityData.modalPenyertaan > 0) {
        const accountId = await getOrCreateAccount(
          ACCOUNT_MAPPING.equity.modalPenyertaan.code,
          ACCOUNT_MAPPING.equity.modalPenyertaan.name,
          ACCOUNT_MAPPING.equity.modalPenyertaan.type,
          equityData.modalPenyertaan
        );
        if (accountId) {
          journalLines.push({
            accountId,
            accountCode: ACCOUNT_MAPPING.equity.modalPenyertaan.code,
            accountName: ACCOUNT_MAPPING.equity.modalPenyertaan.name,
            debit: 0,
            credit: equityData.modalPenyertaan,
          });
        }
      }

      // Validate balance
      const totalDebit = journalLines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = journalLines.reduce((sum, line) => sum + line.credit, 0);

      if (Math.abs(totalDebit - totalCredit) > 1) {
        console.error('Journal not balanced:', { totalDebit, totalCredit });
        toast.error('Jurnal pembuka tidak seimbang!');
        return false;
      }

      // Generate journal entry number
      const { data: entryNumber } = await supabase.rpc('generate_journal_entry_number');
      const journalEntryNumber = entryNumber || `JRN-OPN-${migrationYear}`;

      // Create journal entry
      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert([{
          entry_number: journalEntryNumber,
          entry_date: `${migrationYear}-01-01`,
          description: `Jurnal Pembuka Tahun ${migrationYear} - Migrasi Data Awal`,
          reference_type: 'opening_balance',
          total_debit: totalDebit,
          total_credit: totalCredit,
          is_balanced: true,
          status: 'posted',
        }])
        .select()
        .single();

      if (journalError) {
        console.error('Error creating opening journal entry:', journalError);
        throw journalError;
      }

      // Create journal entry lines
      const journalEntryLines = journalLines.map(line => ({
        journal_entry_id: journalEntry.id,
        account_id: line.accountId,
        description: `Saldo Awal ${line.accountName}`,
        debit_amount: line.debit,
        credit_amount: line.credit,
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(journalEntryLines);

      if (linesError) {
        console.error('Error creating journal entry lines:', linesError);
        throw linesError;
      }

      console.log('Opening journal entry created successfully:', journalEntry);
      return true;
    } catch (error) {
      console.error('Error creating opening journal entry:', error);
      return false;
    }
  };

  // Save all migration data
  const handleSaveMigration = async () => {
    // Validate balance before saving
    if (!isBalanced) {
      toast.error('Balance Sheet tidak seimbang! Pastikan Total Aktiva = Total Pasiva sebelum menyimpan.');
      return;
    }

    setIsSaving(true);
    try {
      // 0. Create backup before migration
      const backupCreated = await createMigrationBackup(
        migrationYear,
        savingsEntries.map(e => ({
          userId: e.userId,
          simpananPokok: e.simpananPokok,
          simpananWajib: e.simpananWajib,
          simpananSukarela: e.simpananSukarela,
        })),
        loanEntries.map(e => ({
          userId: e.userId,
          principalAmount: e.principalAmount,
          tenor: e.tenor,
          interestRate: e.interestRate,
        }))
      );
      
      if (!backupCreated) {
        toast.warning('Backup gagal dibuat, melanjutkan tanpa backup...');
      }

      // 1. Save equity and asset data to balance_sheets
      const { data: existingSheet } = await supabase
        .from('balance_sheets')
        .select('id')
        .eq('year', migrationYear)
        .maybeSingle();

      const balancePayload = {
        year: migrationYear,
        // Asset data
        kas: assetData.kas,
        bank: assetData.bank,
        piutang: totalPiutangPinjaman,
        barang_dagang: assetData.persediaan,
        total_assets: totalAktiva,
        // Equity data
        hibah_donasi: equityData.hibahDonasi,
        saldo_awal_hibah_donasi: equityData.hibahDonasi,
        modal_pinjaman: totalKewajibanJangkaPanjang,
        saldo_awal_modal_pinjaman: totalKewajibanJangkaPanjang,
        modal_penyertaan: equityData.modalPenyertaan,
        saldo_awal_modal_penyertaan: equityData.modalPenyertaan,
        dana_cadangan: equityData.danaCadangan,
        saldo_awal_dana_cadangan: equityData.danaCadangan,
        dana_pendidikan: equityData.danaPendidikan,
        saldo_awal_dana_pendidikan: equityData.danaPendidikan,
        dana_sosial: equityData.danaSosial,
        saldo_awal_dana_sosial: equityData.danaSosial,
        dana_pembangunan: equityData.danaPembangunan,
        saldo_awal_dana_pembangunan: equityData.danaPembangunan,
        // Savings will be added from totals
        simpanan_pokok: totalSimpananPokok,
        saldo_awal_simpanan_pokok: totalSimpananPokok,
        simpanan_wajib: totalSimpananWajib,
        saldo_awal_simpanan_wajib: totalSimpananWajib,
        simpanan_sukarela: totalSimpananSukarela,
        saldo_awal_simpanan_sukarela: totalSimpananSukarela,
        total_equity: totalModal,
        total_saldo_awal: totalModal,
      };

      if (existingSheet) {
        await supabase.from('balance_sheets').update(balancePayload).eq('year', migrationYear);
      } else {
        await supabase.from('balance_sheets').insert([balancePayload]);
      }

      // 2. Create migration transactions for each member (trigger will update savings_summary)
      const now = new Date().toISOString();
      for (const entry of savingsEntries) {
        const transactions = [];
        
        if (entry.simpananPokok > 0) {
          transactions.push({
            user_id: entry.userId,
            type: 'saldo_awal_pokok' as const,
            amount: entry.simpananPokok,
            status: 'approved' as const,
            payment_method: 'transfer_bank' as const,
            notes: `Saldo awal migrasi tahun ${migrationYear}`,
            approved_at: now,
          });
        }
        
        if (entry.simpananWajib > 0) {
          transactions.push({
            user_id: entry.userId,
            type: 'saldo_awal_wajib' as const,
            amount: entry.simpananWajib,
            status: 'approved' as const,
            payment_method: 'transfer_bank' as const,
            notes: `Saldo awal migrasi tahun ${migrationYear}`,
            approved_at: now,
          });
        }
        
        if (entry.simpananSukarela > 0) {
          transactions.push({
            user_id: entry.userId,
            type: 'saldo_awal_sukarela' as const,
            amount: entry.simpananSukarela,
            status: 'approved' as const,
            payment_method: 'transfer_bank' as const,
            notes: `Saldo awal migrasi tahun ${migrationYear}`,
            approved_at: now,
          });
        }
        
        if (transactions.length > 0) {
          const { error: txError } = await supabase
            .from('transactions')
            .insert(transactions as any);
          
          if (txError) {
            console.error('Error creating migration transactions:', txError);
          }
        }
      }

      // 3. Create loans and installments for each loan entry
      const settings = getCooperativeSettings();
      const dueDaysInterval = settings.installmentDueDaysAfterDisbursement || 30;
      const calculationMethod = settings.interestCalculationMethod || 'flat';
      const installmentDueDay = settings.simpananWajibDueDate || 10; // Gunakan tanggal simpanan wajib sebagai default hari jatuh tempo
      
      // Helper function to create loan migration journal
      const createLoanMigrationJournal = async (
        loanAmount: number,
        memberName: string,
        loanId: string
      ): Promise<string | null> => {
        try {
          // Get journal entry number
          const { data: entryNumber } = await supabase.rpc('generate_journal_entry_number');
          if (!entryNumber) {
            console.error('Failed to generate journal entry number for loan migration');
            return null;
          }

          // Get account IDs from chart_of_accounts
          const { data: accounts } = await supabase
            .from('chart_of_accounts')
            .select('id, account_code, account_type, balance')
            .in('account_code', ['1-2000', '3-9000', '3-0000'])
            .eq('is_active', true);

          const piutangAccount = accounts?.find(a => a.account_code === '1-2000'); // Piutang Pinjaman Anggota
          const migrationAccount = accounts?.find(a => a.account_code === '3-9000') || 
                                   accounts?.find(a => a.account_code === '3-0000'); // Modal Migrasi/Saldo Awal

          if (!piutangAccount || !migrationAccount) {
            console.log('Accounts not found for loan migration journal. Piutang:', !!piutangAccount, 'Migration:', !!migrationAccount);
            return null;
          }

          // Create journal entry for loan migration
          // Jurnal: D. Piutang Pinjaman, K. Modal Migrasi
          const { data: journalEntry, error: journalError } = await supabase
            .from('journal_entries')
            .insert({
              entry_number: entryNumber,
              entry_date: new Date().toISOString().split('T')[0],
              description: `Migrasi saldo awal pinjaman - ${memberName}`,
              total_debit: loanAmount,
              total_credit: loanAmount,
              is_balanced: true,
              status: 'posted',
              reference_type: 'migration',
              reference_id: loanId,
            })
            .select('id, entry_number')
            .single();

          if (journalError || !journalEntry) {
            console.error('Error creating loan migration journal:', journalError);
            return null;
          }

          // Create journal lines
          const { error: linesError } = await supabase.from('journal_entry_lines').insert([
            {
              journal_entry_id: journalEntry.id,
              account_id: piutangAccount.id,
              debit_amount: loanAmount,
              credit_amount: 0,
              description: `Piutang pinjaman - Saldo awal migrasi ${memberName}`,
            },
            {
              journal_entry_id: journalEntry.id,
              account_id: migrationAccount.id,
              debit_amount: 0,
              credit_amount: loanAmount,
              description: `Modal migrasi saldo awal pinjaman - ${memberName}`,
            },
          ]);

          if (linesError) {
            console.error('Error creating loan migration journal lines:', linesError);
            return null;
          }

          // Update Chart of Accounts balances
          // Piutang (Asset): Debit increases
          const piutangCurrentBalance = piutangAccount.balance || 0;
          const piutangNewBalance = piutangCurrentBalance + loanAmount;
          
          await supabase
            .from('chart_of_accounts')
            .update({ balance: piutangNewBalance, updated_at: new Date().toISOString() })
            .eq('id', piutangAccount.id);

          // Modal Migrasi (Equity): Credit increases (but as contra/offset, we decrease)
          const migrationCurrentBalance = migrationAccount.balance || 0;
          const migrationNewBalance = migrationCurrentBalance + loanAmount; // Credit increases equity
          
          await supabase
            .from('chart_of_accounts')
            .update({ balance: migrationNewBalance, updated_at: new Date().toISOString() })
            .eq('id', migrationAccount.id);

          console.log(`Created loan migration journal ${journalEntry.entry_number}: D.Piutang ${loanAmount}, K.Modal Migrasi ${loanAmount}`);
          
          return journalEntry.id;
        } catch (error) {
          console.error('Error in createLoanMigrationJournal:', error);
          return null;
        }
      };

      // Helper function to calculate due date using addMonths for accurate month handling
      const calculateDueDate = (disbursementDate: Date, installmentNumber: number, dueDay: number): Date => {
        // Add months from disbursement date
        const baseDate = addMonths(disbursementDate, installmentNumber);
        
        // Set to the specified due day, handling month-end edge cases
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        
        // Use the due day or the last day of the month if due day exceeds month length
        const actualDueDay = Math.min(dueDay, lastDayOfMonth);
        
        return new Date(year, month, actualDueDay);
      };
      
      for (const loan of loanEntries) {
        if (loan.userId && loan.principalAmount > 0) {
          // Create loan record
          const { data: newLoan, error: loanError } = await supabase
            .from('loans')
            .insert([{
              user_id: loan.userId,
              principal_amount: loan.principalAmount,
              tenor: loan.tenor,
              interest_rate: loan.interestRate,
              status: 'active',
              remaining_principal: loan.remainingPrincipal,
              disbursement_date: loan.disbursementDate,
              application_date: loan.disbursementDate,
              approved_at: new Date().toISOString(),
            }])
            .select()
            .single();

          if (loanError) throw loanError;

          // Create migration transaction and journal for outstanding loan amount (remaining principal)
          if (loan.remainingPrincipal > 0) {
            // Create saldo_awal_pinjaman transaction
            const { data: loanTxData, error: loanTxError } = await supabase.from('transactions').insert([{
              user_id: loan.userId,
              type: 'saldo_awal_pinjaman' as Database['public']['Enums']['transaction_type'],
              amount: loan.remainingPrincipal,
              status: 'approved' as Database['public']['Enums']['transaction_status'],
              payment_method: 'transfer_bank' as Database['public']['Enums']['payment_method'],
              notes: `Saldo awal migrasi pinjaman tahun ${migrationYear}`,
              approved_at: now,
              is_migration: true,
            }]).select('id').single();

            if (!loanTxError && loanTxData) {
              // Create journal entry for loan migration
              const journalId = await createLoanMigrationJournal(
                loan.remainingPrincipal,
                loan.memberName,
                newLoan.id
              );
              
              if (journalId) {
                // Link transaction to journal
                await supabase.from('transactions')
                  .update({ journal_entry_id: journalId })
                  .eq('id', loanTxData.id);
              }
            }
          }

          // Create installments using improved date calculation
          const basePrincipal = Math.floor(loan.principalAmount / loan.tenor / 50000) * 50000;
          const remainder = loan.principalAmount - (basePrincipal * loan.tenor);
          const monthsWithExtra = Math.round(remainder / 50000);
          
          const installments = [];
          const disbursementDate = new Date(loan.disbursementDate);
          let remainingPrincipal = loan.principalAmount;

          for (let i = 1; i <= loan.tenor; i++) {
            // Calculate due date using addMonths for accurate month handling
            const dueDate = calculateDueDate(disbursementDate, i, installmentDueDay);
            
            // Calculate principal for this installment
            const principalThisMonth = i <= monthsWithExtra ? basePrincipal + 50000 : basePrincipal;
            
            // Calculate interest based on method
            let interestAmount: number;
            if (calculationMethod === 'effective') {
              // Effective (declining): interest calculated from remaining principal
              interestAmount = remainingPrincipal * loan.interestRate;
            } else {
              // Flat: interest calculated from original principal amount
              interestAmount = loan.principalAmount * loan.interestRate;
            }
            
            // Determine if this installment is already paid
            const isPaid = i <= loan.paidInstallments;
            
            installments.push({
              loan_id: newLoan.id,
              installment_number: i,
              principal_amount: principalThisMonth,
              interest_amount: interestAmount,
              total_amount: principalThisMonth + interestAmount,
              due_date: format(dueDate, 'yyyy-MM-dd'),
              status: isPaid ? 'paid' : 'pending',
              paid_amount: isPaid ? principalThisMonth + interestAmount : 0,
              paid_date: isPaid ? format(dueDate, 'yyyy-MM-dd') : null,
            });
            
            // Update remaining principal for next iteration
            remainingPrincipal -= principalThisMonth;
          }

          await supabase.from('loan_installments').insert(installments);
        }
      }

      // 4. Create opening journal entry with account mapping (will auto-delete existing duplicates)
      const journalCreated = await createOpeningJournalEntry();
      if (!journalCreated) {
        toast.warning('Data disimpan, tetapi jurnal pembuka gagal dibuat. Periksa Chart of Accounts.');
      } else if (existingOpeningJournals.length > 0) {
        toast.success(`${existingOpeningJournals.length} jurnal pembuka lama dihapus dan diganti dengan jurnal baru.`);
      }
      
      // Reset duplicate warning state
      setExistingOpeningJournals([]);
      setShowDuplicateWarning(false);

      // 5. Save migration history for tracking
      await saveMigrationHistory(migrationYear, 'completed', {
        member_count: savingsEntries.filter(e => e.simpananPokok > 0 || e.simpananWajib > 0 || e.simpananSukarela > 0).length,
        loan_count: loanEntries.filter(e => e.principalAmount > 0).length,
        total_savings: totalSimpananPokok + totalSimpananWajib + totalSimpananSukarela,
        total_loans: loanEntries.reduce((sum, e) => sum + e.principalAmount, 0),
        has_opening_journal: journalCreated,
        has_balance_sheet: true,
        savings_data: savingsEntries.map(e => ({
          user_id: e.userId,
          simpanan_pokok: e.simpananPokok,
          simpanan_wajib: e.simpananWajib,
          simpanan_sukarela: e.simpananSukarela,
        })),
        notes: `Migrasi data tahun ${migrationYear} berhasil`,
      });

      toast.success('Data migrasi dan jurnal pembuka berhasil disimpan!');
      onBack();
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Gagal menyimpan data migrasi');
    } finally {
      setIsSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                <strong>Langkah Persiapan:</strong> Sebelum migrasi data simpanan dan pinjaman, pastikan semua anggota sudah memiliki akun di sistem. 
                Pilih salah satu metode di bawah ini sesuai kondisi koperasi Anda.
              </AlertDescription>
            </Alert>

            <RadioGroup 
              value={memberRegistrationMode} 
              onValueChange={(v: 'bulk' | 'single' | 'matching' | 'skip') => setMemberRegistrationMode(v)}
              className="grid gap-4"
            >
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setMemberRegistrationMode('bulk')}>
                <RadioGroupItem value="bulk" id="bulk" className="mt-1" />
                <Label htmlFor="bulk" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <Upload className="h-4 w-4 text-primary" />
                    Import Anggota Massal (Rekomendasi)
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload file Excel untuk membuat banyak akun anggota sekaligus. Cocok untuk koperasi dengan banyak anggota yang belum memiliki akun digital.
                  </p>
                </Label>
              </div>

              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setMemberRegistrationMode('single')}>
                <RadioGroupItem value="single" id="single" className="mt-1" />
                <Label htmlFor="single" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <UserPlus className="h-4 w-4 text-primary" />
                    Tambah Anggota Satu-Satu
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Buat akun anggota secara manual dengan data lengkap termasuk simpanan awal. Cocok untuk koperasi kecil.
                  </p>
                </Label>
              </div>

              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setMemberRegistrationMode('matching')}>
                <RadioGroupItem value="matching" id="matching" className="mt-1" />
                <Label htmlFor="matching" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <Link className="h-4 w-4 text-primary" />
                    Pencocokan Data Anggota Lama
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload data anggota lama dan cocokkan dengan anggota yang sudah mendaftar sendiri. Simpanan dan pinjaman akan otomatis ditransfer.
                  </p>
                </Label>
              </div>

              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setMemberRegistrationMode('skip')}>
                <RadioGroupItem value="skip" id="skip" className="mt-1" />
                <Label htmlFor="skip" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <SkipForward className="h-4 w-4 text-muted-foreground" />
                    Lewati (Anggota Sudah Terdaftar)
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Langsung ke langkah berikutnya jika semua anggota sudah memiliki akun di sistem.
                  </p>
                </Label>
              </div>
            </RadioGroup>

            {/* Render selected component */}
            {memberRegistrationMode === 'bulk' && (
              <div className="pt-4 border-t">
                <BulkMemberImport />
              </div>
            )}

            {memberRegistrationMode === 'single' && (
              <div className="pt-4 border-t">
                <AdminMemberCreation />
              </div>
            )}

            {memberRegistrationMode === 'matching' && (
              <div className="pt-4 border-t">
                <MigrationDataMatching />
              </div>
            )}

            {memberRegistrationMode === 'skip' && (
              <div className="pt-4 border-t">
                <Alert className="bg-muted">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    Anda memilih untuk melewati langkah ini. Pastikan semua anggota sudah terdaftar di sistem sebelum melanjutkan ke langkah berikutnya.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Masukkan saldo awal Neraca koperasi dari tahun buku sebelumnya sesuai format standar akuntansi. 
                Data ini akan menjadi saldo awal untuk pembukuan tahun {migrationYear}.
              </AlertDescription>
            </Alert>

            <Tabs defaultValue="aktiva" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="aktiva" className="gap-2">
                  <DatabaseIcon className="h-4 w-4" />
                  Aktiva
                </TabsTrigger>
                <TabsTrigger value="kewajiban" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Kewajiban
                </TabsTrigger>
                <TabsTrigger value="modal" className="gap-2">
                  <Shield className="h-4 w-4" />
                  Modal
                </TabsTrigger>
              </TabsList>

              {/* AKTIVA (Aset) */}
              <TabsContent value="aktiva" className="space-y-6 mt-4">
                {/* Aset Lancar */}
                <div>
                  <h4 className="text-base font-semibold mb-3 flex items-center gap-2 text-blue-600">
                    <Wallet className="h-4 w-4" />
                    Aset Lancar
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Kas</Label>
                      <CurrencyInput
                        value={assetData.kas}
                        onChange={(v) => setAssetData({ ...assetData, kas: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Uang tunai di tangan</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Bank</Label>
                      <CurrencyInput
                        value={assetData.bank}
                        onChange={(v) => setAssetData({ ...assetData, bank: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Saldo rekening bank</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Persediaan / Barang Dagangan</Label>
                      <CurrencyInput
                        value={assetData.persediaan}
                        onChange={(v) => setAssetData({ ...assetData, persediaan: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Stok barang unit usaha</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Piutang Lainnya</Label>
                      <CurrencyInput
                        value={assetData.piutangLainnya}
                        onChange={(v) => setAssetData({ ...assetData, piutangLainnya: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Selain piutang pinjaman anggota</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Biaya Dibayar Dimuka</Label>
                      <CurrencyInput
                        value={assetData.biayaDibayarDimuka}
                        onChange={(v) => setAssetData({ ...assetData, biayaDibayarDimuka: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Sewa, asuransi dibayar dimuka</p>
                    </div>
                  </div>
                  <Card className="mt-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="py-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-blue-700 dark:text-blue-300">Total Aset Lancar</span>
                        <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                          {formatCurrency(totalAsetLancar)}
                        </span>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Termasuk piutang pinjaman anggota Rp {formatCurrency(totalPiutangPinjaman).replace('Rp ', '')} dari langkah 3
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Aset Tetap */}
                <div>
                  <h4 className="text-base font-semibold mb-3 flex items-center gap-2 text-purple-600">
                    <Building2 className="h-4 w-4" />
                    Aset Tetap
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tanah</Label>
                      <CurrencyInput
                        value={assetData.tanah}
                        onChange={(v) => setAssetData({ ...assetData, tanah: v })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bangunan (Harga Perolehan)</Label>
                      <CurrencyInput
                        value={assetData.bangunan}
                        onChange={(v) => setAssetData({ ...assetData, bangunan: v })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Akum. Penyusutan Bangunan</Label>
                      <CurrencyInput
                        value={assetData.akumulasiPenyusutanBangunan}
                        onChange={(v) => setAssetData({ ...assetData, akumulasiPenyusutanBangunan: v })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Peralatan Kantor (Harga Perolehan)</Label>
                      <CurrencyInput
                        value={assetData.peralatanKantor}
                        onChange={(v) => setAssetData({ ...assetData, peralatanKantor: v })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Akum. Penyusutan Peralatan</Label>
                      <CurrencyInput
                        value={assetData.akumulasiPenyusutanPeralatan}
                        onChange={(v) => setAssetData({ ...assetData, akumulasiPenyusutanPeralatan: v })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kendaraan (Harga Perolehan)</Label>
                      <CurrencyInput
                        value={assetData.kendaraan}
                        onChange={(v) => setAssetData({ ...assetData, kendaraan: v })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Akum. Penyusutan Kendaraan</Label>
                      <CurrencyInput
                        value={assetData.akumulasiPenyusutanKendaraan}
                        onChange={(v) => setAssetData({ ...assetData, akumulasiPenyusutanKendaraan: v })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <Card className="mt-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                    <CardContent className="py-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-purple-700 dark:text-purple-300">Nilai Buku Aset Tetap</span>
                        <span className="text-lg font-bold text-purple-700 dark:text-purple-300">
                          {formatCurrency(nilaiAsetTetapBersih)}
                        </span>
                      </div>
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        Harga Perolehan {formatCurrency(nilaiAsetTetapBruto).replace('Rp ', '')} - Akum. Penyusutan {formatCurrency(totalAkumulasiPenyusutan).replace('Rp ', '')}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Aset Lainnya */}
                <div>
                  <h4 className="text-base font-semibold mb-3 flex items-center gap-2 text-gray-600">
                    <FileSpreadsheet className="h-4 w-4" />
                    Aset Lainnya
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Aset Lainnya</Label>
                      <CurrencyInput
                        value={assetData.asetLainnya}
                        onChange={(v) => setAssetData({ ...assetData, asetLainnya: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Deposito, investasi jangka panjang, dll</p>
                    </div>
                  </div>
                </div>

                {/* Total Aktiva */}
                <Card className="bg-primary/10 border-primary/30">
                  <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">TOTAL AKTIVA</span>
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(totalAktiva)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* KEWAJIBAN */}
              <TabsContent value="kewajiban" className="space-y-6 mt-4">
                {/* Kewajiban Jangka Pendek */}
                <div>
                  <h4 className="text-base font-semibold mb-3 flex items-center gap-2 text-orange-600">
                    <CreditCard className="h-4 w-4" />
                    Kewajiban Jangka Pendek
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Hutang Usaha</Label>
                      <CurrencyInput
                        value={liabilityData.hutangUsaha}
                        onChange={(v) => setLiabilityData({ ...liabilityData, hutangUsaha: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Hutang kepada supplier</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Hutang Bunga</Label>
                      <CurrencyInput
                        value={liabilityData.hutangBunga}
                        onChange={(v) => setLiabilityData({ ...liabilityData, hutangBunga: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Bunga yang masih harus dibayar</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Hutang Pajak</Label>
                      <CurrencyInput
                        value={liabilityData.hutangPajak}
                        onChange={(v) => setLiabilityData({ ...liabilityData, hutangPajak: v })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pendapatan Diterima Dimuka</Label>
                      <CurrencyInput
                        value={liabilityData.pendapatanDiterimaDimuka}
                        onChange={(v) => setLiabilityData({ ...liabilityData, pendapatanDiterimaDimuka: v })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <Card className="mt-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                    <CardContent className="py-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-orange-700 dark:text-orange-300">Total Kewajiban Jangka Pendek</span>
                        <span className="text-lg font-bold text-orange-700 dark:text-orange-300">
                          {formatCurrency(totalKewajibanJangkaPendek)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Kewajiban Jangka Panjang */}
                <div>
                  <h4 className="text-base font-semibold mb-3 flex items-center gap-2 text-red-600">
                    <CreditCard className="h-4 w-4" />
                    Kewajiban Jangka Panjang
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Pinjaman Bank</Label>
                      <CurrencyInput
                        value={liabilityData.pinjamanBank}
                        onChange={(v) => setLiabilityData({ ...liabilityData, pinjamanBank: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Kredit dari bank/lembaga keuangan</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Pinjaman Koperasi Lain</Label>
                      <CurrencyInput
                        value={liabilityData.pinjamanKoperasiLain}
                        onChange={(v) => setLiabilityData({ ...liabilityData, pinjamanKoperasiLain: v })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pinjaman dari Anggota</Label>
                      <CurrencyInput
                        value={liabilityData.pinjamanAnggota}
                        onChange={(v) => setLiabilityData({ ...liabilityData, pinjamanAnggota: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Titipan/pinjaman dari anggota kepada koperasi</p>
                    </div>
                  </div>
                  <Card className="mt-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                    <CardContent className="py-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-red-700 dark:text-red-300">Total Kewajiban Jangka Panjang</span>
                        <span className="text-lg font-bold text-red-700 dark:text-red-300">
                          {formatCurrency(totalKewajibanJangkaPanjang)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Total Kewajiban */}
                <Card className="bg-destructive/10 border-destructive/30">
                  <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">TOTAL KEWAJIBAN</span>
                      <span className="text-2xl font-bold text-destructive">
                        {formatCurrency(totalKewajiban)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* MODAL */}
              <TabsContent value="modal" className="space-y-6 mt-4">
                {/* Dana Alokasi */}
                <div>
                  <h4 className="text-base font-semibold mb-3 flex items-center gap-2 text-amber-600">
                    <Shield className="h-4 w-4" />
                    Dana-Dana Alokasi SHU
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Dana Cadangan</Label>
                      <CurrencyInput
                        value={equityData.danaCadangan}
                        onChange={(v) => setEquityData({ ...equityData, danaCadangan: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Akumulasi dari alokasi SHU tahun-tahun sebelumnya</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Dana Pendidikan</Label>
                      <CurrencyInput
                        value={equityData.danaPendidikan}
                        onChange={(v) => setEquityData({ ...equityData, danaPendidikan: v })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Dana Sosial</Label>
                      <CurrencyInput
                        value={equityData.danaSosial}
                        onChange={(v) => setEquityData({ ...equityData, danaSosial: v })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Dana Pembangunan</Label>
                      <CurrencyInput
                        value={equityData.danaPembangunan}
                        onChange={(v) => setEquityData({ ...equityData, danaPembangunan: v })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Modal Lainnya */}
                <div>
                  <h4 className="text-base font-semibold mb-3 flex items-center gap-2 text-green-600">
                    <Users className="h-4 w-4" />
                    Modal Lainnya
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Hibah / Donasi</Label>
                      <CurrencyInput
                        value={equityData.hibahDonasi}
                        onChange={(v) => setEquityData({ ...equityData, hibahDonasi: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Hibah atau donasi yang diterima</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Modal Penyertaan</Label>
                      <CurrencyInput
                        value={equityData.modalPenyertaan}
                        onChange={(v) => setEquityData({ ...equityData, modalPenyertaan: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Modal dari pihak luar</p>
                    </div>
                    <div className="space-y-2">
                      <Label>SHU Tahun Berjalan</Label>
                      <CurrencyInput
                        value={equityData.shuTahunBerjalan}
                        onChange={(v) => setEquityData({ ...equityData, shuTahunBerjalan: v })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Laba/rugi yang belum dibagi</p>
                    </div>
                  </div>
                </div>

                {/* Info Simpanan */}
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    <strong>Catatan:</strong> Simpanan Pokok, Simpanan Wajib, dan Simpanan Sukarela akan diinput 
                    per anggota di Langkah 2 dan otomatis dijumlahkan ke Total Modal.
                  </AlertDescription>
                </Alert>

                {/* Total Modal */}
                <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CardContent className="py-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span>Simpanan Anggota (dari Langkah 2)</span>
                        <span className="font-medium">{formatCurrency(totalSimpanan)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span>Dana Alokasi (Cadangan, Pendidikan, Sosial, Pembangunan)</span>
                        <span className="font-medium">{formatCurrency(totalDanaAlokasi)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span>Modal Lainnya (Hibah, Modal Penyertaan, SHU)</span>
                        <span className="font-medium">{formatCurrency(totalModalLainnya + equityData.shuTahunBerjalan)}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-green-700 dark:text-green-300">TOTAL MODAL</span>
                        <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                          {formatCurrency(totalModal)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Total Pasiva */}
                <Card className="bg-primary/10 border-primary/30">
                  <CardContent className="py-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span>Total Kewajiban</span>
                        <span className="font-medium">{formatCurrency(totalKewajiban)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span>Total Modal</span>
                        <span className="font-medium">{formatCurrency(totalModal)}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">TOTAL PASIVA</span>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(totalPasiva)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Balance Status Preview */}
            <Card className={isBalanced ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800' : 'bg-destructive/10 border-destructive/30'}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isBalanced ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    <div>
                      <p className="font-medium">Status Neraca</p>
                      <p className="text-sm text-muted-foreground">
                        Aktiva {formatCurrency(totalAktiva)} | Pasiva {formatCurrency(totalPasiva)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {isBalanced ? (
                      <Badge className="bg-green-600">SEIMBANG</Badge>
                    ) : (
                      <div>
                        <Badge variant="destructive">TIDAK SEIMBANG</Badge>
                        <p className="text-xs text-destructive mt-1">Selisih: {formatCurrency(Math.abs(balanceDifference))}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Opening Journal Manager */}
            <Separator className="my-6" />
            <OpeningJournalManager migrationYear={migrationYear} />

            {/* Migration History */}
            <Separator className="my-6" />
            <MigrationHistory />

            {/* Migration Rollback */}
            <Separator className="my-6" />
            <MigrationRollback 
              migrationYear={migrationYear} 
              onRollbackComplete={() => {
                // Refresh data after rollback
                toast.success('Rollback selesai. Memuat ulang data...');
                window.location.reload();
              }}
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Masukkan saldo simpanan masing-masing anggota dari tahun buku sebelumnya.
                Data simpanan akan terupdate otomatis setelah disimpan.
              </AlertDescription>
            </Alert>

            {/* Re-migration Warning */}
            {showReMigrationWarning && existingMigrationTransactions.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">
                      Perhatian: Sudah ada {existingMigrationTransactions.length} anggota yang memiliki data saldo awal migrasi!
                    </p>
                    <p className="text-sm">
                      Jika Anda melanjutkan, data simpanan baru akan ditambahkan ke saldo yang sudah ada.
                      Gunakan fitur "Koreksi Saldo Migrasi" untuk mengedit saldo individual.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setShowReMigrationWarning(false)}
                      >
                        Lanjutkan Tetap
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Migration Saldo Correction Card */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    <span>Koreksi Saldo Migrasi Individual</span>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <MigrationSaldoCorrection />
              </CollapsibleContent>
            </Collapsible>

            {/* Individual Loan Migration Card */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span>Tambah Pinjaman Migrasi Individual</span>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <IndividualLoanMigration />
              </CollapsibleContent>
            </Collapsible>

            {/* Business Unit Migration Card */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>Migrasi Transaksi Unit Usaha</span>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <BusinessUnitMigration onBack={() => {}} />
              </CollapsibleContent>
            </Collapsible>

            {/* Enhanced Savings Migration with Journal Card */}
            <Card className="border-dashed border-primary/50 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Migrasi Simpanan Kolektif via Excel</p>
                      <p className="text-sm text-muted-foreground">
                        Import simpanan dengan jurnal otomatis per anggota atau agregat
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setShowSavingsMigration(true)} className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    Buka Migrasi Simpanan
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Drag & Drop Import Zone */}
            <ExcelDropZone
              onFileSelect={handleSavingsImport}
              onDownloadTemplate={downloadSavingsTemplate}
              title="Import Data Simpanan Anggota"
              description="Drag & drop file Excel atau klik untuk memilih file"
              disabled={isLoading}
            />

            {/* Import Error Display */}
            <ImportErrorDisplay type="savings" />

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="rounded-lg border overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="min-w-[200px]">Nama Anggota</TableHead>
                        <TableHead className="text-right min-w-[140px]">Simpanan Pokok</TableHead>
                        <TableHead className="text-right min-w-[140px]">Simpanan Wajib</TableHead>
                        <TableHead className="text-right min-w-[140px]">Simpanan Sukarela</TableHead>
                        <TableHead className="text-right min-w-[140px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savingsEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{entry.memberName}</p>
                              <p className="text-xs text-muted-foreground">{entry.memberNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <CurrencyInput
                              value={entry.simpananPokok}
                              onChange={(v) => updateSavingsEntry(entry.id, 'simpananPokok', v)}
                              className="text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <CurrencyInput
                              value={entry.simpananWajib}
                              onChange={(v) => updateSavingsEntry(entry.id, 'simpananWajib', v)}
                              className="text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <CurrencyInput
                              value={entry.simpananSukarela}
                              onChange={(v) => updateSavingsEntry(entry.id, 'simpananSukarela', v)}
                              className="text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(entry.simpananPokok + entry.simpananWajib + entry.simpananSukarela)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="py-4">
                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Simpanan Pokok</p>
                        <p className="font-bold">{formatCurrency(totalSimpananPokok)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Simpanan Wajib</p>
                        <p className="font-bold">{formatCurrency(totalSimpananWajib)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Simpanan Sukarela</p>
                        <p className="font-bold">{formatCurrency(totalSimpananSukarela)}</p>
                      </div>
                      <div className="text-center border-l">
                        <p className="text-sm text-muted-foreground">Total Simpanan</p>
                        <p className="text-lg font-bold text-primary">{formatCurrency(totalSimpanan)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Masukkan data pinjaman aktif anggota. Tentukan berapa angsuran yang sudah dibayar
                untuk melanjutkan pembayaran angsuran berikutnya.
              </AlertDescription>
            </Alert>

            {/* Drag & Drop Import Zone */}
            <ExcelDropZone
              onFileSelect={handleLoansImport}
              onDownloadTemplate={downloadLoansTemplate}
              title="Import Data Pinjaman Anggota"
              description="Drag & drop file Excel atau klik untuk memilih file"
            />

            {/* Import Error Display */}
            <ImportErrorDisplay type="loans" />

            <div className="flex justify-end">
              <Button onClick={addLoanEntry} variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Tambah Pinjaman Manual
              </Button>
            </div>

            {loanEntries.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <CreditCard className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">Belum ada data pinjaman</p>
                  <p className="text-sm text-muted-foreground">Import dari Excel atau klik "Tambah Pinjaman Manual" untuk menambahkan data pinjaman aktif</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {loanEntries.map((loan, index) => (
                  <Card key={loan.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Pinjaman #{index + 1}</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeLoanEntry(loan.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Anggota</Label>
                        <Select
                          value={loan.userId}
                          onValueChange={(v) => updateLoanEntry(loan.id, 'userId', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih anggota" />
                          </SelectTrigger>
                          <SelectContent>
                            {members.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name} ({m.memberNumber})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Pokok Pinjaman</Label>
                        <CurrencyInput
                          value={loan.principalAmount}
                          onChange={(v) => updateLoanEntry(loan.id, 'principalAmount', v)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Tanggal Pencairan</Label>
                        <Input
                          type="date"
                          value={loan.disbursementDate}
                          onChange={(e) => updateLoanEntry(loan.id, 'disbursementDate', e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Tenor (bulan)</Label>
                        <Input
                          type="number"
                          value={loan.tenor}
                          onChange={(e) => updateLoanEntry(loan.id, 'tenor', Number(e.target.value))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Bunga per bulan (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={loan.interestRate * 100}
                          onChange={(e) => updateLoanEntry(loan.id, 'interestRate', Number(e.target.value) / 100)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Sudah dibayar (angsuran ke-)</Label>
                        <Input
                          type="number"
                          min="0"
                          max={loan.tenor}
                          value={loan.paidInstallments}
                          onChange={(e) => updateLoanEntry(loan.id, 'paidInstallments', Number(e.target.value))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Sisa Pokok</Label>
                        <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50">
                          <span className="font-medium">{formatCurrency(loan.remainingPrincipal)}</span>
                        </div>
                      </div>
                      
                      {/* Installment Schedule Preview */}
                      {loan.principalAmount > 0 && loan.tenor > 0 && loan.disbursementDate && (
                        <div className="md:col-span-3">
                          <InstallmentSchedulePreview loan={loan} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Piutang Pinjaman</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(totalPiutangPinjaman)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Installment Migration with Journal Card */}
            <Card className="border-dashed border-primary/50 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Migrasi Detail Angsuran via Excel</p>
                      <p className="text-sm text-muted-foreground">
                        Import riwayat pembayaran angsuran dengan jurnal otomatis
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setShowInstallmentMigration(true)} className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    Buka Migrasi Angsuran
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            {!isBalanced && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Balance Sheet tidak seimbang!</strong> Total Aktiva ({formatCurrency(totalAktiva)}) 
                  tidak sama dengan Total Pasiva ({formatCurrency(totalPasiva)}). 
                  Selisih: {formatCurrency(Math.abs(balanceDifference))} 
                  ({balanceDifference > 0 ? 'Aktiva lebih besar' : 'Pasiva lebih besar'}).
                  <br />
                  <span className="text-sm">Pastikan data Kas, Bank, Piutang, dan Modal sudah benar sebelum menyimpan.</span>
                </AlertDescription>
              </Alert>
            )}

            {isBalanced && (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <strong>Balance Sheet seimbang!</strong> Data migrasi siap disimpan.
                  Data akan menjadi saldo awal pembukuan tahun {migrationYear}.
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Ringkasan Data Migrasi</CardTitle>
                <CardDescription>Tahun Buku: {migrationYear}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Balance Sheet Comparison */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* AKTIVA */}
                  <Card className={`${isBalanced ? 'border-green-300 dark:border-green-700' : 'border-destructive'}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <DatabaseIcon className="h-4 w-4 text-blue-500" />
                        AKTIVA (Aset)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between py-1">
                        <span>Kas</span>
                        <span className="font-medium">{formatCurrency(assetData.kas)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Bank</span>
                        <span className="font-medium">{formatCurrency(assetData.bank)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Piutang Pinjaman</span>
                        <span className="font-medium">{formatCurrency(totalPiutangPinjaman)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between py-1 font-bold text-base">
                        <span>Total Aktiva</span>
                        <span className={isBalanced ? 'text-green-600' : 'text-destructive'}>{formatCurrency(totalAktiva)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* PASIVA */}
                  <Card className={`${isBalanced ? 'border-green-300 dark:border-green-700' : 'border-destructive'}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4 text-amber-500" />
                        PASIVA (Modal)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between py-1 text-muted-foreground">
                        <span className="font-medium">Kewajiban</span>
                        <span></span>
                      </div>
                      <div className="flex justify-between py-1 pl-2">
                        <span>Total Kewajiban</span>
                        <span className="font-medium">{formatCurrency(totalKewajiban)}</span>
                      </div>
                      <div className="flex justify-between py-1 text-muted-foreground mt-2">
                        <span className="font-medium">Modal Sendiri</span>
                        <span></span>
                      </div>
                      <div className="flex justify-between py-1 pl-2">
                        <span>Total Simpanan</span>
                        <span className="font-medium">{formatCurrency(totalSimpanan)}</span>
                      </div>
                      <div className="flex justify-between py-1 pl-2">
                        <span>Dana Cadangan</span>
                        <span className="font-medium">{formatCurrency(equityData.danaCadangan)}</span>
                      </div>
                      <div className="flex justify-between py-1 pl-2">
                        <span>Dana Alokasi Lainnya</span>
                        <span className="font-medium">{formatCurrency(equityData.danaPendidikan + equityData.danaSosial + equityData.danaPembangunan)}</span>
                      </div>
                      <div className="flex justify-between py-1 pl-2">
                        <span>Hibah/Donasi</span>
                        <span className="font-medium">{formatCurrency(equityData.hibahDonasi)}</span>
                      </div>
                      <div className="flex justify-between py-1 pl-2">
                        <span>Modal Penyertaan</span>
                        <span className="font-medium">{formatCurrency(equityData.modalPenyertaan)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between py-1 font-bold text-base">
                        <span>Total Pasiva</span>
                        <span className={isBalanced ? 'text-green-600' : 'text-destructive'}>{formatCurrency(totalPasiva)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Balance Status */}
                <div className={`p-4 rounded-lg ${isBalanced ? 'bg-green-100 dark:bg-green-900/30' : 'bg-destructive/10'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold">Status Balance Sheet</span>
                    {isBalanced ? (
                      <Badge className="bg-green-600 hover:bg-green-700">
                        <Check className="h-3 w-3 mr-1" />
                        SEIMBANG
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        TIDAK SEIMBANG
                      </Badge>
                    )}
                  </div>
                  {!isBalanced && (
                    <p className="text-sm mt-2 text-muted-foreground">
                      Selisih: <strong className="text-destructive">{formatCurrency(Math.abs(balanceDifference))}</strong>
                      {balanceDifference > 0 
                        ? ' (Aktiva > Pasiva - tambah modal atau kurangi kas/bank)' 
                        : ' (Pasiva > Aktiva - tambah kas/bank atau kurangi modal)'}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Savings Detail Summary */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Detail Simpanan Anggota
                  </h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between py-1">
                      <span>Total Simpanan Pokok</span>
                      <span className="font-medium">{formatCurrency(totalSimpananPokok)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Total Simpanan Wajib</span>
                      <span className="font-medium">{formatCurrency(totalSimpananWajib)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Total Simpanan Sukarela</span>
                      <span className="font-medium">{formatCurrency(totalSimpananSukarela)}</span>
                    </div>
                    <div className="flex justify-between py-1 font-bold border-t pt-2">
                      <span>Total Semua Simpanan</span>
                      <span className="text-primary">{formatCurrency(totalSimpanan)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Loans Summary */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Pinjaman Aktif
                  </h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between py-1">
                      <span>Jumlah Pinjaman</span>
                      <span className="font-medium">{loanEntries.length} pinjaman</span>
                    </div>
                    <div className="flex justify-between py-1 font-bold">
                      <span>Total Piutang (Sisa Pokok)</span>
                      <span className="text-primary">{formatCurrency(totalPiutangPinjaman)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Opening Journal Entry Preview */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-amber-600" />
                    Preview Jurnal Pembuka
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Jurnal umum berikut akan dibuat otomatis saat data migrasi disimpan untuk mencatat saldo awal tahun buku {migrationYear}.
                  </p>
                  
                  <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Nomor Jurnal</p>
                          <p className="font-semibold">JU-{migrationYear}-00001 (Saldo Awal)</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-muted-foreground">Tanggal</p>
                          <p className="font-semibold">1 Januari {migrationYear}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border bg-background overflow-auto max-h-[350px]">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                              <TableHead className="w-[100px]">Kode Akun</TableHead>
                              <TableHead>Nama Akun</TableHead>
                              <TableHead className="text-right w-[140px]">Debit</TableHead>
                              <TableHead className="text-right w-[140px]">Kredit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {journalPreviewLines.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                  Tidak ada data untuk membuat jurnal. Silakan lengkapi data di langkah sebelumnya.
                                </TableCell>
                              </TableRow>
                            ) : (
                              journalPreviewLines.map((line, index) => (
                                <TableRow key={index} className={line.debit > 0 ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-green-50/50 dark:bg-green-900/10'}>
                                  <TableCell className="font-mono text-sm">{line.accountCode}</TableCell>
                                  <TableCell>
                                    <span className={line.credit > 0 ? 'pl-4' : ''}>{line.accountName}</span>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Journal Totals */}
                      <div className="mt-4 p-3 rounded-lg bg-muted/50 grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Total Debit</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(totalDebit)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Total Kredit</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(totalCredit)}
                          </p>
                        </div>
                      </div>

                      {/* Balance Check */}
                      <div className={`mt-3 p-3 rounded-lg flex items-center justify-between ${
                        Math.abs(totalDebit - totalCredit) < 1 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        <div className="flex items-center gap-2">
                          {Math.abs(totalDebit - totalCredit) < 1 ? (
                            <>
                              <Check className="h-4 w-4" />
                              <span className="font-medium">Jurnal seimbang (Debit = Kredit)</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4" />
                              <span className="font-medium">Jurnal tidak seimbang</span>
                            </>
                          )}
                        </div>
                        {Math.abs(totalDebit - totalCredit) >= 1 && (
                          <span className="text-sm">
                            Selisih: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  // Render sub-migration views
  if (showInstallmentMigration) {
    return <InstallmentMigration onBack={() => setShowInstallmentMigration(false)} />;
  }

  if (showSavingsMigration) {
    return <SavingsMigrationEnhanced onBack={() => setShowSavingsMigration(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <DatabaseIcon className="h-6 w-6 text-primary" />
              Migrasi Data Awal
            </h1>
            <p className="text-sm text-muted-foreground">
              Input data historis untuk memulai pembukuan
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Label>Tahun Buku:</Label>
          <Select value={String(migrationYear)} onValueChange={(v) => handleMigrationYearChange(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Duplicate Opening Journal Warning */}
      {showDuplicateWarning && existingOpeningJournals.length > 0 && (
        <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <div className="font-medium mb-2">
              Ditemukan {existingOpeningJournals.length} jurnal pembuka untuk tahun {migrationYear}:
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm mb-3">
              {existingOpeningJournals.map((journal) => (
                <li key={journal.id}>
                  {journal.entry_number} - {format(new Date(journal.entry_date), 'dd MMM yyyy', { locale: id })} 
                  ({formatCurrency(journal.total_debit)})
                </li>
              ))}
            </ul>
            <p className="text-sm">
              Jika Anda melanjutkan migrasi, jurnal pembuka yang ada akan <strong>dihapus</strong> dan digantikan dengan jurnal baru.
              Atau Anda dapat mengelola jurnal yang ada di bagian "Kelola Jurnal Pembuka" di Step 1.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div 
                  key={step.id} 
                  className={`flex items-center gap-2 ${
                    isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                  }`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    isActive ? 'bg-primary text-primary-foreground' : 
                    isCompleted ? 'bg-green-600 text-white' : 'bg-muted'
                  }`}>
                    {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium">{step.title}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => {
              const step = STEPS.find(s => s.id === currentStep);
              const Icon = step?.icon || DatabaseIcon;
              return <Icon className="h-5 w-5 text-primary" />;
            })()}
            {STEPS.find(s => s.id === currentStep)?.title}
          </CardTitle>
          <CardDescription>
            {STEPS.find(s => s.id === currentStep)?.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Sebelumnya
        </Button>
        
        {currentStep < STEPS.length - 1 ? (
          <Button 
            onClick={() => {
              if (currentStep === 0 && members.length === 0) {
                toast.error('Minimal 1 anggota harus terdaftar sebelum melanjutkan ke langkah berikutnya');
                return;
              }
              setCurrentStep(currentStep + 1);
            }}
          >
            {currentStep === 0 ? 'Lanjut ke Data Keuangan' : 'Selanjutnya'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button 
            onClick={handleSaveMigration} 
            disabled={isSaving || !isBalanced} 
            className="gap-2"
            variant={isBalanced ? "default" : "destructive"}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : !isBalanced ? (
              <>
                <AlertCircle className="h-4 w-4" />
                Balance Tidak Seimbang
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Simpan Data Migrasi
              </>
            )}
          </Button>
        )}
      </div>

      {/* Excel Preview Dialog */}
      {previewDialog && (
        <ExcelPreviewDialog
          open={previewDialog.open}
          onOpenChange={(open) => !open && setPreviewDialog(null)}
          title={previewDialog.type === 'savings' ? 'Preview Data Simpanan' : 'Preview Data Pinjaman'}
          description={previewDialog.type === 'savings' 
            ? 'Verifikasi data simpanan anggota sebelum import ke sistem'
            : 'Verifikasi data pinjaman anggota sebelum import ke sistem'
          }
          data={previewDialog.data}
          columns={previewDialog.columns}
          validRowCount={previewDialog.validRowCount}
          invalidRowCount={previewDialog.invalidRowCount}
          warningRowCount={previewDialog.warningRowCount}
          errors={previewDialog.errors}
          warnings={previewDialog.warnings}
          onConfirm={handlePreviewConfirm}
          onCancel={handlePreviewCancel}
        />
      )}
    </div>
  );
};