-- Add standard income accounts for business units if not exists
DO $$
BEGIN
  -- Pendapatan Penjualan Toko
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code = '4-3000') THEN
    INSERT INTO chart_of_accounts (account_code, account_name, account_type, description, is_active, is_system)
    VALUES ('4-3000', 'Pendapatan Penjualan Toko', 'income', 'Pendapatan dari penjualan di toko koperasi', true, true);
  END IF;
  
  -- Pendapatan Jasa
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code = '4-4000') THEN
    INSERT INTO chart_of_accounts (account_code, account_name, account_type, description, is_active, is_system)
    VALUES ('4-4000', 'Pendapatan Jasa', 'income', 'Pendapatan dari jasa yang diberikan koperasi', true, true);
  END IF;
  
  -- Pendapatan Pariwisata
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code = '4-5000') THEN
    INSERT INTO chart_of_accounts (account_code, account_name, account_type, description, is_active, is_system)
    VALUES ('4-5000', 'Pendapatan Pariwisata', 'income', 'Pendapatan dari unit usaha pariwisata', true, true);
  END IF;
  
  -- Persediaan Produk (untuk unit produksi)
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code = '1-3000') THEN
    INSERT INTO chart_of_accounts (account_code, account_name, account_type, description, is_active, is_system)
    VALUES ('1-3000', 'Persediaan Produk', 'asset', 'Persediaan produk hasil unit produksi', true, true);
  END IF;
  
  -- Hutang Produksi Anggota (untuk unit produksi)
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code = '2-2000') THEN
    INSERT INTO chart_of_accounts (account_code, account_name, account_type, description, is_active, is_system)
    VALUES ('2-2000', 'Hutang Produksi Anggota', 'liability', 'Hutang ke anggota atas produk yang disetor', true, true);
  END IF;
END $$;