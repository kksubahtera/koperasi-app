# 📋 Panduan Maintenance Rutin

Checklist tugas pemeliharaan aplikasi untuk admin koperasi.

---

## 📅 Tugas Harian

Lakukan setiap hari kerja, idealnya di pagi hari.

### Checklist Harian

- [ ] **Cek Dashboard**
  - Lihat ringkasan transaksi hari kemarin
  - Cek notifikasi baru
  - Perhatikan alert atau warning

- [ ] **Proses Transaksi Pending**
  - Menu → Transaksi → Pending
  - Review dan approve/reject transaksi
  - Catat alasan jika reject

- [ ] **Cek Pengajuan Baru**
  - Pinjaman baru
  - Pendaftaran anggota baru
  - Permintaan pengunduran diri

- [ ] **Monitor Email**
  - Cek apakah ada email bounce
  - Tindak lanjuti keluhan via email

### Estimasi Waktu: 15-30 menit

---

## 📆 Tugas Mingguan

Lakukan setiap minggu, disarankan hari Jumat atau Senin.

### Checklist Mingguan

- [ ] **Backup Database**
  ```
  1. Login ke Supabase Dashboard
  2. Settings → Database
  3. Download Backup
  4. Simpan di lokasi aman (cloud storage/external drive)
  ```

- [ ] **Review Audit Log**
  - Menu → Pengaturan → Audit Log
  - Cek aktivitas tidak wajar
  - Catat jika ada akses mencurigakan

- [ ] **Cek Pinjaman Jatuh Tempo**
  - Menu → Pinjaman → Jatuh Tempo Minggu Ini
  - Kirim reminder ke anggota
  - Update status pembayaran

- [ ] **Rekonsiliasi Cepat**
  - Bandingkan saldo sistem vs catatan bank
  - Catat selisih jika ada

- [ ] **Cek Status Edge Functions**
  - Pastikan semua fungsi berjalan normal
  - Cek log untuk error

### Estimasi Waktu: 30-60 menit

---

## 📊 Tugas Bulanan

Lakukan di akhir bulan atau awal bulan berikutnya.

### Checklist Bulanan

- [ ] **Penutupan Bulan**
  ```
  1. Pastikan semua transaksi bulan tersebut sudah diinput
  2. Menu → Akuntansi → Penutupan Bulan
  3. Review ringkasan keuangan
  4. Konfirmasi penutupan
  ```

- [ ] **Generate Laporan Bulanan**
  - Laporan Keuangan
  - Laporan Simpanan
  - Laporan Pinjaman
  - Laporan Anggota

- [ ] **Rekonsiliasi Bank**
  - Menu → Akuntansi → Rekonsiliasi Bank
  - Cocokkan dengan mutasi rekening
  - Catat item outstanding

- [ ] **Cek Simpanan Wajib**
  - Daftar anggota yang belum setor
  - Kirim reminder
  - Tindak lanjut

- [ ] **Review Pinjaman Bermasalah**
  - Daftar pinjaman menunggak
  - Tentukan tindakan (reminder, restruktur, dll)
  - Dokumentasikan

- [ ] **Backup Bulanan**
  - Backup database lengkap
  - Backup dokumen/surat yang diterbitkan
  - Simpan di lokasi terpisah dari backup mingguan

- [ ] **Cek Kapasitas Penyimpanan**
  - Storage database
  - Storage file/dokumen
  - Bersihkan data tidak perlu jika mendekati limit

### Estimasi Waktu: 2-4 jam

---

## 📈 Tugas Tahunan

Lakukan di akhir tahun atau awal tahun berikutnya.

### Checklist Tahunan

- [ ] **Penutupan Tahun Buku**
  ```
  1. Pastikan penutupan bulan Desember selesai
  2. Menu → Akuntansi → Penutupan Tahun
  3. Review laporan tahunan
  4. Konfirmasi penutupan
  ```

- [ ] **Perhitungan SHU**
  - Menu → Akuntansi → Distribusi SHU
  - Hitung berdasarkan simpanan dan jasa usaha
  - Review sebelum distribusi
  - Cetak laporan SHU per anggota

- [ ] **Laporan RAT**
  - Generate semua laporan tahunan
  - Persiapan dokumen RAT
  - Neraca, Laba Rugi, Arus Kas

- [ ] **Audit Internal**
  - Review semua transaksi besar
  - Cek kepatuhan prosedur
  - Dokumentasikan temuan

- [ ] **Update Konfigurasi**
  - Review suku bunga pinjaman
  - Review denda keterlambatan
  - Update pengaturan jika ada perubahan kebijakan

- [ ] **Arsip Tahunan**
  - Backup database lengkap tahun berjalan
  - Arsip semua surat yang diterbitkan
  - Simpan di lokasi aman jangka panjang

- [ ] **Persiapan Tahun Baru**
  - Reset nomor surat ke 001
  - Update tahun di template surat
  - Cek dan update target/anggaran

### Estimasi Waktu: 1-2 hari kerja

---

## 🛠️ Panduan Troubleshooting Cepat

### Jika Aplikasi Lambat
1. Refresh browser (Ctrl+F5)
2. Clear cache
3. Cek koneksi internet
4. Restart browser

### Jika Data Tidak Muncul
1. Cek filter yang aktif
2. Refresh halaman
3. Logout dan login kembali
4. Cek di browser lain

### Jika Transaksi Gagal
1. Cek koneksi internet
2. Cek apakah saldo mencukupi
3. Coba lagi dalam beberapa menit
4. Hubungi developer jika berlanjut

### Jika Email Tidak Terkirim
1. Cek kuota Resend
2. Cek validitas email tujuan
3. Cek folder Spam penerima
4. Review log di Resend dashboard

---

## 📝 Template Catatan Maintenance

Gunakan template ini untuk dokumentasi:

```
=== LOG MAINTENANCE ===
Tanggal: [DD/MM/YYYY]
Admin: [Nama Admin]

TUGAS SELESAI:
- [ ] Item 1
- [ ] Item 2

MASALAH DITEMUKAN:
- [Deskripsi masalah]
- Status: [Solved/Pending]
- Tindakan: [Apa yang dilakukan]

CATATAN LAIN:
- [Catatan tambahan]

TINDAK LANJUT:
- [Item yang perlu ditindaklanjuti]
===
```

---

## 📞 Kontak Darurat

Simpan kontak ini untuk situasi darurat:

| Situasi | Kontak |
|---------|--------|
| Aplikasi down | [Developer/Tim IT] |
| Database error | [Developer/Tim IT] |
| Security breach | [Developer + Manajemen] |
| Email tidak berfungsi | [Cek Resend status page] |

---

## 📚 Referensi Cepat

- [FAQ.md](./FAQ.md) - Pertanyaan umum
- [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) - Solusi masalah teknis
- [GLOSSARY.md](./GLOSSARY.md) - Istilah teknis
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Cheat sheet

---

*Terakhir diperbarui: Januari 2026*
