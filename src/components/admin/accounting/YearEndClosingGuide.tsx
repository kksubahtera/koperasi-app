import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  FileText, 
  AlertTriangle,
  Info,
  ArrowRight,
  Banknote,
  Users,
  TrendingUp,
  Building2,
  RefreshCw,
  BookOpen,
  Lightbulb,
  Scale,
  CreditCard
} from 'lucide-react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';

interface ChecklistItem {
  id: string;
  labelId: string;
  labelEn: string;
  descriptionId: string;
  descriptionEn: string;
}

const checklistItems: ChecklistItem[] = [
  {
    id: 'transactions',
    labelId: 'Semua transaksi Desember sudah diinput',
    labelEn: 'All December transactions have been entered',
    descriptionId: 'Pastikan setoran, penarikan, dan angsuran sudah dicatat',
    descriptionEn: 'Ensure deposits, withdrawals, and installments are recorded'
  },
  {
    id: 'reconciliation',
    labelId: 'Rekonsiliasi bank sudah dilakukan',
    labelEn: 'Bank reconciliation has been completed',
    descriptionId: 'Saldo buku harus sama dengan saldo rekening bank',
    descriptionEn: 'Book balance must match bank account balance'
  },
  {
    id: 'pending',
    labelId: 'Tidak ada transaksi pending',
    labelEn: 'No pending transactions',
    descriptionId: 'Semua transaksi harus sudah diverifikasi/disetujui',
    descriptionEn: 'All transactions must be verified/approved'
  },
  {
    id: 'journal',
    labelId: 'Jurnal sudah seimbang',
    labelEn: 'Journals are balanced',
    descriptionId: 'Total debit = Total kredit di semua jurnal',
    descriptionEn: 'Total debit = Total credit in all journals'
  },
  {
    id: 'backup',
    labelId: 'Backup data sudah dibuat',
    labelEn: 'Data backup has been created',
    descriptionId: 'Simpan backup sebelum tutup buku',
    descriptionEn: 'Save backup before closing'
  },
  {
    id: 'overdue',
    labelId: 'Daftar tunggakan sudah diverifikasi',
    labelEn: 'Overdue list has been verified',
    descriptionId: 'Identifikasi anggota dengan tunggakan untuk penahan SHU',
    descriptionEn: 'Identify members with arrears for SHU withholding'
  }
];

interface DataRolloverItem {
  nameId: string;
  nameEn: string;
  descriptionId: string;
  descriptionEn: string;
  icon: React.ReactNode;
  rolledOver: boolean;
}

const dataRolloverItems: DataRolloverItem[] = [
  {
    nameId: 'Dana Cadangan',
    nameEn: 'Reserve Fund',
    descriptionId: 'Saldo akhir tahun menjadi saldo awal tahun baru',
    descriptionEn: 'End-of-year balance becomes opening balance for new year',
    icon: <Banknote className="h-4 w-4 text-green-500" />,
    rolledOver: true
  },
  {
    nameId: 'Dana Pendidikan',
    nameEn: 'Education Fund',
    descriptionId: 'Akumulasi dari alokasi SHU tahunan',
    descriptionEn: 'Accumulated from annual SHU allocation',
    icon: <BookOpen className="h-4 w-4 text-blue-500" />,
    rolledOver: true
  },
  {
    nameId: 'Dana Sosial',
    nameEn: 'Social Fund',
    descriptionId: 'Untuk program sosial anggota',
    descriptionEn: 'For member social programs',
    icon: <Users className="h-4 w-4 text-purple-500" />,
    rolledOver: true
  },
  {
    nameId: 'Dana Pembangunan',
    nameEn: 'Development Fund',
    descriptionId: 'Untuk pengembangan koperasi',
    descriptionEn: 'For cooperative development',
    icon: <Building2 className="h-4 w-4 text-orange-500" />,
    rolledOver: true
  },
  {
    nameId: 'SHU Ditahan',
    nameEn: 'Withheld SHU',
    descriptionId: 'SHU anggota yang ditahan karena tunggakan pinjaman',
    descriptionEn: 'Member SHU withheld due to loan arrears',
    icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    rolledOver: true
  },
  {
    nameId: 'Simpanan Pokok',
    nameEn: 'Principal Savings',
    descriptionId: 'Tetap tercatat, tidak direset',
    descriptionEn: 'Remains recorded, not reset',
    icon: <Scale className="h-4 w-4 text-indigo-500" />,
    rolledOver: false
  },
  {
    nameId: 'Simpanan Wajib',
    nameEn: 'Mandatory Savings',
    descriptionId: 'Akumulasi bulanan terus berjalan',
    descriptionEn: 'Monthly accumulation continues',
    icon: <TrendingUp className="h-4 w-4 text-teal-500" />,
    rolledOver: false
  },
  {
    nameId: 'Saldo Pinjaman',
    nameEn: 'Loan Balance',
    descriptionId: 'Sisa pokok pinjaman terbawa ke tahun baru',
    descriptionEn: 'Outstanding principal carries over to new year',
    icon: <CreditCard className="h-4 w-4 text-red-500" />,
    rolledOver: false
  }
];

export const YearEndClosingGuide = () => {
  const { t } = useThemeLanguage();
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  const handleCheckItem = (itemId: string) => {
    setCheckedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const completedCount = checkedItems.length;
  const totalCount = checklistItems.length;
  const isComplete = completedCount === totalCount;

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {t('Panduan Tutup Buku Tahunan', 'Year-End Closing Guide')}
          </CardTitle>
          <CardDescription>
            {t(
              'Langkah-langkah lengkap untuk menutup pembukuan tahun berjalan dan memulai tahun baru',
              'Complete steps to close the current year books and start a new year'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t(
                'Tutup buku tahunan biasanya dilakukan sebelum Rapat Anggota Tahunan (RAT), sekitar bulan Januari-Februari setelah tahun buku berakhir.',
                'Year-end closing is typically done before the Annual Member Meeting, around January-February after the fiscal year ends.'
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="space-y-2">
        {/* What is Year-End Closing */}
        <AccordionItem value="what-is" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {t('Apa itu Tutup Buku Tahunan?', 'What is Year-End Closing?')}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {t(
                'Tutup buku tahunan adalah proses menutup pembukuan pada akhir tahun fiskal untuk:',
                'Year-end closing is the process of closing the books at the end of the fiscal year to:'
              )}
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>{t('Menghitung Sisa Hasil Usaha (SHU) tahunan', 'Calculate annual Surplus (SHU)')}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>{t('Mendistribusikan SHU ke dana-dana dan anggota', 'Distribute SHU to funds and members')}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>{t('Menyiapkan laporan keuangan untuk RAT', 'Prepare financial reports for Annual Meeting')}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>{t('Memindahkan saldo-saldo tertentu ke tahun baru', 'Roll over specific balances to the new year')}</span>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        {/* Checklist */}
        <AccordionItem value="checklist" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {t('Checklist Sebelum Tutup Buku', 'Pre-Closing Checklist')}
              </span>
              <Badge variant={isComplete ? 'default' : 'secondary'} className="ml-2">
                {completedCount}/{totalCount}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {t(
                'Pastikan semua item berikut sudah diselesaikan sebelum melakukan tutup buku:',
                'Ensure all the following items are completed before closing:'
              )}
            </p>
            <div className="space-y-3">
              {checklistItems.map(item => (
                <div 
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    checkedItems.includes(item.id) 
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' 
                      : 'bg-muted/30 hover:bg-muted/50'
                  }`}
                >
                  <Checkbox 
                    id={item.id}
                    checked={checkedItems.includes(item.id)}
                    onCheckedChange={() => handleCheckItem(item.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <label 
                      htmlFor={item.id}
                      className={`text-sm font-medium cursor-pointer ${
                        checkedItems.includes(item.id) ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {t(item.labelId, item.labelEn)}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t(item.descriptionId, item.descriptionEn)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {isComplete && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  {t(
                    'Semua prasyarat sudah terpenuhi! Anda siap melakukan tutup buku.',
                    'All prerequisites are met! You are ready to close the books.'
                  )}
                </AlertDescription>
              </Alert>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Data Rollover */}
        <AccordionItem value="rollover" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {t('Data yang Di-rollover vs Tidak', 'Data Rollover vs Non-Rollover')}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Rolled Over */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-green-500" />
                  {t('Di-rollover (Jurnal Pembukaan)', 'Rolled Over (Opening Journal)')}
                </h4>
                <div className="space-y-2">
                  {dataRolloverItems.filter(item => item.rolledOver).map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                      {item.icon}
                      <div>
                        <p className="text-sm font-medium">{t(item.nameId, item.nameEn)}</p>
                        <p className="text-xs text-muted-foreground">{t(item.descriptionId, item.descriptionEn)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Not Rolled Over (Continuous) */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  {t('Berkelanjutan (Tidak Direset)', 'Continuous (Not Reset)')}
                </h4>
                <div className="space-y-2">
                  {dataRolloverItems.filter(item => !item.rolledOver).map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      {item.icon}
                      <div>
                        <p className="text-sm font-medium">{t(item.nameId, item.nameEn)}</p>
                        <p className="text-xs text-muted-foreground">{t(item.descriptionId, item.descriptionEn)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Cross-Year Loans */}
        <AccordionItem value="loans" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {t('Pinjaman Lintas Tahun', 'Cross-Year Loans')}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'Pinjaman yang masih berjalan TIDAK direset saat tutup buku. Berikut yang terjadi:',
                  'Active loans are NOT reset during closing. Here is what happens:'
                )}
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <div className="p-3 rounded-lg border bg-muted/30">
                <h5 className="text-sm font-semibold mb-1">
                  {t('Saldo Pokok Pinjaman', 'Principal Loan Balance')}
                </h5>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Sisa pokok pinjaman di akhir tahun menjadi saldo awal tahun berikutnya. Tidak ada perubahan atau penyesuaian.',
                    'Outstanding principal at year-end becomes the opening balance for the next year. No changes or adjustments.'
                  )}
                </p>
              </div>
              
              <div className="p-3 rounded-lg border bg-muted/30">
                <h5 className="text-sm font-semibold mb-1">
                  {t('Jadwal Angsuran', 'Installment Schedule')}
                </h5>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Jadwal angsuran tetap berjalan sesuai tanggal jatuh tempo yang sudah ditentukan saat pencairan.',
                    'Installment schedule continues according to due dates set at disbursement.'
                  )}
                </p>
              </div>
              
              <div className="p-3 rounded-lg border bg-muted/30">
                <h5 className="text-sm font-semibold mb-1">
                  {t('Pendapatan Bunga', 'Interest Income')}
                </h5>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Bunga yang dibayarkan tahun lalu dihitung untuk SHU tahun lalu. Bunga tahun baru dihitung untuk SHU tahun baru.',
                    'Interest paid last year counts toward last year\'s SHU. New year interest counts toward new year\'s SHU.'
                  )}
                </p>
              </div>
              
              <div className="p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <h5 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {t('Tunggakan & SHU Ditahan', 'Arrears & Withheld SHU')}
                </h5>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Jika anggota memiliki tunggakan di akhir tahun, SHU mereka akan ditahan dan dapat digunakan untuk membayar tunggakan tersebut.',
                    'If members have arrears at year-end, their SHU will be withheld and can be used to pay off those arrears.'
                  )}
                </p>
              </div>
            </div>

            <Separator />
            
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">{t('Laporan Tersedia:', 'Available Reports:')}</p>
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  {t('Laporan Pinjaman Lintas Tahun - menunjukkan saldo pokok awal dan akhir tahun', 'Cross-Year Loan Report - shows beginning and ending principal balances')}
                </li>
                <li className="flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  {t('Laporan SHU Ditahan - daftar anggota dengan SHU yang ditahan', 'Withheld SHU Report - list of members with withheld SHU')}
                </li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Process Steps */}
        <AccordionItem value="process" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {t('Langkah-langkah Proses', 'Process Steps')}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
                  <div className="w-px h-full bg-border mt-2" />
                </div>
                <div className="pb-4">
                  <h5 className="font-semibold">{t('Tutup Buku Bulan Terakhir', 'Close Last Month Books')}</h5>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'Pastikan tutup buku bulan Desember sudah dilakukan. Menu: Pembukuan → Tutup Buku → Pilih Desember.',
                      'Ensure December month-end closing is done. Menu: Accounting → Close Book → Select December.'
                    )}
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                  <div className="w-px h-full bg-border mt-2" />
                </div>
                <div className="pb-4">
                  <h5 className="font-semibold">{t('Hitung & Distribusikan SHU', 'Calculate & Distribute SHU')}</h5>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'Menu: Pembukuan → Distribusi SHU → Pilih tahun → Review perhitungan → Konfirmasi distribusi.',
                      'Menu: Accounting → SHU Distribution → Select year → Review calculation → Confirm distribution.'
                    )}
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                  <div className="w-px h-full bg-border mt-2" />
                </div>
                <div className="pb-4">
                  <h5 className="font-semibold">{t('Rollover Dana', 'Fund Rollover')}</h5>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'Menu: Pembukuan → Rollover SHU → Preview → Konfirmasi rollover. Ini membuat jurnal pembukaan tahun baru.',
                      'Menu: Accounting → SHU Rollover → Preview → Confirm rollover. This creates the new year opening journal.'
                    )}
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
                </div>
                <div>
                  <h5 className="font-semibold">{t('Cetak Laporan untuk RAT', 'Print Reports for Annual Meeting')}</h5>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'Export laporan Neraca, Laba Rugi, dan Distribusi SHU dalam format PDF untuk dipresentasikan di RAT.',
                      'Export Balance Sheet, Income Statement, and SHU Distribution reports in PDF format for the Annual Meeting.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* FAQ */}
        <AccordionItem value="faq" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {t('Pertanyaan Umum', 'Frequently Asked Questions')}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <div className="space-y-4">
              <div className="p-3 rounded-lg border">
                <h5 className="text-sm font-semibold">
                  {t('Q: Bagaimana jika ada transaksi yang terlewat setelah tutup buku?', 'Q: What if transactions are missed after closing?')}
                </h5>
                <p className="text-sm text-muted-foreground mt-1">
                  {t(
                    'A: Gunakan fitur Koreksi untuk mencatat transaksi yang terlewat. Koreksi akan membuat jurnal penyesuaian dengan catatan khusus.',
                    'A: Use the Correction feature to record missed transactions. Corrections will create adjustment journals with special notes.'
                  )}
                </p>
              </div>
              
              <div className="p-3 rounded-lg border">
                <h5 className="text-sm font-semibold">
                  {t('Q: Apakah tutup buku bisa dibatalkan?', 'Q: Can year-end closing be reversed?')}
                </h5>
                <p className="text-sm text-muted-foreground mt-1">
                  {t(
                    'A: Rollover SHU tidak dapat dibatalkan. Pastikan semua data sudah benar sebelum melakukan rollover.',
                    'A: SHU rollover cannot be reversed. Ensure all data is correct before performing the rollover.'
                  )}
                </p>
              </div>
              
              <div className="p-3 rounded-lg border">
                <h5 className="text-sm font-semibold">
                  {t('Q: Kapan waktu terbaik melakukan tutup buku?', 'Q: When is the best time to close books?')}
                </h5>
                <p className="text-sm text-muted-foreground mt-1">
                  {t(
                    'A: Idealnya 2-4 minggu sebelum RAT, setelah semua transaksi Desember tercatat dan diverifikasi.',
                    'A: Ideally 2-4 weeks before the Annual Meeting, after all December transactions are recorded and verified.'
                  )}
                </p>
              </div>
              
              <div className="p-3 rounded-lg border">
                <h5 className="text-sm font-semibold">
                  {t('Q: Bagaimana dengan anggota yang keluar di tengah tahun?', 'Q: What about members who resigned mid-year?')}
                </h5>
                <p className="text-sm text-muted-foreground mt-1">
                  {t(
                    'A: SHU anggota yang keluar dihitung prorata berdasarkan bulan aktif. Menu: Pembukuan → SHU Anggota Keluar.',
                    'A: SHU for resigned members is calculated pro-rata based on active months. Menu: Accounting → Exited Member SHU.'
                  )}
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default YearEndClosingGuide;
