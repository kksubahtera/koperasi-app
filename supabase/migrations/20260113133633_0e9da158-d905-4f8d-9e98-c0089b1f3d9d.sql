-- Update handle_new_user function to save ALL registration data from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile with ALL registration data from metadata
  INSERT INTO public.profiles (
    user_id, 
    name, 
    email, 
    member_number, 
    approval_status, 
    is_active,
    nik,
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
    NEW.raw_user_meta_data ->> 'nik',
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
  
  -- Assign default member role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  
  -- Create savings summary
  INSERT INTO public.savings_summary (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;