# Dokumentasi Keamanan Sistem

Dokumentasi lengkap mengenai arsitektur keamanan, implementasi, dan best practices aplikasi koperasi.

---

## Daftar Isi

1. [Arsitektur Keamanan](#arsitektur-keamanan)
2. [Autentikasi](#autentikasi)
3. [Otorisasi & Role-Based Access Control](#otorisasi--role-based-access-control)
4. [Row Level Security (RLS)](#row-level-security-rls)
5. [Enkripsi Data](#enkripsi-data)
6. [Proteksi Terhadap Serangan](#proteksi-terhadap-serangan)
7. [Audit & Logging](#audit--logging)
8. [Manajemen Secrets](#manajemen-secrets)
9. [Checklist Keamanan](#checklist-keamanan)

---

## Arsitektur Keamanan

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  React App + Supabase Client (Anon Key)                 │ │
│  │  - Input Validation (Zod)                               │ │
│  │  - XSS Prevention (HTML Sanitization)                   │ │
│  │  - CSRF Protection (SameSite Cookies)                   │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE BACKEND                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Edge Functions (Deno)                                  │ │
│  │  - Rate Limiting                                        │ │
│  │  - JWT Verification                                     │ │
│  │  - Service Role Operations                              │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL Database                                    │ │
│  │  - Row Level Security (RLS)                             │ │
│  │  - Encrypted Columns (NIK)                              │ │
│  │  - Audit Triggers                                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Supabase Auth                                          │ │
│  │  - JWT Tokens                                           │ │
│  │  - Refresh Tokens                                       │ │
│  │  - Leaked Password Protection                           │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Prinsip Keamanan

1. **Defense in Depth**: Keamanan berlapis di setiap level
2. **Principle of Least Privilege**: Akses minimal yang diperlukan
3. **Zero Trust**: Verifikasi setiap request
4. **Secure by Default**: Konfigurasi aman secara default

---

## Autentikasi

### Mekanisme Login

```typescript
// Autentikasi menggunakan Supabase Auth
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});
```

### Fitur Keamanan Autentikasi

| Fitur | Deskripsi | Status |
|-------|-----------|--------|
| Password Hashing | bcrypt dengan salt | ✅ Aktif |
| JWT Tokens | Access + Refresh tokens | ✅ Aktif |
| Session Management | Auto-refresh tokens | ✅ Aktif |
| Leaked Password Protection | Cek password bocor | ⚠️ Perlu Aktifkan |
| Rate Limiting | Batasi percobaan login | ✅ Aktif |
| Force Password Change | Wajib ganti password | ✅ Aktif |

### Leaked Password Protection

**WAJIB DIAKTIFKAN** di Supabase Dashboard:

1. Buka **Authentication > Settings**
2. Scroll ke **Security**
3. Aktifkan **"Enable Leaked Password Protection"**

### Force Password Change

Anggota migrasi dengan password default wajib mengganti password saat login pertama:

```typescript
// Cek status force password change
if (profile.force_password_change) {
  // Redirect ke form ganti password
  navigate('/change-password');
}
```

---

## Otorisasi & Role-Based Access Control

### Struktur Role

```sql
-- Enum untuk role
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Tabel user_roles (TERPISAH dari profiles!)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);
```

> ⚠️ **KRITIS**: Role HARUS disimpan di tabel terpisah, BUKAN di profiles. Ini mencegah privilege escalation attack.

### Helper Functions

```sql
-- Cek apakah user adalah admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

-- Cek role user
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### Penggunaan di Client

```typescript
// JANGAN gunakan localStorage untuk cek admin!
// ❌ SALAH
const isAdmin = localStorage.getItem('isAdmin') === 'true';

// ✅ BENAR - Cek dari database
const { data: roles } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id);

const isAdmin = roles?.some(r => r.role === 'admin');
```

---

## Row Level Security (RLS)

### Prinsip RLS

1. **Semua tabel HARUS** memiliki RLS enabled
2. **Default deny** - tanpa policy, tidak ada akses
3. **Gunakan auth.uid()** untuk filter berdasarkan user
4. **Gunakan is_admin()** untuk akses admin

### Contoh Policy Patterns

#### Pattern 1: User hanya akses data sendiri

```sql
-- Profiles: User hanya bisa lihat dan edit profil sendiri
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);
```

#### Pattern 2: Admin bisa akses semua

```sql
-- Transactions: Member lihat milik sendiri, admin lihat semua
CREATE POLICY "Members view own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Only admin can update transactions"
ON public.transactions FOR UPDATE
USING (is_admin());
```

#### Pattern 3: Public read, authenticated write

```sql
-- Cooperative settings: Semua bisa baca, admin bisa tulis
CREATE POLICY "Anyone can read settings"
ON public.cooperative_settings FOR SELECT
USING (true);

CREATE POLICY "Only admin can modify settings"
ON public.cooperative_settings FOR ALL
USING (is_admin());
```

#### Pattern 4: Service role only

```sql
-- Account claim tokens: Hanya service role
CREATE POLICY "Service role only"
ON public.account_claim_tokens FOR ALL
USING (auth.jwt()->>'role' = 'service_role');
```

### Tabel dengan RLS Khusus

| Tabel | Policy | Alasan |
|-------|--------|--------|
| `account_claim_tokens` | Service role only | Mencegah enumeration attack |
| `admin_permissions` | Admin only | Data sensitif akses admin |
| `audit_logs` | Read: admin, Write: system | Integritas audit trail |
| `profiles` | User own + admin | Privasi data anggota |
| `savings_summary` | User own + admin | Data keuangan sensitif |
| `loan_collaterals` | User own + admin | Data jaminan sensitif |

### Verifikasi RLS

```sql
-- Cek tabel tanpa RLS (harus kosong!)
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false;

-- Cek policy per tabel
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

---

## Enkripsi Data

### Data Terenkripsi

| Field | Metode | Lokasi |
|-------|--------|--------|
| Password | bcrypt | Supabase Auth |
| NIK | AES-256-CBC | Database (private schema) |
| Session tokens | JWT signing | Supabase Auth |

---

## Arsitektur Enkripsi NIK

### Overview

NIK (Nomor Induk Kependudukan) adalah data sensitif yang **wajib dienkripsi** sesuai regulasi perlindungan data pribadi Indonesia.

```
┌─────────────────────────────────────────────────────────────────┐
│                     ARSITEKTUR ENKRIPSI NIK                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    Trigger    ┌──────────────────────────┐    │
│  │  INPUT NIK  │ ──────────────▶│  encrypt_nik_on_insert   │    │
│  │  (Plaintext)│               │  (BEFORE INSERT/UPDATE)  │    │
│  └─────────────┘               └────────────┬─────────────┘    │
│                                             │                   │
│                                             ▼                   │
│                               ┌──────────────────────────┐      │
│                               │   private.encryption_keys │      │
│                               │   ┌──────────────────┐   │      │
│                               │   │ nik_encryption_key│   │      │
│                               │   │ (AES-256 key)    │   │      │
│                               │   └──────────────────┘   │      │
│                               └────────────┬─────────────┘      │
│                                            │                    │
│                                            ▼                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    profiles TABLE                        │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  nik_encrypted (bytea) - Data terenkripsi       │    │   │
│  │  │  nik (REMOVED) - Kolom plaintext sudah dihapus  │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                           AKSES DATA                            │
│                               │                                 │
│           ┌───────────────────┼───────────────────┐            │
│           ▼                   ▼                   ▼            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ get_decrypted_  │ │ check_nik_      │ │ profiles_with_  │   │
│  │ nik(user_id)    │ │ exists(nik)     │ │ decrypted_nik   │   │
│  │ (RPC Function)  │ │ (RPC Function)  │ │ (View)          │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Komponen Sistem

#### 1. Private Schema

```sql
-- Schema terpisah untuk data sensitif
CREATE SCHEMA IF NOT EXISTS private;

-- Tabel penyimpanan encryption keys
CREATE TABLE private.encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name TEXT UNIQUE NOT NULL,
    key_value TEXT NOT NULL,  -- Encryption key (base64)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Hanya service_role yang bisa akses
ALTER TABLE private.encryption_keys ENABLE ROW LEVEL SECURITY;
-- Tidak ada policy = tidak ada akses dari client
```

#### 2. Fungsi Enkripsi

```sql
-- Fungsi enkripsi NIK menggunakan AES-256
CREATE OR REPLACE FUNCTION private.encrypt_nik_value(plaintext_nik TEXT)
RETURNS BYTEA AS $$
DECLARE
    encryption_key BYTEA;
BEGIN
    -- Ambil key dari tabel private
    SELECT decode(key_value, 'base64') INTO encryption_key
    FROM private.encryption_keys
    WHERE key_name = 'nik_encryption_key';
    
    IF encryption_key IS NULL THEN
        RAISE EXCEPTION 'Encryption key not found';
    END IF;
    
    -- Enkripsi menggunakan AES-256-CBC
    RETURN encrypt_iv(
        plaintext_nik::bytea,
        encryption_key,
        '\x00000000000000000000000000000000'::bytea,  -- IV
        'aes-cbc'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = private, public;
```

#### 3. Fungsi Dekripsi

```sql
-- Fungsi dekripsi NIK (hanya untuk authorized users)
CREATE OR REPLACE FUNCTION public.get_decrypted_nik(target_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    encrypted_nik BYTEA;
    encryption_key BYTEA;
    decrypted_nik TEXT;
BEGIN
    -- Cek otorisasi: hanya user sendiri atau admin
    IF auth.uid() != target_user_id AND NOT is_admin() THEN
        RETURN NULL;
    END IF;
    
    -- Ambil NIK terenkripsi
    SELECT nik_encrypted INTO encrypted_nik
    FROM profiles
    WHERE id = target_user_id;
    
    IF encrypted_nik IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Ambil encryption key
    SELECT decode(key_value, 'base64') INTO encryption_key
    FROM private.encryption_keys
    WHERE key_name = 'nik_encryption_key';
    
    -- Dekripsi
    decrypted_nik := convert_from(
        decrypt_iv(
            encrypted_nik,
            encryption_key,
            '\x00000000000000000000000000000000'::bytea,
            'aes-cbc'
        ),
        'UTF8'
    );
    
    RETURN decrypted_nik;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private;
```

#### 4. Trigger Otomatis

```sql
-- Trigger untuk enkripsi NIK saat insert/update
CREATE OR REPLACE FUNCTION public.encrypt_nik_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Jika NIK diberikan dalam metadata
    IF NEW.nik IS NOT NULL AND NEW.nik != '' THEN
        NEW.nik_encrypted := private.encrypt_nik_value(NEW.nik);
        NEW.nik := NULL;  -- Hapus plaintext
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_encrypt_nik
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION encrypt_nik_on_insert();
```

#### 5. View untuk Admin

```sql
-- View dengan NIK terdekripsi (hanya untuk admin)
CREATE OR REPLACE VIEW public.profiles_with_decrypted_nik AS
SELECT 
    p.*,
    CASE 
        WHEN is_admin() THEN get_decrypted_nik(p.id)
        ELSE NULL
    END as nik
FROM profiles p;
```

### Fungsi Pendukung

```sql
-- Cek apakah NIK sudah terdaftar (tanpa expose NIK)
CREATE OR REPLACE FUNCTION public.check_nik_exists(input_nik TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    encrypted_input BYTEA;
    found BOOLEAN;
BEGIN
    -- Enkripsi input untuk perbandingan
    encrypted_input := private.encrypt_nik_value(input_nik);
    
    -- Cek keberadaan
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE nik_encrypted = encrypted_input
    ) INTO found;
    
    RETURN found;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update NIK member (untuk migrasi/koreksi)
CREATE OR REPLACE FUNCTION public.update_member_nik(
    target_user_id UUID,
    new_nik TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Hanya admin yang bisa update
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    UPDATE profiles
    SET nik_encrypted = private.encrypt_nik_value(new_nik),
        updated_at = now()
    WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Prosedur Rotasi Key

Jika encryption key perlu diganti (rotasi berkala atau compromised):

```sql
-- 1. Backup data terlebih dahulu!

-- 2. Fungsi re-enkripsi semua NIK
CREATE OR REPLACE FUNCTION private.reencrypt_all_nik(
    old_key_b64 TEXT,
    new_key_b64 TEXT
)
RETURNS INTEGER AS $$
DECLARE
    old_key BYTEA;
    new_key BYTEA;
    rec RECORD;
    count INTEGER := 0;
    decrypted_nik TEXT;
BEGIN
    old_key := decode(old_key_b64, 'base64');
    new_key := decode(new_key_b64, 'base64');
    
    FOR rec IN SELECT id, nik_encrypted FROM profiles WHERE nik_encrypted IS NOT NULL
    LOOP
        BEGIN
            -- Dekripsi dengan key lama
            decrypted_nik := convert_from(
                decrypt_iv(
                    rec.nik_encrypted,
                    old_key,
                    '\x00000000000000000000000000000000'::bytea,
                    'aes-cbc'
                ),
                'UTF8'
            );
            
            -- Re-enkripsi dengan key baru
            UPDATE profiles
            SET nik_encrypted = encrypt_iv(
                decrypted_nik::bytea,
                new_key,
                '\x00000000000000000000000000000000'::bytea,
                'aes-cbc'
            )
            WHERE id = rec.id;
            
            count := count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to reencrypt NIK for user %: %', rec.id, SQLERRM;
        END;
    END LOOP;
    
    -- Update key di tabel
    UPDATE private.encryption_keys
    SET key_value = new_key_b64,
        updated_at = now()
    WHERE key_name = 'nik_encryption_key';
    
    RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Jalankan rotasi
SELECT private.reencrypt_all_nik('OLD_KEY_BASE64', 'NEW_KEY_BASE64');

-- 4. Verifikasi
SELECT id, get_decrypted_nik(id) FROM profiles LIMIT 5;
```

### Best Practices Key Management

1. **Generate Key yang Kuat**
   ```bash
   openssl rand -base64 32  # Minimal 256-bit
   ```

2. **Simpan Key dengan Aman**
   - Gunakan password manager enterprise
   - Backup terenkripsi di lokasi terpisah
   - Jangan simpan di repository atau log

3. **Rotasi Berkala**
   - Rotasi key setiap 12 bulan
   - Rotasi segera jika ada indikasi compromise

4. **Audit Access**
   - Log semua akses ke fungsi dekripsi
   - Monitor penggunaan abnormal

5. **Separation of Duties**
   - DBA tidak perlu tahu key
   - Key owner tidak perlu akses database

---

### Data Sensitif yang TIDAK Boleh Diekspos

- Password (hanya hash yang disimpan)
- NIK (terenkripsi, hanya bisa diakses via RPC)
- Token klaim akun
- Service role key
- ADMIN_SETUP_KEY
- NIK Encryption Key

---

## Proteksi Terhadap Serangan

### 1. XSS (Cross-Site Scripting)

**Implementasi:**

```typescript
// Sanitasi HTML untuk export/print
export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Penggunaan
const safeName = escapeHtml(user.name);
```

**Lokasi:** `src/lib/utils.ts`

### 2. SQL Injection

**Proteksi:** Supabase client otomatis parameterize queries

```typescript
// ✅ AMAN - Parameterized query
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId);

// ❌ BERBAHAYA - Jangan lakukan ini!
const { data } = await supabase.rpc('search', {
  query: `SELECT * FROM profiles WHERE name = '${userInput}'`
});
```

### 3. CSRF (Cross-Site Request Forgery)

**Proteksi:** 
- SameSite cookies
- JWT di Authorization header
- Origin validation di Edge Functions

### 4. Brute Force Attack

**Implementasi di claim-account:**

```typescript
// Rate limiting per IP
const attempts = await getAttemptsByIP(ip);
if (attempts >= 5) {
  return new Response(
    JSON.stringify({ error: 'Terlalu banyak percobaan' }),
    { status: 429 }
  );
}

// Rate limiting per NIK
const nikAttempts = await getAttemptsByNIK(nik);
if (nikAttempts >= 3) {
  return new Response(
    JSON.stringify({ error: 'NIK terkunci sementara' }),
    { status: 423 }
  );
}
```

**Konfigurasi:**
- IP: 5 percobaan / 15 menit
- NIK: 3 percobaan gagal = lockout 1 jam

### 5. Privilege Escalation

**Pencegahan:**
- Role di tabel terpisah dengan RLS ketat
- Tidak ada role check di client-side storage
- Semua operasi admin divalidasi server-side

```sql
-- Policy mencegah user mengubah role sendiri
CREATE POLICY "Only superadmin can modify roles"
ON public.user_roles FOR ALL
USING (
  is_admin() AND 
  EXISTS (
    SELECT 1 FROM admin_permissions 
    WHERE user_id = auth.uid() 
    AND can_manage_admins = true
  )
);
```

### 6. Insecure Direct Object Reference (IDOR)

**Proteksi:** RLS memastikan user hanya akses data sendiri

```sql
-- User tidak bisa akses pinjaman user lain
CREATE POLICY "Users view own loans"
ON public.loans FOR SELECT
USING (user_id = auth.uid() OR is_admin());
```

---

## Audit & Logging

### Jenis Audit Log

1. **Admin Activity Logs**: Semua aksi admin
2. **Audit Logs**: Perubahan data penting
3. **Password Audit Logs**: Perubahan password
4. **Journal Audit Logs**: Perubahan jurnal akuntansi
5. **Settings Change Logs**: Perubahan pengaturan

### Struktur Audit Log

```sql
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    description TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Trigger Audit Otomatis

```sql
-- Trigger untuk log perubahan profiles
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id, action_type, entity_type, entity_id,
    old_data, new_data, description
  ) VALUES (
    auth.uid(),
    TG_OP,
    'profile',
    COALESCE(NEW.id, OLD.id),
    to_jsonb(OLD),
    to_jsonb(NEW),
    'Profile ' || TG_OP
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER profile_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION log_profile_changes();
```

### Retensi Log

- **Audit logs**: 7 tahun (sesuai regulasi)
- **Admin activity**: 2 tahun
- **Session logs**: 90 hari

---

## Manajemen Secrets

### Secrets yang Digunakan

| Secret | Penggunaan | Rotasi |
|--------|------------|--------|
| `ADMIN_SETUP_KEY` | Setup admin pertama | Sekali pakai |
| `RESEND_API_KEY` | Pengiriman email | Tahunan |
| `APP_URL` | URL aplikasi | Saat ganti domain |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge functions | Tidak perlu |

### Best Practices

1. **Jangan hardcode secrets di kode**
2. **Gunakan Supabase Vault** untuk secrets sensitif
3. **Rotasi API keys** secara berkala
4. **Revoke keys** yang tidak digunakan
5. **Monitor usage** di dashboard provider

### Menyimpan Secrets

```bash
# Via Supabase CLI
supabase secrets set RESEND_API_KEY=re_xxxxx

# Via Dashboard
# Settings > Edge Functions > Secrets > Add Secret
```

---

## Checklist Keamanan

### Pre-Production

- [ ] Semua tabel memiliki RLS enabled
- [ ] Leaked Password Protection aktif
- [ ] ADMIN_SETUP_KEY sudah dikonfigurasi
- [ ] Service role key tidak terekspos di client
- [ ] Tidak ada password default di kode
- [ ] NIK terenkripsi di database
- [ ] Audit triggers aktif
- [ ] Rate limiting aktif di edge functions

### Production Monitoring

- [ ] Monitor failed login attempts
- [ ] Review audit logs mingguan
- [ ] Cek expired sessions
- [ ] Verifikasi RLS policies masih valid
- [ ] Update dependencies (security patches)

### Incident Response

1. **Deteksi**: Monitor log untuk anomali
2. **Containment**: Disable akun terkompromi
3. **Eradication**: Revoke tokens, reset passwords
4. **Recovery**: Restore dari backup jika perlu
5. **Lessons Learned**: Update policies

---

## Referensi

- [Supabase Security Best Practices](https://supabase.com/docs/guides/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
