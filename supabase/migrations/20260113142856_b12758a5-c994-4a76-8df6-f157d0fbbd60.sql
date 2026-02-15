-- Create a security definer function to check if current request is from service role
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role',
    false
  )
$$;

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Service role can manage claim tokens" ON public.account_claim_tokens;

-- Create new restrictive policy that only allows service role access
CREATE POLICY "Service role can manage claim tokens" 
ON public.account_claim_tokens 
FOR ALL
USING (public.is_service_role())
WITH CHECK (public.is_service_role());