import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateAuditLog } from './useAuditLogs';
import { createWorkbookBuffer, JsonSheetData } from '@/lib/excelUtils';

export type ExportCategory = 'all' | 'members' | 'savings' | 'transactions' | 'loans' | 'journals' | 'shu' | 'financial';

interface YearlyExportProgress {
  current: number;
  total: number;
  currentCategory: string;
}

export const useYearlyDataExport = () => {
  const { user } = useAuth();
  const { createLog } = useCreateAuditLog();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<YearlyExportProgress>({ current: 0, total: 0, currentCategory: '' });

  const getAvailableYears = async (): Promise<number[]> => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    
    // Get earliest transaction year
    const { data: earliestTx } = await supabase
      .from('transactions')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1);
    
    const startYear = earliestTx?.[0] 
      ? new Date(earliestTx[0].created_at).getFullYear() 
      : currentYear;
    
    for (let y = startYear; y <= currentYear; y++) {
      years.push(y);
    }
    
    return years;
  };

  const fetchMembersData = async (year: number) => {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    // Active members in that year
    const { data: activeMembers } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .or(`join_date.lte.${endDate},join_date.is.null`)
      .limit(10000);
    
    // New members joined in that year
    const { data: newMembers } = await supabase
      .from('profiles')
      .select('*')
      .gte('join_date', startDate)
      .lte('join_date', endDate)
      .limit(10000);
    
    // Exited members in that year
    const { data: exitedMembers } = await supabase
      .from('profiles')
      .select('*')
      .eq('exit_year', year)
      .limit(10000);
    
    return { activeMembers, newMembers, exitedMembers };
  };

  const fetchSavingsData = async (year: number) => {
    const { data: savingsSummary } = await supabase
      .from('savings_summary')
      .select(`
        *,
        profiles!inner(name, member_number, is_active)
      `)
      .limit(10000);
    
    return { savingsSummary };
  };

  const fetchTransactionsData = async (year: number) => {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31T23:59:59`;
    
    const { data: transactions } = await supabase
      .from('transactions')
      .select(`
        *,
        profiles!inner(name, member_number)
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .limit(10000);
    
    return { transactions };
  };

  const fetchLoansData = async (year: number) => {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31T23:59:59`;
    
    // Loans applied in that year
    const { data: loans } = await supabase
      .from('loans')
      .select(`
        *,
        profiles!inner(name, member_number)
      `)
      .gte('application_date', startDate)
      .lte('application_date', endDate)
      .limit(10000);
    
    // Installments paid in that year
    const { data: installments } = await supabase
      .from('loan_installments')
      .select(`
        *,
        loans!inner(
          user_id,
          principal_amount,
          profiles!inner(name, member_number)
        )
      `)
      .gte('paid_date', startDate)
      .lte('paid_date', endDate)
      .eq('status', 'paid')
      .limit(10000);
    
    return { loans, installments };
  };

  const fetchJournalsData = async (year: number) => {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const { data: journalEntries } = await supabase
      .from('journal_entries')
      .select('*')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: false })
      .limit(10000);
    
    const { data: journalLines } = await supabase
      .from('journal_entry_lines')
      .select(`
        *,
        journal_entries!inner(entry_date, entry_number, description),
        chart_of_accounts!inner(account_code, account_name)
      `)
      .gte('journal_entries.entry_date', startDate)
      .lte('journal_entries.entry_date', endDate)
      .limit(10000);
    
    return { journalEntries, journalLines };
  };

  const fetchSHUData = async (year: number) => {
    const { data: shuDistributions } = await supabase
      .from('shu_distributions')
      .select('*')
      .eq('year', year)
      .limit(100);
    
    // Check if shu_withheld table exists for individual member SHU
    const { data: shuWithheld } = await supabase
      .from('shu_withheld')
      .select(`
        *,
        profiles!inner(name, member_number)
      `)
      .eq('year', year)
      .limit(10000);
    
    return { shuDistributions, shuWithheld };
  };

  const fetchFinancialData = async (year: number) => {
    const { data: balanceSheet } = await supabase
      .from('balance_sheets')
      .select('*')
      .eq('year', year)
      .limit(1);
    
    const { data: incomeEntries } = await supabase
      .from('income_entries')
      .select('*')
      .eq('year', year)
      .limit(10000);
    
    const { data: expenseEntries } = await supabase
      .from('expense_entries')
      .select('*')
      .eq('year', year)
      .limit(10000);
    
    return { balanceSheet, incomeEntries, expenseEntries };
  };

  const createSummarySheet = (year: number, stats: Record<string, number>) => {
    return [
      { Keterangan: 'Tahun Buku', Nilai: year.toString() },
      { Keterangan: 'Tanggal Export', Nilai: new Date().toLocaleDateString('id-ID') },
      { Keterangan: '', Nilai: '' },
      { Keterangan: '=== RINGKASAN DATA ===', Nilai: '' },
      { Keterangan: 'Jumlah Anggota Aktif', Nilai: stats.activeMembers?.toString() || '0' },
      { Keterangan: 'Anggota Baru', Nilai: stats.newMembers?.toString() || '0' },
      { Keterangan: 'Anggota Keluar', Nilai: stats.exitedMembers?.toString() || '0' },
      { Keterangan: 'Total Transaksi', Nilai: stats.transactions?.toString() || '0' },
      { Keterangan: 'Total Pinjaman', Nilai: stats.loans?.toString() || '0' },
      { Keterangan: 'Angsuran Dibayar', Nilai: stats.installments?.toString() || '0' },
      { Keterangan: 'Jurnal Entry', Nilai: stats.journalEntries?.toString() || '0' },
    ];
  };

  const flattenData = (data: any[], prefix = '') => {
    return data.map(item => {
      const flattened: Record<string, any> = {};
      Object.entries(item).forEach(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.entries(value as Record<string, any>).forEach(([subKey, subValue]) => {
            flattened[`${key}_${subKey}`] = subValue;
          });
        } else {
          flattened[key] = value;
        }
      });
      return flattened;
    });
  };

  const exportYearlyData = async (year: number, categories: ExportCategory[] = ['all']): Promise<boolean> => {
    if (!user) return false;

    setIsExporting(true);
    const includeAll = categories.includes('all');
    const stats: Record<string, number> = {};

    try {
      const sheets: JsonSheetData[] = [];
      const totalSteps = includeAll ? 7 : categories.length;
      let currentStep = 0;

      // Members
      if (includeAll || categories.includes('members')) {
        setProgress({ current: ++currentStep, total: totalSteps, currentCategory: 'Anggota' });
        const { activeMembers, newMembers, exitedMembers } = await fetchMembersData(year);
        
        stats.activeMembers = activeMembers?.length || 0;
        stats.newMembers = newMembers?.length || 0;
        stats.exitedMembers = exitedMembers?.length || 0;
        
        if (activeMembers?.length) {
          sheets.push({ name: 'Anggota Aktif', data: activeMembers });
        }
        if (newMembers?.length) {
          sheets.push({ name: 'Anggota Baru', data: newMembers });
        }
        if (exitedMembers?.length) {
          sheets.push({ name: 'Anggota Keluar', data: exitedMembers });
        }
      }

      // Savings
      if (includeAll || categories.includes('savings')) {
        setProgress({ current: ++currentStep, total: totalSteps, currentCategory: 'Simpanan' });
        const { savingsSummary } = await fetchSavingsData(year);
        
        if (savingsSummary?.length) {
          const flatData = flattenData(savingsSummary);
          sheets.push({ name: 'Simpanan', data: flatData });
        }
      }

      // Transactions
      if (includeAll || categories.includes('transactions')) {
        setProgress({ current: ++currentStep, total: totalSteps, currentCategory: 'Transaksi' });
        const { transactions } = await fetchTransactionsData(year);
        
        stats.transactions = transactions?.length || 0;
        
        if (transactions?.length) {
          const flatData = flattenData(transactions);
          sheets.push({ name: 'Transaksi', data: flatData });
        }
      }

      // Loans
      if (includeAll || categories.includes('loans')) {
        setProgress({ current: ++currentStep, total: totalSteps, currentCategory: 'Pinjaman' });
        const { loans, installments } = await fetchLoansData(year);
        
        stats.loans = loans?.length || 0;
        stats.installments = installments?.length || 0;
        
        if (loans?.length) {
          const flatData = flattenData(loans);
          sheets.push({ name: 'Pinjaman', data: flatData });
        }
        if (installments?.length) {
          const flatData = flattenData(installments);
          sheets.push({ name: 'Angsuran', data: flatData });
        }
      }

      // Journals
      if (includeAll || categories.includes('journals')) {
        setProgress({ current: ++currentStep, total: totalSteps, currentCategory: 'Jurnal' });
        const { journalEntries, journalLines } = await fetchJournalsData(year);
        
        stats.journalEntries = journalEntries?.length || 0;
        
        if (journalEntries?.length) {
          sheets.push({ name: 'Jurnal', data: journalEntries });
        }
        if (journalLines?.length) {
          const flatData = flattenData(journalLines);
          sheets.push({ name: 'Detail Jurnal', data: flatData });
        }
      }

      // SHU
      if (includeAll || categories.includes('shu')) {
        setProgress({ current: ++currentStep, total: totalSteps, currentCategory: 'SHU' });
        const { shuDistributions, shuWithheld } = await fetchSHUData(year);
        
        if (shuDistributions?.length) {
          sheets.push({ name: 'Distribusi SHU', data: shuDistributions });
        }
        if (shuWithheld?.length) {
          const flatData = flattenData(shuWithheld);
          sheets.push({ name: 'SHU Anggota', data: flatData });
        }
      }

      // Financial
      if (includeAll || categories.includes('financial')) {
        setProgress({ current: ++currentStep, total: totalSteps, currentCategory: 'Laporan Keuangan' });
        const { balanceSheet, incomeEntries, expenseEntries } = await fetchFinancialData(year);
        
        if (balanceSheet?.length) {
          sheets.push({ name: 'Neraca', data: balanceSheet });
        }
        if (incomeEntries?.length) {
          sheets.push({ name: 'Pendapatan', data: incomeEntries });
        }
        if (expenseEntries?.length) {
          sheets.push({ name: 'Beban', data: expenseEntries });
        }
      }

      // Add summary sheet at the beginning
      const summaryData = createSummarySheet(year, stats);
      sheets.unshift({ name: 'Ringkasan', data: summaryData });

      // Generate and download file
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `Arsip_Tahun_Buku_${year}_${timestamp}.xlsx`;
      const excelBuffer = await createWorkbookBuffer(sheets);
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Record in database
      await supabase.from('data_backups').insert({
        backup_type: 'yearly_archive',
        file_name: fileName,
        file_size: blob.size,
        record_count: Object.values(stats).reduce((a, b) => a + b, 0),
        status: 'completed',
        created_by: user.id,
        metadata: { year, categories, stats },
      });

      // Create audit log
      await createLog('export', 'yearly_archive', `Ekspor arsip tahun buku ${year}`, {
        metadata: { year, categories, stats, file_name: fileName },
      });

      return true;
    } catch (error) {
      console.error('Error exporting yearly data:', error);
      return false;
    } finally {
      setIsExporting(false);
      setProgress({ current: 0, total: 0, currentCategory: '' });
    }
  };

  return {
    exportYearlyData,
    getAvailableYears,
    isExporting,
    progress,
  };
};
