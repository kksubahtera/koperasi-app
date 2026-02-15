import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FixedAsset {
  id: string;
  asset_code: string;
  asset_name: string;
  category: string | null;
  acquisition_date: string;
  acquisition_cost: number;
  useful_life_months: number;
  depreciation_method: 'straight_line' | 'declining_balance';
  accumulated_depreciation: number;
  current_value: number;
  status: string;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepreciationSchedule {
  period: number;
  year: number;
  month: number;
  openingValue: number;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  closingValue: number;
}

export interface AssetDepreciationSummary {
  totalAcquisitionCost: number;
  totalAccumulatedDepreciation: number;
  totalCurrentValue: number;
  monthlyDepreciation: number;
  yearlyDepreciation: number;
  assetCount: number;
  fullyDepreciatedCount: number;
}

// Calculate depreciation for a single asset
export const calculateAssetDepreciation = (
  asset: FixedAsset,
  asOfDate: Date = new Date()
): {
  monthlyDepreciation: number;
  accumulatedToDate: number;
  currentValue: number;
  schedule: DepreciationSchedule[];
  isFullyDepreciated: boolean;
  remainingMonths: number;
} => {
  const acquisitionDate = new Date(asset.acquisition_date);
  const monthsElapsed = Math.max(0, 
    (asOfDate.getFullYear() - acquisitionDate.getFullYear()) * 12 + 
    (asOfDate.getMonth() - acquisitionDate.getMonth())
  );

  const schedule: DepreciationSchedule[] = [];
  let accumulatedDepreciation = 0;
  let currentValue = asset.acquisition_cost;

  if (asset.depreciation_method === 'straight_line') {
    // Straight Line Method: (Cost - Salvage) / Useful Life
    // Assuming salvage value is 0 for simplicity
    const monthlyDepreciation = asset.acquisition_cost / asset.useful_life_months;
    
    for (let period = 1; period <= asset.useful_life_months; period++) {
      const periodDate = new Date(acquisitionDate);
      periodDate.setMonth(periodDate.getMonth() + period);
      
      const openingValue = currentValue;
      const depAmount = Math.min(monthlyDepreciation, currentValue);
      accumulatedDepreciation += depAmount;
      currentValue = Math.max(0, currentValue - depAmount);

      schedule.push({
        period,
        year: periodDate.getFullYear(),
        month: periodDate.getMonth() + 1,
        openingValue,
        depreciationAmount: depAmount,
        accumulatedDepreciation,
        closingValue: currentValue
      });
    }

    const effectiveMonths = Math.min(monthsElapsed, asset.useful_life_months);
    const accumulatedToDate = monthlyDepreciation * effectiveMonths;
    const currentValueToDate = Math.max(0, asset.acquisition_cost - accumulatedToDate);

    return {
      monthlyDepreciation,
      accumulatedToDate,
      currentValue: currentValueToDate,
      schedule,
      isFullyDepreciated: monthsElapsed >= asset.useful_life_months,
      remainingMonths: Math.max(0, asset.useful_life_months - monthsElapsed)
    };
  } else {
    // Declining Balance Method (Double Declining)
    // Rate = (2 / Useful Life) * 100%
    const rate = 2 / asset.useful_life_months;
    let runningValue = asset.acquisition_cost;
    
    for (let period = 1; period <= asset.useful_life_months; period++) {
      const periodDate = new Date(acquisitionDate);
      periodDate.setMonth(periodDate.getMonth() + period);
      
      const openingValue = runningValue;
      // In declining balance, we apply rate to remaining value
      let depAmount = runningValue * rate;
      
      // Switch to straight line if it gives higher depreciation
      const remainingPeriods = asset.useful_life_months - period + 1;
      const straightLineAmount = runningValue / remainingPeriods;
      if (straightLineAmount > depAmount) {
        depAmount = straightLineAmount;
      }
      
      depAmount = Math.min(depAmount, runningValue);
      accumulatedDepreciation += depAmount;
      runningValue = Math.max(0, runningValue - depAmount);

      schedule.push({
        period,
        year: periodDate.getFullYear(),
        month: periodDate.getMonth() + 1,
        openingValue,
        depreciationAmount: depAmount,
        accumulatedDepreciation,
        closingValue: runningValue
      });

      if (runningValue <= 0) break;
    }

    // Calculate to date values
    const effectiveMonths = Math.min(monthsElapsed, schedule.length);
    const scheduleToDate = schedule.slice(0, effectiveMonths);
    const accumulatedToDate = scheduleToDate.reduce((sum, s) => sum + s.depreciationAmount, 0);
    const currentValueToDate = Math.max(0, asset.acquisition_cost - accumulatedToDate);
    const lastMonthDep = effectiveMonths > 0 ? scheduleToDate[effectiveMonths - 1]?.depreciationAmount || 0 : 0;

    return {
      monthlyDepreciation: lastMonthDep,
      accumulatedToDate,
      currentValue: currentValueToDate,
      schedule,
      isFullyDepreciated: currentValueToDate <= 0,
      remainingMonths: Math.max(0, asset.useful_life_months - monthsElapsed)
    };
  }
};

export const useFixedAssets = () => {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fixed_assets')
        .select('*')
        .order('acquisition_date', { ascending: false });

      if (error) throw error;
      setAssets((data || []) as FixedAsset[]);
    } catch (error) {
      console.error('Error fetching fixed assets:', error);
      toast.error('Gagal memuat data aset tetap');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const addAsset = async (asset: Omit<FixedAsset, 'id' | 'created_at' | 'updated_at' | 'accumulated_depreciation' | 'current_value'>) => {
    try {
      const { error } = await supabase
        .from('fixed_assets')
        .insert({
          ...asset,
          accumulated_depreciation: 0,
          current_value: asset.acquisition_cost
        });

      if (error) throw error;
      toast.success('Aset tetap berhasil ditambahkan');
      await fetchAssets();
      return true;
    } catch (error) {
      console.error('Error adding asset:', error);
      toast.error('Gagal menambahkan aset tetap');
      return false;
    }
  };

  const updateAsset = async (id: string, updates: Partial<FixedAsset>) => {
    try {
      const { error } = await supabase
        .from('fixed_assets')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success('Aset tetap berhasil diperbarui');
      await fetchAssets();
      return true;
    } catch (error) {
      console.error('Error updating asset:', error);
      toast.error('Gagal memperbarui aset tetap');
      return false;
    }
  };

  const deleteAsset = async (id: string) => {
    try {
      const { error } = await supabase
        .from('fixed_assets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Aset tetap berhasil dihapus');
      await fetchAssets();
      return true;
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error('Gagal menghapus aset tetap');
      return false;
    }
  };

  // Update accumulated depreciation in database
  const runDepreciationUpdate = async () => {
    try {
      const currentDate = new Date();
      let updatedCount = 0;

      for (const asset of assets) {
        if (asset.status !== 'active') continue;

        const depreciation = calculateAssetDepreciation(asset, currentDate);
        
        if (depreciation.accumulatedToDate !== asset.accumulated_depreciation ||
            depreciation.currentValue !== asset.current_value) {
          const { error } = await supabase
            .from('fixed_assets')
            .update({
              accumulated_depreciation: depreciation.accumulatedToDate,
              current_value: depreciation.currentValue
            })
            .eq('id', asset.id);

          if (!error) updatedCount++;
        }
      }

      if (updatedCount > 0) {
        toast.success(`${updatedCount} aset berhasil diperbarui nilai penyusutannya`);
        await fetchAssets();
      } else {
        toast.info('Semua nilai penyusutan sudah up to date');
      }
    } catch (error) {
      console.error('Error running depreciation update:', error);
      toast.error('Gagal memperbarui penyusutan');
    }
  };

  // Summary calculations
  const summary = useMemo((): AssetDepreciationSummary => {
    const activeAssets = assets.filter(a => a.status === 'active');
    const currentDate = new Date();

    let totalMonthlyDep = 0;
    let fullyDepreciatedCount = 0;

    activeAssets.forEach(asset => {
      const dep = calculateAssetDepreciation(asset, currentDate);
      totalMonthlyDep += dep.monthlyDepreciation;
      if (dep.isFullyDepreciated) fullyDepreciatedCount++;
    });

    return {
      totalAcquisitionCost: activeAssets.reduce((sum, a) => sum + a.acquisition_cost, 0),
      totalAccumulatedDepreciation: activeAssets.reduce((sum, a) => {
        const dep = calculateAssetDepreciation(a, currentDate);
        return sum + dep.accumulatedToDate;
      }, 0),
      totalCurrentValue: activeAssets.reduce((sum, a) => {
        const dep = calculateAssetDepreciation(a, currentDate);
        return sum + dep.currentValue;
      }, 0),
      monthlyDepreciation: totalMonthlyDep,
      yearlyDepreciation: totalMonthlyDep * 12,
      assetCount: activeAssets.length,
      fullyDepreciatedCount
    };
  }, [assets]);

  // Get depreciation by category
  const depreciationByCategory = useMemo(() => {
    const currentDate = new Date();
    const categories: Record<string, { 
      count: number; 
      totalCost: number; 
      totalDepreciation: number; 
      totalCurrentValue: number 
    }> = {};

    assets.filter(a => a.status === 'active').forEach(asset => {
      const category = asset.category || 'Lainnya';
      const dep = calculateAssetDepreciation(asset, currentDate);

      if (!categories[category]) {
        categories[category] = { count: 0, totalCost: 0, totalDepreciation: 0, totalCurrentValue: 0 };
      }

      categories[category].count++;
      categories[category].totalCost += asset.acquisition_cost;
      categories[category].totalDepreciation += dep.accumulatedToDate;
      categories[category].totalCurrentValue += dep.currentValue;
    });

    return Object.entries(categories).map(([category, data]) => ({
      category,
      ...data
    }));
  }, [assets]);

  return {
    assets,
    loading,
    summary,
    depreciationByCategory,
    addAsset,
    updateAsset,
    deleteAsset,
    runDepreciationUpdate,
    refetch: fetchAssets
  };
};
