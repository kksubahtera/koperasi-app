import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BusinessUnitMigrationEntry {
  userId: string;
  memberName: string;
  memberNumber: string;
  businessUnitId: string;
  businessUnitCode: string;
  businessUnitName: string;
  transactionDate: string;
  transactionType: string;
  amount: number;
  quantity?: number;
  description?: string;
}

export interface MigratedTransaction {
  id: string;
  userId: string;
  memberName: string;
  memberNumber: string;
  businessUnitId: string;
  businessUnitName: string;
  businessUnitCode: string;
  transactionDate: string;
  transactionType: string;
  amount: number;
  quantity: number | null;
  description: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const useBusinessUnitMigration = () => {
  const [loading, setLoading] = useState(false);
  const [migratedTransactions, setMigratedTransactions] = useState<MigratedTransaction[]>([]);

  // Fetch migrated transactions (those with migration notes)
  const fetchMigratedTransactions = useCallback(async (year?: number, unitId?: string) => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('business_unit_transactions')
        .select('*')
        .eq('is_member_transaction', true)
        .ilike('notes', '%Migrasi%')
        .order('transaction_date', { ascending: false });

      if (year) {
        query = query
          .gte('transaction_date', `${year}-01-01`)
          .lte('transaction_date', `${year}-12-31`);
      }

      if (unitId) {
        query = query.eq('business_unit_id', unitId);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        setMigratedTransactions([]);
        return [];
      }

      // Get user and unit details
      const userIds = [...new Set(data.map(t => t.user_id))];
      const unitIds = [...new Set(data.map(t => t.business_unit_id))];

      const [profilesRes, unitsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, name, member_number').in('user_id', userIds),
        supabase.from('business_units').select('id, name, code').in('id', unitIds)
      ]);

      const profilesMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const unitsMap = new Map((unitsRes.data || []).map(u => [u.id, u]));

      const mapped: MigratedTransaction[] = data.map(t => {
        const profile = profilesMap.get(t.user_id);
        const unit = unitsMap.get(t.business_unit_id);
        return {
          id: t.id,
          userId: t.user_id,
          memberName: profile?.name || 'Unknown',
          memberNumber: profile?.member_number || '-',
          businessUnitId: t.business_unit_id,
          businessUnitName: unit?.name || 'Unknown',
          businessUnitCode: unit?.code || '-',
          transactionDate: t.transaction_date,
          transactionType: t.transaction_type,
          amount: t.amount,
          quantity: t.quantity,
          description: t.description,
          notes: t.notes,
          createdAt: t.created_at,
        };
      });

      setMigratedTransactions(mapped);
      return mapped;
    } catch (error) {
      console.error('Error fetching migrated transactions:', error);
      toast.error('Gagal memuat data transaksi migrasi');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Validate transaction data
  const validateTransaction = async (entry: Partial<BusinessUnitMigrationEntry>): Promise<ValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!entry.userId) errors.push('User ID diperlukan');
    if (!entry.businessUnitId) errors.push('Unit usaha diperlukan');
    if (!entry.transactionDate) errors.push('Tanggal transaksi diperlukan');
    if (!entry.transactionType) errors.push('Tipe transaksi diperlukan');
    if (!entry.amount || entry.amount <= 0) errors.push('Jumlah harus lebih dari 0');

    // Validate transaction type
    const validTypes = ['sale', 'purchase', 'service'];
    if (entry.transactionType && !validTypes.includes(entry.transactionType)) {
      errors.push(`Tipe transaksi tidak valid. Gunakan: ${validTypes.join(', ')}`);
    }

    // Validate date format and not in future
    if (entry.transactionDate) {
      const txDate = new Date(entry.transactionDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      if (isNaN(txDate.getTime())) {
        errors.push('Format tanggal tidak valid (gunakan YYYY-MM-DD)');
      } else if (txDate > today) {
        errors.push('Tanggal tidak boleh di masa depan');
      }
    }

    // Check for potential duplicates
    if (entry.userId && entry.businessUnitId && entry.transactionDate && entry.amount) {
      const { data: existing } = await supabase
        .from('business_unit_transactions')
        .select('id')
        .eq('user_id', entry.userId)
        .eq('business_unit_id', entry.businessUnitId)
        .eq('transaction_date', entry.transactionDate)
        .eq('amount', entry.amount)
        .limit(1);

      if (existing && existing.length > 0) {
        warnings.push('Transaksi serupa sudah ada (user, unit, tanggal, jumlah sama)');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  };

  // Add single migrated transaction
  const addMigratedTransaction = async (
    entry: BusinessUnitMigrationEntry,
    createdBy?: string
  ): Promise<boolean> => {
    try {
      setLoading(true);

      const validation = await validateTransaction(entry);
      if (!validation.isValid) {
        validation.errors.forEach(err => toast.error(err));
        return false;
      }

      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warn => toast.warning(warn));
      }

      const { error } = await supabase
        .from('business_unit_transactions')
        .insert({
          user_id: entry.userId,
          business_unit_id: entry.businessUnitId,
          transaction_date: entry.transactionDate,
          transaction_type: entry.transactionType,
          amount: entry.amount,
          quantity: entry.quantity || null,
          description: entry.description || null,
          is_member_transaction: true,
          notes: `Migrasi riwayat transaksi pada ${new Date().toISOString()}`,
          created_by: createdBy,
        });

      if (error) throw error;

      toast.success('Transaksi migrasi berhasil ditambahkan');
      return true;
    } catch (error) {
      console.error('Error adding migrated transaction:', error);
      toast.error('Gagal menambahkan transaksi migrasi');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Bulk import transactions
  const bulkImportTransactions = async (
    entries: BusinessUnitMigrationEntry[],
    createdBy?: string
  ): Promise<{ success: number; failed: number; errors: string[] }> => {
    const result = { success: 0, failed: 0, errors: [] as string[] };
    
    try {
      setLoading(true);

      // Validate all entries first
      const validEntries: BusinessUnitMigrationEntry[] = [];
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const validation = await validateTransaction(entry);
        
        if (validation.isValid) {
          validEntries.push(entry);
        } else {
          result.failed++;
          result.errors.push(`Baris ${i + 1}: ${validation.errors.join(', ')}`);
        }
      }

      if (validEntries.length === 0) {
        toast.error('Tidak ada data valid untuk diimport');
        return result;
      }

      // Insert valid entries in batches
      const batchSize = 50;
      for (let i = 0; i < validEntries.length; i += batchSize) {
        const batch = validEntries.slice(i, i + batchSize).map(entry => ({
          user_id: entry.userId,
          business_unit_id: entry.businessUnitId,
          transaction_date: entry.transactionDate,
          transaction_type: entry.transactionType,
          amount: entry.amount,
          quantity: entry.quantity || null,
          description: entry.description || null,
          is_member_transaction: true,
          notes: `Migrasi riwayat transaksi via Excel pada ${new Date().toISOString()}`,
          created_by: createdBy,
        }));

        const { error } = await supabase
          .from('business_unit_transactions')
          .insert(batch);

        if (error) {
          result.failed += batch.length;
          result.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          result.success += batch.length;
        }
      }

      if (result.success > 0) {
        toast.success(`${result.success} transaksi berhasil diimport`);
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} transaksi gagal diimport`);
      }

      return result;
    } catch (error) {
      console.error('Error bulk importing transactions:', error);
      toast.error('Gagal mengimport transaksi');
      return result;
    } finally {
      setLoading(false);
    }
  };

  // Delete migrated transaction
  const deleteMigratedTransaction = async (id: string): Promise<boolean> => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('business_unit_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Transaksi migrasi berhasil dihapus');
      return true;
    } catch (error) {
      console.error('Error deleting migrated transaction:', error);
      toast.error('Gagal menghapus transaksi migrasi');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    migratedTransactions,
    fetchMigratedTransactions,
    validateTransaction,
    addMigratedTransaction,
    bulkImportTransactions,
    deleteMigratedTransaction,
  };
};
