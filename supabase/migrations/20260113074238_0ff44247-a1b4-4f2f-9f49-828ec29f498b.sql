-- Add Modal Migrasi / Saldo Awal account to Chart of Accounts
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, is_active, is_system, description)
VALUES ('3-9000', 'Modal Migrasi / Saldo Awal', 'equity', true, true, 'Akun penyeimbang untuk migrasi saldo awal dari sistem lama')
ON CONFLICT (account_code) DO UPDATE SET
  account_name = EXCLUDED.account_name,
  account_type = EXCLUDED.account_type,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description;