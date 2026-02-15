import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  CooperativeSettings, 
  defaultCooperativeSettings,
  getCooperativeSettings,
  saveCooperativeSettings
} from '@/lib/cooperativeSettings';
import { SyncStatus } from '@/components/shared/SyncStatusIndicator';

interface PendingChange {
  settings: CooperativeSettings;
  timestamp: Date;
}

interface UseCooperativeSettingsSyncResult {
  settings: CooperativeSettings;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  lastSyncTime: Date | null;
  pendingChanges: PendingChange | null;
  isOnline: boolean;
  retryCount: number;
  saveSettings: (newSettings: CooperativeSettings) => Promise<boolean>;
  refreshSettings: () => Promise<void>;
  retrySync: () => Promise<boolean>;
}

// Keys that will be stored in database
const DB_KEYS = [
  'cooperative_name',
  'cooperative_legal_number',
  'cooperative_address',
  'cooperative_founded_date',
  'cooperative_copyright_year',
  'cooperative_logo_base64',
  'cooperative_banner_base64',
  'cooperative_vision',
  'cooperative_mission',
  'cooperative_services',
  'cooperative_interest_rate',
  'cooperative_interest_calculation_method',
  'cooperative_tenor_min',
  'cooperative_tenor_max',
  'cooperative_min_loan_amount',
  'cooperative_max_loan_amount',
  'cooperative_max_loan_multiplier',
  'cooperative_late_payment_penalty',
  'cooperative_late_payment_penalty_type',
  'cooperative_late_payment_penalty_base',
  'cooperative_penalty_grace_period_days',
  'cooperative_installment_due_days',
  'cooperative_early_payoff_enabled',
  'cooperative_early_payoff_requires_approval',
  'cooperative_early_payoff_fee_type',
  'cooperative_early_payoff_fee_amount',
  'cooperative_require_simpanan_pokok',
  'cooperative_require_min_simpanan_wajib',
  'cooperative_min_simpanan_wajib_for_loan',
  'simpanan_pokok',
  'simpanan_wajib',
  'cooperative_simpanan_sukarela_min',
  'cooperative_simpanan_wajib_due_date',
  'cooperative_withdrawal_process_days',
  'cooperative_simpanan_sukarela_interest_rate',
  'cooperative_simpanan_sukarela_interest_cutoff',
  'cooperative_simpanan_sukarela_interest_method',
  'cooperative_simpanan_sukarela_closing_date',
  'cooperative_simpanan_sukarela_min_holding_months',
  'cooperative_ad_art_content',
  'cooperative_ad_content',
  'cooperative_art_content',
  'cooperative_shu_distribution',
  'cooperative_signature_base64',
  'cooperative_stamp_base64',
  'cooperative_chairman_name',
  'cooperative_signatories',
  'cooperative_member_number_format',
];

// Map settings object to database keys
const mapSettingsToDBKeys = (settings: CooperativeSettings): Record<string, any> => ({
  cooperative_name: settings.name,
  cooperative_legal_number: settings.legalNumber,
  cooperative_address: settings.address,
  cooperative_founded_date: settings.foundedDate,
  cooperative_copyright_year: settings.copyrightYear,
  cooperative_logo_base64: settings.logoBase64,
  cooperative_banner_base64: settings.bannerBase64,
  cooperative_vision: settings.vision,
  cooperative_mission: settings.mission,
  cooperative_services: settings.services,
  cooperative_interest_rate: settings.interestRate,
  cooperative_interest_calculation_method: settings.interestCalculationMethod,
  cooperative_tenor_min: settings.tenorMin,
  cooperative_tenor_max: settings.tenorMax,
  cooperative_min_loan_amount: settings.minLoanAmount,
  cooperative_max_loan_amount: settings.maxLoanAmount,
  cooperative_max_loan_multiplier: settings.maxLoanMultiplier,
  cooperative_late_payment_penalty: settings.latePaymentPenalty,
  cooperative_late_payment_penalty_type: settings.latePaymentPenaltyType,
  cooperative_late_payment_penalty_base: settings.latePaymentPenaltyBase,
  cooperative_penalty_grace_period_days: settings.penaltyGracePeriodDays,
  cooperative_installment_due_days: settings.installmentDueDaysAfterDisbursement,
  cooperative_early_payoff_enabled: settings.earlyPayoffEnabled,
  cooperative_early_payoff_requires_approval: settings.earlyPayoffRequiresApproval,
  cooperative_early_payoff_fee_type: settings.earlyPayoffFeeType,
  cooperative_early_payoff_fee_amount: settings.earlyPayoffFeeAmount,
  cooperative_require_simpanan_pokok: settings.requireSimpananPokokForLoan,
  cooperative_require_min_simpanan_wajib: settings.requireMinSimpananWajibForLoan,
  cooperative_min_simpanan_wajib_for_loan: settings.minSimpananWajibForLoan,
  simpanan_pokok: settings.simpananPokok,
  simpanan_wajib: settings.simpananWajib,
  cooperative_simpanan_sukarela_min: settings.simpananSukarelaMin,
  cooperative_simpanan_wajib_due_date: settings.simpananWajibDueDate,
  cooperative_withdrawal_process_days: settings.withdrawalProcessDays,
  cooperative_simpanan_sukarela_interest_rate: settings.simpananSukarelaInterestRate,
  cooperative_simpanan_sukarela_interest_cutoff: settings.simpananSukarelaInterestCutoffDate,
  cooperative_simpanan_sukarela_interest_method: settings.simpananSukarelaInterestMethod,
  cooperative_simpanan_sukarela_closing_date: settings.simpananSukarelaClosingDate,
  cooperative_simpanan_sukarela_min_holding_months: settings.simpananSukarelaMinHoldingMonths,
  cooperative_ad_art_content: settings.adArtContent,
  cooperative_ad_content: settings.adContent,
  cooperative_art_content: settings.artContent,
  cooperative_shu_distribution: settings.shuDistribution,
  cooperative_signature_base64: settings.signatureBase64,
  cooperative_stamp_base64: settings.stampBase64,
  cooperative_chairman_name: settings.chairmanName,
  cooperative_signatories: settings.signatories,
  cooperative_member_number_format: settings.memberNumberFormat,
});

// Map database keys to settings object
const mapDBKeysToSettings = (dbData: Record<string, any>, fallback: CooperativeSettings): CooperativeSettings => ({
  name: dbData.cooperative_name ?? fallback.name,
  legalNumber: dbData.cooperative_legal_number ?? fallback.legalNumber,
  address: dbData.cooperative_address ?? fallback.address,
  foundedDate: dbData.cooperative_founded_date ?? fallback.foundedDate,
  copyrightYear: dbData.cooperative_copyright_year ?? fallback.copyrightYear,
  logoUrl: fallback.logoUrl,
  logoBase64: dbData.cooperative_logo_base64 ?? fallback.logoBase64,
  bannerBase64: dbData.cooperative_banner_base64 ?? fallback.bannerBase64,
  signatureBase64: dbData.cooperative_signature_base64 ?? fallback.signatureBase64,
  stampBase64: dbData.cooperative_stamp_base64 ?? fallback.stampBase64,
  chairmanName: dbData.cooperative_chairman_name ?? fallback.chairmanName,
  signatories: dbData.cooperative_signatories ?? fallback.signatories,
  memberNumberFormat: dbData.cooperative_member_number_format ?? fallback.memberNumberFormat,
  vision: dbData.cooperative_vision ?? fallback.vision,
  mission: dbData.cooperative_mission ?? fallback.mission,
  services: dbData.cooperative_services ?? fallback.services,
  interestRate: dbData.cooperative_interest_rate ?? fallback.interestRate,
  interestCalculationMethod: dbData.cooperative_interest_calculation_method ?? fallback.interestCalculationMethod,
  tenorMin: dbData.cooperative_tenor_min ?? fallback.tenorMin,
  tenorMax: dbData.cooperative_tenor_max ?? fallback.tenorMax,
  minLoanAmount: dbData.cooperative_min_loan_amount ?? fallback.minLoanAmount,
  maxLoanAmount: dbData.cooperative_max_loan_amount ?? fallback.maxLoanAmount,
  maxLoanMultiplier: dbData.cooperative_max_loan_multiplier ?? fallback.maxLoanMultiplier,
  latePaymentPenalty: dbData.cooperative_late_payment_penalty ?? fallback.latePaymentPenalty,
  latePaymentPenaltyType: dbData.cooperative_late_payment_penalty_type ?? fallback.latePaymentPenaltyType,
  latePaymentPenaltyBase: dbData.cooperative_late_payment_penalty_base ?? fallback.latePaymentPenaltyBase,
  penaltyGracePeriodDays: dbData.cooperative_penalty_grace_period_days ?? fallback.penaltyGracePeriodDays,
  installmentDueDaysAfterDisbursement: dbData.cooperative_installment_due_days ?? fallback.installmentDueDaysAfterDisbursement,
  earlyPayoffEnabled: dbData.cooperative_early_payoff_enabled ?? fallback.earlyPayoffEnabled,
  earlyPayoffRequiresApproval: dbData.cooperative_early_payoff_requires_approval ?? fallback.earlyPayoffRequiresApproval,
  earlyPayoffFeeType: dbData.cooperative_early_payoff_fee_type ?? fallback.earlyPayoffFeeType,
  earlyPayoffFeeAmount: dbData.cooperative_early_payoff_fee_amount ?? fallback.earlyPayoffFeeAmount,
  requireSimpananPokokForLoan: dbData.cooperative_require_simpanan_pokok ?? fallback.requireSimpananPokokForLoan,
  requireMinSimpananWajibForLoan: dbData.cooperative_require_min_simpanan_wajib ?? fallback.requireMinSimpananWajibForLoan,
  minSimpananWajibForLoan: dbData.cooperative_min_simpanan_wajib_for_loan ?? fallback.minSimpananWajibForLoan,
  simpananPokok: dbData.simpanan_pokok ?? fallback.simpananPokok,
  simpananWajib: dbData.simpanan_wajib ?? fallback.simpananWajib,
  simpananSukarelaMin: dbData.cooperative_simpanan_sukarela_min ?? fallback.simpananSukarelaMin,
  simpananWajibDueDate: dbData.cooperative_simpanan_wajib_due_date ?? fallback.simpananWajibDueDate,
  withdrawalProcessDays: dbData.cooperative_withdrawal_process_days ?? fallback.withdrawalProcessDays,
  simpananSukarelaInterestRate: dbData.cooperative_simpanan_sukarela_interest_rate ?? fallback.simpananSukarelaInterestRate,
  simpananSukarelaInterestCutoffDate: dbData.cooperative_simpanan_sukarela_interest_cutoff ?? fallback.simpananSukarelaInterestCutoffDate,
  simpananSukarelaInterestMethod: dbData.cooperative_simpanan_sukarela_interest_method ?? fallback.simpananSukarelaInterestMethod,
  simpananSukarelaClosingDate: dbData.cooperative_simpanan_sukarela_closing_date ?? fallback.simpananSukarelaClosingDate,
  simpananSukarelaMinHoldingMonths: dbData.cooperative_simpanan_sukarela_min_holding_months ?? fallback.simpananSukarelaMinHoldingMonths,
  adArtContent: dbData.cooperative_ad_art_content ?? fallback.adArtContent,
  adContent: dbData.cooperative_ad_content ?? fallback.adContent,
  artContent: dbData.cooperative_art_content ?? fallback.artContent,
  shuDistribution: dbData.cooperative_shu_distribution ?? fallback.shuDistribution,
});

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_INTERVALS = [3000, 10000, 30000]; // 3s, 10s, 30s
const PENDING_CHANGES_KEY = 'cooperative_settings_pending_changes';

// Helper functions for localStorage persistence
const savePendingToStorage = (pending: PendingChange | null) => {
  try {
    if (pending) {
      localStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify({
        settings: pending.settings,
        timestamp: pending.timestamp.toISOString(),
      }));
    } else {
      localStorage.removeItem(PENDING_CHANGES_KEY);
    }
  } catch (err) {
    console.error('Error saving pending changes to localStorage:', err);
  }
};

const loadPendingFromStorage = (): PendingChange | null => {
  try {
    const stored = localStorage.getItem(PENDING_CHANGES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        settings: parsed.settings,
        timestamp: new Date(parsed.timestamp),
      };
    }
  } catch (err) {
    console.error('Error loading pending changes from localStorage:', err);
  }
  return null;
};

export const useCooperativeSettingsSync = (): UseCooperativeSettingsSyncResult => {
  const [settings, setSettings] = useState<CooperativeSettings>(getCooperativeSettings());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    // Check if there are pending changes on init
    const stored = loadPendingFromStorage();
    return stored ? 'pending' : 'synced';
  });
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange | null>(() => {
    // Initialize from localStorage
    const stored = loadPendingFromStorage();
    return stored;
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [retryCount, setRetryCount] = useState(0);
  
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRetryingRef = useRef(false);
  const pendingChangesRef = useRef<PendingChange | null>(null);

  // Keep ref in sync with state and persist to localStorage
  useEffect(() => {
    pendingChangesRef.current = pendingChanges;
    savePendingToStorage(pendingChanges);
    
    // Update sync status based on pending changes
    if (pendingChanges && syncStatus === 'synced') {
      setSyncStatus('pending');
    }
  }, [pendingChanges]);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', DB_KEYS);

      if (fetchError) {
        console.error('Error fetching cooperative settings:', fetchError);
        setSettings(getCooperativeSettings());
        setError(fetchError.message);
        setSyncStatus('offline');
        return;
      }

      if (data && data.length > 0) {
        const dbData: Record<string, any> = {};
        data.forEach(row => {
          try {
            if (typeof row.value === 'string') {
              try {
                dbData[row.key] = JSON.parse(row.value);
              } catch {
                dbData[row.key] = row.value;
              }
            } else {
              dbData[row.key] = row.value;
            }
          } catch {
            dbData[row.key] = row.value;
          }
        });

        const localSettings = getCooperativeSettings();
        const mergedSettings = mapDBKeysToSettings(dbData, localSettings);
        setSettings(mergedSettings);
        saveCooperativeSettings(mergedSettings);
        setSyncStatus('synced');
        setLastSyncTime(new Date());
      } else {
        setSettings(getCooperativeSettings());
        setSyncStatus('synced');
      }
    } catch (err) {
      console.error('Error in fetchSettings:', err);
      setSettings(getCooperativeSettings());
      setError('Failed to load settings');
      setSyncStatus('offline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const performSync = useCallback(async (settingsToSync: CooperativeSettings): Promise<boolean> => {
    try {
      const dbData = mapSettingsToDBKeys(settingsToSync);
      
      // Filter out null/undefined values and ensure all values are non-null
      const upsertData = Object.entries(dbData)
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key, value]) => ({
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : value,
          updated_at: new Date().toISOString(),
        }));

      if (upsertData.length === 0) {
        console.warn('No valid settings to sync');
        return true;
      }

      const { error: upsertError } = await supabase
        .from('cooperative_settings')
        .upsert(upsertData, { onConflict: 'key' });

      if (upsertError) {
        throw upsertError;
      }

      return true;
    } catch (err) {
      console.error('Sync error:', err);
      throw err;
    }
  }, []);

  const scheduleRetry = useCallback((attempt: number) => {
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      console.log('Max retry attempts reached');
      return;
    }

    const delay = RETRY_INTERVALS[attempt] || RETRY_INTERVALS[RETRY_INTERVALS.length - 1];
    console.log(`Scheduling retry attempt ${attempt + 1} in ${delay}ms`);

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    retryTimeoutRef.current = setTimeout(async () => {
      if (!pendingChangesRef.current || isRetryingRef.current || !navigator.onLine) {
        return;
      }

      isRetryingRef.current = true;
      setSyncStatus('syncing');

      try {
        await performSync(pendingChangesRef.current.settings);
        
        // Success
        setPendingChanges(null);
        setSyncStatus('synced');
        setLastSyncTime(new Date());
        setRetryCount(0);
        setError(null);
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('cooperative-settings-updated', { 
          detail: pendingChangesRef.current.settings 
        }));
        window.dispatchEvent(new CustomEvent('sync-success'));
        
        console.log('Auto-retry successful');
      } catch (err: any) {
        console.error('Auto-retry failed:', err);
        setSyncStatus('error');
        setError(err.message || 'Auto-retry failed');
        setRetryCount(attempt + 1);
        
        // Schedule next retry
        scheduleRetry(attempt + 1);
      } finally {
        isRetryingRef.current = false;
      }
    }, delay);
  }, [performSync]);

  const saveSettings = useCallback(async (newSettings: CooperativeSettings): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    setSyncStatus('syncing');
    setRetryCount(0);

    // Always save to localStorage first
    saveCooperativeSettings(newSettings);
    setSettings(newSettings);

    if (!navigator.onLine) {
      setSyncStatus('offline');
      setPendingChanges({ settings: newSettings, timestamp: new Date() });
      setIsSaving(false);
      return false;
    }

    try {
      await performSync(newSettings);

      setPendingChanges(null);
      setSyncStatus('synced');
      setLastSyncTime(new Date());

      window.dispatchEvent(new CustomEvent('cooperative-settings-updated', { detail: newSettings }));

      return true;
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save settings');
      setSyncStatus('error');
      setPendingChanges({ settings: newSettings, timestamp: new Date() });
      
      // Start auto-retry
      scheduleRetry(0);
      
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [performSync, scheduleRetry]);

  const retrySync = useCallback(async (): Promise<boolean> => {
    if (!pendingChanges) {
      await fetchSettings();
      return true;
    }

    if (isRetryingRef.current) {
      return false;
    }

    isRetryingRef.current = true;
    setIsSaving(true);
    setSyncStatus('syncing');
    setError(null);

    // Clear any scheduled retries
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    try {
      await performSync(pendingChanges.settings);

      setPendingChanges(null);
      setSyncStatus('synced');
      setLastSyncTime(new Date());
      setRetryCount(0);
      
      window.dispatchEvent(new CustomEvent('cooperative-settings-updated', { detail: pendingChanges.settings }));
      window.dispatchEvent(new CustomEvent('sync-success'));

      return true;
    } catch (err: any) {
      console.error('Manual retry failed:', err);
      setError(err.message || 'Failed to sync settings');
      setSyncStatus('error');
      
      // Restart auto-retry from current count
      scheduleRetry(retryCount);
      
      return false;
    } finally {
      setIsSaving(false);
      isRetryingRef.current = false;
    }
  }, [pendingChanges, fetchSettings, performSync, scheduleRetry, retryCount]);

  const refreshSettings = useCallback(async () => {
    await fetchSettings();
  }, [fetchSettings]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      console.log('Connection restored - checking for pending changes');
      setIsOnline(true);
      
      // Small delay to ensure connection is stable
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (pendingChangesRef.current && !isRetryingRef.current) {
        console.log('Auto-syncing pending changes after coming online');
        
        isRetryingRef.current = true;
        setSyncStatus('syncing');

        try {
          await performSync(pendingChangesRef.current.settings);
          
          setPendingChanges(null);
          setSyncStatus('synced');
          setLastSyncTime(new Date());
          setRetryCount(0);
          setError(null);
          
          window.dispatchEvent(new CustomEvent('cooperative-settings-updated', { 
            detail: pendingChangesRef.current.settings 
          }));
          window.dispatchEvent(new CustomEvent('sync-success'));
          
          console.log('Auto-sync on reconnect successful');
        } catch (err: any) {
          console.error('Auto-sync on reconnect failed:', err);
          setSyncStatus('error');
          setError(err.message || 'Sync failed after reconnect');
          
          // Start retry cycle
          scheduleRetry(0);
        } finally {
          isRetryingRef.current = false;
        }
      }
    };

    const handleOffline = () => {
      console.log('Connection lost');
      setIsOnline(false);
      
      // Clear any pending retries
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      if (pendingChangesRef.current) {
        setSyncStatus('offline');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performSync, scheduleRetry]);

  // Initial fetch and settings update listener
  useEffect(() => {
    fetchSettings();

    const handleSettingsUpdate = (event: CustomEvent<CooperativeSettings>) => {
      setSettings(event.detail);
    };

    window.addEventListener('cooperative-settings-updated', handleSettingsUpdate as EventListener);

    // Check for stored pending changes and try to sync if online
    const storedPending = loadPendingFromStorage();
    if (storedPending && navigator.onLine) {
      console.log('Found stored pending changes, attempting to sync...');
      // Small delay to ensure everything is initialized
      setTimeout(async () => {
        if (!isRetryingRef.current) {
          isRetryingRef.current = true;
          setSyncStatus('syncing');
          
          try {
            await performSync(storedPending.settings);
            
            setPendingChanges(null);
            setSyncStatus('synced');
            setLastSyncTime(new Date());
            setRetryCount(0);
            setError(null);
            
            window.dispatchEvent(new CustomEvent('cooperative-settings-updated', { 
              detail: storedPending.settings 
            }));
            window.dispatchEvent(new CustomEvent('sync-success'));
            
            console.log('Stored pending changes synced successfully');
          } catch (err: any) {
            console.error('Failed to sync stored pending changes:', err);
            setSyncStatus('error');
            setError(err.message || 'Failed to sync stored changes');
            scheduleRetry(0);
          } finally {
            isRetryingRef.current = false;
          }
        }
      }, 2000);
    }

    return () => {
      window.removeEventListener('cooperative-settings-updated', handleSettingsUpdate as EventListener);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [fetchSettings, performSync, scheduleRetry]);

  return {
    settings,
    isLoading,
    isSaving,
    error,
    syncStatus,
    lastSyncTime,
    pendingChanges,
    isOnline,
    retryCount,
    saveSettings,
    refreshSettings,
    retrySync,
  };
};
