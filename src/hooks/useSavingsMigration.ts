import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { createAndDownloadExcelMixed, readExcelFile } from '@/lib/excelUtils';
import type { MigrationJournalMode } from '@/lib/types';

export interface SavingsMigrationEntry {
  rowIndex: number;
  memberNumber: string;
  memberName: string;
  memberId?: string;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  depositDate?: string;
  notes?: string;
  isValid: boolean;
  validationErrors: string[];
  validationWarnings: string[];
}

interface MigrationHistory {
  id: string;
  type: string;
  createdAt: string;
  createdByName: string;
  totalRecords: number;
  successCount: number;
  failCount: number;
  journalMode: string;
  journalCount: number;
}

interface MigrationResult {
  success: boolean;
  successCount: number;
  failCount: number;
  errors: string[];
  warnings: string[];
  journalEntryIds: string[];
}

export const useSavingsMigration = () => {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<SavingsMigrationEntry[]>([]);
  const [migrationHistory, setMigrationHistory] = useState<MigrationHistory[]>([]);

  // Download template
  const downloadTemplate = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch members
      const { data: profiles } = await supabase
        .from('profiles')
        .select('member_number, name')
        .eq('approval_status', 'approved')
        .order('member_number');

      const templateData = (profiles || []).map(p => ({
        'No. Anggota': p.member_number,
        'Nama Anggota': p.name,
        'Simpanan Pokok': 0,
        'Simpanan Wajib': 0,
        'Simpanan Sukarela': 0,
        'Tanggal Setor': format(new Date(), 'yyyy-MM-dd'),
        'Catatan': '',
      }));

      // Instructions
      const instructions = [
        ['PETUNJUK PENGISIAN TEMPLATE MIGRASI SIMPANAN'],
        [''],
        ['1. Kolom No. Anggota dan Nama Anggota sudah terisi otomatis'],
        ['2. Isi nominal simpanan untuk setiap jenis:'],
        ['   - Simpanan Pokok: Simpanan awal saat mendaftar'],
        ['   - Simpanan Wajib: Simpanan rutin bulanan'],
        ['   - Simpanan Sukarela: Simpanan tidak wajib'],
        ['3. Tanggal Setor: Format YYYY-MM-DD (contoh: 2024-01-15)'],
        ['4. Catatan: Keterangan opsional'],
        [''],
        ['CATATAN PENTING:'],
        ['- Nominal 0 atau kosong akan diabaikan'],
        ['- Pastikan anggota sudah terdaftar di sistem'],
      ];
      
      await createAndDownloadExcelMixed(
        [
          { type: 'json', name: 'Simpanan', data: templateData },
          { type: 'aoa', name: 'Petunjuk', data: instructions }
        ],
        `template-migrasi-simpanan-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      );
      toast.success('Template berhasil diunduh');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Gagal mengunduh template');
    } finally {
      setLoading(false);
    }
  }, []);

  // Parse Excel file
  const parseExcel = useCallback(async (file: File): Promise<SavingsMigrationEntry[]> => {
    try {
      const jsonData = await readExcelFile(file);

      // Fetch members
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, member_number, name')
        .eq('approval_status', 'approved');
      
      const memberMap = new Map((profiles || []).map(p => [p.member_number, p]));

      const parsedEntries: SavingsMigrationEntry[] = jsonData.map((row: any, index: number) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        const memberNumber = String(row['No. Anggota'] || '').trim();
        const simpananPokok = Number(row['Simpanan Pokok']) || 0;
        const simpananWajib = Number(row['Simpanan Wajib']) || 0;
        const simpananSukarela = Number(row['Simpanan Sukarela']) || 0;
        
        // Validate member
        const member = memberMap.get(memberNumber);
        if (!member) {
          errors.push('Anggota tidak ditemukan');
        }
        
        // Validate amounts
        if (simpananPokok < 0 || simpananWajib < 0 || simpananSukarela < 0) {
          errors.push('Nominal tidak boleh negatif');
        }

        if (simpananPokok === 0 && simpananWajib === 0 && simpananSukarela === 0) {
          warnings.push('Semua nominal 0, baris ini akan diabaikan');
        }

        return {
          rowIndex: index + 2,
          memberNumber,
          memberName: String(row['Nama Anggota'] || member?.name || ''),
          memberId: member?.user_id,
          simpananPokok,
          simpananWajib,
          simpananSukarela,
          depositDate: row['Tanggal Setor'] ? String(row['Tanggal Setor']) : undefined,
          notes: row['Catatan'] ? String(row['Catatan']) : undefined,
          isValid: errors.length === 0 && (simpananPokok > 0 || simpananWajib > 0 || simpananSukarela > 0),
          validationErrors: errors,
          validationWarnings: warnings,
        };
      });

      setEntries(parsedEntries);
      return parsedEntries;
    } catch (error) {
      console.error('Error parsing Excel:', error);
      throw new Error('Gagal membaca file Excel');
    }
  }, []);

  // Bulk import with journaling
  const bulkImport = useCallback(async (
    entriesToImport: SavingsMigrationEntry[],
    journalMode: MigrationJournalMode,
    debitAccountId: string
  ): Promise<MigrationResult> => {
    const result: MigrationResult = {
      success: false,
      successCount: 0,
      failCount: 0,
      errors: [],
      warnings: [],
      journalEntryIds: [],
    };

    try {
      setLoading(true);
      
      const { data: userData } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      
      // Filter valid entries with amounts
      const validEntries = entriesToImport.filter(e => 
        e.isValid && 
        e.memberId &&
        (e.simpananPokok > 0 || e.simpananWajib > 0 || e.simpananSukarela > 0)
      );

      if (validEntries.length === 0) {
        result.errors.push('Tidak ada data simpanan valid untuk diimport');
        return result;
      }

      // Get account IDs for journaling
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('id, account_code, account_name, balance')
        .eq('is_active', true);

      const pokokAccount = accounts?.find(a => 
        a.account_name.toLowerCase().includes('simpanan') && 
        a.account_name.toLowerCase().includes('pokok')
      );
      const wajibAccount = accounts?.find(a => 
        a.account_name.toLowerCase().includes('simpanan') && 
        a.account_name.toLowerCase().includes('wajib')
      );
      const sukarelaAccount = accounts?.find(a => 
        a.account_name.toLowerCase().includes('simpanan') && 
        a.account_name.toLowerCase().includes('sukarela')
      );
      const debitAccount = accounts?.find(a => a.id === debitAccountId);

      if (!pokokAccount || !wajibAccount || !sukarelaAccount || !debitAccount) {
        result.errors.push('Akun jurnal tidak lengkap. Pastikan akun Simpanan Pokok, Wajib, Sukarela, dan akun debit tersedia.');
        return result;
      }

      // Process entries
      for (const entry of validEntries) {
        try {
          const transactionDate = entry.depositDate || format(new Date(), 'yyyy-MM-dd');
          const transactions = [];

          // Create transactions for each type
          if (entry.simpananPokok > 0) {
            transactions.push({
              user_id: entry.memberId,
              type: 'saldo_awal_pokok',
              amount: entry.simpananPokok,
              date: transactionDate,
              status: 'approved',
              payment_method: 'transfer_bank',
              account_holder_name: entry.memberName,
              notes: `Migrasi simpanan pokok - ${entry.notes || ''}`.trim(),
              approved_at: now,
              approved_by: userData?.user?.id,
            });
          }

          if (entry.simpananWajib > 0) {
            transactions.push({
              user_id: entry.memberId,
              type: 'saldo_awal_wajib',
              amount: entry.simpananWajib,
              date: transactionDate,
              status: 'approved',
              payment_method: 'transfer_bank',
              account_holder_name: entry.memberName,
              notes: `Migrasi simpanan wajib - ${entry.notes || ''}`.trim(),
              approved_at: now,
              approved_by: userData?.user?.id,
            });
          }

          if (entry.simpananSukarela > 0) {
            transactions.push({
              user_id: entry.memberId,
              type: 'saldo_awal_sukarela',
              amount: entry.simpananSukarela,
              date: transactionDate,
              status: 'approved',
              payment_method: 'transfer_bank',
              account_holder_name: entry.memberName,
              notes: `Migrasi simpanan sukarela - ${entry.notes || ''}`.trim(),
              approved_at: now,
              approved_by: userData?.user?.id,
            });
          }

          if (transactions.length > 0) {
            const { error: txError } = await supabase
              .from('transactions')
              .insert(transactions);

            if (txError) {
              result.errors.push(`Baris ${entry.rowIndex}: ${txError.message}`);
              result.failCount++;
              continue;
            }
          }

          // Create journal entry (per transaction mode)
          if (journalMode === 'per_transaction') {
            const journalId = await createSavingsJournal(
              entry,
              debitAccount,
              pokokAccount,
              wajibAccount,
              sukarelaAccount,
              userData?.user?.id
            );
            if (journalId) {
              result.journalEntryIds.push(journalId);
            }
          }

          result.successCount++;
        } catch (err: any) {
          result.errors.push(`Baris ${entry.rowIndex}: ${err.message}`);
          result.failCount++;
        }
      }

      // Create batch journal
      if (journalMode === 'per_batch' && result.successCount > 0) {
        const journalId = await createBatchSavingsJournal(
          validEntries.slice(0, result.successCount),
          debitAccount,
          pokokAccount,
          wajibAccount,
          sukarelaAccount,
          userData?.user?.id
        );
        if (journalId) {
          result.journalEntryIds.push(journalId);
        }
      }

      // Save migration history
      await saveMigrationHistory({
        type: 'savings',
        totalRecords: validEntries.length,
        successCount: result.successCount,
        failCount: result.failCount,
        journalMode,
        journalCount: result.journalEntryIds.length,
        createdBy: userData?.user?.id,
      });

      result.success = result.successCount > 0;
      
      if (result.successCount > 0) {
        toast.success(`${result.successCount} simpanan berhasil diimport`);
      }
      if (result.failCount > 0) {
        toast.warning(`${result.failCount} simpanan gagal diimport`);
      }

      return result;
    } catch (error: any) {
      result.errors.push(error.message);
      toast.error('Gagal mengimport data simpanan');
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper: Create journal for single member savings
  const createSavingsJournal = async (
    entry: SavingsMigrationEntry,
    debitAccount: any,
    pokokAccount: any,
    wajibAccount: any,
    sukarelaAccount: any,
    createdBy?: string
  ): Promise<string | null> => {
    try {
      const totalAmount = entry.simpananPokok + entry.simpananWajib + entry.simpananSukarela;
      const entryDate = entry.depositDate || format(new Date(), 'yyyy-MM-dd');

      const yearMonth = format(new Date(), 'yyyyMM');
      const { count } = await supabase
        .from('journal_entries')
        .select('*', { count: 'exact', head: true })
        .ilike('entry_number', `JMS-${yearMonth}%`);
      
      const sequence = (count || 0) + 1;
      const entryNumber = `JMS-${yearMonth}-${sequence.toString().padStart(4, '0')}`;

      const { data: journal, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: entryDate,
          description: `Migrasi simpanan - ${entry.memberName} (${entry.memberNumber})`,
          total_debit: totalAmount,
          total_credit: totalAmount,
          is_balanced: true,
          status: 'approved',
          reference_type: 'savings_migration',
          created_by: createdBy,
          approved_by: createdBy,
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (journalError) throw journalError;

      const lines = [
        {
          journal_entry_id: journal.id,
          account_id: debitAccount.id,
          debit_amount: totalAmount,
          credit_amount: 0,
          description: `D. ${debitAccount.account_name}`,
        }
      ];

      if (entry.simpananPokok > 0) {
        lines.push({
          journal_entry_id: journal.id,
          account_id: pokokAccount.id,
          debit_amount: 0,
          credit_amount: entry.simpananPokok,
          description: `K. Simpanan Pokok`,
        });
      }

      if (entry.simpananWajib > 0) {
        lines.push({
          journal_entry_id: journal.id,
          account_id: wajibAccount.id,
          debit_amount: 0,
          credit_amount: entry.simpananWajib,
          description: `K. Simpanan Wajib`,
        });
      }

      if (entry.simpananSukarela > 0) {
        lines.push({
          journal_entry_id: journal.id,
          account_id: sukarelaAccount.id,
          debit_amount: 0,
          credit_amount: entry.simpananSukarela,
          description: `K. Simpanan Sukarela`,
        });
      }

      await supabase.from('journal_entry_lines').insert(lines);

      // Update COA balances
      await supabase
        .from('chart_of_accounts')
        .update({ balance: (debitAccount.balance || 0) + totalAmount })
        .eq('id', debitAccount.id);

      if (entry.simpananPokok > 0) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (pokokAccount.balance || 0) + entry.simpananPokok })
          .eq('id', pokokAccount.id);
      }

      if (entry.simpananWajib > 0) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (wajibAccount.balance || 0) + entry.simpananWajib })
          .eq('id', wajibAccount.id);
      }

      if (entry.simpananSukarela > 0) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (sukarelaAccount.balance || 0) + entry.simpananSukarela })
          .eq('id', sukarelaAccount.id);
      }

      return journal.id;
    } catch (error) {
      console.error('Error creating savings journal:', error);
      return null;
    }
  };

  // Helper: Create batch journal
  const createBatchSavingsJournal = async (
    entriesToJournal: SavingsMigrationEntry[],
    debitAccount: any,
    pokokAccount: any,
    wajibAccount: any,
    sukarelaAccount: any,
    createdBy?: string
  ): Promise<string | null> => {
    try {
      const totalPokok = entriesToJournal.reduce((sum, e) => sum + e.simpananPokok, 0);
      const totalWajib = entriesToJournal.reduce((sum, e) => sum + e.simpananWajib, 0);
      const totalSukarela = entriesToJournal.reduce((sum, e) => sum + e.simpananSukarela, 0);
      const totalAmount = totalPokok + totalWajib + totalSukarela;

      const entryDate = format(new Date(), 'yyyy-MM-dd');
      
      const yearMonth = format(new Date(), 'yyyyMM');
      const { count } = await supabase
        .from('journal_entries')
        .select('*', { count: 'exact', head: true })
        .ilike('entry_number', `JMB-${yearMonth}%`);
      
      const sequence = (count || 0) + 1;
      const entryNumber = `JMB-${yearMonth}-${sequence.toString().padStart(4, '0')}`;

      const { data: journal, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: entryDate,
          description: `Migrasi batch simpanan (${entriesToJournal.length} anggota)`,
          total_debit: totalAmount,
          total_credit: totalAmount,
          is_balanced: true,
          status: 'approved',
          reference_type: 'savings_migration_batch',
          created_by: createdBy,
          approved_by: createdBy,
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (journalError) throw journalError;

      const lines = [
        {
          journal_entry_id: journal.id,
          account_id: debitAccount.id,
          debit_amount: totalAmount,
          credit_amount: 0,
          description: `D. ${debitAccount.account_name} - Batch migrasi`,
        }
      ];

      if (totalPokok > 0) {
        lines.push({
          journal_entry_id: journal.id,
          account_id: pokokAccount.id,
          debit_amount: 0,
          credit_amount: totalPokok,
          description: `K. Simpanan Pokok (${entriesToJournal.length} anggota)`,
        });
      }

      if (totalWajib > 0) {
        lines.push({
          journal_entry_id: journal.id,
          account_id: wajibAccount.id,
          debit_amount: 0,
          credit_amount: totalWajib,
          description: `K. Simpanan Wajib (${entriesToJournal.length} anggota)`,
        });
      }

      if (totalSukarela > 0) {
        lines.push({
          journal_entry_id: journal.id,
          account_id: sukarelaAccount.id,
          debit_amount: 0,
          credit_amount: totalSukarela,
          description: `K. Simpanan Sukarela (${entriesToJournal.length} anggota)`,
        });
      }

      await supabase.from('journal_entry_lines').insert(lines);

      // Update COA balances for batch
      await supabase
        .from('chart_of_accounts')
        .update({ balance: (debitAccount.balance || 0) + totalAmount })
        .eq('id', debitAccount.id);

      if (totalPokok > 0) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (pokokAccount.balance || 0) + totalPokok })
          .eq('id', pokokAccount.id);
      }

      if (totalWajib > 0) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (wajibAccount.balance || 0) + totalWajib })
          .eq('id', wajibAccount.id);
      }

      if (totalSukarela > 0) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (sukarelaAccount.balance || 0) + totalSukarela })
          .eq('id', sukarelaAccount.id);
      }

      return journal.id;
    } catch (error) {
      console.error('Error creating batch savings journal:', error);
      return null;
    }
  };

  // Save migration history
  const saveMigrationHistory = async (data: {
    type: string;
    totalRecords: number;
    successCount: number;
    failCount: number;
    journalMode: string;
    journalCount: number;
    createdBy?: string;
  }) => {
    try {
      const historyKey = `migration_history_${data.type}_${Date.now()}`;
      await supabase
        .from('cooperative_settings')
        .insert({
          key: historyKey,
          value: {
            ...data,
            createdAt: new Date().toISOString(),
          },
        });
    } catch (error) {
      console.error('Error saving migration history:', error);
    }
  };

  // Fetch migration history
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('cooperative_settings')
        .select('*')
        .ilike('key', 'migration_history_savings_%')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const history: MigrationHistory[] = (data || []).map(item => {
        const value = item.value as any;
        return {
          id: item.id,
          type: value.type || 'savings',
          createdAt: value.createdAt || item.updated_at,
          createdByName: value.createdByName || 'Admin',
          totalRecords: value.totalRecords || 0,
          successCount: value.successCount || 0,
          failCount: value.failCount || 0,
          journalMode: value.journalMode || 'per_batch',
          journalCount: value.journalCount || 0,
        };
      });

      setMigrationHistory(history);
    } catch (error) {
      console.error('Error fetching migration history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear entries
  const clearEntries = useCallback(() => {
    setEntries([]);
  }, []);

  return {
    loading,
    entries,
    migrationHistory,
    parseExcel,
    bulkImport,
    downloadTemplate,
    fetchHistory,
    clearEntries,
  };
};
