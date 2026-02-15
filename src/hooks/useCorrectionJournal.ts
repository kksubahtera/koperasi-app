import { supabase } from '@/integrations/supabase/client';
import { CorrectionType, CorrectionOperation } from '@/lib/types';

interface CorrectionJournalParams {
  correctionType: CorrectionType;
  operation: CorrectionOperation;
  amount: number;
  memberId: string;
  memberName: string;
  correctionId: string;
  reason: string;
}

// Account codes for correction journal entries - must match database chart_of_accounts
const CORRECTION_ACCOUNT_CODES = {
  kas: '1-1000',
  bank: '1-1100',
  simpanan_pokok: '2-1010',
  simpanan_wajib: '2-1020',
  simpanan_sukarela: '2-1030',
  piutang_pinjaman: '1-2000',
  pendapatan_bunga: '4-1000',
  pendapatan_denda: '4-1010',
};

export interface AccountValidationResult {
  isValid: boolean;
  missingAccounts: string[];
}

export const useCorrectionJournal = () => {
  
  const generateEntryNumber = async (): Promise<string> => {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    const { count } = await supabase
      .from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .like('entry_number', `KOR-${year}${month}%`);
    
    const seq = ((count || 0) + 1).toString().padStart(4, '0');
    return `KOR-${year}${month}-${seq}`;
  };

  const getAccountByCode = async (code: string) => {
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, account_name, account_code')
      .eq('account_code', code)
      .eq('is_active', true)
      .single();
    return data;
  };

  // Validate that all required accounts exist before regenerating journals
  const validateRequiredAccounts = async (): Promise<AccountValidationResult> => {
    const requiredAccounts = [
      { code: CORRECTION_ACCOUNT_CODES.kas, label: 'Kas (1-1000)' },
      { code: CORRECTION_ACCOUNT_CODES.simpanan_pokok, label: 'Simpanan Pokok (2-1010)' },
      { code: CORRECTION_ACCOUNT_CODES.simpanan_wajib, label: 'Simpanan Wajib (2-1020)' },
      { code: CORRECTION_ACCOUNT_CODES.simpanan_sukarela, label: 'Simpanan Sukarela (2-1030)' },
      { code: CORRECTION_ACCOUNT_CODES.piutang_pinjaman, label: 'Piutang Pinjaman (1-2000)' },
    ];
    
    const missingAccounts: string[] = [];
    
    for (const account of requiredAccounts) {
      const found = await getAccountByCode(account.code);
      if (!found) {
        missingAccounts.push(account.label);
      }
    }
    
    return {
      isValid: missingAccounts.length === 0,
      missingAccounts,
    };
  };

  const createCorrectionJournal = async (params: CorrectionJournalParams): Promise<string | null> => {
    const { correctionType, operation, amount, memberName, correctionId, reason } = params;
    
    console.log('[CorrectionJournal] Creating journal for correction:', { correctionType, operation, amount, memberName, correctionId });
    
    try {
      // Get account IDs
      const kasAccount = await getAccountByCode(CORRECTION_ACCOUNT_CODES.kas);
      console.log('[CorrectionJournal] Kas account:', kasAccount);
      
      let targetAccountCode = '';
      let targetAccountLabel = '';
      
      switch (correctionType) {
        case 'simpanan_pokok':
          targetAccountCode = CORRECTION_ACCOUNT_CODES.simpanan_pokok;
          targetAccountLabel = 'Simpanan Pokok';
          break;
        case 'simpanan_wajib':
          targetAccountCode = CORRECTION_ACCOUNT_CODES.simpanan_wajib;
          targetAccountLabel = 'Simpanan Wajib';
          break;
        case 'simpanan_sukarela':
          targetAccountCode = CORRECTION_ACCOUNT_CODES.simpanan_sukarela;
          targetAccountLabel = 'Simpanan Sukarela';
          break;
        case 'angsuran_pinjaman':
          targetAccountCode = CORRECTION_ACCOUNT_CODES.piutang_pinjaman;
          targetAccountLabel = 'Piutang Pinjaman';
          break;
      }
      
      const targetAccount = await getAccountByCode(targetAccountCode);
      console.log('[CorrectionJournal] Target account:', targetAccount, 'code:', targetAccountCode);
      
      if (!kasAccount || !targetAccount) {
        console.error('[CorrectionJournal] Required accounts not found:', { kasAccount, targetAccount, kasCode: CORRECTION_ACCOUNT_CODES.kas, targetCode: targetAccountCode });
        return null;
      }
      
      // Generate entry number
      const entryNumber = await generateEntryNumber();
      
      // Create description
      const operationText = operation === 'add' ? 'Penambahan' : 'Pengurangan';
      const description = `Koreksi ${operationText} ${targetAccountLabel} - ${memberName}: ${reason}`;
      
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
          reference_type: 'correction',
          reference_id: correctionId,
        })
        .select()
        .single();
      
      if (journalError) {
        console.error('[CorrectionJournal] Error creating journal entry:', journalError);
        return null;
      }
      
      console.log('[CorrectionJournal] Journal entry created:', journalEntry.id, journalEntry.entry_number);
      
      // Create journal entry lines based on correction type and operation
      const lines = [];
      
      if (correctionType === 'angsuran_pinjaman') {
        // Loan installment correction
        if (operation === 'add') {
          // Adding paid amount: Debit Kas, Credit Piutang
          lines.push(
            { journal_entry_id: journalEntry.id, account_id: kasAccount.id, debit_amount: amount, credit_amount: 0, description: 'Koreksi penerimaan angsuran' },
            { journal_entry_id: journalEntry.id, account_id: targetAccount.id, debit_amount: 0, credit_amount: amount, description: 'Koreksi piutang pinjaman' }
          );
        } else {
          // Subtracting paid amount: Debit Piutang, Credit Kas
          lines.push(
            { journal_entry_id: journalEntry.id, account_id: targetAccount.id, debit_amount: amount, credit_amount: 0, description: 'Koreksi piutang pinjaman' },
            { journal_entry_id: journalEntry.id, account_id: kasAccount.id, debit_amount: 0, credit_amount: amount, description: 'Koreksi pengembalian angsuran' }
          );
        }
      } else {
        // Savings correction
        if (operation === 'add') {
          // Adding savings: Debit Kas, Credit Simpanan
          lines.push(
            { journal_entry_id: journalEntry.id, account_id: kasAccount.id, debit_amount: amount, credit_amount: 0, description: `Koreksi penerimaan ${targetAccountLabel}` },
            { journal_entry_id: journalEntry.id, account_id: targetAccount.id, debit_amount: 0, credit_amount: amount, description: `Koreksi ${targetAccountLabel}` }
          );
        } else {
          // Subtracting savings: Debit Simpanan, Credit Kas
          lines.push(
            { journal_entry_id: journalEntry.id, account_id: targetAccount.id, debit_amount: amount, credit_amount: 0, description: `Koreksi ${targetAccountLabel}` },
            { journal_entry_id: journalEntry.id, account_id: kasAccount.id, debit_amount: 0, credit_amount: amount, description: `Koreksi pengeluaran ${targetAccountLabel}` }
          );
        }
      }
      
      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(lines);
      
      if (linesError) {
        console.error('[CorrectionJournal] Error creating journal entry lines:', linesError);
        // Rollback journal entry
        await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
        return null;
      }
      
      console.log('[CorrectionJournal] Journal lines created:', lines.length);
      
      // Update account balances directly
      for (const line of lines) {
        const balanceChange = line.debit_amount - line.credit_amount;
        
        // Fetch current balance and update
        const { data: accountData } = await supabase
          .from('chart_of_accounts')
          .select('balance')
          .eq('id', line.account_id)
          .single();
        
        if (accountData) {
          await supabase
            .from('chart_of_accounts')
            .update({ balance: accountData.balance + balanceChange })
            .eq('id', line.account_id);
        }
      }
      
      console.log('[CorrectionJournal] Successfully created correction journal:', journalEntry.id);
      return journalEntry.id;
    } catch (error) {
      console.error('[CorrectionJournal] Error in createCorrectionJournal:', error);
      return null;
    }
  };

  // Regenerate journal for an existing correction that doesn't have one
  const regenerateCorrectionJournal = async (correctionId: string): Promise<{ success: boolean; journalNumber?: string }> => {
    console.log('[CorrectionJournal] Regenerating journal for correction:', correctionId);
    
    try {
      // Fetch correction data (without join to profiles)
      const { data: correction, error: correctionError } = await supabase
        .from('corrections')
        .select('*')
        .eq('id', correctionId)
        .single();
      
      if (correctionError || !correction) {
        console.error('[CorrectionJournal] Error fetching correction:', correctionError);
        return { success: false };
      }
      
      // Check if journal already exists
      if (correction.journal_entry_id) {
        console.log('[CorrectionJournal] Journal already exists for correction:', correction.journal_entry_id);
        return { success: false };
      }
      
      // Fetch profile data separately
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', correction.user_id)
        .single();
      
      // Create the journal
      const journalId = await createCorrectionJournal({
        correctionType: correction.correction_type as CorrectionType,
        operation: correction.operation as CorrectionOperation,
        amount: correction.amount,
        memberId: correction.user_id,
        memberName: profile?.name || 'Unknown',
        correctionId: correction.id,
        reason: correction.reason,
      });
      
      if (!journalId) {
        console.error('[CorrectionJournal] Failed to create journal');
        return { success: false };
      }
      
      // Update correction with journal_entry_id
      const { error: updateError } = await supabase
        .from('corrections')
        .update({ journal_entry_id: journalId })
        .eq('id', correctionId);
      
      if (updateError) {
        console.error('[CorrectionJournal] Error updating correction with journal_entry_id:', updateError);
        // Don't rollback the journal - it's still valid, just not linked
      }
      
      // Get the journal number
      const { data: journal } = await supabase
        .from('journal_entries')
        .select('entry_number')
        .eq('id', journalId)
        .single();
      
      console.log('[CorrectionJournal] Successfully regenerated journal:', journal?.entry_number);
      return { success: true, journalNumber: journal?.entry_number };
    } catch (error) {
      console.error('[CorrectionJournal] Error in regenerateCorrectionJournal:', error);
      return { success: false };
    }
  };

  return { createCorrectionJournal, regenerateCorrectionJournal, validateRequiredAccounts };
};
