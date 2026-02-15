# Koperasi Digital - Template Siap Pakai

Template aplikasi koperasi digital yang siap dihubungkan ke database.

## Fitur

- **Autentikasi**: Login, registrasi, dan logout
- **Dashboard Member**: Lihat simpanan, transaksi, pinjaman, SHU
- **Dashboard Admin**: Kelola anggota, verifikasi transaksi, laporan keuangan
- **Multi-bahasa**: Indonesia dan English
- **Dark/Light Mode**: Toggle tema gelap/terang
- **Responsive**: Mendukung mobile dan desktop

## Teknologi

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Shadcn/UI Components
- React Router
- React Query

## Cara Menghubungkan ke Database

### Opsi 1: Supabase (Rekomendasi)

1. **Install Supabase Client**
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Buat file konfigurasi Supabase**
   ```typescript
   // src/integrations/supabase/client.ts
   import { createClient } from '@supabase/supabase-js';

   const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
   const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

   export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
   ```

3. **Tambahkan environment variables**
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Update service layer di `src/lib/database.ts`**
   Ganti implementasi fungsi-fungsi dengan panggilan Supabase.

### Opsi 2: Firebase

1. **Install Firebase**
   ```bash
   npm install firebase
   ```

2. **Konfigurasi Firebase dan update service layer**

### Opsi 3: REST API Backend Sendiri

1. **Update service layer** untuk memanggil API endpoint Anda

## Struktur Database yang Dibutuhkan

### Tabel Users/Profiles
```sql
- id (UUID, primary key)
- name (text)
- email (text, unique)
- phone (text)
- nik (text, 16 digit)
- bank_account_number (text)
- bank_account_name (text)
- profile_photo (text, optional)
- member_number (text)
- join_date (date)
- exit_date (date, optional)
- is_active (boolean)
```

### Tabel User Roles
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key)
- role (enum: 'member', 'admin')
```

### Tabel Savings Summary
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key)
- simpanan_pokok (numeric)
- simpanan_wajib (numeric)
- simpanan_sukarela (numeric)
- total_simpanan (numeric)
```

### Tabel Transactions
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key)
- type (enum: transaction types)
- amount (numeric)
- payment_method (enum: 'transfer_bank', 'e_wallet')
- status (enum: 'pending', 'approved', 'rejected')
- date (date)
- notes (text, optional)
```

### Tabel Loans
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key)
- principal_amount (numeric)
- tenor (integer, months)
- interest_rate (numeric)
- status (enum: 'pending', 'active', 'completed', 'rejected')
- disbursement_date (date, optional)
```

### Tabel Loan Installments
```sql
- id (UUID, primary key)
- loan_id (UUID, foreign key)
- installment_number (integer)
- due_date (date)
- principal_amount (numeric)
- interest_amount (numeric)
- total_amount (numeric)
- paid_amount (numeric, optional)
- paid_date (date, optional)
- status (enum: 'pending', 'paid', 'overdue')
```

### Tabel SHU Records
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key)
- year (integer)
- amount (numeric)
- distributed_at (timestamp)
```

## Membuat Admin Pertama

Untuk membuat admin pertama, gunakan halaman `/setup-admin`:

1. Akses `https://your-domain.com/setup-admin`
2. Masukkan Setup Key yang sudah dikonfigurasi di secrets Supabase
3. Isi data admin (nama, email, password)
4. Klik "Buat Akun Admin"

**Catatan**: Halaman setup admin akan dinonaktifkan setelah admin pertama berhasil dibuat.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Customization

### Pengaturan Koperasi
Sesuaikan pengaturan default di `src/lib/cooperativeSettings.ts`:
- Nama koperasi
- Logo
- Suku bunga pinjaman
- Besaran simpanan
- Dan lainnya

### Tema dan Warna
Sesuaikan tema di `src/index.css` dan `tailwind.config.ts`

## License

MIT License