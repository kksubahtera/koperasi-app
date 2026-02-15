-- Allow anonymous users to view registration-related settings
CREATE POLICY "Anon users can view registration settings"
ON public.cooperative_settings
FOR SELECT
TO anon
USING (
  key = ANY (ARRAY[
    'bank_name',
    'bank_account_number', 
    'bank_account_name',
    'simpanan_pokok',
    'simpanan_wajib',
    'cooperative_name',
    'cooperative_address',
    'cooperative_legal_number',
    'cooperative_logo_base64',
    'cooperative_banner_base64',
    'cooperative_vision',
    'cooperative_mission',
    'cooperative_services',
    'cooperative_ad_art_content',
    'contact_phone',
    'logo_frame',
    'logo_size',
    'logo_container_splash',
    'logo_container_header',
    'logo_container_footer',
    'logo_container_card',
    'card_gradient_start',
    'card_gradient_end',
    'card_gradient_direction',
    'enable_branch_feature',
    'branch_terminology'
  ])
);