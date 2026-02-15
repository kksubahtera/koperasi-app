-- Fix: Remove 'approved' from sync_loans_to_chart_of_accounts trigger
-- 'approved' is not a valid loan_status enum value (valid: pending, active, completed, defaulted, rejected)

CREATE OR REPLACE FUNCTION public.sync_loans_to_chart_of_accounts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  diff_principal NUMERIC;
  old_principal NUMERIC;
  new_principal NUMERIC;
BEGIN
  -- Determine old principal (handle INSERT vs UPDATE)
  IF TG_OP = 'INSERT' THEN
    old_principal := 0;
  ELSE
    -- For old record, use remaining_principal if active, otherwise 0
    -- FIXED: Removed 'approved' which is not a valid loan_status enum value
    IF OLD.status = 'active' THEN
      old_principal := COALESCE(OLD.remaining_principal, OLD.principal_amount, 0);
    ELSE
      old_principal := 0;
    END IF;
  END IF;
  
  -- Determine new principal based on status
  -- FIXED: Only check for 'active' status
  IF NEW.status = 'active' THEN
    new_principal := COALESCE(NEW.remaining_principal, NEW.principal_amount, 0);
  ELSE
    -- Loan is pending/completed/rejected/defaulted, no outstanding balance yet
    new_principal := 0;
  END IF;
  
  diff_principal := new_principal - old_principal;
  
  -- Update Piutang Pinjaman Anggota (asset: debit increases balance)
  IF diff_principal <> 0 THEN
    UPDATE public.chart_of_accounts 
    SET balance = balance + diff_principal,
        updated_at = now()
    WHERE account_code = '1-2000';
  END IF;
  
  RETURN NEW;
END;
$$;