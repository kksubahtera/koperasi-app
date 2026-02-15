import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RolloverData {
  fromYear: number;
  toYear: number;
  danaCadangan: number;
  danaPendidikan: number;
  danaSosial: number;
  danaPembangunan: number;
  shuWithheld: number;
  withheldMembersCount: number;
  totalAmount: number;
}

export interface RolloverHistory {
  id: string;
  from_year: number;
  to_year: number;
  dana_cadangan_rollover: number;
  dana_pendidikan_rollover: number;
  dana_sosial_rollover: number;
  dana_pembangunan_rollover: number;
  shu_withheld_rollover: number;
  withheld_members_count: number;
  total_rollover_amount: number;
  journal_entry_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export function useSHURollover() {
  const [loading, setLoading] = useState(false);

  // Get rollover data from a specific year
  const getRolloverData = useCallback(async (fromYear: number): Promise<RolloverData | null> => {
    try {
      setLoading(true);

      // Get SHU distribution data for the year
      const { data: shuDist, error: shuError } = await supabase
        .from('shu_distributions')
        .select('*')
        .eq('year', fromYear)
        .eq('status', 'confirmed')
        .maybeSingle();

      if (shuError) throw shuError;

      // Get withheld SHU count and total
      const { data: withheldData, error: withheldError } = await supabase
        .from('shu_withheld')
        .select('id, shu_amount')
        .eq('year', fromYear)
        .eq('status', 'withheld');

      if (withheldError) throw withheldError;

      const withheldTotal = withheldData?.reduce((sum, item) => sum + Number(item.shu_amount), 0) || 0;
      const withheldCount = withheldData?.length || 0;

      // Calculate fund balances from SHU distribution
      const danaCadangan = shuDist?.dana_cadangan || 0;
      const danaPendidikan = shuDist?.dana_pendidikan || 0;
      const danaSosial = shuDist?.dana_sosial || 0;
      const danaPembangunan = shuDist?.dana_pembangunan || 0;

      const totalAmount = danaCadangan + danaPendidikan + danaSosial + danaPembangunan + withheldTotal;

      return {
        fromYear,
        toYear: fromYear + 1,
        danaCadangan,
        danaPendidikan,
        danaSosial,
        danaPembangunan,
        shuWithheld: withheldTotal,
        withheldMembersCount: withheldCount,
        totalAmount
      };
    } catch (error) {
      console.error('Error getting rollover data:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if rollover already exists for a year
  const checkRolloverExists = useCallback(async (fromYear: number, toYear: number): Promise<boolean> => {
    const { data, error } = await supabase
      .from('shu_rollover_history')
      .select('id')
      .eq('from_year', fromYear)
      .eq('to_year', toYear)
      .maybeSingle();

    if (error) {
      console.error('Error checking rollover:', error);
      return false;
    }

    return !!data;
  }, []);

  // Get rollover history
  const getRolloverHistory = useCallback(async (): Promise<RolloverHistory[]> => {
    const { data, error } = await supabase
      .from('shu_rollover_history')
      .select('*')
      .order('from_year', { ascending: false });

    if (error) {
      console.error('Error fetching rollover history:', error);
      return [];
    }

    return data || [];
  }, []);

  // Create rollover journal entry
  const createRolloverJournal = useCallback(async (
    rolloverData: RolloverData,
    userId: string
  ): Promise<string | null> => {
    try {
      // Generate journal entry number
      const { data: entryNumber } = await supabase.rpc('generate_journal_entry_number');

      // Create journal entry
      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: `${rolloverData.toYear}-01-01`,
          description: `Saldo Awal - Rollover SHU dari Tahun ${rolloverData.fromYear}`,
          status: 'approved',
          total_debit: rolloverData.totalAmount,
          total_credit: rolloverData.totalAmount,
          is_balanced: true,
          reference_type: 'rollover',
          created_by: userId,
          approved_by: userId,
          approved_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (journalError) throw journalError;

      // Get chart of accounts for journal lines
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('id, account_code, account_name')
        .in('account_code', ['3-1010', '3-1020', '3-1030', '3-1040', '2-3050', '3-0000']);

      if (!accounts || accounts.length === 0) {
        console.warn('Required accounts not found for rollover journal');
        return journalEntry.id;
      }

      const accountMap = accounts.reduce((map, acc) => {
        map[acc.account_code] = acc.id;
        return map;
      }, {} as Record<string, string>);

      const journalLines = [];

      // Debit entries (moving balances forward)
      if (rolloverData.danaCadangan > 0 && accountMap['3-1010']) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: accountMap['3-1010'],
          debit_amount: rolloverData.danaCadangan,
          credit_amount: 0,
          description: 'Rollover Dana Cadangan'
        });
      }

      if (rolloverData.danaPendidikan > 0 && accountMap['3-1020']) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: accountMap['3-1020'],
          debit_amount: rolloverData.danaPendidikan,
          credit_amount: 0,
          description: 'Rollover Dana Pendidikan'
        });
      }

      if (rolloverData.danaSosial > 0 && accountMap['3-1030']) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: accountMap['3-1030'],
          debit_amount: rolloverData.danaSosial,
          credit_amount: 0,
          description: 'Rollover Dana Sosial'
        });
      }

      if (rolloverData.danaPembangunan > 0 && accountMap['3-1040']) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: accountMap['3-1040'],
          debit_amount: rolloverData.danaPembangunan,
          credit_amount: 0,
          description: 'Rollover Dana Pembangunan'
        });
      }

      if (rolloverData.shuWithheld > 0 && accountMap['2-3050']) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: accountMap['2-3050'],
          debit_amount: rolloverData.shuWithheld,
          credit_amount: 0,
          description: `Rollover SHU Ditahan (${rolloverData.withheldMembersCount} anggota)`
        });
      }

      // Credit entry (opening balance)
      if (accountMap['3-0000'] && rolloverData.totalAmount > 0) {
        journalLines.push({
          journal_entry_id: journalEntry.id,
          account_id: accountMap['3-0000'],
          debit_amount: 0,
          credit_amount: rolloverData.totalAmount,
          description: 'Saldo Awal Rollover'
        });
      }

      if (journalLines.length > 0) {
        const { error: linesError } = await supabase
          .from('journal_entry_lines')
          .insert(journalLines);

        if (linesError) {
          console.error('Error creating journal lines:', linesError);
        }
      }

      return journalEntry.id;
    } catch (error) {
      console.error('Error creating rollover journal:', error);
      return null;
    }
  }, []);

  // Execute the rollover process
  const executeRollover = useCallback(async (
    fromYear: number,
    userId: string,
    notes?: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      const toYear = fromYear + 1;

      // Check if rollover already exists
      const exists = await checkRolloverExists(fromYear, toYear);
      if (exists) {
        toast.error(`Rollover dari tahun ${fromYear} ke ${toYear} sudah dilakukan`);
        return false;
      }

      // Get rollover data
      const rolloverData = await getRolloverData(fromYear);
      if (!rolloverData) {
        toast.error('Gagal mengambil data rollover');
        return false;
      }

      if (rolloverData.totalAmount === 0) {
        toast.warning('Tidak ada saldo yang perlu di-rollover');
        return false;
      }

      // Create rollover journal
      const journalId = await createRolloverJournal(rolloverData, userId);

      // Insert rollover history record
      const { error: historyError } = await supabase
        .from('shu_rollover_history')
        .insert({
          from_year: fromYear,
          to_year: toYear,
          dana_cadangan_rollover: rolloverData.danaCadangan,
          dana_pendidikan_rollover: rolloverData.danaPendidikan,
          dana_sosial_rollover: rolloverData.danaSosial,
          dana_pembangunan_rollover: rolloverData.danaPembangunan,
          shu_withheld_rollover: rolloverData.shuWithheld,
          withheld_members_count: rolloverData.withheldMembersCount,
          total_rollover_amount: rolloverData.totalAmount,
          journal_entry_id: journalId,
          status: 'completed',
          notes,
          created_by: userId
        });

      if (historyError) throw historyError;

      // Update or create balance sheet for next year with opening balances
      const { data: existingSheet } = await supabase
        .from('balance_sheets')
        .select('id')
        .eq('year', toYear)
        .maybeSingle();

      if (existingSheet) {
        // Update existing balance sheet
        const { error: updateError } = await supabase
          .from('balance_sheets')
          .update({
            rolled_from_year: fromYear,
            rollover_date: new Date().toISOString(),
            rolled_by: userId,
            shu_withheld_balance: rolloverData.shuWithheld,
            rollover_journal_id: journalId,
            saldo_awal_dana_cadangan: rolloverData.danaCadangan,
            saldo_awal_dana_pendidikan: rolloverData.danaPendidikan,
            saldo_awal_dana_sosial: rolloverData.danaSosial,
            saldo_awal_dana_pembangunan: rolloverData.danaPembangunan
          })
          .eq('id', existingSheet.id);

        if (updateError) throw updateError;
      } else {
        // Create new balance sheet with opening balances
        const { error: insertError } = await supabase
          .from('balance_sheets')
          .insert({
            year: toYear,
            rolled_from_year: fromYear,
            rollover_date: new Date().toISOString(),
            rolled_by: userId,
            shu_withheld_balance: rolloverData.shuWithheld,
            rollover_journal_id: journalId,
            saldo_awal_dana_cadangan: rolloverData.danaCadangan,
            saldo_awal_dana_pendidikan: rolloverData.danaPendidikan,
            saldo_awal_dana_sosial: rolloverData.danaSosial,
            saldo_awal_dana_pembangunan: rolloverData.danaPembangunan,
            dana_cadangan: rolloverData.danaCadangan,
            dana_pendidikan: rolloverData.danaPendidikan,
            dana_sosial: rolloverData.danaSosial,
            dana_pembangunan: rolloverData.danaPembangunan
          });

        if (insertError) throw insertError;
      }

      // Create admin notification
      await supabase
        .from('admin_notifications')
        .insert({
          title: 'Rollover SHU Berhasil',
          message: `Rollover saldo SHU dari tahun ${fromYear} ke ${toYear} telah berhasil. Total: Rp ${rolloverData.totalAmount.toLocaleString('id-ID')}`,
          notification_type: 'shu_rollover',
          metadata: {
            from_year: fromYear,
            to_year: toYear,
            total_amount: rolloverData.totalAmount,
            withheld_count: rolloverData.withheldMembersCount
          }
        });

      toast.success(`Rollover SHU dari tahun ${fromYear} ke ${toYear} berhasil`);
      return true;
    } catch (error) {
      console.error('Error executing rollover:', error);
      toast.error('Gagal melakukan rollover SHU');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getRolloverData, checkRolloverExists, createRolloverJournal]);

  // Get opening balances for a specific year (from rollover)
  const getOpeningBalances = useCallback(async (year: number) => {
    const { data, error } = await supabase
      .from('shu_rollover_history')
      .select('*')
      .eq('to_year', year)
      .maybeSingle();

    if (error) {
      console.error('Error fetching opening balances:', error);
      return null;
    }

    return data;
  }, []);

  return {
    loading,
    getRolloverData,
    checkRolloverExists,
    getRolloverHistory,
    executeRollover,
    getOpeningBalances,
    createRolloverJournal
  };
}
