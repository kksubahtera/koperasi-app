import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
  created_at: string;
  // Joined data
  account?: {
    id: string;
    account_code: string;
    account_name: string;
  };
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  business_unit_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  status: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  business_unit?: {
    id: string;
    code: string;
    name: string;
  } | null;
  lines?: JournalEntryLine[];
}

export interface JournalEntryLineInput {
  account_id: string;
  description?: string;
  debit_amount?: number;
  credit_amount?: number;
}

export interface JournalEntryInput {
  entry_date?: string;
  description: string;
  business_unit_id?: string | null;
  reference_type?: string;
  reference_id?: string;
  lines: JournalEntryLineInput[];
}

export interface JournalAuditLog {
  id: string;
  journal_entry_id: string;
  action: string;
  changed_by: string | null;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  change_summary: string | null;
  // Joined
  changer?: {
    name: string;
    email: string;
  } | null;
}

const createAuditLog = async (
  journalEntryId: string,
  action: 'created' | 'updated' | 'deleted',
  oldData: unknown,
  newData: unknown,
  changeSummary: string
) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('journal_audit_logs') as any).insert([{
    journal_entry_id: journalEntryId,
    action,
    changed_by: user?.id || null,
    old_data: oldData,
    new_data: newData,
    change_summary: changeSummary
  }]);
};

export const useJournalEntries = (year?: number, businessUnitId?: string) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('journal_entries')
      .select(`
        *,
        business_unit:business_units(id, code, name)
      `)
      .order('entry_date', { ascending: false })
      .order('entry_number', { ascending: false });

    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      query = query.gte('entry_date', startDate).lte('entry_date', endDate);
    }

    if (businessUnitId) {
      query = query.eq('business_unit_id', businessUnitId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching journal entries:', error);
      toast.error('Gagal mengambil data jurnal');
    } else {
      setEntries((data || []).map(item => ({
        ...item,
        business_unit: item.business_unit || null
      })));
    }
    setLoading(false);
  }, [year, businessUnitId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const getEntryWithLines = async (entryId: string): Promise<JournalEntry | null> => {
    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .select(`
        *,
        business_unit:business_units(id, code, name)
      `)
      .eq('id', entryId)
      .single();

    if (entryError) {
      console.error('Error fetching journal entry:', entryError);
      return null;
    }

    const { data: lines, error: linesError } = await supabase
      .from('journal_entry_lines')
      .select(`
        *,
        account:chart_of_accounts(id, account_code, account_name)
      `)
      .eq('journal_entry_id', entryId)
      .order('created_at');

    if (linesError) {
      console.error('Error fetching journal entry lines:', linesError);
    }

    return {
      ...entry,
      business_unit: entry.business_unit || null,
      lines: (lines || []).map(line => ({
        ...line,
        account: line.account || undefined
      }))
    };
  };

  const generateEntryNumber = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_journal_entry_number');
    if (error) {
      console.error('Error generating entry number:', error);
      return `JRN-${Date.now()}`;
    }
    return data;
  };

  const createEntry = async (input: JournalEntryInput) => {
    // Validate balanced entry
    const totalDebit = input.lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
    const totalCredit = input.lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    if (!isBalanced) {
      toast.error('Jurnal tidak seimbang! Total Debit harus sama dengan Total Kredit');
      return null;
    }

    // Generate entry number
    const entryNumber = await generateEntryNumber();

    // Insert journal entry
    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert([{
        entry_number: entryNumber,
        entry_date: input.entry_date || new Date().toISOString().split('T')[0],
        description: input.description,
        business_unit_id: input.business_unit_id,
        reference_type: input.reference_type,
        reference_id: input.reference_id,
        total_debit: totalDebit,
        total_credit: totalCredit,
        is_balanced: isBalanced,
        status: 'posted'
      }])
      .select()
      .single();

    if (entryError) {
      console.error('Error creating journal entry:', entryError);
      toast.error('Gagal membuat jurnal: ' + entryError.message);
      return null;
    }

    // Insert journal entry lines
    const lines = input.lines.map(line => ({
      journal_entry_id: entry.id,
      account_id: line.account_id,
      description: line.description,
      debit_amount: line.debit_amount || 0,
      credit_amount: line.credit_amount || 0
    }));

    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(lines);

    if (linesError) {
      console.error('Error creating journal entry lines:', linesError);
      // Rollback - delete the entry
      await supabase.from('journal_entries').delete().eq('id', entry.id);
      toast.error('Gagal membuat detail jurnal: ' + linesError.message);
      return null;
    }

    // Update account balances
    for (const line of input.lines) {
      const { data: account } = await supabase
        .from('chart_of_accounts')
        .select('balance, account_type')
        .eq('id', line.account_id)
        .single();

      if (account) {
        let newBalance = account.balance;
        // For asset and expense: debit increases, credit decreases
        // For liability, equity, income: credit increases, debit decreases
        if (['asset', 'expense'].includes(account.account_type)) {
          newBalance += (line.debit_amount || 0) - (line.credit_amount || 0);
        } else {
          newBalance += (line.credit_amount || 0) - (line.debit_amount || 0);
        }

        await supabase
          .from('chart_of_accounts')
          .update({ balance: newBalance })
          .eq('id', line.account_id);
      }
    }

    // Create audit log for new entry
    await createAuditLog(
      entry.id,
      'created',
      null,
      {
        entry_number: entryNumber,
        entry_date: input.entry_date || new Date().toISOString().split('T')[0],
        description: input.description,
        total_debit: totalDebit,
        total_credit: totalCredit,
        lines: input.lines
      },
      `Jurnal ${entryNumber} dibuat dengan total ${totalDebit.toLocaleString('id-ID')}`
    );

    toast.success('Jurnal berhasil dibuat');
    await fetchEntries();
    return entry;
  };

  const updateEntry = async (id: string, input: JournalEntryInput): Promise<JournalEntry | null> => {
    // Validate balanced entry
    const totalDebit = input.lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
    const totalCredit = input.lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    if (!isBalanced) {
      toast.error('Jurnal tidak seimbang! Total Debit harus sama dengan Total Kredit');
      return null;
    }

    // Get existing entry to reverse balances
    const existingEntry = await getEntryWithLines(id);
    if (!existingEntry || !existingEntry.lines) {
      toast.error('Jurnal tidak ditemukan');
      return null;
    }

    // Reverse old account balances
    for (const line of existingEntry.lines) {
      const { data: account } = await supabase
        .from('chart_of_accounts')
        .select('balance, account_type')
        .eq('id', line.account_id)
        .single();

      if (account) {
        let newBalance = account.balance;
        if (['asset', 'expense'].includes(account.account_type)) {
          newBalance -= (line.debit_amount || 0) - (line.credit_amount || 0);
        } else {
          newBalance -= (line.credit_amount || 0) - (line.debit_amount || 0);
        }

        await supabase
          .from('chart_of_accounts')
          .update({ balance: newBalance })
          .eq('id', line.account_id);
      }
    }

    // Delete old lines
    await supabase
      .from('journal_entry_lines')
      .delete()
      .eq('journal_entry_id', id);

    // Update journal entry
    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .update({
        entry_date: input.entry_date || existingEntry.entry_date,
        description: input.description,
        business_unit_id: input.business_unit_id,
        total_debit: totalDebit,
        total_credit: totalCredit,
        is_balanced: isBalanced,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (entryError) {
      console.error('Error updating journal entry:', entryError);
      toast.error('Gagal memperbarui jurnal: ' + entryError.message);
      return null;
    }

    // Insert new lines
    const lines = input.lines.map(line => ({
      journal_entry_id: id,
      account_id: line.account_id,
      description: line.description,
      debit_amount: line.debit_amount || 0,
      credit_amount: line.credit_amount || 0
    }));

    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(lines);

    if (linesError) {
      console.error('Error creating journal entry lines:', linesError);
      toast.error('Gagal membuat detail jurnal: ' + linesError.message);
      return null;
    }

    // Apply new account balances
    for (const line of input.lines) {
      const { data: account } = await supabase
        .from('chart_of_accounts')
        .select('balance, account_type')
        .eq('id', line.account_id)
        .single();

      if (account) {
        let newBalance = account.balance;
        if (['asset', 'expense'].includes(account.account_type)) {
          newBalance += (line.debit_amount || 0) - (line.credit_amount || 0);
        } else {
          newBalance += (line.credit_amount || 0) - (line.debit_amount || 0);
        }

        await supabase
          .from('chart_of_accounts')
          .update({ balance: newBalance })
          .eq('id', line.account_id);
      }
    }

    // Create audit log for update
    const changes: string[] = [];
    if (existingEntry.entry_date !== (input.entry_date || existingEntry.entry_date)) {
      changes.push(`tanggal: ${existingEntry.entry_date} → ${input.entry_date}`);
    }
    if (existingEntry.description !== input.description) {
      changes.push(`keterangan diubah`);
    }
    if (existingEntry.total_debit !== totalDebit || existingEntry.total_credit !== totalCredit) {
      changes.push(`nominal: ${existingEntry.total_debit.toLocaleString('id-ID')} → ${totalDebit.toLocaleString('id-ID')}`);
    }
    if (existingEntry.lines?.length !== input.lines.length) {
      changes.push(`jumlah baris: ${existingEntry.lines?.length || 0} → ${input.lines.length}`);
    }

    await createAuditLog(
      id,
      'updated',
      {
        entry_date: existingEntry.entry_date,
        description: existingEntry.description,
        total_debit: existingEntry.total_debit,
        total_credit: existingEntry.total_credit,
        lines: existingEntry.lines?.map(l => ({
          account_id: l.account_id,
          debit_amount: l.debit_amount,
          credit_amount: l.credit_amount
        }))
      },
      {
        entry_date: input.entry_date || existingEntry.entry_date,
        description: input.description,
        total_debit: totalDebit,
        total_credit: totalCredit,
        lines: input.lines
      },
      changes.length > 0 ? changes.join(', ') : 'Jurnal diperbarui'
    );

    toast.success('Jurnal berhasil diperbarui');
    await fetchEntries();
    return entry;
  };

  const deleteEntry = async (id: string) => {
    // Get lines first to reverse the balances
    const entry = await getEntryWithLines(id);
    if (!entry || !entry.lines) {
      toast.error('Jurnal tidak ditemukan');
      return false;
    }

    // Reverse account balances
    for (const line of entry.lines) {
      const { data: account } = await supabase
        .from('chart_of_accounts')
        .select('balance, account_type')
        .eq('id', line.account_id)
        .single();

      if (account) {
        let newBalance = account.balance;
        // Reverse the original transaction
        if (['asset', 'expense'].includes(account.account_type)) {
          newBalance -= (line.debit_amount || 0) - (line.credit_amount || 0);
        } else {
          newBalance -= (line.credit_amount || 0) - (line.debit_amount || 0);
        }

        await supabase
          .from('chart_of_accounts')
          .update({ balance: newBalance })
          .eq('id', line.account_id);
      }
    }

    // Create audit log before deleting
    await createAuditLog(
      id,
      'deleted',
      {
        entry_number: entry.entry_number,
        entry_date: entry.entry_date,
        description: entry.description,
        total_debit: entry.total_debit,
        total_credit: entry.total_credit
      },
      null,
      `Jurnal ${entry.entry_number} dihapus`
    );

    // Delete the entry (lines will cascade, but audit logs will remain)
    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting journal entry:', error);
      toast.error('Gagal menghapus jurnal: ' + error.message);
      return false;
    }

    toast.success('Jurnal berhasil dihapus');
    await fetchEntries();
    return true;
  };

  const getAuditLogs = async (journalEntryId: string): Promise<JournalAuditLog[]> => {
    const { data, error } = await supabase
      .from('journal_audit_logs')
      .select('*')
      .eq('journal_entry_id', journalEntryId)
      .order('changed_at', { ascending: false });

    if (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }

    // Fetch user names for each log
    const logs: JournalAuditLog[] = [];
    for (const log of data || []) {
      let changer = null;
      if (log.changed_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('user_id', log.changed_by)
          .maybeSingle();
        changer = profile || null;
      }
      logs.push({
        ...log,
        old_data: log.old_data as Record<string, unknown> | null,
        new_data: log.new_data as Record<string, unknown> | null,
        changer
      });
    }

    return logs;
  };

  const revertToVersion = async (
    journalEntryId: string, 
    oldData: Record<string, unknown>
  ): Promise<JournalEntry | null> => {
    // Get current entry to save as "before" state
    const currentEntry = await getEntryWithLines(journalEntryId);
    if (!currentEntry) {
      toast.error('Jurnal tidak ditemukan');
      return null;
    }

    // Extract data from old_data
    const entryDate = oldData.entry_date as string;
    const description = oldData.description as string;
    const lines = oldData.lines as Array<{
      account_id: string;
      description?: string;
      debit_amount: number;
      credit_amount: number;
    }>;

    if (!lines || lines.length === 0) {
      toast.error('Data versi sebelumnya tidak lengkap');
      return null;
    }

    // Use the updateEntry function to revert
    const result = await updateEntry(journalEntryId, {
      entry_date: entryDate,
      description: description,
      lines: lines.map(l => ({
        account_id: l.account_id,
        description: l.description,
        debit_amount: l.debit_amount,
        credit_amount: l.credit_amount
      }))
    });

    if (result) {
      // Add a specific audit log for the revert action
      await createAuditLog(
        journalEntryId,
        'updated',
        {
          entry_date: currentEntry.entry_date,
          description: currentEntry.description,
          total_debit: currentEntry.total_debit,
          total_credit: currentEntry.total_credit,
          lines: currentEntry.lines?.map(l => ({
            account_id: l.account_id,
            debit_amount: l.debit_amount,
            credit_amount: l.credit_amount
          }))
        },
        oldData,
        'Jurnal di-revert ke versi sebelumnya'
      );
      
      toast.success('Jurnal berhasil dikembalikan ke versi sebelumnya');
    }

    return result;
  };

  return {
    entries,
    loading,
    refetch: fetchEntries,
    getEntryWithLines,
    createEntry,
    updateEntry,
    deleteEntry,
    getAuditLogs,
    revertToVersion,
  };
};
