# ⚡ Quick Reference (Cheat Sheet)

Referensi cepat satu halaman untuk admin dan developer.

---

## 🔗 URL Penting

| Layanan | URL | Kegunaan |
|---------|-----|----------|
| Supabase Dashboard | `https://supabase.com/dashboard` | Manage database |
| Resend Dashboard | `https://resend.com/emails` | Monitor email |
| Vercel Dashboard | `https://vercel.com/dashboard` | Hosting & deploy |
| GitHub Repo | `[URL repository Anda]` | Source code |

---

## 🔑 Environment Variables

### Frontend (Vercel)
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### Backend (Supabase Secrets)
```
RESEND_API_KEY=re_xxxxxxxx
ADMIN_SETUP_KEY=your-secret-key
NIK_ENCRYPTION_KEY=base64-encoded-key
```

---

## 💻 CLI Commands

### Supabase CLI

```bash
# Login
supabase login

# Link project
supabase link --project-ref your-project-id

# Database
supabase db dump -f backup.sql              # Backup
supabase db push                            # Push migrations
supabase db reset                           # Reset (HATI-HATI!)

# Edge Functions
supabase functions deploy function-name     # Deploy satu function
supabase functions deploy                   # Deploy semua
supabase functions serve                    # Local development

# Check status
supabase status
```

### NPM Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

---

## 🗄️ SQL Queries Berguna

### Cek User & Profile

```sql
-- User tanpa profile
SELECT au.id, au.email 
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.user_id
WHERE p.id IS NULL;

-- Admin list
SELECT p.name, p.email, ur.role 
FROM profiles p
JOIN user_roles ur ON p.user_id = ur.user_id
WHERE ur.role = 'admin';
```

### Transaksi & Saldo

```sql
-- Total simpanan per jenis
SELECT 
  SUM(simpanan_pokok) as total_pokok,
  SUM(simpanan_wajib) as total_wajib,
  SUM(simpanan_sukarela) as total_sukarela
FROM savings_summary;

-- Transaksi hari ini
SELECT * FROM transactions 
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;

-- Transaksi pending
SELECT t.*, p.name 
FROM transactions t
JOIN profiles p ON t.user_id = p.user_id
WHERE t.status = 'pending';
```

### Pinjaman

```sql
-- Pinjaman aktif
SELECT l.*, p.name, p.member_number
FROM loans l
JOIN profiles p ON l.user_id = p.user_id
WHERE l.status = 'active';

-- Pinjaman menunggak
SELECT l.*, p.name, 
  COUNT(li.id) as angsuran_menunggak
FROM loans l
JOIN profiles p ON l.user_id = p.user_id
JOIN loan_installments li ON l.id = li.loan_id
WHERE li.status = 'overdue'
GROUP BY l.id, p.name;
```

### Audit & Log

```sql
-- Login terakhir per user
SELECT p.name, p.email, p.last_login_at
FROM profiles p
ORDER BY last_login_at DESC
LIMIT 20;

-- Aktivitas admin terbaru
SELECT * FROM admin_activity_logs
ORDER BY created_at DESC
LIMIT 50;
```

---

## 📊 Struktur Tabel Utama

```
profiles
├── user_id (FK → auth.users)
├── name
├── email
├── member_number
├── phone
├── address
└── encrypted_nik

user_roles
├── user_id (FK → auth.users)
└── role (admin/member)

savings_summary
├── user_id (FK → auth.users)
├── simpanan_pokok
├── simpanan_wajib
└── simpanan_sukarela

transactions
├── user_id (FK → profiles)
├── type
├── amount
├── status
└── created_at

loans
├── user_id (FK → profiles)
├── principal_amount
├── interest_rate
├── tenor
└── status

loan_installments
├── loan_id (FK → loans)
├── installment_number
├── due_date
├── amount
└── status
```

---

## 🔒 Role & Permissions

| Role | Akses |
|------|-------|
| `super_admin` | Semua akses + manage admin |
| `admin` | Manage anggota, transaksi, laporan |
| `member` | Lihat data sendiri, transaksi sendiri |

---

## 📧 Edge Functions

| Function | Trigger | Kegunaan |
|----------|---------|----------|
| `send-member-credentials` | Anggota baru | Kirim email login |
| `send-loan-notification` | Status pinjaman berubah | Notifikasi pinjaman |
| `installment-reminder` | Scheduled (cron) | Reminder angsuran |
| `overdue-alert` | Scheduled (cron) | Alert keterlambatan |
| `monthly-closing` | Manual/Scheduled | Penutupan bulan |

---

## 🚨 Error Codes Umum

| Code | Arti | Solusi |
|------|------|--------|
| 401 | Unauthorized | Login ulang |
| 403 | Forbidden (RLS) | Cek permission |
| 404 | Not found | Cek URL/ID |
| 422 | Validation error | Cek input data |
| 500 | Server error | Cek log, hubungi dev |

---

## 📱 Shortcut Keyboard

| Shortcut | Aksi |
|----------|------|
| `Ctrl + K` | Quick search |
| `Ctrl + /` | Toggle sidebar |
| `Esc` | Close modal |
| `Enter` | Confirm dialog |

---

## 🎨 Status Colors

| Status | Color | Badge Class |
|--------|-------|-------------|
| Active | Green | `bg-green-100 text-green-800` |
| Pending | Yellow | `bg-yellow-100 text-yellow-800` |
| Rejected | Red | `bg-red-100 text-red-800` |
| Completed | Blue | `bg-blue-100 text-blue-800` |

---

## 📞 Support Contacts

| Kebutuhan | Kontak |
|-----------|--------|
| Bug Report | [GitHub Issues / Email] |
| Feature Request | [GitHub Issues / Email] |
| Urgent/Security | [Phone/WhatsApp] |

---

## 📜 Pengaturan AD/ART

### Struktur AD/ART
```
Anggaran Dasar (AD)
├── Bab I: Nama dan Kedudukan
│   ├── Pasal 1: Nama Koperasi
│   └── Pasal 2: Kedudukan
├── Bab II: Tujuan
│   └── Pasal 3: Tujuan Koperasi
└── ...

Anggaran Rumah Tangga (ART)
├── Bab I: Keanggotaan
│   ├── Pasal 1: Syarat Keanggotaan
│   └── Pasal 2: Hak dan Kewajiban
├── Bab II: Simpanan
│   └── Pasal 3: Jenis Simpanan
└── ...
```

### Lokasi Pengaturan
- **Admin:** Pengaturan → Tab AD/ART
- **Anggota:** Profil Koperasi → Icon Dokumen → Tab AD/ART

### Database Keys
| Setting | Database Key |
|---------|--------------|
| Anggaran Dasar | `cooperative_ad_content` |
| Anggaran Rumah Tangga | `cooperative_art_content` |
| Legacy (deprecated) | `cooperative_ad_art_content` |

---

## 📚 Dokumentasi Lengkap

- [GLOSSARY.md](./GLOSSARY.md) - Istilah teknis
- [FAQ.md](./FAQ.md) - Pertanyaan umum
- [DAILY_MAINTENANCE.md](./DAILY_MAINTENANCE.md) - Tugas rutin
- [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) - Solusi masalah
- [SELF_HOSTING_GUIDE.md](./SELF_HOSTING_GUIDE.md) - Panduan deploy
- [SECURITY_DOCUMENTATION.md](./SECURITY_DOCUMENTATION.md) - Keamanan

---

*Print halaman ini dan tempel di meja kerja Anda!*

*Terakhir diperbarui: Januari 2026*
