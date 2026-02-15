import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FinancialRatios {
  // Rasio Likuiditas
  currentRatio: number;
  quickRatio: number;
  cashRatio: number;
  
  // Rasio Profitabilitas
  roa: number; // Return on Assets
  roe: number; // Return on Equity
  netProfitMargin: number;
  
  // Rasio Kualitas Aset
  npl: number; // Non-Performing Loan
  nplCoverage: number;
  
  // Rasio Solvabilitas
  debtToEquityRatio: number;
  debtToAssetRatio: number;
  
  // Rasio Aktivitas
  loanToDepositRatio: number; // LDR
  savingsGrowthRate: number;
  memberGrowthRate: number;
}

export interface RatioCategory {
  name: string;
  ratios: RatioItem[];
}

export interface RatioItem {
  name: string;
  value: number;
  unit: string;
  benchmark: string;
  status: 'excellent' | 'good' | 'warning' | 'danger';
  description: string;
}

export const useFinancialRatios = (year: number) => {
  const [ratios, setRatios] = useState<FinancialRatios | null>(null);
  const [loading, setLoading] = useState(true);
  const [previousYearData, setPreviousYearData] = useState<{
    totalSavings: number;
    memberCount: number;
  } | null>(null);

  const calculateRatios = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all required data in parallel
      const [
        savingsRes,
        loansRes,
        installmentsRes,
        profilesRes,
        incomeRes,
        expenseRes,
        balanceSheetRes,
        prevYearSavingsRes,
        prevYearProfilesRes
      ] = await Promise.all([
        // Current year data
        supabase.from('savings_summary').select('*'),
        supabase.from('loans').select('*'),
        supabase.from('loan_installments').select('*'),
        supabase.from('profiles').select('*').eq('is_active', true),
        supabase.from('income_entries').select('amount').eq('year', year),
        supabase.from('expense_entries').select('amount').eq('year', year),
        supabase.from('balance_sheets').select('*').eq('year', year).maybeSingle(),
        // Previous year for growth calculations
        supabase.from('savings_summary').select('total_simpanan'),
        supabase.from('profiles').select('id').eq('is_active', true)
      ]);

      const savings = savingsRes.data || [];
      const loans = loansRes.data || [];
      const installments = installmentsRes.data || [];
      const profiles = profilesRes.data || [];
      const incomeEntries = incomeRes.data || [];
      const expenseEntries = expenseRes.data || [];
      const balanceSheet = balanceSheetRes.data;

      // Calculate totals
      const totalSimpananPokok = savings.reduce((sum, s) => sum + (s.simpanan_pokok || 0), 0);
      const totalSimpananWajib = savings.reduce((sum, s) => sum + (s.simpanan_wajib || 0), 0);
      const totalSimpananSukarela = savings.reduce((sum, s) => sum + (s.simpanan_sukarela || 0), 0);
      const totalSavings = totalSimpananPokok + totalSimpananWajib + totalSimpananSukarela;

      // Loan calculations
      const activeLoans = loans.filter(l => l.status === 'active');
      const totalLoanPrincipal = activeLoans.reduce((sum, l) => sum + (l.principal_amount || 0), 0);
      const totalRemainingPrincipal = activeLoans.reduce((sum, l) => sum + (l.remaining_principal || l.principal_amount || 0), 0);

      // NPL Calculation - loans with overdue installments
      const overdueInstallments = installments.filter(i => i.status === 'overdue');
      const loansWithOverdue = new Set(overdueInstallments.map(i => i.loan_id));
      const nplLoans = activeLoans.filter(l => loansWithOverdue.has(l.id));
      const nplAmount = nplLoans.reduce((sum, l) => sum + (l.remaining_principal || l.principal_amount || 0), 0);

      // Income and Expense
      const totalIncome = incomeEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalExpense = expenseEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
      const netIncome = totalIncome - totalExpense;

      // Calculate interest income from paid installments
      const paidInstallments = installments.filter(i => i.status === 'paid');
      const interestIncome = paidInstallments.reduce((sum, i) => sum + (i.interest_amount || 0), 0);

      // Assets calculation
      const kas = balanceSheet?.kas || 0;
      const bank = balanceSheet?.bank || 0;
      const piutang = totalRemainingPrincipal; // Outstanding loans as receivables
      const currentAssets = kas + bank + piutang;
      const totalAssets = currentAssets + (balanceSheet?.barang_dagang || 0) + (balanceSheet?.surat_berharga || 0);

      // Liabilities calculation
      const currentLiabilities = totalSimpananSukarela; // Short-term savings that can be withdrawn
      const totalLiabilities = totalSavings; // All member savings are liabilities to coop

      // Equity calculation
      const danaCadangan = balanceSheet?.dana_cadangan || 0;
      const modalPenyertaan = balanceSheet?.modal_penyertaan || 0;
      const hibahDonasi = balanceSheet?.hibah_donasi || 0;
      const totalEquity = danaCadangan + modalPenyertaan + hibahDonasi + netIncome;

      // Previous year data for growth calculations
      const prevTotalSavings = (prevYearSavingsRes.data || []).reduce((sum, s) => sum + (s.total_simpanan || 0), 0);
      const prevMemberCount = (prevYearProfilesRes.data || []).length;
      const currentMemberCount = profiles.length;

      // Calculate all ratios
      const calculatedRatios: FinancialRatios = {
        // Liquidity Ratios
        currentRatio: currentLiabilities > 0 ? (currentAssets / currentLiabilities) * 100 : 0,
        quickRatio: currentLiabilities > 0 ? ((kas + bank) / currentLiabilities) * 100 : 0,
        cashRatio: currentLiabilities > 0 ? ((kas + bank) / currentLiabilities) * 100 : 0,

        // Profitability Ratios
        roa: totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0,
        roe: totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0,
        netProfitMargin: totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0,

        // Asset Quality Ratios
        npl: totalRemainingPrincipal > 0 ? (nplAmount / totalRemainingPrincipal) * 100 : 0,
        nplCoverage: nplAmount > 0 ? (danaCadangan / nplAmount) * 100 : 0,

        // Solvency Ratios
        debtToEquityRatio: totalEquity > 0 ? (totalLiabilities / totalEquity) * 100 : 0,
        debtToAssetRatio: totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0,

        // Activity Ratios
        loanToDepositRatio: totalSavings > 0 ? (totalRemainingPrincipal / totalSavings) * 100 : 0,
        savingsGrowthRate: prevTotalSavings > 0 ? ((totalSavings - prevTotalSavings) / prevTotalSavings) * 100 : 0,
        memberGrowthRate: prevMemberCount > 0 ? ((currentMemberCount - prevMemberCount) / prevMemberCount) * 100 : 0,
      };

      setRatios(calculatedRatios);
      setPreviousYearData({ totalSavings: prevTotalSavings, memberCount: prevMemberCount });
    } catch (error) {
      console.error('Error calculating financial ratios:', error);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    calculateRatios();
  }, [calculateRatios]);

  // Format ratios into categories for display
  const ratioCategories = useMemo((): RatioCategory[] => {
    if (!ratios) return [];

    return [
      {
        name: 'Rasio Likuiditas',
        ratios: [
          {
            name: 'Current Ratio',
            value: ratios.currentRatio,
            unit: '%',
            benchmark: '≥ 200%',
            status: ratios.currentRatio >= 200 ? 'excellent' : ratios.currentRatio >= 150 ? 'good' : ratios.currentRatio >= 100 ? 'warning' : 'danger',
            description: 'Kemampuan koperasi memenuhi kewajiban jangka pendek dengan aset lancar'
          },
          {
            name: 'Quick Ratio',
            value: ratios.quickRatio,
            unit: '%',
            benchmark: '≥ 100%',
            status: ratios.quickRatio >= 100 ? 'excellent' : ratios.quickRatio >= 75 ? 'good' : ratios.quickRatio >= 50 ? 'warning' : 'danger',
            description: 'Kemampuan membayar kewajiban jangka pendek dengan kas dan setara kas'
          },
          {
            name: 'Cash Ratio',
            value: ratios.cashRatio,
            unit: '%',
            benchmark: '≥ 50%',
            status: ratios.cashRatio >= 50 ? 'excellent' : ratios.cashRatio >= 30 ? 'good' : ratios.cashRatio >= 20 ? 'warning' : 'danger',
            description: 'Perbandingan kas dan setara kas terhadap kewajiban lancar'
          }
        ]
      },
      {
        name: 'Rasio Profitabilitas',
        ratios: [
          {
            name: 'Return on Assets (ROA)',
            value: ratios.roa,
            unit: '%',
            benchmark: '≥ 3%',
            status: ratios.roa >= 5 ? 'excellent' : ratios.roa >= 3 ? 'good' : ratios.roa >= 1 ? 'warning' : 'danger',
            description: 'Kemampuan menghasilkan laba dari total aset yang dimiliki'
          },
          {
            name: 'Return on Equity (ROE)',
            value: ratios.roe,
            unit: '%',
            benchmark: '≥ 10%',
            status: ratios.roe >= 15 ? 'excellent' : ratios.roe >= 10 ? 'good' : ratios.roe >= 5 ? 'warning' : 'danger',
            description: 'Kemampuan menghasilkan laba dari modal sendiri'
          },
          {
            name: 'Net Profit Margin',
            value: ratios.netProfitMargin,
            unit: '%',
            benchmark: '≥ 10%',
            status: ratios.netProfitMargin >= 15 ? 'excellent' : ratios.netProfitMargin >= 10 ? 'good' : ratios.netProfitMargin >= 5 ? 'warning' : 'danger',
            description: 'Persentase laba bersih dari total pendapatan'
          }
        ]
      },
      {
        name: 'Rasio Kualitas Aset',
        ratios: [
          {
            name: 'Non-Performing Loan (NPL)',
            value: ratios.npl,
            unit: '%',
            benchmark: '≤ 5%',
            status: ratios.npl <= 2 ? 'excellent' : ratios.npl <= 5 ? 'good' : ratios.npl <= 8 ? 'warning' : 'danger',
            description: 'Persentase pinjaman bermasalah dari total pinjaman'
          },
          {
            name: 'NPL Coverage',
            value: ratios.nplCoverage,
            unit: '%',
            benchmark: '≥ 100%',
            status: ratios.nplCoverage >= 150 ? 'excellent' : ratios.nplCoverage >= 100 ? 'good' : ratios.nplCoverage >= 50 ? 'warning' : 'danger',
            description: 'Kemampuan dana cadangan menutup pinjaman bermasalah'
          }
        ]
      },
      {
        name: 'Rasio Solvabilitas',
        ratios: [
          {
            name: 'Debt to Equity Ratio',
            value: ratios.debtToEquityRatio,
            unit: '%',
            benchmark: '≤ 800%',
            status: ratios.debtToEquityRatio <= 400 ? 'excellent' : ratios.debtToEquityRatio <= 800 ? 'good' : ratios.debtToEquityRatio <= 1000 ? 'warning' : 'danger',
            description: 'Perbandingan total hutang terhadap modal sendiri'
          },
          {
            name: 'Debt to Asset Ratio',
            value: ratios.debtToAssetRatio,
            unit: '%',
            benchmark: '≤ 80%',
            status: ratios.debtToAssetRatio <= 60 ? 'excellent' : ratios.debtToAssetRatio <= 80 ? 'good' : ratios.debtToAssetRatio <= 90 ? 'warning' : 'danger',
            description: 'Persentase aset yang dibiayai oleh hutang'
          }
        ]
      },
      {
        name: 'Rasio Aktivitas',
        ratios: [
          {
            name: 'Loan to Deposit Ratio (LDR)',
            value: ratios.loanToDepositRatio,
            unit: '%',
            benchmark: '78-92%',
            status: ratios.loanToDepositRatio >= 78 && ratios.loanToDepositRatio <= 92 ? 'excellent' : 
                   (ratios.loanToDepositRatio >= 70 && ratios.loanToDepositRatio < 78) || (ratios.loanToDepositRatio > 92 && ratios.loanToDepositRatio <= 100) ? 'good' :
                   ratios.loanToDepositRatio < 70 || ratios.loanToDepositRatio > 100 ? 'warning' : 'danger',
            description: 'Perbandingan total pinjaman yang diberikan terhadap simpanan'
          },
          {
            name: 'Pertumbuhan Simpanan',
            value: ratios.savingsGrowthRate,
            unit: '%',
            benchmark: '≥ 10%',
            status: ratios.savingsGrowthRate >= 15 ? 'excellent' : ratios.savingsGrowthRate >= 10 ? 'good' : ratios.savingsGrowthRate >= 5 ? 'warning' : 'danger',
            description: 'Tingkat pertumbuhan simpanan dibanding tahun sebelumnya'
          },
          {
            name: 'Pertumbuhan Anggota',
            value: ratios.memberGrowthRate,
            unit: '%',
            benchmark: '≥ 5%',
            status: ratios.memberGrowthRate >= 10 ? 'excellent' : ratios.memberGrowthRate >= 5 ? 'good' : ratios.memberGrowthRate >= 0 ? 'warning' : 'danger',
            description: 'Tingkat pertumbuhan jumlah anggota aktif'
          }
        ]
      }
    ];
  }, [ratios]);

  // Calculate overall health score
  const healthScore = useMemo(() => {
    if (!ratios) return 0;
    
    let score = 0;
    let totalWeight = 0;

    // Weighted scoring based on ratio importance
    const scoring = [
      { value: ratios.currentRatio >= 200, weight: 10 },
      { value: ratios.roa >= 3, weight: 15 },
      { value: ratios.roe >= 10, weight: 15 },
      { value: ratios.npl <= 5, weight: 20 },
      { value: ratios.debtToEquityRatio <= 800, weight: 10 },
      { value: ratios.loanToDepositRatio >= 70 && ratios.loanToDepositRatio <= 100, weight: 15 },
      { value: ratios.savingsGrowthRate >= 5, weight: 10 },
      { value: ratios.memberGrowthRate >= 0, weight: 5 },
    ];

    scoring.forEach(item => {
      totalWeight += item.weight;
      if (item.value) score += item.weight;
    });

    return Math.round((score / totalWeight) * 100);
  }, [ratios]);

  const healthStatus = useMemo(() => {
    if (healthScore >= 80) return { label: 'Sangat Sehat', color: 'text-green-500' };
    if (healthScore >= 60) return { label: 'Sehat', color: 'text-blue-500' };
    if (healthScore >= 40) return { label: 'Cukup Sehat', color: 'text-yellow-500' };
    return { label: 'Kurang Sehat', color: 'text-red-500' };
  }, [healthScore]);

  return {
    ratios,
    ratioCategories,
    healthScore,
    healthStatus,
    loading,
    refetch: calculateRatios
  };
};
