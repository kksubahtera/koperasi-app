-- Fix: Restrict cooperative_settings access to authenticated users only
-- This prevents public exposure of branding data (logo, legal number, address)

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view registration settings" ON public.cooperative_settings;

-- Create new policy that requires authentication for viewing settings
CREATE POLICY "Authenticated users can view registration settings"
ON public.cooperative_settings
FOR SELECT
TO authenticated
USING (
  key = ANY (ARRAY[
    'bank_name', 'bank_account_number', 'bank_account_name', 'available_banks',
    'simpanan_pokok', 'simpanan_wajib', 
    'cooperative_name', 'cooperative_address', 'cooperative_legal_number',
    'cooperative_logo_base64', 'cooperative_banner_base64',
    'cooperative_vision', 'cooperative_mission', 'cooperative_services',
    'cooperative_ad_art_content', 'contact_phone',
    'logo_frame', 'logo_size', 'logo_container_splash', 'logo_container_header',
    'logo_container_footer', 'logo_container_card',
    'card_gradient_start', 'card_gradient_end', 'card_gradient_direction',
    'card_use_gender_colors', 'card_gradient_male_start', 'card_gradient_male_end',
    'card_gradient_female_start', 'card_gradient_female_end',
    'enable_branch_feature', 'branch_terminology'
  ])
);