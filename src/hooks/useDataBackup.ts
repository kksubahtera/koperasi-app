import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateAuditLog } from './useAuditLogs';
import { createWorkbookBuffer, JsonSheetData } from '@/lib/excelUtils';

export interface BackupHistory {
  id: string;
  backup_type: string;
  file_name: string;
  file_size: number | null;
  record_count: number | null;
  status: string;
  created_by: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export type BackupType = 'full' | 'members' | 'transactions' | 'loans' | 'savings' | 'journals';

const BACKUP_TYPE_LABELS: Record<BackupType, string> = {
  full: 'Backup Lengkap',
  members: 'Data Anggota',
  transactions: 'Data Transaksi',
  loans: 'Data Pinjaman',
  savings: 'Data Simpanan',
  journals: 'Data Jurnal',
};

export const useDataBackup = () => {
  const { user } = useAuth();
  const { createLog } = useCreateAuditLog();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<BackupHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchBackupHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('data_backups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory((data || []) as BackupHistory[]);
    } catch (error) {
      console.error('Error fetching backup history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const exportData = async (backupType: BackupType): Promise<boolean> => {
    if (!user) return false;

    setIsExporting(true);
    setProgress(0);

    try {
      const sheets: JsonSheetData[] = [];
      let totalRecords = 0;
      const timestamp = new Date().toISOString().split('T')[0];

      // Fetch and add sheets based on backup type
      if (backupType === 'full' || backupType === 'members') {
        setProgress(10);
        // Fetch profiles
        const { data: profilesData } = await supabase.from('profiles').select('*').limit(10000);
        if (profilesData && profilesData.length > 0) {
          sheets.push({ name: 'Anggota', data: profilesData });
          totalRecords += profilesData.length;
        }
        // Fetch savings summary
        const { data: savingsData } = await supabase.from('savings_summary').select('*').limit(10000);
        if (savingsData && savingsData.length > 0) {
          sheets.push({ name: 'Ringkasan Simpanan', data: savingsData });
          totalRecords += savingsData.length;
        }
      }

      if (backupType === 'full' || backupType === 'transactions') {
        setProgress(30);
        const { data: transactionsData } = await supabase.from('transactions').select('*').limit(10000);
        if (transactionsData && transactionsData.length > 0) {
          sheets.push({ name: 'Transaksi', data: transactionsData });
          totalRecords += transactionsData.length;
        }
      }

      if (backupType === 'full' || backupType === 'loans') {
        setProgress(50);
        const { data: loansData } = await supabase.from('loans').select('*').limit(10000);
        if (loansData && loansData.length > 0) {
          sheets.push({ name: 'Pinjaman', data: loansData });
          totalRecords += loansData.length;
        }
        const { data: installmentsData } = await supabase.from('loan_installments').select('*').limit(10000);
        if (installmentsData && installmentsData.length > 0) {
          sheets.push({ name: 'Angsuran', data: installmentsData });
          totalRecords += installmentsData.length;
        }
      }

      if (backupType === 'full' || backupType === 'savings') {
        setProgress(70);
        const { data: savingsSummaryData } = await supabase.from('savings_summary').select('*').limit(10000);
        if (savingsSummaryData && savingsSummaryData.length > 0) {
          sheets.push({ name: 'Simpanan', data: savingsSummaryData });
          totalRecords += savingsSummaryData.length;
        }
      }

      if (backupType === 'full' || backupType === 'journals') {
        setProgress(85);
        const { data: journalData } = await supabase.from('journal_entries').select('*').limit(10000);
        if (journalData && journalData.length > 0) {
          sheets.push({ name: 'Jurnal', data: journalData });
          totalRecords += journalData.length;
        }
        const { data: journalLinesData } = await supabase.from('journal_entry_lines').select('*').limit(10000);
        if (journalLinesData && journalLinesData.length > 0) {
          sheets.push({ name: 'Detail Jurnal', data: journalLinesData });
          totalRecords += journalLinesData.length;
        }
        const { data: coaData } = await supabase.from('chart_of_accounts').select('*').limit(10000);
        if (coaData && coaData.length > 0) {
          sheets.push({ name: 'Bagan Akun', data: coaData });
          totalRecords += coaData.length;
        }
      }

      setProgress(95);

      // Generate file using exceljs
      const fileName = `backup_${backupType}_${timestamp}.xlsx`;
      const excelBuffer = await createWorkbookBuffer(sheets);
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      // Download file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Record backup in database
      await supabase.from('data_backups').insert({
        backup_type: backupType,
        file_name: fileName,
        file_size: blob.size,
        record_count: totalRecords,
        status: 'completed',
        created_by: user.id,
        metadata: {
          exported_tables: backupType === 'full' 
            ? ['profiles', 'savings_summary', 'transactions', 'loans', 'loan_installments', 'journal_entries', 'journal_entry_lines', 'chart_of_accounts']
            : [backupType],
        },
      });

      // Create audit log
      await createLog('export', 'backup', `Ekspor data ${BACKUP_TYPE_LABELS[backupType]}`, {
        metadata: { 
          backup_type: backupType, 
          file_name: fileName, 
          record_count: totalRecords 
        },
      });

      setProgress(100);
      return true;
    } catch (error) {
      console.error('Error exporting data:', error);
      return false;
    } finally {
      setIsExporting(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return {
    exportData,
    isExporting,
    progress,
    history,
    loadingHistory,
    fetchBackupHistory,
    BACKUP_TYPE_LABELS,
  };
};
