-- Drop the overly permissive public access policy
DROP POLICY IF EXISTS "Anyone can view active branches" ON public.cooperative_branches;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view active branches" 
ON public.cooperative_branches 
FOR SELECT 
TO authenticated
USING (is_active = true);