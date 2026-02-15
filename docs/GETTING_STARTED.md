# 🚀 Panduan Memulai (Getting Started)

Panduan singkat untuk pemula yang ingin deploy dan menjalankan aplikasi Koperasi Digital.

> **Estimasi Waktu:** 30-60 menit untuk setup lengkap

---

## 📋 Prasyarat

Sebelum memulai, pastikan Anda memiliki:

- [ ] Komputer dengan koneksi internet
- [ ] Browser modern (Chrome, Firefox, Edge)
- [ ] Email yang aktif

---

## 🎯 5 Langkah Memulai

### Langkah 1: Buat Akun yang Diperlukan

| Platform | Kegunaan | Link |
|----------|----------|------|
| **Supabase** | Database & Backend | [supabase.com](https://supabase.com) |
| **Vercel** | Hosting Website | [vercel.com](https://vercel.com) |
| **Resend** | Kirim Email | [resend.com](https://resend.com) |
| **GitHub** | Simpan Kode | [github.com](https://github.com) |

> 💡 **Tips:** Semua platform di atas memiliki paket gratis yang cukup untuk memulai

---

### Langkah 2: Setup Database

1. **Login ke Supabase** dan buat project baru
2. **Catat informasi penting:**
   - Project URL (contoh: `https://xxxxx.supabase.co`)
   - Anon Key (kunci publik)
   - Service Role Key (kunci rahasia - jangan dibagikan!)

3. **Jalankan migrasi database:**
   - Buka SQL Editor di Supabase Dashboard
   - Copy-paste isi file dari folder `supabase/migrations/`
   - Jalankan satu per satu sesuai urutan tanggal

> 📖 **Lihat:** [SELF_HOSTING_GUIDE.md](./SELF_HOSTING_GUIDE.md) untuk detail lengkap

---

### Langkah 3: Deploy ke Vercel

1. **Fork repository** ke akun GitHub Anda
2. **Import ke Vercel:**
   - Login ke Vercel
   - Klik "New Project"
   - Pilih repository yang sudah di-fork
3. **Tambahkan Environment Variables:**

   | Variable | Nilai | Keterangan |
   |----------|-------|------------|
   | `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | URL dari Supabase |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Anon Key dari Supabase |

4. **Klik Deploy** dan tunggu hingga selesai

---

### Langkah 4: Buat Admin Pertama

1. **Generate Setup Key** di Supabase:
   - Buka Project Settings → Secrets
   - Tambahkan secret baru: `ADMIN_SETUP_KEY`
   - Nilai: buat password yang kuat (minimal 16 karakter)

2. **Akses halaman setup:**
   ```
   https://nama-aplikasi-anda.vercel.app/setup-admin
   ```

3. **Isi form:**
   - Setup Key: (yang sudah dibuat di atas)
   - Nama Lengkap
   - Email
   - Password

4. **Klik "Buat Admin"**

> ⚠️ **Penting:** Halaman setup hanya bisa diakses sekali. Simpan kredensial dengan aman!

---

### Langkah 5: Konfigurasi Email

1. **Di Resend:**
   - Buat API Key baru
   - Verifikasi domain email Anda (opsional tapi direkomendasikan)

2. **Di Supabase:**
   - Buka Project Settings → Secrets
   - Tambahkan: `RESEND_API_KEY` dengan nilai API Key dari Resend

3. **Test kirim email:**
   - Login sebagai admin
   - Buat anggota baru
   - Pastikan email kredensial terkirim

---

### Langkah 6: Simpan Kode ke GitHub

Menghubungkan proyek ke GitHub memberikan backup otomatis dan version control.

#### Cara Menghubungkan:

1. **Di Lovable Editor:**
   - Klik **GitHub** di menu atas
   - Pilih **Connect to GitHub**

2. **Otorisasi:**
   - Login ke akun GitHub Anda
   - Klik **Authorize** untuk Lovable GitHub App

3. **Buat Repository:**
   - Pilih akun/organisasi GitHub tujuan
   - Klik **Create Repository**

4. **Selesai!** Repository otomatis terbuat dengan kode proyek Anda

#### Cara Sinkronisasi Bekerja:

| Aksi | Hasil |
|------|-------|
| Edit di Lovable | Otomatis push ke GitHub |
| Push ke GitHub | Otomatis sync ke Lovable |

> 💡 **Tips:** Tidak perlu manual push/pull - semua otomatis!

#### Manfaat GitHub:

- ✅ **Backup otomatis** - Kode tersimpan aman
- ✅ **Version history** - Bisa kembali ke versi sebelumnya
- ✅ **Kolaborasi** - Undang developer lain
- ✅ **Development lokal** - Clone untuk coding di komputer sendiri

#### ⚠️ Penting:

- Jangan edit file langsung di GitHub saat aktif editing di Lovable
- Tunggu sync selesai sebelum melakukan perubahan berikutnya
- Satu akun GitHub per akun Lovable

---

## ✅ Checklist Setelah Setup

- [ ] Bisa login sebagai admin
- [ ] Dashboard admin tampil dengan benar
- [ ] Bisa membuat anggota baru
- [ ] Email terkirim ke anggota baru
- [ ] Anggota bisa login dengan kredensial
- [ ] Proyek terhubung ke GitHub
- [ ] Repository bisa diakses di github.com

---

## 🆘 Butuh Bantuan?

| Masalah | Solusi |
|---------|--------|
| Error saat deploy | Lihat [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) |
| Istilah tidak dipahami | Lihat [GLOSSARY.md](./GLOSSARY.md) |
| Pertanyaan umum | Lihat [FAQ.md](./FAQ.md) |
| Tugas rutin | Lihat [DAILY_MAINTENANCE.md](./DAILY_MAINTENANCE.md) |
| Sync GitHub gagal | Cek koneksi di Settings → GitHub |

---

## 📚 Langkah Selanjutnya

Setelah setup berhasil, Anda bisa:

1. **Konfigurasi Koperasi** - Atur nama, logo, dan pengaturan di menu Settings
2. **Impor Data Anggota** - Jika migrasi dari sistem lama
3. **Setup Cabang** - Jika koperasi memiliki banyak cabang
4. **Konfigurasi Template Surat** - Sesuaikan format surat resmi

---

*Terakhir diperbarui: Januari 2026*
