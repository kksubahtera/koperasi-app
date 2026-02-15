import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  FileText, 
  Wallet, 
  UserMinus, 
  Download, 
  Calendar as CalendarIcon,
  Filter,
  FileDown,
  Loader2,
  Settings,
  Archive,
  X,
  FileSignature,
  FileEdit
} from 'lucide-react';
import { LoanApprovalLetter } from '@/components/shared/LoanApprovalLetter';
import { WithdrawalConfirmation } from '@/components/shared/WithdrawalConfirmation';
import { RefundConfirmationLetter } from '@/components/shared/RefundConfirmationLetter';
import { FilterSelect } from '@/components/ui/filter-select';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';
import { toast } from 'sonner';
import { TabNavigation, TabItem } from '@/components/shared/TabNavigation';
import { LetterNumberSettings } from './LetterNumberSettings';
import { SignatureStampSettings } from './SignatureStampSettings';
import LetterTemplateSettings from './LetterTemplateSettings';

interface LoanLetter {
  id: string;
  memberName: string;
  memberNumber: string;
  principalAmount: number;
  tenor: number;
  interestRate: number;
  disbursementDate: string;
  approvedAt: string;
}

interface WithdrawalLetter {
  id: string;
  memberName: string;
  memberNumber: string;
  amount: number;
  date: string;
  approvedAt: string;
  paymentMethod: string;
  remainingBalance: number;
}

interface RefundLetter {
  id: string;
  memberName: string;
  memberNumber: string;
  exitDate: string;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  totalSavings: number;
  loanOutstanding: number;
  totalRefund: number;
  refundDate: string;
}

export const LetterArchive = () => {
  const { t } = useThemeLanguage();
  const [loanLetters, setLoanLetters] = useState<LoanLetter[]>([]);
  const [withdrawalLetters, setWithdrawalLetters] = useState<WithdrawalLetter[]>([]);
  const [refundLetters, setRefundLetters] = useState<RefundLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [activeMainTab, setActiveMainTab] = useState('archive');
  const [activeLetterTab, setActiveLetterTab] = useState('loans');
  
  // Dialog states
  const [selectedLoan, setSelectedLoan] = useState<LoanLetter | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalLetter | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<RefundLetter | null>(null);

  useEffect(() => {
    fetchAllLetters();
  }, []);

  const fetchAllLetters = async () => {
    setLoading(true);
    try {
      // Fetch approved loans (active or completed)
      const { data: loansData } = await supabase
        .from('loans')
        .select('id, principal_amount, tenor, interest_rate, disbursement_date, approved_at, user_id')
        .in('status', ['active', 'completed'])
        .order('approved_at', { ascending: false });

      if (loansData) {
        // Get member info for each loan
        const loanUserIds = loansData.map(l => l.user_id);
        const { data: loanProfiles } = await supabase
          .from('profiles')
          .select('user_id, name, member_number')
          .in('user_id', loanUserIds);

        const profileMap = new Map(loanProfiles?.map(p => [p.user_id, p]) || []);
        
        setLoanLetters(loansData.map(loan => {
          const profile = profileMap.get(loan.user_id);
          return {
            id: loan.id,
            memberName: profile?.name || 'Unknown',
            memberNumber: profile?.member_number || '-',
            principalAmount: loan.principal_amount,
            tenor: loan.tenor,
            interestRate: loan.interest_rate || 0.02,
            disbursementDate: loan.disbursement_date || '',
            approvedAt: loan.approved_at || '',
          };
        }));
      }

      // Fetch approved withdrawal transactions
      const { data: withdrawalsData } = await supabase
        .from('transactions')
        .select('id, amount, date, approved_at, user_id, payment_method')
        .eq('type', 'penarikan_simpanan_sukarela')
        .eq('status', 'approved')
        .order('approved_at', { ascending: false });

      if (withdrawalsData) {
        const withdrawalUserIds = withdrawalsData.map(w => w.user_id);
        const { data: withdrawalProfiles } = await supabase
          .from('profiles')
          .select('user_id, name, member_number')
          .in('user_id', withdrawalUserIds);

        const { data: savingsSummary } = await supabase
          .from('savings_summary')
          .select('user_id, simpanan_sukarela')
          .in('user_id', withdrawalUserIds);

        const profileMap = new Map(withdrawalProfiles?.map(p => [p.user_id, p]) || []);
        const savingsMap = new Map(savingsSummary?.map(s => [s.user_id, s.simpanan_sukarela || 0]) || []);

        setWithdrawalLetters(withdrawalsData.map(w => {
          const profile = profileMap.get(w.user_id);
          return {
            id: w.id,
            memberName: profile?.name || 'Unknown',
            memberNumber: profile?.member_number || '-',
            amount: w.amount,
            date: w.date || '',
            approvedAt: w.approved_at || '',
            paymentMethod: w.payment_method,
            remainingBalance: savingsMap.get(w.user_id) || 0,
          };
        }));
      }

      // Fetch inactive members with refunds (exit_date set)
      const { data: inactiveMembersData } = await supabase
        .from('profiles')
        .select('id, user_id, name, member_number, exit_date, is_active')
        .eq('is_active', false)
        .not('exit_date', 'is', null)
        .order('exit_date', { ascending: false });

      if (inactiveMembersData) {
        const inactiveUserIds = inactiveMembersData.map(m => m.user_id);
        
        const { data: savingsData } = await supabase
          .from('savings_summary')
          .select('user_id, simpanan_pokok, simpanan_wajib, simpanan_sukarela, total_simpanan')
          .in('user_id', inactiveUserIds);

        const { data: loansForRefund } = await supabase
          .from('loans')
          .select('user_id, remaining_principal')
          .in('user_id', inactiveUserIds)
          .eq('status', 'active');

        const savingsMap = new Map(savingsData?.map(s => [s.user_id, s]) || []);
        const loanMap = new Map<string, number>();
        loansForRefund?.forEach(l => {
          const current = loanMap.get(l.user_id) || 0;
          loanMap.set(l.user_id, current + (l.remaining_principal || 0));
        });

        setRefundLetters(inactiveMembersData.map(member => {
          const savings = savingsMap.get(member.user_id);
          const loanOutstanding = loanMap.get(member.user_id) || 0;
          const totalSavings = savings?.total_simpanan || 0;
          
          return {
            id: member.id,
            memberName: member.name,
            memberNumber: member.member_number || '-',
            exitDate: member.exit_date || '',
            simpananPokok: savings?.simpanan_pokok || 0,
            simpananWajib: savings?.simpanan_wajib || 0,
            simpananSukarela: savings?.simpanan_sukarela || 0,
            totalSavings,
            loanOutstanding,
            totalRefund: Math.max(0, totalSavings - loanOutstanding),
            refundDate: member.exit_date || '',
          };
        }));
      }
    } catch (error) {
      console.error('Error fetching letters:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get available years from all letters
  const getAvailableYears = () => {
    const years = new Set<string>();
    loanLetters.forEach(l => {
      const year = new Date(l.approvedAt || l.disbursementDate).getFullYear();
      if (!isNaN(year)) years.add(year.toString());
    });
    withdrawalLetters.forEach(w => {
      const year = new Date(w.approvedAt || w.date).getFullYear();
      if (!isNaN(year)) years.add(year.toString());
    });
    refundLetters.forEach(r => {
      const year = new Date(r.exitDate).getFullYear();
      if (!isNaN(year)) years.add(year.toString());
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  };

  // Filter functions
  const filterBySearch = <T extends { memberName: string; memberNumber: string }>(items: T[]) => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      item.memberName.toLowerCase().includes(term) || 
      item.memberNumber.toLowerCase().includes(term)
    );
  };

  const filterByYear = <T extends object>(items: T[], dateKey: keyof T) => {
    if (yearFilter === 'all') return items;
    return items.filter(item => {
      const dateValue = item[dateKey];
      if (typeof dateValue === 'string') {
        const year = new Date(dateValue).getFullYear();
        return year.toString() === yearFilter;
      }
      return false;
    });
  };

  const filterByDateRange = <T extends object>(items: T[], dateKey: keyof T) => {
    if (!startDate && !endDate) return items;
    return items.filter(item => {
      const dateValue = item[dateKey];
      if (typeof dateValue === 'string') {
        const itemDate = new Date(dateValue);
        if (startDate && endDate) {
          return itemDate >= startDate && itemDate <= endDate;
        } else if (startDate) {
          return itemDate >= startDate;
        } else if (endDate) {
          return itemDate <= endDate;
        }
      }
      return false;
    });
  };

  const applyFilters = <T extends { memberName: string; memberNumber: string }>(items: T[], dateKey: keyof T) => {
    let result = filterBySearch(items);
    result = filterByYear(result, dateKey);
    result = filterByDateRange(result, dateKey);
    return result;
  };

  const filteredLoans = applyFilters(loanLetters, 'approvedAt');
  const filteredWithdrawals = applyFilters(withdrawalLetters, 'approvedAt');
  const filteredRefunds = applyFilters(refundLetters, 'exitDate');

  const totalLetters = loanLetters.length + withdrawalLetters.length + refundLetters.length;
  const filteredTotal = filteredLoans.length + filteredWithdrawals.length + filteredRefunds.length;

  const clearDateFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasDateFilter = startDate || endDate;

  // Export all letters to PDF
  const handleExportAllPdf = async () => {
    if (filteredTotal === 0) {
      toast.error(t('Tidak ada surat untuk diexport', 'No letters to export'));
      return;
    }

    setExportingPdf(true);
    
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      // Fetch letter numbers from issued_letters
      const { data: issuedLettersData } = await supabase
        .from('issued_letters')
        .select('reference_id, letter_number, letter_type');
      
      // Create a map for quick lookup
      const letterNumberMap = new Map<string, string>();
      issuedLettersData?.forEach(letter => {
        letterNumberMap.set(letter.reference_id, letter.letter_number);
      });
      
      const doc = new jsPDF();
      const settings = getCooperativeSettings();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(settings.name, pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(settings.address, pageWidth / 2, 27, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(t('ARSIP SURAT RESMI', 'OFFICIAL LETTER ARCHIVE'), pageWidth / 2, 40, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const filterInfo = yearFilter === 'all' 
        ? t('Semua Tahun', 'All Years') 
        : `${t('Tahun', 'Year')}: ${yearFilter}`;
      doc.text(`${t('Dicetak', 'Printed')}: ${formatDate(new Date().toISOString())} | ${filterInfo}`, pageWidth / 2, 48, { align: 'center' });
      
      let yPos = 58;
      
      // Loan Letters Section
      if (filteredLoans.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`1. ${t('Surat Persetujuan Pinjaman', 'Loan Approval Letters')} (${filteredLoans.length})`, 14, yPos);
        yPos += 6;
        
        autoTable(doc, {
          startY: yPos,
          head: [[
            t('No', 'No'),
            t('No. Surat', 'Letter No.'),
            t('Nama Anggota', 'Member Name'),
            t('No. Anggota', 'Member No.'),
            t('Jumlah Pinjaman', 'Loan Amount'),
            t('Tenor', 'Tenor'),
            t('Tanggal', 'Date')
          ]],
          body: filteredLoans.map((loan, index) => [
            index + 1,
            letterNumberMap.get(loan.id) || '-',
            loan.memberName,
            loan.memberNumber,
            formatCurrency(loan.principalAmount),
            `${loan.tenor} ${t('bulan', 'months')}`,
            formatDate(loan.approvedAt || loan.disbursementDate)
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          margin: { left: 14, right: 14 },
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
      
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      // Withdrawal Letters Section
      if (filteredWithdrawals.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`2. ${t('Bukti Penarikan Simpanan', 'Withdrawal Receipts')} (${filteredWithdrawals.length})`, 14, yPos);
        yPos += 6;
        
        autoTable(doc, {
          startY: yPos,
          head: [[
            t('No', 'No'),
            t('No. Surat', 'Letter No.'),
            t('Nama Anggota', 'Member Name'),
            t('No. Anggota', 'Member No.'),
            t('Jumlah Penarikan', 'Withdrawal Amount'),
            t('Metode', 'Method'),
            t('Tanggal', 'Date')
          ]],
          body: filteredWithdrawals.map((w, index) => [
            index + 1,
            letterNumberMap.get(w.id) || '-',
            w.memberName,
            w.memberNumber,
            formatCurrency(w.amount),
            w.paymentMethod === 'transfer_bank' ? 'Transfer Bank' : 'E-Wallet',
            formatDate(w.approvedAt || w.date)
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [34, 197, 94], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          margin: { left: 14, right: 14 },
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
      
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      // Refund Letters Section
      if (filteredRefunds.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`3. ${t('Surat Pengunduran Diri', 'Resignation Letters')} (${filteredRefunds.length})`, 14, yPos);
        yPos += 6;
        
        autoTable(doc, {
          startY: yPos,
          head: [[
            t('No', 'No'),
            t('No. Surat', 'Letter No.'),
            t('Nama Anggota', 'Member Name'),
            t('No. Anggota', 'Member No.'),
            t('Total Simpanan', 'Total Savings'),
            t('Total Pengembalian', 'Total Refund'),
            t('Tanggal Keluar', 'Exit Date')
          ]],
          body: filteredRefunds.map((r, index) => [
            index + 1,
            letterNumberMap.get(r.id) || '-',
            r.memberName,
            r.memberNumber,
            formatCurrency(r.totalSavings),
            formatCurrency(r.totalRefund),
            formatDate(r.exitDate)
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [245, 158, 11], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          margin: { left: 14, right: 14 },
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
      
      // Footer on last page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `${t('Halaman', 'Page')} ${i} ${t('dari', 'of')} ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }
      
      // Save the PDF
      const fileName = `arsip-surat-${yearFilter === 'all' ? 'semua' : yearFilter}-${new Date().getTime()}.pdf`;
      doc.save(fileName);
      
      toast.success(t('PDF berhasil diunduh', 'PDF downloaded successfully'));
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error(t('Gagal mengexport PDF', 'Failed to export PDF'));
    } finally {
      setExportingPdf(false);
    }
  };

  // Export all letters to Excel
  const handleExportExcel = async () => {
    if (filteredTotal === 0) {
      toast.error(t('Tidak ada surat untuk diexport', 'No letters to export'));
      return;
    }

    setExportingExcel(true);
    
    try {
      const { createAndDownloadExcel } = await import('@/lib/excelUtils');
      type SheetData = { name: string; data: any[][]; columns?: { width: number }[] };
      const settings = getCooperativeSettings();

      // Fetch issued letters for letter numbers
      const { data: issuedLettersData } = await supabase
        .from('issued_letters')
        .select('reference_id, letter_number, letter_type');
      
      // Create map of reference_id to letter_number
      const letterNumberMap = new Map<string, string>();
      issuedLettersData?.forEach(letter => {
        letterNumberMap.set(letter.reference_id, letter.letter_number);
      });

      const sheets: SheetData[] = [];

      // Summary sheet
      const summaryData = [
        [settings.name],
        [settings.address],
        [''],
        [t('REKAP ARSIP SURAT RESMI', 'OFFICIAL LETTER ARCHIVE SUMMARY')],
        [''],
        [t('Filter Tahun', 'Year Filter'), yearFilter === 'all' ? t('Semua', 'All') : yearFilter],
        [t('Tanggal Export', 'Export Date'), formatDate(new Date().toISOString())],
        [''],
        [t('Jenis Surat', 'Letter Type'), t('Jumlah', 'Count')],
        [t('Surat Persetujuan Pinjaman', 'Loan Approval Letters'), filteredLoans.length],
        [t('Bukti Penarikan Simpanan', 'Withdrawal Receipts'), filteredWithdrawals.length],
        [t('Surat Pengunduran Diri', 'Resignation Letters'), filteredRefunds.length],
        [t('Total', 'Total'), filteredTotal],
      ];
      sheets.push({
        name: t('Ringkasan', 'Summary'),
        data: summaryData,
        columns: [{ width: 35 }, { width: 20 }]
      });

      // Loan letters sheet
      if (filteredLoans.length > 0) {
        const loanHeaders = [
          t('No', 'No'),
          t('No. Surat', 'Letter No.'),
          t('Nama Anggota', 'Member Name'),
          t('No. Anggota', 'Member No.'),
          t('Jumlah Pinjaman', 'Loan Amount'),
          t('Tenor (Bulan)', 'Tenor (Months)'),
          t('Bunga (%)', 'Interest (%)'),
          t('Tanggal Pencairan', 'Disbursement Date'),
          t('Tanggal Persetujuan', 'Approval Date'),
        ];
        const loanData = filteredLoans.map((loan, index) => [
          index + 1,
          letterNumberMap.get(loan.id) || '-',
          loan.memberName,
          loan.memberNumber,
          loan.principalAmount,
          loan.tenor,
          (loan.interestRate * 100).toFixed(1),
          formatDate(loan.disbursementDate),
          formatDate(loan.approvedAt),
        ]);
        sheets.push({
          name: t('Pinjaman', 'Loans'),
          data: [loanHeaders, ...loanData],
          columns: [
            { width: 5 }, { width: 20 }, { width: 25 }, { width: 15 }, { width: 18 }, 
            { width: 12 }, { width: 10 }, { width: 15 }, { width: 15 }
          ]
        });
      }

      // Withdrawal letters sheet
      if (filteredWithdrawals.length > 0) {
        const withdrawalHeaders = [
          t('No', 'No'),
          t('No. Surat', 'Letter No.'),
          t('Nama Anggota', 'Member Name'),
          t('No. Anggota', 'Member No.'),
          t('Jumlah Penarikan', 'Withdrawal Amount'),
          t('Metode Pembayaran', 'Payment Method'),
          t('Saldo Tersisa', 'Remaining Balance'),
          t('Tanggal Transaksi', 'Transaction Date'),
          t('Tanggal Persetujuan', 'Approval Date'),
        ];
        const withdrawalData = filteredWithdrawals.map((w, index) => [
          index + 1,
          letterNumberMap.get(w.id) || '-',
          w.memberName,
          w.memberNumber,
          w.amount,
          w.paymentMethod === 'transfer_bank' ? 'Transfer Bank' : 'E-Wallet',
          w.remainingBalance,
          formatDate(w.date),
          formatDate(w.approvedAt),
        ]);
        sheets.push({
          name: t('Penarikan', 'Withdrawals'),
          data: [withdrawalHeaders, ...withdrawalData],
          columns: [
            { width: 5 }, { width: 20 }, { width: 25 }, { width: 15 }, { width: 18 },
            { width: 18 }, { width: 18 }, { width: 15 }, { width: 15 }
          ]
        });
      }

      // Refund letters sheet
      if (filteredRefunds.length > 0) {
        const refundHeaders = [
          t('No', 'No'),
          t('No. Surat', 'Letter No.'),
          t('Nama Anggota', 'Member Name'),
          t('No. Anggota', 'Member No.'),
          t('Simpanan Pokok', 'Principal Savings'),
          t('Simpanan Wajib', 'Mandatory Savings'),
          t('Simpanan Sukarela', 'Voluntary Savings'),
          t('Total Simpanan', 'Total Savings'),
          t('Sisa Pinjaman', 'Loan Outstanding'),
          t('Total Pengembalian', 'Total Refund'),
          t('Tanggal Keluar', 'Exit Date'),
        ];
        const refundData = filteredRefunds.map((r, index) => [
          index + 1,
          letterNumberMap.get(r.id) || '-',
          r.memberName,
          r.memberNumber,
          r.simpananPokok,
          r.simpananWajib,
          r.simpananSukarela,
          r.totalSavings,
          r.loanOutstanding,
          r.totalRefund,
          formatDate(r.exitDate),
        ]);
        sheets.push({
          name: t('Pengunduran Diri', 'Resignations'),
          data: [refundHeaders, ...refundData],
          columns: [
            { width: 5 }, { width: 20 }, { width: 25 }, { width: 15 }, { width: 15 },
            { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 18 }, { width: 15 }
          ]
        });
      }

      // Save the file
      const fileName = `arsip-surat-${yearFilter === 'all' ? 'semua' : yearFilter}-${new Date().getTime()}.xlsx`;
      await createAndDownloadExcel(sheets, fileName);
      
      toast.success(t('Excel berhasil diunduh', 'Excel downloaded successfully'));
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error(t('Gagal mengexport Excel', 'Failed to export Excel'));
    } finally {
      setExportingExcel(false);
    }
  };

  const mainTabs: TabItem[] = [
    { value: 'archive', icon: Archive, label: t('Arsip Surat', 'Letter Archive') },
    { value: 'signature', icon: FileSignature, label: t('Tanda Tangan & Stempel', 'Signature & Stamp') },
    { value: 'templates', icon: FileEdit, label: t('Format Template', 'Letter Templates') },
    { value: 'settings', icon: Settings, label: t('Pengaturan Nomor', 'Number Settings') },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('Arsip Surat', 'Letter Archive')}
          </h1>
          <p className="text-muted-foreground">
            {t('Kelola dan unduh semua surat resmi koperasi', 'Manage and download all official cooperative letters')}
          </p>
        </div>
        {activeMainTab === 'archive' && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="w-fit">
              {totalLetters} {t('Surat', 'Letters')}
            </Badge>
            <Button 
              variant="outline"
              onClick={handleExportExcel}
              disabled={exportingExcel || filteredTotal === 0}
              className="gap-2"
            >
              {exportingExcel ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              Excel
            </Button>
            <Button 
              onClick={handleExportAllPdf}
              disabled={exportingPdf || filteredTotal === 0}
              className="gap-2"
            >
              {exportingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              PDF
            </Button>
          </div>
        )}
      </div>

      {/* Main Tabs - Archive vs Settings */}
      <TabNavigation
        tabs={mainTabs}
        activeTab={activeMainTab}
        onTabChange={setActiveMainTab}
      />

      {/* Signature Tab Content */}
      {activeMainTab === 'signature' && (
        <SignatureStampSettings />
      )}

      {/* Templates Tab Content */}
      {activeMainTab === 'templates' && (
        <div className="animate-fade-in">
          <LetterTemplateSettings />
        </div>
      )}

      {/* Settings Tab Content */}
      {activeMainTab === 'settings' && (
        <div className="animate-fade-in">
          <LetterNumberSettings />
        </div>
      )}

      {/* Archive Tab Content */}
      {activeMainTab === 'archive' && (
        <>
          {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loanLetters.length}</p>
              <p className="text-sm text-muted-foreground">{t('Surat Pinjaman', 'Loan Letters')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{withdrawalLetters.length}</p>
              <p className="text-sm text-muted-foreground">{t('Bukti Penarikan', 'Withdrawal Receipts')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <UserMinus className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{refundLetters.length}</p>
              <p className="text-sm text-muted-foreground">{t('Surat Pengunduran', 'Refund Letters')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <SearchInput
              placeholder={t('Cari berdasarkan nama atau nomor anggota...', 'Search by name or member number...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              containerClassName="flex-1"
            />
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <FilterSelect
                value={yearFilter}
                onValueChange={setYearFilter}
                options={getAvailableYears().map(year => ({ value: year, label: year }))}
                placeholder={t('Tahun', 'Year')}
                allLabel={t('Semua Tahun', 'All Years')}
                triggerClassName="w-[140px]"
              />
            </div>
          </div>
          
          {/* Date Range Filter */}
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onClear={clearDateFilter}
            startPlaceholder={t('Dari', 'From')}
            endPlaceholder={t('Sampai', 'To')}
            showLabel
            label={t('Rentang Tanggal:', 'Date Range:')}
          />
          
          {/* Active Filters Summary */}
          {(yearFilter !== 'all' || hasDateFilter || searchTerm) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('Filter aktif:', 'Active filters:')}</span>
              {searchTerm && (
                <Badge variant="secondary" className="gap-1">
                  {t('Pencarian', 'Search')}: "{searchTerm}"
                </Badge>
              )}
              {yearFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {t('Tahun', 'Year')}: {yearFilter}
                </Badge>
              )}
              {hasDateFilter && (
                <Badge variant="secondary" className="gap-1">
                  {t('Tanggal', 'Date')}: {startDate ? format(startDate, "dd/MM/yy") : '...'} - {endDate ? format(endDate, "dd/MM/yy") : '...'}
                </Badge>
              )}
              <span className="text-muted-foreground">
                ({filteredTotal} {t('hasil', 'results')})
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Letters Tabs */}
      <div className="space-y-4">
        <TabNavigation
          tabs={[
            {
              value: 'loans',
              icon: FileText,
              label: t('Pinjaman', 'Loans'),
              tooltip: t('Surat persetujuan pinjaman', 'Loan approval letters'),
              badge: filteredLoans.length,
            },
            {
              value: 'withdrawals',
              icon: Wallet,
              label: t('Penarikan', 'Withdrawals'),
              tooltip: t('Bukti penarikan simpanan', 'Withdrawal receipts'),
              badge: filteredWithdrawals.length,
            },
            {
              value: 'refunds',
              icon: UserMinus,
              label: t('Pengunduran', 'Refunds'),
              tooltip: t('Surat pengunduran diri', 'Resignation letters'),
              badge: filteredRefunds.length,
            },
          ]}
          activeTab={activeLetterTab}
          onTabChange={setActiveLetterTab}
        />

        {/* Loan Letters */}
        {activeLetterTab === 'loans' && (
          <div className="space-y-4 animate-fade-in">
            {loading ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">{t('Memuat...', 'Loading...')}</CardContent></Card>
            ) : filteredLoans.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">{t('Tidak ada surat pinjaman', 'No loan letters found')}</CardContent></Card>
            ) : (
              <div className="grid gap-4">
                {filteredLoans.map(loan => (
                  <Card key={loan.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{loan.memberName}</p>
                          <p className="text-sm text-muted-foreground">{loan.memberNumber}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {formatDate(loan.approvedAt || loan.disbursementDate)}
                            </span>
                            <span>•</span>
                            <span>{formatCurrency(loan.principalAmount)}</span>
                            <span>•</span>
                            <span>{loan.tenor} {t('bulan', 'months')}</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedLoan(loan)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {t('Unduh', 'Download')}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Withdrawal Letters */}
        {activeLetterTab === 'withdrawals' && (
          <div className="space-y-4 animate-fade-in">
            {loading ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">{t('Memuat...', 'Loading...')}</CardContent></Card>
            ) : filteredWithdrawals.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">{t('Tidak ada bukti penarikan', 'No withdrawal receipts found')}</CardContent></Card>
            ) : (
              <div className="grid gap-4">
                {filteredWithdrawals.map(withdrawal => (
                  <Card key={withdrawal.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                          <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{withdrawal.memberName}</p>
                          <p className="text-sm text-muted-foreground">{withdrawal.memberNumber}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {formatDate(withdrawal.approvedAt || withdrawal.date)}
                            </span>
                            <span>•</span>
                            <span className="text-red-500 font-medium">-{formatCurrency(withdrawal.amount)}</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedWithdrawal(withdrawal)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {t('Unduh', 'Download')}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Refund Letters */}
        {activeLetterTab === 'refunds' && (
          <div className="space-y-4 animate-fade-in">
            {loading ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">{t('Memuat...', 'Loading...')}</CardContent></Card>
            ) : filteredRefunds.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">{t('Tidak ada surat pengunduran', 'No refund letters found')}</CardContent></Card>
            ) : (
              <div className="grid gap-4">
                {filteredRefunds.map(refund => (
                  <Card key={refund.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                          <UserMinus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{refund.memberName}</p>
                          <p className="text-sm text-muted-foreground">{refund.memberNumber}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {formatDate(refund.exitDate)}
                            </span>
                            <span>•</span>
                            <span className="text-green-600 font-medium">{formatCurrency(refund.totalRefund)}</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedRefund(refund)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {t('Unduh', 'Download')}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Letter Dialogs */}
      {selectedLoan && (
        <LoanApprovalLetter
          open={!!selectedLoan}
          onClose={() => setSelectedLoan(null)}
          loan={selectedLoan}
        />
      )}

      {selectedWithdrawal && (
        <WithdrawalConfirmation
          open={!!selectedWithdrawal}
          onClose={() => setSelectedWithdrawal(null)}
          withdrawal={selectedWithdrawal}
        />
      )}

      {selectedRefund && (
        <RefundConfirmationLetter
          open={!!selectedRefund}
          onClose={() => setSelectedRefund(null)}
          refund={selectedRefund}
        />
      )}
        </>
      )}
    </div>
  );
};
