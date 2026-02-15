import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface ChartOfAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  parent_id: string | null;
  business_unit_id: string | null;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  balance: number;
  created_at: string;
  updated_at: string;
  // Joined data
  business_unit?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface ChartOfAccountInput {
  account_code: string;
  account_name: string;
  account_type: AccountType;
  parent_id?: string | null;
  business_unit_id?: string | null;
  description?: string;
  is_active?: boolean;
}

export const useChartOfAccounts = (accountType?: AccountType) => {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('chart_of_accounts')
      .select(`
        *,
        business_unit:business_units(id, code, name)
      `)
      .order('account_code');

    if (accountType) {
      query = query.eq('account_type', accountType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching chart of accounts:', error);
      toast.error('Gagal mengambil data akun');
    } else {
      // Map the data to handle the joined data properly
      const mappedData = (data || []).map(item => ({
        ...item,
        business_unit: item.business_unit || null
      }));
      setAccounts(mappedData);
    }
    setLoading(false);
  }, [accountType]);

  // Auto-initialize standard accounts on first load
  const initializeStandardAccounts = useCallback(async () => {
    // Check if any accounts exist
    const { count, error } = await supabase
      .from('chart_of_accounts')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error checking accounts:', error);
      return;
    }

    // If no accounts exist, create standard accounts automatically
    if (count === 0) {
      console.log('No accounts found, creating standard accounts...');
      const standardAccounts = [
        // Asset accounts (1-xxx)
        { account_code: '1-1000', account_name: 'Kas', account_type: 'asset' as AccountType, description: 'Uang tunai di tangan', is_system: true, is_active: true, balance: 0 },
        { account_code: '1-1100', account_name: 'Bank', account_type: 'asset' as AccountType, description: 'Saldo rekening bank', is_system: true, is_active: true, balance: 0 },
        { account_code: '1-2000', account_name: 'Piutang Pinjaman Anggota', account_type: 'asset' as AccountType, description: 'Pinjaman yang belum dilunasi anggota', is_system: true, is_active: true, balance: 0 },
        
        // Liability accounts (2-xxx)
        { account_code: '2-1010', account_name: 'Hutang Simpanan Pokok', account_type: 'liability' as AccountType, description: 'Total simpanan pokok seluruh anggota', is_system: true, is_active: true, balance: 0 },
        { account_code: '2-1020', account_name: 'Hutang Simpanan Wajib', account_type: 'liability' as AccountType, description: 'Total simpanan wajib seluruh anggota', is_system: true, is_active: true, balance: 0 },
        { account_code: '2-1030', account_name: 'Hutang Simpanan Sukarela', account_type: 'liability' as AccountType, description: 'Total simpanan sukarela seluruh anggota', is_system: true, is_active: true, balance: 0 },
        { account_code: '2-3050', account_name: 'Hutang SHU Ditahan', account_type: 'liability' as AccountType, description: 'SHU anggota yang ditahan karena tunggakan pinjaman', is_system: true, is_active: true, balance: 0 },
        
        // Equity accounts (3-xxx)
        { account_code: '3-1000', account_name: 'Dana Cadangan', account_type: 'equity' as AccountType, description: 'Cadangan dari alokasi SHU', is_system: true, is_active: true, balance: 0 },
        { account_code: '3-1010', account_name: 'Dana Pendidikan', account_type: 'equity' as AccountType, description: 'Dana pendidikan dari alokasi SHU', is_system: true, is_active: true, balance: 0 },
        { account_code: '3-1020', account_name: 'Dana Sosial', account_type: 'equity' as AccountType, description: 'Dana sosial dari alokasi SHU', is_system: true, is_active: true, balance: 0 },
        { account_code: '3-1030', account_name: 'Dana Pembangunan', account_type: 'equity' as AccountType, description: 'Dana pembangunan dari alokasi SHU', is_system: true, is_active: true, balance: 0 },
        { account_code: '3-2000', account_name: 'Modal Penyertaan', account_type: 'equity' as AccountType, description: 'Modal penyertaan dari pihak lain', is_system: true, is_active: true, balance: 0 },
        { account_code: '3-2050', account_name: 'Cadangan SHU Ditahan', account_type: 'equity' as AccountType, description: 'Cadangan untuk SHU yang ditahan dari anggota bermasalah', is_system: true, is_active: true, balance: 0 },
        { account_code: '3-3000', account_name: 'SHU Tahun Berjalan', account_type: 'equity' as AccountType, description: 'Sisa Hasil Usaha tahun berjalan', is_system: true, is_active: true, balance: 0 },
        { account_code: '3-3010', account_name: 'SHU Anggota - Jasa Simpanan', account_type: 'equity' as AccountType, description: 'Bagian SHU anggota dari jasa simpanan', is_system: true, is_active: true, balance: 0 },
        { account_code: '3-3020', account_name: 'SHU Anggota - Jasa Pinjaman', account_type: 'equity' as AccountType, description: 'Bagian SHU anggota dari jasa pinjaman', is_system: true, is_active: true, balance: 0 },
        { account_code: '3-3030', account_name: 'SHU Pengurus', account_type: 'equity' as AccountType, description: 'Bagian SHU untuk pengurus koperasi', is_system: true, is_active: true, balance: 0 },
        { account_code: '3-3040', account_name: 'SHU Pengawas', account_type: 'equity' as AccountType, description: 'Bagian SHU untuk pengawas koperasi', is_system: true, is_active: true, balance: 0 },
        { account_code: '3-3050', account_name: 'SHU Penasihat', account_type: 'equity' as AccountType, description: 'Bagian SHU untuk penasihat koperasi', is_system: true, is_active: true, balance: 0 },
        
        // Income accounts (4-xxx)
        { account_code: '4-1000', account_name: 'Pendapatan Bunga Pinjaman', account_type: 'income' as AccountType, description: 'Pendapatan bunga dari angsuran pinjaman', is_system: true, is_active: true, balance: 0 },
        { account_code: '4-2000', account_name: 'Pendapatan Denda Keterlambatan', account_type: 'income' as AccountType, description: 'Pendapatan denda dari angsuran terlambat', is_system: true, is_active: true, balance: 0 },
        { account_code: '4-3000', account_name: 'Pendapatan Jasa Usaha', account_type: 'income' as AccountType, description: 'Pendapatan dari unit usaha koperasi', is_system: true, is_active: true, balance: 0 },
        { account_code: '4-4000', account_name: 'Pendapatan Administrasi', account_type: 'income' as AccountType, description: 'Pendapatan biaya administrasi', is_system: true, is_active: true, balance: 0 },
        
        // Expense accounts (5-xxx)
        { account_code: '5-1000', account_name: 'Beban Bunga Simpanan Sukarela', account_type: 'expense' as AccountType, description: 'Beban bunga yang dibayarkan ke anggota', is_system: true, is_active: true, balance: 0 },
        { account_code: '5-2000', account_name: 'Beban Operasional', account_type: 'expense' as AccountType, description: 'Biaya operasional koperasi', is_system: true, is_active: true, balance: 0 },
        { account_code: '5-3000', account_name: 'Beban Administrasi', account_type: 'expense' as AccountType, description: 'Biaya administrasi dan kantor', is_system: true, is_active: true, balance: 0 },
        { account_code: '5-4000', account_name: 'Beban Penyusutan', account_type: 'expense' as AccountType, description: 'Beban penyusutan aset tetap', is_system: true, is_active: true, balance: 0 },
      ];

      const { error: insertError } = await supabase
        .from('chart_of_accounts')
        .insert(standardAccounts);

      if (insertError) {
        console.error('Error creating standard accounts:', insertError);
      } else {
        console.log('Standard accounts created successfully');
        toast.success('Akun standar koperasi berhasil dibuat');
      }
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await initializeStandardAccounts();
      await fetchAccounts();
    };
    init();
  }, [fetchAccounts, initializeStandardAccounts]);

  const addAccount = async (input: ChartOfAccountInput) => {
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .insert([input])
      .select()
      .single();

    if (error) {
      console.error('Error adding account:', error);
      toast.error('Gagal menambah akun: ' + error.message);
      return null;
    }

    toast.success('Akun berhasil ditambahkan');
    await fetchAccounts();
    return data;
  };

  const updateAccount = async (id: string, input: Partial<ChartOfAccountInput>) => {
    const { error } = await supabase
      .from('chart_of_accounts')
      .update(input)
      .eq('id', id);

    if (error) {
      console.error('Error updating account:', error);
      toast.error('Gagal mengupdate akun: ' + error.message);
      return false;
    }

    toast.success('Akun berhasil diupdate');
    await fetchAccounts();
    return true;
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabase
      .from('chart_of_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting account:', error);
      toast.error('Gagal menghapus akun: ' + error.message);
      return false;
    }

    toast.success('Akun berhasil dihapus');
    await fetchAccounts();
    return true;
  };

  const updateBalance = async (id: string, amount: number) => {
    const { error } = await supabase
      .from('chart_of_accounts')
      .update({ balance: amount })
      .eq('id', id);

    if (error) {
      console.error('Error updating balance:', error);
      return false;
    }

    await fetchAccounts();
    return true;
  };

  // Standard cooperative accounts for journal templates
  const STANDARD_ACCOUNTS = [
    // Asset accounts (1-xxx)
    { account_code: '1-1000', account_name: 'Kas', account_type: 'asset' as AccountType, description: 'Uang tunai di tangan', is_system: true },
    { account_code: '1-1100', account_name: 'Bank', account_type: 'asset' as AccountType, description: 'Saldo rekening bank', is_system: true },
    { account_code: '1-2000', account_name: 'Piutang Pinjaman Anggota', account_type: 'asset' as AccountType, description: 'Pinjaman yang belum dilunasi anggota', is_system: true },
    
    // Liability accounts (2-xxx)
    { account_code: '2-1010', account_name: 'Hutang Simpanan Pokok', account_type: 'liability' as AccountType, description: 'Total simpanan pokok seluruh anggota', is_system: true },
    { account_code: '2-1020', account_name: 'Hutang Simpanan Wajib', account_type: 'liability' as AccountType, description: 'Total simpanan wajib seluruh anggota', is_system: true },
    { account_code: '2-1030', account_name: 'Hutang Simpanan Sukarela', account_type: 'liability' as AccountType, description: 'Total simpanan sukarela seluruh anggota', is_system: true },
    { account_code: '2-3050', account_name: 'Hutang SHU Ditahan', account_type: 'liability' as AccountType, description: 'SHU anggota yang ditahan karena tunggakan pinjaman', is_system: true },
    
    // Equity accounts (3-xxx)
    { account_code: '3-1000', account_name: 'Dana Cadangan', account_type: 'equity' as AccountType, description: 'Cadangan dari alokasi SHU', is_system: true },
    { account_code: '3-1010', account_name: 'Dana Pendidikan', account_type: 'equity' as AccountType, description: 'Dana pendidikan dari alokasi SHU', is_system: true },
    { account_code: '3-1020', account_name: 'Dana Sosial', account_type: 'equity' as AccountType, description: 'Dana sosial dari alokasi SHU', is_system: true },
    { account_code: '3-1030', account_name: 'Dana Pembangunan', account_type: 'equity' as AccountType, description: 'Dana pembangunan dari alokasi SHU', is_system: true },
    { account_code: '3-2000', account_name: 'Modal Penyertaan', account_type: 'equity' as AccountType, description: 'Modal penyertaan dari pihak lain', is_system: true },
    { account_code: '3-2050', account_name: 'Cadangan SHU Ditahan', account_type: 'equity' as AccountType, description: 'Cadangan untuk SHU yang ditahan dari anggota bermasalah', is_system: true },
    { account_code: '3-3000', account_name: 'SHU Tahun Berjalan', account_type: 'equity' as AccountType, description: 'Sisa Hasil Usaha tahun berjalan', is_system: true },
    { account_code: '3-3010', account_name: 'SHU Anggota - Jasa Simpanan', account_type: 'equity' as AccountType, description: 'Bagian SHU anggota dari jasa simpanan', is_system: true },
    { account_code: '3-3020', account_name: 'SHU Anggota - Jasa Pinjaman', account_type: 'equity' as AccountType, description: 'Bagian SHU anggota dari jasa pinjaman', is_system: true },
    { account_code: '3-3030', account_name: 'SHU Pengurus', account_type: 'equity' as AccountType, description: 'Bagian SHU untuk pengurus koperasi', is_system: true },
    { account_code: '3-3040', account_name: 'SHU Pengawas', account_type: 'equity' as AccountType, description: 'Bagian SHU untuk pengawas koperasi', is_system: true },
    { account_code: '3-3050', account_name: 'SHU Penasihat', account_type: 'equity' as AccountType, description: 'Bagian SHU untuk penasihat koperasi', is_system: true },
    
    // Income accounts (4-xxx)
    { account_code: '4-1000', account_name: 'Pendapatan Bunga Pinjaman', account_type: 'income' as AccountType, description: 'Pendapatan bunga dari angsuran pinjaman', is_system: true },
    { account_code: '4-2000', account_name: 'Pendapatan Denda Keterlambatan', account_type: 'income' as AccountType, description: 'Pendapatan denda dari angsuran terlambat', is_system: true },
    { account_code: '4-3000', account_name: 'Pendapatan Jasa Usaha', account_type: 'income' as AccountType, description: 'Pendapatan dari unit usaha koperasi', is_system: true },
    { account_code: '4-4000', account_name: 'Pendapatan Administrasi', account_type: 'income' as AccountType, description: 'Pendapatan biaya administrasi', is_system: true },
    
    // Expense accounts (5-xxx)
    { account_code: '5-1000', account_name: 'Beban Bunga Simpanan Sukarela', account_type: 'expense' as AccountType, description: 'Beban bunga yang dibayarkan ke anggota', is_system: true },
    { account_code: '5-2000', account_name: 'Beban Operasional', account_type: 'expense' as AccountType, description: 'Biaya operasional koperasi', is_system: true },
    { account_code: '5-3000', account_name: 'Beban Administrasi', account_type: 'expense' as AccountType, description: 'Biaya administrasi dan kantor', is_system: true },
    { account_code: '5-4000', account_name: 'Beban Penyusutan', account_type: 'expense' as AccountType, description: 'Beban penyusutan aset tetap', is_system: true },
  ];

  // Auto-create standard accounts for cooperative
  const createStandardAccounts = async () => {
    const existingCodes = accounts.map(a => a.account_code);
    const accountsToCreate = STANDARD_ACCOUNTS.filter(
      acc => !existingCodes.includes(acc.account_code)
    );

    if (accountsToCreate.length === 0) {
      toast.info('Semua akun standar sudah tersedia');
      return { created: 0, skipped: STANDARD_ACCOUNTS.length };
    }

    const { data, error } = await supabase
      .from('chart_of_accounts')
      .insert(accountsToCreate.map(acc => ({
        ...acc,
        is_active: true,
        balance: 0,
      })))
      .select();

    if (error) {
      console.error('Error creating standard accounts:', error);
      toast.error('Gagal membuat akun standar: ' + error.message);
      return null;
    }

    const createdCount = data?.length || 0;
    const skippedCount = STANDARD_ACCOUNTS.length - accountsToCreate.length;
    
    toast.success(`${createdCount} akun standar berhasil dibuat${skippedCount > 0 ? `, ${skippedCount} sudah ada` : ''}`);
    await fetchAccounts();
    return { created: createdCount, skipped: skippedCount };
  };

  // Check which standard accounts are missing
  const getMissingStandardAccounts = () => {
    const existingCodes = accounts.map(a => a.account_code);
    return STANDARD_ACCOUNTS.filter(acc => !existingCodes.includes(acc.account_code));
  };

  // Check if all standard accounts exist
  const hasAllStandardAccounts = () => {
    const existingCodes = accounts.map(a => a.account_code);
    return STANDARD_ACCOUNTS.every(acc => existingCodes.includes(acc.account_code));
  };

  // Get accounts by type for easier filtering
  const getAccountsByType = (type: AccountType) => {
    return accounts.filter(a => a.account_type === type && a.is_active);
  };

  // Get hierarchical structure
  const getHierarchicalAccounts = () => {
    const rootAccounts = accounts.filter(a => !a.parent_id);
    
    const buildTree = (parentId: string | null): ChartOfAccount[] => {
      return accounts
        .filter(a => a.parent_id === parentId)
        .map(account => ({
          ...account,
          children: buildTree(account.id)
        }));
    };

    return rootAccounts.map(root => ({
      ...root,
      children: buildTree(root.id)
    }));
  };

  return {
    accounts,
    loading,
    refetch: fetchAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
    updateBalance,
    getAccountsByType,
    getHierarchicalAccounts,
    createStandardAccounts,
    getMissingStandardAccounts,
    hasAllStandardAccounts,
    STANDARD_ACCOUNTS,
  };
};
