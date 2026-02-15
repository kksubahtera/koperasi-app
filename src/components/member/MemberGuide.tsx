import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Rocket,
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  HandCoins,
  Gift,
  User,
  UserX,
  Bell,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  CreditCard,
  Clock,
  FileText,
  Shield,
  HelpCircle,
  KeyRound
} from 'lucide-react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  content: {
    title: string;
    steps?: string[];
    tips?: string[];
    warnings?: string[];
    notes?: string[];
  }[];
}

export const MemberGuide = () => {
  const { t } = useThemeLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const sections: GuideSection[] = [
    {
      id: 'getting-started',
      title: t('Memulai di Koperasi', 'Getting Started'),
      icon: Rocket,
      description: t('Panduan pendaftaran dan verifikasi akun', 'Registration and account verification guide'),
      content: [
        {
          title: t('Pendaftaran Akun Baru', 'New Account Registration'),
          steps: [
            t('Buka halaman pendaftaran dan pilih "Daftar"', 'Open registration page and click "Register"'),
            t('Isi formulir pendaftaran: nama lengkap, NIK, email, nomor HP', 'Fill registration form: full name, NIK, email, phone number'),
            t('Masukkan data kelahiran: tanggal, tempat, dan jenis kelamin', 'Enter birth data: date, place, and gender'),
            t('Isi informasi rekening bank untuk keperluan transfer', 'Enter bank account information for transfers'),
            t('Buat password yang kuat (min. 8 karakter)', 'Create a strong password (min. 8 characters)'),
            t('Klik "Daftar" dan tunggu verifikasi admin', 'Click "Register" and wait for admin verification'),
          ],
          tips: [
            t('Gunakan email aktif yang sering Anda periksa', 'Use an active email you check frequently'),
            t('NIK harus sesuai dengan KTP', 'NIK must match your ID card'),
          ],
        },
        {
          title: t('Proses Verifikasi', 'Verification Process'),
          steps: [
            t('Admin akan memverifikasi data Anda dalam 1-3 hari kerja', 'Admin will verify your data within 1-3 business days'),
            t('Anda akan menerima notifikasi email saat akun disetujui', 'You will receive email notification when account is approved'),
            t('Setelah disetujui, login dan mulai bertransaksi', 'After approval, login and start transacting'),
          ],
          notes: [
            t('Pastikan data yang diisi sudah benar sebelum mengirim', 'Make sure all data is correct before submitting'),
          ],
        },
        {
          title: t('Klaim Akun Migrasi', 'Claim Migrated Account'),
          steps: [
            t('Jika Anda anggota lama yang dimigrasikan, buka halaman "Klaim Akun"', 'If you are an existing member being migrated, open "Claim Account" page'),
            t('Masukkan NIK dan token klaim yang diberikan admin', 'Enter your NIK and claim token provided by admin'),
            t('Buat password baru untuk akun Anda', 'Create a new password for your account'),
            t('Login dengan email dan password baru', 'Login with email and new password'),
          ],
          warnings: [
            t('Token klaim hanya berlaku 3 hari setelah dikirim', 'Claim token is only valid for 3 days after sent'),
          ],
        },
      ],
    },
    {
      id: 'dashboard',
      title: t('Dashboard & Navigasi', 'Dashboard & Navigation'),
      icon: LayoutDashboard,
      description: t('Memahami tampilan dan navigasi aplikasi', 'Understanding app display and navigation'),
      content: [
        {
          title: t('Tampilan Dashboard', 'Dashboard Display'),
          steps: [
            t('Kartu saldo menampilkan total simpanan Anda', 'Balance card shows your total savings'),
            t('Statistik menampilkan ringkasan keuangan', 'Statistics show financial summary'),
            t('Menu cepat untuk akses fitur utama', 'Quick menu for main feature access'),
          ],
        },
        {
          title: t('Navigasi Aplikasi', 'App Navigation'),
          steps: [
            t('Sidebar (desktop) atau Bottom Nav (mobile) untuk berpindah menu', 'Sidebar (desktop) or Bottom Nav (mobile) to switch menus'),
            t('Menu utama: Beranda, Simpanan, Transaksi, Pinjaman, Profil', 'Main menus: Home, Savings, Transactions, Loans, Profile'),
            t('Ikon lonceng untuk melihat notifikasi', 'Bell icon to view notifications'),
          ],
          tips: [
            t('Geser layar ke kiri/kanan untuk navigasi cepat di mobile', 'Swipe left/right for quick navigation on mobile'),
          ],
        },
      ],
    },
    {
      id: 'savings',
      title: t('Simpanan', 'Savings'),
      icon: Wallet,
      description: t('Jenis simpanan dan cara mengelolanya', 'Types of savings and how to manage them'),
      content: [
        {
          title: t('Jenis-Jenis Simpanan', 'Types of Savings'),
          steps: [
            t('Simpanan Pokok: Setoran awal saat menjadi anggota (sekali setor)', 'Principal Savings: Initial deposit when becoming member (one-time)'),
            t('Simpanan Wajib: Setoran rutin bulanan (wajib setiap bulan)', 'Mandatory Savings: Regular monthly deposit (mandatory every month)'),
            t('Simpanan Sukarela: Setoran bebas kapan saja (bisa ditarik)', 'Voluntary Savings: Free deposit anytime (can be withdrawn)'),
          ],
          notes: [
            t('Simpanan Pokok dan Wajib tidak dapat ditarik kecuali keluar dari keanggotaan', 'Principal and Mandatory Savings cannot be withdrawn unless exiting membership'),
          ],
        },
        {
          title: t('Cara Setor Simpanan', 'How to Deposit Savings'),
          steps: [
            t('Pilih menu "Transaksi" > "Setor"', 'Select "Transactions" > "Deposit" menu'),
            t('Pilih jenis simpanan (Pokok/Wajib/Sukarela)', 'Select savings type (Principal/Mandatory/Voluntary)'),
            t('Masukkan jumlah setoran', 'Enter deposit amount'),
            t('Konfirmasi dan tunggu verifikasi admin', 'Confirm and wait for admin verification'),
          ],
          tips: [
            t('Setoran akan masuk ke saldo setelah diverifikasi admin', 'Deposit will be added to balance after admin verification'),
          ],
        },
        {
          title: t('Bunga Simpanan Sukarela', 'Voluntary Savings Interest'),
          steps: [
            t('Simpanan sukarela mendapat bunga bulanan', 'Voluntary savings earn monthly interest'),
            t('Bunga dihitung dari saldo rata-rata bulanan', 'Interest is calculated from monthly average balance'),
            t('Lihat riwayat bunga di menu Profil > SHU', 'View interest history in Profile > SHU menu'),
          ],
        },
      ],
    },
    {
      id: 'transactions',
      title: t('Transaksi', 'Transactions'),
      icon: ArrowRightLeft,
      description: t('Cara melakukan dan melihat riwayat transaksi', 'How to make and view transaction history'),
      content: [
        {
          title: t('Melakukan Setoran', 'Making a Deposit'),
          steps: [
            t('Buka menu "Transaksi"', 'Open "Transactions" menu'),
            t('Pilih tab "Setor"', 'Select "Deposit" tab'),
            t('Pilih jenis simpanan', 'Select savings type'),
            t('Masukkan nominal dan catatan (opsional)', 'Enter amount and note (optional)'),
            t('Klik "Setor" dan konfirmasi', 'Click "Deposit" and confirm'),
          ],
        },
        {
          title: t('Melakukan Penarikan', 'Making a Withdrawal'),
          steps: [
            t('Buka menu "Transaksi"', 'Open "Transactions" menu'),
            t('Pilih tab "Tarik"', 'Select "Withdraw" tab'),
            t('Hanya simpanan sukarela yang dapat ditarik', 'Only voluntary savings can be withdrawn'),
            t('Masukkan nominal penarikan', 'Enter withdrawal amount'),
            t('Tunggu verifikasi admin untuk transfer', 'Wait for admin verification for transfer'),
          ],
          warnings: [
            t('Penarikan membutuhkan verifikasi admin dan transfer manual', 'Withdrawal requires admin verification and manual transfer'),
          ],
        },
        {
          title: t('Status Transaksi', 'Transaction Status'),
          steps: [
            t('Pending: Menunggu verifikasi admin', 'Pending: Waiting for admin verification'),
            t('Approved: Transaksi disetujui dan selesai', 'Approved: Transaction approved and completed'),
            t('Rejected: Transaksi ditolak (lihat alasan)', 'Rejected: Transaction rejected (see reason)'),
          ],
        },
        {
          title: t('Riwayat Transaksi', 'Transaction History'),
          steps: [
            t('Buka menu "Transaksi" > tab "Riwayat"', 'Open "Transactions" > "History" tab'),
            t('Filter berdasarkan tanggal atau jenis', 'Filter by date or type'),
            t('Klik transaksi untuk detail lengkap', 'Click transaction for full details'),
          ],
        },
      ],
    },
    {
      id: 'loans',
      title: t('Pinjaman', 'Loans'),
      icon: HandCoins,
      description: t('Cara mengajukan dan membayar pinjaman', 'How to apply and pay loans'),
      content: [
        {
          title: t('Syarat Pengajuan Pinjaman', 'Loan Application Requirements'),
          steps: [
            t('Menjadi anggota aktif minimal 3 bulan', 'Be an active member for at least 3 months'),
            t('Simpanan pokok dan wajib lunas', 'Principal and mandatory savings paid'),
            t('Tidak memiliki pinjaman aktif yang menunggak', 'No active loans in arrears'),
            t('Menyediakan jaminan jika diperlukan', 'Provide collateral if required'),
          ],
        },
        {
          title: t('Cara Mengajukan Pinjaman', 'How to Apply for a Loan'),
          steps: [
            t('Buka menu "Pinjaman" > "Ajukan Pinjaman"', 'Open "Loans" > "Apply for Loan" menu'),
            t('Pilih jumlah pinjaman dan tenor (bulan)', 'Select loan amount and tenor (months)'),
            t('Isi keperluan/tujuan pinjaman', 'Enter loan purpose'),
            t('Upload dokumen jaminan jika diperlukan', 'Upload collateral documents if required'),
            t('Submit dan tunggu persetujuan admin', 'Submit and wait for admin approval'),
          ],
          notes: [
            t('Maksimal pinjaman biasanya 3x lipat simpanan wajib', 'Maximum loan is usually 3x mandatory savings'),
          ],
        },
        {
          title: t('Jadwal Angsuran', 'Installment Schedule'),
          steps: [
            t('Lihat jadwal angsuran di detail pinjaman', 'View installment schedule in loan details'),
            t('Bayar angsuran sebelum tanggal jatuh tempo', 'Pay installments before due date'),
            t('Keterlambatan akan dikenakan denda', 'Late payments will incur penalties'),
          ],
          warnings: [
            t('Denda keterlambatan dihitung per bulan terlambat', 'Late penalty is calculated per overdue month'),
          ],
        },
        {
          title: t('Pelunasan Dipercepat', 'Early Payoff'),
          steps: [
            t('Buka detail pinjaman aktif', 'Open active loan details'),
            t('Pilih "Pelunasan Dipercepat"', 'Select "Early Payoff"'),
            t('Lihat simulasi potongan bunga', 'View interest discount simulation'),
            t('Konfirmasi pelunasan', 'Confirm payoff'),
          ],
          tips: [
            t('Pelunasan dipercepat bisa mendapat potongan bunga', 'Early payoff may get interest discount'),
          ],
        },
        {
          title: t('Konsekuensi Keterlambatan', 'Consequences of Late Payment'),
          steps: [
            t('Denda otomatis dihitung setiap bulan terlambat', 'Penalty automatically calculated each overdue month'),
            t('Notifikasi pengingat dikirim sebelum jatuh tempo', 'Reminder notifications sent before due date'),
            t('Setelah 3 bulan menunggak, akan dilakukan pembinaan', 'After 3 months overdue, counseling will be conducted'),
            t('Jaminan dapat dieksekusi jika pinjaman macet', 'Collateral may be executed if loan defaults'),
          ],
        },
      ],
    },
    {
      id: 'shu',
      title: t('SHU (Sisa Hasil Usaha)', 'SHU (Surplus)'),
      icon: Gift,
      description: t('Memahami perhitungan dan distribusi SHU', 'Understanding SHU calculation and distribution'),
      content: [
        {
          title: t('Apa itu SHU?', 'What is SHU?'),
          steps: [
            t('SHU adalah keuntungan koperasi yang dibagikan ke anggota', 'SHU is cooperative profit distributed to members'),
            t('Dibagikan setiap akhir tahun buku (biasanya Desember)', 'Distributed every end of fiscal year (usually December)'),
            t('Besaran tergantung kontribusi simpanan dan jasa usaha', 'Amount depends on savings contribution and business transactions'),
          ],
        },
        {
          title: t('Cara Perhitungan SHU', 'SHU Calculation Method'),
          steps: [
            t('SHU Simpanan: Berdasarkan rata-rata saldo simpanan Anda', 'Savings SHU: Based on your average savings balance'),
            t('SHU Jasa Usaha: Berdasarkan aktivitas transaksi/pinjaman', 'Business SHU: Based on transaction/loan activity'),
            t('Total SHU = SHU Simpanan + SHU Jasa Usaha', 'Total SHU = Savings SHU + Business SHU'),
          ],
          notes: [
            t('Semakin aktif bertransaksi, semakin besar SHU jasa usaha', 'More active transactions = larger business SHU'),
          ],
        },
        {
          title: t('Melihat Estimasi SHU', 'View SHU Estimate'),
          steps: [
            t('Buka menu "Profil" > tab "SHU"', 'Open "Profile" > "SHU" tab'),
            t('Lihat estimasi SHU tahun berjalan', 'View current year SHU estimate'),
            t('Riwayat SHU tahun-tahun sebelumnya', 'SHU history from previous years'),
          ],
        },
      ],
    },
    {
      id: 'profile',
      title: t('Profil & Akun', 'Profile & Account'),
      icon: User,
      description: t('Mengelola informasi pribadi dan keamanan', 'Managing personal information and security'),
      content: [
        {
          title: t('Update Data Pribadi', 'Update Personal Data'),
          steps: [
            t('Buka menu "Profil" > tab "Profil"', 'Open "Profile" > "Profile" tab'),
            t('Klik tombol "Edit" untuk mengubah data', 'Click "Edit" button to modify data'),
            t('Perbarui: nama, nomor HP, alamat, info bank', 'Update: name, phone, address, bank info'),
            t('Klik "Simpan" untuk menyimpan perubahan', 'Click "Save" to save changes'),
          ],
          tips: [
            t('Pastikan info rekening bank valid untuk penarikan', 'Ensure bank account info is valid for withdrawals'),
          ],
        },
        {
          title: t('Ganti Password', 'Change Password'),
          steps: [
            t('Buka "Profil" > tab "Keamanan"', 'Open "Profile" > "Security" tab'),
            t('Masukkan password lama', 'Enter current password'),
            t('Masukkan password baru (min. 8 karakter)', 'Enter new password (min. 8 characters)'),
            t('Konfirmasi password baru', 'Confirm new password'),
            t('Klik "Ganti Password"', 'Click "Change Password"'),
          ],
          warnings: [
            t('Gunakan password yang kuat dengan kombinasi huruf, angka, simbol', 'Use strong password with letters, numbers, symbols'),
          ],
        },
        {
          title: t('Ganti Email', 'Change Email'),
          steps: [
            t('Buka "Profil" > tab "Keamanan"', 'Open "Profile" > "Security" tab'),
            t('Klik "Ubah Email"', 'Click "Change Email"'),
            t('Masukkan email baru', 'Enter new email'),
            t('Verifikasi melalui link di email lama', 'Verify through link in old email'),
          ],
        },
        {
          title: t('Kartu Anggota Digital', 'Digital Member Card'),
          steps: [
            t('Buka "Profil" > tab "Profil"', 'Open "Profile" > "Profile" tab'),
            t('Klik tombol "Lihat Kartu Anggota"', 'Click "View Member Card" button'),
            t('Screenshot atau cetak kartu untuk keperluan', 'Screenshot or print card for your needs'),
          ],
        },
      ],
    },
    {
      id: 'nik-security',
      title: t('Keamanan NIK', 'NIK Security'),
      icon: KeyRound,
      description: t('Melihat dan melindungi data NIK Anda', 'View and protect your NIK data'),
      content: [
        {
          title: t('Melihat NIK Anda', 'View Your NIK'),
          steps: [
            t('Login ke akun Anda', 'Login to your account'),
            t('Buka menu "Profil"', 'Open "Profile" menu'),
            t('NIK ditampilkan di bagian data pribadi', 'NIK is displayed in personal data section'),
          ],
          notes: [
            t('NIK Anda hanya bisa dilihat oleh Anda dan administrator', 'Your NIK can only be viewed by you and administrators'),
          ],
        },
        {
          title: t('Perlindungan Data NIK', 'NIK Data Protection'),
          steps: [
            t('NIK Anda disimpan dalam bentuk terenkripsi', 'Your NIK is stored in encrypted form'),
            t('Enkripsi menggunakan standar keamanan AES-256', 'Encryption uses AES-256 security standard'),
            t('Data tidak bisa dibaca tanpa kunci dekripsi', 'Data cannot be read without decryption key'),
          ],
        },
        {
          title: t('Mengamankan Data NIK', 'Securing NIK Data'),
          steps: [
            t('Jangan bagikan NIK Anda ke pihak tidak dikenal', 'Do not share your NIK with unknown parties'),
            t('Laporkan ke admin jika ada aktivitas mencurigakan', 'Report to admin if there is suspicious activity'),
            t('Pastikan perangkat Anda aman saat mengakses profil', 'Ensure your device is secure when accessing profile'),
          ],
          tips: [
            t('Gunakan password yang kuat untuk melindungi akun', 'Use a strong password to protect your account'),
          ],
        },
        {
          title: t('Jika NIK Anda Salah', 'If Your NIK is Incorrect'),
          steps: [
            t('Hubungi administrator koperasi', 'Contact cooperative administrator'),
            t('Siapkan dokumen identitas (KTP) sebagai bukti', 'Prepare identity documents (ID card) as proof'),
            t('Admin akan memverifikasi dan memperbarui NIK', 'Admin will verify and update NIK'),
          ],
          warnings: [
            t('Perubahan NIK akan dicatat di audit log untuk keamanan', 'NIK changes will be recorded in audit log for security'),
          ],
        },
      ],
    },
    {
      id: 'resignation',
      title: t('Pengunduran Diri', 'Resignation'),
      icon: UserX,
      description: t('Proses keluar dari keanggotaan', 'Process of exiting membership'),
      content: [
        {
          title: t('Syarat Pengunduran Diri', 'Resignation Requirements'),
          steps: [
            t('Tidak memiliki pinjaman aktif', 'No active loans'),
            t('Tidak memiliki kewajiban yang belum lunas', 'No outstanding obligations'),
            t('Telah menjadi anggota minimal 1 tahun', 'Have been a member for at least 1 year'),
          ],
          warnings: [
            t('Pengunduran diri bersifat permanen dan tidak dapat dibatalkan', 'Resignation is permanent and cannot be reversed'),
          ],
        },
        {
          title: t('Cara Mengajukan Pengunduran Diri', 'How to Submit Resignation'),
          steps: [
            t('Buka "Profil" > tab "Non-Aktif"', 'Open "Profile" > "Inactive" tab'),
            t('Baca syarat dan ketentuan', 'Read terms and conditions'),
            t('Isi formulir pengunduran diri', 'Fill resignation form'),
            t('Masukkan alasan pengunduran diri', 'Enter resignation reason'),
            t('Submit dan tunggu proses admin', 'Submit and wait for admin process'),
          ],
        },
        {
          title: t('Refund Simpanan', 'Savings Refund'),
          steps: [
            t('Simpanan pokok dan wajib akan dikembalikan', 'Principal and mandatory savings will be refunded'),
            t('Dikurangi kewajiban jika ada', 'Deducted by any obligations'),
            t('Transfer ke rekening yang terdaftar', 'Transferred to registered bank account'),
            t('Proses refund membutuhkan 7-14 hari kerja', 'Refund process takes 7-14 business days'),
          ],
        },
      ],
    },
    {
      id: 'notifications',
      title: t('Notifikasi', 'Notifications'),
      icon: Bell,
      description: t('Mengelola notifikasi dan pengingat', 'Managing notifications and reminders'),
      content: [
        {
          title: t('Jenis Notifikasi', 'Types of Notifications'),
          steps: [
            t('Transaksi: Status setoran/penarikan', 'Transactions: Deposit/withdrawal status'),
            t('Pinjaman: Pengingat angsuran, status pengajuan', 'Loans: Installment reminders, application status'),
            t('SHU: Distribusi SHU tahunan', 'SHU: Annual SHU distribution'),
            t('Pengumuman: Info penting dari koperasi', 'Announcements: Important info from cooperative'),
          ],
        },
        {
          title: t('Mengelola Notifikasi', 'Managing Notifications'),
          steps: [
            t('Klik ikon lonceng untuk melihat notifikasi', 'Click bell icon to view notifications'),
            t('Klik notifikasi untuk detail', 'Click notification for details'),
            t('Geser ke kiri untuk menghapus (mobile)', 'Swipe left to delete (mobile)'),
            t('Klik "Tandai Semua Dibaca" untuk membersihkan', 'Click "Mark All Read" to clear'),
          ],
        },
      ],
    },
  ];

  // Filter sections based on search query
  const filteredSections = sections.filter(section => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(query) ||
      section.description.toLowerCase().includes(query) ||
      section.content.some(c => 
        c.title.toLowerCase().includes(query) ||
        c.steps?.some(s => s.toLowerCase().includes(query)) ||
        c.tips?.some(t => t.toLowerCase().includes(query)) ||
        c.notes?.some(n => n.toLowerCase().includes(query))
      )
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {t('Panduan Pengguna', 'User Guide')}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Pelajari cara menggunakan semua fitur koperasi', 'Learn how to use all cooperative features')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Search */}
          <SearchInput
            placeholder={t('Cari topik panduan...', 'Search guide topics...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            containerClassName="w-full"
          />
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-2xl font-bold text-primary">{sections.length}</span>
          <span className="text-xs text-muted-foreground">{t('Topik', 'Topics')}</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-lg bg-success/5 border border-success/20">
          <span className="text-2xl font-bold text-success">
            {sections.reduce((acc, s) => acc + s.content.length, 0)}
          </span>
          <span className="text-xs text-muted-foreground">{t('Panduan', 'Guides')}</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-lg bg-warning/5 border border-warning/20">
          <span className="text-2xl font-bold text-warning">
            {sections.reduce((acc, s) => acc + s.content.reduce((a, c) => a + (c.tips?.length || 0), 0), 0)}
          </span>
          <span className="text-xs text-muted-foreground">{t('Tips', 'Tips')}</span>
        </div>
      </div>

      {/* Guide Sections */}
      <ScrollArea className="h-[calc(100vh-400px)] min-h-[400px]">
        <Accordion type="single" collapsible className="space-y-3">
          {filteredSections.map((section) => (
            <AccordionItem 
              key={section.id} 
              value={section.id}
              className="border rounded-lg overflow-hidden bg-card"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">{section.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {section.description}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4 pt-2">
                  {section.content.map((item, idx) => (
                    <div key={idx} className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {idx + 1}
                        </Badge>
                        {item.title}
                      </h4>
                      
                      {/* Steps */}
                      {item.steps && (
                        <ul className="space-y-1.5 ml-4">
                          {item.steps.map((step, stepIdx) => (
                            <li key={stepIdx} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Tips */}
                      {item.tips && item.tips.length > 0 && (
                        <Alert className="bg-primary/5 border-primary/20">
                          <Lightbulb className="h-4 w-4 text-primary" />
                          <AlertDescription className="text-xs">
                            <strong className="text-primary">{t('Tips:', 'Tips:')}</strong>
                            <ul className="mt-1 space-y-1">
                              {item.tips.map((tip, tipIdx) => (
                                <li key={tipIdx}>• {tip}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Warnings */}
                      {item.warnings && item.warnings.length > 0 && (
                        <Alert className="bg-warning/5 border-warning/20">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <AlertDescription className="text-xs">
                            <strong className="text-warning">{t('Perhatian:', 'Warning:')}</strong>
                            <ul className="mt-1 space-y-1">
                              {item.warnings.map((warning, wIdx) => (
                                <li key={wIdx}>• {warning}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Notes */}
                      {item.notes && item.notes.length > 0 && (
                        <Alert className="bg-muted/50 border-muted">
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          <AlertDescription className="text-xs">
                            <strong className="text-muted-foreground">{t('Catatan:', 'Notes:')}</strong>
                            <ul className="mt-1 space-y-1">
                              {item.notes.map((note, nIdx) => (
                                <li key={nIdx}>• {note}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {filteredSections.length === 0 && (
          <div className="text-center py-12">
            <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {t('Tidak ditemukan panduan dengan kata kunci tersebut', 'No guides found with that keyword')}
            </p>
          </div>
        )}
      </ScrollArea>

      {/* Footer Help */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <HelpCircle className="h-5 w-5 text-info" />
            </div>
            <div>
              <h4 className="font-medium text-sm">
                {t('Butuh Bantuan Lebih?', 'Need More Help?')}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  'Hubungi admin koperasi melalui menu Beranda atau kirim pesan melalui email yang tertera.',
                  'Contact cooperative admin through Home menu or send message via listed email.'
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
