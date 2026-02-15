-- Phase 1: Database Migration for NIK Encryption Security
-- First drop existing functions that have different parameter names

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.check_nik_exists(text);
DROP FUNCTION IF EXISTS public.find_user_by_nik(text);
DROP FUNCTION IF EXISTS public.get_decrypted_nik(uuid);
DROP FUNCTION IF EXISTS public.get_profile_with_nik(uuid);
DROP FUNCTION IF EXISTS public.get_all_profiles_with_nik();
DROP FUNCTION IF EXISTS public.update_member_nik(uuid, text);
DROP FUNCTION IF EXISTS public.insert_profile_with_nik(uuid, text, text, text, text, text, text, text, text, text, date, text, text, text, date, uuid, text, boolean, boolean);

-- 1. Create a function to get decrypted NIK for a specific user (for RPC calls)
CREATE OR REPLACE FUNCTION public.get_decrypted_nik(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.decrypt_nik(
    (SELECT encrypted_nik FROM public.profiles WHERE user_id = p_user_id)
  );
END;
$$;

-- 2. Create a function to get profile with decrypted NIK (for admin use)
CREATE OR REPLACE FUNCTION public.get_profile_with_nik(p_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  nik TEXT,
  member_number TEXT,
  join_date DATE,
  birth_place TEXT,
  birth_date DATE,
  gender TEXT,
  occupation TEXT,
  address TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  is_active BOOLEAN,
  approval_status TEXT,
  branch_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.name,
    p.email,
    p.phone,
    public.decrypt_nik(p.encrypted_nik) as nik,
    p.member_number,
    p.join_date,
    p.birth_place,
    p.birth_date,
    p.gender,
    p.occupation,
    p.address,
    p.bank_name,
    p.bank_account_number,
    p.bank_account_name,
    p.is_active,
    p.approval_status,
    p.branch_id
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
END;
$$;

-- 3. Create a function to get all profiles with decrypted NIK (for admin list)
CREATE OR REPLACE FUNCTION public.get_all_profiles_with_nik()
RETURNS TABLE(
  user_id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  nik TEXT,
  member_number TEXT,
  join_date DATE,
  birth_place TEXT,
  birth_date DATE,
  gender TEXT,
  occupation TEXT,
  address TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  is_active BOOLEAN,
  approval_status TEXT,
  branch_id UUID,
  exit_date DATE,
  exit_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.name,
    p.email,
    p.phone,
    public.decrypt_nik(p.encrypted_nik) as nik,
    p.member_number,
    p.join_date,
    p.birth_place,
    p.birth_date,
    p.gender,
    p.occupation,
    p.address,
    p.bank_name,
    p.bank_account_number,
    p.bank_account_name,
    p.is_active,
    p.approval_status,
    p.branch_id,
    p.exit_date,
    p.exit_reason
  FROM public.profiles p
  ORDER BY p.name;
END;
$$;

-- 4. Create check_nik_exists with new parameter name
CREATE OR REPLACE FUNCTION public.check_nik_exists(p_nik TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted_nik BYTEA;
  v_exists BOOLEAN;
BEGIN
  -- Encrypt the input NIK
  v_encrypted_nik := public.encrypt_nik(p_nik);
  
  -- Check if encrypted NIK exists
  SELECT EXISTS(
    SELECT 1 FROM public.profiles 
    WHERE encrypted_nik = v_encrypted_nik
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;

-- 5. Create find_user_by_nik with new parameter name
CREATE OR REPLACE FUNCTION public.find_user_by_nik(p_nik TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted_nik BYTEA;
  v_user_id UUID;
BEGIN
  -- Encrypt the input NIK
  v_encrypted_nik := public.encrypt_nik(p_nik);
  
  -- Find user by encrypted NIK
  SELECT user_id INTO v_user_id
  FROM public.profiles 
  WHERE encrypted_nik = v_encrypted_nik
  LIMIT 1;
  
  RETURN v_user_id;
END;
$$;

-- 6. Create a function to update NIK (encrypts automatically)
CREATE OR REPLACE FUNCTION public.update_member_nik(p_user_id UUID, p_nik TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET encrypted_nik = public.encrypt_nik(p_nik)
  WHERE user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- 7. Create a function to insert profile with NIK (for bulk import)
CREATE OR REPLACE FUNCTION public.insert_profile_with_nik(
  p_user_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_nik TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_bank_account_number TEXT DEFAULT NULL,
  p_bank_account_name TEXT DEFAULT NULL,
  p_birth_place TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_occupation TEXT DEFAULT NULL,
  p_member_number TEXT DEFAULT NULL,
  p_join_date DATE DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_approval_status TEXT DEFAULT 'pending',
  p_is_active BOOLEAN DEFAULT FALSE,
  p_is_migration BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted_nik BYTEA;
BEGIN
  -- Encrypt NIK if provided
  IF p_nik IS NOT NULL AND p_nik != '' THEN
    v_encrypted_nik := public.encrypt_nik(p_nik);
  END IF;

  INSERT INTO public.profiles (
    user_id, name, email, encrypted_nik, phone, address,
    bank_name, bank_account_number, bank_account_name,
    birth_place, birth_date, gender, occupation,
    member_number, join_date, branch_id,
    approval_status, is_active, is_migration
  ) VALUES (
    p_user_id, p_name, p_email, v_encrypted_nik, p_phone, p_address,
    p_bank_name, p_bank_account_number, p_bank_account_name,
    p_birth_place, p_birth_date, p_gender, p_occupation,
    p_member_number, p_join_date, p_branch_id,
    p_approval_status, p_is_active, p_is_migration
  );
  
  RETURN p_user_id;
END;
$$;

-- 8. Drop the old trigger
DROP TRIGGER IF EXISTS encrypt_nik_on_change ON public.profiles;

-- 9. Drop the plain text nik column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS nik;

-- 10. Update the trigger function for future updates (simplified)
CREATE OR REPLACE FUNCTION public.encrypt_nik_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- 11. Recreate trigger
CREATE TRIGGER encrypt_nik_on_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_nik_on_change();

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION public.get_decrypted_nik(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_with_nik(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_profiles_with_nik() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_nik_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_nik(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_nik(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_profile_with_nik(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, DATE, UUID, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_profile_with_nik(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, DATE, UUID, TEXT, BOOLEAN, BOOLEAN) TO service_role;