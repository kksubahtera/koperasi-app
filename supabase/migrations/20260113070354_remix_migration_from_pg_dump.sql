CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: account_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_type AS ENUM (
    'asset',
    'liability',
    'equity',
    'income',
    'expense'
);


--
-- Name: installment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.installment_status AS ENUM (
    'pending',
    'paid',
    'overdue',
    'partial',
    'unpaid'
);


--
-- Name: loan_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.loan_status AS ENUM (
    'pending',
    'active',
    'completed',
    'defaulted',
    'rejected'
);


--
-- Name: overdue_handling_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.overdue_handling_status AS ENUM (
    'pending',
    'contacted',
    'in_progress',
    'resolved',
    'escalated'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'transfer_bank',
    'e_wallet'
);


--
-- Name: transaction_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_type AS ENUM (
    'simpanan_pokok',
    'simpanan_wajib',
    'simpanan_sukarela',
    'setor_simpanan_wajib',
    'setor_simpanan_sukarela',
    'penarikan_simpanan_sukarela',
    'bayar_angsuran_pinjaman',
    'saldo_awal_pokok',
    'saldo_awal_wajib',
    'saldo_awal_sukarela',
    'saldo_awal_pinjaman',
    'pencairan_pinjaman'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'member',
    'admin'
);


--
-- Name: create_admin_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_admin_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    -- Check if this is the first admin (give full permissions including manage_admins)
    IF NOT EXISTS (SELECT 1 FROM public.admin_permissions) THEN
      INSERT INTO public.admin_permissions (user_id, can_manage_admins)
      VALUES (NEW.user_id, true)
      ON CONFLICT (user_id) DO NOTHING;
    ELSE
      -- For subsequent admins, create with default permissions (no manage_admins)
      INSERT INTO public.admin_permissions (user_id)
      VALUES (NEW.user_id)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: create_resignation_journal_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_resignation_journal_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_journal_id UUID;
  v_entry_number TEXT;
  v_member_name TEXT;
  v_kas_account_id UUID;
  v_simpanan_pokok_account_id UUID;
  v_simpanan_wajib_account_id UUID;
  v_simpanan_sukarela_account_id UUID;
  v_piutang_account_id UUID;
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Get member name
    SELECT name INTO v_member_name
    FROM public.profiles
    WHERE user_id = NEW.user_id;
    
    -- Generate journal entry number
    v_entry_number := public.generate_journal_entry_number();
    
    -- Get account IDs using CORRECT account codes
    SELECT id INTO v_kas_account_id FROM public.chart_of_accounts WHERE account_code = '1-1000' LIMIT 1;
    SELECT id INTO v_simpanan_pokok_account_id FROM public.chart_of_accounts WHERE account_code = '2-1010' LIMIT 1;
    SELECT id INTO v_simpanan_wajib_account_id FROM public.chart_of_accounts WHERE account_code = '2-1020' LIMIT 1;
    SELECT id INTO v_simpanan_sukarela_account_id FROM public.chart_of_accounts WHERE account_code = '2-1030' LIMIT 1;
    SELECT id INTO v_piutang_account_id FROM public.chart_of_accounts WHERE account_code = '1-2000' LIMIT 1;
    
    -- Only create journal if kas account exists
    IF v_kas_account_id IS NOT NULL THEN
      -- Create journal entry
      INSERT INTO public.journal_entries (
        entry_number,
        entry_date,
        description,
        status,
        total_debit,
        total_credit,
        is_balanced,
        reference_type,
        reference_id,
        created_by
      ) VALUES (
        v_entry_number,
        CURRENT_DATE,
        format('Pengembalian simpanan - Pengunduran diri anggota %s', COALESCE(v_member_name, 'Unknown')),
        'approved',
        NEW.total_savings,
        NEW.total_savings,
        true,
        'resignation',
        NEW.id,
        NEW.processed_by
      ) RETURNING id INTO v_journal_id;
      
      -- Create journal entry lines
      -- Debit: Simpanan accounts (decrease liability)
      IF NEW.simpanan_pokok > 0 AND v_simpanan_pokok_account_id IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
        VALUES (v_journal_id, v_simpanan_pokok_account_id, NEW.simpanan_pokok, 0, 'Pengembalian simpanan pokok');
      END IF;
      
      IF NEW.simpanan_wajib > 0 AND v_simpanan_wajib_account_id IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
        VALUES (v_journal_id, v_simpanan_wajib_account_id, NEW.simpanan_wajib, 0, 'Pengembalian simpanan wajib');
      END IF;
      
      IF NEW.simpanan_sukarela > 0 AND v_simpanan_sukarela_account_id IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
        VALUES (v_journal_id, v_simpanan_sukarela_account_id, NEW.simpanan_sukarela, 0, 'Pengembalian simpanan sukarela');
      END IF;
      
      -- Credit: Kas (if there's refund) or Piutang (if loan paid off)
      IF NEW.refund_amount > 0 THEN
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
        VALUES (v_journal_id, v_kas_account_id, 0, NEW.refund_amount, 'Pengembalian dana ke anggota');
      END IF;
      
      IF NEW.remaining_loan_principal > 0 AND v_piutang_account_id IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
        VALUES (v_journal_id, v_piutang_account_id, 0, NEW.remaining_loan_principal + NEW.total_penalties, 'Pelunasan pinjaman dari simpanan');
      END IF;
      
      -- Update resignation request with journal entry ID
      NEW.journal_entry_id := v_journal_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: delete_admin_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_admin_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.role = 'admin' THEN
    DELETE FROM public.admin_permissions WHERE user_id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;


--
-- Name: generate_journal_entry_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_journal_entry_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_number TEXT;
  seq_num INTEGER;
  current_year TEXT;
  current_month TEXT;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  current_month := TO_CHAR(NOW(), 'MM');
  
  SELECT COUNT(*) + 1 INTO seq_num 
  FROM public.journal_entries 
  WHERE TO_CHAR(created_at, 'YYYYMM') = current_year || current_month;
  
  new_number := 'JRN-' || current_year || current_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$;


--
-- Name: generate_member_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_member_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_number TEXT;
  seq_num INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num FROM public.profiles;
  new_number := 'MBR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$;


--
-- Name: get_next_letter_number(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_letter_number(p_letter_type text, p_reset_period text DEFAULT 'yearly'::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_year integer;
  v_month integer;
  v_next_seq integer;
  v_prefix text;
  v_letter_number text;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  IF p_reset_period = 'monthly' THEN
    v_month := EXTRACT(MONTH FROM CURRENT_DATE);
  ELSE
    v_month := NULL;
  END IF;
  
  -- Get or create sequence
  INSERT INTO public.letter_sequences (letter_type, year, month, current_sequence)
  VALUES (p_letter_type, v_year, v_month, 1)
  ON CONFLICT (letter_type, year, month) 
  DO UPDATE SET 
    current_sequence = letter_sequences.current_sequence + 1,
    updated_at = now()
  RETURNING current_sequence INTO v_next_seq;
  
  -- Determine prefix based on letter type
  CASE p_letter_type
    WHEN 'loan_approval' THEN v_prefix := 'SP';
    WHEN 'withdrawal' THEN v_prefix := 'PS';
    WHEN 'resignation' THEN v_prefix := 'PD';
    ELSE v_prefix := 'SR';
  END CASE;
  
  -- Format letter number
  IF p_reset_period = 'monthly' THEN
    v_letter_number := LPAD(v_next_seq::text, 3, '0') || '/' || v_prefix || '/' || 
                       TO_CHAR(TO_DATE(v_month::text, 'MM'), 'Mon') || '/' || v_year;
  ELSE
    v_letter_number := LPAD(v_next_seq::text, 3, '0') || '/' || v_prefix || '/' || v_year;
  END IF;
  
  RETURN v_letter_number;
END;
$$;


--
-- Name: get_next_member_number(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_member_number(p_prefix text, p_date text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count integer;
  v_number text;
BEGIN
  -- Count existing members with same prefix and date pattern
  SELECT COUNT(*) + 1 INTO v_count
  FROM profiles
  WHERE member_number LIKE p_prefix || '-' || p_date || '-%';
  
  -- Format the member number
  v_number := p_prefix || '-' || p_date || '-' || LPAD(v_count::text, 4, '0');
  
  RETURN v_number;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Create profile with pending approval status
  INSERT INTO public.profiles (user_id, name, email, member_number, approval_status, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    'MBR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::TEXT, 1, 4),
    'pending',
    false
  );
  
  -- Assign default member role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  
  -- Create savings summary
  INSERT INTO public.savings_summary (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;


--
-- Name: has_admin_permission(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_admin_permission(_user_id uuid, _permission text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  has_perm BOOLEAN;
BEGIN
  -- First check if user is admin
  IF NOT public.has_role(_user_id, 'admin') THEN
    RETURN FALSE;
  END IF;
  
  -- If no permissions record exists, grant all permissions (backward compatibility)
  IF NOT EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = _user_id) THEN
    RETURN TRUE;
  END IF;
  
  -- Check specific permission
  EXECUTE format(
    'SELECT %I FROM public.admin_permissions WHERE user_id = $1',
    'can_' || _permission
  ) INTO has_perm USING _user_id;
  
  RETURN COALESCE(has_perm, FALSE);
END;
$_$;


--
-- Name: has_role(uuid, public.user_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.user_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: initialize_journal_templates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_journal_templates() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.journal_templates;
  
  IF v_count = 0 THEN
    -- Insert default templates
    INSERT INTO public.journal_templates (type, name, description, lines, is_active)
    VALUES
      ('simpanan_pokok', 'Simpanan Pokok', 'Jurnal otomatis untuk penerimaan simpanan pokok anggota baru',
       '[{"accountId": "", "isDebit": true, "description": "Kas/Bank (penerimaan)"}, {"accountId": "", "isDebit": false, "description": "Hutang Simpanan Pokok"}]'::jsonb,
       true),
      ('saldo_awal_pokok', 'Saldo Awal Simpanan Pokok', 'Jurnal migrasi saldo awal simpanan pokok anggota lama',
       '[{"accountId": "", "isDebit": true, "description": "Modal Migrasi / Saldo Awal"}, {"accountId": "", "isDebit": false, "description": "Hutang Simpanan Pokok"}]'::jsonb,
       true),
      ('saldo_awal_wajib', 'Saldo Awal Simpanan Wajib', 'Jurnal migrasi saldo awal simpanan wajib anggota lama',
       '[{"accountId": "", "isDebit": true, "description": "Modal Migrasi / Saldo Awal"}, {"accountId": "", "isDebit": false, "description": "Hutang Simpanan Wajib"}]'::jsonb,
       true),
      ('saldo_awal_sukarela', 'Saldo Awal Simpanan Sukarela', 'Jurnal migrasi saldo awal simpanan sukarela anggota lama',
       '[{"accountId": "", "isDebit": true, "description": "Modal Migrasi / Saldo Awal"}, {"accountId": "", "isDebit": false, "description": "Hutang Simpanan Sukarela"}]'::jsonb,
       true),
      ('saldo_awal_pinjaman', 'Saldo Awal Pinjaman', 'Jurnal migrasi saldo awal piutang pinjaman anggota lama',
       '[{"accountId": "", "isDebit": true, "description": "Piutang Pinjaman Anggota"}, {"accountId": "", "isDebit": false, "description": "Modal Migrasi / Saldo Awal"}]'::jsonb,
       true),
      ('simpanan_wajib', 'Simpanan Wajib', 'Jurnal otomatis untuk penerimaan simpanan wajib bulanan',
       '[{"accountId": "", "isDebit": true, "description": "Kas/Bank (penerimaan)"}, {"accountId": "", "isDebit": false, "description": "Hutang Simpanan Wajib"}]'::jsonb,
       true),
      ('setor_simpanan_wajib', 'Setor Simpanan Wajib', 'Jurnal otomatis untuk setoran simpanan wajib',
       '[{"accountId": "", "isDebit": true, "description": "Kas/Bank (penerimaan)"}, {"accountId": "", "isDebit": false, "description": "Hutang Simpanan Wajib"}]'::jsonb,
       true),
      ('simpanan_sukarela', 'Simpanan Sukarela', 'Jurnal otomatis untuk penerimaan simpanan sukarela',
       '[{"accountId": "", "isDebit": true, "description": "Kas/Bank (penerimaan)"}, {"accountId": "", "isDebit": false, "description": "Hutang Simpanan Sukarela"}]'::jsonb,
       true),
      ('setor_simpanan_sukarela', 'Setor Simpanan Sukarela', 'Jurnal otomatis untuk setoran simpanan sukarela',
       '[{"accountId": "", "isDebit": true, "description": "Kas/Bank (penerimaan)"}, {"accountId": "", "isDebit": false, "description": "Hutang Simpanan Sukarela"}]'::jsonb,
       true),
      ('penarikan_simpanan_sukarela', 'Penarikan Simpanan Sukarela', 'Jurnal otomatis untuk penarikan simpanan sukarela (termasuk bunga jika ada)',
       '[{"accountId": "", "isDebit": true, "description": "Hutang Simpanan Sukarela"}, {"accountId": "", "isDebit": true, "description": "Beban Bunga Simpanan Sukarela (jika ada)"}, {"accountId": "", "isDebit": false, "description": "Kas/Bank (pengeluaran)"}]'::jsonb,
       true),
      ('pencairan_pinjaman', 'Pencairan Pinjaman', 'Jurnal otomatis untuk pencairan pinjaman ke anggota',
       '[{"accountId": "", "isDebit": true, "description": "Piutang Pinjaman Anggota"}, {"accountId": "", "isDebit": false, "description": "Kas/Bank (pengeluaran)"}]'::jsonb,
       true),
      ('bayar_angsuran_pinjaman', 'Pembayaran Angsuran', 'Jurnal otomatis untuk pembayaran angsuran (pokok + bunga + denda jika ada)',
       '[{"accountId": "", "isDebit": true, "description": "Kas/Bank (penerimaan total)"}, {"accountId": "", "isDebit": false, "description": "Piutang Pinjaman (pokok)"}, {"accountId": "", "isDebit": false, "description": "Pendapatan Bunga Pinjaman"}, {"accountId": "", "isDebit": false, "description": "Pendapatan Denda Keterlambatan (jika ada)"}]'::jsonb,
       true);
  END IF;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;


--
-- Name: log_journal_template_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_journal_template_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_action TEXT;
  v_summary TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_summary := format('Template "%s" (%s) dibuat', NEW.name, NEW.type);
    
    INSERT INTO public.journal_template_audit_logs (
      template_id, action, changed_by, new_data, change_summary
    ) VALUES (
      NEW.id, v_action, NEW.created_by, to_jsonb(NEW), v_summary
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine what changed
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      v_action := 'toggle';
      v_summary := format('Template "%s" %s', NEW.name, 
        CASE WHEN NEW.is_active THEN 'diaktifkan' ELSE 'dinonaktifkan' END);
    ELSIF OLD.lines::text IS DISTINCT FROM NEW.lines::text THEN
      v_action := 'update';
      v_summary := format('Konfigurasi akun template "%s" diperbarui', NEW.name);
    ELSE
      v_action := 'update';
      v_summary := format('Template "%s" diperbarui', NEW.name);
    END IF;
    
    INSERT INTO public.journal_template_audit_logs (
      template_id, action, changed_by, old_data, new_data, change_summary
    ) VALUES (
      NEW.id, v_action, NEW.updated_by, to_jsonb(OLD), to_jsonb(NEW), v_summary
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;


--
-- Name: log_savings_summary_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_savings_summary_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only log if there are actual changes
    IF OLD.simpanan_pokok IS DISTINCT FROM NEW.simpanan_pokok OR
       OLD.simpanan_wajib IS DISTINCT FROM NEW.simpanan_wajib OR
       OLD.simpanan_sukarela IS DISTINCT FROM NEW.simpanan_sukarela OR
       OLD.total_simpanan IS DISTINCT FROM NEW.total_simpanan THEN
      INSERT INTO public.savings_audit_log (
        user_id,
        change_type,
        old_simpanan_pokok,
        new_simpanan_pokok,
        old_simpanan_wajib,
        new_simpanan_wajib,
        old_simpanan_sukarela,
        new_simpanan_sukarela,
        old_total_simpanan,
        new_total_simpanan,
        source
      ) VALUES (
        NEW.user_id,
        'update',
        OLD.simpanan_pokok,
        NEW.simpanan_pokok,
        OLD.simpanan_wajib,
        NEW.simpanan_wajib,
        OLD.simpanan_sukarela,
        NEW.simpanan_sukarela,
        OLD.total_simpanan,
        NEW.total_simpanan,
        'trigger'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: notify_admin_on_member_resignation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admin_on_member_resignation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if member is being deactivated (resigned)
  IF OLD.is_active = true AND NEW.is_active = false AND NEW.exit_date IS NOT NULL THEN
    -- Insert notification for admin
    INSERT INTO public.admin_notifications (
      title,
      message,
      notification_type,
      metadata
    ) VALUES (
      'Anggota Mengundurkan Diri',
      format('Anggota %s (%s) telah mengundurkan diri dari koperasi pada tanggal %s.',
        NEW.name,
        COALESCE(NEW.member_number, '-'),
        to_char(NEW.exit_date, 'DD Mon YYYY')
      ),
      'member_resignation',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'member_name', NEW.name,
        'member_number', NEW.member_number,
        'exit_date', NEW.exit_date,
        'exit_year', NEW.exit_year
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: notify_admin_on_new_registration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admin_on_new_registration() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only notify for new pending registrations
  IF NEW.approval_status = 'pending' THEN
    INSERT INTO public.admin_notifications (
      title,
      message,
      notification_type,
      metadata
    ) VALUES (
      'Pendaftaran Anggota Baru',
      format('Calon anggota %s (%s) telah mendaftar dan menunggu persetujuan.',
        NEW.name,
        NEW.email
      ),
      'new_registration',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'member_name', NEW.name,
        'email', NEW.email,
        'phone', NEW.phone,
        'registered_at', NEW.created_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: notify_admin_on_resignation_request(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admin_on_resignation_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  member_name TEXT;
  member_number TEXT;
BEGIN
  -- Get member info
  SELECT name, member_number INTO member_name, member_number
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
  -- Insert admin notification
  INSERT INTO public.admin_notifications (
    title,
    message,
    notification_type,
    metadata
  ) VALUES (
    'Pengajuan Pengunduran Diri Baru',
    format('Anggota %s (%s) mengajukan pengunduran diri. Total pengembalian: Rp %s',
      COALESCE(member_name, 'Unknown'),
      COALESCE(member_number, '-'),
      to_char(NEW.refund_amount, 'FM999,999,999,999')
    ),
    'resignation_request',
    jsonb_build_object(
      'request_id', NEW.id,
      'user_id', NEW.user_id,
      'member_name', member_name,
      'member_number', member_number,
      'total_savings', NEW.total_savings,
      'total_arrears', NEW.total_arrears,
      'refund_amount', NEW.refund_amount
    )
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: notify_member_on_business_transaction(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_member_on_business_transaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  unit_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Only create notification for member transactions
  IF NEW.is_member_transaction = true THEN
    -- Get business unit name
    SELECT name INTO unit_name 
    FROM public.business_units 
    WHERE id = NEW.business_unit_id;
    
    -- Create notification title and message
    notification_title := 'Transaksi Unit Usaha Tercatat';
    notification_message := format(
      'Transaksi senilai Rp %s telah tercatat di unit usaha %s pada tanggal %s.',
      to_char(NEW.amount, 'FM999,999,999,999'),
      COALESCE(unit_name, 'Unknown'),
      to_char(NEW.transaction_date, 'DD Mon YYYY')
    );
    
    -- Insert notification
    INSERT INTO public.member_notifications (
      user_id,
      title,
      message,
      notification_type,
      metadata
    ) VALUES (
      NEW.user_id,
      notification_title,
      notification_message,
      'business_transaction',
      jsonb_build_object(
        'transaction_id', NEW.id,
        'business_unit_id', NEW.business_unit_id,
        'business_unit_name', unit_name,
        'amount', NEW.amount,
        'transaction_type', NEW.transaction_type,
        'transaction_date', NEW.transaction_date
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: perform_reconciliation_check(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.perform_reconciliation_check(p_user_id uuid DEFAULT NULL::uuid) RETURNS TABLE(is_reconciled boolean, savings_total numeric, coa_total numeric, loan_remaining numeric, coa_piutang numeric, diff_savings numeric, diff_loans numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_savings_pokok NUMERIC;
  v_savings_wajib NUMERIC;
  v_savings_sukarela NUMERIC;
  v_savings_total NUMERIC;
  v_coa_pokok NUMERIC;
  v_coa_wajib NUMERIC;
  v_coa_sukarela NUMERIC;
  v_coa_total NUMERIC;
  v_loan_remaining NUMERIC;
  v_coa_piutang NUMERIC;
  v_diff_pokok NUMERIC;
  v_diff_wajib NUMERIC;
  v_diff_sukarela NUMERIC;
  v_diff_savings NUMERIC;
  v_diff_loans NUMERIC;
  v_is_reconciled BOOLEAN;
BEGIN
  -- Get savings summary totals
  SELECT 
    COALESCE(SUM(simpanan_pokok), 0),
    COALESCE(SUM(simpanan_wajib), 0),
    COALESCE(SUM(simpanan_sukarela), 0)
  INTO v_savings_pokok, v_savings_wajib, v_savings_sukarela
  FROM public.savings_summary;
  
  v_savings_total := v_savings_pokok + v_savings_wajib + v_savings_sukarela;
  
  -- Get COA balances
  SELECT COALESCE(balance, 0) INTO v_coa_pokok
  FROM public.chart_of_accounts WHERE account_code = '2-1010';
  
  SELECT COALESCE(balance, 0) INTO v_coa_wajib
  FROM public.chart_of_accounts WHERE account_code = '2-1020';
  
  SELECT COALESCE(balance, 0) INTO v_coa_sukarela
  FROM public.chart_of_accounts WHERE account_code = '2-1030';
  
  SELECT COALESCE(balance, 0) INTO v_coa_piutang
  FROM public.chart_of_accounts WHERE account_code = '1-2000';
  
  v_coa_total := COALESCE(v_coa_pokok, 0) + COALESCE(v_coa_wajib, 0) + COALESCE(v_coa_sukarela, 0);
  
  -- Get loan remaining principal
  SELECT COALESCE(SUM(remaining_principal), 0)
  INTO v_loan_remaining
  FROM public.loans
  WHERE status IN ('active', 'approved');
  
  -- Calculate differences
  v_diff_pokok := v_savings_pokok - COALESCE(v_coa_pokok, 0);
  v_diff_wajib := v_savings_wajib - COALESCE(v_coa_wajib, 0);
  v_diff_sukarela := v_savings_sukarela - COALESCE(v_coa_sukarela, 0);
  v_diff_savings := v_savings_total - v_coa_total;
  v_diff_loans := v_loan_remaining - COALESCE(v_coa_piutang, 0);
  
  -- Check if reconciled (within 1 rupiah tolerance)
  v_is_reconciled := ABS(v_diff_savings) < 1 AND ABS(v_diff_loans) < 1;
  
  -- Log the reconciliation check
  INSERT INTO public.reconciliation_logs (
    checked_by,
    savings_pokok, savings_wajib, savings_sukarela, savings_total,
    coa_hutang_pokok, coa_hutang_wajib, coa_hutang_sukarela, coa_hutang_total,
    loans_remaining_principal, coa_piutang_pinjaman,
    diff_pokok, diff_wajib, diff_sukarela, diff_savings_total, diff_loan_piutang,
    is_reconciled
  ) VALUES (
    p_user_id,
    v_savings_pokok, v_savings_wajib, v_savings_sukarela, v_savings_total,
    COALESCE(v_coa_pokok, 0), COALESCE(v_coa_wajib, 0), COALESCE(v_coa_sukarela, 0), v_coa_total,
    v_loan_remaining, COALESCE(v_coa_piutang, 0),
    v_diff_pokok, v_diff_wajib, v_diff_sukarela, v_diff_savings, v_diff_loans,
    v_is_reconciled
  );
  
  RETURN QUERY SELECT 
    v_is_reconciled,
    v_savings_total,
    v_coa_total,
    v_loan_remaining,
    COALESCE(v_coa_piutang, 0),
    v_diff_savings,
    v_diff_loans;
END;
$$;


--
-- Name: prevent_member_branch_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_member_branch_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- If branch_id is being changed
  IF OLD.branch_id IS DISTINCT FROM NEW.branch_id THEN
    -- Check if user is admin using existing is_admin() function
    IF NOT public.is_admin() THEN
      -- Revert branch_id to old value (silently prevent change)
      NEW.branch_id := OLD.branch_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_coa_from_savings(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_coa_from_savings(p_user_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_savings_pokok NUMERIC;
  v_savings_wajib NUMERIC;
  v_savings_sukarela NUMERIC;
  v_loan_remaining NUMERIC;
BEGIN
  -- Get savings totals
  SELECT 
    COALESCE(SUM(simpanan_pokok), 0),
    COALESCE(SUM(simpanan_wajib), 0),
    COALESCE(SUM(simpanan_sukarela), 0)
  INTO v_savings_pokok, v_savings_wajib, v_savings_sukarela
  FROM public.savings_summary;
  
  -- Get loan remaining
  SELECT COALESCE(SUM(remaining_principal), 0)
  INTO v_loan_remaining
  FROM public.loans
  WHERE status IN ('active', 'approved');
  
  -- Update COA balances
  UPDATE public.chart_of_accounts 
  SET balance = v_savings_pokok, updated_at = now()
  WHERE account_code = '2-1010';
  
  UPDATE public.chart_of_accounts 
  SET balance = v_savings_wajib, updated_at = now()
  WHERE account_code = '2-1020';
  
  UPDATE public.chart_of_accounts 
  SET balance = v_savings_sukarela, updated_at = now()
  WHERE account_code = '2-1030';
  
  UPDATE public.chart_of_accounts 
  SET balance = v_loan_remaining, updated_at = now()
  WHERE account_code = '1-2000';
  
  -- Log the sync action
  INSERT INTO public.reconciliation_logs (
    checked_by,
    savings_pokok, savings_wajib, savings_sukarela, savings_total,
    coa_hutang_pokok, coa_hutang_wajib, coa_hutang_sukarela, coa_hutang_total,
    loans_remaining_principal, coa_piutang_pinjaman,
    diff_pokok, diff_wajib, diff_sukarela, diff_savings_total, diff_loan_piutang,
    is_reconciled,
    action_taken
  ) VALUES (
    p_user_id,
    v_savings_pokok, v_savings_wajib, v_savings_sukarela, 
    v_savings_pokok + v_savings_wajib + v_savings_sukarela,
    v_savings_pokok, v_savings_wajib, v_savings_sukarela,
    v_savings_pokok + v_savings_wajib + v_savings_sukarela,
    v_loan_remaining, v_loan_remaining,
    0, 0, 0, 0, 0,
    true,
    'AUTO_SYNC: Sinkronisasi saldo COA dari savings_summary dan loans'
  );
  
  RETURN true;
END;
$$;


--
-- Name: sync_email_from_auth(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_email_from_auth() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles 
    SET email = NEW.email, updated_at = NOW()
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_loans_to_chart_of_accounts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_loans_to_chart_of_accounts() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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
    IF OLD.status IN ('active', 'approved') THEN
      old_principal := COALESCE(OLD.remaining_principal, OLD.principal_amount, 0);
    ELSE
      old_principal := 0;
    END IF;
  END IF;
  
  -- Determine new principal based on status
  IF NEW.status IN ('active', 'approved') THEN
    new_principal := COALESCE(NEW.remaining_principal, NEW.principal_amount, 0);
  ELSE
    -- Loan is completed/rejected, no outstanding balance
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


--
-- Name: sync_savings_to_chart_of_accounts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_savings_to_chart_of_accounts() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  diff_pokok NUMERIC;
  diff_wajib NUMERIC;
  diff_sukarela NUMERIC;
BEGIN
  -- Calculate differences between old and new values
  diff_pokok := COALESCE(NEW.simpanan_pokok, 0) - COALESCE(OLD.simpanan_pokok, 0);
  diff_wajib := COALESCE(NEW.simpanan_wajib, 0) - COALESCE(OLD.simpanan_wajib, 0);
  diff_sukarela := COALESCE(NEW.simpanan_sukarela, 0) - COALESCE(OLD.simpanan_sukarela, 0);
  
  -- Update Hutang Simpanan Pokok (liability: credit increases balance)
  IF diff_pokok <> 0 THEN
    UPDATE public.chart_of_accounts 
    SET balance = balance + diff_pokok,
        updated_at = now()
    WHERE account_code = '2-1010';
  END IF;
  
  -- Update Hutang Simpanan Wajib
  IF diff_wajib <> 0 THEN
    UPDATE public.chart_of_accounts 
    SET balance = balance + diff_wajib,
        updated_at = now()
    WHERE account_code = '2-1020';
  END IF;
  
  -- Update Hutang Simpanan Sukarela
  IF diff_sukarela <> 0 THEN
    UPDATE public.chart_of_accounts 
    SET balance = balance + diff_sukarela,
        updated_at = now()
    WHERE account_code = '2-1030';
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_savings_on_transaction(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_savings_on_transaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Update savings based on transaction type
    IF NEW.type = 'simpanan_pokok' OR NEW.type = 'saldo_awal_pokok' THEN
      UPDATE public.savings_summary 
      SET simpanan_pokok = simpanan_pokok + NEW.amount,
          total_simpanan = total_simpanan + NEW.amount
      WHERE user_id = NEW.user_id;
    ELSIF NEW.type IN ('simpanan_wajib', 'setor_simpanan_wajib', 'saldo_awal_wajib') THEN
      UPDATE public.savings_summary 
      SET simpanan_wajib = simpanan_wajib + NEW.amount,
          total_simpanan = total_simpanan + NEW.amount
      WHERE user_id = NEW.user_id;
    ELSIF NEW.type IN ('simpanan_sukarela', 'setor_simpanan_sukarela', 'saldo_awal_sukarela') THEN
      UPDATE public.savings_summary 
      SET simpanan_sukarela = simpanan_sukarela + NEW.amount,
          total_simpanan = total_simpanan + NEW.amount
      WHERE user_id = NEW.user_id;
    ELSIF NEW.type = 'penarikan_simpanan_sukarela' THEN
      UPDATE public.savings_summary 
      SET simpanan_sukarela = simpanan_sukarela - NEW.amount,
          total_simpanan = total_simpanan - NEW.amount
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: validate_loan_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_loan_data() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Validate principal amount: must be positive
  IF NEW.principal_amount IS NULL OR NEW.principal_amount <= 0 THEN
    RAISE EXCEPTION 'Loan principal amount must be positive';
  END IF;
  
  -- Validate principal amount: reasonable maximum
  IF NEW.principal_amount > 10000000000 THEN
    RAISE EXCEPTION 'Loan principal amount exceeds maximum allowed';
  END IF;
  
  -- Validate tenor: must be positive and reasonable (1-360 months)
  IF NEW.tenor IS NULL OR NEW.tenor < 1 OR NEW.tenor > 360 THEN
    RAISE EXCEPTION 'Loan tenor must be between 1 and 360 months';
  END IF;
  
  -- Validate interest rate: must be non-negative and reasonable (0-100%)
  IF NEW.interest_rate IS NOT NULL AND (NEW.interest_rate < 0 OR NEW.interest_rate > 1) THEN
    RAISE EXCEPTION 'Interest rate must be between 0 and 100 percent (0-1)';
  END IF;
  
  -- Trim rejection reason if provided
  IF NEW.rejection_reason IS NOT NULL THEN
    NEW.rejection_reason := TRIM(NEW.rejection_reason);
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: validate_profile_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_profile_data() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $_$
BEGIN
  -- Validate NIK: must be exactly 16 digits if provided
  IF NEW.nik IS NOT NULL AND NEW.nik != '' THEN
    IF NOT (NEW.nik ~ '^[0-9]{16}$') THEN
      RAISE EXCEPTION 'NIK must be exactly 16 digits';
    END IF;
  END IF;
  
  -- Validate email format
  IF NEW.email IS NOT NULL THEN
    IF NOT (NEW.email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
      RAISE EXCEPTION 'Invalid email format';
    END IF;
  END IF;
  
  -- Validate phone: only digits, dashes, spaces, plus sign allowed, max 20 chars
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    IF NOT (NEW.phone ~ '^[0-9\-\+\s]{1,20}$') THEN
      RAISE EXCEPTION 'Phone number contains invalid characters or is too long';
    END IF;
  END IF;
  
  -- Validate name: must be provided and have reasonable length
  IF NEW.name IS NULL OR LENGTH(TRIM(NEW.name)) < 1 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  
  IF LENGTH(NEW.name) > 255 THEN
    RAISE EXCEPTION 'Name is too long (max 255 characters)';
  END IF;
  
  -- Validate bank account number: only digits if provided, max 30 chars
  IF NEW.bank_account_number IS NOT NULL AND NEW.bank_account_number != '' THEN
    IF NOT (NEW.bank_account_number ~ '^[0-9]{1,30}$') THEN
      RAISE EXCEPTION 'Bank account number must contain only digits (max 30)';
    END IF;
  END IF;
  
  -- Trim whitespace from text fields
  NEW.name := TRIM(NEW.name);
  NEW.email := LOWER(TRIM(NEW.email));
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := TRIM(NEW.phone);
  END IF;
  
  RETURN NEW;
END;
$_$;


--
-- Name: validate_transaction_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_transaction_data() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Validate amount: must be positive
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Transaction amount must be positive';
  END IF;
  
  -- Validate amount: reasonable maximum (1 billion)
  IF NEW.amount > 1000000000000 THEN
    RAISE EXCEPTION 'Transaction amount exceeds maximum allowed';
  END IF;
  
  -- Validate notes: max 1000 characters
  IF NEW.notes IS NOT NULL AND LENGTH(NEW.notes) > 1000 THEN
    RAISE EXCEPTION 'Notes are too long (max 1000 characters)';
  END IF;
  
  -- Trim whitespace from text fields
  IF NEW.notes IS NOT NULL THEN
    NEW.notes := TRIM(NEW.notes);
  END IF;
  IF NEW.account_holder_name IS NOT NULL THEN
    NEW.account_holder_name := TRIM(NEW.account_holder_name);
  END IF;
  
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: account_claim_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_claim_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    ip_address text,
    user_agent text
);


--
-- Name: admin_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid NOT NULL,
    action_type text NOT NULL,
    target_entity text,
    target_id uuid,
    description text NOT NULL,
    ip_address text,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false NOT NULL,
    read_by uuid,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.admin_notifications REPLICA IDENTITY FULL;


--
-- Name: admin_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    can_approve_transactions boolean DEFAULT true,
    can_manage_loans boolean DEFAULT true,
    can_manage_members boolean DEFAULT true,
    can_manage_registrations boolean DEFAULT true,
    can_manage_resignations boolean DEFAULT true,
    can_manage_admins boolean DEFAULT false,
    can_manage_settings boolean DEFAULT true,
    can_view_reports boolean DEFAULT true,
    can_export_data boolean DEFAULT true,
    can_manage_corrections boolean DEFAULT true,
    can_view_audit_logs boolean DEFAULT true,
    can_manage_accounting boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);


--
-- Name: archived_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archived_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_user_id uuid NOT NULL,
    member_number text,
    name text NOT NULL,
    email text,
    phone text,
    nik text,
    address text,
    bank_name text,
    bank_account_number text,
    bank_account_name text,
    join_date date,
    branch_id uuid,
    simpanan_pokok numeric DEFAULT 0,
    simpanan_wajib numeric DEFAULT 0,
    simpanan_sukarela numeric DEFAULT 0,
    total_simpanan numeric DEFAULT 0,
    outstanding_loan numeric DEFAULT 0,
    archive_reason text NOT NULL,
    archived_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_by uuid,
    days_since_creation integer,
    was_claimed boolean DEFAULT false,
    original_profile_data jsonb,
    original_savings_data jsonb,
    original_loans_data jsonb,
    original_transactions_data jsonb
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    description text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    ip_address text,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: balance_sheets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.balance_sheets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    year integer NOT NULL,
    kas numeric DEFAULT 0 NOT NULL,
    bank numeric DEFAULT 0 NOT NULL,
    piutang numeric DEFAULT 0 NOT NULL,
    total_assets numeric DEFAULT 0 NOT NULL,
    saldo_awal_simpanan_pokok numeric DEFAULT 0 NOT NULL,
    saldo_awal_simpanan_wajib numeric DEFAULT 0 NOT NULL,
    saldo_awal_simpanan_sukarela numeric DEFAULT 0 NOT NULL,
    saldo_awal_dana_cadangan numeric DEFAULT 0 NOT NULL,
    saldo_awal_modal_penyertaan numeric DEFAULT 0 NOT NULL,
    total_saldo_awal numeric DEFAULT 0 NOT NULL,
    penambahan_simpanan_pokok numeric DEFAULT 0 NOT NULL,
    penambahan_simpanan_wajib numeric DEFAULT 0 NOT NULL,
    penambahan_simpanan_sukarela numeric DEFAULT 0 NOT NULL,
    penambahan_dana_cadangan numeric DEFAULT 0 NOT NULL,
    penambahan_modal_penyertaan numeric DEFAULT 0 NOT NULL,
    total_penambahan numeric DEFAULT 0 NOT NULL,
    pengurangan_simpanan_pokok numeric DEFAULT 0 NOT NULL,
    pengurangan_simpanan_wajib numeric DEFAULT 0 NOT NULL,
    pengurangan_simpanan_sukarela numeric DEFAULT 0 NOT NULL,
    pengurangan_dana_cadangan numeric DEFAULT 0 NOT NULL,
    pengurangan_modal_penyertaan numeric DEFAULT 0 NOT NULL,
    total_pengurangan numeric DEFAULT 0 NOT NULL,
    simpanan_pokok numeric DEFAULT 0 NOT NULL,
    simpanan_wajib numeric DEFAULT 0 NOT NULL,
    simpanan_sukarela numeric DEFAULT 0 NOT NULL,
    modal_penyertaan numeric DEFAULT 0 NOT NULL,
    dana_cadangan numeric DEFAULT 0 NOT NULL,
    total_equity numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    dana_pendidikan numeric DEFAULT 0 NOT NULL,
    dana_sosial numeric DEFAULT 0 NOT NULL,
    dana_pembangunan numeric DEFAULT 0 NOT NULL,
    saldo_awal_dana_pendidikan numeric DEFAULT 0 NOT NULL,
    saldo_awal_dana_sosial numeric DEFAULT 0 NOT NULL,
    saldo_awal_dana_pembangunan numeric DEFAULT 0 NOT NULL,
    penambahan_dana_pendidikan numeric DEFAULT 0 NOT NULL,
    penambahan_dana_sosial numeric DEFAULT 0 NOT NULL,
    penambahan_dana_pembangunan numeric DEFAULT 0 NOT NULL,
    pengurangan_dana_pendidikan numeric DEFAULT 0 NOT NULL,
    pengurangan_dana_sosial numeric DEFAULT 0 NOT NULL,
    pengurangan_dana_pembangunan numeric DEFAULT 0 NOT NULL,
    hibah_donasi numeric DEFAULT 0 NOT NULL,
    saldo_awal_hibah_donasi numeric DEFAULT 0 NOT NULL,
    penambahan_hibah_donasi numeric DEFAULT 0 NOT NULL,
    pengurangan_hibah_donasi numeric DEFAULT 0 NOT NULL,
    modal_pinjaman numeric DEFAULT 0 NOT NULL,
    saldo_awal_modal_pinjaman numeric DEFAULT 0 NOT NULL,
    penambahan_modal_pinjaman numeric DEFAULT 0 NOT NULL,
    pengurangan_modal_pinjaman numeric DEFAULT 0 NOT NULL,
    surat_berharga numeric DEFAULT 0 NOT NULL,
    barang_dagang numeric DEFAULT 0 NOT NULL,
    rolled_from_year integer,
    rollover_date timestamp with time zone,
    rolled_by uuid,
    shu_withheld_balance numeric DEFAULT 0 NOT NULL,
    rollover_journal_id uuid
);


--
-- Name: bank_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_reconciliations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reconciliation_date date NOT NULL,
    period_month integer NOT NULL,
    period_year integer NOT NULL,
    bank_statement_balance numeric DEFAULT 0 NOT NULL,
    book_balance numeric DEFAULT 0 NOT NULL,
    adjusted_bank_balance numeric DEFAULT 0 NOT NULL,
    adjusted_book_balance numeric DEFAULT 0 NOT NULL,
    difference numeric DEFAULT 0 NOT NULL,
    is_reconciled boolean DEFAULT false NOT NULL,
    outstanding_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bank_reconciliations_period_month_check CHECK (((period_month >= 1) AND (period_month <= 12))),
    CONSTRAINT bank_reconciliations_period_year_check CHECK ((period_year >= 2000))
);


--
-- Name: business_unit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_unit_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    business_unit_id uuid NOT NULL,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    transaction_type text NOT NULL,
    description text,
    amount numeric NOT NULL,
    quantity numeric DEFAULT 1,
    is_member_transaction boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_unit_transactions_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: business_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    display_order integer DEFAULT 0
);


--
-- Name: chart_of_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_of_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_code character varying(20) NOT NULL,
    account_name character varying(100) NOT NULL,
    account_type public.account_type NOT NULL,
    parent_id uuid,
    business_unit_id uuid,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    balance numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cooperative_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cooperative_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    announcement_type text DEFAULT 'general'::text NOT NULL,
    target_type text DEFAULT 'all_members'::text NOT NULL,
    target_user_ids uuid[],
    is_email_sent boolean DEFAULT false,
    email_sent_count integer DEFAULT 0,
    notification_sent_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cooperative_books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cooperative_books (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    book_code character varying(20) NOT NULL,
    book_name character varying(100) NOT NULL,
    book_type character varying(50) NOT NULL,
    business_unit_id uuid,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cooperative_branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cooperative_branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    badge_color text DEFAULT '#6366f1'::text,
    description text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: cooperative_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cooperative_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);

ALTER TABLE ONLY public.cooperative_settings REPLICA IDENTITY FULL;


--
-- Name: corrections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.corrections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    correction_type text NOT NULL,
    operation text NOT NULL,
    amount numeric NOT NULL,
    current_balance numeric NOT NULL,
    new_balance numeric NOT NULL,
    reason text NOT NULL,
    footnote text,
    installment_id uuid,
    installment_number integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    status text DEFAULT 'applied'::text NOT NULL,
    reported_at timestamp with time zone,
    report_reason text,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    resolution_note text,
    correction_mode text DEFAULT 'nominal'::text,
    transaction_id uuid,
    journal_entry_id uuid,
    CONSTRAINT corrections_correction_type_check CHECK ((correction_type = ANY (ARRAY['simpanan_pokok'::text, 'simpanan_wajib'::text, 'simpanan_sukarela'::text, 'angsuran_pinjaman'::text]))),
    CONSTRAINT corrections_operation_check CHECK ((operation = ANY (ARRAY['add'::text, 'subtract'::text]))),
    CONSTRAINT corrections_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'reported'::text, 'resolved_approved'::text, 'resolved_rejected'::text, 'applied'::text])))
);


--
-- Name: data_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_backups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    backup_type text NOT NULL,
    file_name text NOT NULL,
    file_size bigint,
    record_count integer,
    status text DEFAULT 'completed'::text NOT NULL,
    created_by uuid,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_change_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_change_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    old_email text NOT NULL,
    new_email text NOT NULL,
    changed_at timestamp with time zone DEFAULT now(),
    ip_address text,
    user_agent text
);


--
-- Name: exited_member_shu_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exited_member_shu_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    year integer NOT NULL,
    member_number text,
    member_name text NOT NULL,
    join_date date,
    exit_date date NOT NULL,
    active_months integer DEFAULT 0 NOT NULL,
    total_months integer DEFAULT 12 NOT NULL,
    proportion_factor numeric(5,4) DEFAULT 0 NOT NULL,
    calculation_method text DEFAULT 'pro_rata'::text NOT NULL,
    total_simpanan numeric DEFAULT 0 NOT NULL,
    total_jasa_usaha numeric DEFAULT 0 NOT NULL,
    base_simpanan_share numeric DEFAULT 0 NOT NULL,
    base_jasa_usaha_share numeric DEFAULT 0 NOT NULL,
    final_simpanan_share numeric DEFAULT 0 NOT NULL,
    final_jasa_usaha_share numeric DEFAULT 0 NOT NULL,
    total_shu_amount numeric DEFAULT 0 NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    payment_date timestamp with time zone,
    payment_method text,
    payment_note text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_calculation_method CHECK ((calculation_method = ANY (ARRAY['pro_rata'::text, 'full'::text, 'at_exit'::text]))),
    CONSTRAINT valid_payment_status CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])))
);


--
-- Name: expense_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    type text DEFAULT 'manual'::text NOT NULL,
    date timestamp with time zone DEFAULT now() NOT NULL,
    year integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fixed_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixed_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_code character varying(50) NOT NULL,
    asset_name character varying(100) NOT NULL,
    category character varying(50),
    acquisition_date date NOT NULL,
    acquisition_cost numeric NOT NULL,
    useful_life_months integer DEFAULT 60 NOT NULL,
    depreciation_method character varying(20) DEFAULT 'straight_line'::character varying NOT NULL,
    accumulated_depreciation numeric DEFAULT 0 NOT NULL,
    current_value numeric DEFAULT 0 NOT NULL,
    location text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: income_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.income_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    type text DEFAULT 'manual'::text NOT NULL,
    date timestamp with time zone DEFAULT now() NOT NULL,
    year integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: interest_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interest_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    period character varying(7) NOT NULL,
    period_name text NOT NULL,
    eligible_balance numeric DEFAULT 0 NOT NULL,
    interest_rate numeric DEFAULT 0 NOT NULL,
    interest_amount numeric DEFAULT 0 NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_code character varying(50) NOT NULL,
    item_name character varying(100) NOT NULL,
    business_unit_id uuid,
    category character varying(50),
    unit character varying(20) DEFAULT 'pcs'::character varying NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    unit_cost numeric DEFAULT 0 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    min_stock numeric DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: issued_letters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issued_letters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    letter_number text NOT NULL,
    letter_type text NOT NULL,
    reference_id uuid NOT NULL,
    member_name text NOT NULL,
    member_number text,
    issued_date date DEFAULT CURRENT_DATE NOT NULL,
    issued_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: journal_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_entry_id uuid NOT NULL,
    action text NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    old_data jsonb,
    new_data jsonb,
    change_summary text
);


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_number character varying(50) NOT NULL,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    description text NOT NULL,
    business_unit_id uuid,
    reference_type character varying(50),
    reference_id uuid,
    total_debit numeric DEFAULT 0 NOT NULL,
    total_credit numeric DEFAULT 0 NOT NULL,
    is_balanced boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: journal_entry_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entry_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_entry_id uuid NOT NULL,
    account_id uuid NOT NULL,
    description text,
    debit_amount numeric DEFAULT 0 NOT NULL,
    credit_amount numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: journal_template_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_template_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid,
    action text NOT NULL,
    changed_by uuid,
    old_data jsonb,
    new_data jsonb,
    change_summary text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT journal_template_audit_logs_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'toggle'::text, 'reset'::text, 'auto_map'::text])))
);


--
-- Name: journal_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    lines jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid
);


--
-- Name: letter_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.letter_sequences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    letter_type text NOT NULL,
    year integer NOT NULL,
    month integer,
    current_sequence integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: letter_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.letter_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    letter_type text NOT NULL,
    title text NOT NULL,
    opening_text text,
    closing_text text,
    footer_text text,
    show_logo boolean DEFAULT true,
    show_legal_number boolean DEFAULT true,
    show_address boolean DEFAULT true,
    show_print_date boolean DEFAULT true,
    stamp_position text DEFAULT 'left'::text,
    default_signatory_count integer DEFAULT 2,
    show_recipient_signature boolean DEFAULT false,
    visible_fields jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    element_order jsonb DEFAULT '["header", "letter_number", "title", "opening", "content", "closing", "signature", "footer"]'::jsonb,
    status_badge_text text,
    status_badge_color text DEFAULT 'green'::text,
    signature_layout text DEFAULT 'horizontal'::text,
    signature_alignment text DEFAULT 'right'::text,
    max_signatories_per_row integer DEFAULT 3,
    signature_position text DEFAULT 'bottom-right'::text,
    signature_size text DEFAULT 'medium'::text,
    selected_signatory_positions text[] DEFAULT ARRAY['Ketua'::text, 'Bendahara'::text],
    show_auto_print_disclaimer boolean DEFAULT true
);


--
-- Name: loan_adjustment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loan_adjustment_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    installment_id uuid NOT NULL,
    loan_id uuid NOT NULL,
    user_id uuid NOT NULL,
    original_interest_amount numeric NOT NULL,
    original_penalty_amount numeric DEFAULT 0 NOT NULL,
    adjusted_interest_amount numeric NOT NULL,
    adjusted_penalty_amount numeric DEFAULT 0 NOT NULL,
    interest_reduction numeric DEFAULT 0 NOT NULL,
    penalty_reduction numeric DEFAULT 0 NOT NULL,
    reason text NOT NULL,
    adjusted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: loan_collaterals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loan_collaterals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loan_id uuid NOT NULL,
    collateral_type text NOT NULL,
    collateral_description text,
    estimated_value numeric DEFAULT 0,
    document_number text,
    custodian_admin_id uuid,
    storage_location text,
    received_date date,
    returned_date date,
    status text DEFAULT 'pending'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: loan_installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loan_installments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loan_id uuid NOT NULL,
    installment_number integer NOT NULL,
    due_date date NOT NULL,
    principal_amount numeric(15,2) NOT NULL,
    interest_amount numeric(15,2) NOT NULL,
    total_amount numeric(15,2) NOT NULL,
    paid_amount numeric(15,2) DEFAULT 0,
    paid_date date,
    status public.installment_status DEFAULT 'pending'::public.installment_status,
    penalty_amount numeric(15,2) DEFAULT 0,
    penalty_months integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    adjusted_interest_amount numeric,
    adjusted_penalty_amount numeric,
    adjustment_reason text,
    adjusted_by uuid,
    adjusted_at timestamp with time zone
);

ALTER TABLE ONLY public.loan_installments REPLICA IDENTITY FULL;


--
-- Name: loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    principal_amount numeric(15,2) NOT NULL,
    tenor integer NOT NULL,
    interest_rate numeric(5,4) DEFAULT 0.02,
    disbursement_date date,
    remaining_principal numeric(15,2),
    status public.loan_status DEFAULT 'pending'::public.loan_status,
    application_date date DEFAULT CURRENT_DATE,
    approved_at timestamp with time zone,
    approved_by uuid,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    requires_collateral boolean DEFAULT false,
    collateral_status text,
    CONSTRAINT loans_tenor_check CHECK (((tenor >= 1) AND (tenor <= 15)))
);

ALTER TABLE ONLY public.loans REPLICA IDENTITY FULL;


--
-- Name: member_import_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_import_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_type text NOT NULL,
    total_rows integer DEFAULT 0,
    success_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    failed_details jsonb,
    file_name text,
    performed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT member_import_logs_import_type_check CHECK ((import_type = ANY (ARRAY['bulk_create'::text, 'pending_data'::text, 'single'::text, 'bulk_import'::text])))
);


--
-- Name: member_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    notification_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.member_notifications REPLICA IDENTITY FULL;


--
-- Name: migration_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    batch_id text,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    total_simpanan_pokok numeric DEFAULT 0 NOT NULL,
    total_simpanan_wajib numeric DEFAULT 0 NOT NULL,
    total_simpanan_sukarela numeric DEFAULT 0 NOT NULL,
    total_simpanan numeric DEFAULT 0 NOT NULL,
    member_count integer DEFAULT 0 NOT NULL,
    total_loan_principal numeric DEFAULT 0 NOT NULL,
    total_remaining_principal numeric DEFAULT 0 NOT NULL,
    active_loan_count integer DEFAULT 0 NOT NULL,
    coa_simpanan_pokok numeric DEFAULT 0 NOT NULL,
    coa_simpanan_wajib numeric DEFAULT 0 NOT NULL,
    coa_simpanan_sukarela numeric DEFAULT 0 NOT NULL,
    coa_piutang_pinjaman numeric DEFAULT 0 NOT NULL,
    journal_count integer DEFAULT 0 NOT NULL,
    total_journal_debit numeric DEFAULT 0 NOT NULL,
    total_journal_credit numeric DEFAULT 0 NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT migration_snapshots_type_check CHECK ((type = ANY (ARRAY['before'::text, 'after'::text])))
);


--
-- Name: notification_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_reads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_id text NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: overdue_handling; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overdue_handling (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loan_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status public.overdue_handling_status DEFAULT 'pending'::public.overdue_handling_status NOT NULL,
    notes text,
    contacted_at timestamp with time zone,
    contacted_by uuid,
    last_updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: password_change_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_change_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text,
    status text DEFAULT 'success'::text NOT NULL,
    failure_reason text
);


--
-- Name: pending_member_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_member_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    nik text,
    email text,
    phone text,
    address text,
    bank_account_number text,
    bank_account_name text,
    simpanan_pokok numeric DEFAULT 0,
    simpanan_wajib numeric DEFAULT 0,
    simpanan_sukarela numeric DEFAULT 0,
    has_active_loan boolean DEFAULT false,
    loan_data jsonb,
    matched_user_id uuid,
    import_batch_id text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    gender text,
    join_date date,
    member_number text,
    birth_date date,
    claimed_by uuid,
    claimed_at timestamp with time zone,
    created_by uuid,
    CONSTRAINT pending_member_data_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'matched'::text, 'account_created'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    nik text,
    bank_account_number text,
    bank_account_name text,
    profile_photo text,
    member_number text,
    join_date date DEFAULT CURRENT_DATE,
    exit_date date,
    exit_year integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    approval_status text DEFAULT 'pending'::text,
    rejection_reason text,
    payment_proof_url text,
    birth_place text,
    birth_date date,
    gender text,
    occupation text,
    bank_name text,
    address text,
    branch_id uuid,
    must_change_password boolean DEFAULT false,
    password_changed_at timestamp with time zone,
    is_migrated_account boolean DEFAULT false,
    claim_method text,
    CONSTRAINT profiles_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT profiles_gender_check CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['male'::text, 'female'::text]))))
);

ALTER TABLE ONLY public.profiles REPLICA IDENTITY FULL;


--
-- Name: reconciliation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconciliation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    checked_by uuid,
    savings_pokok numeric DEFAULT 0 NOT NULL,
    savings_wajib numeric DEFAULT 0 NOT NULL,
    savings_sukarela numeric DEFAULT 0 NOT NULL,
    savings_total numeric DEFAULT 0 NOT NULL,
    coa_hutang_pokok numeric DEFAULT 0 NOT NULL,
    coa_hutang_wajib numeric DEFAULT 0 NOT NULL,
    coa_hutang_sukarela numeric DEFAULT 0 NOT NULL,
    coa_hutang_total numeric DEFAULT 0 NOT NULL,
    loans_remaining_principal numeric DEFAULT 0 NOT NULL,
    coa_piutang_pinjaman numeric DEFAULT 0 NOT NULL,
    diff_pokok numeric DEFAULT 0 NOT NULL,
    diff_wajib numeric DEFAULT 0 NOT NULL,
    diff_sukarela numeric DEFAULT 0 NOT NULL,
    diff_savings_total numeric DEFAULT 0 NOT NULL,
    diff_loan_piutang numeric DEFAULT 0 NOT NULL,
    is_reconciled boolean DEFAULT false NOT NULL,
    action_taken text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: resignation_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resignation_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    total_savings numeric DEFAULT 0 NOT NULL,
    total_arrears numeric DEFAULT 0 NOT NULL,
    refund_amount numeric DEFAULT 0 NOT NULL,
    simpanan_pokok numeric DEFAULT 0 NOT NULL,
    simpanan_wajib numeric DEFAULT 0 NOT NULL,
    simpanan_sukarela numeric DEFAULT 0 NOT NULL,
    remaining_loan_principal numeric DEFAULT 0 NOT NULL,
    total_penalties numeric DEFAULT 0 NOT NULL,
    processed_at timestamp with time zone,
    processed_by uuid,
    rejection_reason text,
    journal_entry_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT resignation_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: role_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    is_member boolean DEFAULT false NOT NULL,
    member_id uuid,
    share_percentage numeric DEFAULT 100 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    business_unit_id uuid,
    "position" text,
    CONSTRAINT role_assignments_role_check CHECK ((role = ANY (ARRAY['pengurus'::text, 'pengawas'::text, 'penasihat'::text])))
);


--
-- Name: savings_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.savings_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid,
    change_type text NOT NULL,
    old_simpanan_pokok numeric,
    new_simpanan_pokok numeric,
    old_simpanan_wajib numeric,
    new_simpanan_wajib numeric,
    old_simpanan_sukarela numeric,
    new_simpanan_sukarela numeric,
    old_total_simpanan numeric,
    new_total_simpanan numeric,
    source text,
    notes text
);


--
-- Name: savings_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.savings_summary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    simpanan_pokok numeric(15,2) DEFAULT 0,
    simpanan_wajib numeric(15,2) DEFAULT 0,
    simpanan_sukarela numeric(15,2) DEFAULT 0,
    total_simpanan numeric(15,2) DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.savings_summary REPLICA IDENTITY FULL;


--
-- Name: settings_change_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_change_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    old_value jsonb,
    new_value jsonb NOT NULL,
    application_mode text DEFAULT 'prospective'::text NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid,
    change_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT settings_change_logs_application_mode_check CHECK ((application_mode = ANY (ARRAY['prospective'::text, 'retroactive'::text])))
);


--
-- Name: shu_distributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shu_distributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    year integer NOT NULL,
    shu_bruto numeric DEFAULT 0 NOT NULL,
    shu_anggota_total numeric DEFAULT 0 NOT NULL,
    shu_anggota_simpanan numeric DEFAULT 0 NOT NULL,
    shu_anggota_jasa_pinjaman numeric DEFAULT 0 NOT NULL,
    shu_pengurus numeric DEFAULT 0 NOT NULL,
    shu_pengawas numeric DEFAULT 0 NOT NULL,
    shu_penasihat numeric DEFAULT 0 NOT NULL,
    dana_cadangan numeric DEFAULT 0 NOT NULL,
    member_distributions jsonb DEFAULT '[]'::jsonb NOT NULL,
    role_distributions jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    dana_pendidikan numeric DEFAULT 0 NOT NULL,
    dana_sosial numeric DEFAULT 0 NOT NULL,
    dana_pembangunan numeric DEFAULT 0 NOT NULL,
    CONSTRAINT shu_distributions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'confirmed'::text])))
);


--
-- Name: shu_fund_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shu_fund_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fund_type text NOT NULL,
    title text NOT NULL,
    description text,
    amount numeric DEFAULT 0 NOT NULL,
    activity_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    year integer DEFAULT EXTRACT(year FROM CURRENT_DATE) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT shu_fund_activities_fund_type_check CHECK ((fund_type = ANY (ARRAY['pendidikan'::text, 'sosial'::text, 'pembangunan'::text]))),
    CONSTRAINT shu_fund_activities_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'ongoing'::text, 'completed'::text])))
);


--
-- Name: shu_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shu_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    year integer NOT NULL,
    amount numeric(15,2) NOT NULL,
    distributed_at timestamp with time zone DEFAULT now(),
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: shu_rollover_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shu_rollover_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_year integer NOT NULL,
    to_year integer NOT NULL,
    dana_cadangan_rollover numeric DEFAULT 0 NOT NULL,
    dana_pendidikan_rollover numeric DEFAULT 0 NOT NULL,
    dana_sosial_rollover numeric DEFAULT 0 NOT NULL,
    dana_pembangunan_rollover numeric DEFAULT 0 NOT NULL,
    shu_withheld_rollover numeric DEFAULT 0 NOT NULL,
    withheld_members_count integer DEFAULT 0 NOT NULL,
    total_rollover_amount numeric DEFAULT 0 NOT NULL,
    journal_entry_id uuid,
    status text DEFAULT 'completed'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: shu_withheld; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shu_withheld (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    year integer NOT NULL,
    shu_amount numeric DEFAULT 0 NOT NULL,
    simpanan_share numeric DEFAULT 0 NOT NULL,
    jasa_usaha_share numeric DEFAULT 0 NOT NULL,
    arrears_amount numeric DEFAULT 0 NOT NULL,
    withhold_reason text DEFAULT 'arrears'::text NOT NULL,
    manual_exclusion boolean DEFAULT false NOT NULL,
    exclusion_note text,
    status text DEFAULT 'withheld'::text NOT NULL,
    released_at timestamp with time zone,
    released_by uuid,
    released_amount numeric,
    used_for_arrears numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_exited_member boolean DEFAULT false,
    exit_date date,
    active_months integer DEFAULT 12,
    calculation_method text DEFAULT 'full'::text,
    payment_status text DEFAULT 'pending'::text,
    paid_at timestamp with time zone,
    paid_amount numeric DEFAULT 0
);


--
-- Name: signatory_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signatory_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_assignment_id uuid NOT NULL,
    signature_base64 text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.transaction_type NOT NULL,
    amount numeric(15,2) NOT NULL,
    date date DEFAULT CURRENT_DATE,
    status public.transaction_status DEFAULT 'pending'::public.transaction_status,
    payment_method public.payment_method NOT NULL,
    account_holder_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    approved_at timestamp with time zone,
    approved_by uuid,
    rejection_reason text,
    installment_id uuid,
    original_amount numeric,
    original_date date,
    adjusted_by uuid,
    adjustment_reason text,
    adjusted_at timestamp with time zone,
    journal_entry_id uuid,
    is_migration boolean DEFAULT false
);

ALTER TABLE ONLY public.transactions REPLICA IDENTITY FULL;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.user_role DEFAULT 'member'::public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    granted_at timestamp with time zone DEFAULT now(),
    granted_by uuid
);


--
-- Name: account_claim_tokens account_claim_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_claim_tokens
    ADD CONSTRAINT account_claim_tokens_pkey PRIMARY KEY (id);


--
-- Name: account_claim_tokens account_claim_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_claim_tokens
    ADD CONSTRAINT account_claim_tokens_token_key UNIQUE (token);


--
-- Name: admin_activity_logs admin_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_logs
    ADD CONSTRAINT admin_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_notifications admin_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id);


--
-- Name: admin_permissions admin_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permissions
    ADD CONSTRAINT admin_permissions_pkey PRIMARY KEY (id);


--
-- Name: admin_permissions admin_permissions_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permissions
    ADD CONSTRAINT admin_permissions_user_id_key UNIQUE (user_id);


--
-- Name: archived_accounts archived_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archived_accounts
    ADD CONSTRAINT archived_accounts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: balance_sheets balance_sheets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balance_sheets
    ADD CONSTRAINT balance_sheets_pkey PRIMARY KEY (id);


--
-- Name: balance_sheets balance_sheets_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balance_sheets
    ADD CONSTRAINT balance_sheets_year_key UNIQUE (year);


--
-- Name: bank_reconciliations bank_reconciliations_period_month_period_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_period_month_period_year_key UNIQUE (period_month, period_year);


--
-- Name: bank_reconciliations bank_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: business_unit_transactions business_unit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_unit_transactions
    ADD CONSTRAINT business_unit_transactions_pkey PRIMARY KEY (id);


--
-- Name: business_units business_units_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_units
    ADD CONSTRAINT business_units_code_key UNIQUE (code);


--
-- Name: business_units business_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_units
    ADD CONSTRAINT business_units_pkey PRIMARY KEY (id);


--
-- Name: chart_of_accounts chart_of_accounts_account_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_account_code_key UNIQUE (account_code);


--
-- Name: chart_of_accounts chart_of_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id);


--
-- Name: cooperative_announcements cooperative_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooperative_announcements
    ADD CONSTRAINT cooperative_announcements_pkey PRIMARY KEY (id);


--
-- Name: cooperative_books cooperative_books_book_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooperative_books
    ADD CONSTRAINT cooperative_books_book_code_key UNIQUE (book_code);


--
-- Name: cooperative_books cooperative_books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooperative_books
    ADD CONSTRAINT cooperative_books_pkey PRIMARY KEY (id);


--
-- Name: cooperative_branches cooperative_branches_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooperative_branches
    ADD CONSTRAINT cooperative_branches_code_key UNIQUE (code);


--
-- Name: cooperative_branches cooperative_branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooperative_branches
    ADD CONSTRAINT cooperative_branches_pkey PRIMARY KEY (id);


--
-- Name: cooperative_settings cooperative_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooperative_settings
    ADD CONSTRAINT cooperative_settings_key_key UNIQUE (key);


--
-- Name: cooperative_settings cooperative_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooperative_settings
    ADD CONSTRAINT cooperative_settings_pkey PRIMARY KEY (id);


--
-- Name: corrections corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corrections
    ADD CONSTRAINT corrections_pkey PRIMARY KEY (id);


--
-- Name: data_backups data_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_backups
    ADD CONSTRAINT data_backups_pkey PRIMARY KEY (id);


--
-- Name: email_change_logs email_change_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_change_logs
    ADD CONSTRAINT email_change_logs_pkey PRIMARY KEY (id);


--
-- Name: exited_member_shu_payments exited_member_shu_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exited_member_shu_payments
    ADD CONSTRAINT exited_member_shu_payments_pkey PRIMARY KEY (id);


--
-- Name: exited_member_shu_payments exited_member_shu_payments_user_id_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exited_member_shu_payments
    ADD CONSTRAINT exited_member_shu_payments_user_id_year_key UNIQUE (user_id, year);


--
-- Name: expense_entries expense_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_entries
    ADD CONSTRAINT expense_entries_pkey PRIMARY KEY (id);


--
-- Name: fixed_assets fixed_assets_asset_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_asset_code_key UNIQUE (asset_code);


--
-- Name: fixed_assets fixed_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_pkey PRIMARY KEY (id);


--
-- Name: income_entries income_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_entries
    ADD CONSTRAINT income_entries_pkey PRIMARY KEY (id);


--
-- Name: interest_notifications interest_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interest_notifications
    ADD CONSTRAINT interest_notifications_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_item_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_item_code_key UNIQUE (item_code);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: issued_letters issued_letters_letter_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issued_letters
    ADD CONSTRAINT issued_letters_letter_number_key UNIQUE (letter_number);


--
-- Name: issued_letters issued_letters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issued_letters
    ADD CONSTRAINT issued_letters_pkey PRIMARY KEY (id);


--
-- Name: journal_audit_logs journal_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_audit_logs
    ADD CONSTRAINT journal_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_entry_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_entry_number_key UNIQUE (entry_number);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_entry_lines journal_entry_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_pkey PRIMARY KEY (id);


--
-- Name: journal_template_audit_logs journal_template_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_template_audit_logs
    ADD CONSTRAINT journal_template_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: journal_templates journal_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_templates
    ADD CONSTRAINT journal_templates_pkey PRIMARY KEY (id);


--
-- Name: journal_templates journal_templates_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_templates
    ADD CONSTRAINT journal_templates_type_key UNIQUE (type);


--
-- Name: letter_sequences letter_sequences_letter_type_year_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_sequences
    ADD CONSTRAINT letter_sequences_letter_type_year_month_key UNIQUE (letter_type, year, month);


--
-- Name: letter_sequences letter_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_sequences
    ADD CONSTRAINT letter_sequences_pkey PRIMARY KEY (id);


--
-- Name: letter_templates letter_templates_letter_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_templates
    ADD CONSTRAINT letter_templates_letter_type_key UNIQUE (letter_type);


--
-- Name: letter_templates letter_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_templates
    ADD CONSTRAINT letter_templates_pkey PRIMARY KEY (id);


--
-- Name: loan_adjustment_history loan_adjustment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_adjustment_history
    ADD CONSTRAINT loan_adjustment_history_pkey PRIMARY KEY (id);


--
-- Name: loan_collaterals loan_collaterals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_collaterals
    ADD CONSTRAINT loan_collaterals_pkey PRIMARY KEY (id);


--
-- Name: loan_installments loan_installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_installments
    ADD CONSTRAINT loan_installments_pkey PRIMARY KEY (id);


--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);


--
-- Name: member_import_logs member_import_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_import_logs
    ADD CONSTRAINT member_import_logs_pkey PRIMARY KEY (id);


--
-- Name: member_notifications member_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_notifications
    ADD CONSTRAINT member_notifications_pkey PRIMARY KEY (id);


--
-- Name: migration_snapshots migration_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_snapshots
    ADD CONSTRAINT migration_snapshots_pkey PRIMARY KEY (id);


--
-- Name: notification_reads notification_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_pkey PRIMARY KEY (id);


--
-- Name: notification_reads notification_reads_user_id_notification_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_user_id_notification_id_key UNIQUE (user_id, notification_id);


--
-- Name: overdue_handling overdue_handling_loan_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overdue_handling
    ADD CONSTRAINT overdue_handling_loan_id_key UNIQUE (loan_id);


--
-- Name: overdue_handling overdue_handling_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overdue_handling
    ADD CONSTRAINT overdue_handling_pkey PRIMARY KEY (id);


--
-- Name: password_change_logs password_change_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_change_logs
    ADD CONSTRAINT password_change_logs_pkey PRIMARY KEY (id);


--
-- Name: pending_member_data pending_member_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_member_data
    ADD CONSTRAINT pending_member_data_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_member_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_member_number_key UNIQUE (member_number);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: reconciliation_logs reconciliation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_logs
    ADD CONSTRAINT reconciliation_logs_pkey PRIMARY KEY (id);


--
-- Name: resignation_requests resignation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resignation_requests
    ADD CONSTRAINT resignation_requests_pkey PRIMARY KEY (id);


--
-- Name: role_assignments role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_assignments
    ADD CONSTRAINT role_assignments_pkey PRIMARY KEY (id);


--
-- Name: savings_audit_log savings_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.savings_audit_log
    ADD CONSTRAINT savings_audit_log_pkey PRIMARY KEY (id);


--
-- Name: savings_summary savings_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.savings_summary
    ADD CONSTRAINT savings_summary_pkey PRIMARY KEY (id);


--
-- Name: savings_summary savings_summary_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.savings_summary
    ADD CONSTRAINT savings_summary_user_id_key UNIQUE (user_id);


--
-- Name: settings_change_logs settings_change_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_change_logs
    ADD CONSTRAINT settings_change_logs_pkey PRIMARY KEY (id);


--
-- Name: shu_distributions shu_distributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shu_distributions
    ADD CONSTRAINT shu_distributions_pkey PRIMARY KEY (id);


--
-- Name: shu_distributions shu_distributions_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shu_distributions
    ADD CONSTRAINT shu_distributions_year_key UNIQUE (year);


--
-- Name: shu_fund_activities shu_fund_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shu_fund_activities
    ADD CONSTRAINT shu_fund_activities_pkey PRIMARY KEY (id);


--
-- Name: shu_records shu_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shu_records
    ADD CONSTRAINT shu_records_pkey PRIMARY KEY (id);


--
-- Name: shu_rollover_history shu_rollover_history_from_year_to_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shu_rollover_history
    ADD CONSTRAINT shu_rollover_history_from_year_to_year_key UNIQUE (from_year, to_year);


--
-- Name: shu_rollover_history shu_rollover_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shu_rollover_history
    ADD CONSTRAINT shu_rollover_history_pkey PRIMARY KEY (id);


--
-- Name: shu_withheld shu_withheld_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shu_withheld
    ADD CONSTRAINT shu_withheld_pkey PRIMARY KEY (id);


--
-- Name: shu_withheld shu_withheld_user_id_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shu_withheld
    ADD CONSTRAINT shu_withheld_user_id_year_key UNIQUE (user_id, year);


--
-- Name: signatory_signatures signatory_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signatory_signatures
    ADD CONSTRAINT signatory_signatures_pkey PRIMARY KEY (id);


--
-- Name: signatory_signatures signatory_signatures_role_assignment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signatory_signatures
    ADD CONSTRAINT signatory_signatures_role_assignment_id_key UNIQUE (role_assignment_id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_admin_activity_logs_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_activity_logs_action_type ON public.admin_activity_logs USING btree (action_type);


--
-- Name: idx_admin_activity_logs_admin_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_activity_logs_admin_user_id ON public.admin_activity_logs USING btree (admin_user_id);


--
-- Name: idx_admin_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_activity_logs_created_at ON public.admin_activity_logs USING btree (created_at DESC);


--
-- Name: idx_admin_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notifications_created_at ON public.admin_notifications USING btree (created_at DESC);


--
-- Name: idx_admin_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notifications_is_read ON public.admin_notifications USING btree (is_read);


--
-- Name: idx_admin_notifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notifications_type ON public.admin_notifications USING btree (notification_type);


--
-- Name: idx_admin_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_permissions_user_id ON public.admin_permissions USING btree (user_id);


--
-- Name: idx_announcements_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_created_at ON public.cooperative_announcements USING btree (created_at DESC);


--
-- Name: idx_announcements_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_type ON public.cooperative_announcements USING btree (announcement_type);


--
-- Name: idx_archived_accounts_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archived_accounts_archived_at ON public.archived_accounts USING btree (archived_at);


--
-- Name: idx_archived_accounts_member_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archived_accounts_member_number ON public.archived_accounts USING btree (member_number);


--
-- Name: idx_archived_accounts_original_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archived_accounts_original_user_id ON public.archived_accounts USING btree (original_user_id);


--
-- Name: idx_audit_logs_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action_type ON public.audit_logs USING btree (action_type);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs USING btree (entity_type);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_balance_sheets_rolled_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balance_sheets_rolled_from ON public.balance_sheets USING btree (rolled_from_year);


--
-- Name: idx_business_unit_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_unit_transactions_date ON public.business_unit_transactions USING btree (transaction_date);


--
-- Name: idx_business_unit_transactions_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_unit_transactions_member ON public.business_unit_transactions USING btree (is_member_transaction) WHERE (is_member_transaction = true);


--
-- Name: idx_business_unit_transactions_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_unit_transactions_unit ON public.business_unit_transactions USING btree (business_unit_id);


--
-- Name: idx_business_unit_transactions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_unit_transactions_user ON public.business_unit_transactions USING btree (user_id);


--
-- Name: idx_claim_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_tokens_token ON public.account_claim_tokens USING btree (token);


--
-- Name: idx_claim_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_tokens_user_id ON public.account_claim_tokens USING btree (user_id);


--
-- Name: idx_cooperative_branches_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cooperative_branches_display_order ON public.cooperative_branches USING btree (display_order);


--
-- Name: idx_cooperative_branches_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cooperative_branches_is_active ON public.cooperative_branches USING btree (is_active);


--
-- Name: idx_corrections_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_corrections_created_at ON public.corrections USING btree (created_at DESC);


--
-- Name: idx_corrections_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_corrections_user_id ON public.corrections USING btree (user_id);


--
-- Name: idx_exited_member_shu_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exited_member_shu_status ON public.exited_member_shu_payments USING btree (payment_status);


--
-- Name: idx_exited_member_shu_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exited_member_shu_user ON public.exited_member_shu_payments USING btree (user_id);


--
-- Name: idx_exited_member_shu_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exited_member_shu_year ON public.exited_member_shu_payments USING btree (year);


--
-- Name: idx_interest_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interest_notifications_is_read ON public.interest_notifications USING btree (is_read);


--
-- Name: idx_interest_notifications_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interest_notifications_period ON public.interest_notifications USING btree (period);


--
-- Name: idx_interest_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interest_notifications_user_id ON public.interest_notifications USING btree (user_id);


--
-- Name: idx_journal_audit_logs_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_audit_logs_changed_at ON public.journal_audit_logs USING btree (changed_at DESC);


--
-- Name: idx_journal_audit_logs_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_audit_logs_entry_id ON public.journal_audit_logs USING btree (journal_entry_id);


--
-- Name: idx_journal_template_audit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_template_audit_created_at ON public.journal_template_audit_logs USING btree (created_at DESC);


--
-- Name: idx_journal_template_audit_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_template_audit_template_id ON public.journal_template_audit_logs USING btree (template_id);


--
-- Name: idx_journal_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_templates_type ON public.journal_templates USING btree (type);


--
-- Name: idx_loan_adjustment_history_installment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loan_adjustment_history_installment_id ON public.loan_adjustment_history USING btree (installment_id);


--
-- Name: idx_loan_adjustment_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loan_adjustment_history_user_id ON public.loan_adjustment_history USING btree (user_id);


--
-- Name: idx_loan_collaterals_custodian; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loan_collaterals_custodian ON public.loan_collaterals USING btree (custodian_admin_id);


--
-- Name: idx_loan_collaterals_loan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loan_collaterals_loan_id ON public.loan_collaterals USING btree (loan_id);


--
-- Name: idx_loan_collaterals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loan_collaterals_status ON public.loan_collaterals USING btree (status);


--
-- Name: idx_member_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_notifications_created_at ON public.member_notifications USING btree (created_at DESC);


--
-- Name: idx_member_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_notifications_is_read ON public.member_notifications USING btree (user_id, is_read);


--
-- Name: idx_member_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_notifications_user_id ON public.member_notifications USING btree (user_id);


--
-- Name: idx_migration_snapshots_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_migration_snapshots_timestamp ON public.migration_snapshots USING btree ("timestamp" DESC);


--
-- Name: idx_migration_snapshots_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_migration_snapshots_type ON public.migration_snapshots USING btree (type);


--
-- Name: idx_notification_reads_notification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_reads_notification_id ON public.notification_reads USING btree (notification_id);


--
-- Name: idx_notification_reads_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_reads_user_id ON public.notification_reads USING btree (user_id);


--
-- Name: idx_password_change_logs_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_change_logs_changed_at ON public.password_change_logs USING btree (changed_at DESC);


--
-- Name: idx_password_change_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_change_logs_user_id ON public.password_change_logs USING btree (user_id);


--
-- Name: idx_pending_member_birth_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_member_birth_date ON public.pending_member_data USING btree (birth_date);


--
-- Name: idx_pending_member_nik; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_member_nik ON public.pending_member_data USING btree (nik);


--
-- Name: idx_pending_member_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_member_status ON public.pending_member_data USING btree (status);


--
-- Name: idx_profiles_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_branch_id ON public.profiles USING btree (branch_id);


--
-- Name: idx_reconciliation_logs_checked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reconciliation_logs_checked_at ON public.reconciliation_logs USING btree (checked_at DESC);


--
-- Name: idx_role_assignments_business_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_assignments_business_unit ON public.role_assignments USING btree (business_unit_id);


--
-- Name: idx_role_assignments_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_assignments_position ON public.role_assignments USING btree ("position");


--
-- Name: idx_settings_change_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settings_change_logs_created ON public.settings_change_logs USING btree (created_at DESC);


--
-- Name: idx_settings_change_logs_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settings_change_logs_key ON public.settings_change_logs USING btree (setting_key);


--
-- Name: idx_shu_rollover_history_years; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shu_rollover_history_years ON public.shu_rollover_history USING btree (from_year, to_year);


--
-- Name: idx_shu_withheld_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shu_withheld_status ON public.shu_withheld USING btree (status);


--
-- Name: idx_shu_withheld_user_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shu_withheld_user_year ON public.shu_withheld USING btree (user_id, year);


--
-- Name: idx_transactions_installment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_installment_id ON public.transactions USING btree (installment_id);


--
-- Name: idx_transactions_journal_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_journal_entry ON public.transactions USING btree (journal_entry_id);


--
-- Name: idx_transactions_migration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_migration ON public.transactions USING btree (is_migration) WHERE (is_migration = true);


--
-- Name: savings_summary audit_savings_summary_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_savings_summary_changes AFTER UPDATE ON public.savings_summary FOR EACH ROW EXECUTE FUNCTION public.log_savings_summary_changes();


--
-- Name: resignation_requests create_resignation_journal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER create_resignation_journal BEFORE UPDATE ON public.resignation_requests FOR EACH ROW EXECUTE FUNCTION public.create_resignation_journal_entry();


--
-- Name: profiles enforce_branch_change_admin_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_branch_change_admin_only BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_member_branch_change();


--
-- Name: resignation_requests notify_admin_resignation_request; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_admin_resignation_request AFTER INSERT ON public.resignation_requests FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_resignation_request();


--
-- Name: user_roles on_admin_role_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_admin_role_created AFTER INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.create_admin_permissions();


--
-- Name: user_roles on_admin_role_deleted; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_admin_role_deleted AFTER DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.delete_admin_permissions();


--
-- Name: business_unit_transactions on_business_unit_transaction_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_business_unit_transaction_insert AFTER INSERT ON public.business_unit_transactions FOR EACH ROW EXECUTE FUNCTION public.notify_member_on_business_transaction();


--
-- Name: profiles on_member_resignation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_member_resignation AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_member_resignation();


--
-- Name: profiles on_new_registration; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_new_registration AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_new_registration();


--
-- Name: transactions on_transaction_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_transaction_status_change AFTER INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_savings_on_transaction();


--
-- Name: journal_templates trigger_journal_template_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_journal_template_audit AFTER INSERT OR UPDATE ON public.journal_templates FOR EACH ROW EXECUTE FUNCTION public.log_journal_template_change();


--
-- Name: loans trigger_sync_loans_coa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_loans_coa AFTER INSERT OR UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.sync_loans_to_chart_of_accounts();


--
-- Name: savings_summary trigger_sync_savings_coa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_savings_coa AFTER INSERT OR UPDATE ON public.savings_summary FOR EACH ROW EXECUTE FUNCTION public.sync_savings_to_chart_of_accounts();


--
-- Name: cooperative_announcements update_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.cooperative_announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: balance_sheets update_balance_sheets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_balance_sheets_updated_at BEFORE UPDATE ON public.balance_sheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bank_reconciliations update_bank_reconciliations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bank_reconciliations_updated_at BEFORE UPDATE ON public.bank_reconciliations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: business_unit_transactions update_business_unit_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_business_unit_transactions_updated_at BEFORE UPDATE ON public.business_unit_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: business_units update_business_units_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_business_units_updated_at BEFORE UPDATE ON public.business_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chart_of_accounts update_chart_of_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chart_of_accounts_updated_at BEFORE UPDATE ON public.chart_of_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cooperative_books update_cooperative_books_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cooperative_books_updated_at BEFORE UPDATE ON public.cooperative_books FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cooperative_settings update_cooperative_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cooperative_settings_updated_at BEFORE UPDATE ON public.cooperative_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: exited_member_shu_payments update_exited_member_shu_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_exited_member_shu_payments_updated_at BEFORE UPDATE ON public.exited_member_shu_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: expense_entries update_expense_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_expense_entries_updated_at BEFORE UPDATE ON public.expense_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: fixed_assets update_fixed_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_fixed_assets_updated_at BEFORE UPDATE ON public.fixed_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: income_entries update_income_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_income_entries_updated_at BEFORE UPDATE ON public.income_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory_items update_inventory_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: journal_entries update_journal_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: letter_sequences update_letter_sequences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_letter_sequences_updated_at BEFORE UPDATE ON public.letter_sequences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: letter_templates update_letter_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_letter_templates_updated_at BEFORE UPDATE ON public.letter_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: loan_collaterals update_loan_collaterals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_loan_collaterals_updated_at BEFORE UPDATE ON public.loan_collaterals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: loan_installments update_loan_installments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_loan_installments_updated_at BEFORE UPDATE ON public.loan_installments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: loans update_loans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: overdue_handling update_overdue_handling_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_overdue_handling_updated_at BEFORE UPDATE ON public.overdue_handling FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pending_member_data update_pending_member_data_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pending_member_data_updated_at BEFORE UPDATE ON public.pending_member_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: resignation_requests update_resignation_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_resignation_requests_updated_at BEFORE UPDATE ON public.resignation_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: role_assignments update_role_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_role_assignments_updated_at BEFORE UPDATE ON public.role_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: savings_summary update_savings_summary_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_savings_summary_updated_at BEFORE UPDATE ON public.savings_summary FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shu_distributions update_shu_distributions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_shu_distributions_updated_at BEFORE UPDATE ON public.shu_distributions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shu_fund_activities update_shu_fund_activities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_shu_fund_activities_updated_at BEFORE UPDATE ON public.shu_fund_activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shu_withheld update_shu_withheld_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_shu_withheld_updated_at BEFORE UPDATE ON public.shu_withheld FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: signatory_signatures update_signatory_signatures_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_signatory_signatures_updated_at BEFORE UPDATE ON public.signatory_signatures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: loans validate_loan_data_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_loan_data_trigger BEFORE INSERT OR UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.validate_loan_data();


--
-- Name: profiles validate_profile_data_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_profile_data_trigger BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_profile_data();


--
-- Name: transactions validate_transaction_data_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_transaction_data_trigger BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_data();


--
-- Name: account_claim_tokens account_claim_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_claim_tokens
    ADD CONSTRAINT account_claim_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: archived_accounts archived_accounts_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archived_accounts
    ADD CONSTRAINT archived_accounts_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: balance_sheets balance_sheets_rollover_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balance_sheets
    ADD CONSTRAINT balance_sheets_rollover_journal_id_fkey FOREIGN KEY (rollover_journal_id) REFERENCES public.journal_entries(id);


--
-- Name: business_unit_transactions business_unit_transactions_business_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_unit_transactions
    ADD CONSTRAINT business_unit_transactions_business_unit_id_fkey FOREIGN KEY (business_unit_id) REFERENCES public.business_units(id) ON DELETE RESTRICT;


--
-- Name: chart_of_accounts chart_of_accounts_business_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_business_unit_id_fkey FOREIGN KEY (business_unit_id) REFERENCES public.business_units(id);


--
-- Name: chart_of_accounts chart_of_accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: cooperative_announcements cooperative_announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooperative_announcements
    ADD CONSTRAINT cooperative_announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: cooperative_books cooperative_books_business_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooperative_books
    ADD CONSTRAINT cooperative_books_business_unit_id_fkey FOREIGN KEY (business_unit_id) REFERENCES public.business_units(id);


--
-- Name: cooperative_settings cooperative_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooperative_settings
    ADD CONSTRAINT cooperative_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: corrections corrections_installment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corrections
    ADD CONSTRAINT corrections_installment_id_fkey FOREIGN KEY (installment_id) REFERENCES public.loan_installments(id);


--
-- Name: corrections corrections_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corrections
    ADD CONSTRAINT corrections_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: corrections corrections_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corrections
    ADD CONSTRAINT corrections_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);


--
-- Name: inventory_items inventory_items_business_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_business_unit_id_fkey FOREIGN KEY (business_unit_id) REFERENCES public.business_units(id);


--
-- Name: issued_letters issued_letters_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issued_letters
    ADD CONSTRAINT issued_letters_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES auth.users(id);


--
-- Name: journal_audit_logs journal_audit_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_audit_logs
    ADD CONSTRAINT journal_audit_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: journal_audit_logs journal_audit_logs_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_audit_logs
    ADD CONSTRAINT journal_audit_logs_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: journal_entries journal_entries_business_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_business_unit_id_fkey FOREIGN KEY (business_unit_id) REFERENCES public.business_units(id);


--
-- Name: journal_entry_lines journal_entry_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: journal_entry_lines journal_entry_lines_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: journal_template_audit_logs journal_template_audit_logs_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_template_audit_logs
    ADD CONSTRAINT journal_template_audit_logs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.journal_templates(id) ON DELETE SET NULL;


--
-- Name: journal_templates journal_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_templates
    ADD CONSTRAINT journal_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: loan_adjustment_history loan_adjustment_history_installment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_adjustment_history
    ADD CONSTRAINT loan_adjustment_history_installment_id_fkey FOREIGN KEY (installment_id) REFERENCES public.loan_installments(id) ON DELETE CASCADE;


--
-- Name: loan_adjustment_history loan_adjustment_history_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_adjustment_history
    ADD CONSTRAINT loan_adjustment_history_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;


--
-- Name: loan_collaterals loan_collaterals_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_collaterals
    ADD CONSTRAINT loan_collaterals_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;


--
-- Name: loan_installments loan_installments_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_installments
    ADD CONSTRAINT loan_installments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;


--
-- Name: loans loans_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: loans loans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: member_import_logs member_import_logs_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_import_logs
    ADD CONSTRAINT member_import_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.profiles(user_id);


--
-- Name: migration_snapshots migration_snapshots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_snapshots
    ADD CONSTRAINT migration_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: overdue_handling overdue_handling_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overdue_handling
    ADD CONSTRAINT overdue_handling_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;


--
-- Name: pending_member_data pending_member_data_claimed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_member_data
    ADD CONSTRAINT pending_member_data_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES auth.users(id);


--
-- Name: pending_member_data pending_member_data_matched_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_member_data
    ADD CONSTRAINT pending_member_data_matched_user_id_fkey FOREIGN KEY (matched_user_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: profiles profiles_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.cooperative_branches(id);


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reconciliation_logs reconciliation_logs_checked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_logs
    ADD CONSTRAINT reconciliation_logs_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES auth.users(id);


--
-- Name: role_assignments role_assignments_business_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_assignments
    ADD CONSTRAINT role_assignments_business_unit_id_fkey FOREIGN KEY (business_unit_id) REFERENCES public.business_units(id) ON DELETE SET NULL;


--
-- Name: savings_summary savings_summary_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.savings_summary
    ADD CONSTRAINT savings_summary_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: settings_change_logs settings_change_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_change_logs
    ADD CONSTRAINT settings_change_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: shu_fund_activities shu_fund_activities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shu_fund_activities
    ADD CONSTRAINT shu_fund_activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: shu_records shu_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shu_records
    ADD CONSTRAINT shu_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shu_rollover_history shu_rollover_history_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shu_rollover_history
    ADD CONSTRAINT shu_rollover_history_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: signatory_signatures signatory_signatures_role_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signatory_signatures
    ADD CONSTRAINT signatory_signatures_role_assignment_id_fkey FOREIGN KEY (role_assignment_id) REFERENCES public.role_assignments(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: transactions transactions_installment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_installment_id_fkey FOREIGN KEY (installment_id) REFERENCES public.loan_installments(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: archived_accounts Admins can create archived accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create archived accounts" ON public.archived_accounts FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: audit_logs Admins can create audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create audit logs" ON public.audit_logs FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: corrections Admins can create corrections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create corrections" ON public.corrections FOR INSERT WITH CHECK (( SELECT (EXISTS ( SELECT 1
           FROM public.user_roles
          WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.user_role)))) AS "exists"));


--
-- Name: migration_snapshots Admins can create migration snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create migration snapshots" ON public.migration_snapshots FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: reconciliation_logs Admins can create reconciliation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create reconciliation logs" ON public.reconciliation_logs FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: corrections Admins can delete corrections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete corrections" ON public.corrections FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.user_role)))));


--
-- Name: journal_templates Admins can delete journal templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete journal templates" ON public.journal_templates FOR DELETE USING (public.is_admin());


--
-- Name: loans Admins can delete loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete loans" ON public.loans FOR DELETE USING (public.is_admin());


--
-- Name: migration_snapshots Admins can delete migration snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete migration snapshots" ON public.migration_snapshots FOR DELETE USING (public.is_admin());


--
-- Name: pending_member_data Admins can delete pending member data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete pending member data" ON public.pending_member_data FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: profiles Admins can delete profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (public.is_admin());


--
-- Name: transactions Admins can delete transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete transactions" ON public.transactions FOR DELETE USING (public.is_admin());


--
-- Name: admin_activity_logs Admins can insert admin activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert admin activity logs" ON public.admin_activity_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: member_import_logs Admins can insert import logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert import logs" ON public.member_import_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: journal_template_audit_logs Admins can insert journal template audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert journal template audit logs" ON public.journal_template_audit_logs FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: journal_templates Admins can insert journal templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert journal templates" ON public.journal_templates FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: pending_member_data Admins can insert pending member data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert pending member data" ON public.pending_member_data FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: profiles Admins can insert profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: shu_records Admins can manage SHU; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage SHU" ON public.shu_records USING (public.is_admin());


--
-- Name: shu_distributions Admins can manage SHU distributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage SHU distributions" ON public.shu_distributions USING (public.is_admin());


--
-- Name: shu_fund_activities Admins can manage SHU fund activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage SHU fund activities" ON public.shu_fund_activities USING (public.is_admin());


--
-- Name: admin_notifications Admins can manage admin notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage admin notifications" ON public.admin_notifications USING (public.is_admin());


--
-- Name: loan_collaterals Admins can manage all collaterals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all collaterals" ON public.loan_collaterals USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: member_notifications Admins can manage all notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all notifications" ON public.member_notifications USING (public.is_admin());


--
-- Name: resignation_requests Admins can manage all resignation requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all resignation requests" ON public.resignation_requests USING (public.is_admin());


--
-- Name: cooperative_announcements Admins can manage announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage announcements" ON public.cooperative_announcements USING (public.is_admin());


--
-- Name: balance_sheets Admins can manage balance sheets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage balance sheets" ON public.balance_sheets USING (public.is_admin());


--
-- Name: bank_reconciliations Admins can manage bank reconciliations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage bank reconciliations" ON public.bank_reconciliations USING (public.is_admin());


--
-- Name: cooperative_branches Admins can manage branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage branches" ON public.cooperative_branches USING (public.is_admin());


--
-- Name: business_unit_transactions Admins can manage business unit transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage business unit transactions" ON public.business_unit_transactions USING (public.is_admin());


--
-- Name: business_units Admins can manage business units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage business units" ON public.business_units USING (public.is_admin());


--
-- Name: chart_of_accounts Admins can manage chart of accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage chart of accounts" ON public.chart_of_accounts USING (public.is_admin());


--
-- Name: cooperative_books Admins can manage cooperative books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage cooperative books" ON public.cooperative_books USING (public.is_admin());


--
-- Name: data_backups Admins can manage data backups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage data backups" ON public.data_backups USING (public.is_admin());


--
-- Name: exited_member_shu_payments Admins can manage exited member SHU payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage exited member SHU payments" ON public.exited_member_shu_payments USING (public.is_admin());


--
-- Name: expense_entries Admins can manage expense entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage expense entries" ON public.expense_entries USING (public.is_admin());


--
-- Name: fixed_assets Admins can manage fixed assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage fixed assets" ON public.fixed_assets USING (public.is_admin());


--
-- Name: income_entries Admins can manage income entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage income entries" ON public.income_entries USING (public.is_admin());


--
-- Name: loan_installments Admins can manage installments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage installments" ON public.loan_installments USING (public.is_admin());


--
-- Name: interest_notifications Admins can manage interest notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage interest notifications" ON public.interest_notifications USING (public.is_admin());


--
-- Name: inventory_items Admins can manage inventory items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage inventory items" ON public.inventory_items USING (public.is_admin());


--
-- Name: issued_letters Admins can manage issued letters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage issued letters" ON public.issued_letters USING (public.is_admin());


--
-- Name: journal_audit_logs Admins can manage journal audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage journal audit logs" ON public.journal_audit_logs USING (public.is_admin());


--
-- Name: journal_entries Admins can manage journal entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage journal entries" ON public.journal_entries USING (public.is_admin());


--
-- Name: journal_entry_lines Admins can manage journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage journal entry lines" ON public.journal_entry_lines USING (public.is_admin());


--
-- Name: letter_sequences Admins can manage letter sequences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage letter sequences" ON public.letter_sequences USING (public.is_admin());


--
-- Name: letter_templates Admins can manage letter templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage letter templates" ON public.letter_templates USING (public.is_admin());


--
-- Name: loan_adjustment_history Admins can manage loan adjustment history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage loan adjustment history" ON public.loan_adjustment_history USING (public.is_admin());


--
-- Name: overdue_handling Admins can manage overdue handling; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage overdue handling" ON public.overdue_handling USING (public.is_admin());


--
-- Name: role_assignments Admins can manage role assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage role assignments" ON public.role_assignments USING (public.is_admin());


--
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage roles" ON public.user_roles USING (public.is_admin());


--
-- Name: savings_summary Admins can manage savings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage savings" ON public.savings_summary USING (public.is_admin());


--
-- Name: cooperative_settings Admins can manage settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage settings" ON public.cooperative_settings USING (public.is_admin());


--
-- Name: settings_change_logs Admins can manage settings change logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage settings change logs" ON public.settings_change_logs USING (public.is_admin());


--
-- Name: shu_rollover_history Admins can manage shu rollover history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage shu rollover history" ON public.shu_rollover_history USING (public.is_admin());


--
-- Name: signatory_signatures Admins can manage signatory signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage signatory signatures" ON public.signatory_signatures TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: shu_withheld Admins can manage withheld SHU; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage withheld SHU" ON public.shu_withheld USING (public.is_admin());


--
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin());


--
-- Name: corrections Admins can update corrections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update corrections" ON public.corrections FOR UPDATE USING (( SELECT (EXISTS ( SELECT 1
           FROM public.user_roles
          WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.user_role)))) AS "exists"));


--
-- Name: journal_templates Admins can update journal templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update journal templates" ON public.journal_templates FOR UPDATE USING (public.is_admin());


--
-- Name: loans Admins can update loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update loans" ON public.loans FOR UPDATE USING (public.is_admin());


--
-- Name: pending_member_data Admins can update pending member data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update pending member data" ON public.pending_member_data FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: transactions Admins can update transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update transactions" ON public.transactions FOR UPDATE USING (public.is_admin());


--
-- Name: shu_records Admins can view all SHU; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all SHU" ON public.shu_records FOR SELECT USING (public.is_admin());


--
-- Name: admin_activity_logs Admins can view all admin activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all admin activity logs" ON public.admin_activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: admin_permissions Admins can view all admin permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all admin permissions" ON public.admin_permissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: email_change_logs Admins can view all email change logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all email change logs" ON public.email_change_logs FOR SELECT USING (public.is_admin());


--
-- Name: loan_installments Admins can view all installments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all installments" ON public.loan_installments FOR SELECT USING (public.is_admin());


--
-- Name: loans Admins can view all loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all loans" ON public.loans FOR SELECT USING (public.is_admin());


--
-- Name: password_change_logs Admins can view all password change logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all password change logs" ON public.password_change_logs FOR SELECT USING (public.is_admin());


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.is_admin());


--
-- Name: savings_summary Admins can view all savings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all savings" ON public.savings_summary FOR SELECT USING (public.is_admin());


--
-- Name: transactions Admins can view all transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all transactions" ON public.transactions FOR SELECT USING (public.is_admin());


--
-- Name: archived_accounts Admins can view archived accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view archived accounts" ON public.archived_accounts FOR SELECT USING (public.is_admin());


--
-- Name: audit_logs Admins can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin());


--
-- Name: member_import_logs Admins can view import logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view import logs" ON public.member_import_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: journal_template_audit_logs Admins can view journal template audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view journal template audit logs" ON public.journal_template_audit_logs FOR SELECT USING (public.is_admin());


--
-- Name: journal_templates Admins can view journal templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view journal templates" ON public.journal_templates FOR SELECT USING (public.is_admin());


--
-- Name: migration_snapshots Admins can view migration snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view migration snapshots" ON public.migration_snapshots FOR SELECT USING (public.is_admin());


--
-- Name: pending_member_data Admins can view pending member data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view pending member data" ON public.pending_member_data FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: reconciliation_logs Admins can view reconciliation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view reconciliation logs" ON public.reconciliation_logs FOR SELECT USING (public.is_admin());


--
-- Name: savings_audit_log Admins can view savings audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view savings audit logs" ON public.savings_audit_log FOR SELECT USING (public.is_admin());


--
-- Name: cooperative_branches Anyone can view active branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active branches" ON public.cooperative_branches FOR SELECT USING ((is_active = true));


--
-- Name: cooperative_settings Anyone can view registration settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view registration settings" ON public.cooperative_settings FOR SELECT USING ((key = ANY (ARRAY['bank_name'::text, 'bank_account_number'::text, 'bank_account_name'::text, 'available_banks'::text, 'simpanan_pokok'::text, 'simpanan_wajib'::text, 'cooperative_name'::text, 'cooperative_address'::text, 'cooperative_legal_number'::text, 'cooperative_logo_base64'::text, 'cooperative_banner_base64'::text, 'cooperative_vision'::text, 'cooperative_mission'::text, 'cooperative_services'::text, 'cooperative_ad_art_content'::text, 'contact_phone'::text, 'logo_frame'::text, 'logo_size'::text, 'logo_container_splash'::text, 'logo_container_header'::text, 'logo_container_footer'::text, 'logo_container_card'::text, 'card_gradient_start'::text, 'card_gradient_end'::text, 'card_gradient_direction'::text, 'card_use_gender_colors'::text, 'card_gradient_male_start'::text, 'card_gradient_male_end'::text, 'card_gradient_female_start'::text, 'card_gradient_female_end'::text, 'enable_branch_feature'::text, 'branch_terminology'::text])));


--
-- Name: shu_distributions Authenticated users can view SHU distributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view SHU distributions" ON public.shu_distributions FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: shu_fund_activities Authenticated users can view SHU fund activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view SHU fund activities" ON public.shu_fund_activities FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: balance_sheets Authenticated users can view balance sheets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view balance sheets" ON public.balance_sheets FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: bank_reconciliations Authenticated users can view bank reconciliations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view bank reconciliations" ON public.bank_reconciliations FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: business_units Authenticated users can view business units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view business units" ON public.business_units FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: chart_of_accounts Authenticated users can view chart of accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view chart of accounts" ON public.chart_of_accounts FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: cooperative_books Authenticated users can view cooperative books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view cooperative books" ON public.cooperative_books FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: expense_entries Authenticated users can view expense entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view expense entries" ON public.expense_entries FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: fixed_assets Authenticated users can view fixed assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view fixed assets" ON public.fixed_assets FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: income_entries Authenticated users can view income entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view income entries" ON public.income_entries FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: inventory_items Authenticated users can view inventory items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view inventory items" ON public.inventory_items FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: issued_letters Authenticated users can view issued letters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view issued letters" ON public.issued_letters FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: journal_audit_logs Authenticated users can view journal audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view journal audit logs" ON public.journal_audit_logs FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: journal_entries Authenticated users can view journal entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view journal entries" ON public.journal_entries FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: journal_entry_lines Authenticated users can view journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view journal entry lines" ON public.journal_entry_lines FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: letter_sequences Authenticated users can view letter sequences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view letter sequences" ON public.letter_sequences FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: letter_templates Authenticated users can view letter templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view letter templates" ON public.letter_templates FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: overdue_handling Authenticated users can view overdue handling; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view overdue handling" ON public.overdue_handling FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: role_assignments Authenticated users can view role assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view role assignments" ON public.role_assignments FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: settings_change_logs Authenticated users can view settings change logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view settings change logs" ON public.settings_change_logs FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: shu_rollover_history Authenticated users can view shu rollover history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view shu rollover history" ON public.shu_rollover_history FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: corrections Members can report their own corrections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can report their own corrections" ON public.corrections FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: loan_collaterals Members can submit own collaterals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can submit own collaterals" ON public.loan_collaterals FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.loans
  WHERE ((loans.id = loan_collaterals.loan_id) AND (loans.user_id = auth.uid())))));


--
-- Name: signatory_signatures Members can view active signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view active signatures" ON public.signatory_signatures FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: loan_collaterals Members can view own collaterals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view own collaterals" ON public.loan_collaterals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.loans
  WHERE ((loans.id = loan_collaterals.loan_id) AND (loans.user_id = auth.uid())))));


--
-- Name: cooperative_announcements Members can view their announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view their announcements" ON public.cooperative_announcements FOR SELECT USING (((target_type = 'all_members'::text) OR (auth.uid() = ANY (target_user_ids))));


--
-- Name: business_unit_transactions Members can view their own business unit transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view their own business unit transactions" ON public.business_unit_transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: corrections Members can view their own corrections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view their own corrections" ON public.corrections FOR SELECT USING (((auth.uid() = user_id) OR ( SELECT (EXISTS ( SELECT 1
           FROM public.user_roles
          WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.user_role)))) AS "exists")));


--
-- Name: admin_permissions Only admins with can_manage_admins can delete permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins with can_manage_admins can delete permissions" ON public.admin_permissions FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.user_role) AND (EXISTS ( SELECT 1
   FROM public.admin_permissions admin_permissions_1
  WHERE ((admin_permissions_1.user_id = auth.uid()) AND (admin_permissions_1.can_manage_admins = true))))));


--
-- Name: admin_permissions Only admins with can_manage_admins can insert permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins with can_manage_admins can insert permissions" ON public.admin_permissions FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.user_role) AND ((NOT (EXISTS ( SELECT 1
   FROM public.admin_permissions admin_permissions_1))) OR (EXISTS ( SELECT 1
   FROM public.admin_permissions admin_permissions_1
  WHERE ((admin_permissions_1.user_id = auth.uid()) AND (admin_permissions_1.can_manage_admins = true)))))));


--
-- Name: admin_permissions Only admins with can_manage_admins can update permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins with can_manage_admins can update permissions" ON public.admin_permissions FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.user_role) AND (EXISTS ( SELECT 1
   FROM public.admin_permissions admin_permissions_1
  WHERE ((admin_permissions_1.user_id = auth.uid()) AND (admin_permissions_1.can_manage_admins = true))))));


--
-- Name: account_claim_tokens Service role can manage claim tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage claim tokens" ON public.account_claim_tokens USING (true);


--
-- Name: resignation_requests Users can cancel their pending resignation requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can cancel their pending resignation requests" ON public.resignation_requests FOR UPDATE USING (((auth.uid() = user_id) AND (status = 'pending'::text))) WITH CHECK (((auth.uid() = user_id) AND (status = 'cancelled'::text)));


--
-- Name: loans Users can create loan applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create loan applications" ON public.loans FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: resignation_requests Users can create their own resignation requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own resignation requests" ON public.resignation_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: transactions Users can create their own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own transactions" ON public.transactions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: member_notifications Users can delete their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own notifications" ON public.member_notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: loans Users can delete their own pending loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own pending loans" ON public.loans FOR DELETE USING (((auth.uid() = user_id) AND (status = 'pending'::public.loan_status)));


--
-- Name: notification_reads Users can delete their own read notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own read notifications" ON public.notification_reads FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: email_change_logs Users can insert own email change logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own email change logs" ON public.email_change_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: password_change_logs Users can insert their own password change logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own password change logs" ON public.password_change_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: notification_reads Users can insert their own read notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own read notifications" ON public.notification_reads FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: interest_notifications Users can update their own interest notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own interest notifications" ON public.interest_notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: member_notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.member_notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: email_change_logs Users can view own email change logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own email change logs" ON public.email_change_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: loan_installments Users can view their loan installments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their loan installments" ON public.loan_installments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.loans
  WHERE ((loans.id = loan_installments.loan_id) AND (loans.user_id = auth.uid())))));


--
-- Name: shu_records Users can view their own SHU; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own SHU" ON public.shu_records FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: exited_member_shu_payments Users can view their own SHU payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own SHU payments" ON public.exited_member_shu_payments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: loan_adjustment_history Users can view their own adjustment history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own adjustment history" ON public.loan_adjustment_history FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: interest_notifications Users can view their own interest notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own interest notifications" ON public.interest_notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: loans Users can view their own loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own loans" ON public.loans FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: member_notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.member_notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: password_change_logs Users can view their own password change logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own password change logs" ON public.password_change_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notification_reads Users can view their own read notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own read notifications" ON public.notification_reads FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: resignation_requests Users can view their own resignation requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own resignation requests" ON public.resignation_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: savings_summary Users can view their own savings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own savings" ON public.savings_summary FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: transactions Users can view their own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: shu_withheld Users can view their own withheld SHU; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own withheld SHU" ON public.shu_withheld FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: account_claim_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_claim_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: archived_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.archived_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: balance_sheets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.balance_sheets ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_reconciliations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

--
-- Name: business_unit_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_unit_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: business_units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

--
-- Name: chart_of_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: cooperative_announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cooperative_announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: cooperative_books; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cooperative_books ENABLE ROW LEVEL SECURITY;

--
-- Name: cooperative_branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cooperative_branches ENABLE ROW LEVEL SECURITY;

--
-- Name: cooperative_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cooperative_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: corrections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;

--
-- Name: data_backups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_backups ENABLE ROW LEVEL SECURITY;

--
-- Name: email_change_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_change_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: exited_member_shu_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exited_member_shu_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: fixed_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: income_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: interest_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interest_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: issued_letters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.issued_letters ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_entry_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_template_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_template_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: letter_sequences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.letter_sequences ENABLE ROW LEVEL SECURITY;

--
-- Name: letter_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.letter_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: loan_adjustment_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loan_adjustment_history ENABLE ROW LEVEL SECURITY;

--
-- Name: loan_collaterals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loan_collaterals ENABLE ROW LEVEL SECURITY;

--
-- Name: loan_installments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;

--
-- Name: loans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

--
-- Name: member_import_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_import_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: member_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: migration_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.migration_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: overdue_handling; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.overdue_handling ENABLE ROW LEVEL SECURITY;

--
-- Name: password_change_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_change_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_member_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pending_member_data ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: reconciliation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reconciliation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: resignation_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resignation_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: role_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: savings_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.savings_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: savings_summary; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.savings_summary ENABLE ROW LEVEL SECURITY;

--
-- Name: settings_change_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings_change_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: shu_distributions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shu_distributions ENABLE ROW LEVEL SECURITY;

--
-- Name: shu_fund_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shu_fund_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: shu_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shu_records ENABLE ROW LEVEL SECURITY;

--
-- Name: shu_rollover_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shu_rollover_history ENABLE ROW LEVEL SECURITY;

--
-- Name: shu_withheld; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shu_withheld ENABLE ROW LEVEL SECURITY;

--
-- Name: signatory_signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.signatory_signatures ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;