import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SHUFundActivity {
  id: string;
  fund_type: 'pendidikan' | 'sosial' | 'pembangunan';
  title: string;
  description: string | null;
  amount: number;
  activity_date: string;
  status: 'planned' | 'ongoing' | 'completed';
  year: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// Map fund types to account codes
const FUND_ACCOUNT_CODES: Record<string, { debit: string; credit: string }> = {
  pendidikan: { debit: '5101', credit: '1101' }, // Beban Dana Pendidikan -> Kas
  sosial: { debit: '5102', credit: '1101' },     // Beban Dana Sosial -> Kas
  pembangunan: { debit: '5103', credit: '1101' }, // Beban Dana Pembangunan -> Kas
};

// Function to create journal entry for completed SHU fund activity
const createJournalForActivity = async (activity: SHUFundActivity): Promise<boolean> => {
  try {
    // Get the account IDs for the fund type
    const accountCodes = FUND_ACCOUNT_CODES[activity.fund_type];
    if (!accountCodes) {
      console.error('Unknown fund type:', activity.fund_type);
      return false;
    }

    // Fetch debit account (expense)
    const { data: debitAccount, error: debitError } = await supabase
      .from('chart_of_accounts')
      .select('id, account_name')
      .eq('account_code', accountCodes.debit)
      .eq('is_active', true)
      .maybeSingle();

    // Fetch credit account (kas/cash)
    const { data: creditAccount, error: creditError } = await supabase
      .from('chart_of_accounts')
      .select('id, account_name')
      .eq('account_code', accountCodes.credit)
      .eq('is_active', true)
      .maybeSingle();

    if (debitError || creditError) {
      console.error('Error fetching accounts:', debitError || creditError);
      return false;
    }

    // If accounts don't exist, skip journal creation (accounts need to be set up first)
    if (!debitAccount || !creditAccount) {
      console.warn('Akun pembukuan belum tersedia. Jurnal tidak dapat dibuat otomatis.');
      return false;
    }

    // Generate journal entry number
    const { data: entryNumber, error: rpcError } = await supabase.rpc('generate_journal_entry_number');
    if (rpcError) {
      console.error('Error generating entry number:', rpcError);
      return false;
    }

    // Create journal entry
    const fundTypeLabel = activity.fund_type === 'pendidikan' ? 'Pendidikan' : 
                          activity.fund_type === 'sosial' ? 'Sosial' : 'Pembangunan';
    
    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert([{
        entry_number: entryNumber,
        entry_date: activity.activity_date,
        description: `Pengeluaran Dana ${fundTypeLabel}: ${activity.title}`,
        reference_type: 'shu_fund_activity',
        reference_id: activity.id,
        total_debit: activity.amount,
        total_credit: activity.amount,
        is_balanced: true,
        status: 'posted',
      }])
      .select()
      .single();

    if (entryError) {
      console.error('Error creating journal entry:', entryError);
      return false;
    }

    // Create journal entry lines
    const lines = [
      {
        journal_entry_id: entry.id,
        account_id: debitAccount.id,
        description: `Beban Dana ${fundTypeLabel} - ${activity.title}`,
        debit_amount: activity.amount,
        credit_amount: 0,
      },
      {
        journal_entry_id: entry.id,
        account_id: creditAccount.id,
        description: `Pembayaran Dana ${fundTypeLabel} - ${activity.title}`,
        debit_amount: 0,
        credit_amount: activity.amount,
      },
    ];

    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(lines);

    if (linesError) {
      // Rollback - delete the entry
      await supabase.from('journal_entries').delete().eq('id', entry.id);
      console.error('Error creating journal entry lines:', linesError);
      return false;
    }

    // Update account balances
    // Debit account (expense) increases
    const { data: debitBalance } = await supabase
      .from('chart_of_accounts')
      .select('balance')
      .eq('id', debitAccount.id)
      .single();
    
    if (debitBalance) {
      await supabase
        .from('chart_of_accounts')
        .update({ balance: debitBalance.balance + activity.amount })
        .eq('id', debitAccount.id);
    }

    // Credit account (asset/kas) decreases
    const { data: creditBalance } = await supabase
      .from('chart_of_accounts')
      .select('balance')
      .eq('id', creditAccount.id)
      .single();
    
    if (creditBalance) {
      await supabase
        .from('chart_of_accounts')
        .update({ balance: creditBalance.balance - activity.amount })
        .eq('id', creditAccount.id);
    }

    return true;
  } catch (error) {
    console.error('Error creating journal for activity:', error);
    return false;
  }
};

export function useSHUFundActivities(year?: number) {
  const [activities, setActivities] = useState<SHUFundActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('shu_fund_activities')
        .select('*')
        .order('activity_date', { ascending: false });
      
      if (year) {
        query = query.eq('year', year);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setActivities(data as SHUFundActivity[] || []);
    } catch (error) {
      console.error('Error fetching SHU fund activities:', error);
      toast.error('Gagal memuat data kegiatan Dana SHU');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const addActivity = async (activity: Omit<SHUFundActivity, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('shu_fund_activities')
        .insert({
          ...activity,
          created_by: user?.id || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newActivity = data as SHUFundActivity;
      
      // If status is completed, create journal entry
      if (newActivity.status === 'completed') {
        const journalCreated = await createJournalForActivity(newActivity);
        if (journalCreated) {
          toast.success('Kegiatan & jurnal otomatis berhasil dibuat');
        }
      }
      
      await fetchActivities();
      return newActivity;
    } catch (error) {
      console.error('Error adding activity:', error);
      toast.error('Gagal menambahkan kegiatan');
      throw error;
    }
  };

  const updateActivity = async (id: string, updates: Partial<Omit<SHUFundActivity, 'id' | 'created_at' | 'updated_at' | 'created_by'>>) => {
    try {
      // Get current activity to check status change
      const currentActivity = activities.find(a => a.id === id);
      const wasCompleted = currentActivity?.status === 'completed';
      const willBeCompleted = updates.status === 'completed';
      
      const { error } = await supabase
        .from('shu_fund_activities')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      
      // If status changed to completed, create journal entry
      if (!wasCompleted && willBeCompleted && currentActivity) {
        const updatedActivity: SHUFundActivity = {
          ...currentActivity,
          ...updates,
        };
        const journalCreated = await createJournalForActivity(updatedActivity);
        if (journalCreated) {
          toast.success('Jurnal otomatis berhasil dibuat');
        }
      }
      
      await fetchActivities();
      return true;
    } catch (error) {
      console.error('Error updating activity:', error);
      toast.error('Gagal memperbarui kegiatan');
      throw error;
    }
  };

  const deleteActivity = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shu_fund_activities')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      await fetchActivities();
      return true;
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast.error('Gagal menghapus kegiatan');
      throw error;
    }
  };

  // Get totals by fund type
  const getTotalByType = (type: 'pendidikan' | 'sosial' | 'pembangunan', statusFilter?: 'completed') => {
    return activities
      .filter(a => a.fund_type === type && (statusFilter ? a.status === statusFilter : true))
      .reduce((sum, a) => sum + a.amount, 0);
  };

  // Get completed activities total (for balance sheet deductions)
  const getCompletedTotals = () => ({
    pendidikan: getTotalByType('pendidikan', 'completed'),
    sosial: getTotalByType('sosial', 'completed'),
    pembangunan: getTotalByType('pembangunan', 'completed'),
  });

  return { 
    activities, 
    loading, 
    addActivity, 
    updateActivity, 
    deleteActivity, 
    refetch: fetchActivities,
    getTotalByType,
    getCompletedTotals
  };
}
