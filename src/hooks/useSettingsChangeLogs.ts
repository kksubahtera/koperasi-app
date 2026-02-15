import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SettingsChangeLog {
  id: string;
  setting_key: string;
  old_value: any;
  new_value: any;
  application_mode: 'prospective' | 'retroactive';
  effective_from: string;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
}

export function useSettingsChangeLogs(settingKey?: string) {
  const [logs, setLogs] = useState<SettingsChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('settings_change_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (settingKey) {
        query = query.eq('setting_key', settingKey);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setLogs((data || []) as SettingsChangeLog[]);
    } catch (error) {
      console.error('Error fetching settings change logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLog = async (
    key: string,
    oldValue: any,
    newValue: any,
    applicationMode: 'prospective' | 'retroactive' = 'prospective',
    changeReason?: string
  ) => {
    try {
      const { error } = await supabase
        .from('settings_change_logs')
        .insert({
          setting_key: key,
          old_value: oldValue,
          new_value: newValue,
          application_mode: applicationMode,
          change_reason: changeReason,
          changed_by: user?.id || null,
        });

      if (error) throw error;
      await fetchLogs();
      return true;
    } catch (error) {
      console.error('Error adding settings change log:', error);
      toast.error('Gagal menyimpan log perubahan');
      return false;
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [settingKey]);

  return {
    logs,
    loading,
    addLog,
    refetch: fetchLogs,
  };
}

// Hook to save cooperative settings to database with change logging
export function useCooperativeSettingsDB() {
  const { user } = useAuth();
  const { addLog } = useSettingsChangeLogs();

  const saveSettingWithLog = async (
    key: string,
    value: any,
    oldValue: any,
    applicationMode: 'prospective' | 'retroactive' = 'prospective',
    changeReason?: string
  ) => {
    try {
      // Save to cooperative_settings table
      const { error: settingsError } = await supabase
        .from('cooperative_settings')
        .upsert({
          key,
          value,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        });

      if (settingsError) throw settingsError;

      // Log the change
      await addLog(key, oldValue, value, applicationMode, changeReason);

      return true;
    } catch (error) {
      console.error('Error saving setting:', error);
      toast.error('Gagal menyimpan pengaturan');
      return false;
    }
  };

  const getSettings = async (keys: string[]) => {
    try {
      const { data, error } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', keys);

      if (error) throw error;

      const result: Record<string, any> = {};
      data?.forEach((item) => {
        result[item.key] = item.value;
      });

      return result;
    } catch (error) {
      console.error('Error fetching settings:', error);
      return {};
    }
  };

  return {
    saveSettingWithLog,
    getSettings,
  };
}

// Hook to fetch critical financial settings for calculations
export function useCriticalSettings() {
  const [settings, setSettings] = useState<{
    interestRate: number;
    simpananSukarelaInterestRate: number;
    latePaymentPenalty: number;
    latePaymentPenaltyType: 'daily' | 'monthly';
    latePaymentPenaltyBase: 'remaining_installment' | 'remaining_principal';
    penaltyGracePeriodDays: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('cooperative_settings')
          .select('key, value')
          .in('key', [
            'interestRate',
            'simpananSukarelaInterestRate',
            'latePaymentPenalty',
            'latePaymentPenaltyType',
            'latePaymentPenaltyBase',
            'penaltyGracePeriodDays'
          ]);

        if (error) throw error;

        // If no data in DB, fall back to localStorage/defaults
        if (!data || data.length === 0) {
          const localSettings = JSON.parse(localStorage.getItem('cooperativeSettings') || '{}');
          setSettings({
            interestRate: localSettings.interestRate ?? 1.5,
            simpananSukarelaInterestRate: localSettings.simpananSukarelaInterestRate ?? 0.4,
            latePaymentPenalty: localSettings.latePaymentPenalty ?? 0.5,
            latePaymentPenaltyType: localSettings.latePaymentPenaltyType ?? 'daily',
            latePaymentPenaltyBase: localSettings.latePaymentPenaltyBase ?? 'remaining_installment',
            penaltyGracePeriodDays: localSettings.penaltyGracePeriodDays ?? 0,
          });
        } else {
          const dbSettings: Record<string, any> = {};
          data.forEach((item) => {
            dbSettings[item.key] = item.value;
          });

          // Merge with localStorage defaults
          const localSettings = JSON.parse(localStorage.getItem('cooperativeSettings') || '{}');
          setSettings({
            interestRate: dbSettings.interestRate ?? localSettings.interestRate ?? 1.5,
            simpananSukarelaInterestRate: dbSettings.simpananSukarelaInterestRate ?? localSettings.simpananSukarelaInterestRate ?? 0.4,
            latePaymentPenalty: dbSettings.latePaymentPenalty ?? localSettings.latePaymentPenalty ?? 0.5,
            latePaymentPenaltyType: dbSettings.latePaymentPenaltyType ?? localSettings.latePaymentPenaltyType ?? 'daily',
            latePaymentPenaltyBase: dbSettings.latePaymentPenaltyBase ?? localSettings.latePaymentPenaltyBase ?? 'remaining_installment',
            penaltyGracePeriodDays: dbSettings.penaltyGracePeriodDays ?? localSettings.penaltyGracePeriodDays ?? 0,
          });
        }
      } catch (error) {
        console.error('Error fetching critical settings:', error);
        // Fall back to localStorage on error
        const localSettings = JSON.parse(localStorage.getItem('cooperativeSettings') || '{}');
        setSettings({
          interestRate: localSettings.interestRate ?? 1.5,
          simpananSukarelaInterestRate: localSettings.simpananSukarelaInterestRate ?? 0.4,
          latePaymentPenalty: localSettings.latePaymentPenalty ?? 0.5,
          latePaymentPenaltyType: localSettings.latePaymentPenaltyType ?? 'daily',
          latePaymentPenaltyBase: localSettings.latePaymentPenaltyBase ?? 'remaining_installment',
          penaltyGracePeriodDays: localSettings.penaltyGracePeriodDays ?? 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, loading };
}
