import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { 
  Loader2, Building2, Calculator, CheckCircle2, AlertTriangle, 
  Plus, Download, Calendar, FileText, Trash2, Save, RefreshCw, Printer
} from 'lucide-react';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { useBankReconciliations } from '@/hooks/useBankReconciliations';
import { format, endOfMonth, parseISO, startOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { createAndDownloadExcelMixed } from '@/lib/excelUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QuickEquationGuide } from './QuickEquationGuide';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface OutstandingItem {
  id: string;
  type: 'deposit_in_transit' | 'outstanding_check' | 'bank_charge' | 'bank_interest' | 'error_correction' | 'other';
  description: string;
  amount: number;
  date: string;
  cleared: boolean;
}

export const BankReconciliation = () => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [bankStatementBalance, setBankStatementBalance] = useState<string>('');
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [outstandingItems, setOutstandingItems] = useState<OutstandingItem[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState<Partial<OutstandingItem>>({
    type: 'deposit_in_transit',
    description: '',
    amount: 0,
    date: format(currentDate, 'yyyy-MM-dd'),
    cleared: false
  });
  const [activeTab, setActiveTab] = useState<'reconcile' | 'history'>('reconcile');
  const [loadingExisting, setLoadingExisting] = useState(false);

  const { entries, loading: entriesLoading } = useJournalEntries(selectedYear);
  const { accounts, loading: accountsLoading } = useChartOfAccounts();
  const { 
    reconciliations, 
    loading: reconciliationsLoading, 
    saving,
    getReconciliationByPeriod,
    saveReconciliation,
    deleteReconciliation 
  } = useBankReconciliations();

  const loading = entriesLoading || accountsLoading;

  // Load existing reconciliation when period changes
  useEffect(() => {
    const loadExistingReconciliation = async () => {
      setLoadingExisting(true);
      const existing = await getReconciliationByPeriod(selectedMonth, selectedYear);
      if (existing) {
        setBankStatementBalance(existing.bank_statement_balance.toString());
        setOutstandingItems(existing.outstanding_items || []);
        setReconciliationNotes(existing.notes || '');
      } else {
        // Reset form for new period
        setBankStatementBalance('');
        setOutstandingItems([]);
        setReconciliationNotes('');
      }
      setLoadingExisting(false);
    };
    
    loadExistingReconciliation();
  }, [selectedMonth, selectedYear]);

  // Find bank accounts
  const bankAccounts = useMemo(() => {
    return accounts.filter(acc => 
      acc.account_code.startsWith('1-1') && 
      (acc.account_name.toLowerCase().includes('bank') || acc.account_code === '1-110')
    );
  }, [accounts]);

  // Get date range for selected month
  const dateRange = useMemo(() => {
    const start = startOfMonth(new Date(selectedYear, selectedMonth - 1));
    const end = endOfMonth(new Date(selectedYear, selectedMonth - 1));
    return { start, end };
  }, [selectedYear, selectedMonth]);

  // Calculate book balance from journal entries
  const bookBalance = useMemo(() => {
    const bankAccountIds = bankAccounts.map(a => a.id);
    let balance = 0;

    const filteredEntries = entries.filter(entry => {
      if (entry.status !== 'posted') return false;
      const entryDate = parseISO(entry.entry_date);
      return entryDate <= dateRange.end;
    });

    filteredEntries.forEach(entry => {
      const lines = (entry as any).journal_entry_lines || [];
      lines.forEach((line: any) => {
        if (bankAccountIds.includes(line.account_id)) {
          balance += (line.debit_amount || 0) - (line.credit_amount || 0);
        }
      });
    });

    return balance;
  }, [entries, bankAccounts, dateRange]);

  // Calculate adjustments
  const calculations = useMemo(() => {
    const bankBalance = parseFloat(bankStatementBalance) || 0;
    
    // Items that adjust book balance
    const bankCharges = outstandingItems
      .filter(i => i.type === 'bank_charge' && !i.cleared)
      .reduce((sum, i) => sum + i.amount, 0);
    
    const bankInterest = outstandingItems
      .filter(i => i.type === 'bank_interest' && !i.cleared)
      .reduce((sum, i) => sum + i.amount, 0);
    
    const errorCorrectionsBook = outstandingItems
      .filter(i => i.type === 'error_correction' && !i.cleared)
      .reduce((sum, i) => sum + i.amount, 0);

    // Items that adjust bank statement balance
    const depositsInTransit = outstandingItems
      .filter(i => i.type === 'deposit_in_transit' && !i.cleared)
      .reduce((sum, i) => sum + i.amount, 0);
    
    const outstandingChecks = outstandingItems
      .filter(i => i.type === 'outstanding_check' && !i.cleared)
      .reduce((sum, i) => sum + i.amount, 0);

    const adjustedBookBalance = bookBalance - bankCharges + bankInterest + errorCorrectionsBook;
    const adjustedBankBalance = bankBalance + depositsInTransit - outstandingChecks;
    const difference = adjustedBookBalance - adjustedBankBalance;

    return {
      bankCharges,
      bankInterest,
      errorCorrectionsBook,
      depositsInTransit,
      outstandingChecks,
      adjustedBookBalance,
      adjustedBankBalance,
      difference,
      isReconciled: Math.abs(difference) < 1 // Allow small rounding differences
    };
  }, [bookBalance, bankStatementBalance, outstandingItems]);

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);
  const months = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  const itemTypes = [
    { value: 'deposit_in_transit', label: 'Setoran Dalam Perjalanan', description: 'Setoran yang sudah dicatat tapi belum masuk rekening koran' },
    { value: 'outstanding_check', label: 'Cek Beredar', description: 'Cek yang sudah dicatat tapi belum dicairkan' },
    { value: 'bank_charge', label: 'Biaya Bank', description: 'Biaya administrasi/transfer yang belum dicatat' },
    { value: 'bank_interest', label: 'Bunga Bank', description: 'Pendapatan bunga yang belum dicatat' },
    { value: 'error_correction', label: 'Koreksi Kesalahan', description: 'Koreksi atas kesalahan pencatatan' },
    { value: 'other', label: 'Lainnya', description: 'Item rekonsiliasi lainnya' },
  ];

  const handleAddItem = () => {
    if (!newItem.description || !newItem.amount) {
      toast.error('Lengkapi keterangan dan jumlah');
      return;
    }

    const item: OutstandingItem = {
      id: Date.now().toString(),
      type: newItem.type as OutstandingItem['type'],
      description: newItem.description || '',
      amount: newItem.amount || 0,
      date: newItem.date || format(currentDate, 'yyyy-MM-dd'),
      cleared: false
    };

    setOutstandingItems([...outstandingItems, item]);
    setNewItem({
      type: 'deposit_in_transit',
      description: '',
      amount: 0,
      date: format(currentDate, 'yyyy-MM-dd'),
      cleared: false
    });
    setShowAddItem(false);
    toast.success('Item berhasil ditambahkan');
  };

  const handleRemoveItem = (id: string) => {
    setOutstandingItems(outstandingItems.filter(i => i.id !== id));
    toast.success('Item berhasil dihapus');
  };

  const handleToggleCleared = (id: string) => {
    setOutstandingItems(outstandingItems.map(i => 
      i.id === id ? { ...i, cleared: !i.cleared } : i
    ));
  };

  const handleSaveReconciliation = async () => {
    const bankBalance = parseFloat(bankStatementBalance) || 0;
    
    await saveReconciliation({
      reconciliation_date: format(new Date(), 'yyyy-MM-dd'),
      period_month: selectedMonth,
      period_year: selectedYear,
      bank_statement_balance: bankBalance,
      book_balance: bookBalance,
      adjusted_bank_balance: calculations.adjustedBankBalance,
      adjusted_book_balance: calculations.adjustedBookBalance,
      difference: calculations.difference,
      is_reconciled: calculations.isReconciled,
      outstanding_items: [...outstandingItems],
      notes: reconciliationNotes || undefined,
    });
  };

  const handleResetForm = () => {
    setBankStatementBalance('');
    setOutstandingItems([]);
    setReconciliationNotes('');
  };

  const exportToExcel = () => {
    const bankBalance = parseFloat(bankStatementBalance) || 0;
    const monthName = months.find(m => m.value === selectedMonth)?.label;

    const reconciliationData = [
      ['REKONSILIASI BANK'],
      [`Periode: ${monthName} ${selectedYear}`],
      [''],
      ['SALDO MENURUT BUKU', '', formatCurrency(bookBalance)],
      ['Dikurangi: Biaya Bank', '', formatCurrency(-calculations.bankCharges)],
      ['Ditambah: Bunga Bank', '', formatCurrency(calculations.bankInterest)],
      ['Koreksi Kesalahan', '', formatCurrency(calculations.errorCorrectionsBook)],
      ['SALDO BUKU DISESUAIKAN', '', formatCurrency(calculations.adjustedBookBalance)],
      [''],
      ['SALDO MENURUT REKENING KORAN', '', formatCurrency(bankBalance)],
      ['Ditambah: Setoran Dalam Perjalanan', '', formatCurrency(calculations.depositsInTransit)],
      ['Dikurangi: Cek Beredar', '', formatCurrency(-calculations.outstandingChecks)],
      ['SALDO BANK DISESUAIKAN', '', formatCurrency(calculations.adjustedBankBalance)],
      [''],
      ['SELISIH', '', formatCurrency(calculations.difference)],
      ['STATUS', '', calculations.isReconciled ? 'COCOK' : 'TIDAK COCOK'],
    ];

    const itemsData = outstandingItems.map((item, idx) => ({
      'No': idx + 1,
      'Tanggal': format(parseISO(item.date), 'dd/MM/yyyy'),
      'Jenis': itemTypes.find(t => t.value === item.type)?.label || item.type,
      'Keterangan': item.description,
      'Jumlah': item.amount,
      'Status': item.cleared ? 'Sudah Klir' : 'Belum Klir'
    }));
    createAndDownloadExcelMixed(
      [
        { type: 'aoa', name: 'Rekonsiliasi', data: reconciliationData },
        { type: 'json', name: 'Item Outstanding', data: itemsData }
      ],
      `Rekonsiliasi_Bank_${monthName}_${selectedYear}.xlsx`
    );
    toast.success('Berhasil diekspor ke Excel');
  };

  const exportToPDF = () => {
    const bankBalance = parseFloat(bankStatementBalance) || 0;
    const monthName = months.find(m => m.value === selectedMonth)?.label || '';
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN REKONSILIASI BANK', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode: ${monthName} ${selectedYear}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Tanggal Cetak: ${format(new Date(), 'dd MMMM yyyy', { locale: id })}`, pageWidth / 2, 35, { align: 'center' });
    
    // Separator line
    doc.setLineWidth(0.5);
    doc.line(14, 40, pageWidth - 14, 40);
    
    let yPos = 50;
    
    // Book Balance Section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SALDO MENURUT BUKU', 14, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const formatAmount = (amount: number) => {
      return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };
    
    // Book balance table
    autoTable(doc, {
      startY: yPos,
      head: [],
      body: [
        ['Saldo Akhir Buku Bank', '', `Rp ${formatAmount(bookBalance)}`],
        ['Dikurangi: Biaya Bank', '', `(Rp ${formatAmount(calculations.bankCharges)})`],
        ['Ditambah: Bunga Bank', '', `Rp ${formatAmount(calculations.bankInterest)}`],
        ['Koreksi Kesalahan', '', `Rp ${formatAmount(calculations.errorCorrectionsBook)}`],
        [{ content: 'SALDO BUKU DISESUAIKAN', styles: { fontStyle: 'bold' } }, '', { content: `Rp ${formatAmount(calculations.adjustedBookBalance)}`, styles: { fontStyle: 'bold' } }],
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30 },
        2: { cellWidth: 60, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
    
    // Bank Statement Section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SALDO MENURUT REKENING KORAN', 14, yPos);
    yPos += 8;
    
    autoTable(doc, {
      startY: yPos,
      head: [],
      body: [
        ['Saldo Rekening Koran Bank', '', `Rp ${formatAmount(bankBalance)}`],
        ['Ditambah: Setoran Dalam Perjalanan', '', `Rp ${formatAmount(calculations.depositsInTransit)}`],
        ['Dikurangi: Cek Beredar', '', `(Rp ${formatAmount(calculations.outstandingChecks)})`],
        [{ content: 'SALDO BANK DISESUAIKAN', styles: { fontStyle: 'bold' } }, '', { content: `Rp ${formatAmount(calculations.adjustedBankBalance)}`, styles: { fontStyle: 'bold' } }],
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30 },
        2: { cellWidth: 60, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
    
    // Result Section
    doc.setLineWidth(0.3);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 8;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    
    const statusText = calculations.isReconciled ? 'COCOK' : 'TIDAK COCOK';
    const statusColor = calculations.isReconciled ? [34, 197, 94] : [239, 68, 68];
    
    doc.text(`SELISIH: Rp ${formatAmount(calculations.difference)}`, 14, yPos);
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(`STATUS: ${statusText}`, pageWidth - 14, yPos, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    
    yPos += 15;
    
    // Outstanding Items Section
    if (outstandingItems.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('DAFTAR ITEM REKONSILIASI', 14, yPos);
      yPos += 8;
      
      const itemsTableData = outstandingItems.map((item, idx) => [
        (idx + 1).toString(),
        format(parseISO(item.date), 'dd/MM/yyyy'),
        itemTypes.find(t => t.value === item.type)?.label || item.type,
        item.description,
        `Rp ${formatAmount(item.amount)}`,
        item.cleared ? 'Sudah Klir' : 'Belum Klir'
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['No', 'Tanggal', 'Jenis', 'Keterangan', 'Jumlah', 'Status']],
        body: itemsTableData,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 25 },
          2: { cellWidth: 35 },
          3: { cellWidth: 55 },
          4: { cellWidth: 30, halign: 'right' },
          5: { cellWidth: 25, halign: 'center' },
        },
        margin: { left: 14, right: 14 },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Notes Section
    if (reconciliationNotes) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('CATATAN:', 14, yPos);
      yPos += 6;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const splitNotes = doc.splitTextToSize(reconciliationNotes, pageWidth - 28);
      doc.text(splitNotes, 14, yPos);
    }
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Halaman ${i} dari ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
    
    // Save PDF
    doc.save(`Rekonsiliasi_Bank_${monthName}_${selectedYear}.pdf`);
    toast.success('Berhasil diekspor ke PDF');
  };

  if (loading || loadingExisting) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Reference Guide */}
      <QuickEquationGuide variant="bank-reconciliation" />

      {/* Header */}
      <Card>
        <CardHeader className="py-3 sm:py-4 px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <CardTitle className="text-base sm:text-lg">Rekonsiliasi Bank</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-20 sm:w-24 h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-24 sm:w-32 h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <CardDescription className="text-xs sm:text-sm mt-2">
            Cocokkan saldo buku dengan rekening koran bank untuk periode {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeTab === 'reconcile' ? 'default' : 'outline'}
            onClick={() => setActiveTab('reconcile')}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
          >
            <Calculator className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Rekonsiliasi
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            onClick={() => setActiveTab('history')}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
          >
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Riwayat
          </Button>
        </div>

        {activeTab === 'reconcile' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Balance Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Book Balance */}
            <Card>
              <CardHeader className="py-2 sm:py-3 px-3 sm:px-6">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                  Saldo Menurut Buku
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs sm:text-sm text-muted-foreground">Saldo Akhir Buku Bank</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-600">{formatCurrency(bookBalance)}</p>
                </div>
                
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dikurangi: Biaya Bank</span>
                    <span className="text-rose-600">({formatCurrency(calculations.bankCharges)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ditambah: Bunga Bank</span>
                    <span className="text-emerald-600">+{formatCurrency(calculations.bankInterest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Koreksi Kesalahan</span>
                    <span>{formatCurrency(calculations.errorCorrectionsBook)}</span>
                  </div>
                  <hr className="my-1.5 sm:my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Saldo Buku Disesuaikan</span>
                    <span className="text-blue-600">{formatCurrency(calculations.adjustedBookBalance)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bank Statement Balance */}
            <Card>
              <CardHeader className="py-2 sm:py-3 px-3 sm:px-6">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
                  Saldo Menurut Rekening Koran
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Saldo Rekening Koran</Label>
                  <Input
                    type="number"
                    placeholder="Masukkan saldo dari rekening koran"
                    value={bankStatementBalance}
                    onChange={(e) => setBankStatementBalance(e.target.value)}
                    className="text-sm sm:text-lg h-9 sm:h-10"
                  />
                </div>
                
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ditambah: Setoran Dalam Perjalanan</span>
                    <span className="text-emerald-600">+{formatCurrency(calculations.depositsInTransit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dikurangi: Cek Beredar</span>
                    <span className="text-rose-600">({formatCurrency(calculations.outstandingChecks)})</span>
                  </div>
                  <hr className="my-1.5 sm:my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Saldo Bank Disesuaikan</span>
                    <span className="text-emerald-600">{formatCurrency(calculations.adjustedBankBalance)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reconciliation Result */}
          <Card className={calculations.isReconciled 
            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' 
            : 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/10'
          }>
            <CardContent className="py-3 sm:py-4 px-3 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  {calculations.isReconciled ? (
                    <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-amber-600 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold text-base sm:text-lg">
                      {calculations.isReconciled ? 'Saldo Cocok!' : 'Terdapat Selisih'}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Selisih: {formatCurrency(calculations.difference)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <Button variant="outline" size="sm" onClick={handleResetForm} className="h-8 text-xs sm:text-sm px-2 sm:px-3">
                    <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Reset</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportToPDF} className="h-8 text-xs sm:text-sm px-2 sm:px-3">
                    <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Cetak PDF</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportToExcel} className="h-8 text-xs sm:text-sm px-2 sm:px-3">
                    <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Excel</span>
                  </Button>
                  <Button size="sm" onClick={handleSaveReconciliation} disabled={saving} className="h-8 text-xs sm:text-sm px-2 sm:px-3">
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin sm:mr-2" />
                    ) : (
                      <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    )}
                    <span className="hidden sm:inline">{saving ? 'Menyimpan...' : 'Simpan'}</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Outstanding Items */}
          <Card>
            <CardHeader className="py-2 sm:py-3 px-3 sm:px-6 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm sm:text-base">Item Rekonsiliasi</CardTitle>
              <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 text-xs sm:text-sm px-2 sm:px-3">
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Tambah Item</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">Tambah Item Rekonsiliasi</DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                      Tambahkan item yang menyebabkan perbedaan antara saldo buku dan rekening koran
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Jenis Item</Label>
                      <Select 
                        value={newItem.type} 
                        onValueChange={(v) => setNewItem({ ...newItem, type: v as OutstandingItem['type'] })}
                      >
                        <SelectTrigger className="text-xs sm:text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {itemTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <div>
                                <p className="text-xs sm:text-sm">{type.label}</p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">{type.description}</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Tanggal</Label>
                      <Input
                        type="date"
                        value={newItem.date}
                        onChange={(e) => setNewItem({ ...newItem, date: e.target.value })}
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Keterangan</Label>
                      <Input
                        placeholder="Contoh: Setoran tunai 25 Des belum masuk rekening"
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Jumlah</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={newItem.amount || ''}
                        onChange={(e) => setNewItem({ ...newItem, amount: parseFloat(e.target.value) || 0 })}
                        className="text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setShowAddItem(false)} className="text-xs sm:text-sm">Batal</Button>
                    <Button onClick={handleAddItem} className="text-xs sm:text-sm">Tambah</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {outstandingItems.length === 0 ? (
                <div className="text-center text-muted-foreground py-6 sm:py-8 px-3">
                  <p className="text-xs sm:text-sm">Belum ada item rekonsiliasi</p>
                  <p className="text-[10px] sm:text-xs">Klik "Tambah Item" untuk menambahkan item yang menyebabkan selisih</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-8 sm:w-10 text-[10px] sm:text-xs">Klir</TableHead>
                        <TableHead className="w-20 sm:w-28 text-[10px] sm:text-xs hidden sm:table-cell">Tanggal</TableHead>
                        <TableHead className="text-[10px] sm:text-xs">Jenis</TableHead>
                        <TableHead className="text-[10px] sm:text-xs hidden md:table-cell">Keterangan</TableHead>
                        <TableHead className="text-right text-[10px] sm:text-xs">Jumlah</TableHead>
                        <TableHead className="w-8 sm:w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outstandingItems.map((item) => (
                        <TableRow key={item.id} className={item.cleared ? 'opacity-50' : ''}>
                          <TableCell className="p-2 sm:p-4">
                            <Checkbox 
                              checked={item.cleared} 
                              onCheckedChange={() => handleToggleCleared(item.id)}
                              className="h-4 w-4"
                            />
                          </TableCell>
                          <TableCell className="text-[10px] sm:text-sm p-2 sm:p-4 hidden sm:table-cell">{format(parseISO(item.date), 'dd MMM yyyy', { locale: id })}</TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Badge variant="outline" className="text-[8px] sm:text-xs">
                              {itemTypes.find(t => t.value === item.type)?.label || item.type}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-[10px] sm:text-sm p-2 sm:p-4 hidden md:table-cell ${item.cleared ? 'line-through' : ''}`}>
                            {item.description}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[10px] sm:text-sm p-2 sm:p-4">
                            {formatCurrency(item.amount)}
                          </TableCell>
                          <TableCell className="p-1 sm:p-4">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRemoveItem(item.id)}
                              className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="py-2 sm:py-3 px-3 sm:px-6">
              <CardTitle className="text-sm sm:text-base">Catatan Rekonsiliasi</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <Textarea
                placeholder="Tambahkan catatan tentang rekonsiliasi ini..."
                value={reconciliationNotes}
                onChange={(e) => setReconciliationNotes(e.target.value)}
                rows={3}
                className="text-xs sm:text-sm"
              />
            </CardContent>
          </Card>

          {/* Bank Accounts Info */}
          <Card>
            <CardHeader className="py-2 sm:py-3 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm">Akun Bank Terkait</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {bankAccounts.map(acc => (
                  <Badge key={acc.id} variant="secondary" className="text-[10px] sm:text-xs">
                    {acc.account_code} - {acc.account_name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {activeTab === 'history' && (
          <Card>
            <CardHeader className="py-2 sm:py-3 px-3 sm:px-6">
              <CardTitle className="text-sm sm:text-base">Riwayat Rekonsiliasi</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Daftar rekonsiliasi bank yang telah disimpan</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {reconciliationsLoading ? (
                <div className="flex items-center justify-center py-6 sm:py-8">
                  <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-primary" />
                </div>
              ) : reconciliations.length === 0 ? (
                <div className="text-center text-muted-foreground py-6 sm:py-8">
                  <p className="text-xs sm:text-sm">Belum ada riwayat rekonsiliasi</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-[10px] sm:text-xs">Periode</TableHead>
                        <TableHead className="text-right text-[10px] sm:text-xs hidden sm:table-cell">Saldo Buku</TableHead>
                        <TableHead className="text-right text-[10px] sm:text-xs hidden md:table-cell">Saldo Bank</TableHead>
                        <TableHead className="text-right text-[10px] sm:text-xs">Selisih</TableHead>
                        <TableHead className="text-[10px] sm:text-xs">Status</TableHead>
                        <TableHead className="text-[10px] sm:text-xs hidden lg:table-cell">Tanggal</TableHead>
                        <TableHead className="w-8 sm:w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reconciliations.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium text-[10px] sm:text-sm p-2 sm:p-4">
                            {months.find(m => m.value === record.period_month)?.label} {record.period_year}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[10px] sm:text-sm p-2 sm:p-4 hidden sm:table-cell">
                            {formatCurrency(record.adjusted_book_balance)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[10px] sm:text-sm p-2 sm:p-4 hidden md:table-cell">
                            {formatCurrency(record.adjusted_bank_balance)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[10px] sm:text-sm p-2 sm:p-4">
                            {formatCurrency(record.difference)}
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Badge variant={record.is_reconciled ? 'default' : 'destructive'} className="text-[8px] sm:text-xs">
                              {record.is_reconciled ? 'Cocok' : 'Selisih'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-[10px] sm:text-sm p-2 sm:p-4 hidden lg:table-cell">
                            {format(parseISO(record.created_at), 'dd MMM yyyy HH:mm', { locale: id })}
                          </TableCell>
                          <TableCell className="p-1 sm:p-4">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => deleteReconciliation(record.id)}
                              className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
