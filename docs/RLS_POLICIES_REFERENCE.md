# Referensi RLS Policies

Dokumentasi lengkap semua Row Level Security (RLS) policies yang digunakan dalam aplikasi koperasi.

---

## Konsep Dasar

### Apa itu RLS?

Row Level Security (RLS) adalah fitur PostgreSQL yang membatasi akses ke baris data berdasarkan kondisi tertentu. Dengan RLS, setiap query akan otomatis difilter sesuai policy yang ditentukan.

### Mengapa RLS Penting?

1. **Keamanan Data**: User hanya bisa akses data yang diizinkan
2. **Pemisahan Data**: Anggota tidak bisa melihat data anggota lain
3. **Konsistensi**: Aturan akses diterapkan di level database
4. **Defense in Depth**: Lapisan keamanan tambahan selain aplikasi

---

## Helper Functions

### is_admin()

Mengecek apakah user saat ini adalah admin.

```sql
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
```

**Penggunaan:**
```sql
CREATE POLICY "Admin only access"
ON some_table FOR ALL
USING (is_admin());
```

### has_role()

Mengecek apakah user tertentu memiliki role tertentu.

```sql
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

---

## Policies per Tabel

### profiles

**Deskripsi:** Data profil anggota koperasi

```sql
-- User bisa melihat profil sendiri, admin bisa lihat semua
CREATE POLICY "Users can view own profile or admin can view all"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR is_admin());

-- User bisa update profil sendiri
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Hanya admin yang bisa insert (via pendaftaran)
CREATE POLICY "Only admin can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (is_admin());

-- Hanya admin yang bisa delete
CREATE POLICY "Only admin can delete profiles"
ON public.profiles FOR DELETE
USING (is_admin());
```

---

### user_roles

**Deskripsi:** Role pengguna (admin/member)

```sql
-- Authenticated users bisa lihat role sendiri
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR is_admin());

-- Hanya admin dengan permission khusus yang bisa modify
CREATE POLICY "Admin with permission can manage roles"
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

---

### savings_summary

**Deskripsi:** Ringkasan saldo simpanan

```sql
-- User lihat saldo sendiri, admin lihat semua
CREATE POLICY "Users view own savings"
ON public.savings_summary FOR SELECT
USING (user_id = auth.uid() OR is_admin());

-- Hanya system/admin yang bisa update
CREATE POLICY "Only admin can update savings"
ON public.savings_summary FOR UPDATE
USING (is_admin());

-- Insert saat user baru dibuat
CREATE POLICY "System can insert savings"
ON public.savings_summary FOR INSERT
WITH CHECK (true); -- Via trigger
```

---

### transactions

**Deskripsi:** Riwayat transaksi

```sql
-- User lihat transaksi sendiri
CREATE POLICY "Users view own transactions"
ON public.transactions FOR SELECT
USING (user_id = auth.uid() OR is_admin());

-- User bisa buat transaksi sendiri
CREATE POLICY "Users can create own transactions"
ON public.transactions FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admin bisa membuat transaksi untuk anggota (misal: simpanan awal saat approval)
CREATE POLICY "Admins can create transactions for members"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- Hanya admin yang bisa update (approve/reject)
CREATE POLICY "Admins can update transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Tidak ada yang bisa delete transaksi
-- (Tidak ada policy DELETE = tidak bisa delete)
```

> **Catatan Penting (Update Januari 2026):** Policy "Admins can create transactions for members" ditambahkan untuk memungkinkan admin membuat transaksi simpanan awal saat menyetujui pendaftaran anggota baru. Tanpa policy ini, simpanan anggota akan tetap Rp 0 karena RLS memblokir INSERT transaksi oleh admin.

---

### loans

**Deskripsi:** Data pinjaman

```sql
-- User lihat pinjaman sendiri
CREATE POLICY "Users view own loans"
ON public.loans FOR SELECT
USING (user_id = auth.uid() OR is_admin());

-- User bisa ajukan pinjaman
CREATE POLICY "Users can apply for loans"
ON public.loans FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Hanya admin yang bisa update
CREATE POLICY "Only admin can update loans"
ON public.loans FOR UPDATE
USING (is_admin());
```

---

### loan_installments

**Deskripsi:** Jadwal angsuran pinjaman

```sql
-- User lihat angsuran pinjaman sendiri
CREATE POLICY "Users view own installments"
ON public.loan_installments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM loans 
    WHERE loans.id = loan_installments.loan_id 
    AND loans.user_id = auth.uid()
  ) OR is_admin()
);

-- Hanya admin/system yang bisa modify
CREATE POLICY "Only admin can modify installments"
ON public.loan_installments FOR ALL
USING (is_admin());
```

---

### loan_collaterals

**Deskripsi:** Jaminan pinjaman

```sql
-- User lihat jaminan sendiri
CREATE POLICY "Users view own collaterals"
ON public.loan_collaterals FOR SELECT
USING (user_id = auth.uid() OR is_admin());

-- User bisa submit jaminan
CREATE POLICY "Users can submit collaterals"
ON public.loan_collaterals FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admin bisa update status
CREATE POLICY "Admin can update collaterals"
ON public.loan_collaterals FOR UPDATE
USING (is_admin());
```

---

### account_claim_tokens

**Deskripsi:** Token untuk klaim akun migrasi

```sql
-- HANYA service role yang bisa akses
CREATE POLICY "Service role only"
ON public.account_claim_tokens FOR ALL
USING (auth.jwt()->>'role' = 'service_role');
```

> ⚠️ **KRITIS**: Tabel ini TIDAK BOLEH diakses oleh user biasa untuk mencegah enumeration attack.

---

### cooperative_settings

**Deskripsi:** Pengaturan koperasi

```sql
-- Semua authenticated user bisa baca
CREATE POLICY "Authenticated can read settings"
ON public.cooperative_settings FOR SELECT
TO authenticated
USING (true);

-- Anonymous users bisa baca settings untuk landing/registrasi
CREATE POLICY "Anon users can view registration settings"
ON public.cooperative_settings FOR SELECT
TO anon
USING (
  key = ANY (ARRAY[
    'bank_name',
    'bank_account_number', 
    'bank_account_name',
    'simpanan_pokok',
    'simpanan_wajib',
    'cooperative_name',
    'cooperative_address',
    'cooperative_legal_number',
    'cooperative_logo_base64',
    'cooperative_banner_base64',
    'cooperative_vision',
    'cooperative_mission',
    'cooperative_services',
    'cooperative_ad_art_content',
    'contact_phone',
    'logo_frame',
    'logo_size',
    'logo_container_splash',
    'logo_container_header',
    'logo_container_footer',
    'logo_container_card',
    'card_gradient_start',
    'card_gradient_end',
    'card_gradient_direction',
    'enable_branch_feature',
    'branch_terminology'
  ])
);

-- Hanya admin yang bisa modify
CREATE POLICY "Only admin can modify settings"
ON public.cooperative_settings FOR ALL
USING (is_admin());
```

> **Catatan:** Policy untuk `anon` users diperlukan agar halaman landing dan form registrasi bisa menampilkan informasi koperasi sebelum user login.

---

### journal_entries

**Deskripsi:** Jurnal akuntansi

```sql
-- Hanya admin yang bisa akses jurnal
CREATE POLICY "Admin only access"
ON public.journal_entries FOR SELECT
USING (is_admin());

CREATE POLICY "Admin can create journals"
ON public.journal_entries FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admin can update journals"
ON public.journal_entries FOR UPDATE
USING (is_admin());

-- Jurnal tidak boleh dihapus (audit trail)
```

---

### audit_logs

**Deskripsi:** Log audit sistem

```sql
-- Admin bisa lihat semua log
CREATE POLICY "Admin can view audit logs"
ON public.audit_logs FOR SELECT
USING (is_admin());

-- Insert via trigger (SECURITY DEFINER)
CREATE POLICY "System can insert logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- Log tidak boleh diupdate atau dihapus
```

---

### admin_notifications

**Deskripsi:** Notifikasi untuk admin

```sql
-- Hanya admin yang bisa akses
CREATE POLICY "Admin only notifications"
ON public.admin_notifications FOR ALL
USING (is_admin());
```

---

### member_notifications

**Deskripsi:** Notifikasi untuk member

```sql
-- User lihat notifikasi sendiri
CREATE POLICY "Users view own notifications"
ON public.member_notifications FOR SELECT
USING (user_id = auth.uid());

-- User bisa update (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.member_notifications FOR UPDATE
USING (user_id = auth.uid());

-- User bisa delete notifikasi sendiri
CREATE POLICY "Users can delete own notifications"
ON public.member_notifications FOR DELETE
USING (user_id = auth.uid());

-- System/admin bisa insert
CREATE POLICY "Admin can create notifications"
ON public.member_notifications FOR INSERT
WITH CHECK (is_admin() OR auth.jwt()->>'role' = 'service_role');
```

---

### business_unit_transactions

**Deskripsi:** Transaksi unit usaha

```sql
-- User lihat transaksi unit usaha sendiri (jika is_member_transaction)
CREATE POLICY "Users view own business transactions"
ON public.business_unit_transactions FOR SELECT
USING (
  (is_member_transaction = true AND user_id = auth.uid()) 
  OR is_admin()
);

-- Hanya admin yang bisa create/update
CREATE POLICY "Admin can manage business transactions"
ON public.business_unit_transactions FOR ALL
USING (is_admin());
```

---

### shu_distributions

**Deskripsi:** Distribusi SHU ke anggota

```sql
-- User lihat SHU sendiri
CREATE POLICY "Users view own SHU"
ON public.shu_distributions FOR SELECT
USING (user_id = auth.uid() OR is_admin());

-- Hanya admin yang bisa modify
CREATE POLICY "Admin can manage SHU"
ON public.shu_distributions FOR ALL
USING (is_admin());
```

---

### corrections

**Deskripsi:** Koreksi transaksi

```sql
-- User lihat koreksi pada data sendiri
CREATE POLICY "Users view own corrections"
ON public.corrections FOR SELECT
USING (user_id = auth.uid() OR is_admin());

-- Hanya admin yang bisa create/update
CREATE POLICY "Admin can manage corrections"
ON public.corrections FOR ALL
USING (is_admin());
```

---

### overdue_handling

**Deskripsi:** Penanganan keterlambatan pinjaman

```sql
-- User lihat data overdue pinjaman sendiri
CREATE POLICY "Admins and loan owners can view overdue handling"
ON public.overdue_handling FOR SELECT
USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM public.loans 
    WHERE loans.id = overdue_handling.loan_id 
    AND loans.user_id = auth.uid()
  )
);

-- Hanya admin yang bisa modify
CREATE POLICY "Admin can manage overdue handling"
ON public.overdue_handling FOR ALL
USING (is_admin());
```

---

## Verifikasi RLS

### Cek Tabel Tanpa RLS

```sql
-- Harus mengembalikan 0 rows
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false;
```

### Cek Policies per Tabel

```sql
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Test Policy sebagai User

```sql
-- Set context sebagai user tertentu
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claims TO '{"sub": "user-uuid-here"}';

-- Test query
SELECT * FROM profiles;

-- Reset
RESET role;
RESET request.jwt.claims;
```

---

## Best Practices

### 1. Selalu Gunakan auth.uid()

```sql
-- ✅ BENAR
USING (user_id = auth.uid())

-- ❌ SALAH - Hardcoded user
USING (user_id = 'some-uuid')
```

### 2. Gunakan SECURITY DEFINER untuk Helper Functions

```sql
-- ✅ BENAR - Mencegah infinite recursion
CREATE FUNCTION is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
...
```

### 3. Pisahkan SELECT dan MODIFY Policies

```sql
-- ✅ BENAR - Policy terpisah
CREATE POLICY "read" FOR SELECT USING (...);
CREATE POLICY "write" FOR INSERT WITH CHECK (...);
CREATE POLICY "update" FOR UPDATE USING (...);
```

### 4. Jangan Lupa WITH CHECK untuk INSERT/UPDATE

```sql
-- ✅ BENAR
FOR INSERT WITH CHECK (user_id = auth.uid())

-- ❌ SALAH - Hanya USING tidak cukup untuk INSERT
FOR INSERT USING (user_id = auth.uid())
```

### 5. Hindari TRUE untuk Policy Sensitif

```sql
-- ❌ BERBAHAYA untuk data sensitif
USING (true)

-- ✅ BENAR - Spesifik
USING (is_admin() OR user_id = auth.uid())
```

---

## Troubleshooting

### Error: "new row violates row-level security policy"

**Penyebab:** WITH CHECK condition tidak terpenuhi

**Solusi:**
1. Pastikan `user_id` diisi dengan `auth.uid()`
2. Cek apakah user memiliki permission
3. Verify RLS policy sudah benar

### Error: "permission denied for table"

**Penyebab:** Tidak ada policy yang match

**Solusi:**
1. Cek apakah RLS enabled
2. Cek apakah ada policy untuk operasi tersebut
3. Cek role user

### Query Mengembalikan 0 Rows (Padahal Ada Data)

**Penyebab:** Policy terlalu ketat

**Solusi:**
1. Cek policy SELECT
2. Test dengan `is_admin()` untuk verify
3. Cek apakah auth.uid() terisi

---

## Referensi

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers)
