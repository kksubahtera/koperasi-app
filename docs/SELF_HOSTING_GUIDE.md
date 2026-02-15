# Panduan Self-Hosting dengan Supabase & Vercel

Dokumentasi lengkap untuk deploy aplikasi koperasi menggunakan akun Supabase sendiri dan Vercel.

---

## Daftar Isi

1. [Prasyarat](#prasyarat)
2. [Setup Supabase](#setup-supabase)
3. [Konfigurasi Database](#konfigurasi-database)
4. [Setup Vercel](#setup-vercel)
5. [Konfigurasi Environment Variables](#konfigurasi-environment-variables)
6. [Deploy Edge Functions](#deploy-edge-functions)
7. [Membuat Admin Pertama](#membuat-admin-pertama)
8. [Konfigurasi Email (Resend)](#konfigurasi-email-resend)
9. [Verifikasi Deployment](#verifikasi-deployment)

---

## Prasyarat

Sebelum memulai, pastikan Anda memiliki:

- [ ] Akun [Supabase](https://supabase.com) (gratis atau berbayar)
- [ ] Akun [Vercel](https://vercel.com) (gratis atau berbayar)
- [ ] Akun [Resend](https://resend.com) untuk pengiriman email
- [ ] Akun [GitHub](https://github.com) untuk repository kode
- [ ] Node.js v18+ terinstall di komputer lokal
- [ ] Supabase CLI terinstall (`npm install -g supabase`)

---

## Setup Supabase

### 1. Buat Project Baru

1. Login ke [Supabase Dashboard](https://supabase.com/dashboard)
2. Klik **"New Project"**
3. Isi informasi project:
   - **Name**: `koperasi-app` (atau nama pilihan Anda)
   - **Database Password**: Buat password yang kuat (simpan dengan aman!)
   - **Region**: Pilih region terdekat (contoh: Singapore untuk Indonesia)
4. Klik **"Create new project"**
5. Tunggu hingga project selesai dibuat (1-2 menit)

### 2. Catat Kredensial Project

Setelah project dibuat, catat informasi berikut dari **Settings > API**:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (RAHASIA!)
Project ID: xxxxxxxxxxxxx
```

> ⚠️ **PERINGATAN**: Service Role Key memiliki akses penuh ke database. Jangan pernah expose di client-side!

---

## Konfigurasi Database

### 1. Jalankan Migrasi Database

Migrasi database dapat dilakukan dengan dua cara:

#### Opsi A: Menggunakan Supabase CLI (Direkomendasikan)

```bash
# Login ke Supabase
supabase login

# Link ke project
supabase link --project-ref YOUR_PROJECT_ID

# Jalankan migrasi
supabase db push
```

#### Opsi B: Jalankan SQL Manual

1. Buka **SQL Editor** di Supabase Dashboard
2. Jalankan file-file migrasi secara berurutan dari folder `supabase/migrations/`
3. Pastikan tidak ada error

### 2. Verifikasi Tabel

Pastikan tabel-tabel berikut sudah terbuat:

| Tabel | Deskripsi |
|-------|-----------|
| `profiles` | Data profil anggota |
| `user_roles` | Role pengguna (admin/member) |
| `savings_summary` | Ringkasan simpanan |
| `transactions` | Riwayat transaksi |
| `loans` | Data pinjaman |
| `loan_installments` | Jadwal angsuran |
| `cooperative_settings` | Pengaturan koperasi |
| `journal_entries` | Jurnal akuntansi |
| `chart_of_accounts` | Bagan akun |
| ... dan lainnya |

### 3. Verifikasi RLS Policies

Pastikan Row Level Security sudah aktif:

```sql
-- Cek status RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

Semua tabel harus memiliki `rowsecurity = true`.

---

## Setup Vercel

### 1. Fork Repository

1. Fork repository aplikasi ke akun GitHub Anda
2. Clone repository ke komputer lokal:

```bash
git clone https://github.com/YOUR_USERNAME/koperasi-app.git
cd koperasi-app
```

### 2. Import ke Vercel

1. Login ke [Vercel Dashboard](https://vercel.com/dashboard)
2. Klik **"Add New..." > "Project"**
3. Pilih repository yang sudah di-fork
4. Konfigurasi project:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3. Tambahkan Environment Variables

Di Vercel Dashboard, tambahkan environment variables:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=xxxxxxxxxxxxx
```

### 4. Deploy

Klik **"Deploy"** dan tunggu hingga selesai.

---

## Konfigurasi Environment Variables

### Environment Variables di Vercel (Client-Side)

| Variable | Deskripsi | Contoh |
|----------|-----------|--------|
| `VITE_SUPABASE_URL` | URL project Supabase | `https://xxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key Supabase | `eyJ...` |
| `VITE_SUPABASE_PROJECT_ID` | Project ID | `xxxxxxxxxxxxx` |

### Secrets di Supabase (Server-Side)

Secrets ini digunakan oleh Edge Functions. Tambahkan di **Settings > Edge Functions > Secrets**:

| Secret | Deskripsi | Cara Mendapatkan |
|--------|-----------|------------------|
| `ADMIN_SETUP_KEY` | Kunci untuk setup admin pertama | Generate sendiri (min 32 karakter) |
| `RESEND_API_KEY` | API key Resend untuk email | Dari dashboard Resend |
| `APP_URL` | URL aplikasi production | `https://your-domain.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Dari Supabase Dashboard |

#### Cara Generate ADMIN_SETUP_KEY

```bash
# Menggunakan openssl
openssl rand -base64 32

# Atau menggunakan Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Contoh hasil: `K7xP2mN9qR4sT6wY8zA1bC3dE5fG7hI9jK0lM2nO4pQ=`

---

## Deploy Edge Functions

### 1. Login Supabase CLI

```bash
supabase login
```

### 2. Link ke Project

```bash
supabase link --project-ref YOUR_PROJECT_ID
```

### 3. Deploy Semua Functions

```bash
supabase functions deploy
```

Atau deploy satu per satu:

```bash
supabase functions deploy create-admin
supabase functions deploy claim-account
supabase functions deploy send-email-change-alert
# ... dan lainnya
```

### 4. Verifikasi Deployment

```bash
supabase functions list
```

---

## Membuat Admin Pertama

### 1. Konfigurasi ADMIN_SETUP_KEY

1. Buka Supabase Dashboard > **Settings > Edge Functions > Secrets**
2. Tambahkan secret baru:
   - **Name**: `ADMIN_SETUP_KEY`
   - **Value**: String acak yang Anda generate (min 32 karakter)
3. Klik **Save**

### 2. Akses Halaman Setup Admin

1. Buka URL: `https://your-domain.com/setup-admin`
2. Masukkan:
   - **Setup Key**: ADMIN_SETUP_KEY yang sudah dikonfigurasi
   - **Nama Admin**: Nama lengkap admin
   - **Email**: Email admin (akan digunakan untuk login)
   - **Password**: Password minimal 8 karakter

### 3. Klik "Buat Akun Admin"

Jika berhasil:
- Akun admin akan terbuat
- Role 'admin' akan ditambahkan
- Anda akan diarahkan ke halaman login

> ⚠️ **PENTING**: Halaman `/setup-admin` akan otomatis dinonaktifkan setelah admin pertama berhasil dibuat untuk keamanan.

### 4. Verifikasi Admin

Login dengan email dan password yang sudah dibuat. Anda harus memiliki akses ke dashboard admin.

### 5. Catatan Penting tentang Admin

1. **Admin Bypass Approval**
   - Admin yang dibuat via `/setup-admin` tidak memerlukan approval
   - Kode di `src/pages/Index.tsx` mengecualikan role admin dari PendingApprovalScreen
   - Jika trigger `handle_new_user` membuat profile dengan status `pending`, sistem akan otomatis mengizinkan admin untuk login

2. **Edge Function `create-admin` menggunakan Upsert**
   - Jika auth user sudah ada (dari trigger), edge function akan meng-update profile yang ada
   - Memastikan `approval_status = 'approved'` dan `is_active = true` untuk admin

3. **Jika Admin Terjebak di "Menunggu Persetujuan"**
   ```sql
   -- Jalankan SQL ini untuk memperbaiki status admin
   UPDATE profiles 
   SET approval_status = 'approved', is_active = true 
   WHERE user_id IN (
     SELECT user_id FROM user_roles WHERE role = 'admin'
   ) AND approval_status = 'pending';
   ```

---

## Konfigurasi Email (Resend)

### 1. Daftar di Resend

1. Buka [Resend.com](https://resend.com) dan buat akun
2. Verifikasi email Anda

### 2. Verifikasi Domain (Opsional tapi Direkomendasikan)

1. Di dashboard Resend, klik **"Domains"**
2. Tambahkan domain Anda
3. Tambahkan DNS records sesuai instruksi Resend
4. Tunggu verifikasi (biasanya 1-24 jam)

### 3. Dapatkan API Key

1. Buka **"API Keys"** di dashboard Resend
2. Klik **"Create API Key"**
3. Beri nama: `koperasi-app`
4. Pilih permission: **Full Access** atau **Sending Access**
5. Copy API key yang dihasilkan

### 4. Tambahkan ke Supabase Secrets

1. Buka Supabase Dashboard > **Settings > Edge Functions > Secrets**
2. Tambahkan:
   - **Name**: `RESEND_API_KEY`
   - **Value**: API key dari Resend
3. Klik **Save**

### 5. Konfigurasi Sender Email

Edit edge function `send-member-credentials/index.ts` dan sesuaikan:

```typescript
const from = 'Koperasi <noreply@your-domain.com>';
```

---

## Konfigurasi NIK Encryption Key

NIK (Nomor Induk Kependudukan) anggota dienkripsi menggunakan AES-256 untuk keamanan data pribadi. **Key default HARUS diganti** sebelum production.

### Mengapa Harus Diganti?

- Key default hanya untuk development
- Jika bocor, semua NIK terekspos
- Compliance dengan regulasi perlindungan data pribadi

### 1. Generate Encryption Key Baru

```bash
# Menggunakan OpenSSL (menghasilkan 32 karakter base64)
openssl rand -base64 32

# Atau menggunakan Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Contoh hasil:
# 8K7xP2mN9qR4sT6wY8zA1bC3dE5fG7hI9jK0lM2nO4pQ=
```

> ⚠️ **PENTING**: Simpan key ini dengan aman! Jika hilang, NIK tidak bisa didekripsi.

### 2. Update Encryption Key di Database

Jalankan SQL berikut di Supabase SQL Editor:

```sql
-- Akses schema private
SET search_path TO private;

-- Lihat key saat ini (opsional)
SELECT key_name, created_at FROM private.encryption_keys;

-- Update dengan key baru
UPDATE private.encryption_keys 
SET key_value = 'KEY_BARU_ANDA_DISINI',
    updated_at = now()
WHERE key_name = 'nik_encryption_key';

-- Verifikasi update berhasil
SELECT key_name, updated_at FROM private.encryption_keys 
WHERE key_name = 'nik_encryption_key';
```

### 3. Re-encrypt NIK Existing (Jika Ada Data)

Jika sudah ada data NIK yang terenkripsi dengan key lama:

```sql
-- Jalankan fungsi migrasi enkripsi
-- Parameter: (old_key, new_key)
SELECT private.reencrypt_all_nik(
  'KEY_LAMA',
  'KEY_BARU_ANDA_DISINI'
);

-- Fungsi akan mengembalikan jumlah NIK yang berhasil di-reencrypt
```

### 4. Verifikasi Enkripsi Berhasil

```sql
-- Test dekripsi NIK (pilih salah satu member)
SELECT 
  p.id,
  p.name,
  get_decrypted_nik(p.id) as nik_decrypted
FROM profiles p
WHERE p.nik_encrypted IS NOT NULL
LIMIT 3;

-- Jika berhasil, NIK asli akan muncul
-- Jika gagal, akan muncul NULL atau error
```

### 5. Backup Key

1. Simpan encryption key di password manager yang aman
2. Buat backup terenkripsi di lokasi terpisah
3. Catat tanggal pembuatan key
4. Jangan simpan key di repository atau log

### Troubleshooting

#### Error: "decryption failed"
- Key yang digunakan tidak cocok dengan key saat enkripsi
- Pastikan tidak ada spasi/karakter tambahan

#### Error: "function get_decrypted_nik does not exist"
- Jalankan migrasi database terlebih dahulu
- Cek apakah fungsi ada di schema public

#### NIK muncul sebagai NULL
- Data mungkin belum dienkripsi
- Atau key yang digunakan salah

---

## Verifikasi Deployment

### Checklist Deployment

- [ ] Website dapat diakses di URL production
- [ ] Halaman login berfungsi
- [ ] Admin dapat login
- [ ] Email notifikasi terkirim
- [ ] Transaksi dapat diproses
- [ ] Jurnal otomatis terbuat
- [ ] Export PDF/Excel berfungsi

### Test Email

1. Login sebagai admin
2. Buat anggota baru dengan metode "Kirim Email"
3. Verifikasi email terkirim ke alamat anggota

### Test Transaksi

1. Login sebagai member
2. Ajukan transaksi setoran
3. Login sebagai admin
4. Verifikasi dan setujui transaksi
5. Cek jurnal otomatis terbuat

---

## Troubleshooting

### Error: "Invalid API Key"

- Pastikan VITE_SUPABASE_PUBLISHABLE_KEY sudah benar
- Cek apakah ada spasi atau karakter tambahan

### Error: "Setup key tidak valid"

- Pastikan ADMIN_SETUP_KEY di secrets sama dengan yang diinput
- Cek apakah secret sudah tersimpan dengan benar

### Email Tidak Terkirim

- Verifikasi RESEND_API_KEY sudah benar
- Cek log Edge Functions di Supabase Dashboard
- Pastikan domain sudah diverifikasi di Resend

### RLS Policy Error

- Pastikan user sudah login sebelum melakukan operasi
- Cek apakah RLS policy sudah benar untuk tabel terkait

---

## Keamanan Production

### Wajib Dilakukan

1. **Enable Leaked Password Protection** di Supabase Auth Settings
2. **Set Site URL** ke domain production
3. **Tambahkan Redirect URLs** yang valid
4. **Review semua RLS policies**
5. **Backup database** secara rutin

### Rekomendasi Tambahan

1. Gunakan custom domain dengan SSL
2. Enable 2FA untuk akun Supabase dan Vercel
3. Monitor log secara berkala
4. Update dependencies secara rutin

---

## Referensi

- [Dokumentasi Supabase](https://supabase.com/docs)
- [Dokumentasi Vercel](https://vercel.com/docs)
- [Dokumentasi Resend](https://resend.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
