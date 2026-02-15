# 📖 Glosarium Istilah Teknis

Daftar istilah teknis yang sering muncul dalam dokumentasi dan aplikasi ini, dijelaskan dengan bahasa sederhana.

---

## A

### API (Application Programming Interface)
**Apa itu:** Cara program komputer berkomunikasi satu sama lain.  
**Analogi:** Seperti pelayan restoran yang menerima pesanan Anda dan menyampaikan ke dapur.  
**Contoh:** Aplikasi ini menggunakan API Resend untuk mengirim email.

### API Key
**Apa itu:** Password khusus untuk mengakses layanan external.  
**Penting:** Jangan pernah bagikan API Key ke orang lain atau simpan di kode yang publik.  
**Contoh:** `RESEND_API_KEY` digunakan untuk mengirim email.

### Auth / Authentication
**Apa itu:** Proses memverifikasi identitas pengguna (login).  
**Contoh:** Memasukkan email dan password untuk masuk ke aplikasi.

### Anon Key
**Apa itu:** Kunci publik Supabase yang aman untuk digunakan di browser.  
**Berbeda dengan:** Service Role Key yang harus dirahasiakan.

---

## B

### Backend
**Apa itu:** Bagian aplikasi yang berjalan di server, tidak terlihat oleh pengguna.  
**Tugas:** Menyimpan data, memproses logika bisnis, mengirim email.  
**Contoh:** Database, Edge Functions.

### Backup
**Apa itu:** Salinan data untuk berjaga-jaga jika terjadi masalah.  
**Tips:** Lakukan backup secara rutin, minimal mingguan.

---

## C

### CORS (Cross-Origin Resource Sharing)
**Apa itu:** Aturan keamanan browser yang mengontrol website mana yang bisa mengakses data.  
**Masalah umum:** Error "CORS policy" berarti website tidak diizinkan mengakses API.

### CLI (Command Line Interface)
**Apa itu:** Cara mengoperasikan komputer dengan mengetik perintah teks.  
**Contoh:** Terminal di Mac/Linux, Command Prompt di Windows.

---

## D

### Database
**Apa itu:** Tempat menyimpan semua data aplikasi secara terstruktur.  
**Analogi:** Seperti lemari arsip digital dengan banyak laci (tabel).

### Deploy
**Apa itu:** Proses mempublikasikan aplikasi agar bisa diakses orang lain.  
**Contoh:** Upload kode ke Vercel agar website bisa diakses via internet.

---

## E

### Edge Function
**Apa itu:** Program kecil yang berjalan di server untuk tugas tertentu.  
**Kegunaan:** Mengirim email, memproses pembayaran, validasi data sensitif.  
**Contoh:** `send-member-credentials` untuk kirim email kredensial anggota baru.

### Enkripsi
**Apa itu:** Proses mengacak data agar tidak bisa dibaca tanpa kunci.  
**Contoh:** NIK anggota dienkripsi sebelum disimpan di database.

### Environment Variable
**Apa itu:** Pengaturan yang disimpan di luar kode, biasanya berisi password atau konfigurasi.  
**Contoh:** `VITE_SUPABASE_URL` menyimpan alamat database.

---

## F

### Frontend
**Apa itu:** Bagian aplikasi yang dilihat dan digunakan pengguna.  
**Contoh:** Halaman login, dashboard, form transaksi.

### Foreign Key
**Apa itu:** Kolom di tabel database yang merujuk ke data di tabel lain.  
**Contoh:** Kolom `user_id` di tabel `transactions` merujuk ke tabel `profiles`.

---

## J

### JWT (JSON Web Token)
**Apa itu:** Token digital yang membuktikan identitas pengguna setelah login.  
**Analogi:** Seperti gelang tamu di konser yang membuktikan Anda sudah bayar tiket.  
**Isi:** Informasi user ID, waktu login, waktu kadaluarsa.

### Journal Entry
**Apa itu:** Catatan transaksi akuntansi dengan debit dan kredit.  
**Prinsip:** Total debit harus sama dengan total kredit (balanced).

---

## M

### Migration
**Apa itu:** File SQL yang mendefinisikan atau mengubah struktur database.  
**Urutan:** Harus dijalankan sesuai urutan tanggal di nama file.  
**Contoh:** `20240115_create_users_table.sql`

### Middleware
**Apa itu:** Kode yang berjalan di antara request dan response.  
**Contoh:** Memeriksa apakah user sudah login sebelum mengakses halaman admin.

---

## P

### Policy (RLS Policy)
**Apa itu:** Aturan yang menentukan siapa bisa melihat/edit data apa di database.  
**Contoh:** "Anggota hanya bisa melihat transaksi miliknya sendiri"

### Primary Key
**Apa itu:** Kolom unik yang mengidentifikasi setiap baris di tabel.  
**Contoh:** Kolom `id` dengan nilai UUID.

---

## R

### RLS (Row Level Security)
**Apa itu:** Fitur keamanan Supabase yang membatasi akses data per baris.  
**Cara kerja:** Setiap query otomatis difilter berdasarkan policy yang aktif.  
**Penting:** Jika RLS aktif tapi tidak ada policy, TIDAK ADA yang bisa akses data.

### Realtime
**Apa itu:** Fitur yang memungkinkan data otomatis update tanpa refresh halaman.  
**Contoh:** Notifikasi muncul langsung saat ada transaksi baru.

### Repository (Repo)
**Apa itu:** Tempat menyimpan kode dan riwayat perubahannya.  
**Platform:** GitHub, GitLab, Bitbucket.

---

## S

### Schema
**Apa itu:** Struktur database yang mendefinisikan tabel, kolom, dan relasinya.  
**Lokasi:** File `src/integrations/supabase/types.ts` berisi definisi schema.

### Secret
**Apa itu:** Nilai rahasia yang disimpan aman di server.  
**Contoh:** API Key, password database.  
**Akses:** Hanya bisa diakses oleh Edge Functions, tidak oleh frontend.

### Service Role Key
**Apa itu:** Kunci Supabase dengan akses penuh ke database, melewati RLS.  
**⚠️ BAHAYA:** Jangan pernah expose di frontend atau bagikan ke orang lain.

### SQL (Structured Query Language)
**Apa itu:** Bahasa untuk berkomunikasi dengan database.  
**Contoh:** `SELECT * FROM users WHERE role = 'admin'`

---

## T

### Table (Tabel)
**Apa itu:** Kumpulan data dengan struktur yang sama di database.  
**Analogi:** Seperti spreadsheet Excel dengan kolom dan baris.  
**Contoh:** Tabel `profiles`, `transactions`, `loans`.

### Token
**Apa itu:** String acak yang digunakan untuk autentikasi atau verifikasi.  
**Contoh:** Token login, token reset password.

### Trigger
**Apa itu:** Kode yang otomatis berjalan saat ada event tertentu di database.  
**Contoh:** Trigger untuk membuat profil otomatis saat user baru mendaftar.

---

## U

### UUID (Universally Unique Identifier)
**Apa itu:** ID unik yang hampir mustahil duplikat.  
**Format:** `550e8400-e29b-41d4-a716-446655440000`  
**Kegunaan:** Primary key di tabel database.

---

## V

### Vercel
**Apa itu:** Platform untuk hosting website dan aplikasi frontend.  
**Gratis:** Ya, untuk project personal dengan batasan tertentu.

---

## W

### Webhook
**Apa itu:** URL yang dipanggil otomatis saat ada event tertentu.  
**Contoh:** Stripe memanggil webhook saat pembayaran berhasil.

---

## Istilah Koperasi

### AD (Anggaran Dasar)
**Apa itu:** Dokumen hukum dasar koperasi yang mengatur hal-hal fundamental.  
**Isi:** Nama, tujuan, keanggotaan, modal, pengurus, dan pengawas koperasi.  
**Struktur:** Terdiri dari Bab (chapter) dan Pasal (article).

### ART (Anggaran Rumah Tangga)
**Apa itu:** Aturan pelaksanaan yang lebih detail dari Anggaran Dasar.  
**Isi:** Prosedur operasional, hak dan kewajiban anggota, tata cara rapat, dll.  
**Struktur:** Terdiri dari Bab (chapter) dan Pasal (article).  
**Hubungan:** ART tidak boleh bertentangan dengan AD.

### SHU (Sisa Hasil Usaha)
**Apa itu:** Keuntungan koperasi yang dibagikan ke anggota.  
**Perhitungan:** Berdasarkan simpanan dan jasa usaha masing-masing anggota.

### Simpanan Pokok
**Apa itu:** Setoran wajib sekali saat menjadi anggota.  
**Sifat:** Tidak bisa diambil selama masih menjadi anggota.

### Simpanan Wajib
**Apa itu:** Setoran rutin bulanan yang wajib.  
**Sifat:** Tidak bisa diambil selama masih menjadi anggota.

### Simpanan Sukarela
**Apa itu:** Tabungan yang bisa disetor dan ditarik kapan saja.  
**Sifat:** Fleksibel seperti tabungan biasa.

### Jasa Usaha
**Apa itu:** Aktivitas transaksi anggota dengan unit usaha koperasi.  
**Pengaruh:** Semakin banyak jasa usaha, semakin besar bagian SHU.

---

*Tidak menemukan istilah yang dicari? Hubungi tim support atau tambahkan di dokumentasi ini.*

*Terakhir diperbarui: Januari 2026*
