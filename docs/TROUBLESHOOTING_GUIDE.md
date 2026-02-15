# Panduan Troubleshooting & Maintenance

Dokumentasi lengkap untuk mendiagnosa dan memperbaiki masalah umum pada aplikasi koperasi.

---

## Daftar Isi

1. [Masalah Autentikasi](#masalah-autentikasi)
   - [Profil Pengguna Tidak Ditemukan](#error-profil-pengguna-tidak-ditemukan)
   - [Setup Admin Tidak Berfungsi](#error-setup-admin-tidak-berfungsi---panduan-lengkap)
   - [Admin Diarahkan ke Halaman Pending](#error-admin-diarahkan-ke-halaman-pembayaranpending-approval)
   - [Alur Pendaftaran Calon Anggota](#alur-pendaftaran-calon-anggota)
   - [Foto Profil Tidak Dapat Diperbarui](#error-foto-profil-tidak-dapat-diperbarui)
2. [Masalah Database & RLS](#masalah-database--rls)
3. [Masalah Edge Functions](#masalah-edge-functions)
4. [Masalah Email](#masalah-email)
5. [Masalah Transaksi & Jurnal](#masalah-transaksi--jurnal)
6. [Masalah Performance](#masalah-performance)
7. [Maintenance Rutin](#maintenance-rutin)
8. [Recovery & Backup](#recovery--backup)
9. [Referensi Error Codes](#referensi-error-codes)

---

## Masalah Autentikasi

### Error: "Profil pengguna tidak ditemukan"

**Penyebab:**
- Trigger `on_auth_user_created` tidak terpasang di database
- User berhasil daftar di auth.users tapi profile tidak dibuat otomatis
- Fungsi `handle_new_user` error saat eksekusi

**Diagnosa:**
```sql
-- Cek user yang tidak punya profile
SELECT au.id, au.email, au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.user_id
WHERE p.user_id IS NULL;

-- Cek apakah trigger ada
SELECT tgname, tgrelid::regclass, tgtype 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

**Solusi:**
```sql
-- 1. Pastikan trigger terpasang
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Buat profile untuk user yang terdampak
INSERT INTO public.profiles (user_id, name, email, member_number, approval_status, is_active)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data ->> 'name', SPLIT_PART(au.email, '@', 1)),
  au.email,
  'MBR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(au.id::TEXT, 1, 4),
  'pending',
  false
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.user_id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 3. Tambahkan role dan savings summary
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'member'::public.user_role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.savings_summary (user_id)
SELECT p.user_id
FROM public.profiles p
LEFT JOIN public.savings_summary ss ON p.user_id = ss.user_id
WHERE ss.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
```

**Pencegahan:**
- Jangan hapus trigger `on_auth_user_created`
- Pastikan fungsi `handle_new_user` tidak error (cek logs)
- Gunakan edge function `sync-profile-metadata` untuk sinkronisasi data tambahan

---

### Error: "Invalid login credentials"

**Penyebab:**
- Email atau password salah
- Akun belum diaktifkan (pending approval)
- Akun dinonaktifkan oleh admin

**Solusi:**
```sql
-- Cek status akun
SELECT id, email, is_active, approval_status, force_password_change
FROM profiles
WHERE email = 'user@example.com';
```

**Langkah perbaikan:**
1. Jika `is_active = false`: Aktifkan akun di admin panel
2. Jika `approval_status = 'pending'`: Approve di menu Pendaftaran
3. Jika password lupa: Gunakan fitur "Lupa Password"

---

### Error: "Email not confirmed"

**Penyebab:**
- Email konfirmasi belum diklik
- Auto-confirm email tidak aktif

**Solusi Development:**
```sql
-- Aktifkan auto-confirm di Supabase Dashboard
-- Authentication > Settings > Disable "Confirm email"
```

**Solusi Production:**
```sql
-- Konfirmasi manual via SQL
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email = 'user@example.com';
```

---

### Error: Setup Admin Tidak Berfungsi - Panduan Lengkap

Halaman `/setup-admin` digunakan untuk membuat akun admin pertama. Berikut semua kemungkinan error dan solusinya:

#### A. Error 503: "Admin creation is not configured"

**Penyebab:**
- Environment variable `ADMIN_SETUP_KEY` belum dikonfigurasi di backend

**Solusi:**
1. Buka Lovable Cloud > Secrets
2. Tambahkan secret baru:
   - Name: `ADMIN_SETUP_KEY`
   - Value: (string acak minimal 16 karakter)
3. Tunggu 1-2 menit untuk deployment
4. Coba lagi di halaman `/setup-admin`

**Cara Generate Setup Key:**
```bash
# Linux/Mac
openssl rand -base64 24

# Online (kurang aman)
# Gunakan password generator seperti 1Password atau Bitwarden
```

---

#### B. Error 403: "Invalid setup key"

**Penyebab:**
- Setup key yang dimasukkan tidak cocok dengan yang dikonfigurasi

**Solusi:**
1. Pastikan menyalin setup key dengan benar (tanpa spasi di awal/akhir)
2. Gunakan tombol "tampilkan" untuk memverifikasi apa yang diketik
3. Jika lupa key, ubah di Lovable Cloud > Secrets

---

#### C. Error 403: "An admin account already exists"

**Penyebab:**
- Admin sudah ada di database
- Halaman `/setup-admin` hanya bisa digunakan sekali

**Solusi:**
- Login dengan akun admin yang sudah dibuat
- Jika lupa password, gunakan fitur "Lupa Password"
- Admin baru harus dibuat melalui dashboard admin, bukan `/setup-admin`

**Diagnosa:**
```sql
-- Cek apakah admin sudah ada
SELECT p.email, p.name, ur.role 
FROM user_roles ur 
JOIN profiles p ON ur.user_id = p.user_id 
WHERE ur.role = 'admin';
```

---

#### D. Error 429: "Too many attempts"

**Penyebab:**
- Rate limit tercapai (5 percobaan per jam per IP)

**Solusi:**
- Tunggu 1 jam sebelum mencoba lagi
- Atau gunakan koneksi internet yang berbeda (IP berbeda)

---

#### E. Error 400: "Email and password are required" atau "Password too short"

**Penyebab:**
- Validasi input gagal

**Solusi:**
- Pastikan semua field terisi
- Password minimal 8 karakter
- Email dalam format yang valid

---

#### F. Error 500: "Failed to assign admin role"

**Penyebab:**
- Gagal insert ke tabel `user_roles`
- Biasanya karena constraint violation atau RLS policy

**Solusi:**
```sql
-- Cek apakah user sudah dibuat tapi role belum ada
SELECT au.id, au.email, ur.role
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email = 'admin@example.com';

-- Jika user ada tapi role null, tambahkan manual
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'admin@example.com';

-- Update profile ke approved
UPDATE profiles 
SET approval_status = 'approved', is_active = true 
WHERE email = 'admin@example.com';
```

---

### Error: Admin Diarahkan ke Halaman Pembayaran/Pending Approval

**Gejala:** 
- Admin baru yang dibuat via `/setup-admin` diarahkan ke PendingApprovalScreen setelah login
- Admin melihat halaman "Menunggu Persetujuan" padahal seharusnya langsung ke dashboard

**Penyebab Utama:**

1. **Race Condition dengan Trigger**
   - Trigger `handle_new_user` membuat profile dengan `approval_status = 'pending'`
   - Edge function `create-admin` melakukan upsert, tapi timing bisa bervariasi
   - Jika trigger berjalan SETELAH upsert, status bisa kembali ke 'pending'

2. **Role Tidak Ter-fetch dengan Benar**
   - Bypass admin di `Index.tsx` bergantung pada `user.roles?.includes('admin')`
   - Jika roles kosong/null, admin akan diperlakukan seperti member biasa

3. **Cache Browser**
   - Data user lama masih tersimpan di session

**Diagnosa:**
```sql
-- Cek status lengkap admin
SELECT 
  p.user_id,
  p.email,
  p.name,
  p.approval_status,
  p.is_active,
  ur.role
FROM profiles p
LEFT JOIN user_roles ur ON p.user_id = ur.user_id
WHERE p.email = 'admin@example.com';
```

**Solusi Cepat:**
```sql
-- Perbaiki status admin yang ada
UPDATE profiles 
SET approval_status = 'approved', is_active = true 
WHERE user_id IN (
  SELECT user_id FROM user_roles WHERE role = 'admin'
) AND (approval_status = 'pending' OR is_active = false);
```

**Solusi User-Side:**
1. Logout dari aplikasi
2. Clear browser cache/cookies untuk domain aplikasi
3. Login kembali

**Pencegahan Permanen:**
Edge function `create-admin` sudah diperbarui dengan:
- Upsert yang memastikan `approval_status = 'approved'`
- Insert role admin segera setelah user dibuat

Jika masalah terus terjadi, periksa trigger `handle_new_user`:
```sql
-- Lihat definisi trigger
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_new_user';
```

---

### Alur Pendaftaran Calon Anggota

**Alur Normal:**
1. Calon anggota mengakses halaman landing (`/`)
2. Klik "Mulai Pendaftaran" -> `CooperativeProfile` -> `RegistrationForm`
3. Setelah submit, calon anggota akan melihat `PendingApprovalScreen`
4. Admin mereview dan approve/reject pendaftaran
5. Setelah diapprove, calon anggota bisa login dan mengakses dashboard member

**Halaman Pembayaran (PendingApprovalScreen):**
Halaman ini menampilkan:
- Status pendaftaran (pending)
- Instruksi pembayaran simpanan pokok/wajib
- Rekening tujuan transfer
- Informasi kontak admin

---

### Error: Calon Anggota Tidak Diarahkan ke Halaman Pembayaran

**Gejala:** 
- Setelah registrasi, user tidak melihat halaman pending/pembayaran
- Atau setelah login, user langsung ke dashboard (padahal belum diapprove)

**Penyebab:**

1. **Profile tidak dibuat dengan benar**
   - Trigger `handle_new_user` tidak berjalan
   - `approval_status` tidak di-set ke 'pending'

2. **User langsung diapprove (auto-approve aktif)**
   - Setting `auto_approve_registration` aktif di `cooperative_settings`

**Diagnosa:**
```sql
-- Cek status profile
SELECT email, approval_status, is_active, created_at
FROM profiles
WHERE email = 'calon@example.com';

-- Cek setting auto-approve
SELECT key, value FROM cooperative_settings 
WHERE key = 'auto_approve_registration';
```

**Solusi:**
```sql
-- Jika user salah diapprove, kembalikan ke pending
UPDATE profiles 
SET approval_status = 'pending', is_active = false
WHERE email = 'calon@example.com';
```

---

### Error: Calon Anggota Login Tapi Tidak Bisa Akses

**Gejala:**
- Login berhasil tapi langsung di-redirect ke halaman error
- Atau muncul pesan "Akun tidak aktif"

**Penyebab:**
Aplikasi memang membatasi akses untuk user yang belum diapprove. Ini adalah behavior yang benar.

**Yang Seharusnya Terjadi:**
- User dengan `approval_status = 'pending'` BISA login
- Setelah login, mereka akan melihat `PendingApprovalScreen`
- Mereka TIDAK bisa akses dashboard atau fitur lain

**Kode yang Mengatur Ini:**
```typescript
// AuthContext.tsx - Mengizinkan pending user untuk login
if (userData.approvalStatus === 'pending') {
  setUser(userData);
  return { success: true };
}

// Index.tsx - Menampilkan PendingApprovalScreen untuk pending user
if (user && user.approvalStatus === 'pending' && !user.roles?.includes('admin')) {
  return <PendingApprovalScreen ... />;
}
```

---

### Error: "Pendaftaran belum tersedia" di halaman landing

**Gejala:** Tombol "Mulai Pendaftaran" tidak muncul di halaman landing meskipun registrasi sudah diaktifkan.

**Penyebab:** RLS policy pada tabel `cooperative_settings` tidak mengizinkan anonymous users untuk membaca settings.

**Diagnosa:**
```sql
-- Cek apakah policy untuk anon ada
SELECT policyname FROM pg_policies 
WHERE tablename = 'cooperative_settings' AND roles @> ARRAY['anon']::name[];
```

**Solusi:** Pastikan policy `"Anon users can view registration settings"` sudah ada. Jika tidak, jalankan migrasi yang sesuai.

---

### Error: "Session expired"

**Penyebab:**
- Token JWT expired
- Refresh token tidak valid
- User di-logout dari tempat lain

**Solusi:**
```typescript
// Pastikan onAuthStateChange ter-setup dengan benar
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        setSession(session);
      }
      if (event === 'SIGNED_OUT') {
        navigate('/login');
      }
    }
  );
  return () => subscription.unsubscribe();
}, []);
```

---

### Error: "User already registered"

**Penyebab:**
- Email sudah terdaftar
- Registrasi duplikat

**Diagnosa:**
```sql
-- Cek user di auth
SELECT id, email, created_at FROM auth.users WHERE email = 'user@example.com';

-- Cek profile
SELECT id, email, approval_status FROM profiles WHERE email = 'user@example.com';
```

**Solusi:**
- Jika user valid: Gunakan "Lupa Password"
- Jika duplikat dari migrasi: Merge akun atau hapus yang lama

---

### Error: Foto Profil Tidak Dapat Diperbarui

**Gejala:**
- Upload foto profil berhasil (tidak ada error)
- Tapi foto yang ditampilkan tidak berubah
- Avatar masih menampilkan inisial nama atau foto lama

**Penyebab Utama:**

1. **Fungsi `get_profile_with_nik` tidak mengembalikan field `profile_photo`**
   - Fungsi database ini digunakan untuk mengambil data profil dengan NIK yang sudah didekripsi
   - Jika field `profile_photo` tidak ada dalam return type, foto tidak akan tampil meskipun sudah tersimpan di database

2. **URL Storage Tidak Valid**
   - File berhasil diupload tapi URL public tidak bisa diakses
   - Bucket storage tidak dikonfigurasi sebagai public

3. **Cache Browser**
   - Browser menyimpan gambar lama di cache
   - URL gambar baru tidak di-refresh

**Diagnosa:**
```sql
-- Cek apakah profile_photo tersimpan di database
SELECT user_id, name, profile_photo 
FROM profiles 
WHERE user_id = 'uuid-user-here';

-- Cek definisi fungsi get_profile_with_nik
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'get_profile_with_nik';

-- Verifikasi field yang dikembalikan fungsi
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'profile_photo';
```

**Solusi 1: Update Fungsi Database**
```sql
-- Drop dan recreate fungsi dengan field profile_photo
DROP FUNCTION IF EXISTS public.get_profile_with_nik(uuid);

CREATE OR REPLACE FUNCTION public.get_profile_with_nik(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  name text,
  email text,
  phone text,
  nik text,
  member_number text,
  join_date date,
  birth_place text,
  birth_date date,
  gender text,
  occupation text,
  address text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  is_active boolean,
  approval_status text,
  branch_id uuid,
  profile_photo text  -- Field ini HARUS ada
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.name,
    p.email,
    p.phone,
    public.decrypt_nik(p.encrypted_nik) as nik,
    p.member_number,
    p.join_date,
    p.birth_place,
    p.birth_date,
    p.gender,
    p.occupation,
    p.address,
    p.bank_name,
    p.bank_account_number,
    p.bank_account_name,
    p.is_active,
    p.approval_status,
    p.branch_id,
    p.profile_photo  -- Field ini HARUS diselect
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
END;
$$;
```

**Solusi 2: Verifikasi Storage Bucket**
```sql
-- Pastikan bucket profile-photos public
SELECT id, name, public FROM storage.buckets WHERE id = 'profile-photos';

-- Jika tidak public, update
UPDATE storage.buckets SET public = true WHERE id = 'profile-photos';

-- Pastikan RLS policy untuk storage ada
SELECT * FROM storage.policies WHERE bucket_id = 'profile-photos';
```

**Solusi 3: Force Refresh Cache**
```typescript
// Tambahkan timestamp ke URL untuk bypass cache
const photoUrl = `${profile.profile_photo}?t=${Date.now()}`;
```

**Solusi User-Side:**
1. Hard refresh halaman (Ctrl+Shift+R atau Cmd+Shift+R)
2. Clear cache browser untuk domain aplikasi
3. Logout dan login kembali

**Pencegahan:**
- Selalu pastikan semua field yang diperlukan ada dalam return type fungsi database
- Saat menambah kolom baru di tabel `profiles`, update juga fungsi `get_profile_with_nik`
- Gunakan timestamp atau version parameter pada URL gambar untuk menghindari cache

---

## Masalah Database & RLS

### Error: "new row violates row-level security policy"

**Penyebab:**
- User tidak memiliki izin untuk operasi tersebut
- `user_id` tidak diisi atau tidak cocok
- RLS policy terlalu ketat

**Diagnosa:**
```sql
-- Cek policy pada tabel
SELECT * FROM pg_policies WHERE tablename = 'nama_tabel';

-- Test policy sebagai user tertentu
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claims TO '{"sub": "user-uuid-here"}';
SELECT * FROM nama_tabel;
```

**Solusi umum:**
```sql
-- Pastikan user_id terisi saat insert
INSERT INTO transactions (user_id, amount, type)
VALUES (auth.uid(), 100000, 'deposit');
```

---

### Error: "permission denied for table"

**Penyebab:**
- RLS tidak enabled tapi permission tidak diberikan
- Mengakses dengan role yang salah

**Solusi:**
```sql
-- Enable RLS (wajib!)
ALTER TABLE nama_tabel ENABLE ROW LEVEL SECURITY;

-- Atau berikan permission (tidak direkomendasikan)
GRANT SELECT ON nama_tabel TO authenticated;
```

---

### Error: "infinite recursion detected in policy"

**Penyebab:**
- Policy mereferensikan tabel yang sama tanpa SECURITY DEFINER

**Contoh masalah:**
```sql
-- ❌ SALAH - Menyebabkan recursion
CREATE POLICY "Check admin"
ON profiles FOR SELECT
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = profiles.id AND role = 'admin')
);
```

**Solusi:**
```sql
-- ✅ BENAR - Gunakan SECURITY DEFINER function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE SQL STABLE;

CREATE POLICY "Check admin"
ON profiles FOR SELECT
USING (auth.uid() = id OR is_admin());
```

---

### Error: "null value in column user_id"

**Penyebab:**
- Insert tanpa menyertakan user_id
- User belum login saat melakukan operasi

**Diagnosa:**
```typescript
// Cek apakah user sudah login
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user?.id);
```

**Solusi:**
```typescript
// Pastikan user login sebelum insert
if (!user) {
  toast.error('Silakan login terlebih dahulu');
  return;
}

const { error } = await supabase
  .from('transactions')
  .insert({ user_id: user.id, amount: 100000 });
```

---

## Masalah Edge Functions

### Error: "Function not found"

**Penyebab:**
- Function belum di-deploy
- Nama function salah

**Diagnosa:**
```bash
# List semua functions
supabase functions list
```

**Solusi:**
```bash
# Deploy function
supabase functions deploy nama-function
```

---

### Error: "Internal Server Error" (500)

**Diagnosa:**
```bash
# Cek log function
supabase functions logs nama-function --tail
```

**Penyebab umum:**
1. **Secret tidak ditemukan:**
```typescript
// Di edge function
const apiKey = Deno.env.get('RESEND_API_KEY');
if (!apiKey) {
  throw new Error('RESEND_API_KEY not configured');
}
```

2. **Import error:**
```typescript
// ✅ BENAR untuk Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ❌ SALAH
import { serve } from "http/server";
```

**Solusi:**
```bash
# Tambahkan secret yang diperlukan
supabase secrets set NAMA_SECRET=value
```

---

### Error: "CORS policy"

**Penyebab:**
- Headers CORS tidak dikonfigurasi

**Solusi di edge function:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  // ... logic
  
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
```

---

### Error: "Rate limit exceeded" (429)

**Penyebab:**
- Terlalu banyak request dalam waktu singkat
- Rate limiting aktif

**Solusi:**
1. Tunggu beberapa menit
2. Implementasi retry dengan backoff:

```typescript
const fetchWithRetry = async (fn: () => Promise<any>, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 429 && i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
};
```

---

## Masalah Email

### Email Tidak Terkirim

**Diagnosa:**
```bash
# Cek log edge function
supabase functions logs send-member-credentials --tail
```

**Penyebab umum:**

1. **RESEND_API_KEY tidak valid:**
```bash
# Verify secret
supabase secrets list
```

2. **Domain belum diverifikasi:**
   - Buka Resend Dashboard > Domains
   - Pastikan domain terverifikasi

3. **Email address tidak valid:**
```typescript
// Validasi email sebelum kirim
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  throw new Error('Email tidak valid');
}
```

**Solusi:**
```typescript
// Test kirim email sederhana
const { data, error } = await resend.emails.send({
  from: 'Koperasi <noreply@your-domain.com>',
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<p>Test email</p>',
});

console.log('Email result:', data, error);
```

---

### Email Masuk Spam

**Solusi:**
1. Verifikasi domain di Resend
2. Setup SPF, DKIM, dan DMARC records
3. Gunakan email "from" dengan domain terverifikasi
4. Hindari kata-kata spam di subject

---

## Masalah Transaksi & Jurnal

### Jurnal Tidak Otomatis Terbuat

**Penyebab:**
- Template jurnal tidak aktif
- Mapping akun tidak lengkap
- Error di trigger

**Diagnosa:**
```sql
-- Cek template jurnal
SELECT * FROM journal_templates WHERE type = 'deposit_simpanan_pokok';

-- Cek apakah template aktif
SELECT * FROM journal_templates WHERE is_active = true;
```

**Solusi:**
1. Aktifkan template di menu Pembukuan > Template Jurnal
2. Pastikan mapping akun sudah benar
3. Cek error di log:

```sql
SELECT * FROM audit_logs 
WHERE entity_type = 'journal' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

### Saldo Tidak Update

**Penyebab:**
- Transaksi belum disetujui
- Error di trigger update saldo

**Diagnosa:**
```sql
-- Cek status transaksi
SELECT id, status, type, amount FROM transactions WHERE user_id = 'xxx';

-- Cek saldo di savings_summary
SELECT * FROM savings_summary WHERE user_id = 'xxx';
```

**Solusi manual (jika trigger gagal):**
```sql
-- Recalculate saldo
UPDATE savings_summary 
SET simpanan_pokok = (
  SELECT COALESCE(SUM(amount), 0) 
  FROM transactions 
  WHERE user_id = savings_summary.user_id 
  AND type = 'deposit' 
  AND savings_type = 'pokok' 
  AND status = 'approved'
)
WHERE user_id = 'xxx';
```

---

### Neraca Tidak Balance

**Diagnosa:**
```sql
-- Cek total debit vs credit
SELECT 
  SUM(total_debit) as total_debit,
  SUM(total_credit) as total_credit,
  SUM(total_debit) - SUM(total_credit) as difference
FROM journal_entries
WHERE status = 'approved';
```

**Penyebab:**
- Ada jurnal yang tidak balance
- Entry yang terhapus sebagian

**Solusi:**
```sql
-- Cari jurnal tidak balance
SELECT * FROM journal_entries 
WHERE total_debit != total_credit 
AND status = 'approved';

-- Fix jurnal
UPDATE journal_entries 
SET is_balanced = (total_debit = total_credit)
WHERE id = 'xxx';
```

---

## Masalah Performance

### Query Lambat

**Diagnosa:**
```sql
-- Aktifkan query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- log query > 1 detik

-- Cek slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

**Solusi umum:**

1. **Tambah index:**
```sql
-- Index untuk query yang sering digunakan
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_loans_user_id_status ON loans(user_id, status);
```

2. **Optimize query:**
```typescript
// ❌ LAMBAT - Select semua kolom
const { data } = await supabase.from('profiles').select('*');

// ✅ CEPAT - Select kolom yang diperlukan
const { data } = await supabase.from('profiles').select('id, name, email');
```

3. **Pagination:**
```typescript
// Gunakan range untuk data besar
const { data } = await supabase
  .from('transactions')
  .select('*')
  .range(0, 19); // Ambil 20 data pertama
```

---

### Memory Usage Tinggi

**Penyebab:**
- Load data terlalu banyak sekaligus
- Memory leak di component

**Solusi:**
```typescript
// Implementasi virtual scrolling untuk list panjang
import { useVirtualizer } from '@tanstack/react-virtual';

// Cleanup subscriptions
useEffect(() => {
  const channel = supabase.channel('xxx');
  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

## Maintenance Rutin

### Harian

- [ ] Cek error log di Supabase Dashboard
- [ ] Verifikasi transaksi pending
- [ ] Monitor penggunaan API

### Mingguan

- [ ] Review audit logs
- [ ] Backup database
- [ ] Cek disk usage
- [ ] Update status anggota tidak aktif

### Bulanan

- [ ] Rekonsiliasi saldo
- [ ] Review RLS policies
- [ ] Update dependencies
- [ ] Performance review

### Tahunan

- [ ] Tutup buku tahunan
- [ ] Distribusi SHU
- [ ] Arsip data lama
- [ ] Security audit

---

## Recovery & Backup

### Backup Manual

```bash
# Backup via Supabase CLI
supabase db dump -f backup.sql

# Backup specific tables
supabase db dump --data-only -t transactions,loans,profiles -f backup_data.sql
```

### Restore

```bash
# Restore dari backup
psql -h db.xxxxx.supabase.co -U postgres -d postgres < backup.sql
```

### Point-in-Time Recovery

Tersedia di Supabase Pro plan:
1. Buka Supabase Dashboard > Database > Backups
2. Pilih waktu restore
3. Klik "Restore"

---

## Kontak Support

Jika masalah tidak dapat diselesaikan:

1. **Cek dokumentasi:** https://supabase.com/docs
2. **GitHub Issues:** Buat issue dengan detail error
3. **Supabase Discord:** https://discord.supabase.com
4. **Email Support:** support@koperasi.com (untuk pengguna)

---

## Referensi Error Codes

### Error Code Umum

| Code | Deskripsi | Solusi |
|------|-----------|--------|
| `PGRST116` | No rows returned | Cek filter query |
| `23505` | Unique violation | Data duplikat |
| `23503` | Foreign key violation | Data referensi tidak ada |
| `42501` | Permission denied | Cek RLS policy |
| `42P01` | Table not found | Jalankan migrasi |
| `28P01` | Invalid password | Cek kredensial |

---

### Referensi Error Code Setup Admin

| HTTP Code | Error Message | Penyebab | Solusi |
|-----------|--------------|----------|--------|
| 503 | Admin creation is not configured | ADMIN_SETUP_KEY belum di-set | Tambahkan secret di Lovable Cloud > Secrets |
| 403 | Invalid setup key | Key salah | Periksa key yang dimasukkan |
| 403 | Admin already exists | Admin sudah ada | Login dengan akun admin yang ada |
| 429 | Too many attempts | Rate limit | Tunggu 1 jam |
| 400 | Email/password required | Input kosong | Isi semua field |
| 400 | Password too short | Password < 8 karakter | Gunakan password lebih panjang |
| 500 | Failed to assign admin role | Gagal insert role | Perbaiki manual via SQL |

---

### Referensi Status Pendaftaran

| Status | Deskripsi | Akses User |
|--------|-----------|------------|
| `pending` | Menunggu persetujuan admin | Hanya bisa lihat PendingApprovalScreen |
| `approved` | Disetujui | Akses penuh ke dashboard member |
| `rejected` | Ditolak | Tidak bisa login |
