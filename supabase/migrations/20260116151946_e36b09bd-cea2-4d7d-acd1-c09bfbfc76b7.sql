-- Fix overly permissive RLS on overdue_handling table
-- Restrict to admins and loan owners only

DROP POLICY IF EXISTS "Authenticated users can view overdue handling" ON public.overdue_handling;

CREATE POLICY "Admins and loan owners can view overdue handling"
ON public.overdue_handling FOR SELECT
USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM public.loans 
    WHERE loans.id = overdue_handling.loan_id 
    AND loans.user_id = auth.uid()
  )
);