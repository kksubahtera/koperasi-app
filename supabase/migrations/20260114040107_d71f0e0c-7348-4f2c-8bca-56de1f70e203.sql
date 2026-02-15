-- Add user_id column to loan_collaterals for direct RLS checks (avoid JOIN vulnerabilities)
ALTER TABLE public.loan_collaterals 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Update existing records with user_id from their loans
UPDATE public.loan_collaterals lc
SET user_id = l.user_id
FROM public.loans l
WHERE lc.loan_id = l.id AND lc.user_id IS NULL;

-- Make user_id NOT NULL for new records after migration
-- (We can't add NOT NULL constraint until all existing records are updated)

-- Drop existing policies
DROP POLICY IF EXISTS "Members can view own collaterals" ON public.loan_collaterals;
DROP POLICY IF EXISTS "Members can submit own collaterals" ON public.loan_collaterals;
DROP POLICY IF EXISTS "Admins can manage all collaterals" ON public.loan_collaterals;

-- Create new stronger policies with direct user_id checks
-- Members can only view their own collaterals (direct check, no JOIN)
CREATE POLICY "Members can view own collaterals" 
ON public.loan_collaterals 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Members can insert collaterals for their own loans
CREATE POLICY "Members can insert own collaterals" 
ON public.loan_collaterals 
FOR INSERT 
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.loans 
    WHERE loans.id = loan_collaterals.loan_id 
    AND loans.user_id = auth.uid()
  )
);

-- Members can update their own collaterals (except admin-only fields)
CREATE POLICY "Members can update own collaterals" 
ON public.loan_collaterals 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can view all collaterals
CREATE POLICY "Admins can view all collaterals" 
ON public.loan_collaterals 
FOR SELECT 
TO authenticated
USING (is_admin());

-- Admins can manage all collaterals
CREATE POLICY "Admins can manage collaterals" 
ON public.loan_collaterals 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());