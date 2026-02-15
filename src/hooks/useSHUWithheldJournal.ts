import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Account codes for SHU Withheld journal entries (matching standard COA)
export const WITHHELD_SHU_ACCOUNT_CODES = {
  // When SHU is withheld (move from regular SHU liability to withheld)
  SHU_TAHUN_BERJALAN: '3-3000', // SHU Tahun Berjalan
  HUTANG_SHU_DITAHAN: '2-3050', // Hutang SHU Ditahan
  CADANGAN_SHU_DITAHAN: '3-2050', // Cadangan SHU Ditahan
  
  // When SHU is used for arrears payment
  PIUTANG_ANGGOTA: '1-2000', // Piutang Pinjaman Anggota
  
  // When SHU is released to member
  KAS: '1-1000', // Kas
  BANK: '1-1100', // Bank
};

const FALLBACK_CODES = {
  SHU_TAHUN_BERJALAN: ['3.3.00', '3300', 'SHU Tahun Berjalan', 'SHU'],
  HUTANG_SHU_DITAHAN: ['2.3.05', '2305', 'Hutang SHU Ditahan'],
  CADANGAN_SHU_DITAHAN: ['3.2.05', '3205', 'Cadangan SHU Ditahan'],
  PIUTANG_ANGGOTA: ['1.2.00', '1200', 'Piutang Pinjaman', 'Piutang'],
  KAS: ['1.1.00', '1100', 'Kas'],
  BANK: ['1.1.10', '1110', 'Bank'],
};

export interface WithheldJournalResult {
  success: boolean;
  journalId?: string;
  journalNumber?: string;
  error?: string;
  missingAccounts?: string[];
}

export const useSHUWithheldJournal = () => {
  /**
   * Find account by code with fallbacks
   */
  const findAccount = useCallback(async (
    primaryCode: string,
    fallbackCodes: string[]
  ): Promise<{ id: string; code: string; name: string } | null> => {
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
   * Ensure required accounts exist, create if missing
   */
  const ensureAccountsExist = useCallback(async () => {
    const accountsToCreate = [
      {
        code: WITHHELD_SHU_ACCOUNT_CODES.HUTANG_SHU_DITAHAN,
        name: 'Hutang SHU Ditahan',
        type: 'liability' as const,
        description: 'Kewajiban SHU anggota yang ditahan karena tunggakan atau keputusan pengurus',
      },
      {
        code: WITHHELD_SHU_ACCOUNT_CODES.CADANGAN_SHU_DITAHAN,
        name: 'Cadangan SHU Ditahan',
        type: 'equity' as const,
        description: 'Cadangan dana dari SHU yang ditahan untuk pelunasan tunggakan anggota',
      },
    ];

    for (const account of accountsToCreate) {
      const existing = await findAccount(account.code, []);
      if (!existing) {
        const { error } = await supabase
          .from('chart_of_accounts')
          .insert({
            account_code: account.code,
            account_name: account.name,
            account_type: account.type,
            description: account.description,
            is_active: true,
            is_system: true,
            balance: 0,
          });

        if (error) {
          console.error(`Error creating account ${account.code}:`, error);
        } else {
          console.log(`Created account: ${account.code} - ${account.name}`);
        }
      }
    }
  }, [findAccount]);

  /**
   * Create journal for SHU withholding (saat penahanan)
   * D: Hutang SHU Anggota (mengurangi hutang normal)
   * K: Hutang SHU Ditahan (menambah hutang ditahan)
   */
  const createWithholdingJournal = useCallback(async (
    year: number,
    totalWithheldAmount: number,
    withheldMembersCount: number
  ): Promise<WithheldJournalResult> => {
    if (totalWithheldAmount <= 0) {
      return { success: true };
    }

    try {
      await ensureAccountsExist();

      const shuTahunBerjalan = await findAccount(
        WITHHELD_SHU_ACCOUNT_CODES.SHU_TAHUN_BERJALAN,
        FALLBACK_CODES.SHU_TAHUN_BERJALAN
      );
      const hutangDitahan = await findAccount(
        WITHHELD_SHU_ACCOUNT_CODES.HUTANG_SHU_DITAHAN,
        FALLBACK_CODES.HUTANG_SHU_DITAHAN
      );

      const missingAccounts: string[] = [];
      if (!shuTahunBerjalan) missingAccounts.push('SHU Tahun Berjalan');
      if (!hutangDitahan) missingAccounts.push('Hutang SHU Ditahan');

      if (missingAccounts.length > 0) {
        return { success: false, error: `Akun belum tersedia: ${missingAccounts.join(', ')}`, missingAccounts };
      }

      // Generate entry number
      const { data: entryNumber, error: numError } = await supabase.rpc('generate_journal_entry_number');
      if (numError || !entryNumber) throw new Error('Gagal generate nomor jurnal');

      // Create journal entry
      const { data: journal, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: new Date().toISOString().split('T')[0],
          description: `Penahanan SHU ${withheldMembersCount} anggota tahun ${year} karena tunggakan/keputusan pengurus`,
          status: 'approved',
          total_debit: totalWithheldAmount,
          total_credit: totalWithheldAmount,
          is_balanced: true,
          reference_type: 'shu_withheld',
        })
        .select('id, entry_number')
        .single();

      if (journalError || !journal) throw new Error(journalError?.message || 'Gagal membuat jurnal');

      // Create journal lines
      const lines = [
        {
          journal_entry_id: journal.id,
          account_id: shuTahunBerjalan!.id,
          debit_amount: totalWithheldAmount,
          credit_amount: 0,
          description: `Pengurangan SHU Tahun Berjalan - ${withheldMembersCount} anggota ditahan`,
        },
        {
          journal_entry_id: journal.id,
          account_id: hutangDitahan!.id,
          debit_amount: 0,
          credit_amount: totalWithheldAmount,
          description: `Penambahan Hutang SHU Ditahan - ${withheldMembersCount} anggota`,
        },
      ];

      const { error: linesError } = await supabase.from('journal_entry_lines').insert(lines);
      if (linesError) {
        await supabase.from('journal_entries').delete().eq('id', journal.id);
        throw new Error(linesError.message);
      }

      // Update account balances
      // SHU Tahun Berjalan (equity): debit decreases balance
      const { data: shuAccount } = await supabase.from('chart_of_accounts').select('balance').eq('id', shuTahunBerjalan!.id).single();
      const { data: ditahanAccount } = await supabase.from('chart_of_accounts').select('balance').eq('id', hutangDitahan!.id).single();

      if (shuAccount) {
        await supabase.from('chart_of_accounts').update({ balance: (shuAccount.balance || 0) - totalWithheldAmount }).eq('id', shuTahunBerjalan!.id);
      }
      if (ditahanAccount) {
        await supabase.from('chart_of_accounts').update({ balance: (ditahanAccount.balance || 0) + totalWithheldAmount }).eq('id', hutangDitahan!.id);
      }

      // Create audit log
      await supabase.from('journal_audit_logs').insert({
        journal_entry_id: journal.id,
        action: 'create',
        change_summary: `Jurnal penahanan SHU ${year} - ${withheldMembersCount} anggota`,
        new_data: { year, amount: totalWithheldAmount, members_count: withheldMembersCount },
      });

      return { success: true, journalId: journal.id, journalNumber: journal.entry_number };
    } catch (error) {
      console.error('Error creating withholding journal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [findAccount, ensureAccountsExist]);

  /**
   * Create journal for SHU used for arrears (saat SHU digunakan untuk lunasi tunggakan)
   * D: Hutang SHU Ditahan (mengurangi hutang ditahan)
   * K: Piutang Anggota (mengurangi piutang/tunggakan)
   */
  const createArrearsPaymentJournal = useCallback(async (
    userId: string,
    memberName: string,
    year: number,
    amountUsed: number
  ): Promise<WithheldJournalResult> => {
    if (amountUsed <= 0) {
      return { success: true };
    }

    try {
      const hutangDitahan = await findAccount(
        WITHHELD_SHU_ACCOUNT_CODES.HUTANG_SHU_DITAHAN,
        FALLBACK_CODES.HUTANG_SHU_DITAHAN
      );
      const piutang = await findAccount(
        WITHHELD_SHU_ACCOUNT_CODES.PIUTANG_ANGGOTA,
        FALLBACK_CODES.PIUTANG_ANGGOTA
      );

      const missingAccounts: string[] = [];
      if (!hutangDitahan) missingAccounts.push('Hutang SHU Ditahan');
      if (!piutang) missingAccounts.push('Piutang Anggota');

      if (missingAccounts.length > 0) {
        console.warn('Missing accounts for arrears payment journal:', missingAccounts);
        return { success: false, error: `Akun belum tersedia: ${missingAccounts.join(', ')}`, missingAccounts };
      }

      const { data: entryNumber } = await supabase.rpc('generate_journal_entry_number');
      if (!entryNumber) throw new Error('Gagal generate nomor jurnal');

      const { data: journal, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: new Date().toISOString().split('T')[0],
          description: `Penggunaan SHU Ditahan ${memberName} tahun ${year} untuk pelunasan tunggakan`,
          status: 'approved',
          total_debit: amountUsed,
          total_credit: amountUsed,
          is_balanced: true,
          reference_type: 'shu_arrears_payment',
        })
        .select('id, entry_number')
        .single();

      if (journalError || !journal) throw new Error(journalError?.message);

      const lines = [
        {
          journal_entry_id: journal.id,
          account_id: hutangDitahan!.id,
          debit_amount: amountUsed,
          credit_amount: 0,
          description: `Penggunaan SHU Ditahan ${memberName} untuk tunggakan`,
        },
        {
          journal_entry_id: journal.id,
          account_id: piutang!.id,
          debit_amount: 0,
          credit_amount: amountUsed,
          description: `Pelunasan tunggakan ${memberName} dari SHU`,
        },
      ];

      await supabase.from('journal_entry_lines').insert(lines);

      // Update balances
      const { data: ditahanBal } = await supabase.from('chart_of_accounts').select('balance').eq('id', hutangDitahan!.id).single();
      const { data: piutangBal } = await supabase.from('chart_of_accounts').select('balance').eq('id', piutang!.id).single();

      if (ditahanBal) {
        await supabase.from('chart_of_accounts').update({ balance: (ditahanBal.balance || 0) - amountUsed }).eq('id', hutangDitahan!.id);
      }
      if (piutangBal) {
        await supabase.from('chart_of_accounts').update({ balance: (piutangBal.balance || 0) - amountUsed }).eq('id', piutang!.id);
      }

      await supabase.from('journal_audit_logs').insert({
        journal_entry_id: journal.id,
        action: 'create',
        change_summary: `Penggunaan SHU ditahan untuk tunggakan - ${memberName}`,
        new_data: { user_id: userId, year, amount: amountUsed },
      });

      return { success: true, journalId: journal.id, journalNumber: journal.entry_number };
    } catch (error) {
      console.error('Error creating arrears payment journal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [findAccount]);

  /**
   * Create journal for SHU release (saat SHU dirilis ke anggota)
   * D: Hutang SHU Ditahan (mengurangi hutang)
   * K: Kas/Bank (pengeluaran kas)
   */
  const createReleaseJournal = useCallback(async (
    userId: string,
    memberName: string,
    year: number,
    releasedAmount: number,
    paymentMethod: 'cash' | 'bank' = 'bank'
  ): Promise<WithheldJournalResult> => {
    if (releasedAmount <= 0) {
      return { success: true };
    }

    try {
      const hutangDitahan = await findAccount(
        WITHHELD_SHU_ACCOUNT_CODES.HUTANG_SHU_DITAHAN,
        FALLBACK_CODES.HUTANG_SHU_DITAHAN
      );
      const kasBank = await findAccount(
        paymentMethod === 'cash' ? WITHHELD_SHU_ACCOUNT_CODES.KAS : WITHHELD_SHU_ACCOUNT_CODES.BANK,
        paymentMethod === 'cash' ? FALLBACK_CODES.KAS : FALLBACK_CODES.BANK
      );

      const missingAccounts: string[] = [];
      if (!hutangDitahan) missingAccounts.push('Hutang SHU Ditahan');
      if (!kasBank) missingAccounts.push(paymentMethod === 'cash' ? 'Kas' : 'Bank');

      if (missingAccounts.length > 0) {
        console.warn('Missing accounts for release journal:', missingAccounts);
        return { success: false, error: `Akun belum tersedia: ${missingAccounts.join(', ')}`, missingAccounts };
      }

      const { data: entryNumber } = await supabase.rpc('generate_journal_entry_number');
      if (!entryNumber) throw new Error('Gagal generate nomor jurnal');

      const { data: journal, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: new Date().toISOString().split('T')[0],
          description: `Pembayaran SHU Ditahan ${memberName} tahun ${year}`,
          status: 'approved',
          total_debit: releasedAmount,
          total_credit: releasedAmount,
          is_balanced: true,
          reference_type: 'shu_release',
        })
        .select('id, entry_number')
        .single();

      if (journalError || !journal) throw new Error(journalError?.message);

      const lines = [
        {
          journal_entry_id: journal.id,
          account_id: hutangDitahan!.id,
          debit_amount: releasedAmount,
          credit_amount: 0,
          description: `Pembayaran SHU Ditahan ke ${memberName}`,
        },
        {
          journal_entry_id: journal.id,
          account_id: kasBank!.id,
          debit_amount: 0,
          credit_amount: releasedAmount,
          description: `Pengeluaran ${paymentMethod === 'cash' ? 'kas' : 'bank'} untuk SHU ${memberName}`,
        },
      ];

      await supabase.from('journal_entry_lines').insert(lines);

      // Update balances
      const { data: ditahanBal } = await supabase.from('chart_of_accounts').select('balance').eq('id', hutangDitahan!.id).single();
      const { data: kasBal } = await supabase.from('chart_of_accounts').select('balance').eq('id', kasBank!.id).single();

      if (ditahanBal) {
        await supabase.from('chart_of_accounts').update({ balance: (ditahanBal.balance || 0) - releasedAmount }).eq('id', hutangDitahan!.id);
      }
      if (kasBal) {
        // Kas/Bank is asset: credit decreases
        await supabase.from('chart_of_accounts').update({ balance: (kasBal.balance || 0) - releasedAmount }).eq('id', kasBank!.id);
      }

      await supabase.from('journal_audit_logs').insert({
        journal_entry_id: journal.id,
        action: 'create',
        change_summary: `Pembayaran SHU ditahan - ${memberName} tahun ${year}`,
        new_data: { user_id: userId, year, amount: releasedAmount, payment_method: paymentMethod },
      });

      return { success: true, journalId: journal.id, journalNumber: journal.entry_number };
    } catch (error) {
      console.error('Error creating release journal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [findAccount]);

  return {
    ensureAccountsExist,
    createWithholdingJournal,
    createArrearsPaymentJournal,
    createReleaseJournal,
    WITHHELD_SHU_ACCOUNT_CODES,
  };
};
