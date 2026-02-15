import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Loader2, Download, Wallet, Building2, Calendar, TrendingUp, TrendingDown, ArrowRight, Users, Printer, Eye, X, CalendarIcon } from 'lucide-react';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { cn } from '@/lib/utils';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { useBusinessUnits } from '@/hooks/useBusinessUnits';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { createAndDownloadExcelFromJson, createAndDownloadExcelMixed } from '@/lib/excelUtils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';
import { toast } from 'sonner';
import { escapeHtml } from '@/lib/exportUtils';

// Transaction type labels
const transactionTypeLabels: Record<string, string> = {
  'simpanan_pokok': 'Simpanan Pokok',
  'simpanan_wajib': 'Simpanan Wajib',
  'simpanan_sukarela': 'Simpanan Sukarela',
  'setor_simpanan_wajib': 'Setor Simpanan Wajib',
  'setor_simpanan_sukarela': 'Setor Simpanan Sukarela',
  'penarikan_simpanan_sukarela': 'Penarikan Simpanan Sukarela',
  'bayar_angsuran_pinjaman': 'Bayar Angsuran Pinjaman',
};

interface MemberTransactionDetail {
  id: string;
  date: string;
  type: string;
  amount: number;
  status: string;
  notes: string | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface BookEntry {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  journalEntryId: string;
  accountName: string;
  businessUnitName: string;
}

// Transaction filter options
type TransactionFilter = 'all' | 'pokok' | 'wajib' | 'sukarela' | 'penarikan' | 'angsuran';

const transactionFilterOptions: { value: TransactionFilter; label: string; types: string[] }[] = [
  { value: 'all', label: 'Semua Transaksi', types: [] },
  { value: 'pokok', label: 'Simpanan Pokok', types: ['simpanan_pokok'] },
  { value: 'wajib', label: 'Simpanan Wajib', types: ['simpanan_wajib', 'setor_simpanan_wajib'] },
  { value: 'sukarela', label: 'Simpanan Sukarela', types: ['simpanan_sukarela', 'setor_simpanan_sukarela'] },
  { value: 'penarikan', label: 'Penarikan', types: ['penarikan_simpanan_sukarela'] },
  { value: 'angsuran', label: 'Angsuran Pinjaman', types: ['bayar_angsuran_pinjaman'] },
];

export const CashBankBook = () => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'cash' | 'bank' | 'member'>('cash');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    userId: string;
    name: string;
    memberNumber: string | null;
  } | null>(null);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });

  // Fetch member transactions when a member is selected
  const { data: memberTransactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['memberTransactions', selectedMember?.userId, selectedYear],
    queryFn: async () => {
      if (!selectedMember?.userId) return [];
      
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;
      
      const { data, error } = await supabase
        .from('transactions')
        .select('id, date, type, amount, status, notes')
        .eq('user_id', selectedMember.userId)
        .gte('date', yearStart)
        .lte('date', yearEnd)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as MemberTransactionDetail[];
    },
    enabled: !!selectedMember?.userId && isTransactionDialogOpen,
  });

  // Filter transactions based on selected filter and date range
  const filteredTransactions = useMemo(() => {
    if (!memberTransactions) return [];
    
    let filtered = memberTransactions;
    
    // Apply transaction type filter
    if (transactionFilter !== 'all') {
      const filterOption = transactionFilterOptions.find(f => f.value === transactionFilter);
      if (filterOption) {
        filtered = filtered.filter(t => filterOption.types.includes(t.type));
      }
    }
    
    // Apply date range filter
    if (dateRangeFilter.from || dateRangeFilter.to) {
      filtered = filtered.filter(t => {
        if (!t.date) return false;
        const txDate = parseISO(t.date);
        
        if (dateRangeFilter.from && dateRangeFilter.to) {
          return isWithinInterval(txDate, { start: dateRangeFilter.from, end: dateRangeFilter.to });
        } else if (dateRangeFilter.from) {
          return txDate >= dateRangeFilter.from;
        } else if (dateRangeFilter.to) {
          return txDate <= dateRangeFilter.to;
        }
        return true;
      });
    }
    
    return filtered;
  }, [memberTransactions, transactionFilter, dateRangeFilter]);

  const handleMemberClick = (member: typeof selectedMember) => {
    setSelectedMember(member);
    setTransactionFilter('all'); // Reset filter when opening dialog
    setDateRangeFilter({ from: undefined, to: undefined }); // Reset date range when opening dialog
    setIsTransactionDialogOpen(true);
  };

  const clearDateRange = () => {
    setDateRangeFilter({ from: undefined, to: undefined });
  };

  // Print member transactions to PDF
  const printMemberTransactionsToPDF = () => {
    if (!selectedMember || !filteredTransactions || filteredTransactions.length === 0) {
      toast.error('Tidak ada transaksi untuk dicetak');
      return;
    }

    const settings = getCooperativeSettings();
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      toast.error('Tidak dapat membuka jendela print');
      return;
    }

    const printDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Calculate summaries
    const simpananPokok = memberTransactions
      .filter(t => t.type === 'simpanan_pokok' && t.status === 'approved')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const simpananWajib = memberTransactions
      .filter(t => ['simpanan_wajib', 'setor_simpanan_wajib'].includes(t.type) && t.status === 'approved')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const simpananSukarela = memberTransactions
      .filter(t => ['simpanan_sukarela', 'setor_simpanan_sukarela'].includes(t.type) && t.status === 'approved')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const penarikan = memberTransactions
      .filter(t => t.type === 'penarikan_simpanan_sukarela' && t.status === 'approved')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const filterLabel = transactionFilterOptions.find(f => f.value === transactionFilter)?.label || 'Semua Transaksi';
    
    // Build date range label
    let dateRangeLabel = '';
    if (dateRangeFilter.from || dateRangeFilter.to) {
      if (dateRangeFilter.from && dateRangeFilter.to) {
        dateRangeLabel = ` - Periode: ${format(dateRangeFilter.from, 'dd MMM yyyy', { locale: id })} s/d ${format(dateRangeFilter.to, 'dd MMM yyyy', { locale: id })}`;
      } else if (dateRangeFilter.from) {
        dateRangeLabel = ` - Mulai: ${format(dateRangeFilter.from, 'dd MMM yyyy', { locale: id })}`;
      } else if (dateRangeFilter.to) {
        dateRangeLabel = ` - Sampai: ${format(dateRangeFilter.to, 'dd MMM yyyy', { locale: id })}`;
      }
    }
    const tableRows = filteredTransactions.map((tx, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="text-center">${tx.date ? format(parseISO(tx.date), 'dd MMM yyyy', { locale: id }) : '-'}</td>
        <td>${escapeHtml(transactionTypeLabels[tx.type] || tx.type)}</td>
        <td class="text-right ${tx.type === 'penarikan_simpanan_sukarela' ? 'text-rose' : 'text-emerald'}">
          ${tx.type === 'penarikan_simpanan_sukarela' ? '-' : '+'}${formatCurrency(Number(tx.amount))}
        </td>
        <td class="text-center">
          <span class="status-badge ${tx.status === 'approved' ? 'approved' : tx.status === 'rejected' ? 'rejected' : 'pending'}">
            ${tx.status === 'approved' ? 'Disetujui' : tx.status === 'rejected' ? 'Ditolak' : 'Pending'}
          </span>
        </td>
        <td class="text-sm">${escapeHtml(tx.notes) || '-'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Riwayat Transaksi ${selectedMember.name} - ${selectedYear}</title>
        <style>
          @page { 
            size: A4 portrait; 
            margin: 15mm; 
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 10px;
            line-height: 1.4;
            padding: 15px;
          }
          .header { 
            text-align: center; 
            margin-bottom: 20px; 
            border-bottom: 2px solid #333;
            padding-bottom: 12px;
          }
          .header h1 { 
            font-size: 14px; 
            font-weight: bold;
            margin-bottom: 3px;
          }
          .header p { 
            font-size: 10px; 
            color: #666; 
            margin: 2px 0;
          }
          .header h2 { 
            font-size: 12px; 
            font-weight: bold;
            margin-top: 10px;
          }
          .member-info {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .member-info .name {
            font-size: 12px;
            font-weight: bold;
          }
          .member-info .number {
            font-family: monospace;
            background: #e0e0e0;
            padding: 3px 8px;
            border-radius: 3px;
          }
          .summary-cards {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
          }
          .summary-card {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            text-align: center;
          }
          .summary-card.pokok { background: #eff6ff; border-color: #93c5fd; }
          .summary-card.wajib { background: #ecfdf5; border-color: #6ee7b7; }
          .summary-card.sukarela { background: #faf5ff; border-color: #c4b5fd; }
          .summary-card.penarikan { background: #fef2f2; border-color: #fca5a5; }
          .summary-card label { 
            font-size: 9px; 
            color: #666; 
            display: block;
            margin-bottom: 3px;
          }
          .summary-card .value { 
            font-size: 11px; 
            font-weight: bold;
          }
          .summary-card.pokok .value { color: #2563eb; }
          .summary-card.wajib .value { color: #059669; }
          .summary-card.sukarela .value { color: #7c3aed; }
          .summary-card.penarikan .value { color: #dc2626; }
          table { 
            width: 100%; 
            border-collapse: collapse;
            font-size: 9px;
            margin-bottom: 15px;
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 5px 6px;
          }
          th { 
            background: #f3f4f6;
            font-weight: bold;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-sm { font-size: 8px; color: #666; }
          .text-emerald { color: #059669; }
          .text-rose { color: #dc2626; }
          .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: bold;
          }
          .status-badge.approved { background: #dcfce7; color: #166534; }
          .status-badge.rejected { background: #fee2e2; color: #991b1b; }
          .status-badge.pending { background: #fef3c7; color: #92400e; }
          .footer {
            margin-top: 25px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .footer-left {
            font-size: 9px;
            color: #666;
          }
          .signature-section {
            text-align: center;
          }
          .signature-line {
            width: 150px;
            border-bottom: 1px solid #333;
            margin: 40px auto 5px;
          }
          .signature-name {
            font-size: 9px;
          }
          @media print { 
            body { padding: 0; } 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${settings.name}</h1>
          <p>${settings.address}</p>
          <p>Badan Hukum: ${settings.legalNumber}</p>
          <h2>RIWAYAT TRANSAKSI ANGGOTA</h2>
          <p>Tahun Buku ${selectedYear}${transactionFilter !== 'all' ? ` - Filter: ${filterLabel}` : ''}${dateRangeLabel}</p>
        </div>

        <div class="member-info">
          <div>
            <span class="name">${escapeHtml(selectedMember.name)}</span>
          </div>
          <div>
            <span class="number">${escapeHtml(selectedMember.memberNumber) || '-'}</span>
          </div>
        </div>

        <div class="summary-cards">
          <div class="summary-card pokok">
            <label>Simpanan Pokok</label>
            <div class="value">${formatCurrency(simpananPokok)}</div>
          </div>
          <div class="summary-card wajib">
            <label>Simpanan Wajib</label>
            <div class="value">${formatCurrency(simpananWajib)}</div>
          </div>
          <div class="summary-card sukarela">
            <label>Simpanan Sukarela</label>
            <div class="value">${formatCurrency(simpananSukarela)}</div>
          </div>
          <div class="summary-card penarikan">
            <label>Penarikan</label>
            <div class="value">${formatCurrency(penarikan)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px">No</th>
              <th style="width: 80px">Tanggal</th>
              <th>Jenis Transaksi</th>
              <th style="width: 100px">Jumlah</th>
              <th style="width: 70px">Status</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <p style="text-align: center; font-size: 9px; color: #666; margin-bottom: 15px;">
          ${transactionFilter === 'all' 
            ? `Total ${filteredTransactions.length} transaksi`
            : `Menampilkan ${filteredTransactions.length} transaksi (${filterLabel})`
          }
        </p>

        <div class="footer">
          <div class="footer-left">
            <p>Dicetak pada: ${printDate}</p>
          </div>
          <div class="signature-section">
            <p>${settings.address.split(',')[0] || 'Tempat'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p style="margin-top: 5px">Bendahara</p>
            <div class="signature-line"></div>
            <p class="signature-name">(${settings.signatories?.find(s => s.position === 'Bendahara')?.name || '____________________'})</p>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
    toast.success('Dokumen siap dicetak');
  };

  // Fetch member savings data
  const { data: memberSavingsData, isLoading: memberLoading } = useQuery({
    queryKey: ['memberSavingsBook', selectedYear],
    queryFn: async () => {
      // Fetch all members with their savings
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('id, user_id, name, member_number')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .order('name');
      
      if (membersError) throw membersError;

      // Fetch current savings summary
      const { data: savingsSummary, error: savingsError } = await supabase
        .from('savings_summary')
        .select('user_id, simpanan_pokok, simpanan_wajib, simpanan_sukarela, total_simpanan');
      
      if (savingsError) throw savingsError;

      // Fetch transactions for the selected year to calculate additions
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;
      
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('user_id, type, amount, date')
        .eq('status', 'approved')
        .gte('date', yearStart)
        .lte('date', yearEnd);
      
      if (transError) throw transError;

      // Fetch transactions before selected year for opening balance
      const { data: priorTransactions, error: priorError } = await supabase
        .from('transactions')
        .select('user_id, type, amount')
        .eq('status', 'approved')
        .lt('date', yearStart);
      
      if (priorError) throw priorError;

      // Process member data
      const memberData = members.map(member => {
        const savings = savingsSummary.find(s => s.user_id === member.user_id);
        const memberTransactions = transactions.filter(t => t.user_id === member.user_id);
        const memberPriorTrans = priorTransactions.filter(t => t.user_id === member.user_id);

        // Calculate opening balance from prior transactions
        const openingPokok = memberPriorTrans
          .filter(t => t.type === 'simpanan_pokok')
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const openingWajib = memberPriorTrans
          .filter(t => ['simpanan_wajib', 'setor_simpanan_wajib'].includes(t.type))
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const openingSukarela = memberPriorTrans
          .filter(t => {
            if (['simpanan_sukarela', 'setor_simpanan_sukarela'].includes(t.type)) return true;
            if (t.type === 'penarikan_simpanan_sukarela') return true;
            return false;
          })
          .reduce((sum, t) => {
            if (t.type === 'penarikan_simpanan_sukarela') return sum - Number(t.amount);
            return sum + Number(t.amount);
          }, 0);

        // Calculate additions this year
        const addPokok = memberTransactions
          .filter(t => t.type === 'simpanan_pokok')
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const addWajib = memberTransactions
          .filter(t => ['simpanan_wajib', 'setor_simpanan_wajib'].includes(t.type))
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const addSukarela = memberTransactions
          .filter(t => ['simpanan_sukarela', 'setor_simpanan_sukarela'].includes(t.type))
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const withdrawSukarela = memberTransactions
          .filter(t => t.type === 'penarikan_simpanan_sukarela')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const endingPokok = openingPokok + addPokok;
        const endingWajib = openingWajib + addWajib;
        const endingSukarela = openingSukarela + addSukarela - withdrawSukarela;

        return {
          id: member.id,
          userId: member.user_id,
          name: member.name,
          memberNumber: member.member_number,
          opening: {
            pokok: openingPokok,
            wajib: openingWajib,
            sukarela: openingSukarela,
            total: openingPokok + openingWajib + openingSukarela
          },
          additions: {
            pokok: addPokok,
            wajib: addWajib,
            sukarela: addSukarela,
            total: addPokok + addWajib + addSukarela
          },
          withdrawals: {
            sukarela: withdrawSukarela,
            total: withdrawSukarela
          },
          ending: {
            pokok: endingPokok,
            wajib: endingWajib,
            sukarela: endingSukarela,
            total: endingPokok + endingWajib + endingSukarela
          }
        };
      });

      return memberData;
    },
  });

  const { entries, loading: entriesLoading } = useJournalEntries(selectedYear);
  const { accounts, loading: accountsLoading } = useChartOfAccounts();
  const { units, loading: unitsLoading } = useBusinessUnits();

  const loading = entriesLoading || accountsLoading || unitsLoading || memberLoading;

  // Find cash and bank accounts
  const cashAccounts = useMemo(() => {
    return accounts.filter(acc => 
      acc.account_code.startsWith('1-1') && 
      (acc.account_name.toLowerCase().includes('kas') || acc.account_code === '1-100')
    );
  }, [accounts]);

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

  // Process journal entries to get book entries
  const processBookEntries = (accountIds: string[]): BookEntry[] => {
    const bookEntries: BookEntry[] = [];
    
    // Filter entries by date and status
    const filteredEntries = entries.filter(entry => {
      if (entry.status !== 'posted') return false;
      const entryDate = parseISO(entry.entry_date);
      return isWithinInterval(entryDate, { start: dateRange.start, end: dateRange.end });
    });

    // Sort by date
    filteredEntries.sort((a, b) => 
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

    // Process each entry's lines
    filteredEntries.forEach(entry => {
      const lines = (entry as any).journal_entry_lines || [];
      
      lines.forEach((line: any) => {
        if (!accountIds.includes(line.account_id)) return;
        
        // Filter by business unit if selected
        if (selectedUnit !== 'all' && entry.business_unit_id !== selectedUnit) return;

        const account = accounts.find(a => a.id === line.account_id);
        const unit = units.find(u => u.id === entry.business_unit_id);

        bookEntries.push({
          id: line.id,
          date: entry.entry_date,
          entryNumber: entry.entry_number,
          description: line.description || entry.description,
          debit: line.debit_amount || 0,
          credit: line.credit_amount || 0,
          balance: 0, // Will be calculated
          journalEntryId: entry.id,
          accountName: account?.account_name || '-',
          businessUnitName: unit?.name || 'Koperasi Utama'
        });
      });
    });

    // Sort by date and calculate running balance
    bookEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let runningBalance = 0;
    bookEntries.forEach(entry => {
      runningBalance += entry.debit - entry.credit;
      entry.balance = runningBalance;
    });

    return bookEntries;
  };

  const cashBookEntries = useMemo(() => {
    return processBookEntries(cashAccounts.map(a => a.id));
  }, [entries, cashAccounts, dateRange, selectedUnit, accounts, units]);

  const bankBookEntries = useMemo(() => {
    return processBookEntries(bankAccounts.map(a => a.id));
  }, [entries, bankAccounts, dateRange, selectedUnit, accounts, units]);

  // Calculate totals
  const calculateTotals = (entries: BookEntry[]) => {
    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
    const endingBalance = entries.length > 0 ? entries[entries.length - 1].balance : 0;
    return { totalDebit, totalCredit, endingBalance };
  };

  const cashTotals = calculateTotals(cashBookEntries);
  const bankTotals = calculateTotals(bankBookEntries);

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

  const exportToExcel = (type: 'cash' | 'bank') => {
    const entries = type === 'cash' ? cashBookEntries : bankBookEntries;
    const totals = type === 'cash' ? cashTotals : bankTotals;
    const title = type === 'cash' ? 'Buku Kas' : 'Buku Bank';

    const data = entries.map((entry, idx) => ({
      'No': idx + 1,
      'Tanggal': format(parseISO(entry.date), 'dd/MM/yyyy'),
      'No. Jurnal': entry.entryNumber,
      'Keterangan': entry.description,
      'Unit Usaha': entry.businessUnitName,
      'Debit': entry.debit,
      'Kredit': entry.credit,
      'Saldo': entry.balance
    }));

    // Add totals row
    data.push({
      'No': '',
      'Tanggal': '',
      'No. Jurnal': '',
      'Keterangan': 'TOTAL',
      'Unit Usaha': '',
      'Debit': totals.totalDebit,
      'Kredit': totals.totalCredit,
      'Saldo': totals.endingBalance
    } as any);

    const monthName = months.find(m => m.value === selectedMonth)?.label;
    createAndDownloadExcelFromJson(
      [{ name: title, data }],
      `${title}_${monthName}_${selectedYear}.xlsx`
    );
  };

  // Export member savings to Excel
  const exportMemberSavingsToExcel = () => {
    if (!memberSavingsData) return;

    const filteredMembers = memberSavingsData.filter(m => 
      m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      (m.memberNumber && m.memberNumber.toLowerCase().includes(memberSearchQuery.toLowerCase()))
    );

    const data = filteredMembers.map((member, idx) => ({
      'No': idx + 1,
      'No. Anggota': member.memberNumber || '-',
      'Nama Anggota': member.name,
      'Saldo Awal Pokok': member.opening.pokok,
      'Saldo Awal Wajib': member.opening.wajib,
      'Saldo Awal Sukarela': member.opening.sukarela,
      'Total Saldo Awal': member.opening.total,
      'Tambah Pokok': member.additions.pokok,
      'Tambah Wajib': member.additions.wajib,
      'Tambah Sukarela': member.additions.sukarela,
      'Tarik Sukarela': member.withdrawals.sukarela,
      'Akhir Pokok': member.ending.pokok,
      'Akhir Wajib': member.ending.wajib,
      'Akhir Sukarela': member.ending.sukarela,
      'Total Akhir': member.ending.total
    }));

    // Add totals row
    const totals = filteredMembers.reduce((acc, m) => ({
      openingPokok: acc.openingPokok + m.opening.pokok,
      openingWajib: acc.openingWajib + m.opening.wajib,
      openingSukarela: acc.openingSukarela + m.opening.sukarela,
      openingTotal: acc.openingTotal + m.opening.total,
      addPokok: acc.addPokok + m.additions.pokok,
      addWajib: acc.addWajib + m.additions.wajib,
      addSukarela: acc.addSukarela + m.additions.sukarela,
      withdrawSukarela: acc.withdrawSukarela + m.withdrawals.sukarela,
      endingPokok: acc.endingPokok + m.ending.pokok,
      endingWajib: acc.endingWajib + m.ending.wajib,
      endingSukarela: acc.endingSukarela + m.ending.sukarela,
      endingTotal: acc.endingTotal + m.ending.total
    }), {
      openingPokok: 0, openingWajib: 0, openingSukarela: 0, openingTotal: 0,
      addPokok: 0, addWajib: 0, addSukarela: 0, withdrawSukarela: 0,
      endingPokok: 0, endingWajib: 0, endingSukarela: 0, endingTotal: 0
    });

    data.push({
      'No': '',
      'No. Anggota': '',
      'Nama Anggota': 'TOTAL',
      'Saldo Awal Pokok': totals.openingPokok,
      'Saldo Awal Wajib': totals.openingWajib,
      'Saldo Awal Sukarela': totals.openingSukarela,
      'Total Saldo Awal': totals.openingTotal,
      'Tambah Pokok': totals.addPokok,
      'Tambah Wajib': totals.addWajib,
      'Tambah Sukarela': totals.addSukarela,
      'Tarik Sukarela': totals.withdrawSukarela,
      'Akhir Pokok': totals.endingPokok,
      'Akhir Wajib': totals.endingWajib,
      'Akhir Sukarela': totals.endingSukarela,
      'Total Akhir': totals.endingTotal
    } as any);
    createAndDownloadExcelFromJson(
      [{ name: 'Buku Anggota', data }],
      `Buku_Anggota_${selectedYear}.xlsx`
    );
  };

  // Print Member Savings to PDF with official format
  const printMemberSavingsToPDF = () => {
    if (!memberSavingsData || filteredMemberData.length === 0) {
      toast.error('Tidak ada data anggota untuk dicetak');
      return;
    }

    const settings = getCooperativeSettings();
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      toast.error('Tidak dapat membuka jendela print');
      return;
    }

    const printDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const tableRows = filteredMemberData.map((member, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="text-center">${member.memberNumber || '-'}</td>
        <td>${member.name}</td>
        <td class="text-right">${formatCurrency(member.opening.pokok)}</td>
        <td class="text-right">${formatCurrency(member.opening.wajib)}</td>
        <td class="text-right">${formatCurrency(member.opening.sukarela)}</td>
        <td class="text-right font-bold">${formatCurrency(member.opening.total)}</td>
        <td class="text-right text-emerald">${member.additions.pokok > 0 ? formatCurrency(member.additions.pokok) : '-'}</td>
        <td class="text-right text-emerald">${member.additions.wajib > 0 ? formatCurrency(member.additions.wajib) : '-'}</td>
        <td class="text-right text-emerald">${member.additions.sukarela > 0 ? formatCurrency(member.additions.sukarela) : '-'}</td>
        <td class="text-right text-rose">${member.withdrawals.sukarela > 0 ? formatCurrency(member.withdrawals.sukarela) : '-'}</td>
        <td class="text-right">${formatCurrency(member.ending.pokok)}</td>
        <td class="text-right">${formatCurrency(member.ending.wajib)}</td>
        <td class="text-right">${formatCurrency(member.ending.sukarela)}</td>
        <td class="text-right font-bold">${formatCurrency(member.ending.total)}</td>
      </tr>
    `).join('');

    const totalsRow = `
      <tr class="totals-row">
        <td colspan="3" class="text-right font-bold">TOTAL</td>
        <td class="text-right font-bold">${formatCurrency(memberTotals.openingPokok)}</td>
        <td class="text-right font-bold">${formatCurrency(memberTotals.openingWajib)}</td>
        <td class="text-right font-bold">${formatCurrency(memberTotals.openingSukarela)}</td>
        <td class="text-right font-bold">${formatCurrency(memberTotals.openingTotal)}</td>
        <td class="text-right font-bold text-emerald">${formatCurrency(memberTotals.addPokok)}</td>
        <td class="text-right font-bold text-emerald">${formatCurrency(memberTotals.addWajib)}</td>
        <td class="text-right font-bold text-emerald">${formatCurrency(memberTotals.addSukarela)}</td>
        <td class="text-right font-bold text-rose">${formatCurrency(memberTotals.withdrawSukarela)}</td>
        <td class="text-right font-bold">${formatCurrency(memberTotals.endingPokok)}</td>
        <td class="text-right font-bold">${formatCurrency(memberTotals.endingWajib)}</td>
        <td class="text-right font-bold">${formatCurrency(memberTotals.endingSukarela)}</td>
        <td class="text-right font-bold">${formatCurrency(memberTotals.endingTotal)}</td>
      </tr>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Buku Anggota ${selectedYear} - ${settings.name}</title>
        <style>
          @page { 
            size: A4 landscape; 
            margin: 10mm; 
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 9px;
            line-height: 1.3;
            padding: 10px;
          }
          .header { 
            text-align: center; 
            margin-bottom: 15px; 
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .header h1 { 
            font-size: 14px; 
            font-weight: bold;
            margin-bottom: 2px;
          }
          .header p { 
            font-size: 10px; 
            color: #666; 
            margin: 2px 0;
          }
          .header h2 { 
            font-size: 12px; 
            font-weight: bold;
            margin-top: 8px;
          }
          .summary-cards {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 15px;
          }
          .summary-card {
            flex: 1;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            text-align: center;
          }
          .summary-card.opening { background: #eff6ff; border-color: #93c5fd; }
          .summary-card.additions { background: #ecfdf5; border-color: #6ee7b7; }
          .summary-card.withdrawals { background: #fef2f2; border-color: #fca5a5; }
          .summary-card.ending { background: #faf5ff; border-color: #c4b5fd; }
          .summary-card label { 
            font-size: 8px; 
            color: #666; 
            display: block;
          }
          .summary-card .value { 
            font-size: 11px; 
            font-weight: bold;
          }
          .summary-card.opening .value { color: #2563eb; }
          .summary-card.additions .value { color: #059669; }
          .summary-card.withdrawals .value { color: #dc2626; }
          .summary-card.ending .value { color: #7c3aed; }
          table { 
            width: 100%; 
            border-collapse: collapse;
            font-size: 8px;
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 3px 4px;
          }
          th { 
            background: #f3f4f6;
            font-weight: bold;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .text-emerald { color: #059669; }
          .text-rose { color: #dc2626; }
          .totals-row {
            background: #f9fafb;
            border-top: 2px solid #333;
          }
          .section-header {
            background: #e5e7eb;
          }
          .footer {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
          }
          .signature-section {
            text-align: center;
            margin-top: 30px;
          }
          .signature-line {
            width: 150px;
            border-bottom: 1px solid #333;
            margin: 50px auto 5px;
          }
          @media print { 
            body { padding: 0; } 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${settings.name}</h1>
          <p>${settings.address}</p>
          <p>Badan Hukum: ${settings.legalNumber}</p>
          <h2>BUKU ANGGOTA - REKAPITULASI SIMPANAN</h2>
          <p>Tahun Buku ${selectedYear}</p>
        </div>

        <div class="summary-cards">
          <div class="summary-card opening">
            <label>Saldo Awal</label>
            <div class="value">${formatCurrency(memberTotals.openingTotal)}</div>
          </div>
          <div class="summary-card additions">
            <label>Total Penambahan</label>
            <div class="value">${formatCurrency(memberTotals.addPokok + memberTotals.addWajib + memberTotals.addSukarela)}</div>
          </div>
          <div class="summary-card withdrawals">
            <label>Total Penarikan</label>
            <div class="value">${formatCurrency(memberTotals.withdrawSukarela)}</div>
          </div>
          <div class="summary-card ending">
            <label>Saldo Akhir</label>
            <div class="value">${formatCurrency(memberTotals.endingTotal)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr class="section-header">
              <th rowspan="2" style="width: 25px">No</th>
              <th rowspan="2" style="width: 60px">No. Anggota</th>
              <th rowspan="2" style="min-width: 100px">Nama Anggota</th>
              <th colspan="4" class="text-center">Saldo Awal (Tahun Sebelumnya)</th>
              <th colspan="3" class="text-center">Penambahan</th>
              <th class="text-center">Penarikan</th>
              <th colspan="4" class="text-center">Saldo Akhir</th>
            </tr>
            <tr>
              <th class="text-right">Pokok</th>
              <th class="text-right">Wajib</th>
              <th class="text-right">Sukarela</th>
              <th class="text-right">Total</th>
              <th class="text-right">Pokok</th>
              <th class="text-right">Wajib</th>
              <th class="text-right">Sukarela</th>
              <th class="text-right">Sukarela</th>
              <th class="text-right">Pokok</th>
              <th class="text-right">Wajib</th>
              <th class="text-right">Sukarela</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            ${totalsRow}
          </tbody>
        </table>

        <div class="footer">
          <div>
            <p>Total Anggota: ${filteredMemberData.length} orang</p>
            <p>Dicetak pada: ${printDate}</p>
          </div>
          <div class="signature-section">
            <p>${settings.address.split(',')[0] || 'Tempat'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p style="margin-top: 5px">Bendahara</p>
            <div class="signature-line"></div>
            <p>(${settings.signatories?.find(s => s.position === 'Bendahara')?.name || '____________________'})</p>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
    toast.success('Dokumen siap dicetak');
  };

  const filteredMemberData = useMemo(() => {
    if (!memberSavingsData) return [];
    return memberSavingsData.filter(m => 
      m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      (m.memberNumber && m.memberNumber.toLowerCase().includes(memberSearchQuery.toLowerCase()))
    );
  }, [memberSavingsData, memberSearchQuery]);

  // Calculate member totals
  const memberTotals = useMemo(() => {
    return filteredMemberData.reduce((acc, m) => ({
      openingPokok: acc.openingPokok + m.opening.pokok,
      openingWajib: acc.openingWajib + m.opening.wajib,
      openingSukarela: acc.openingSukarela + m.opening.sukarela,
      openingTotal: acc.openingTotal + m.opening.total,
      addPokok: acc.addPokok + m.additions.pokok,
      addWajib: acc.addWajib + m.additions.wajib,
      addSukarela: acc.addSukarela + m.additions.sukarela,
      withdrawSukarela: acc.withdrawSukarela + m.withdrawals.sukarela,
      endingPokok: acc.endingPokok + m.ending.pokok,
      endingWajib: acc.endingWajib + m.ending.wajib,
      endingSukarela: acc.endingSukarela + m.ending.sukarela,
      endingTotal: acc.endingTotal + m.ending.total
    }), {
      openingPokok: 0, openingWajib: 0, openingSukarela: 0, openingTotal: 0,
      addPokok: 0, addWajib: 0, addSukarela: 0, withdrawSukarela: 0,
      endingPokok: 0, endingWajib: 0, endingSukarela: 0, endingTotal: 0
    });
  }, [filteredMemberData]);

  const renderBookTable = (entries: BookEntry[], totals: ReturnType<typeof calculateTotals>, type: 'cash' | 'bank') => (
    <div className="space-y-3 sm:space-y-4">
      {/* Summary Cards - Responsive Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-2 sm:pt-4 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 shrink-0" />
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-sm text-muted-foreground">Penerimaan</p>
                <p className="text-xs sm:text-xl font-bold text-emerald-600">{formatCurrency(totals.totalDebit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800">
          <CardContent className="p-2 sm:pt-4 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-2">
              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600 shrink-0" />
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-sm text-muted-foreground">Pengeluaran</p>
                <p className="text-xs sm:text-xl font-bold text-rose-600">{formatCurrency(totals.totalCredit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-2 sm:pt-4 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-2">
              {type === 'cash' ? <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0" /> : <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0" />}
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-sm text-muted-foreground">Saldo Akhir</p>
                <p className="text-xs sm:text-xl font-bold text-blue-600">{formatCurrency(totals.endingBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-2 sm:py-3 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base">Daftar Transaksi</CardTitle>
          <Button variant="outline" size="sm" onClick={() => exportToExcel(type)} className="h-7 sm:h-9 text-xs sm:text-sm">
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden xs:inline">Export Excel</span>
            <span className="xs:hidden">Excel</span>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Card View */}
          <div className="sm:hidden divide-y">
            {entries.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                Tidak ada transaksi pada periode ini
              </div>
            ) : (
              <>
                {entries.map((entry, idx) => (
                  <div key={entry.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {entry.entryNumber}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {format(parseISO(entry.date), 'dd/MM/yy', { locale: id })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{entry.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">
                        {entry.businessUnitName}
                      </Badge>
                      <div className="flex gap-3 text-xs font-mono">
                        {entry.debit > 0 && (
                          <span className="text-emerald-600">+{formatCurrency(entry.debit)}</span>
                        )}
                        {entry.credit > 0 && (
                          <span className="text-rose-600">-{formatCurrency(entry.credit)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <span className="text-xs font-medium">Saldo: {formatCurrency(entry.balance)}</span>
                    </div>
                  </div>
                ))}
                {/* Mobile Totals */}
                <div className="p-3 bg-muted/50 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Total Debit:</span>
                    <span className="font-mono text-emerald-600 font-medium">{formatCurrency(totals.totalDebit)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Total Kredit:</span>
                    <span className="font-mono text-rose-600 font-medium">{formatCurrency(totals.totalCredit)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold pt-1 border-t">
                    <span>Saldo Akhir:</span>
                    <span className="font-mono">{formatCurrency(totals.endingBalance)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10 text-xs">No</TableHead>
                    <TableHead className="w-24 text-xs">Tanggal</TableHead>
                    <TableHead className="w-28 text-xs hidden md:table-cell">No. Jurnal</TableHead>
                    <TableHead className="text-xs">Keterangan</TableHead>
                    <TableHead className="w-28 text-xs hidden lg:table-cell">Unit Usaha</TableHead>
                    <TableHead className="text-right w-28 text-xs">Debit</TableHead>
                    <TableHead className="text-right w-28 text-xs">Kredit</TableHead>
                    <TableHead className="text-right w-32 text-xs">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-sm">
                        Tidak ada transaksi pada periode ini
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {entries.map((entry, idx) => (
                        <TableRow key={entry.id} className="hover:bg-muted/30">
                          <TableCell className="text-muted-foreground text-xs py-2">{idx + 1}</TableCell>
                          <TableCell className="text-xs py-2">{format(parseISO(entry.date), 'dd MMM yy', { locale: id })}</TableCell>
                          <TableCell className="hidden md:table-cell py-2">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {entry.entryNumber}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[150px] lg:max-w-[200px] truncate text-xs py-2">{entry.description}</TableCell>
                          <TableCell className="hidden lg:table-cell py-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {entry.businessUnitName}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-emerald-600 text-xs py-2">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-rose-600 text-xs py-2">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-xs py-2">
                            {formatCurrency(entry.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell colSpan={5} className="text-right text-xs hidden lg:table-cell">TOTAL</TableCell>
                        <TableCell colSpan={4} className="text-right text-xs lg:hidden">TOTAL</TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 text-xs">
                          {formatCurrency(totals.totalDebit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-rose-600 text-xs">
                          {formatCurrency(totals.totalCredit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatCurrency(totals.endingBalance)}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="py-3 sm:py-4 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Filter Periode
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Tahun</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Bulan</Label>
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Unit</Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Semua Unit</SelectItem>
                  {units.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash, Bank, and Member Books */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button
            variant={activeTab === 'cash' ? 'default' : 'outline'}
            onClick={() => setActiveTab('cash')}
            className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-4"
          >
            <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Buku</span> Kas
          </Button>
          <Button
            variant={activeTab === 'bank' ? 'default' : 'outline'}
            onClick={() => setActiveTab('bank')}
            className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-4"
          >
            <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Buku</span> Bank
          </Button>
          <Button
            variant={activeTab === 'member' ? 'default' : 'outline'}
            onClick={() => setActiveTab('member')}
            className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-4"
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Buku</span> Anggota
          </Button>
        </div>

        {activeTab === 'cash' && (
          <Card>
            <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                Buku Kas Umum
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Catatan penerimaan dan pengeluaran kas - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              {renderBookTable(cashBookEntries, cashTotals, 'cash')}
            </CardContent>
          </Card>
        )}

        {activeTab === 'bank' && (
          <Card>
            <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                Buku Bank
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Catatan transaksi bank - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              {renderBookTable(bankBookEntries, bankTotals, 'bank')}
            </CardContent>
          </Card>
        )}

        {activeTab === 'member' && (
          <Card>
            <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                Buku Simpanan Anggota
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Rincian simpanan per anggota - Tahun Buku {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 px-2 sm:px-6">
              {/* Summary Cards - Responsive */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-2 sm:pt-4 sm:p-4">
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Saldo Awal</p>
                    <p className="text-xs sm:text-xl font-bold text-blue-600">{formatCurrency(memberTotals.openingTotal)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-2 sm:pt-4 sm:p-4">
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Penambahan</p>
                    <p className="text-xs sm:text-xl font-bold text-emerald-600">{formatCurrency(memberTotals.addPokok + memberTotals.addWajib + memberTotals.addSukarela)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800">
                  <CardContent className="p-2 sm:pt-4 sm:p-4">
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Penarikan</p>
                    <p className="text-xs sm:text-xl font-bold text-rose-600">{formatCurrency(memberTotals.withdrawSukarela)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-2 sm:pt-4 sm:p-4">
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Saldo Akhir</p>
                    <p className="text-xs sm:text-xl font-bold text-purple-600">{formatCurrency(memberTotals.endingTotal)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Search and Export */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center justify-between">
                <Input
                  placeholder="Cari nama atau nomor anggota..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="max-w-full sm:max-w-sm h-8 sm:h-10 text-xs sm:text-sm"
                />
                <div className="flex gap-1.5 sm:gap-2">
                  <Button variant="outline" size="sm" onClick={printMemberSavingsToPDF} className="h-7 sm:h-9 text-xs sm:text-sm flex-1 sm:flex-none">
                    <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden xs:inline">Print</span> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportMemberSavingsToExcel} className="h-7 sm:h-9 text-xs sm:text-sm flex-1 sm:flex-none">
                    <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden xs:inline">Export</span> Excel
                  </Button>
                </div>
              </div>

              {/* Member Savings - Mobile Card View */}
              <div className="sm:hidden space-y-2">
                {filteredMemberData.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    Tidak ada data anggota
                  </div>
                ) : (
                  <>
                    {filteredMemberData.map((member, idx) => (
                      <Card 
                        key={member.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => handleMemberClick({
                          id: member.id,
                          userId: member.userId,
                          name: member.name,
                          memberNumber: member.memberNumber
                        })}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {member.memberNumber || '-'}
                              </Badge>
                            </div>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <p className="font-medium text-sm">{member.name}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Saldo Awal</p>
                              <p className="font-mono font-medium text-blue-600">{formatCurrency(member.opening.total)}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Saldo Akhir</p>
                              <p className="font-mono font-medium text-purple-600">{formatCurrency(member.ending.total)}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Penambahan</p>
                              <p className="font-mono font-medium text-emerald-600">
                                +{formatCurrency(member.additions.pokok + member.additions.wajib + member.additions.sukarela)}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Penarikan</p>
                              <p className="font-mono font-medium text-rose-600">
                                {member.withdrawals.sukarela > 0 ? `-${formatCurrency(member.withdrawals.sukarela)}` : '-'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {/* Mobile Totals Summary */}
                    <Card className="bg-muted/50">
                      <CardContent className="p-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span>Total Saldo Awal:</span>
                            <span className="font-mono font-bold text-blue-600">{formatCurrency(memberTotals.openingTotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Saldo Akhir:</span>
                            <span className="font-mono font-bold text-purple-600">{formatCurrency(memberTotals.endingTotal)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              {/* Member Savings - Desktop Table View */}
              <div className="hidden sm:block">
                <ResponsiveTable>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-8 text-xs">No</TableHead>
                        <TableHead className="w-20 text-xs">No. Anggota</TableHead>
                        <TableHead className="min-w-[120px] text-xs">Nama</TableHead>
                        <TableHead colSpan={4} className="text-center border-l bg-blue-50/50 dark:bg-blue-900/10 text-xs">
                          Saldo Awal
                        </TableHead>
                        <TableHead colSpan={3} className="text-center border-l bg-emerald-50/50 dark:bg-emerald-900/10 text-xs hidden lg:table-cell">
                          Penambahan
                        </TableHead>
                        <TableHead className="text-center border-l bg-rose-50/50 dark:bg-rose-900/10 text-xs hidden lg:table-cell">
                          Penarikan
                        </TableHead>
                        <TableHead colSpan={4} className="text-center border-l bg-purple-50/50 dark:bg-purple-900/10 text-xs">
                          Saldo Akhir
                        </TableHead>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableHead></TableHead>
                        <TableHead></TableHead>
                        <TableHead></TableHead>
                        <TableHead className="text-right border-l text-[10px]">Pokok</TableHead>
                        <TableHead className="text-right text-[10px]">Wajib</TableHead>
                        <TableHead className="text-right text-[10px]">Sukarela</TableHead>
                        <TableHead className="text-right text-[10px] font-bold">Total</TableHead>
                        <TableHead className="text-right border-l text-[10px] hidden lg:table-cell">Pokok</TableHead>
                        <TableHead className="text-right text-[10px] hidden lg:table-cell">Wajib</TableHead>
                        <TableHead className="text-right text-[10px] hidden lg:table-cell">Sukarela</TableHead>
                        <TableHead className="text-right border-l text-[10px] hidden lg:table-cell">Sukarela</TableHead>
                        <TableHead className="text-right border-l text-[10px]">Pokok</TableHead>
                        <TableHead className="text-right text-[10px]">Wajib</TableHead>
                        <TableHead className="text-right text-[10px]">Sukarela</TableHead>
                        <TableHead className="text-right text-[10px] font-bold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMemberData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={15} className="text-center text-muted-foreground py-8 text-sm">
                            Tidak ada data anggota
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {filteredMemberData.map((member, idx) => (
                            <TableRow 
                              key={member.id} 
                              className="hover:bg-muted/30 cursor-pointer transition-colors"
                              onClick={() => handleMemberClick({
                                id: member.id,
                                userId: member.userId,
                                name: member.name,
                                memberNumber: member.memberNumber
                              })}
                            >
                              <TableCell className="text-muted-foreground text-xs py-2">{idx + 1}</TableCell>
                              <TableCell className="py-2">
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {member.memberNumber || '-'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium text-xs py-2">
                                <div className="flex items-center gap-1">
                                  <span className="truncate max-w-[100px]">{member.name}</span>
                                  <Eye className="h-3 w-3 text-muted-foreground shrink-0" />
                                </div>
                              </TableCell>
                              {/* Opening Balance */}
                              <TableCell className="text-right font-mono text-[10px] border-l py-2">
                                {formatCurrency(member.opening.pokok)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[10px] py-2">
                                {formatCurrency(member.opening.wajib)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[10px] py-2">
                                {formatCurrency(member.opening.sukarela)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[10px] font-bold text-blue-600 py-2">
                                {formatCurrency(member.opening.total)}
                              </TableCell>
                              {/* Additions - Hidden on smaller screens */}
                              <TableCell className="text-right font-mono text-[10px] border-l text-emerald-600 py-2 hidden lg:table-cell">
                                {member.additions.pokok > 0 ? formatCurrency(member.additions.pokok) : '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[10px] text-emerald-600 py-2 hidden lg:table-cell">
                                {member.additions.wajib > 0 ? formatCurrency(member.additions.wajib) : '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[10px] text-emerald-600 py-2 hidden lg:table-cell">
                                {member.additions.sukarela > 0 ? formatCurrency(member.additions.sukarela) : '-'}
                              </TableCell>
                              {/* Withdrawals - Hidden on smaller screens */}
                              <TableCell className="text-right font-mono text-[10px] border-l text-rose-600 py-2 hidden lg:table-cell">
                                {member.withdrawals.sukarela > 0 ? formatCurrency(member.withdrawals.sukarela) : '-'}
                              </TableCell>
                              {/* Ending Balance */}
                              <TableCell className="text-right font-mono text-[10px] border-l py-2">
                                {formatCurrency(member.ending.pokok)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[10px] py-2">
                                {formatCurrency(member.ending.wajib)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[10px] py-2">
                                {formatCurrency(member.ending.sukarela)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[10px] font-bold text-purple-600 py-2">
                                {formatCurrency(member.ending.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Totals Row */}
                          <TableRow className="bg-muted/50 font-bold border-t-2">
                            <TableCell colSpan={3} className="text-right text-xs">TOTAL</TableCell>
                            <TableCell className="text-right font-mono text-[10px] border-l">
                              {formatCurrency(memberTotals.openingPokok)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px]">
                              {formatCurrency(memberTotals.openingWajib)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px]">
                              {formatCurrency(memberTotals.openingSukarela)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px] text-blue-600">
                              {formatCurrency(memberTotals.openingTotal)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px] border-l text-emerald-600 hidden lg:table-cell">
                              {formatCurrency(memberTotals.addPokok)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px] text-emerald-600 hidden lg:table-cell">
                              {formatCurrency(memberTotals.addWajib)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px] text-emerald-600 hidden lg:table-cell">
                              {formatCurrency(memberTotals.addSukarela)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px] border-l text-rose-600 hidden lg:table-cell">
                              {formatCurrency(memberTotals.withdrawSukarela)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px] border-l">
                              {formatCurrency(memberTotals.endingPokok)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px]">
                              {formatCurrency(memberTotals.endingWajib)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px]">
                              {formatCurrency(memberTotals.endingSukarela)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px] text-purple-600">
                              {formatCurrency(memberTotals.endingTotal)}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </div>

              {/* Members count info */}
              <p className="text-xs sm:text-sm text-muted-foreground">
                Menampilkan {filteredMemberData.length} anggota
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader className="py-2 sm:py-3 px-3 sm:px-6">
          <CardTitle className="text-xs sm:text-sm">Akun Terkait</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Akun Kas
              </p>
              <div className="flex flex-wrap gap-1">
                {cashAccounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada akun kas</p>
                ) : (
                  cashAccounts.map(acc => (
                    <Badge key={acc.id} variant="outline" className="text-[10px] sm:text-xs">
                      {acc.account_code} - {acc.account_name}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Akun Bank
              </p>
              <div className="flex flex-wrap gap-1">
                {bankAccounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada akun bank</p>
                ) : (
                  bankAccounts.map(acc => (
                    <Badge key={acc.id} variant="outline" className="text-[10px] sm:text-xs">
                      {acc.account_code} - {acc.account_name}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member Transaction Detail Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Riwayat Transaksi Anggota
            </DialogTitle>
            <DialogDescription>
              {selectedMember && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="font-mono">
                    {selectedMember.memberNumber || '-'}
                  </Badge>
                  <span className="font-medium">{selectedMember.name}</span>
                  <span className="text-muted-foreground">- Tahun {selectedYear}</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Filter and Print Controls */}
          {memberTransactions && memberTransactions.length > 0 && (
            <div className="space-y-3 mb-3">
              {/* Type Filter */}
              <div className="flex flex-wrap gap-1">
                {transactionFilterOptions.map(option => (
                  <Button
                    key={option.value}
                    variant={transactionFilter === option.value ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setTransactionFilter(option.value)}
                  >
                    {option.label}
                    {option.value !== 'all' && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                        {memberTransactions.filter(t => option.types.includes(t.type)).length}
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
              
              {/* Date Range Filter and Print Button */}
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "justify-start text-left font-normal h-8 text-xs",
                          !dateRangeFilter.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {dateRangeFilter.from ? (
                          format(dateRangeFilter.from, "dd MMM yyyy", { locale: id })
                        ) : (
                          "Dari tanggal"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateRangeFilter.from}
                        onSelect={(date) => setDateRangeFilter(prev => ({ ...prev, from: date }))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <span className="text-muted-foreground text-xs">-</span>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "justify-start text-left font-normal h-8 text-xs",
                          !dateRangeFilter.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {dateRangeFilter.to ? (
                          format(dateRangeFilter.to, "dd MMM yyyy", { locale: id })
                        ) : (
                          "Sampai tanggal"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateRangeFilter.to}
                        onSelect={(date) => setDateRangeFilter(prev => ({ ...prev, to: date }))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  
                  {(dateRangeFilter.from || dateRangeFilter.to) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={clearDateRange}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
                <Button variant="outline" size="sm" onClick={printMemberTransactionsToPDF}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print PDF
                </Button>
              </div>
            </div>
          )}
          
          <ScrollArea className="max-h-[60vh]">
            {transactionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !memberTransactions || memberTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Tidak ada transaksi pada tahun {selectedYear}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Simpanan Pokok</p>
                      <p className="text-sm font-bold text-blue-600">
                        {formatCurrency(
                          memberTransactions
                            .filter(t => t.type === 'simpanan_pokok' && t.status === 'approved')
                            .reduce((sum, t) => sum + Number(t.amount), 0)
                        )}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Simpanan Wajib</p>
                      <p className="text-sm font-bold text-emerald-600">
                        {formatCurrency(
                          memberTransactions
                            .filter(t => ['simpanan_wajib', 'setor_simpanan_wajib'].includes(t.type) && t.status === 'approved')
                            .reduce((sum, t) => sum + Number(t.amount), 0)
                        )}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Simpanan Sukarela</p>
                      <p className="text-sm font-bold text-purple-600">
                        {formatCurrency(
                          memberTransactions
                            .filter(t => ['simpanan_sukarela', 'setor_simpanan_sukarela'].includes(t.type) && t.status === 'approved')
                            .reduce((sum, t) => sum + Number(t.amount), 0)
                        )}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Penarikan</p>
                      <p className="text-sm font-bold text-rose-600">
                        {formatCurrency(
                          memberTransactions
                            .filter(t => t.type === 'penarikan_simpanan_sukarela' && t.status === 'approved')
                            .reduce((sum, t) => sum + Number(t.amount), 0)
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Transaction List */}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10">No</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Jenis Transaksi</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          Tidak ada transaksi untuk filter ini
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((tx, idx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {tx.date ? format(parseISO(tx.date), 'dd MMM yyyy', { locale: id }) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {transactionTypeLabels[tx.type] || tx.type}
                              </span>
                              {tx.notes && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {tx.notes}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-mono font-medium ${
                            tx.type === 'penarikan_simpanan_sukarela' ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {tx.type === 'penarikan_simpanan_sukarela' ? '-' : '+'}{formatCurrency(Number(tx.amount))}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                tx.status === 'approved' ? 'default' : 
                                tx.status === 'rejected' ? 'destructive' : 
                                'secondary'
                              }
                              className="text-xs"
                            >
                              {tx.status === 'approved' ? 'Disetujui' : 
                               tx.status === 'rejected' ? 'Ditolak' : 'Pending'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                
                <p className="text-xs text-muted-foreground text-center">
                  {transactionFilter === 'all' 
                    ? `Total ${memberTransactions.length} transaksi`
                    : `Menampilkan ${filteredTransactions.length} dari ${memberTransactions.length} transaksi`
                  }
                </p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
