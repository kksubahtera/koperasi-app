import { supabase } from '@/integrations/supabase/client';

// Account codes for resignation journal entries
const RESIGNATION_ACCOUNT_CODES = {
  kas: '1-1000',
  simpanan_pokok: '2-1010',
  simpanan_wajib: '2-1020',
  simpanan_sukarela: '2-1030',
  piutang: '1-2000'
};

interface ResignationData {
  id: string;
  user_id: string;
  total_savings: number;
  simpanan_pokok: number;
  simpanan_wajib: number;
  simpanan_sukarela: number;
  remaining_loan_principal: number;
  total_penalties: number;
  refund_amount: number;
  journal_entry_id: string | null;
  processed_by: string | null;
}

export const useResignationJournal = () => {
  // Get account ID by code
  const getAccountId = async (accountCode: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('account_code', accountCode)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.log(`[ResignationJournal] Account not found for code: ${accountCode}`);
      return null;
    }
    return data.id;
  };

  // Generate journal entry number
  const generateJournalNumber = async (): Promise<string> => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `RES-${year}${month}`;

    // Count existing resignation journals this month
    const { count } = await supabase
      .from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .like('entry_number', `${prefix}%`);

    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  };

  // Create resignation journal entry
  const createResignationJournal = async (resignation: ResignationData, memberName: string) => {
    console.log('[ResignationJournal] Creating journal for resignation:', resignation.id);

    try {
      // Get all required account IDs
      const [kasId, simpananPokokId, simpananWajibId, simpananSukarelaId, piutangId] = await Promise.all([
        getAccountId(RESIGNATION_ACCOUNT_CODES.kas),
        getAccountId(RESIGNATION_ACCOUNT_CODES.simpanan_pokok),
        getAccountId(RESIGNATION_ACCOUNT_CODES.simpanan_wajib),
        getAccountId(RESIGNATION_ACCOUNT_CODES.simpanan_sukarela),
        getAccountId(RESIGNATION_ACCOUNT_CODES.piutang)
      ]);

      console.log('[ResignationJournal] Account IDs:', {
        kas: kasId,
        simpanan_pokok: simpananPokokId,
        simpanan_wajib: simpananWajibId,
        simpanan_sukarela: simpananSukarelaId,
        piutang: piutangId
      });

      if (!kasId) {
        throw new Error('Akun Kas tidak ditemukan. Pastikan akun dengan kode 1-1000 sudah ada.');
      }

      // Generate journal number
      const entryNumber = await generateJournalNumber();
      console.log('[ResignationJournal] Generated entry number:', entryNumber);

      // Prepare journal entry lines
      const lines: Array<{ account_id: string; debit_amount: number; credit_amount: number; description: string }> = [];

      // Debit: Simpanan accounts (decrease liability)
      if (resignation.simpanan_pokok > 0 && simpananPokokId) {
        lines.push({
          account_id: simpananPokokId,
          debit_amount: resignation.simpanan_pokok,
          credit_amount: 0,
          description: 'Pengembalian simpanan pokok'
        });
      }

      if (resignation.simpanan_wajib > 0 && simpananWajibId) {
        lines.push({
          account_id: simpananWajibId,
          debit_amount: resignation.simpanan_wajib,
          credit_amount: 0,
          description: 'Pengembalian simpanan wajib'
        });
      }

      if (resignation.simpanan_sukarela > 0 && simpananSukarelaId) {
        lines.push({
          account_id: simpananSukarelaId,
          debit_amount: resignation.simpanan_sukarela,
          credit_amount: 0,
          description: 'Pengembalian simpanan sukarela'
        });
      }

      // Credit: Kas (if there's refund)
      if (resignation.refund_amount > 0) {
        lines.push({
          account_id: kasId,
          debit_amount: 0,
          credit_amount: resignation.refund_amount,
          description: 'Pengembalian dana ke anggota'
        });
      }

      // Credit: Piutang (if loan paid off from savings)
      if (resignation.remaining_loan_principal > 0 && piutangId) {
        const loanPayoff = resignation.remaining_loan_principal + resignation.total_penalties;
        lines.push({
          account_id: piutangId,
          debit_amount: 0,
          credit_amount: loanPayoff,
          description: 'Pelunasan pinjaman dari simpanan'
        });
      }

      // Calculate totals
      const totalDebit = lines.reduce((sum, line) => sum + line.debit_amount, 0);
      const totalCredit = lines.reduce((sum, line) => sum + line.credit_amount, 0);

      console.log('[ResignationJournal] Journal lines:', lines);
      console.log('[ResignationJournal] Totals - Debit:', totalDebit, 'Credit:', totalCredit);

      if (lines.length === 0) {
        throw new Error('Tidak ada entri jurnal yang dapat dibuat');
      }

      // Create journal entry
      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: new Date().toISOString().split('T')[0],
          description: `Pengembalian simpanan - Pengunduran diri anggota ${memberName}`,
          status: 'approved',
          total_debit: totalDebit,
          total_credit: totalCredit,
          is_balanced: Math.abs(totalDebit - totalCredit) < 0.01,
          reference_type: 'resignation',
          reference_id: resignation.id,
          created_by: resignation.processed_by
        })
        .select('id, entry_number')
        .single();

      if (journalError) {
        console.error('[ResignationJournal] Error creating journal entry:', journalError);
        throw journalError;
      }

      console.log('[ResignationJournal] Created journal entry:', journalEntry);

      // Create journal entry lines
      const journalLines = lines.map(line => ({
        journal_entry_id: journalEntry.id,
        account_id: line.account_id,
        debit_amount: line.debit_amount,
        credit_amount: line.credit_amount,
        description: line.description
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(journalLines);

      if (linesError) {
        console.error('[ResignationJournal] Error creating journal lines:', linesError);
        // Rollback: delete the journal entry
        await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
        throw linesError;
      }

      console.log('[ResignationJournal] Created journal lines successfully');

      return {
        success: true,
        journalId: journalEntry.id,
        journalNumber: journalEntry.entry_number
      };
    } catch (error) {
      console.error('[ResignationJournal] Error creating journal:', error);
      throw error;
    }
  };

  // Regenerate journal for existing resignation
  const regenerateResignationJournal = async (resignationId: string) => {
    console.log('[ResignationJournal] Regenerating journal for resignation:', resignationId);

    try {
      // Fetch resignation data
      const { data: resignation, error: fetchError } = await supabase
        .from('resignation_requests')
        .select('*')
        .eq('id', resignationId)
        .single();

      if (fetchError || !resignation) {
        throw new Error('Pengunduran diri tidak ditemukan');
      }

      if (resignation.status !== 'approved') {
        throw new Error('Hanya pengunduran diri yang sudah disetujui yang dapat dibuat jurnalnya');
      }

      // Check if journal already exists
      if (resignation.journal_entry_id) {
        const { data: existingJournal } = await supabase
          .from('journal_entries')
          .select('id')
          .eq('id', resignation.journal_entry_id)
          .single();

        if (existingJournal) {
          throw new Error('Jurnal sudah ada untuk pengunduran diri ini');
        }
      }

      // Get member name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', resignation.user_id)
        .single();

      const memberName = profile?.name || 'Unknown';

      // Create the journal
      const result = await createResignationJournal(resignation, memberName);

      if (result.success && result.journalId) {
        // Update resignation with journal_entry_id
        const { error: updateError } = await supabase
          .from('resignation_requests')
          .update({ journal_entry_id: result.journalId })
          .eq('id', resignationId);

        if (updateError) {
          console.error('[ResignationJournal] Error updating resignation with journal ID:', updateError);
        }
      }

      return result;
    } catch (error) {
      console.error('[ResignationJournal] Error regenerating journal:', error);
      throw error;
    }
  };

  return {
    createResignationJournal,
    regenerateResignationJournal
  };
};
