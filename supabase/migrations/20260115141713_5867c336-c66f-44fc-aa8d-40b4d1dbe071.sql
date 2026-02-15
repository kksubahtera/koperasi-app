-- Create function to cleanup expired claim tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_claim_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.account_claim_tokens
  WHERE (expires_at < NOW() - INTERVAL '1 day')
  OR (claimed_at IS NOT NULL AND claimed_at < NOW() - INTERVAL '7 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_claim_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_claim_tokens() TO service_role;