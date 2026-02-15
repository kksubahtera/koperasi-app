-- Create function to notify admin on new registration
CREATE OR REPLACE FUNCTION public.notify_admin_new_registration()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Only trigger for new pending registrations
  IF NEW.approval_status = 'pending' THEN
    -- Build the edge function URL
    edge_function_url := 'https://bedtswodqdxkrzviyuap.supabase.co/functions/v1/notify-admin-new-registration';
    
    -- Call the edge function via pg_net
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := jsonb_build_object(
        'userId', NEW.user_id,
        'userName', COALESCE(NEW.name, 'Anggota Baru'),
        'userEmail', COALESCE(NEW.email, 'tidak ada email')
      )
    );
    
    RAISE LOG 'Notify admin triggered for new registration: %', NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_new_member_registration ON public.profiles;

-- Create trigger for new registration notifications
CREATE TRIGGER on_new_member_registration
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_registration();