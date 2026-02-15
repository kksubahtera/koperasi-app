import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Account codes mapping for automatic journal entries
const ACCOUNT_CODES = {
  // Asset accounts
  KAS: '1-100',           // Kas Umum
  BANK: '1-110',          // Bank
  
  // Income accounts
  PENDAPATAN_LAIN: '4-900',    // Pendapatan Lain-lain
  PENDAPATAN_ADMIN: '4-120',    // Pendapatan Administrasi
  PENDAPATAN_JASA: '4-300',     // Pendapatan Jasa
  
  // Expense accounts
  BEBAN_OPERASIONAL: '5-100',   // Beban Operasional Umum
  BEBAN_ADMIN: '5-140',         // Beban Administrasi
  BEBAN_LAIN: '5-900',          // Beban Lain-lain
};

interface HybridTransactionInput {
  type: 'income' | 'expense';
  description: string;
  amount: number;
  year: number;
  incomeCategory?: string;
  expenseCategory?: string;
}

interface HybridTransactionResult {
  incomeExpenseId: string;
  journalEntryId: string;
  journalEntryNumber: string;
}

export const useHybridTransaction = () => {
  const [loading, setLoading] = useState(false);

  // Get account ID by account code
  const getAccountId = useCallback(async (accountCode: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('account_code', accountCode)
      .maybeSingle();

    if (error || !data) {
      console.error('Account not found:', accountCode, error);
      return null;
    }
    return data.id;
  }, []);

  // Generate journal entry number
  const generateEntryNumber = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_journal_entry_number');
    if (error) {
      console.error('Error generating entry number:', error);
      return `JRN-${Date.now()}`;
    }
    return data;
  }, []);

  // Update account balance
  const updateAccountBalance = useCallback(async (
    accountId: string,
    debitAmount: number,
    creditAmount: number
  ) => {
    const { data: account } = await supabase
      .from('chart_of_accounts')
      .select('balance, account_type')
      .eq('id', accountId)
      .single();

    if (account) {
      let newBalance = account.balance;
      // For asset and expense: debit increases, credit decreases
      // For liability, equity, income: credit increases, debit decreases
      if (['asset', 'expense'].includes(account.account_type)) {
        newBalance += debitAmount - creditAmount;
      } else {
        newBalance += creditAmount - debitAmount;
      }

      await supabase
        .from('chart_of_accounts')
        .update({ balance: newBalance })
        .eq('id', accountId);
    }
  }, []);

  // Create hybrid transaction (income/expense + journal entry)
  const createTransaction = useCallback(async (
    input: HybridTransactionInput
  ): Promise<HybridTransactionResult | null> => {
    setLoading(true);

    try {
      // 1. Determine which accounts to use
      let cashAccountCode = ACCOUNT_CODES.KAS;
      let targetAccountCode: string;

      if (input.type === 'income') {
        // Income: Debit Kas, Credit Pendapatan
        switch (input.incomeCategory) {
          case 'admin':
            targetAccountCode = ACCOUNT_CODES.PENDAPATAN_ADMIN;
            break;
          case 'jasa':
            targetAccountCode = ACCOUNT_CODES.PENDAPATAN_JASA;
            break;
          default:
            targetAccountCode = ACCOUNT_CODES.PENDAPATAN_LAIN;
        }
      } else {
        // Expense: Debit Beban, Credit Kas
        switch (input.expenseCategory) {
          case 'admin':
            targetAccountCode = ACCOUNT_CODES.BEBAN_ADMIN;
            break;
          case 'operasional':
            targetAccountCode = ACCOUNT_CODES.BEBAN_OPERASIONAL;
            break;
          default:
            targetAccountCode = ACCOUNT_CODES.BEBAN_LAIN;
        }
      }

      // 2. Get account IDs
      const cashAccountId = await getAccountId(cashAccountCode);
      const targetAccountId = await getAccountId(targetAccountCode);

      if (!cashAccountId || !targetAccountId) {
        toast.error('Akun tidak ditemukan. Pastikan Chart of Accounts sudah dikonfigurasi.');
        setLoading(false);
        return null;
      }

      // 3. Create income/expense entry
      const tableName = input.type === 'income' ? 'income_entries' : 'expense_entries';
      const { data: entryData, error: entryError } = await supabase
        .from(tableName)
        .insert([{
          description: input.description,
          amount: input.amount,
          type: 'manual',
          date: new Date().toISOString(),
          year: input.year
        }])
        .select()
        .single();

      if (entryError) {
        console.error('Error creating entry:', entryError);
        toast.error('Gagal membuat entri: ' + entryError.message);
        setLoading(false);
        return null;
      }

      // 4. Generate journal entry number
      const entryNumber = await generateEntryNumber();

      // 5. Create journal entry
      const journalDescription = input.type === 'income'
        ? `Pendapatan: ${input.description}`
        : `Beban: ${input.description}`;

      const { data: journalData, error: journalError } = await supabase
        .from('journal_entries')
        .insert([{
          entry_number: entryNumber,
          entry_date: new Date().toISOString().split('T')[0],
          description: journalDescription,
          reference_type: input.type === 'income' ? 'income_entry' : 'expense_entry',
          reference_id: entryData.id,
          total_debit: input.amount,
          total_credit: input.amount,
          is_balanced: true,
          status: 'posted'
        }])
        .select()
        .single();

      if (journalError) {
        console.error('Error creating journal:', journalError);
        // Rollback - delete the entry
        await supabase.from(tableName).delete().eq('id', entryData.id);
        toast.error('Gagal membuat jurnal: ' + journalError.message);
        setLoading(false);
        return null;
      }

      // 6. Create journal entry lines
      let journalLines;
      if (input.type === 'income') {
        // Income: Debit Kas, Credit Pendapatan
        journalLines = [
          {
            journal_entry_id: journalData.id,
            account_id: cashAccountId,
            description: 'Penerimaan kas',
            debit_amount: input.amount,
            credit_amount: 0
          },
          {
            journal_entry_id: journalData.id,
            account_id: targetAccountId,
            description: input.description,
            debit_amount: 0,
            credit_amount: input.amount
          }
        ];
      } else {
        // Expense: Debit Beban, Credit Kas
        journalLines = [
          {
            journal_entry_id: journalData.id,
            account_id: targetAccountId,
            description: input.description,
            debit_amount: input.amount,
            credit_amount: 0
          },
          {
            journal_entry_id: journalData.id,
            account_id: cashAccountId,
            description: 'Pengeluaran kas',
            debit_amount: 0,
            credit_amount: input.amount
          }
        ];
      }

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(journalLines);

      if (linesError) {
        console.error('Error creating journal lines:', linesError);
        // Rollback
        await supabase.from('journal_entries').delete().eq('id', journalData.id);
        await supabase.from(tableName).delete().eq('id', entryData.id);
        toast.error('Gagal membuat detail jurnal: ' + linesError.message);
        setLoading(false);
        return null;
      }

      // 7. Update account balances
      if (input.type === 'income') {
        await updateAccountBalance(cashAccountId, input.amount, 0);
        await updateAccountBalance(targetAccountId, 0, input.amount);
      } else {
        await updateAccountBalance(targetAccountId, input.amount, 0);
        await updateAccountBalance(cashAccountId, 0, input.amount);
      }

      const typeLabel = input.type === 'income' ? 'Pendapatan' : 'Beban';
      toast.success(`${typeLabel} berhasil dicatat dengan jurnal ${entryNumber}`);

      setLoading(false);
      return {
        incomeExpenseId: entryData.id,
        journalEntryId: journalData.id,
        journalEntryNumber: entryNumber
      };

    } catch (error) {
      console.error('Error in hybrid transaction:', error);
      toast.error('Terjadi kesalahan saat menyimpan transaksi');
      setLoading(false);
      return null;
    }
  }, [getAccountId, generateEntryNumber, updateAccountBalance]);

  // Delete hybrid transaction (delete both income/expense and journal entry)
  const deleteTransaction = useCallback(async (
    type: 'income' | 'expense',
    entryId: string
  ): Promise<boolean> => {
    setLoading(true);

    try {
      // 1. Find related journal entry
      const { data: journalEntry } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference_type', type === 'income' ? 'income_entry' : 'expense_entry')
        .eq('reference_id', entryId)
        .maybeSingle();

      // 2. If journal entry exists, reverse balances and delete
      if (journalEntry) {
        const { data: lines } = await supabase
          .from('journal_entry_lines')
          .select('account_id, debit_amount, credit_amount')
          .eq('journal_entry_id', journalEntry.id);

        // Reverse account balances
        if (lines) {
          for (const line of lines) {
            const { data: account } = await supabase
              .from('chart_of_accounts')
              .select('balance, account_type')
              .eq('id', line.account_id)
              .single();

            if (account) {
              let newBalance = account.balance;
              // Reverse the original transaction
              if (['asset', 'expense'].includes(account.account_type)) {
                newBalance -= line.debit_amount - line.credit_amount;
              } else {
                newBalance -= line.credit_amount - line.debit_amount;
              }

              await supabase
                .from('chart_of_accounts')
                .update({ balance: newBalance })
                .eq('id', line.account_id);
            }
          }
        }

        // Delete journal entry (lines will cascade)
        await supabase
          .from('journal_entries')
          .delete()
          .eq('id', journalEntry.id);
      }

      // 3. Delete the income/expense entry
      const tableName = type === 'income' ? 'income_entries' : 'expense_entries';
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', entryId);

      if (error) {
        console.error('Error deleting entry:', error);
        toast.error('Gagal menghapus entri: ' + error.message);
        setLoading(false);
        return false;
      }

      const typeLabel = type === 'income' ? 'Pendapatan' : 'Beban';
      toast.success(`${typeLabel} dan jurnal terkait berhasil dihapus`);
      setLoading(false);
      return true;

    } catch (error) {
      console.error('Error deleting hybrid transaction:', error);
      toast.error('Terjadi kesalahan saat menghapus transaksi');
      setLoading(false);
      return false;
    }
  }, []);

  return {
    loading,
    createTransaction,
    deleteTransaction
  };
};
