import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SHUDistributionResult } from '@/lib/cooperativeSettings';
import { toast } from 'sonner';

// Standard account codes for SHU journal entries (Standar Akuntansi Koperasi)
// Debit: SHU Tahun Berjalan (Equity) -> Kredit: Dana-dana dan Hutang ke Anggota/Pengurus
const SHU_ACCOUNT_CODES = {
  // Source account (will be debited)
  SHU_TAHUN_BERJALAN: '3-3010', // SHU Tahun Berjalan (Equity)
  
  // Destination accounts (will be credited)
  DANA_CADANGAN: '3-2010', // Dana Cadangan (Equity)
  DANA_PENDIDIKAN: '3-2020', // Dana Pendidikan (Equity)
  DANA_SOSIAL: '3-2030', // Dana Sosial (Equity)
  DANA_PEMBANGUNAN: '3-2040', // Dana Pembangunan (Equity)
  HUTANG_SHU_ANGGOTA: '2-3010', // Hutang SHU Anggota (Liability)
  HUTANG_SHU_PENGURUS: '2-3020', // Hutang SHU Pengurus (Liability)
  HUTANG_SHU_PENGAWAS: '2-3030', // Hutang SHU Pengawas (Liability)
  HUTANG_SHU_PENASIHAT: '2-3040', // Hutang SHU Penasihat (Liability)
};

// Fallback account codes if standard codes don't exist
const FALLBACK_ACCOUNT_CODES = {
  SHU_TAHUN_BERJALAN: ['3.3.01', '3301', '33010', 'SHU Tahun Berjalan'],
  DANA_CADANGAN: ['3.2.01', '3201', '32010', 'Dana Cadangan'],
  DANA_PENDIDIKAN: ['3.2.02', '3202', '32020', 'Dana Pendidikan'],
  DANA_SOSIAL: ['3.2.03', '3203', '32030', 'Dana Sosial'],
  DANA_PEMBANGUNAN: ['3.2.04', '3204', '32040', 'Dana Pembangunan'],
  HUTANG_SHU_ANGGOTA: ['2.3.01', '2301', '23010', 'Hutang SHU'],
  HUTANG_SHU_PENGURUS: ['2.3.02', '2302', '23020', 'Hutang SHU Pengurus'],
  HUTANG_SHU_PENGAWAS: ['2.3.03', '2303', '23030', 'Hutang SHU Pengawas'],
  HUTANG_SHU_PENASIHAT: ['2.3.04', '2304', '23040', 'Hutang SHU Penasihat'],
};

export interface SHUJournalResult {
  success: boolean;
  journalId?: string;
  journalNumber?: string;
  error?: string;
  missingAccounts?: string[];
}

export const useSHUJournalEntry = () => {
  /**
   * Find account by code or name pattern
   */
  const findAccount = useCallback(async (
    primaryCode: string, 
    fallbackCodes: string[]
  ): Promise<{ id: string; code: string; name: string } | null> => {
    // Try primary code first
    const { data: primaryAccount } = await supabase
      .from('chart_of_accounts')
      .select('id, account_code, account_name')
      .eq('account_code', primaryCode)
      .eq('is_active', true)
      .maybeSingle();
    
    if (primaryAccount) {
      return {
        id: primaryAccount.id,
        code: primaryAccount.account_code,
        name: primaryAccount.account_name,
      };
    }
    
    // Try fallback codes
    for (const code of fallbackCodes) {
      const { data: fallbackAccount } = await supabase
        .from('chart_of_accounts')
        .select('id, account_code, account_name')
        .or(`account_code.eq.${code},account_name.ilike.%${code}%`)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      
      if (fallbackAccount) {
        return {
          id: fallbackAccount.id,
          code: fallbackAccount.account_code,
          name: fallbackAccount.account_name,
        };
      }
    }
    
    return null;
  }, []);

  /**
   * Get all required accounts for SHU journal
   */
  const getRequiredAccounts = useCallback(async (distribution: SHUDistributionResult) => {
    const accounts: Record<string, { id: string; code: string; name: string } | null> = {};
    const missingAccounts: string[] = [];
    
    // SHU Tahun Berjalan (always required)
    accounts.shuTahunBerjalan = await findAccount(
      SHU_ACCOUNT_CODES.SHU_TAHUN_BERJALAN,
      FALLBACK_ACCOUNT_CODES.SHU_TAHUN_BERJALAN
    );
    if (!accounts.shuTahunBerjalan) missingAccounts.push('SHU Tahun Berjalan');
    
    // Dana Cadangan (if > 0)
    if (distribution.danaCadangan > 0) {
      accounts.danaCadangan = await findAccount(
        SHU_ACCOUNT_CODES.DANA_CADANGAN,
        FALLBACK_ACCOUNT_CODES.DANA_CADANGAN
      );
      if (!accounts.danaCadangan) missingAccounts.push('Dana Cadangan');
    }
    
    // Dana Pendidikan (if > 0)
    if ((distribution as any).danaPendidikan > 0) {
      accounts.danaPendidikan = await findAccount(
        SHU_ACCOUNT_CODES.DANA_PENDIDIKAN,
        FALLBACK_ACCOUNT_CODES.DANA_PENDIDIKAN
      );
      if (!accounts.danaPendidikan) missingAccounts.push('Dana Pendidikan');
    }
    
    // Dana Sosial (if > 0)
    if ((distribution as any).danaSosial > 0) {
      accounts.danaSosial = await findAccount(
        SHU_ACCOUNT_CODES.DANA_SOSIAL,
        FALLBACK_ACCOUNT_CODES.DANA_SOSIAL
      );
      if (!accounts.danaSosial) missingAccounts.push('Dana Sosial');
    }
    
    // Dana Pembangunan (if > 0)
    if ((distribution as any).danaPembangunan > 0) {
      accounts.danaPembangunan = await findAccount(
        SHU_ACCOUNT_CODES.DANA_PEMBANGUNAN,
        FALLBACK_ACCOUNT_CODES.DANA_PEMBANGUNAN
      );
      if (!accounts.danaPembangunan) missingAccounts.push('Dana Pembangunan');
    }
    
    // Hutang SHU Anggota (if member distributions > 0)
    if (distribution.shuAnggotaTotal > 0) {
      accounts.hutangShuAnggota = await findAccount(
        SHU_ACCOUNT_CODES.HUTANG_SHU_ANGGOTA,
        FALLBACK_ACCOUNT_CODES.HUTANG_SHU_ANGGOTA
      );
      if (!accounts.hutangShuAnggota) missingAccounts.push('Hutang SHU Anggota');
    }
    
    // Hutang SHU Pengurus (if > 0)
    if (distribution.shuPengurus > 0) {
      accounts.hutangShuPengurus = await findAccount(
        SHU_ACCOUNT_CODES.HUTANG_SHU_PENGURUS,
        FALLBACK_ACCOUNT_CODES.HUTANG_SHU_PENGURUS
      );
      if (!accounts.hutangShuPengurus) missingAccounts.push('Hutang SHU Pengurus');
    }
    
    // Hutang SHU Pengawas (if > 0)
    if (distribution.shuPengawas > 0) {
      accounts.hutangShuPengawas = await findAccount(
        SHU_ACCOUNT_CODES.HUTANG_SHU_PENGAWAS,
        FALLBACK_ACCOUNT_CODES.HUTANG_SHU_PENGAWAS
      );
      if (!accounts.hutangShuPengawas) missingAccounts.push('Hutang SHU Pengawas');
    }
    
    // Hutang SHU Penasihat (if > 0)
    if (distribution.shuPenasihat > 0) {
      accounts.hutangShuPenasihat = await findAccount(
        SHU_ACCOUNT_CODES.HUTANG_SHU_PENASIHAT,
        FALLBACK_ACCOUNT_CODES.HUTANG_SHU_PENASIHAT
      );
      if (!accounts.hutangShuPenasihat) missingAccounts.push('Hutang SHU Penasihat');
    }
    
    return { accounts, missingAccounts };
  }, [findAccount]);

  /**
   * Create journal entry for SHU distribution
   * 
   * Journal Entry:
   * D: SHU Tahun Berjalan (total SHU Bruto)
   * K: Dana Cadangan
   * K: Dana Pendidikan
   * K: Dana Sosial
   * K: Dana Pembangunan
   * K: Hutang SHU Anggota
   * K: Hutang SHU Pengurus
   * K: Hutang SHU Pengawas
   * K: Hutang SHU Penasihat
   */
  const createSHUJournalEntry = useCallback(async (
    distribution: SHUDistributionResult
  ): Promise<SHUJournalResult> => {
    try {
      // Get required accounts
      const { accounts, missingAccounts } = await getRequiredAccounts(distribution);
      
      if (missingAccounts.length > 0) {
        console.warn('Missing accounts for SHU journal:', missingAccounts);
        return {
          success: false,
          error: `Akun berikut belum tersedia: ${missingAccounts.join(', ')}`,
          missingAccounts,
        };
      }
      
      // Generate entry number
      const { data: entryNumber, error: entryNumberError } = await supabase
        .rpc('generate_journal_entry_number');
      
      if (entryNumberError || !entryNumber) {
        throw new Error('Failed to generate journal entry number');
      }
      
      // Prepare journal lines
      const journalLines: {
        account_id: string;
        debit_amount: number;
        credit_amount: number;
        description: string;
      }[] = [];
      
      // Debit: SHU Tahun Berjalan (total amount)
      if (accounts.shuTahunBerjalan) {
        journalLines.push({
          account_id: accounts.shuTahunBerjalan.id,
          debit_amount: distribution.shuBruto,
          credit_amount: 0,
          description: `Distribusi SHU Tahun ${distribution.year}`,
        });
      }
      
      // Credit lines
      // Dana Cadangan
      if (accounts.danaCadangan && distribution.danaCadangan > 0) {
        journalLines.push({
          account_id: accounts.danaCadangan.id,
          debit_amount: 0,
          credit_amount: distribution.danaCadangan,
          description: `Alokasi Dana Cadangan ${distribution.year}`,
        });
      }
      
      // Dana Pendidikan
      const danaPendidikan = (distribution as any).danaPendidikan || 0;
      if (accounts.danaPendidikan && danaPendidikan > 0) {
        journalLines.push({
          account_id: accounts.danaPendidikan.id,
          debit_amount: 0,
          credit_amount: danaPendidikan,
          description: `Alokasi Dana Pendidikan ${distribution.year}`,
        });
      }
      
      // Dana Sosial
      const danaSosial = (distribution as any).danaSosial || 0;
      if (accounts.danaSosial && danaSosial > 0) {
        journalLines.push({
          account_id: accounts.danaSosial.id,
          debit_amount: 0,
          credit_amount: danaSosial,
          description: `Alokasi Dana Sosial ${distribution.year}`,
        });
      }
      
      // Dana Pembangunan
      const danaPembangunan = (distribution as any).danaPembangunan || 0;
      if (accounts.danaPembangunan && danaPembangunan > 0) {
        journalLines.push({
          account_id: accounts.danaPembangunan.id,
          debit_amount: 0,
          credit_amount: danaPembangunan,
          description: `Alokasi Dana Pembangunan ${distribution.year}`,
        });
      }
      
      // Hutang SHU Anggota
      if (accounts.hutangShuAnggota && distribution.shuAnggotaTotal > 0) {
        journalLines.push({
          account_id: accounts.hutangShuAnggota.id,
          debit_amount: 0,
          credit_amount: distribution.shuAnggotaTotal,
          description: `SHU untuk ${distribution.memberDistributions.length} anggota ${distribution.year}`,
        });
      }
      
      // Hutang SHU Pengurus
      if (accounts.hutangShuPengurus && distribution.shuPengurus > 0) {
        journalLines.push({
          account_id: accounts.hutangShuPengurus.id,
          debit_amount: 0,
          credit_amount: distribution.shuPengurus,
          description: `SHU Pengurus ${distribution.year}`,
        });
      }
      
      // Hutang SHU Pengawas
      if (accounts.hutangShuPengawas && distribution.shuPengawas > 0) {
        journalLines.push({
          account_id: accounts.hutangShuPengawas.id,
          debit_amount: 0,
          credit_amount: distribution.shuPengawas,
          description: `SHU Pengawas ${distribution.year}`,
        });
      }
      
      // Hutang SHU Penasihat
      if (accounts.hutangShuPenasihat && distribution.shuPenasihat > 0) {
        journalLines.push({
          account_id: accounts.hutangShuPenasihat.id,
          debit_amount: 0,
          credit_amount: distribution.shuPenasihat,
          description: `SHU Penasihat ${distribution.year}`,
        });
      }
      
      // Validate balance (debit = credit)
      const totalDebit = journalLines.reduce((sum, l) => sum + l.debit_amount, 0);
      const totalCredit = journalLines.reduce((sum, l) => sum + l.credit_amount, 0);
      
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Journal not balanced: Debit ${totalDebit} != Credit ${totalCredit}`);
      }
      
      // Create journal entry
      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: new Date().toISOString().split('T')[0],
          description: `Distribusi SHU Tahun Buku ${distribution.year}`,
          status: 'approved',
          total_debit: totalDebit,
          total_credit: totalCredit,
          is_balanced: true,
          reference_type: 'shu_distribution',
          reference_id: null, // Will be updated with distribution ID if needed
        })
        .select('id, entry_number')
        .single();
      
      if (journalError || !journalEntry) {
        throw new Error(journalError?.message || 'Failed to create journal entry');
      }
      
      // Create journal entry lines
      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(journalLines.map(line => ({
          journal_entry_id: journalEntry.id,
          account_id: line.account_id,
          debit_amount: line.debit_amount,
          credit_amount: line.credit_amount,
          description: line.description,
        })));
      
      if (linesError) {
        // Rollback: delete journal entry
        await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
        throw new Error(linesError.message || 'Failed to create journal lines');
      }
      
      // Update account balances
      for (const line of journalLines) {
        const { data: account } = await supabase
          .from('chart_of_accounts')
          .select('balance, account_type')
          .eq('id', line.account_id)
          .single();
        
        if (account) {
          let newBalance = account.balance || 0;
          
          // Asset & Expense: Debit increases, Credit decreases
          // Liability, Equity & Income: Credit increases, Debit decreases
          if (['asset', 'expense'].includes(account.account_type)) {
            newBalance += line.debit_amount - line.credit_amount;
          } else {
            newBalance += line.credit_amount - line.debit_amount;
          }
          
          await supabase
            .from('chart_of_accounts')
            .update({ balance: newBalance })
            .eq('id', line.account_id);
        }
      }
      
      // Create audit log
      await supabase.from('journal_audit_logs').insert({
        journal_entry_id: journalEntry.id,
        action: 'create',
        change_summary: `Jurnal distribusi SHU tahun ${distribution.year} dibuat otomatis`,
        new_data: { 
          distribution_year: distribution.year,
          shu_bruto: distribution.shuBruto,
          lines: journalLines.length,
        },
      });
      
      console.log('SHU journal entry created:', journalEntry.entry_number);
      
      return {
        success: true,
        journalId: journalEntry.id,
        journalNumber: journalEntry.entry_number,
      };
      
    } catch (error) {
      console.error('Error creating SHU journal entry:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [getRequiredAccounts]);

  /**
   * Check if all required accounts exist for SHU journal
   */
  const validateAccountsExist = useCallback(async (
    distribution: SHUDistributionResult
  ): Promise<{ valid: boolean; missingAccounts: string[] }> => {
    const { missingAccounts } = await getRequiredAccounts(distribution);
    return {
      valid: missingAccounts.length === 0,
      missingAccounts,
    };
  }, [getRequiredAccounts]);

  return {
    createSHUJournalEntry,
    validateAccountsExist,
    SHU_ACCOUNT_CODES,
  };
};
