import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addMonths, addDays } from 'date-fns';
import { createAndDownloadExcelMixed, readExcelFile, readExcelFileAllSheets } from '@/lib/excelUtils';
import type { 
  InstallmentMigrationEntry, 
  LoanWithInstallmentMigrationEntry,
  InstallmentPaymentEntry,
  MigrationJournalMode,
  InstallmentMigrationResult 
} from '@/lib/types';

interface ActiveLoan {
  id: string;
  userId: string;
  memberNumber: string;
  memberName: string;
  principalAmount: number;
  tenor: number;
  interestRate: number;
  disbursementDate: string;
  remainingPrincipal: number;
  installments: {
    id: string;
    installmentNumber: number;
    dueDate: string;
    principalAmount: number;
    interestAmount: number;
    totalAmount: number;
    status: string;
    paidAmount: number;
    paidDate: string | null;
  }[];
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

export const useInstallmentMigration = () => {
  const [loading, setLoading] = useState(false);
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [migrationHistory, setMigrationHistory] = useState<MigrationHistory[]>([]);

  // Save migration history to cooperative_settings
  const saveMigrationHistory = async (data: {
    type: 'installment' | 'loan_with_installment';
    totalRecords: number;
    successCount: number;
    failCount: number;
    journalMode: string;
    journalCount: number;
    createdBy?: string;
  }) => {
    try {
      const historyKey = `migration_history_${data.type}_${Date.now()}`;
      
      // Get creator name
      let createdByName = 'Admin';
      if (data.createdBy) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', data.createdBy)
          .single();
        if (profile) createdByName = profile.name;
      }

      await supabase
        .from('cooperative_settings')
        .insert({
          key: historyKey,
          value: {
            ...data,
            createdByName,
            createdAt: new Date().toISOString(),
          },
        });
    } catch (error) {
      console.error('Error saving migration history:', error);
    }
  };

  // Fetch migration history
  const fetchMigrationHistory = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('cooperative_settings')
        .select('*')
        .or('key.ilike.migration_history_installment_%,key.ilike.migration_history_loan_with_installment_%')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const history: MigrationHistory[] = (data || []).map(item => {
        const value = item.value as any;
        return {
          id: item.id,
          type: value.type || 'installment',
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
      return history;
    } catch (error) {
      console.error('Error fetching migration history:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all active loans with their installment schedules
  const fetchActiveLoans = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get all active loans
      const { data: loans, error: loanError } = await supabase
        .from('loans')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (loanError) throw loanError;

      if (!loans || loans.length === 0) {
        setActiveLoans([]);
        return [];
      }

      // Get user profiles
      const userIds = [...new Set(loans.map(l => l.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      // Get installments for each loan
      const loanIds = loans.map(l => l.id);
      const { data: installments } = await supabase
        .from('loan_installments')
        .select('*')
        .in('loan_id', loanIds)
        .order('installment_number');

      const installmentMap = new Map<string, typeof installments>();
      (installments || []).forEach(inst => {
        const existing = installmentMap.get(inst.loan_id) || [];
        existing.push(inst);
        installmentMap.set(inst.loan_id, existing);
      });

      const mapped: ActiveLoan[] = loans.map(loan => {
        const profile = profileMap.get(loan.user_id);
        const loanInstallments = installmentMap.get(loan.id) || [];
        
        return {
          id: loan.id,
          userId: loan.user_id,
          memberNumber: profile?.member_number || '-',
          memberName: profile?.name || 'Unknown',
          principalAmount: loan.principal_amount,
          tenor: loan.tenor,
          interestRate: loan.interest_rate,
          disbursementDate: loan.disbursement_date,
          remainingPrincipal: loan.remaining_principal,
          installments: loanInstallments.map(inst => ({
            id: inst.id,
            installmentNumber: inst.installment_number,
            dueDate: inst.due_date,
            principalAmount: inst.principal_amount,
            interestAmount: inst.interest_amount,
            totalAmount: inst.total_amount,
            status: inst.status,
            paidAmount: inst.paid_amount,
            paidDate: inst.paid_date,
          })),
        };
      });

      setActiveLoans(mapped);
      return mapped;
    } catch (error) {
      console.error('Error fetching active loans:', error);
      toast.error('Gagal memuat data pinjaman aktif');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Download pre-filled Excel template for installment migration
  const downloadInstallmentTemplate = useCallback(async (loanFilter?: string) => {
    try {
      setLoading(true);
      
      let loans = activeLoans;
      if (loans.length === 0) {
        loans = await fetchActiveLoans();
      }

      if (loanFilter) {
        loans = loans.filter(l => l.id === loanFilter || l.memberNumber.includes(loanFilter));
      }

      if (loans.length === 0) {
        toast.warning('Tidak ada pinjaman aktif untuk diekspor');
        return;
      }

      // Build template data
      const templateData: any[] = [];
      
      loans.forEach(loan => {
        loan.installments.forEach(inst => {
          templateData.push({
            'No. Anggota': loan.memberNumber,
            'Nama Anggota': loan.memberName,
            'ID Pinjaman': loan.id,
            'Pokok Pinjaman': loan.principalAmount,
            'Angsuran Ke': inst.installmentNumber,
            'Tanggal Jatuh Tempo': inst.dueDate,
            'Pokok per Angsuran': inst.principalAmount,
            'Bunga per Angsuran': inst.interestAmount,
            'Tanggal Bayar': inst.status === 'paid' ? inst.paidDate : '',
            'Pokok Dibayar': inst.status === 'paid' ? inst.principalAmount : 0,
            'Bunga Dibayar': inst.status === 'paid' ? inst.interestAmount : 0,
            'Denda Dibayar': 0,
            'Status': inst.status === 'paid' ? 'paid' : 'unpaid',
            'Catatan': '',
          });
        });
      });

      // Add instructions sheet
      const instructions = [
        ['PETUNJUK PENGISIAN TEMPLATE MIGRASI ANGSURAN'],
        [''],
        ['1. Kolom dengan latar abu-abu (No. Anggota s/d Bunga per Angsuran) sudah terisi otomatis'],
        ['2. Anda hanya perlu mengisi kolom berikut untuk angsuran yang sudah dibayar:'],
        ['   - Tanggal Bayar: Format YYYY-MM-DD (contoh: 2024-01-15)'],
        ['   - Pokok Dibayar: Nominal pokok yang dibayar'],
        ['   - Bunga Dibayar: Nominal bunga yang dibayar'],
        ['   - Denda Dibayar: Nominal denda (jika ada)'],
        ['   - Status: paid (lunas), partial (sebagian), unpaid (belum bayar)'],
        ['   - Catatan: Keterangan opsional'],
        [''],
        ['3. Untuk angsuran yang belum dibayar, biarkan kolom pembayaran kosong atau 0'],
        ['4. Pastikan nominal yang diisi tidak melebihi tagihan per angsuran'],
        ['5. Setelah selesai, upload file ini kembali ke sistem'],
      ];

      await createAndDownloadExcelMixed([
        { 
          name: 'Angsuran', 
          type: 'json', 
          data: templateData,
          columns: [15, 25, 40, 15, 12, 18, 18, 18, 15, 15, 15, 15, 10, 30]
        },
        {
          name: 'Petunjuk',
          type: 'aoa',
          data: instructions,
          columns: [80]
        }
      ], `template-migrasi-angsuran-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      toast.success('Template berhasil diunduh');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Gagal mengunduh template');
    } finally {
      setLoading(false);
    }
  }, [activeLoans, fetchActiveLoans]);

  // Download template for new loan + installment migration
  const downloadLoanWithInstallmentTemplate = useCallback(async () => {
    // Sheet 1: Loan data
    const loanData = [
      {
        'No. Anggota': 'MBR-001',
        'Pokok Pinjaman': 10000000,
        'Tenor (bulan)': 12,
        'Bunga (%/bulan)': 1,
        'Tanggal Pencairan': '2024-01-01',
        'Catatan': 'Contoh data',
      }
    ];

    // Sheet 2: Payment history
    const paymentData = [
      {
        'No. Anggota': 'MBR-001',
        'Angsuran Ke': 1,
        'Tanggal Bayar': '2024-02-01',
        'Pokok Dibayar': 833333,
        'Bunga Dibayar': 100000,
        'Denda Dibayar': 0,
        'Status': 'paid',
      }
    ];

    // Instructions sheet
    const instructions = [
      ['PETUNJUK PENGISIAN TEMPLATE MIGRASI PINJAMAN + ANGSURAN'],
      [''],
      ['SHEET 1: DATA PINJAMAN'],
      ['- No. Anggota: Nomor anggota yang terdaftar di sistem'],
      ['- Pokok Pinjaman: Total pinjaman awal'],
      ['- Tenor: Jangka waktu pinjaman dalam bulan'],
      ['- Bunga: Persentase bunga per bulan'],
      ['- Tanggal Pencairan: Format YYYY-MM-DD'],
      [''],
      ['SHEET 2: RIWAYAT PEMBAYARAN'],
      ['- No. Anggota: Harus sama dengan Sheet 1'],
      ['- Angsuran Ke: Urutan angsuran (1, 2, 3, ...)'],
      ['- Tanggal Bayar, Pokok, Bunga, Denda: Isi sesuai riwayat'],
      ['- Status: paid (lunas) atau partial (sebagian)'],
      [''],
      ['CATATAN PENTING:'],
      ['- Pastikan anggota sudah terdaftar di sistem'],
      ['- Pastikan anggota belum memiliki pinjaman aktif'],
      ['- Sistem akan otomatis membuat jadwal angsuran'],
    ];

    await createAndDownloadExcelMixed([
      { name: 'Data Pinjaman', type: 'json', data: loanData, columns: [15, 18, 15, 15, 18, 30] },
      { name: 'Riwayat Pembayaran', type: 'json', data: paymentData, columns: [15, 12, 15, 15, 15, 15, 10] },
      { name: 'Petunjuk', type: 'aoa', data: instructions, columns: [60] }
    ], `template-migrasi-pinjaman-baru-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    
    toast.success('Template berhasil diunduh');
  }, []);

  // Parse Excel file for installment migration
  const parseInstallmentExcel = useCallback(async (file: File): Promise<InstallmentMigrationEntry[]> => {
    try {
      const jsonData = await readExcelFile(file);

      // Fetch all members for validation
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, member_number, name')
        .eq('approval_status', 'approved');
      
      const memberMap = new Map((profiles || []).map(p => [p.member_number, p]));

      // Fetch all loans
      const { data: loans } = await supabase
        .from('loans')
        .select('id, user_id')
        .eq('status', 'active');
      
      const loanMap = new Map((loans || []).map(l => [l.id, l]));

      // Fetch all installments
      const loanIds = (loans || []).map(l => l.id);
      const { data: installments } = await supabase
        .from('loan_installments')
        .select('*')
        .in('loan_id', loanIds);

      const installmentMap = new Map<string, any>();
      (installments || []).forEach(inst => {
        const key = `${inst.loan_id}-${inst.installment_number}`;
        installmentMap.set(key, inst);
      });

      const entries: InstallmentMigrationEntry[] = jsonData.map((row: any, index: number) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        const memberNumber = String(row['No. Anggota'] || '').trim();
        const loanId = String(row['ID Pinjaman'] || '').trim();
        const installmentNumber = Number(row['Angsuran Ke']) || 0;
        const status = String(row['Status'] || 'unpaid').toLowerCase() as any;
        
        // Validate member
        const member = memberMap.get(memberNumber);
        if (!member) {
          errors.push('Anggota tidak ditemukan');
        }
        
        // Validate loan
        const loan = loanMap.get(loanId);
        if (!loan) {
          errors.push('Pinjaman tidak ditemukan');
        } else if (member && loan.user_id !== member.user_id) {
          errors.push('Pinjaman bukan milik anggota ini');
        }

        // Validate installment
        const instKey = `${loanId}-${installmentNumber}`;
        const existingInst = installmentMap.get(instKey);
        if (!existingInst) {
          errors.push('Angsuran tidak ditemukan di jadwal');
        } else if (existingInst.status === 'paid') {
          warnings.push('Angsuran sudah berstatus lunas');
        }

        // Validate amounts if status is paid/partial
        const principalPaid = Number(row['Pokok Dibayar']) || 0;
        const interestPaid = Number(row['Bunga Dibayar']) || 0;
        
        if (status === 'paid' || status === 'partial') {
          if (principalPaid <= 0 && interestPaid <= 0) {
            errors.push('Nominal pembayaran harus lebih dari 0');
          }
        }

        return {
          rowIndex: index + 2, // +2 for header and 0-index
          memberNumber,
          memberName: String(row['Nama Anggota'] || member?.name || ''),
          memberId: member?.user_id,
          loanId,
          installmentNumber,
          dueDate: String(row['Tanggal Jatuh Tempo'] || ''),
          expectedPrincipal: Number(row['Pokok per Angsuran']) || 0,
          expectedInterest: Number(row['Bunga per Angsuran']) || 0,
          paidDate: row['Tanggal Bayar'] ? String(row['Tanggal Bayar']) : undefined,
          principalPaid,
          interestPaid,
          penaltyPaid: Number(row['Denda Dibayar']) || 0,
          status,
          notes: row['Catatan'] ? String(row['Catatan']) : undefined,
          isValid: errors.length === 0,
          validationErrors: errors,
          validationWarnings: warnings,
        };
      });

      return entries;
    } catch (error) {
      throw new Error('Gagal membaca file');
    }
  }, []);

  // Parse Excel for new loan with installment migration
  const parseLoanWithInstallmentExcel = useCallback(async (file: File): Promise<LoanWithInstallmentMigrationEntry[]> => {
    try {
      // Read all sheets from the Excel file
      const allSheets = await readExcelFileAllSheets(file);
      const sheetNames = Object.keys(allSheets);
      
      // Get loan data from first sheet
      const loanData = allSheets[sheetNames[0]] || [];
      
      // Get payment data from second sheet (if exists)
      const paymentData = sheetNames.length > 1 ? allSheets[sheetNames[1]] || [] : [];

      // Fetch all members for validation
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, member_number, name')
        .eq('approval_status', 'approved');
      
      const memberMap = new Map((profiles || []).map(p => [p.member_number, p]));

      // Fetch existing active loans
      const { data: existingLoans } = await supabase
        .from('loans')
        .select('user_id')
        .eq('status', 'active');
      
      const usersWithActiveLoans = new Set((existingLoans || []).map(l => l.user_id));

      // Group payments by member number
      const paymentsByMember = new Map<string, InstallmentPaymentEntry[]>();
      (paymentData as any[]).forEach((row: any) => {
        const memberNumber = String(row['No. Anggota'] || '').trim();
        const existing = paymentsByMember.get(memberNumber) || [];
        existing.push({
          installmentNumber: Number(row['Angsuran Ke']) || 0,
          paidDate: String(row['Tanggal Bayar'] || ''),
          principalPaid: Number(row['Pokok Dibayar']) || 0,
          interestPaid: Number(row['Bunga Dibayar']) || 0,
          penaltyPaid: Number(row['Denda Dibayar']) || 0,
          status: (String(row['Status'] || 'paid').toLowerCase() as any),
        });
        paymentsByMember.set(memberNumber, existing);
      });

      const entries: LoanWithInstallmentMigrationEntry[] = (loanData as any[]).map((row: any, index: number) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        const memberNumber = String(row['No. Anggota'] || '').trim();
        const principalAmount = Number(row['Pokok Pinjaman']) || 0;
        const tenor = Number(row['Tenor (bulan)']) || 0;
        const interestRate = Number(row['Bunga (%/bulan)']) || 0;
        
        // Validate member
        const member = memberMap.get(memberNumber);
        if (!member) {
          errors.push('Anggota tidak ditemukan');
        } else if (usersWithActiveLoans.has(member.user_id)) {
          errors.push('Anggota sudah memiliki pinjaman aktif');
        }

        // Validate amounts
        if (principalAmount <= 0) errors.push('Pokok pinjaman harus lebih dari 0');
        if (tenor <= 0) errors.push('Tenor harus lebih dari 0');
        if (interestRate < 0) errors.push('Bunga tidak boleh negatif');

        // Get payments for this member
        const payments = paymentsByMember.get(memberNumber) || [];

        return {
          rowIndex: index + 2,
          memberNumber,
          memberName: member?.name,
          memberId: member?.user_id,
          principalAmount,
          tenor,
          interestRate,
          disbursementDate: String(row['Tanggal Pencairan'] || ''),
          notes: row['Catatan'] ? String(row['Catatan']) : undefined,
          installments: payments,
          isValid: errors.length === 0,
          validationErrors: errors,
          validationWarnings: warnings,
        };
      });

      return entries;
    } catch (error) {
      throw new Error('Gagal membaca file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, []);

  // Bulk import installment payments
  const bulkImportInstallments = useCallback(async (
    entries: InstallmentMigrationEntry[],
    journalMode: MigrationJournalMode,
    debitAccountId: string
  ): Promise<InstallmentMigrationResult> => {
    const result: InstallmentMigrationResult = {
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
      
      // Filter only valid entries with payments
      const validEntries = entries.filter(e => 
        e.isValid && 
        (e.status === 'paid' || e.status === 'partial') &&
        (e.principalPaid > 0 || e.interestPaid > 0)
      );

      if (validEntries.length === 0) {
        result.errors.push('Tidak ada data pembayaran valid untuk diimport');
        return result;
      }

      // Get account IDs for journaling
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('id, account_code, account_name, balance')
        .eq('is_active', true);

      const piutangAccount = accounts?.find(a => 
        a.account_name.toLowerCase().includes('piutang') && 
        a.account_name.toLowerCase().includes('pinjaman')
      );
      const bungaAccount = accounts?.find(a => 
        a.account_name.toLowerCase().includes('pendapatan') && 
        a.account_name.toLowerCase().includes('bunga')
      );
      const dendaAccount = accounts?.find(a => 
        a.account_name.toLowerCase().includes('pendapatan') && 
        a.account_name.toLowerCase().includes('denda')
      );
      const debitAccount = accounts?.find(a => a.id === debitAccountId);

      if (!piutangAccount || !bungaAccount || !debitAccount) {
        result.errors.push('Akun jurnal tidak lengkap. Pastikan akun Piutang Pinjaman, Pendapatan Bunga, dan akun debit tersedia.');
        return result;
      }

      // Process each entry
      for (const entry of validEntries) {
        try {
          // Find the installment
          const { data: installment } = await supabase
            .from('loan_installments')
            .select('id, status, paid_amount')
            .eq('loan_id', entry.loanId)
            .eq('installment_number', entry.installmentNumber)
            .single();

          if (!installment) {
            result.errors.push(`Baris ${entry.rowIndex}: Angsuran tidak ditemukan`);
            result.failCount++;
            continue;
          }

          const totalPaid = entry.principalPaid + entry.interestPaid + entry.penaltyPaid;

          // Update installment
          const { error: updateError } = await supabase
            .from('loan_installments')
            .update({
              status: entry.status,
              paid_amount: totalPaid,
              paid_date: entry.paidDate || format(new Date(), 'yyyy-MM-dd'),
              penalty_amount: entry.penaltyPaid,
            })
            .eq('id', installment.id);

          if (updateError) {
            result.errors.push(`Baris ${entry.rowIndex}: ${updateError.message}`);
            result.failCount++;
            continue;
          }

          // Update loan remaining principal
          if (entry.principalPaid > 0) {
            const { data: loan } = await supabase
              .from('loans')
              .select('remaining_principal')
              .eq('id', entry.loanId)
              .single();

            if (loan) {
              await supabase
                .from('loans')
                .update({ 
                  remaining_principal: Math.max(0, loan.remaining_principal - entry.principalPaid) 
                })
                .eq('id', entry.loanId);
            }
          }

          // Create journal entry (per transaction mode)
          if (journalMode === 'per_transaction') {
            const journalId = await createPaymentJournal(
              entry,
              debitAccount,
              piutangAccount,
              bungaAccount,
              dendaAccount,
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

      // Create batch journal (per batch mode)
      if (journalMode === 'per_batch' && result.successCount > 0) {
        const journalId = await createBatchPaymentJournal(
          validEntries.filter((_, i) => i < result.successCount),
          debitAccount,
          piutangAccount,
          bungaAccount,
          dendaAccount,
          userData?.user?.id
        );
        if (journalId) {
          result.journalEntryIds.push(journalId);
        }
      }

      // Save migration history
      await saveMigrationHistory({
        type: 'installment',
        totalRecords: validEntries.length,
        successCount: result.successCount,
        failCount: result.failCount,
        journalMode,
        journalCount: result.journalEntryIds.length,
        createdBy: userData?.user?.id,
      });

      result.success = result.successCount > 0;
      
      if (result.successCount > 0) {
        toast.success(`${result.successCount} angsuran berhasil diimport`);
      }
      if (result.failCount > 0) {
        toast.warning(`${result.failCount} angsuran gagal diimport`);
      }

      return result;
    } catch (error: any) {
      result.errors.push(error.message);
      toast.error('Gagal mengimport data angsuran');
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper: Create journal entry for single payment
  const createPaymentJournal = async (
    entry: InstallmentMigrationEntry,
    debitAccount: any,
    piutangAccount: any,
    bungaAccount: any,
    dendaAccount: any | undefined,
    createdBy?: string
  ): Promise<string | null> => {
    try {
      const entryDate = entry.paidDate || format(new Date(), 'yyyy-MM-dd');
      const totalAmount = entry.principalPaid + entry.interestPaid + entry.penaltyPaid;

      // Generate entry number
      const yearMonth = format(new Date(), 'yyyyMM');
      const { count } = await supabase
        .from('journal_entries')
        .select('*', { count: 'exact', head: true })
        .ilike('entry_number', `JMA-${yearMonth}%`);
      
      const sequence = (count || 0) + 1;
      const entryNumber = `JMA-${yearMonth}-${sequence.toString().padStart(4, '0')}`;

      // Create journal entry
      const { data: journal, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: entryDate,
          description: `Migrasi pembayaran angsuran ke-${entry.installmentNumber} - ${entry.memberName}`,
          total_debit: totalAmount,
          total_credit: totalAmount,
          is_balanced: true,
          status: 'approved',
          reference_type: 'installment_migration',
          reference_id: entry.loanId,
          created_by: createdBy,
          approved_by: createdBy,
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (journalError) throw journalError;

      // Create journal lines
      const lines = [
        {
          journal_entry_id: journal.id,
          account_id: debitAccount.id,
          debit_amount: totalAmount,
          credit_amount: 0,
          description: `D. ${debitAccount.account_name}`,
        }
      ];

      if (entry.principalPaid > 0) {
        lines.push({
          journal_entry_id: journal.id,
          account_id: piutangAccount.id,
          debit_amount: 0,
          credit_amount: entry.principalPaid,
          description: `K. Piutang Pinjaman - Pokok`,
        });
      }

      if (entry.interestPaid > 0) {
        lines.push({
          journal_entry_id: journal.id,
          account_id: bungaAccount.id,
          debit_amount: 0,
          credit_amount: entry.interestPaid,
          description: `K. Pendapatan Bunga`,
        });
      }

      if (entry.penaltyPaid > 0 && dendaAccount) {
        lines.push({
          journal_entry_id: journal.id,
          account_id: dendaAccount.id,
          debit_amount: 0,
          credit_amount: entry.penaltyPaid,
          description: `K. Pendapatan Denda`,
        });
      }

      await supabase.from('journal_entry_lines').insert(lines);

      // Update account balances
      await supabase
        .from('chart_of_accounts')
        .update({ balance: (debitAccount.balance || 0) + totalAmount })
        .eq('id', debitAccount.id);

      if (entry.principalPaid > 0) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (piutangAccount.balance || 0) - entry.principalPaid })
          .eq('id', piutangAccount.id);
      }

      if (entry.interestPaid > 0) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (bungaAccount.balance || 0) + entry.interestPaid })
          .eq('id', bungaAccount.id);
      }

      if (entry.penaltyPaid > 0 && dendaAccount) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (dendaAccount.balance || 0) + entry.penaltyPaid })
          .eq('id', dendaAccount.id);
      }

      return journal.id;
    } catch (error) {
      console.error('Error creating payment journal:', error);
      return null;
    }
  };

  // Helper: Create batch journal entry
  const createBatchPaymentJournal = async (
    entries: InstallmentMigrationEntry[],
    debitAccount: any,
    piutangAccount: any,
    bungaAccount: any,
    dendaAccount: any | undefined,
    createdBy?: string
  ): Promise<string | null> => {
    try {
      const totalPrincipal = entries.reduce((sum, e) => sum + e.principalPaid, 0);
      const totalInterest = entries.reduce((sum, e) => sum + e.interestPaid, 0);
      const totalPenalty = entries.reduce((sum, e) => sum + e.penaltyPaid, 0);
      const totalAmount = totalPrincipal + totalInterest + totalPenalty;

      const entryDate = format(new Date(), 'yyyy-MM-dd');
      
      // Generate entry number
      const yearMonth = format(new Date(), 'yyyyMM');
      const { count } = await supabase
        .from('journal_entries')
        .select('*', { count: 'exact', head: true })
        .ilike('entry_number', `JMB-${yearMonth}%`);
      
      const sequence = (count || 0) + 1;
      const entryNumber = `JMB-${yearMonth}-${sequence.toString().padStart(4, '0')}`;

      // Create journal entry
      const { data: journal, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: entryDate,
          description: `Migrasi batch pembayaran angsuran (${entries.length} transaksi)`,
          total_debit: totalAmount,
          total_credit: totalAmount,
          is_balanced: true,
          status: 'approved',
          reference_type: 'installment_migration_batch',
          created_by: createdBy,
          approved_by: createdBy,
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (journalError) throw journalError;

      // Create journal lines
      const lines = [
        {
          journal_entry_id: journal.id,
          account_id: debitAccount.id,
          debit_amount: totalAmount,
          credit_amount: 0,
          description: `D. ${debitAccount.account_name} - Batch migrasi`,
        }
      ];

      if (totalPrincipal > 0) {
        lines.push({
          journal_entry_id: journal.id,
          account_id: piutangAccount.id,
          debit_amount: 0,
          credit_amount: totalPrincipal,
          description: `K. Piutang Pinjaman - Pokok (${entries.length} angsuran)`,
        });
      }

      if (totalInterest > 0) {
        lines.push({
          journal_entry_id: journal.id,
          account_id: bungaAccount.id,
          debit_amount: 0,
          credit_amount: totalInterest,
          description: `K. Pendapatan Bunga (${entries.length} angsuran)`,
        });
      }

      if (totalPenalty > 0 && dendaAccount) {
        lines.push({
          journal_entry_id: journal.id,
          account_id: dendaAccount.id,
          debit_amount: 0,
          credit_amount: totalPenalty,
          description: `K. Pendapatan Denda`,
        });
      }

      await supabase.from('journal_entry_lines').insert(lines);

      // Update COA balances for batch
      await supabase
        .from('chart_of_accounts')
        .update({ balance: (debitAccount.balance || 0) + totalAmount })
        .eq('id', debitAccount.id);

      if (totalPrincipal > 0) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (piutangAccount.balance || 0) - totalPrincipal })
          .eq('id', piutangAccount.id);
      }

      if (totalInterest > 0) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (bungaAccount.balance || 0) + totalInterest })
          .eq('id', bungaAccount.id);
      }

      if (totalPenalty > 0 && dendaAccount) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (dendaAccount.balance || 0) + totalPenalty })
          .eq('id', dendaAccount.id);
      }

      return journal.id;
    } catch (error) {
      console.error('Error creating batch payment journal:', error);
      return null;
    }
  };

  // Bulk import new loans with installments
  const bulkImportLoansWithInstallments = useCallback(async (
    entries: LoanWithInstallmentMigrationEntry[],
    journalMode: MigrationJournalMode,
    debitAccountId: string
  ): Promise<InstallmentMigrationResult> => {
    const result: InstallmentMigrationResult = {
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
      
      // Filter only valid entries
      const validEntries = entries.filter(e => e.isValid);

      if (validEntries.length === 0) {
        result.errors.push('Tidak ada data pinjaman valid untuk diimport');
        return result;
      }

      // Get cooperative settings
      const { data: settingsData } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', ['interest_calculation_method', 'installment_due_day']);

      const settings = {
        calculationMethod: 'flat' as 'flat' | 'effective',
        installmentDueDay: 10,
      };
      
      (settingsData || []).forEach(s => {
        if (s.key === 'interest_calculation_method') settings.calculationMethod = s.value as any;
        if (s.key === 'installment_due_day') settings.installmentDueDay = Number(s.value) || 10;
      });

      for (const entry of validEntries) {
        try {
          if (!entry.memberId) {
            result.errors.push(`Baris ${entry.rowIndex}: Anggota tidak valid`);
            result.failCount++;
            continue;
          }

          // Calculate installment details
          const basePrincipal = Math.floor(entry.principalAmount / entry.tenor / 50000) * 50000;
          const remainder = entry.principalAmount - (basePrincipal * entry.tenor);
          const monthsWithExtra = Math.round(remainder / 50000);

          let remainingPrincipal = entry.principalAmount;
          let paidPrincipal = 0;

          // Calculate paid amounts from installments
          entry.installments.forEach(inst => {
            paidPrincipal += inst.principalPaid;
          });
          remainingPrincipal = entry.principalAmount - paidPrincipal;

          // Create loan
          const { data: newLoan, error: loanError } = await supabase
            .from('loans')
            .insert({
              user_id: entry.memberId,
              principal_amount: entry.principalAmount,
              tenor: entry.tenor,
              interest_rate: entry.interestRate,
              status: 'active',
              remaining_principal: remainingPrincipal,
              disbursement_date: entry.disbursementDate,
              application_date: entry.disbursementDate,
              approved_at: now,
              approved_by: userData?.user?.id,
            })
            .select()
            .single();

          if (loanError) {
            result.errors.push(`Baris ${entry.rowIndex}: ${loanError.message}`);
            result.failCount++;
            continue;
          }

          // Create installments
          const disbursementDate = new Date(entry.disbursementDate);
          const installments = [];
          let remainingCalc = entry.principalAmount;
          const interestRateDecimal = entry.interestRate / 100;

          // Create map of paid installments
          const paidInstallmentsMap = new Map(
            entry.installments.map(i => [i.installmentNumber, i])
          );

          for (let i = 1; i <= entry.tenor; i++) {
            const dueDate = addMonths(disbursementDate, i);
            const year = dueDate.getFullYear();
            const month = dueDate.getMonth();
            const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
            const actualDueDay = Math.min(settings.installmentDueDay, lastDayOfMonth);
            const finalDueDate = new Date(year, month, actualDueDay);
            
            const principalThisMonth = i <= monthsWithExtra ? basePrincipal + 50000 : basePrincipal;
            
            let interestAmount: number;
            if (settings.calculationMethod === 'effective') {
              interestAmount = remainingCalc * interestRateDecimal;
            } else {
              interestAmount = entry.principalAmount * interestRateDecimal;
            }

            const payment = paidInstallmentsMap.get(i);
            const isPaid = !!payment;
            
            installments.push({
              loan_id: newLoan.id,
              installment_number: i,
              principal_amount: principalThisMonth,
              interest_amount: interestAmount,
              total_amount: principalThisMonth + interestAmount,
              due_date: format(finalDueDate, 'yyyy-MM-dd'),
              status: isPaid ? payment.status : 'pending',
              paid_amount: isPaid ? (payment.principalPaid + payment.interestPaid + payment.penaltyPaid) : 0,
              paid_date: isPaid ? payment.paidDate : null,
              penalty_amount: isPaid ? payment.penaltyPaid : 0,
            });
            
            remainingCalc -= principalThisMonth;
          }

          await supabase.from('loan_installments').insert(installments);

          result.successCount++;
        } catch (err: any) {
          result.errors.push(`Baris ${entry.rowIndex}: ${err.message}`);
          result.failCount++;
        }
      }

      // Save migration history (userData already declared above)
      await saveMigrationHistory({
        type: 'loan_with_installment',
        totalRecords: validEntries.length,
        successCount: result.successCount,
        failCount: result.failCount,
        journalMode,
        journalCount: result.journalEntryIds.length,
        createdBy: userData?.user?.id,
      });

      result.success = result.successCount > 0;
      
      if (result.successCount > 0) {
        toast.success(`${result.successCount} pinjaman berhasil diimport`);
      }
      if (result.failCount > 0) {
        toast.warning(`${result.failCount} pinjaman gagal diimport`);
      }

      return result;
    } catch (error: any) {
      result.errors.push(error.message);
      toast.error('Gagal mengimport data pinjaman');
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    activeLoans,
    migrationHistory,
    fetchActiveLoans,
    fetchMigrationHistory,
    downloadInstallmentTemplate,
    downloadLoanWithInstallmentTemplate,
    parseInstallmentExcel,
    parseLoanWithInstallmentExcel,
    bulkImportInstallments,
    bulkImportLoansWithInstallments,
  };
};