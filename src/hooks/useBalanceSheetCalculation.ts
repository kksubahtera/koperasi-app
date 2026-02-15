import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BalanceSheet } from '@/lib/cooperativeSettings';
import { toast } from 'sonner';
import { calculateAssetDepreciation } from './useFixedAssetDepreciation';

export interface BalanceSheetCalculation extends BalanceSheet {
  isCalculated: boolean;
  // Fixed Assets
  asetTetap?: number;
  akumulasiPenyusutan?: number;
  nilaiAsetTetapBersih?: number;
  totalAset?: number;
}

/**
 * Hook untuk menghitung Neraca Keuangan secara otomatis dari data transaksi
 * 
 * Rumus:
 * - Piutang Usaha = Σ(sisa pokok pinjaman aktif)
 * - Simpanan = Σ(savings_summary semua anggota)
 * - Dana Cadangan = dari shu_distributions tahun sebelumnya
 * - Kas/Bank = Total Harta - Piutang + Pendapatan
 * - Total Aset Lancar = Kas/Bank + Piutang
 * - Aset Tetap = Σ(harga perolehan aset aktif)
 * - Akumulasi Penyusutan = Σ(penyusutan aset aktif sampai saat ini)
 * - Nilai Buku Aset Tetap = Aset Tetap - Akumulasi Penyusutan
 * - Total Aset = Total Aset Lancar + Nilai Buku Aset Tetap
 */
export const useBalanceSheetCalculation = (year: number) => {
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetCalculation | null>(null);
  const [previousYearSheet, setPreviousYearSheet] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateBalanceSheet = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const prevStartDate = `${year - 1}-01-01`;
      const prevEndDate = `${year - 1}-12-31`;

      // 1. Fetch total savings (Simpanan Pokok, Wajib, Sukarela)
      const { data: savingsData } = await supabase
        .from('savings_summary')
        .select('simpanan_pokok, simpanan_wajib, simpanan_sukarela');

      const totalSimpananPokok = savingsData?.reduce((sum, s) => sum + (s.simpanan_pokok || 0), 0) || 0;
      const totalSimpananWajib = savingsData?.reduce((sum, s) => sum + (s.simpanan_wajib || 0), 0) || 0;
      const totalSimpananSukarela = savingsData?.reduce((sum, s) => sum + (s.simpanan_sukarela || 0), 0) || 0;

      // 2. Fetch previous year transactions for saldo awal
      const { data: prevYearTransactions } = await supabase
        .from('transactions')
        .select('type, amount, status')
        .eq('status', 'approved')
        .lt('date', startDate);

      let saldoAwalPokok = 0, saldoAwalWajib = 0, saldoAwalSukarela = 0;
      prevYearTransactions?.forEach(t => {
        if (t.type === 'simpanan_pokok') saldoAwalPokok += t.amount;
        if (t.type === 'simpanan_wajib' || t.type === 'setor_simpanan_wajib') saldoAwalWajib += t.amount;
        if (t.type === 'simpanan_sukarela' || t.type === 'setor_simpanan_sukarela') saldoAwalSukarela += t.amount;
        if (t.type === 'penarikan_simpanan_sukarela') saldoAwalSukarela -= t.amount;
      });

      // 3. Fetch current year transactions for penambahan/pengurangan
      const { data: currentYearTransactions } = await supabase
        .from('transactions')
        .select('type, amount, status')
        .eq('status', 'approved')
        .gte('date', startDate)
        .lte('date', endDate);

      let penambahanPokok = 0, penambahanWajib = 0, penambahanSukarela = 0;
      let penguranganPokok = 0, penguranganWajib = 0, penguranganSukarela = 0;

      currentYearTransactions?.forEach(t => {
        if (t.type === 'simpanan_pokok') penambahanPokok += t.amount;
        if (t.type === 'simpanan_wajib' || t.type === 'setor_simpanan_wajib') penambahanWajib += t.amount;
        if (t.type === 'simpanan_sukarela' || t.type === 'setor_simpanan_sukarela') penambahanSukarela += t.amount;
        if (t.type === 'penarikan_simpanan_sukarela') penguranganSukarela += t.amount;
      });

      // 4. Fetch active loans for piutang (remaining principal)
      const { data: activeLoans } = await supabase
        .from('loans')
        .select('remaining_principal')
        .eq('status', 'active');

      const piutangUsaha = activeLoans?.reduce((sum, l) => sum + (l.remaining_principal || 0), 0) || 0;

      // 5. Fetch fixed assets for aset tetap calculation
      const { data: fixedAssetsData } = await supabase
        .from('fixed_assets')
        .select('*')
        .eq('status', 'active');

      // Calculate fixed assets totals with depreciation
      let totalAsetTetap = 0;
      let totalAkumulasiPenyusutan = 0;
      const currentDate = new Date();

      fixedAssetsData?.forEach((asset: any) => {
        totalAsetTetap += asset.acquisition_cost || 0;
        
        // Calculate depreciation using the helper function
        const depreciation = calculateAssetDepreciation({
          id: asset.id,
          asset_code: asset.asset_code,
          asset_name: asset.asset_name,
          category: asset.category,
          acquisition_date: asset.acquisition_date,
          acquisition_cost: asset.acquisition_cost,
          useful_life_months: asset.useful_life_months,
          depreciation_method: asset.depreciation_method,
          accumulated_depreciation: asset.accumulated_depreciation,
          current_value: asset.current_value,
          status: asset.status,
          location: asset.location,
          created_at: asset.created_at,
          updated_at: asset.updated_at
        }, currentDate);
        
        totalAkumulasiPenyusutan += depreciation.accumulatedToDate;
      });

      const nilaiAsetTetapBersih = totalAsetTetap - totalAkumulasiPenyusutan;

      // 5. Fetch paid installments for income (bunga + denda)
      const { data: paidInstallments } = await supabase
        .from('loan_installments')
        .select('interest_amount, penalty_amount, paid_date')
        .eq('status', 'paid')
        .gte('paid_date', startDate)
        .lte('paid_date', endDate);

      const pendapatanBungaPinjaman = paidInstallments?.reduce((sum, i) => sum + (i.interest_amount || 0), 0) || 0;
      const pendapatanDenda = paidInstallments?.reduce((sum, i) => sum + (i.penalty_amount || 0), 0) || 0;

      // 6. Fetch Dana Cadangan from previous SHU distributions
      const { data: prevSHU } = await supabase
        .from('shu_distributions')
        .select('dana_cadangan')
        .eq('status', 'confirmed')
        .lt('year', year);

      const saldoAwalDanaCadangan = prevSHU?.reduce((sum, s) => sum + (s.dana_cadangan || 0), 0) || 0;

      // 7. Fetch current year SHU distribution for dana cadangan
      const { data: currentSHU } = await supabase
        .from('shu_distributions')
        .select('dana_cadangan')
        .eq('year', year)
        .eq('status', 'confirmed')
        .maybeSingle();

      const penambahanDanaCadangan = currentSHU?.dana_cadangan || 0;

      // 8. Fetch balance sheet from database for manual entries
      const { data: savedSheet } = await supabase
        .from('balance_sheets')
        .select('*')
        .eq('year', year)
        .maybeSingle();

      // Manual entries from saved balance sheet
      const hibahDonasi = savedSheet?.hibah_donasi || 0;
      const saldoAwalHibahDonasi = savedSheet?.saldo_awal_hibah_donasi || 0;
      const penambahanHibahDonasi = savedSheet?.penambahan_hibah_donasi || 0;
      const penguranganHibahDonasi = savedSheet?.pengurangan_hibah_donasi || 0;

      const modalPenyertaan = savedSheet?.modal_penyertaan || 0;
      const saldoAwalModalPenyertaan = savedSheet?.saldo_awal_modal_penyertaan || 0;
      const penambahanModalPenyertaan = savedSheet?.penambahan_modal_penyertaan || 0;
      const penguranganModalPenyertaan = savedSheet?.pengurangan_modal_penyertaan || 0;

      // Pinjaman Diterima (using modal_pinjaman column)
      const pinjamanDiterima = savedSheet?.modal_pinjaman || 0;
      const saldoAwalPinjamanDiterima = savedSheet?.saldo_awal_modal_pinjaman || 0;
      const penambahanPinjamanDiterima = savedSheet?.penambahan_modal_pinjaman || 0;
      const penguranganPinjamanDiterima = savedSheet?.pengurangan_modal_pinjaman || 0;

      // Calculate totals
      const totalSaldoAwal = saldoAwalPokok + saldoAwalWajib + saldoAwalSukarela + 
                            saldoAwalDanaCadangan + saldoAwalHibahDonasi + 
                            saldoAwalPinjamanDiterima + saldoAwalModalPenyertaan;

      const totalPenambahan = penambahanPokok + penambahanWajib + penambahanSukarela + 
                             penambahanDanaCadangan + penambahanHibahDonasi + 
                             penambahanPinjamanDiterima + penambahanModalPenyertaan;

      const totalPengurangan = penguranganPokok + penguranganWajib + penguranganSukarela + 
                              0 + penguranganHibahDonasi + 
                              penguranganPinjamanDiterima + penguranganModalPenyertaan;

      const totalHartaKoperasi = totalSimpananPokok + totalSimpananWajib + totalSimpananSukarela + 
                                 saldoAwalDanaCadangan + penambahanDanaCadangan + 
                                 hibahDonasi + pinjamanDiterima + modalPenyertaan;

      // Kas/Bank = Total Harta - Piutang + Pendapatan
      const kasBank = totalHartaKoperasi - piutangUsaha + pendapatanBungaPinjaman + pendapatanDenda;
      const totalAsetLancar = kasBank + piutangUsaha;

      // Total Aset = Aset Lancar + Nilai Buku Aset Tetap
      const totalAset = totalAsetLancar + nilaiAsetTetapBersih;

      const calculatedSheet: BalanceSheetCalculation = {
        year,
        isCalculated: true,
        
        // Aset Lancar
        kasBank,
        piutangUsaha,
        totalAsetLancar,
        
        // Aset Tetap
        asetTetap: totalAsetTetap,
        akumulasiPenyusutan: totalAkumulasiPenyusutan,
        nilaiAsetTetapBersih,
        totalAset,
        
        // Pendapatan
        pendapatanBungaPinjaman,
        pendapatanDenda,
        
        // Simpanan Pokok
        simpananPokok: totalSimpananPokok,
        saldoAwalSimpananPokok: saldoAwalPokok,
        penambahanSimpananPokok: penambahanPokok,
        penguranganSimpananPokok: penguranganPokok,
        
        // Simpanan Wajib
        simpananWajib: totalSimpananWajib,
        saldoAwalSimpananWajib: saldoAwalWajib,
        penambahanSimpananWajib: penambahanWajib,
        penguranganSimpananWajib: penguranganWajib,
        
        // Simpanan Sukarela
        simpananSukarela: totalSimpananSukarela,
        saldoAwalSimpananSukarela: saldoAwalSukarela,
        penambahanSimpananSukarela: penambahanSukarela,
        penguranganSimpananSukarela: penguranganSukarela,
        
        // Dana Cadangan
        danaCadangan: saldoAwalDanaCadangan + penambahanDanaCadangan,
        saldoAwalDanaCadangan,
        penambahanDanaCadangan,
        penguranganDanaCadangan: 0,
        
        // Hibah/Donasi
        hibahDonasi,
        saldoAwalHibahDonasi,
        penambahanHibahDonasi,
        penguranganHibahDonasi,
        
        // Pinjaman Diterima
        pinjamanDiterima,
        saldoAwalPinjamanDiterima,
        penambahanPinjamanDiterima,
        penguranganPinjamanDiterima,
        
        // Modal Penyertaan
        modalPenyertaan,
        saldoAwalModalPenyertaan,
        penambahanModalPenyertaan,
        penguranganModalPenyertaan,
        
        // Totals
        totalHartaKoperasi: totalHartaKoperasi + nilaiAsetTetapBersih,
        totalSaldoAwal,
        totalPenambahan,
        totalPengurangan,
      };

      setBalanceSheet(calculatedSheet);
    } catch (error) {
      console.error('Error calculating balance sheet:', error);
      toast.error('Gagal menghitung neraca');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    calculateBalanceSheet();
  }, [calculateBalanceSheet]);

  const saveManualEntries = async (manualData: {
    hibahDonasi?: { saldoAwal: number; penambahan: number; pengurangan: number };
    pinjamanDiterima?: { saldoAwal: number; penambahan: number; pengurangan: number };
    modalPenyertaan?: { saldoAwal: number; penambahan: number; pengurangan: number };
  }) => {
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('balance_sheets')
        .select('id')
        .eq('year', year)
        .maybeSingle();

      const updateData: {
        year: number;
        saldo_awal_hibah_donasi?: number;
        penambahan_hibah_donasi?: number;
        pengurangan_hibah_donasi?: number;
        hibah_donasi?: number;
        saldo_awal_modal_pinjaman?: number;
        penambahan_modal_pinjaman?: number;
        pengurangan_modal_pinjaman?: number;
        modal_pinjaman?: number;
        saldo_awal_modal_penyertaan?: number;
        penambahan_modal_penyertaan?: number;
        pengurangan_modal_penyertaan?: number;
        modal_penyertaan?: number;
      } = { year };
      
      if (manualData.hibahDonasi) {
        updateData.saldo_awal_hibah_donasi = manualData.hibahDonasi.saldoAwal;
        updateData.penambahan_hibah_donasi = manualData.hibahDonasi.penambahan;
        updateData.pengurangan_hibah_donasi = manualData.hibahDonasi.pengurangan;
        updateData.hibah_donasi = manualData.hibahDonasi.saldoAwal + manualData.hibahDonasi.penambahan - manualData.hibahDonasi.pengurangan;
      }
      
      if (manualData.pinjamanDiterima) {
        updateData.saldo_awal_modal_pinjaman = manualData.pinjamanDiterima.saldoAwal;
        updateData.penambahan_modal_pinjaman = manualData.pinjamanDiterima.penambahan;
        updateData.pengurangan_modal_pinjaman = manualData.pinjamanDiterima.pengurangan;
        updateData.modal_pinjaman = manualData.pinjamanDiterima.saldoAwal + manualData.pinjamanDiterima.penambahan - manualData.pinjamanDiterima.pengurangan;
      }
      
      if (manualData.modalPenyertaan) {
        updateData.saldo_awal_modal_penyertaan = manualData.modalPenyertaan.saldoAwal;
        updateData.penambahan_modal_penyertaan = manualData.modalPenyertaan.penambahan;
        updateData.pengurangan_modal_penyertaan = manualData.modalPenyertaan.pengurangan;
        updateData.modal_penyertaan = manualData.modalPenyertaan.saldoAwal + manualData.modalPenyertaan.penambahan - manualData.modalPenyertaan.pengurangan;
      }

      let error;
      if (existing) {
        const result = await supabase
          .from('balance_sheets')
          .update(updateData)
          .eq('year', year);
        error = result.error;
      } else {
        const result = await supabase
          .from('balance_sheets')
          .insert([updateData]);
        error = result.error;
      }

      if (error) throw error;
      
      toast.success('Data manual berhasil disimpan');
      await calculateBalanceSheet();
    } catch (error) {
      console.error('Error saving manual entries:', error);
      toast.error('Gagal menyimpan data manual');
    }
  };

  return {
    balanceSheet,
    loading,
    refetch: calculateBalanceSheet,
    saveManualEntries,
  };
};
