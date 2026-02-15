import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  LayoutDashboard,
  UserPlus,
  Users,
  ArrowRightLeft,
  HandCoins,
  Briefcase,
  BookOpen,
  FileText,
  Settings,
  Database,
  Search,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Shield,
  Calculator,
  BarChart3,
  ClipboardCheck,
  FileSpreadsheet,
  Upload,
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

export const AdminGuide = () => {
  const { t } = useThemeLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const sections: GuideSection[] = [
    {
      id: 'dashboard',
      title: t('Dashboard Admin', 'Admin Dashboard'),
      icon: LayoutDashboard,
      description: t('Memahami tampilan dan navigasi admin', 'Understanding admin display and navigation'),
      content: [
        {
          title: t('Ringkasan Dashboard', 'Dashboard Overview'),
          steps: [
            t('Statistik utama: total anggota, simpanan, pinjaman', 'Main statistics: total members, savings, loans'),
            t('Grafik keuangan untuk monitoring trend', 'Financial charts for trend monitoring'),
            t('Quick actions untuk akses cepat', 'Quick actions for fast access'),
            t('Notifikasi pending yang perlu ditindaklanjuti', 'Pending notifications that need follow-up'),
          ],
        },
        {
          title: t('Navigasi Menu Admin', 'Admin Menu Navigation'),
          steps: [
            t('Sidebar kiri menampilkan semua menu admin', 'Left sidebar shows all admin menus'),
            t('Ikon lonceng untuk notifikasi admin', 'Bell icon for admin notifications'),
            t('Role switcher untuk beralih ke tampilan member', 'Role switcher to switch to member view'),
          ],
          tips: [
            t('Gunakan role switcher untuk melihat tampilan seperti anggota', 'Use role switcher to see the view like a member'),
          ],
        },
      ],
    },
    {
      id: 'registration',
      title: t('Kelola Pendaftaran', 'Registration Management'),
      icon: UserPlus,
      description: t('Verifikasi dan persetujuan anggota baru', 'Verification and approval of new members'),
      content: [
        {
          title: t('Melihat Daftar Pendaftaran', 'View Registration List'),
          steps: [
            t('Buka menu "Pendaftaran"', 'Open "Registration" menu'),
            t('Lihat daftar calon anggota dengan status pending', 'View list of prospective members with pending status'),
            t('Klik nama untuk melihat detail lengkap', 'Click name to view full details'),
          ],
        },
        {
          title: t('Menyetujui Pendaftaran', 'Approving Registration'),
          steps: [
            t('Verifikasi data: NIK, nama, email, nomor HP', 'Verify data: NIK, name, email, phone'),
            t('Periksa kelengkapan dokumen', 'Check document completeness'),
            t('Klik "Setujui" jika data valid', 'Click "Approve" if data is valid'),
            t('Sistem akan mengirim email notifikasi ke anggota', 'System will send notification email to member'),
          ],
          tips: [
            t('Pastikan NIK tidak duplikat dengan anggota lain', 'Make sure NIK is not duplicate with other members'),
          ],
        },
        {
          title: t('Menolak Pendaftaran', 'Rejecting Registration'),
          steps: [
            t('Klik "Tolak" pada pendaftaran yang tidak valid', 'Click "Reject" on invalid registration'),
            t('Masukkan alasan penolakan', 'Enter rejection reason'),
            t('Anggota akan menerima notifikasi penolakan', 'Member will receive rejection notification'),
          ],
          warnings: [
            t('Penolakan tidak dapat dibatalkan, calon anggota harus mendaftar ulang', 'Rejection cannot be undone, prospective member must re-register'),
          ],
        },
      ],
    },
    {
      id: 'members',
      title: t('Kelola Anggota', 'Member Management'),
      icon: Users,
      description: t('Manajemen data anggota koperasi', 'Cooperative member data management'),
      content: [
        {
          title: t('Daftar Anggota', 'Member List'),
          steps: [
            t('Buka menu "Anggota"', 'Open "Members" menu'),
            t('Gunakan pencarian untuk filter anggota', 'Use search to filter members'),
            t('Klik nama anggota untuk detail', 'Click member name for details'),
            t('Lihat saldo simpanan dan riwayat transaksi', 'View savings balance and transaction history'),
          ],
        },
        {
          title: t('Edit Data Anggota', 'Edit Member Data'),
          steps: [
            t('Buka detail anggota', 'Open member details'),
            t('Klik tombol "Edit"', 'Click "Edit" button'),
            t('Perbarui data yang diperlukan', 'Update required data'),
            t('Simpan perubahan', 'Save changes'),
          ],
          notes: [
            t('Perubahan data dicatat di audit log', 'Data changes are recorded in audit log'),
          ],
        },
        {
          title: t('Membuat Akun Manual', 'Create Manual Account'),
          steps: [
            t('Klik "Tambah Anggota" di halaman daftar anggota', 'Click "Add Member" on member list page'),
            t('Isi formulir data anggota lengkap', 'Fill complete member data form'),
            t('Set password awal untuk anggota', 'Set initial password for member'),
            t('Simpan dan anggota langsung aktif', 'Save and member is immediately active'),
          ],
        },
        {
          title: t('Import Anggota dari Excel', 'Import Members from Excel'),
          steps: [
            t('Buka menu "Anggota" > "Import Excel"', 'Open "Members" > "Import Excel" menu'),
            t('Download template Excel', 'Download Excel template'),
            t('Isi data anggota sesuai format template', 'Fill member data according to template format'),
            t('Upload file Excel yang sudah diisi', 'Upload filled Excel file'),
            t('Preview dan verifikasi data', 'Preview and verify data'),
            t('Klik "Import" untuk memproses', 'Click "Import" to process'),
          ],
          warnings: [
            t('Pastikan format Excel sesuai template', 'Make sure Excel format matches template'),
            t('NIK dan email harus unik', 'NIK and email must be unique'),
          ],
        },
        {
          title: t('Regenerasi Nomor Anggota', 'Regenerate Member Numbers'),
          steps: [
            t('Buka menu "Pengaturan" > "No. Anggota"', 'Open "Settings" > "Member Number" menu'),
            t('Pilih format nomor anggota baru', 'Select new member number format'),
            t('Klik "Regenerasi" untuk update semua nomor', 'Click "Regenerate" to update all numbers'),
          ],
          warnings: [
            t('Regenerasi akan mengubah semua nomor anggota', 'Regeneration will change all member numbers'),
          ],
        },
      ],
    },
    {
      id: 'nik-management',
      title: t('Data NIK Anggota', 'Member NIK Data'),
      icon: KeyRound,
      description: t('Melihat dan mengelola data NIK terenkripsi', 'View and manage encrypted NIK data'),
      content: [
        {
          title: t('Melihat NIK di Daftar Anggota', 'View NIK in Member List'),
          steps: [
            t('Buka menu "Anggota"', 'Open "Members" menu'),
            t('Klik nama anggota untuk melihat detail', 'Click member name to view details'),
            t('NIK ditampilkan di bagian informasi pribadi', 'NIK is displayed in personal information section'),
          ],
          notes: [
            t('NIK disimpan dalam format terenkripsi AES-256 di database', 'NIK is stored in AES-256 encrypted format in database'),
          ],
        },
        {
          title: t('Melihat NIK saat Edit Anggota', 'View NIK when Editing Member'),
          steps: [
            t('Buka detail anggota', 'Open member details'),
            t('Klik tombol "Edit"', 'Click "Edit" button'),
            t('NIK ditampilkan di form edit (hanya untuk admin)', 'NIK is displayed in edit form (admins only)'),
            t('NIK dapat diubah jika diperlukan', 'NIK can be changed if necessary'),
          ],
        },
        {
          title: t('Export Data NIK', 'Export NIK Data'),
          steps: [
            t('Buka menu "Anggota"', 'Open "Members" menu'),
            t('Pilih anggota yang akan di-export', 'Select members to export'),
            t('Klik "Export PDF" atau "Export Excel"', 'Click "Export PDF" or "Export Excel"'),
            t('NIK tercantum dalam file hasil export', 'NIK is included in exported file'),
          ],
          warnings: [
            t('Data export berisi NIK asli - jaga kerahasiaan file', 'Export contains original NIK - keep file confidential'),
          ],
        },
        {
          title: t('Keamanan Data NIK', 'NIK Data Security'),
          steps: [
            t('NIK terenkripsi otomatis saat disimpan ke database', 'NIK is automatically encrypted when saved to database'),
            t('Hanya admin dan pemilik akun yang dapat melihat NIK asli', 'Only admins and account owners can view original NIK'),
            t('Sistem mencegah duplikasi NIK antar anggota', 'System prevents NIK duplication between members'),
          ],
          tips: [
            t('Jangan bagikan data NIK ke pihak tidak berwenang', 'Do not share NIK data with unauthorized parties'),
            t('Hapus file export setelah selesai digunakan', 'Delete export files after use'),
          ],
        },
      ],
    },
    {
      id: 'transactions',
      title: t('Verifikasi Transaksi', 'Transaction Verification'),
      icon: ArrowRightLeft,
      description: t('Proses verifikasi setoran dan penarikan', 'Deposit and withdrawal verification process'),
      content: [
        {
          title: t('Daftar Transaksi Pending', 'Pending Transaction List'),
          steps: [
            t('Buka menu "Transaksi" > tab "Verifikasi"', 'Open "Transactions" > "Verification" tab'),
            t('Lihat daftar transaksi menunggu persetujuan', 'View list of transactions awaiting approval'),
            t('Badge merah menunjukkan jumlah pending', 'Red badge shows pending count'),
          ],
        },
        {
          title: t('Menyetujui Transaksi', 'Approving Transactions'),
          steps: [
            t('Verifikasi bukti transfer/setoran (jika ada)', 'Verify transfer/deposit proof (if any)'),
            t('Pastikan nominal sesuai', 'Make sure amount is correct'),
            t('Klik "Setujui" untuk approve', 'Click "Approve" to approve'),
            t('Saldo anggota akan otomatis terupdate', 'Member balance will be automatically updated'),
          ],
          tips: [
            t('Jurnal akuntansi otomatis terbuat saat transaksi disetujui', 'Accounting journal is automatically created when transaction is approved'),
          ],
        },
        {
          title: t('Menolak Transaksi', 'Rejecting Transactions'),
          steps: [
            t('Klik "Tolak" pada transaksi bermasalah', 'Click "Reject" on problematic transaction'),
            t('Masukkan alasan penolakan', 'Enter rejection reason'),
            t('Anggota akan menerima notifikasi', 'Member will receive notification'),
          ],
        },
        {
          title: t('Koreksi Transaksi', 'Transaction Correction'),
          steps: [
            t('Buka menu "Koreksi"', 'Open "Correction" menu'),
            t('Pilih anggota dan jenis simpanan', 'Select member and savings type'),
            t('Masukkan nominal koreksi (+/-)', 'Enter correction amount (+/-)'),
            t('Isi alasan koreksi', 'Fill correction reason'),
            t('Simpan untuk memproses', 'Save to process'),
          ],
          warnings: [
            t('Koreksi akan tercatat di audit log dan tidak dapat dihapus', 'Corrections will be recorded in audit log and cannot be deleted'),
          ],
        },
      ],
    },
    {
      id: 'loans',
      title: t('Kelola Pinjaman', 'Loan Management'),
      icon: HandCoins,
      description: t('Persetujuan dan monitoring pinjaman', 'Loan approval and monitoring'),
      content: [
        {
          title: t('Daftar Pengajuan Pinjaman', 'Loan Application List'),
          steps: [
            t('Buka menu "Pinjaman"', 'Open "Loans" menu'),
            t('Tab "Pengajuan" untuk pinjaman pending', '"Applications" tab for pending loans'),
            t('Tab "Aktif" untuk pinjaman berjalan', '"Active" tab for ongoing loans'),
            t('Tab "Lunas" untuk pinjaman selesai', '"Paid Off" tab for completed loans'),
          ],
        },
        {
          title: t('Menyetujui Pinjaman', 'Approving Loans'),
          steps: [
            t('Klik pengajuan untuk melihat detail', 'Click application to view details'),
            t('Verifikasi kelayakan: simpanan, riwayat, jaminan', 'Verify eligibility: savings, history, collateral'),
            t('Periksa perhitungan angsuran', 'Check installment calculation'),
            t('Klik "Setujui" jika layak', 'Click "Approve" if eligible'),
            t('Cetak surat persetujuan pinjaman', 'Print loan approval letter'),
          ],
          tips: [
            t('Sistem otomatis membuat jadwal angsuran', 'System automatically creates installment schedule'),
          ],
        },
        {
          title: t('Monitoring Angsuran', 'Installment Monitoring'),
          steps: [
            t('Lihat tab "Aktif" untuk pinjaman berjalan', 'View "Active" tab for ongoing loans'),
            t('Warna merah menandakan angsuran terlambat', 'Red color indicates overdue installments'),
            t('Klik untuk detail dan riwayat pembayaran', 'Click for details and payment history'),
          ],
        },
        {
          title: t('Penanganan Keterlambatan', 'Handling Delinquency'),
          steps: [
            t('Buka menu "Pinjaman" > "Tunggakan"', 'Open "Loans" > "Overdue" menu'),
            t('Lihat daftar anggota dengan angsuran terlambat', 'View list of members with overdue installments'),
            t('Kirim pengingat otomatis', 'Send automatic reminder'),
            t('Catat tindak lanjut pembinaan', 'Record follow-up counseling'),
          ],
          warnings: [
            t('Denda otomatis dihitung sistem setiap bulan terlambat', 'Penalty is automatically calculated by system each overdue month'),
          ],
        },
        {
          title: t('Restrukturisasi Pinjaman', 'Loan Restructuring'),
          steps: [
            t('Buka detail pinjaman aktif', 'Open active loan details'),
            t('Klik "Restrukturisasi"', 'Click "Restructure"'),
            t('Atur ulang jadwal angsuran', 'Reschedule installments'),
            t('Simpan perubahan dengan alasan', 'Save changes with reason'),
          ],
        },
      ],
    },
    {
      id: 'business-units',
      title: t('Unit Usaha', 'Business Units'),
      icon: Briefcase,
      description: t('Pencatatan transaksi unit usaha', 'Business unit transaction recording'),
      content: [
        {
          title: t('Daftar Unit Usaha', 'Business Unit List'),
          steps: [
            t('Buka menu "Unit Usaha"', 'Open "Business Units" menu'),
            t('Lihat daftar unit usaha aktif', 'View list of active business units'),
            t('Klik unit untuk detail transaksi', 'Click unit for transaction details'),
          ],
        },
        {
          title: t('Mencatat Transaksi Unit Usaha', 'Recording Business Unit Transactions'),
          steps: [
            t('Pilih unit usaha', 'Select business unit'),
            t('Klik "Tambah Transaksi"', 'Click "Add Transaction"'),
            t('Pilih jenis: pembelian/penjualan', 'Select type: purchase/sale'),
            t('Isi nominal dan keterangan', 'Fill amount and description'),
            t('Simpan transaksi', 'Save transaction'),
          ],
          tips: [
            t('Transaksi unit usaha mempengaruhi perhitungan SHU jasa usaha', 'Business unit transactions affect business SHU calculation'),
          ],
        },
        {
          title: t('Laporan Unit Usaha', 'Business Unit Reports'),
          steps: [
            t('Buka tab "Laporan" di menu Unit Usaha', 'Open "Reports" tab in Business Units menu'),
            t('Pilih periode laporan', 'Select report period'),
            t('Export ke Excel atau PDF', 'Export to Excel or PDF'),
          ],
        },
      ],
    },
    {
      id: 'accounting',
      title: t('Pembukuan & Akuntansi', 'Accounting & Bookkeeping'),
      icon: Calculator,
      description: t('Pengelolaan jurnal dan laporan keuangan', 'Journal and financial report management'),
      content: [
        {
          title: t('Dashboard Pembukuan', 'Accounting Dashboard'),
          steps: [
            t('Buka menu "Pembukuan"', 'Open "Accounting" menu'),
            t('Lihat ringkasan aset, liabilitas, ekuitas', 'View summary of assets, liabilities, equity'),
            t('Akses cepat ke laporan keuangan', 'Quick access to financial reports'),
          ],
        },
        {
          title: t('Bagan Akun (Chart of Accounts)', 'Chart of Accounts'),
          steps: [
            t('Buka "Pembukuan" > "Bagan Akun"', 'Open "Accounting" > "Chart of Accounts"'),
            t('Lihat struktur akun: Aset, Liabilitas, Ekuitas, Pendapatan, Beban', 'View account structure: Assets, Liabilities, Equity, Revenue, Expenses'),
            t('Tambah akun baru jika diperlukan', 'Add new account if needed'),
          ],
          notes: [
            t('Akun sistem tidak dapat dihapus', 'System accounts cannot be deleted'),
          ],
        },
        {
          title: t('Jurnal Manual', 'Manual Journal'),
          steps: [
            t('Buka "Pembukuan" > "Jurnal"', 'Open "Accounting" > "Journal"'),
            t('Klik "Buat Jurnal"', 'Click "Create Journal"'),
            t('Pilih akun debit dan kredit', 'Select debit and credit accounts'),
            t('Masukkan nominal (harus balance)', 'Enter amount (must balance)'),
            t('Simpan jurnal', 'Save journal'),
          ],
          warnings: [
            t('Jurnal harus balance (debit = kredit)', 'Journal must balance (debit = credit)'),
          ],
        },
        {
          title: t('Template Jurnal Otomatis', 'Automatic Journal Templates'),
          steps: [
            t('Buka "Pembukuan" > "Template Jurnal"', 'Open "Accounting" > "Journal Templates"'),
            t('Lihat template untuk setiap jenis transaksi', 'View templates for each transaction type'),
            t('Edit mapping akun jika diperlukan', 'Edit account mapping if needed'),
          ],
          tips: [
            t('Jurnal otomatis terbuat saat transaksi disetujui', 'Automatic journal is created when transaction is approved'),
          ],
        },
        {
          title: t('Laporan Keuangan', 'Financial Reports'),
          steps: [
            t('Neraca: "Pembukuan" > "Neraca"', 'Balance Sheet: "Accounting" > "Balance Sheet"'),
            t('Laba Rugi: "Pembukuan" > "Laba Rugi"', 'Profit Loss: "Accounting" > "Profit Loss"'),
            t('Arus Kas: "Pembukuan" > "Arus Kas"', 'Cash Flow: "Accounting" > "Cash Flow"'),
            t('Pilih periode dan export', 'Select period and export'),
          ],
        },
        {
          title: t('Distribusi SHU', 'SHU Distribution'),
          steps: [
            t('Buka "Pembukuan" > "SHU"', 'Open "Accounting" > "SHU"'),
            t('Hitung SHU tahun berjalan', 'Calculate current year SHU'),
            t('Lihat simulasi distribusi per anggota', 'View distribution simulation per member'),
            t('Proses distribusi di akhir tahun', 'Process distribution at year end'),
          ],
          warnings: [
            t('Distribusi SHU hanya bisa dilakukan sekali per tahun', 'SHU distribution can only be done once per year'),
          ],
        },
      ],
    },
    {
      id: 'reports',
      title: t('Laporan', 'Reports'),
      icon: BarChart3,
      description: t('Akses dan export berbagai laporan', 'Access and export various reports'),
      content: [
        {
          title: t('Laporan Anggota', 'Member Reports'),
          steps: [
            t('Daftar anggota aktif/non-aktif', 'Active/inactive member list'),
            t('Statistik pertumbuhan anggota', 'Member growth statistics'),
            t('Export data anggota ke Excel', 'Export member data to Excel'),
          ],
        },
        {
          title: t('Laporan Keuangan', 'Financial Reports'),
          steps: [
            t('Neraca Keuangan', 'Balance Sheet'),
            t('Laporan Laba Rugi', 'Profit Loss Statement'),
            t('Laporan Arus Kas', 'Cash Flow Statement'),
            t('Rekonsiliasi Bank', 'Bank Reconciliation'),
          ],
        },
        {
          title: t('Laporan Migrasi', 'Migration Reports'),
          steps: [
            t('Akun belum diklaim', 'Unclaimed accounts'),
            t('Rekonsiliasi data migrasi', 'Migration data reconciliation'),
            t('Perbandingan sebelum/sesudah migrasi', 'Before/after migration comparison'),
          ],
        },
        {
          title: t('Export Data', 'Data Export'),
          steps: [
            t('Pilih menu yang ingin diexport', 'Select menu to export'),
            t('Klik tombol Export (PDF/Excel)', 'Click Export button (PDF/Excel)'),
            t('File akan otomatis terdownload', 'File will automatically download'),
          ],
          tips: [
            t('Export tahunan tersedia di menu Pengaturan', 'Yearly export available in Settings menu'),
          ],
        },
      ],
    },
    {
      id: 'settings',
      title: t('Pengaturan', 'Settings'),
      icon: Settings,
      description: t('Konfigurasi sistem koperasi', 'Cooperative system configuration'),
      content: [
        {
          title: t('Identitas Koperasi', 'Cooperative Identity'),
          steps: [
            t('Nama dan alamat koperasi', 'Cooperative name and address'),
            t('Logo dan nomor badan hukum', 'Logo and legal number'),
            t('Informasi kontak dan rekening', 'Contact and account information'),
          ],
        },
        {
          title: t('Pengaturan Pinjaman', 'Loan Settings'),
          steps: [
            t('Suku bunga pinjaman', 'Loan interest rate'),
            t('Denda keterlambatan', 'Late payment penalty'),
            t('Maksimal tenor pinjaman', 'Maximum loan tenor'),
            t('Pengaturan jaminan', 'Collateral settings'),
          ],
        },
        {
          title: t('Pengaturan Simpanan', 'Savings Settings'),
          steps: [
            t('Nominal simpanan pokok dan wajib', 'Principal and mandatory savings amounts'),
            t('Bunga simpanan sukarela', 'Voluntary savings interest'),
          ],
        },
        {
          title: t('Pengaturan SHU', 'SHU Settings'),
          steps: [
            t('Proporsi pembagian SHU', 'SHU distribution proportions'),
            t('Formula perhitungan', 'Calculation formula'),
          ],
        },
        {
          title: t('Template Surat', 'Letter Templates'),
          steps: [
            t('Buka "Pengaturan" > "Template Surat"', 'Open "Settings" > "Letter Templates"'),
            t('Edit template sesuai kebutuhan', 'Edit template as needed'),
            t('Preview sebelum menyimpan', 'Preview before saving'),
          ],
        },
        {
          title: t('Manajemen Admin', 'Admin Management'),
          steps: [
            t('Buka "Pengaturan" > "Admin"', 'Open "Settings" > "Admin"'),
            t('Tambah admin baru', 'Add new admin'),
            t('Atur hak akses per admin', 'Set access rights per admin'),
          ],
          warnings: [
            t('Hanya superadmin yang bisa menambah admin', 'Only superadmin can add admins'),
          ],
        },
      ],
    },
    {
      id: 'migration',
      title: t('Migrasi Data', 'Data Migration'),
      icon: Database,
      description: t('Import data dari sistem lama', 'Import data from old system'),
      content: [
        {
          title: t('Import Data Anggota', 'Import Member Data'),
          steps: [
            t('Buka menu "Anggota" > "Import"', 'Open "Members" > "Import" menu'),
            t('Download template Excel', 'Download Excel template'),
            t('Isi data sesuai format', 'Fill data according to format'),
            t('Upload dan verifikasi', 'Upload and verify'),
            t('Pilih metode klaim (email/password)', 'Select claim method (email/password)'),
            t('Proses import', 'Process import'),
          ],
          tips: [
            t('Gunakan NIK sebagai identifier unik', 'Use NIK as unique identifier'),
          ],
        },
        {
          title: t('Import Simpanan', 'Import Savings'),
          steps: [
            t('Buka menu "Migrasi" > "Simpanan"', 'Open "Migration" > "Savings" menu'),
            t('Download template dengan data anggota', 'Download template with member data'),
            t('Isi saldo simpanan per jenis', 'Fill savings balance per type'),
            t('Upload dan verifikasi', 'Upload and verify'),
            t('Proses migrasi', 'Process migration'),
          ],
          warnings: [
            t('Pastikan anggota sudah diimport terlebih dahulu', 'Make sure members are imported first'),
          ],
        },
        {
          title: t('Import Pinjaman & Angsuran', 'Import Loans & Installments'),
          steps: [
            t('Buka menu "Migrasi" > "Pinjaman"', 'Open "Migration" > "Loans" menu'),
            t('Import data pinjaman aktif', 'Import active loan data'),
            t('Import riwayat angsuran', 'Import installment history'),
            t('Verifikasi saldo terhitung', 'Verify calculated balance'),
          ],
        },
        {
          title: t('Rekonsiliasi Migrasi', 'Migration Reconciliation'),
          steps: [
            t('Buka "Laporan Migrasi" > "Rekonsiliasi"', 'Open "Migration Reports" > "Reconciliation"'),
            t('Bandingkan data sebelum dan sesudah', 'Compare before and after data'),
            t('Identifikasi selisih', 'Identify differences'),
            t('Koreksi jika diperlukan', 'Correct if needed'),
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
                {t('Panduan Administrator', 'Administrator Guide')}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Panduan lengkap pengelolaan sistem koperasi', 'Complete guide for cooperative system management')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('Cari topik panduan...', 'Search guide topics...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
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
              <Shield className="h-5 w-5 text-info" />
            </div>
            <div>
              <h4 className="font-medium text-sm">
                {t('Catatan Keamanan', 'Security Notes')}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  'Semua perubahan data dicatat di audit log. Pastikan untuk selalu logout setelah selesai menggunakan sistem.',
                  'All data changes are recorded in audit log. Make sure to always logout after using the system.'
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
