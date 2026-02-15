-- Create private schema for sensitive functions
CREATE SCHEMA IF NOT EXISTS private;

-- Create the encryption key function in private schema
CREATE OR REPLACE FUNCTION private.get_encryption_key()
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private
AS $$
DECLARE
  key_value text;
BEGIN
  -- Try to get key from vault (if available), otherwise use a fallback
  SELECT decrypted_secret INTO key_value
  FROM vault.decrypted_secrets
  WHERE name = 'nik_encryption_key'
  LIMIT 1;
  
  -- If no vault key exists, use a derived key from project configuration
  IF key_value IS NULL THEN
    -- Use a consistent 32-byte key derived from a stable source
    -- This is a fallback - for production, store a proper key in vault
    key_value := 'koperasi_nik_encryption_key_2024';
  END IF;
  
  -- Return as bytea, ensuring 32 bytes for AES-256
  RETURN convert_to(substr(key_value || '00000000000000000000000000000000', 1, 32), 'UTF8');
END;
$$;

-- Grant execute permission to authenticated users
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_encryption_key() TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_encryption_key() TO service_role;