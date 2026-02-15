import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CollateralSettings {
  collateralThreshold: number;
  collateralTypes: string[];
  collateralMinValueRatio: number;
  collateralRequireApproval: boolean;
  collateralCustodianId: string | null;
}

const defaultCollateralSettings: CollateralSettings = {
  collateralThreshold: 5000000, // Rp 5.000.000
  collateralTypes: [
    'Sertifikat Tanah/Bangunan',
    'BPKB Kendaraan',
    'Ijazah',
    'Surat Berharga',
    'Lainnya'
  ],
  collateralMinValueRatio: 100, // 100% of loan amount
  collateralRequireApproval: true,
  collateralCustodianId: null
};

export function useCollateralSettings() {
  const [settings, setSettings] = useState<CollateralSettings>(defaultCollateralSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', [
          'collateral_threshold',
          'collateral_types',
          'collateral_min_value_ratio',
          'collateral_require_approval',
          'collateral_custodian_id'
        ]);

      if (error) throw error;

      const settingsMap: Record<string, any> = {};
      data?.forEach(item => {
        settingsMap[item.key] = item.value;
      });

      setSettings({
        collateralThreshold: settingsMap.collateral_threshold ?? defaultCollateralSettings.collateralThreshold,
        collateralTypes: settingsMap.collateral_types ?? defaultCollateralSettings.collateralTypes,
        collateralMinValueRatio: settingsMap.collateral_min_value_ratio ?? defaultCollateralSettings.collateralMinValueRatio,
        collateralRequireApproval: settingsMap.collateral_require_approval ?? defaultCollateralSettings.collateralRequireApproval,
        collateralCustodianId: settingsMap.collateral_custodian_id ?? defaultCollateralSettings.collateralCustodianId
      });
    } catch (err) {
      console.error('Error fetching collateral settings:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<CollateralSettings>) => {
    try {
      const updates = [];
      
      if (newSettings.collateralThreshold !== undefined) {
        updates.push({
          key: 'collateral_threshold',
          value: newSettings.collateralThreshold
        });
      }
      if (newSettings.collateralTypes !== undefined) {
        updates.push({
          key: 'collateral_types',
          value: newSettings.collateralTypes
        });
      }
      if (newSettings.collateralMinValueRatio !== undefined) {
        updates.push({
          key: 'collateral_min_value_ratio',
          value: newSettings.collateralMinValueRatio
        });
      }
      if (newSettings.collateralRequireApproval !== undefined) {
        updates.push({
          key: 'collateral_require_approval',
          value: newSettings.collateralRequireApproval
        });
      }
      if (newSettings.collateralCustodianId !== undefined) {
        updates.push({
          key: 'collateral_custodian_id',
          value: newSettings.collateralCustodianId
        });
      }

      for (const update of updates) {
        await supabase
          .from('cooperative_settings')
          .upsert({
            key: update.key,
            value: update.value,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      }

      setSettings(prev => ({ ...prev, ...newSettings }));
      return { success: true };
    } catch (err) {
      console.error('Error saving collateral settings:', err);
      return { success: false, error: err };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    isLoading,
    error,
    saveSettings,
    refetch: fetchSettings
  };
}
