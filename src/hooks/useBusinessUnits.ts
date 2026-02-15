import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BusinessUnit {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_primary: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessUnitInput {
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
  is_primary?: boolean;
  display_order?: number;
}

// Default units untuk sinkronisasi ke database
const DEFAULT_UNITS: BusinessUnitInput[] = [
  { code: 'SP', name: 'Simpan Pinjam', description: 'Unit usaha simpan pinjam koperasi', is_active: true, is_primary: true, display_order: 0 },
  { code: 'TK', name: 'Toko', description: 'Unit usaha toko koperasi', is_active: true, is_primary: false, display_order: 1 },
  { code: 'PRD', name: 'Produksi', description: 'Unit usaha produksi koperasi', is_active: true, is_primary: false, display_order: 2 },
  { code: 'JS', name: 'Jasa', description: 'Unit usaha jasa koperasi', is_active: true, is_primary: false, display_order: 3 },
  { code: 'PRW', name: 'Pariwisata', description: 'Unit usaha pariwisata koperasi', is_active: true, is_primary: false, display_order: 4 },
];

export const useBusinessUnits = () => {
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);

  const seedDefaultUnits = useCallback(async () => {
    const { error } = await supabase
      .from('business_units')
      .insert(DEFAULT_UNITS);

    if (error) {
      console.error('Error seeding default units:', error);
    }
  }, []);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('business_units')
      .select('*')
      .order('display_order', { ascending: true })
      .order('is_primary', { ascending: false })
      .order('code');

    if (error) {
      console.error('Error fetching business units:', error);
      toast.error('Gagal mengambil data unit usaha');
      setLoading(false);
      return;
    }

    // Jika database kosong, sinkronkan default units
    if (!data || data.length === 0) {
      await seedDefaultUnits();
      // Fetch lagi setelah seed
      const { data: seededData } = await supabase
        .from('business_units')
        .select('*')
        .order('display_order', { ascending: true })
        .order('is_primary', { ascending: false })
        .order('code');
      setUnits(seededData || []);
    } else {
      setUnits(data);
    }
    
    setLoading(false);
  }, [seedDefaultUnits]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const addUnit = async (input: BusinessUnitInput) => {
    // Set display_order to last position if not provided
    const maxOrder = units.length > 0 ? Math.max(...units.map(u => u.display_order ?? 0)) + 1 : 0;
    const unitData = { ...input, display_order: input.display_order ?? maxOrder };

    const { data, error } = await supabase
      .from('business_units')
      .insert([unitData])
      .select()
      .single();

    if (error) {
      console.error('Error adding business unit:', error);
      toast.error('Gagal menambah unit usaha: ' + error.message);
      return null;
    }

    toast.success('Unit usaha berhasil ditambahkan');
    await fetchUnits();
    return data;
  };

  const updateUnit = async (id: string, input: Partial<BusinessUnitInput>) => {
    const { error } = await supabase
      .from('business_units')
      .update(input)
      .eq('id', id);

    if (error) {
      console.error('Error updating business unit:', error);
      toast.error('Gagal mengupdate unit usaha: ' + error.message);
      return false;
    }

    toast.success('Unit usaha berhasil diupdate');
    await fetchUnits();
    return true;
  };

  const deleteUnit = async (id: string) => {
    const { error } = await supabase
      .from('business_units')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting business unit:', error);
      toast.error('Gagal menghapus unit usaha: ' + error.message);
      return false;
    }

    toast.success('Unit usaha berhasil dihapus');
    await fetchUnits();
    return true;
  };

  const reorderUnits = async (reorderedUnits: BusinessUnit[]) => {
    // Update local state immediately for optimistic UI
    setUnits(reorderedUnits);

    // Batch update display_order in database
    const updates = reorderedUnits.map((unit, index) => ({
      id: unit.id,
      display_order: index,
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('business_units')
        .update({ display_order: update.display_order })
        .eq('id', update.id);

      if (error) {
        console.error('Error reordering unit:', error);
        toast.error('Gagal mengubah urutan unit usaha');
        await fetchUnits(); // Rollback to database state
        return false;
      }
    }

    toast.success('Urutan unit usaha berhasil diubah');
    return true;
  };

  return {
    units,
    loading,
    refetch: fetchUnits,
    addUnit,
    updateUnit,
    deleteUnit,
    reorderUnits,
  };
};
