import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ExitedMemberSHUConfig {
  enabled: boolean;
  calculationMethod: 'pro_rata' | 'full' | 'at_exit';
  paymentTime: 'on_resignation' | 'year_end' | 'after_rat';
  fallbackAllocation: 'reserve_fund' | 'redistribute' | 'forfeited';
}

const defaultConfig: ExitedMemberSHUConfig = {
  enabled: true,
  calculationMethod: 'pro_rata',
  paymentTime: 'year_end',
  fallbackAllocation: 'reserve_fund',
};

/**
 * Hook to fetch exited member SHU settings from database
 */
export const useExitedMemberSHUSettings = () => {
  const [config, setConfig] = useState<ExitedMemberSHUConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', [
          'exited_member_shu_enabled',
          'exited_member_shu_calculation',
          'exited_member_shu_payment_time',
          'exited_member_shu_fallback'
        ]);

      if (fetchError) throw fetchError;

      const settingsMap = new Map(data?.map(d => [d.key, d.value]));
      
      setConfig({
        enabled: settingsMap.get('exited_member_shu_enabled') === true || 
                 settingsMap.get('exited_member_shu_enabled') === 'true',
        calculationMethod: (settingsMap.get('exited_member_shu_calculation') as ExitedMemberSHUConfig['calculationMethod']) || 'pro_rata',
        paymentTime: (settingsMap.get('exited_member_shu_payment_time') as ExitedMemberSHUConfig['paymentTime']) || 'year_end',
        fallbackAllocation: (settingsMap.get('exited_member_shu_fallback') as ExitedMemberSHUConfig['fallbackAllocation']) || 'reserve_fund',
      });
    } catch (err) {
      console.error('Error fetching exited member SHU settings:', err);
      setError('Gagal memuat pengaturan SHU anggota keluar');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  /**
   * Calculate SHU for an exited member based on settings
   */
  const calculateExitedMemberSHU = useCallback((
    memberData: {
      joinDate: Date;
      exitDate: Date;
      totalSavings: number;
      interestPaid: number;
      yearStart: Date;
      yearEnd: Date;
      totalCooperativeSavings: number;
      totalCooperativeInterest: number;
      shuAnggotaSimpanan: number;
      shuAnggotaJasaUsaha: number;
    }
  ) => {
    if (!config.enabled) {
      return {
        eligible: false,
        amount: 0,
        simpananShare: 0,
        jasaUsahaShare: 0,
        activeMonths: 0,
        proportionFactor: 0,
      };
    }

    const { 
      joinDate, exitDate, totalSavings, interestPaid, 
      yearStart, yearEnd,
      totalCooperativeSavings, totalCooperativeInterest,
      shuAnggotaSimpanan, shuAnggotaJasaUsaha
    } = memberData;

    // Calculate active months in the year
    const effectiveStart = joinDate > yearStart ? joinDate : yearStart;
    const effectiveEnd = exitDate < yearEnd ? exitDate : yearEnd;
    
    const monthsDiff = (effectiveEnd.getFullYear() - effectiveStart.getFullYear()) * 12 +
                       (effectiveEnd.getMonth() - effectiveStart.getMonth()) + 1;
    const activeMonths = Math.max(0, Math.min(12, monthsDiff));
    
    // Calculate base shares
    const baseSimpananShare = totalCooperativeSavings > 0 
      ? (totalSavings / totalCooperativeSavings) * shuAnggotaSimpanan 
      : 0;
    const baseJasaUsahaShare = totalCooperativeInterest > 0 
      ? (interestPaid / totalCooperativeInterest) * shuAnggotaJasaUsaha 
      : 0;

    let proportionFactor = 1;
    let simpananShare = baseSimpananShare;
    let jasaUsahaShare = baseJasaUsahaShare;

    switch (config.calculationMethod) {
      case 'pro_rata':
        proportionFactor = activeMonths / 12;
        simpananShare = baseSimpananShare * proportionFactor;
        jasaUsahaShare = baseJasaUsahaShare * proportionFactor;
        break;
      case 'full':
        // Full share, no reduction
        proportionFactor = 1;
        break;
      case 'at_exit':
        // Use actual values at exit date (already reflected in totalSavings and interestPaid)
        proportionFactor = 1;
        break;
    }

    return {
      eligible: true,
      amount: simpananShare + jasaUsahaShare,
      simpananShare,
      jasaUsahaShare,
      activeMonths,
      proportionFactor,
    };
  }, [config]);

  return {
    config,
    isLoading,
    error,
    refetch: fetchSettings,
    calculateExitedMemberSHU,
  };
};
