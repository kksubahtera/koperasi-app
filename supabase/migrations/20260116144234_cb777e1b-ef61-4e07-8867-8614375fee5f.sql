-- Add admin_role column for role presets
ALTER TABLE public.admin_permissions
ADD COLUMN IF NOT EXISTS admin_role TEXT DEFAULT 'custom';

-- Add comment for documentation
COMMENT ON COLUMN public.admin_permissions.admin_role IS 'Role preset: super_admin, admin_pendaftaran, admin_keuangan, custom';

-- Create function to get permissions template by role
CREATE OR REPLACE FUNCTION public.get_admin_role_template(p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_role
    WHEN 'super_admin' THEN
      -- Full access to everything
      RETURN jsonb_build_object(
        'can_approve_transactions', true,
        'can_manage_loans', true,
        'can_manage_members', true,
        'can_manage_registrations', true,
        'can_manage_resignations', true,
        'can_manage_admins', true,
        'can_manage_settings', true,
        'can_view_reports', true,
        'can_export_data', true,
        'can_manage_corrections', true,
        'can_view_audit_logs', true,
        'can_manage_accounting', true
      );
    WHEN 'admin_pendaftaran' THEN
      -- Registration and member management focus
      RETURN jsonb_build_object(
        'can_approve_transactions', false,
        'can_manage_loans', false,
        'can_manage_members', true,
        'can_manage_registrations', true,
        'can_manage_resignations', true,
        'can_manage_admins', false,
        'can_manage_settings', false,
        'can_view_reports', true,
        'can_export_data', true,
        'can_manage_corrections', false,
        'can_view_audit_logs', false,
        'can_manage_accounting', false
      );
    WHEN 'admin_keuangan' THEN
      -- Finance and accounting focus
      RETURN jsonb_build_object(
        'can_approve_transactions', true,
        'can_manage_loans', true,
        'can_manage_members', false,
        'can_manage_registrations', false,
        'can_manage_resignations', false,
        'can_manage_admins', false,
        'can_manage_settings', false,
        'can_view_reports', true,
        'can_export_data', true,
        'can_manage_corrections', true,
        'can_view_audit_logs', true,
        'can_manage_accounting', true
      );
    ELSE
      -- Custom role - return null (no template)
      RETURN NULL;
  END CASE;
END;
$$;

-- Create function to apply role template to admin
CREATE OR REPLACE FUNCTION public.apply_admin_role_template(
  p_user_id UUID,
  p_role TEXT,
  p_updated_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template JSONB;
BEGIN
  -- Get the template
  v_template := public.get_admin_role_template(p_role);
  
  IF v_template IS NULL AND p_role != 'custom' THEN
    RETURN FALSE;
  END IF;
  
  -- Update admin_permissions with template values
  IF p_role = 'custom' THEN
    -- Just update the role name, keep existing permissions
    UPDATE public.admin_permissions
    SET admin_role = p_role,
        updated_at = now(),
        updated_by = p_updated_by
    WHERE user_id = p_user_id;
  ELSE
    -- Apply the full template
    UPDATE public.admin_permissions
    SET 
      admin_role = p_role,
      can_approve_transactions = (v_template->>'can_approve_transactions')::boolean,
      can_manage_loans = (v_template->>'can_manage_loans')::boolean,
      can_manage_members = (v_template->>'can_manage_members')::boolean,
      can_manage_registrations = (v_template->>'can_manage_registrations')::boolean,
      can_manage_resignations = (v_template->>'can_manage_resignations')::boolean,
      can_manage_admins = (v_template->>'can_manage_admins')::boolean,
      can_manage_settings = (v_template->>'can_manage_settings')::boolean,
      can_view_reports = (v_template->>'can_view_reports')::boolean,
      can_export_data = (v_template->>'can_export_data')::boolean,
      can_manage_corrections = (v_template->>'can_manage_corrections')::boolean,
      can_view_audit_logs = (v_template->>'can_view_audit_logs')::boolean,
      can_manage_accounting = (v_template->>'can_manage_accounting')::boolean,
      updated_at = now(),
      updated_by = p_updated_by
    WHERE user_id = p_user_id;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_admin_role_template(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_admin_role_template(UUID, TEXT, UUID) TO authenticated;