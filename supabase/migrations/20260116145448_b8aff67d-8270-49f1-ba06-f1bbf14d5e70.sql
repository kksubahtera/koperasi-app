-- Add deny policies for audit logs to prevent tampering
-- Prevent UPDATE on audit_logs
CREATE POLICY "Prevent update on audit_logs" 
ON public.audit_logs FOR UPDATE TO authenticated USING (false);

-- Prevent DELETE on audit_logs
CREATE POLICY "Prevent delete on audit_logs" 
ON public.audit_logs FOR DELETE TO authenticated USING (false);

-- Prevent UPDATE on admin_activity_logs
CREATE POLICY "Prevent update on admin_activity_logs" 
ON public.admin_activity_logs FOR UPDATE TO authenticated USING (false);

-- Prevent DELETE on admin_activity_logs
CREATE POLICY "Prevent delete on admin_activity_logs" 
ON public.admin_activity_logs FOR DELETE TO authenticated USING (false);