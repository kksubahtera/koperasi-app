import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CooperativeBranch {
  id: string;
  name: string;
  code: string;
  badge_color: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchFormData {
  name: string;
  code: string;
  badge_color: string;
  description: string;
}

export type BranchTerminology = 'cabang' | 'unit';

export function useBranches() {
  const [branches, setBranches] = useState<CooperativeBranch[]>([]);
  const [activeBranches, setActiveBranches] = useState<CooperativeBranch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [branchFeatureEnabled, setBranchFeatureEnabled] = useState(false);
  const [branchTerminology, setBranchTerminology] = useState<BranchTerminology>('cabang');

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('cooperative_branches')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      const branchData = (data || []) as CooperativeBranch[];
      console.log('[useBranches] Fetched branches:', branchData);
      setBranches(branchData);
      setActiveBranches(branchData.filter(b => b.is_active));
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchBranchFeatureSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', ['enable_branch_feature', 'branch_terminology']);

      if (error) throw error;
      
      console.log('[useBranches] Raw settings data:', data);
      data?.forEach((setting) => {
        if (setting.key === 'enable_branch_feature') {
          // Handle both boolean true and string "true" from JSONB
          const isEnabled = setting.value === true || setting.value === 'true';
          console.log('[useBranches] enable_branch_feature raw:', setting.value, 'type:', typeof setting.value, '-> isEnabled:', isEnabled);
          setBranchFeatureEnabled(isEnabled);
        } else if (setting.key === 'branch_terminology') {
          console.log('[useBranches] branch_terminology:', setting.value);
          setBranchTerminology((setting.value as BranchTerminology) || 'cabang');
        }
      });
    } catch (error) {
      console.error('Error fetching branch feature setting:', error);
    }
  };

  const updateBranchTerminology = async (terminology: BranchTerminology) => {
    try {
      const { error } = await supabase
        .from('cooperative_settings')
        .upsert({
          key: 'branch_terminology',
          value: terminology,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) throw error;
      
      setBranchTerminology(terminology);
      toast.success(`Istilah diubah menjadi "${terminology === 'cabang' ? 'Cabang' : 'Unit'}"`);
    } catch (error) {
      console.error('Error updating branch terminology:', error);
      toast.error('Gagal mengubah istilah');
    }
  };

  const toggleBranchFeature = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('cooperative_settings')
        .upsert({
          key: 'enable_branch_feature',
          value: enabled,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) throw error;
      
      setBranchFeatureEnabled(enabled);
      toast.success(enabled ? 'Fitur cabang diaktifkan' : 'Fitur cabang dinonaktifkan');
    } catch (error) {
      console.error('Error toggling branch feature:', error);
      toast.error('Gagal mengubah pengaturan fitur cabang');
    }
  };

  const createBranch = async (data: BranchFormData) => {
    try {
      // Get max display_order
      const maxOrder = branches.length > 0 
        ? Math.max(...branches.map(b => b.display_order)) + 1 
        : 0;

      const { error } = await supabase
        .from('cooperative_branches')
        .insert({
          name: data.name,
          code: data.code.toUpperCase(),
          badge_color: data.badge_color,
          description: data.description || null,
          display_order: maxOrder
        });

      if (error) throw error;
      
      toast.success('Cabang berhasil ditambahkan');
      await fetchBranches();
      return true;
    } catch (error: any) {
      console.error('Error creating branch:', error);
      if (error.code === '23505') {
        toast.error('Kode cabang sudah digunakan');
      } else {
        toast.error('Gagal menambahkan cabang');
      }
      return false;
    }
  };

  const updateBranch = async (id: string, data: BranchFormData) => {
    try {
      const { error } = await supabase
        .from('cooperative_branches')
        .update({
          name: data.name,
          code: data.code.toUpperCase(),
          badge_color: data.badge_color,
          description: data.description || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Cabang berhasil diperbarui');
      await fetchBranches();
      return true;
    } catch (error: any) {
      console.error('Error updating branch:', error);
      if (error.code === '23505') {
        toast.error('Kode cabang sudah digunakan');
      } else {
        toast.error('Gagal memperbarui cabang');
      }
      return false;
    }
  };

  const toggleBranchActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('cooperative_branches')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success(isActive ? 'Cabang diaktifkan' : 'Cabang dinonaktifkan');
      await fetchBranches();
    } catch (error) {
      console.error('Error toggling branch:', error);
      toast.error('Gagal mengubah status cabang');
    }
  };

  const deleteBranch = async (id: string) => {
    try {
      // Check if any members are assigned to this branch
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', id);

      if (countError) throw countError;

      if (count && count > 0) {
        toast.error(`Tidak dapat menghapus cabang. Masih ada ${count} anggota terdaftar.`);
        return false;
      }

      const { error } = await supabase
        .from('cooperative_branches')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Cabang berhasil dihapus');
      await fetchBranches();
      return true;
    } catch (error) {
      console.error('Error deleting branch:', error);
      toast.error('Gagal menghapus cabang');
      return false;
    }
  };

  const updateBranchOrder = async (branchId: string, newOrder: number) => {
    try {
      const { error } = await supabase
        .from('cooperative_branches')
        .update({ display_order: newOrder })
        .eq('id', branchId);

      if (error) throw error;
      await fetchBranches();
    } catch (error) {
      console.error('Error updating branch order:', error);
    }
  };

  const getBranchById = (id: string | null) => {
    if (!id) return null;
    return branches.find(b => b.id === id) || null;
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchBranches(), fetchBranchFeatureSetting()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  return {
    branches,
    activeBranches,
    isLoading,
    branchFeatureEnabled,
    branchTerminology,
    toggleBranchFeature,
    updateBranchTerminology,
    createBranch,
    updateBranch,
    toggleBranchActive,
    deleteBranch,
    updateBranchOrder,
    getBranchById,
    refetch: fetchBranches
  };
}
