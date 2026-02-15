-- Drop and recreate the anon policy to include additional settings for loan/savings info
DROP POLICY IF EXISTS "Anon users can view registration settings" ON cooperative_settings;

CREATE POLICY "Anon users can view registration settings"
ON public.cooperative_settings FOR SELECT
TO anon
USING (
  key = ANY (ARRAY[
    -- Basic bank/savings settings
    'bank_name',
    'bank_account_number',
    'bank_account_name',
    'available_banks',
    'simpanan_pokok',
    'simpanan_wajib',
    -- Cooperative info
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
    -- Logo/card settings
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
    'branch_terminology',
    -- Loan settings (new)
    'cooperative_interest_rate',
    'cooperative_interest_calculation_method',
    'cooperative_tenor_min',
    'cooperative_tenor_max',
    'cooperative_min_loan_amount',
    'cooperative_max_loan_amount',
    'cooperative_max_loan_multiplier',
    'cooperative_late_payment_penalty',
    'cooperative_late_payment_penalty_type',
    'cooperative_late_payment_penalty_base',
    'cooperative_penalty_grace_period_days',
    -- Savings settings (new)
    'cooperative_simpanan_sukarela_interest_rate',
    'cooperative_simpanan_sukarela_min',
    'cooperative_simpanan_sukarela_interest_cutoff',
    'cooperative_simpanan_sukarela_closing_date',
    'cooperative_simpanan_sukarela_interest_method',
    'cooperative_simpanan_sukarela_min_holding_months',
    'cooperative_simpanan_wajib_due_date',
    -- Other
    'cooperative_require_simpanan_pokok',
    'cooperative_founded_date'
  ])
);