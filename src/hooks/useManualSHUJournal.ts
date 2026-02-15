import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Account codes for manual SHU payment journal
const MANUAL_SHU_ACCOUNT_CODES = {
  // Debit: Hutang SHU Anggota (reduce liability)
  HUTANG_SHU_ANGGOTA: '2-3010',
  // Credit: Kas or Bank (reduce asset)
  KAS: '1-1010',
  BANK: '1-1020',
};

// Fallback codes
const FALLBACK_CODES = {
  HUTANG_SHU_ANGGOTA: ['2.3.01', '2301', '23010', 'Hutang SHU'],
  KAS: ['1.1.01', '1101', '11010', 'Kas'],
  BANK: ['1.1.02', '1102', '11020', 'Bank'],
};

export interface ManualSHUJournalResult {
  success: boolean;
  journalId?: string;
  journalNumber?: string;
  error?: string;
}

export const useManualSHUJournal = () => {
  /**
   * Find account by code or fallback patterns
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
   * Create journal entry for manual SHU payment to individual member
   * 
   * Journal Entry:
   * D: Hutang SHU Anggota (2-3010) - reduce liability
   * K: Kas/Bank (1-1010/1-1020) - reduce asset
   * 
   * This records the payment of SHU debt to a member
   */
  const createManualSHUJournal = useCallback(async (
    memberId: string,
    memberName: string,
    year: number,
    amount: number,
    paymentMethod: 'cash' | 'bank' = 'bank'
  ): Promise<ManualSHUJournalResult> => {
    try {
      // Find required accounts
      const hutangShuAccount = await findAccount(
        MANUAL_SHU_ACCOUNT_CODES.HUTANG_SHU_ANGGOTA,
        FALLBACK_CODES.HUTANG_SHU_ANGGOTA
      );

      const paymentAccountCode = paymentMethod === 'cash' 
        ? MANUAL_SHU_ACCOUNT_CODES.KAS 
        : MANUAL_SHU_ACCOUNT_CODES.BANK;
      const paymentFallback = paymentMethod === 'cash' 
        ? FALLBACK_CODES.KAS 
        : FALLBACK_CODES.BANK;
      
      const paymentAccount = await findAccount(paymentAccountCode, paymentFallback);

      // Validate accounts exist
      const missingAccounts: string[] = [];
      if (!hutangShuAccount) missingAccounts.push('Hutang SHU Anggota');
      if (!paymentAccount) missingAccounts.push(paymentMethod === 'cash' ? 'Kas' : 'Bank');

      if (missingAccounts.length > 0) {
        console.warn('Missing accounts for manual SHU journal:', missingAccounts);
        return {
          success: false,
          error: `Akun berikut belum tersedia: ${missingAccounts.join(', ')}`,
        };
      }

      // Generate entry number
      const { data: entryNumber, error: entryNumberError } = await supabase
        .rpc('generate_journal_entry_number');

      if (entryNumberError || !entryNumber) {
        throw new Error('Failed to generate journal entry number');
      }

      const description = `Pembayaran SHU Manual - ${memberName} Tahun ${year}`;

      // Create journal entry
      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: new Date().toISOString().split('T')[0],
          description,
          status: 'approved',
          total_debit: amount,
          total_credit: amount,
          is_balanced: true,
          reference_type: 'manual_shu_payment',
        })
        .select('id, entry_number')
        .single();

      if (journalError || !journalEntry) {
        throw new Error(journalError?.message || 'Failed to create journal entry');
      }

      // Create journal lines
      const journalLines = [
        {
          journal_entry_id: journalEntry.id,
          account_id: hutangShuAccount!.id,
          debit_amount: amount,
          credit_amount: 0,
          description: `Pembayaran SHU ke ${memberName} tahun ${year}`,
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: paymentAccount!.id,
          debit_amount: 0,
          credit_amount: amount,
          description: `Keluar ${paymentMethod === 'cash' ? 'kas' : 'bank'} untuk SHU ${memberName}`,
        },
      ];

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(journalLines);

      if (linesError) {
        // Rollback: delete journal entry
        await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
        throw new Error(linesError.message || 'Failed to create journal lines');
      }

      // Update account balances
      // Hutang SHU (Liability): Debit decreases balance
      const { data: hutangAccount } = await supabase
        .from('chart_of_accounts')
        .select('balance')
        .eq('id', hutangShuAccount!.id)
        .single();

      if (hutangAccount) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (hutangAccount.balance || 0) - amount })
          .eq('id', hutangShuAccount!.id);
      }

      // Kas/Bank (Asset): Credit decreases balance
      const { data: kasAccount } = await supabase
        .from('chart_of_accounts')
        .select('balance')
        .eq('id', paymentAccount!.id)
        .single();

      if (kasAccount) {
        await supabase
          .from('chart_of_accounts')
          .update({ balance: (kasAccount.balance || 0) - amount })
          .eq('id', paymentAccount!.id);
      }

      // Create audit log
      await supabase.from('journal_audit_logs').insert({
        journal_entry_id: journalEntry.id,
        action: 'create',
        change_summary: `Jurnal pembayaran SHU manual untuk ${memberName} tahun ${year}`,
        new_data: {
          member_id: memberId,
          member_name: memberName,
          year,
          amount,
          payment_method: paymentMethod,
        },
      });

      console.log('Manual SHU journal entry created:', journalEntry.entry_number);

      return {
        success: true,
        journalId: journalEntry.id,
        journalNumber: journalEntry.entry_number,
      };

    } catch (error) {
      console.error('Error creating manual SHU journal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [findAccount]);

  return {
    createManualSHUJournal,
    MANUAL_SHU_ACCOUNT_CODES,
  };
};
