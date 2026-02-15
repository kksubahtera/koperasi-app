-- First drop the existing function
DROP FUNCTION IF EXISTS public.get_profile_with_nik(uuid);

-- Then recreate with profile_photo field added
CREATE OR REPLACE FUNCTION public.get_profile_with_nik(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  name text,
  email text,
  phone text,
  nik text,
  member_number text,
  join_date date,
  birth_place text,
  birth_date date,
  gender text,
  occupation text,
  address text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  is_active boolean,
  approval_status text,
  branch_id uuid,
  profile_photo text
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
    p.profile_photo
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
END;
$$;