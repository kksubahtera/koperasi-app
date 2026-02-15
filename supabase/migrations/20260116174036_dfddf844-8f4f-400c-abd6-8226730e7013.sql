-- Drop and recreate RLS policy to include additional settings for registration
DROP POLICY IF EXISTS "Anon users can view registration settings" ON public.cooperative_settings;

CREATE POLICY "Anon users can view registration settings"
ON public.cooperative_settings
FOR SELECT
TO anon
USING (
  key IN (
    -- Bank/savings settings
    'bank_name', 'bank_account_number', 'bank_account_name',
    'simpanan_pokok', 'simpanan_wajib', 'available_banks',
    -- Cooperative identity
    'cooperative_name', 'cooperative_address', 'cooperative_legal_number',
    'cooperative_founding_date', 'cooperative_phone', 'cooperative_email',
    -- Vision & Mission
    'cooperative_vision', 'cooperative_mission',
    -- Services
    'cooperative_services',
    -- Logo/card settings
    'cooperative_logo', 'member_card_bg_color', 'member_card_show_photo',
    -- Loan settings
    'cooperative_interest_rate', 'cooperative_interest_calculation_method',
    'cooperative_tenor_min', 'cooperative_tenor_max',
    'cooperative_min_loan_amount', 'cooperative_max_loan_amount',
    'cooperative_max_loan_multiplier',
    'cooperative_late_payment_penalty', 'cooperative_late_payment_penalty_type',
    -- Savings settings
    'cooperative_simpanan_sukarela_interest_rate', 
    'cooperative_simpanan_sukarela_min',
    'cooperative_simpanan_sukarela_interest_cutoff',
    -- Withdrawal rules
    'cooperative_withdrawal_rules',
    -- AD/ART
    'cooperative_ad_art_content'
  )
);