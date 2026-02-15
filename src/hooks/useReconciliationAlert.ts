import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Helper to extract journal number from notes
const getJournalNumber = (notes: string | null): string | null => {
  if (!notes) return null;
  const match = notes.match(/Jurnal:\s*(JRN-[\w-]+)/);
  return match ? match[1] : null;
};

export const useReconciliationAlert = () => {
  // Check reconciliation rate and create alert if below threshold
  const checkReconciliationRate = useCallback(async (threshold: number = 90): Promise<{
    rate: number;
    isAlert: boolean;
    transactionsWithoutJournal: number;
    totalApproved: number;
  }> => {
    try {
      // Fetch all approved transactions
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('id, notes')
        .eq('status', 'approved');

      if (error) throw error;

      const transactionsData = transactions || [];
      const withJournal = transactionsData.filter(t => getJournalNumber(t.notes));
      const withoutJournal = transactionsData.length - withJournal.length;
      
      const rate = transactionsData.length > 0 
        ? (withJournal.length / transactionsData.length) * 100 
        : 100;

      const isAlert = rate < threshold && withoutJournal > 0;

      return {
        rate,
        isAlert,
        transactionsWithoutJournal: withoutJournal,
        totalApproved: transactionsData.length,
      };
    } catch (error) {
      console.error('Error checking reconciliation rate:', error);
      return {
        rate: 100,
        isAlert: false,
        transactionsWithoutJournal: 0,
        totalApproved: 0,
      };
    }
  }, []);

  // Create admin notification for low reconciliation rate
  const createReconciliationAlert = useCallback(async (
    rate: number, 
    transactionsWithoutJournal: number
  ): Promise<boolean> => {
    try {
      // Check if there's already a recent unread alert for this
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: existingAlert } = await supabase
        .from('admin_notifications')
        .select('id')
        .eq('notification_type', 'reconciliation_alert')
        .eq('is_read', false)
        .gte('created_at', oneDayAgo.toISOString())
        .maybeSingle();

      // Don't create duplicate alerts
      if (existingAlert) {
        return false;
      }

      // Create the notification
      const { error } = await supabase
        .from('admin_notifications')
        .insert({
          title: 'Peringatan Rekonsiliasi Jurnal',
          message: `Tingkat rekonsiliasi jurnal saat ini ${rate.toFixed(1)}% (di bawah 90%). Ada ${transactionsWithoutJournal} transaksi yang belum memiliki jurnal otomatis. Silakan periksa dan buat jurnal untuk transaksi tersebut.`,
          notification_type: 'reconciliation_alert',
          metadata: {
            reconciliation_rate: rate,
            transactions_without_journal: transactionsWithoutJournal,
            alert_threshold: 90,
          },
        });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error creating reconciliation alert:', error);
      return false;
    }
  }, []);

  // Combined function to check and alert if needed
  const checkAndAlertIfNeeded = useCallback(async (threshold: number = 90): Promise<{
    rate: number;
    alertCreated: boolean;
  }> => {
    const result = await checkReconciliationRate(threshold);
    
    let alertCreated = false;
    if (result.isAlert) {
      alertCreated = await createReconciliationAlert(
        result.rate, 
        result.transactionsWithoutJournal
      );
    }

    return {
      rate: result.rate,
      alertCreated,
    };
  }, [checkReconciliationRate, createReconciliationAlert]);

  return {
    checkReconciliationRate,
    createReconciliationAlert,
    checkAndAlertIfNeeded,
  };
};
