-- Insert profile untuk user yang sudah ada tapi tidak punya profile
INSERT INTO public.profiles (user_id, name, email, member_number, approval_status, is_active)
SELECT 
  u.id as user_id,
  COALESCE(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)) as name,
  u.email,
  'MBR-' || TO_CHAR(u.created_at, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(u.id::TEXT, 1, 4)) as member_number,
  'pending' as approval_status,
  false as is_active
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Insert user_roles untuk member yang belum punya role (gunakan user_role bukan app_role)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'member'::user_role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Insert savings_summary untuk user yang belum punya
INSERT INTO public.savings_summary (user_id, simpanan_pokok, simpanan_wajib, simpanan_sukarela)
SELECT u.id, 0, 0, 0
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.savings_summary s WHERE s.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;