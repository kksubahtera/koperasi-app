# Panduan Deployment ke Supabase Mandiri

Dokumen ini berisi panduan lengkap untuk mempublikasikan dan men-deploy aplikasi koperasi ke Supabase project mandiri.

## Daftar Isi

1. [Persiapan](#persiapan)
2. [Konfigurasi Supabase](#konfigurasi-supabase)
3. [Konfigurasi Secrets](#konfigurasi-secrets)
4. [Konfigurasi Auth](#konfigurasi-auth)
5. [Deploy Edge Functions](#deploy-edge-functions)
6. [Konfigurasi Frontend](#konfigurasi-frontend)
7. [Testing Checklist](#testing-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Persiapan

### Prasyarat

- Akun Supabase (https://supabase.com)
- Akun Resend untuk email (https://resend.com)
- Hosting untuk frontend (Vercel, Netlify, atau lainnya)

### Langkah Awal

1. **Buat Supabase Project Baru**
   - Login ke https://supabase.com/dashboard
   - Klik "New Project"
   - Pilih nama project dan region terdekat
   - Simpan password database dengan aman

2. **Catat Credentials**
   - Project URL: `https://YOUR-PROJECT-ID.supabase.co`
   - Anon Key: Ditemukan di Settings → API
   - Service Role Key: Ditemukan di Settings → API (JANGAN share key ini)

---

## Konfigurasi Supabase

### Jalankan Migrations

1. Buka SQL Editor di Supabase Dashboard
2. Jalankan semua file migration secara berurutan dari folder `supabase/migrations/`
3. Pastikan tidak ada error saat menjalankan migrations

### Verifikasi Tabel dan RLS

Setelah migrations berhasil, pastikan:
- Semua tabel sudah terbuat dengan benar
- RLS (Row Level Security) sudah enabled pada semua tabel
- Policies sudah terpasang sesuai kebutuhan

---

## Konfigurasi Secrets

Di Supabase Dashboard → Settings → Edge Functions → Secrets, tambahkan:

| Secret Name | Deskripsi | Contoh Value |
|-------------|-----------|--------------|
| `ADMIN_SETUP_KEY` | Kunci untuk membuat admin pertama (min 32 karakter) | `kunci-rahasia-admin-setup-yang-sangat-panjang` |
| `RESEND_API_KEY` | API Key dari Resend.com untuk mengirim email | `re_xxxxxxxxxxxx` |
| `APP_URL` | URL aplikasi untuk link di email | `https://app.koperasi-anda.com` |

### Cara Mendapatkan Resend API Key

1. Daftar di https://resend.com
2. Verifikasi domain email Anda (opsional tapi direkomendasikan)
3. Buat API Key baru di dashboard Resend
4. Salin API Key dan simpan di Supabase Secrets

### Membuat ADMIN_SETUP_KEY yang Aman

Generate key yang kuat dengan perintah:
```bash
openssl rand -base64 32
```

Atau gunakan password manager untuk generate string acak minimal 32 karakter.

---

## Konfigurasi Auth

Di Supabase Dashboard → Authentication → Settings:

### 1. Site URL
```
https://app.koperasi-anda.com
```

### 2. Redirect URLs
Tambahkan semua URL yang valid:
```
https://app.koperasi-anda.com
https://app.koperasi-anda.com/**
http://localhost:5173
http://localhost:5173/**
```

### 3. Email Templates
Kustomisasi template email di Authentication → Email Templates:

**Confirm signup:**
- Subject: `Konfirmasi Pendaftaran Koperasi`
- Sesuaikan body dengan branding koperasi

**Reset Password:**
- Subject: `Reset Password Akun Koperasi`
- Sesuaikan body dengan branding koperasi

### 4. Security Settings
Di Authentication → Settings → Security:

- ✅ **Enable Leaked Password Protection** (WAJIB!)
- ✅ Enable email confirmations (opsional, sudah di-handle auto-confirm)

---

## Deploy Edge Functions

### Menggunakan Supabase CLI

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login ke Supabase:
```bash
supabase login
```

3. Link ke project:
```bash
supabase link --project-ref YOUR-PROJECT-ID
```

4. Deploy semua functions:
```bash
supabase functions deploy
```

### Verifikasi Functions

Pastikan functions berikut sudah ter-deploy:
- `bulk-create-members`
- `claim-account`
- `create-admin`
- `send-member-credentials`
- `send-email-change-alert`
- `send-loan-notification`
- `send-password-notification`
- `send-registration-notification`
- `send-resignation-notification`
- `installment-reminder`
- `overdue-alert`
- `monthly-closing`
- `yearly-closing`
- Dan lainnya...

---

## Konfigurasi Frontend

### Environment Variables

Buat file `.env.production` dengan nilai dari project Supabase baru:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=YOUR-PROJECT-ID
```

### Build untuk Production

```bash
npm run build
```

### Deploy ke Hosting

**Vercel:**
```bash
vercel --prod
```

**Netlify:**
```bash
netlify deploy --prod
```

Atau upload folder `dist/` ke hosting pilihan Anda.

---

## Pre-Deployment Checklist

Sebelum deploy, pastikan semua item berikut sudah selesai:

### Konfigurasi Wajib

- [ ] **Secrets Supabase** sudah dikonfigurasi:
  - [ ] `ADMIN_SETUP_KEY` - Kunci setup admin (min 32 karakter)
  - [ ] `RESEND_API_KEY` - API key dari Resend.com
  - [ ] `APP_URL` - URL production aplikasi (contoh: `https://koperasi.com`)

- [ ] **Authentication Settings** sudah dikonfigurasi:
  - [ ] Site URL sudah diisi dengan domain production
  - [ ] Redirect URLs sudah ditambahkan
  - [ ] ✅ Leaked Password Protection **AKTIF** (WAJIB!)

- [ ] **Edge Functions** sudah ter-deploy

### Verifikasi Keamanan

- [ ] Tidak ada hardcoded password di kode
- [ ] Tidak ada demo accounts atau test credentials
- [ ] Semua tabel sensitif memiliki RLS policies
- [ ] NIK terenkripsi di database
- [ ] Audit logs aktif

---

## Testing Checklist

### Setelah Deploy

- [ ] **Admin Setup**
  - [ ] Akses `/setup-admin` dengan ADMIN_SETUP_KEY yang benar
  - [ ] Admin pertama berhasil dibuat
  - [ ] Admin bisa login

- [ ] **Authentication**
  - [ ] Register anggota baru
  - [ ] Login dengan email/password
  - [ ] Logout
  - [ ] Reset password
  - [ ] Ganti password setelah login pertama

- [ ] **Email**
  - [ ] Email konfirmasi terkirim
  - [ ] Email reset password terkirim
  - [ ] Email kredensial anggota terkirim

- [ ] **Member Features**
  - [ ] Lihat dashboard
  - [ ] Lihat simpanan
  - [ ] Ajukan transaksi
  - [ ] Lihat riwayat transaksi

- [ ] **Admin Features**
  - [ ] Kelola anggota
  - [ ] Approve transaksi
  - [ ] Kelola pinjaman
  - [ ] Export data

- [ ] **RBAC**
  - [ ] Super Admin punya semua akses
  - [ ] Admin Pendaftaran hanya akses pendaftaran
  - [ ] Admin Keuangan hanya akses keuangan

### Security Testing

- [ ] Coba akses data member lain (harus gagal - 403)
- [ ] Coba bypass login (harus redirect ke login)
- [ ] Coba brute force login (harus rate limited)
- [ ] Verifikasi NIK terenkripsi di database

---

## Troubleshooting

### Error: "Invalid setup key"
- Pastikan ADMIN_SETUP_KEY di Supabase Secrets sama dengan yang diinput
- Perhatikan spasi di awal/akhir key

### Error: Email tidak terkirim
- Verifikasi RESEND_API_KEY sudah benar
- Pastikan domain sudah diverifikasi di Resend (jika menggunakan domain sendiri)
- Cek logs Edge Function di Supabase Dashboard

### Error: "No user found" saat login
- Pastikan email confirmation sudah di-handle
- Cek apakah user ada di Authentication → Users

### Error: RLS Policy Violation
- Periksa apakah user sudah login
- Verifikasi role user sudah benar
- Cek policies di Database → Policies

### Data tidak muncul
- Cek RLS policies
- Pastikan user punya role yang benar
- Verifikasi query tidak error di console

### Error: "Pendaftaran belum tersedia" di halaman landing

**Penyebab:** RLS policy `cooperative_settings` tidak mengizinkan anonymous users membaca settings.

**Diagnosa:**
```sql
-- Cek apakah policy untuk anon ada
SELECT policyname FROM pg_policies 
WHERE tablename = 'cooperative_settings' AND roles @> ARRAY['anon']::name[];

-- Harus ada: "Anon users can view registration settings"
```

**Solusi:** Jika policy tidak ada, jalankan migrasi untuk menambahkan policy `"Anon users can view registration settings"` pada tabel `cooperative_settings`.

### Error: Admin terjebak di halaman "Menunggu Persetujuan"

**Penyebab:** Trigger `handle_new_user` membuat profile dengan `approval_status = 'pending'` sebelum edge function `create-admin` sempat meng-update statusnya.

**Solusi:**
```sql
UPDATE profiles 
SET approval_status = 'approved', is_active = true 
WHERE user_id IN (
  SELECT user_id FROM user_roles WHERE role = 'admin'
) AND approval_status = 'pending';
```

---

## Kontak Support

Jika mengalami masalah, hubungi:
- Dokumentasi Supabase: https://supabase.com/docs
- Dokumentasi Resend: https://resend.com/docs
- GitHub Issues: (tambahkan link repo jika ada)

---

## Catatan Keamanan

⚠️ **PENTING:**

1. **JANGAN** share Service Role Key ke siapapun
2. **JANGAN** commit credentials ke git
3. **SELALU** gunakan HTTPS di production
4. **AKTIFKAN** Leaked Password Protection
5. **BACKUP** database secara berkala
6. **MONITOR** logs untuk aktivitas mencurigakan
7. **UPDATE** dependencies secara berkala

---

*Dokumen ini terakhir diperbarui: Januari 2026*
