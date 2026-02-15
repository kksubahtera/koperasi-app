# ❓ FAQ (Pertanyaan yang Sering Diajukan)

Kumpulan pertanyaan umum dengan jawaban singkat dan jelas.

---

## 🔐 Login & Akun

### Q: Bagaimana cara login sebagai admin?
**A:** Buka aplikasi → Masukkan email dan password admin → Klik "Masuk". Sistem akan otomatis mengarahkan ke dashboard admin.

---

### Q: Lupa password admin, bagaimana?
**A:** 
1. Klik "Lupa Password" di halaman login
2. Masukkan email admin
3. Cek email untuk link reset password
4. Buat password baru

**Jika email tidak terkirim:** Lihat bagian [Email Tidak Terkirim](#q-email-tidak-terkirim-ke-anggota-apa-yang-harus-dicek)

---

### Q: Bagaimana menambah admin baru?
**A:**
1. Login sebagai Super Admin
2. Buka Menu → Pengaturan → Manajemen Admin
3. Klik "Tambah Admin"
4. Isi data dan tentukan hak akses
5. Admin baru akan menerima email kredensial

---

### Q: Anggota tidak bisa login, kenapa?
**A:** Kemungkinan penyebab:
| Penyebab | Solusi |
|----------|--------|
| Password salah | Reset password via "Lupa Password" |
| Email belum diklaim | Anggota perlu klaim akun dulu |
| Akun dinonaktifkan | Admin perlu aktifkan kembali |
| Akun belum diverifikasi | Cek email verifikasi |

---

## 👥 Manajemen Anggota

### Q: Bagaimana cara menambah anggota baru?
**A:**
1. Login sebagai admin
2. Menu → Anggota → Tambah Anggota
3. Isi form data anggota
4. Klik "Simpan"
5. Anggota akan menerima email kredensial otomatis

---

### Q: Bagaimana cara import banyak anggota sekaligus?
**A:**
1. Menu → Anggota → Import Massal
2. Download template Excel
3. Isi data sesuai template
4. Upload file Excel
5. Review dan konfirmasi

---

### Q: Bagaimana menangani anggota yang mengundurkan diri?
**A:**
1. Menu → Anggota → Pengunduran Diri
2. Pilih anggota
3. Sistem akan menghitung:
   - Total simpanan yang dikembalikan
   - Potongan pinjaman (jika ada)
   - SHU yang belum dibayarkan
4. Proses pengembalian dana
5. Cetak surat konfirmasi

---

### Q: Data anggota tidak muncul, kenapa?
**A:** Kemungkinan:
1. **Filter aktif** - Cek apakah ada filter cabang/status yang aktif
2. **Pencarian typo** - Cek ejaan nama/nomor anggota
3. **RLS Policy** - Hubungi developer jika masalah berlanjut

---

## 💰 Transaksi & Simpanan

### Q: Bagaimana mencatat setoran simpanan?
**A:**
1. Menu → Transaksi → Tambah Transaksi
2. Pilih anggota
3. Pilih jenis simpanan (Pokok/Wajib/Sukarela)
4. Masukkan nominal
5. Klik "Simpan"

---

### Q: Transaksi sudah disimpan tapi saldo tidak berubah?
**A:** 
1. Cek status transaksi - mungkin masih "Pending"
2. Admin perlu approve transaksi jika memerlukan persetujuan
3. Refresh halaman untuk melihat saldo terbaru
4. Jika masih bermasalah, lihat [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)

---

### Q: Bagaimana cara koreksi transaksi yang salah?
**A:**
1. Menu → Transaksi → Koreksi
2. Cari transaksi yang salah
3. Klik "Koreksi"
4. Masukkan alasan dan nilai yang benar
5. Sistem akan membuat jurnal koreksi otomatis

---

## 📧 Email

### Q: Email tidak terkirim ke anggota, apa yang harus dicek?
**A:** Checklist:
- [ ] API Key Resend sudah dikonfigurasi dengan benar?
- [ ] Domain email sudah diverifikasi di Resend?
- [ ] Kuota email Resend belum habis?
- [ ] Email tidak masuk ke folder Spam?

**Cara cek log email:**
1. Login ke dashboard Resend
2. Lihat di tab "Emails" untuk status pengiriman

---

### Q: Bagaimana mengubah template email?
**A:** Saat ini template email dikonfigurasi di kode. Hubungi developer untuk perubahan template.

---

## 📊 Laporan

### Q: Bagaimana mencetak laporan bulanan?
**A:**
1. Menu → Laporan → Laporan Bulanan
2. Pilih periode (bulan/tahun)
3. Klik "Generate"
4. Pilih "Cetak" atau "Export PDF"

---

### Q: Laporan tidak balance, apa yang salah?
**A:**
1. Jalankan Rekonsiliasi: Menu → Akuntansi → Rekonsiliasi
2. Cek apakah ada transaksi yang belum dijurnal
3. Cek apakah ada koreksi yang belum diproses
4. Lihat [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) untuk diagnosa detail

---

## 🔧 Teknis

### Q: Aplikasi lambat, apa yang bisa dilakukan?
**A:**
1. Refresh browser (Ctrl+F5)
2. Clear cache browser
3. Cek koneksi internet
4. Jika masih lambat, mungkin database perlu optimasi - hubungi developer

---

### Q: Bagaimana cara backup database?
**A:**

**Via Supabase Dashboard:**
1. Login ke Supabase Dashboard
2. Project Settings → Database
3. Klik "Download Backup"

**Via CLI (untuk developer):**
```bash
supabase db dump -f backup.sql
```

---

### Q: Bagaimana cara restore dari backup?
**A:**
1. Login ke Supabase Dashboard
2. SQL Editor
3. Paste isi file backup
4. Jalankan query

⚠️ **Hati-hati:** Restore akan menimpa data yang ada

---

### Q: Error "RLS Policy Violation", apa artinya?
**A:** Artinya user mencoba mengakses data yang tidak diizinkan.

**Penyebab umum:**
- User mencoba melihat data user lain
- Session login sudah expired
- Bug di konfigurasi RLS

**Solusi:** Logout dan login kembali. Jika berlanjut, hubungi developer.

---

## 💵 SHU (Sisa Hasil Usaha)

### Q: Bagaimana menghitung SHU?
**A:**
1. Menu → Akuntansi → Distribusi SHU
2. Pilih tahun
3. Sistem akan menghitung otomatis berdasarkan:
   - Proporsi simpanan masing-masing anggota
   - Proporsi jasa usaha masing-masing anggota
4. Review dan konfirmasi distribusi

---

### Q: Anggota keluar sebelum pembagian SHU, bagaimana?
**A:** Sistem mendukung SHU prorata:
1. Menu → SHU → SHU Anggota Keluar
2. Pilih anggota yang keluar
3. Sistem akan menghitung SHU berdasarkan bulan aktif
4. Proses pembayaran

---

## 🏦 Pinjaman

### Q: Bagaimana proses pengajuan pinjaman?
**A:**
1. Anggota mengajukan via aplikasi atau admin input manual
2. Admin review pengajuan
3. Jika disetujui, tentukan tanggal pencairan
4. Sistem generate jadwal angsuran otomatis
5. Cetak surat persetujuan

---

### Q: Anggota menunggak angsuran, apa yang otomatis terjadi?
**A:**
- Sistem menghitung denda otomatis (jika dikonfigurasi)
- Notifikasi dikirim ke anggota
- Status pinjaman berubah menjadi "Menunggak"
- Muncul di dashboard Overdue

---

## 📜 AD/ART (Anggaran Dasar & Anggaran Rumah Tangga)

### Q: Bagaimana cara mengatur AD dan ART koperasi?
**A:**
1. Login sebagai admin
2. Menu → Pengaturan → Tab "AD/ART"
3. AD dan ART sekarang terpisah dengan struktur Bab dan Pasal
4. Untuk AD: Tambah Bab → Tambah Pasal dalam setiap Bab
5. Untuk ART: Sama seperti AD, tambah Bab dan Pasal
6. Klik "Simpan Perubahan"

---

### Q: Apa perbedaan AD dan ART?
**A:**
| Aspek | Anggaran Dasar (AD) | Anggaran Rumah Tangga (ART) |
|-------|---------------------|------------------------------|
| Sifat | Aturan dasar/fundamental | Aturan pelaksanaan/teknis |
| Isi | Nama, tujuan, struktur organisasi | Prosedur operasional, tata cara |
| Perubahan | Perlu RAT khusus | Lebih fleksibel |

---

### Q: Bagaimana anggota melihat AD/ART?
**A:**
1. Anggota buka Profil Koperasi
2. Klik icon dokumen di kanan atas
3. Pilih tab "Anggaran Dasar" atau "Anggaran Rumah Tangga"
4. Klik pada Bab untuk melihat Pasal-pasal di dalamnya

---

## 🔄 Maintenance

### Q: Apa yang harus dilakukan setiap hari?
**A:** Lihat [DAILY_MAINTENANCE.md](./DAILY_MAINTENANCE.md) untuk checklist lengkap.

Ringkasan:
- Cek notifikasi dan transaksi pending
- Approve transaksi yang perlu persetujuan
- Cek email bounce/failed

---

### Q: Bagaimana proses tutup buku bulanan?
**A:**
1. Pastikan semua transaksi bulan tersebut sudah diinput
2. Menu → Akuntansi → Penutupan Bulan
3. Pilih bulan yang akan ditutup
4. Review ringkasan
5. Konfirmasi penutupan

---

## 📅 Tutup Buku Tahunan

### Q: Bagaimana proses tutup buku tahunan?
**A:** Proses tutup buku tahunan terdiri dari beberapa langkah:

1. **Persiapan:**
   - Pastikan semua transaksi Desember sudah diinput dan diverifikasi
   - Lakukan rekonsiliasi bank
   - Pastikan tidak ada transaksi pending
   - Buat backup data

2. **Tutup Buku Bulan Desember:**
   - Menu → Pembukuan → Tutup Buku → Pilih Desember

3. **Hitung & Distribusikan SHU:**
   - Menu → Pembukuan → Distribusi SHU
   - Pilih tahun → Review perhitungan → Konfirmasi

4. **Rollover Dana:**
   - Menu → Pembukuan → Rollover SHU
   - Preview rollover → Konfirmasi

5. **Cetak Laporan untuk RAT**

---

### Q: Data apa saja yang di-rollover ke tahun baru?
**A:** Data yang dipindahkan melalui jurnal pembukaan:

| Data | Keterangan |
|------|------------|
| Dana Cadangan | Saldo akhir → Saldo awal tahun baru |
| Dana Pendidikan | Akumulasi dari alokasi SHU |
| Dana Sosial | Untuk program sosial anggota |
| Dana Pembangunan | Untuk pengembangan koperasi |
| SHU Ditahan | SHU anggota yang ditahan karena tunggakan |

**Data yang TIDAK direset (berkelanjutan):**
- Simpanan Pokok, Wajib, Sukarela
- Saldo pinjaman yang masih berjalan
- Jadwal angsuran

---

### Q: Apa yang terjadi dengan pinjaman saat tutup buku?
**A:** Pinjaman yang masih berjalan **TIDAK direset**:

1. **Saldo Pokok:** Sisa pokok di akhir tahun menjadi saldo awal tahun baru
2. **Jadwal Angsuran:** Tetap berjalan sesuai tanggal jatuh tempo
3. **Bunga:** Bunga yang dibayar tahun lalu dihitung untuk SHU tahun lalu
4. **Tunggakan:** Jika ada tunggakan, SHU anggota akan ditahan

Lihat laporan **Pinjaman Lintas Tahun** di menu Pembukuan untuk detail.

---

### Q: Bagaimana jika ada transaksi yang terlewat setelah tutup buku?
**A:** Gunakan fitur **Koreksi** untuk mencatat transaksi yang terlewat:
1. Menu → Transaksi → Koreksi
2. Buat koreksi dengan alasan yang jelas
3. Sistem akan membuat jurnal penyesuaian

⚠️ **Catatan:** Rollover SHU tidak dapat dibatalkan setelah dikonfirmasi.

---

### Q: Kapan waktu terbaik melakukan tutup buku tahunan?
**A:** 
- **Ideal:** 2-4 minggu sebelum RAT
- **Waktu:** Setelah semua transaksi Desember tercatat dan diverifikasi
- **Biasanya:** Bulan Januari-Februari

---

### Q: Bagaimana dengan SHU anggota yang keluar di tengah tahun?
**A:** SHU dihitung **prorata** berdasarkan bulan aktif:
1. Menu → Pembukuan → SHU Anggota Keluar
2. Pilih anggota yang keluar
3. Sistem menghitung berdasarkan:
   - Jumlah bulan aktif dalam tahun tersebut
   - Proporsi simpanan rata-rata
   - Proporsi jasa usaha (bunga pinjaman yang dibayar)

---

## 🆘 Masih Butuh Bantuan?

Jika pertanyaan Anda belum terjawab:

1. **Cek Dokumentasi Lain:**
   - [GLOSSARY.md](./GLOSSARY.md) - Penjelasan istilah teknis
   - [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) - Solusi masalah teknis
   - [DAILY_MAINTENANCE.md](./DAILY_MAINTENANCE.md) - Panduan tugas rutin

2. **Hubungi Support:**
   - Email: [email support]
   - WhatsApp: [nomor support]

---

*Terakhir diperbarui: Januari 2026*
