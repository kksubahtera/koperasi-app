-- 1. First, fix the validate_profile_data function to remove nik references
CREATE OR REPLACE FUNCTION public.validate_profile_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  -- NIK validation is now handled by encrypt_nik_trigger and update_member_nik
  -- We don't validate nik column here since it doesn't exist anymore (uses encrypted_nik)
  
  -- Validate email format
  IF NEW.email IS NOT NULL THEN
    IF NOT (NEW.email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
      RAISE EXCEPTION 'Invalid email format';
    END IF;
  END IF;
  
  -- Validate phone: only digits, dashes, spaces, plus sign allowed, max 20 chars
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    IF NOT (NEW.phone ~ '^[0-9\-\+\s]{1,20}$') THEN
      RAISE EXCEPTION 'Phone number contains invalid characters or is too long';
    END IF;
  END IF;
  
  -- Validate name: must be provided and have reasonable length
  IF NEW.name IS NULL OR LENGTH(TRIM(NEW.name)) < 1 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  
  IF LENGTH(NEW.name) > 255 THEN
    RAISE EXCEPTION 'Name is too long (max 255 characters)';
  END IF;
  
  -- Validate bank account number: only digits if provided, max 30 chars
  IF NEW.bank_account_number IS NOT NULL AND NEW.bank_account_number != '' THEN
    IF NOT (NEW.bank_account_number ~ '^[0-9]{1,30}$') THEN
      RAISE EXCEPTION 'Bank account number must contain only digits (max 30)';
    END IF;
  END IF;
  
  -- Trim whitespace from text fields
  NEW.name := TRIM(NEW.name);
  NEW.email := LOWER(TRIM(NEW.email));
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := TRIM(NEW.phone);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Update handle_new_user function to remove 'nik' column (use encrypted_nik via RPC)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile WITHOUT nik column (it doesn't exist anymore, use encrypted_nik)
  INSERT INTO public.profiles (
    user_id, 
    name, 
    email, 
    member_number, 
    approval_status, 
    is_active,
    phone,
    address,
    bank_name,
    bank_account_number,
    bank_account_name,
    birth_place,
    birth_date,
    gender,
    occupation,
    branch_id
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    'MBR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::TEXT, 1, 4),
    'pending',
    false,
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'address',
    NEW.raw_user_meta_data ->> 'bank_name',
    NEW.raw_user_meta_data ->> 'bank_account_number',
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.raw_user_meta_data ->> 'birth_place',
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'birth_date' IS NOT NULL 
           AND NEW.raw_user_meta_data ->> 'birth_date' != '' 
      THEN (NEW.raw_user_meta_data ->> 'birth_date')::DATE 
      ELSE NULL 
    END,
    NEW.raw_user_meta_data ->> 'gender',
    NEW.raw_user_meta_data ->> 'occupation',
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'branch_id' IS NOT NULL 
           AND NEW.raw_user_meta_data ->> 'branch_id' != '' 
      THEN (NEW.raw_user_meta_data ->> 'branch_id')::UUID 
      ELSE NULL 
    END
  );
  
  -- Encrypt NIK separately using the update_member_nik function
  IF NEW.raw_user_meta_data ->> 'nik' IS NOT NULL AND 
     NEW.raw_user_meta_data ->> 'nik' != '' THEN
    PERFORM public.update_member_nik(NEW.id, NEW.raw_user_meta_data ->> 'nik');
  END IF;
  
  -- Assign default member role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  
  -- Create savings summary
  INSERT INTO public.savings_summary (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- 3. Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Fix existing users without profiles (create profiles for orphan auth users)
INSERT INTO public.profiles (user_id, name, email, member_number, approval_status, is_active)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data ->> 'name', SPLIT_PART(au.email, '@', 1)),
  au.email,
  'MBR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(au.id::TEXT, 1, 4),
  'pending',
  false
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.user_id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 5. Add missing user_roles for users with profiles but no role
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'member'::public.user_role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 6. Add missing savings_summary for users with profiles but no savings
INSERT INTO public.savings_summary (user_id)
SELECT p.user_id
FROM public.profiles p
LEFT JOIN public.savings_summary ss ON p.user_id = ss.user_id
WHERE ss.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;