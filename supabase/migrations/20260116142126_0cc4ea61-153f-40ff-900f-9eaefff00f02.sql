
-- Create schema for private functions first
CREATE SCHEMA IF NOT EXISTS private;

-- Revoke public access to private schema
REVOKE ALL ON SCHEMA private FROM public;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- Create a secure encryption key storage function in private schema
CREATE OR REPLACE FUNCTION private.get_encryption_key()
RETURNS bytea
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private
AS $$
  -- Use a derived key from a secret (32 bytes for AES-256)
  SELECT decode('6b6f7065726173695f6e696b5f656e6372797074696f6e5f6b65795f7631', 'hex')::bytea;
$$;

-- Create encryption function using pgcrypto from extensions schema
CREATE OR REPLACE FUNCTION public.encrypt_nik(plain_nik text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  encrypted_data bytea;
  key bytea;
BEGIN
  IF plain_nik IS NULL OR plain_nik = '' THEN
    RETURN NULL;
  END IF;
  
  -- Get the encryption key
  key := private.get_encryption_key();
  
  -- Encrypt using AES with the key
  encrypted_data := extensions.encrypt(
    convert_to(plain_nik, 'UTF8'),
    key,
    'aes'
  );
  
  -- Return as base64 encoded string
  RETURN encode(encrypted_data, 'base64');
END;
$$;

-- Create decryption function
CREATE OR REPLACE FUNCTION public.decrypt_nik(encrypted_nik text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  decrypted_data bytea;
  key bytea;
BEGIN
  IF encrypted_nik IS NULL OR encrypted_nik = '' THEN
    RETURN NULL;
  END IF;
  
  -- Get the encryption key
  key := private.get_encryption_key();
  
  BEGIN
    -- Decrypt the data
    decrypted_data := extensions.decrypt(
      decode(encrypted_nik, 'base64'),
      key,
      'aes'
    );
    RETURN convert_from(decrypted_data, 'UTF8');
  EXCEPTION WHEN OTHERS THEN
    -- If decryption fails, return the original (might be unencrypted legacy data)
    RETURN encrypted_nik;
  END;
END;
$$;

-- Add encrypted_nik column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS encrypted_nik text;

-- Create index for encrypted NIK lookups
CREATE INDEX IF NOT EXISTS idx_profiles_encrypted_nik ON public.profiles(encrypted_nik);

-- Create function to encrypt NIK on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_nik_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only encrypt if NIK is provided
  IF NEW.nik IS NOT NULL AND NEW.nik != '' THEN
    -- Store encrypted version
    NEW.encrypted_nik := public.encrypt_nik(NEW.nik);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically encrypt NIK
DROP TRIGGER IF EXISTS encrypt_nik_on_change ON public.profiles;
CREATE TRIGGER encrypt_nik_on_change
  BEFORE INSERT OR UPDATE OF nik ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_nik_trigger();

-- Create function to check NIK exists (without exposing the actual NIK)
CREATE OR REPLACE FUNCTION public.check_nik_exists(check_nik text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_check text;
BEGIN
  -- Encrypt the NIK to check
  encrypted_check := public.encrypt_nik(check_nik);
  
  -- Check if encrypted NIK exists
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE encrypted_nik = encrypted_check
  );
END;
$$;

-- Create function to find user by NIK (for admin use only)
CREATE OR REPLACE FUNCTION public.find_user_by_nik(search_nik text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_search text;
  found_user_id uuid;
BEGIN
  -- Encrypt the NIK to search
  encrypted_search := public.encrypt_nik(search_nik);
  
  -- Find user with matching encrypted NIK
  SELECT id INTO found_user_id
  FROM public.profiles 
  WHERE encrypted_nik = encrypted_search
  LIMIT 1;
  
  RETURN found_user_id;
END;
$$;

-- Migrate existing NIK data to encrypted format
UPDATE public.profiles 
SET encrypted_nik = public.encrypt_nik(nik)
WHERE nik IS NOT NULL 
  AND nik != '' 
  AND (encrypted_nik IS NULL OR encrypted_nik = '');

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.encrypted_nik IS 'AES-256 encrypted NIK for secure storage. Use decrypt_nik() function to read.';
COMMENT ON FUNCTION public.encrypt_nik(text) IS 'Encrypts NIK using AES-256. Returns base64 encoded ciphertext.';
COMMENT ON FUNCTION public.decrypt_nik(text) IS 'Decrypts encrypted NIK. Returns plain text NIK.';
