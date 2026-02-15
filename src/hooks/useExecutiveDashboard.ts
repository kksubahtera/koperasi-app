import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateAssetDepreciation, FixedAsset } from './useFixedAssetDepreciation';

export interface KPIData {
  id: string;
  label: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'neutral';
  format: 'currency' | 'percent' | 'number';
  category: 'income' | 'expense' | 'asset' | 'liability' | 'member' | 'loan';
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  category: string;
}

export interface TrendData {
  period: string;
  pendapatan: number;
  biaya: number;
  shu: number;
  simpanan: number;
  pinjaman: number;
}

export interface ExecutiveSummary {
  totalAset: number;
  totalKewajiban: number;
  totalSimpanan: number;
  totalPiutang: number;
  shuBruto: number;
  currentRatio: number;
  nplRatio: number;
  memberCount: number;
  loanCount: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const useExecutiveDashboard = (year: number = new Date().getFullYear()) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ExecutiveSummary>({
    totalAset: 0,
    totalKewajiban: 0,
    totalSimpanan: 0,
    totalPiutang: 0,
    shuBruto: 0,
    currentRatio: 0,
    nplRatio: 0,
    memberCount: 0,
    loanCount: 0,
  });
  const [kpis, setKpis] = useState<KPIData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<TrendData[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const currentYear = year;
      const previousYear = year - 1;
      const currentMonth = new Date().getMonth();

      // Fetch savings summary
      const { data: savings } = await supabase
        .from('savings_summary')
        .select('simpanan_pokok, simpanan_wajib, simpanan_sukarela');
      
      const totalSimpananPokok = savings?.reduce((sum, s) => sum + (s.simpanan_pokok || 0), 0) || 0;
      const totalSimpananWajib = savings?.reduce((sum, s) => sum + (s.simpanan_wajib || 0), 0) || 0;
      const totalSimpananSukarela = savings?.reduce((sum, s) => sum + (s.simpanan_sukarela || 0), 0) || 0;
      const totalSimpanan = totalSimpananPokok + totalSimpananWajib + totalSimpananSukarela;

      // Fetch active loans and calculate receivables
      const { data: activeLoans } = await supabase
        .from('loans')
        .select('id, remaining_principal, status, user_id');
      
      const totalPiutang = activeLoans?.filter(l => l.status === 'active')
        .reduce((sum, l) => sum + (l.remaining_principal || 0), 0) || 0;
      const activeLoansCount = activeLoans?.filter(l => l.status === 'active').length || 0;
      const defaultedLoansCount = activeLoans?.filter(l => l.status === 'defaulted').length || 0;
      const totalLoans = activeLoans?.length || 0;

      // Fetch overdue installments for NPL calculation
      const { data: overdueInstallments } = await supabase
        .from('loan_installments')
        .select('loan_id, total_amount')
        .eq('status', 'overdue');
      
      const overdueAmount = overdueInstallments?.reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0;
      const nplRatio = totalPiutang > 0 ? (overdueAmount / totalPiutang) * 100 : 0;

      // Fetch member count
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, is_active, approval_status');
      
      const activeMembers = profiles?.filter(p => p.is_active && p.approval_status === 'approved').length || 0;
      const pendingMembers = profiles?.filter(p => p.approval_status === 'pending').length || 0;

      // Fetch income entries for current and previous year
      const [currentIncome, previousIncome] = await Promise.all([
        supabase.from('income_entries').select('amount, date').eq('year', currentYear),
        supabase.from('income_entries').select('amount').eq('year', previousYear),
      ]);
      
      const totalIncomeCurrentYear = currentIncome.data?.reduce((sum, i) => sum + i.amount, 0) || 0;
      const totalIncomePreviousYear = previousIncome.data?.reduce((sum, i) => sum + i.amount, 0) || 0;

      // Fetch expense entries for current and previous year
      const [currentExpense, previousExpense] = await Promise.all([
        supabase.from('expense_entries').select('amount, date').eq('year', currentYear),
        supabase.from('expense_entries').select('amount').eq('year', previousYear),
      ]);
      
      const totalExpenseCurrentYear = currentExpense.data?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const totalExpensePreviousYear = previousExpense.data?.reduce((sum, e) => sum + e.amount, 0) || 0;

      // Fetch paid installments for interest income
      const { data: paidInstallments } = await supabase
        .from('loan_installments')
        .select('interest_amount, penalty_amount, paid_date')
        .eq('status', 'paid')
        .gte('paid_date', `${currentYear}-01-01`)
        .lte('paid_date', `${currentYear}-12-31`);
      
      const interestIncome = paidInstallments?.reduce((sum, i) => sum + (i.interest_amount || 0), 0) || 0;
      const penaltyIncome = paidInstallments?.reduce((sum, i) => sum + (i.penalty_amount || 0), 0) || 0;

      // Fetch fixed assets for depreciation
      const { data: fixedAssets } = await supabase
        .from('fixed_assets')
        .select('*')
        .eq('status', 'active');
      
      let totalAsetTetap = 0;
      let totalDepreciation = 0;
      if (fixedAssets) {
        const yearEndDate = new Date(currentYear, 11, 31);
        (fixedAssets as FixedAsset[]).forEach(asset => {
          const dep = calculateAssetDepreciation(asset, yearEndDate);
          totalAsetTetap += asset.acquisition_cost;
          totalDepreciation += dep.accumulatedToDate;
        });
      }
      const netFixedAssets = totalAsetTetap - totalDepreciation;

      // Calculate totals
      const totalPendapatan = totalIncomeCurrentYear + interestIncome + penaltyIncome;
      const shuBruto = totalPendapatan - totalExpenseCurrentYear;
      const previousShu = totalIncomePreviousYear - totalExpensePreviousYear;
      
      const totalAset = totalSimpanan + totalPiutang + netFixedAssets;
      const totalKewajiban = totalSimpananSukarela; // Simplified
      const currentRatio = totalKewajiban > 0 ? (totalSimpanan / totalKewajiban) * 100 : 100;

      // Update summary
      setSummary({
        totalAset,
        totalKewajiban,
        totalSimpanan,
        totalPiutang,
        shuBruto,
        currentRatio,
        nplRatio,
        memberCount: activeMembers,
        loanCount: activeLoansCount,
      });

      // Build KPIs
      const newKpis: KPIData[] = [
        {
          id: 'total-pendapatan',
          label: 'Total Pendapatan',
          value: totalPendapatan,
          previousValue: totalIncomePreviousYear,
          change: totalPendapatan - totalIncomePreviousYear,
          changePercent: totalIncomePreviousYear > 0 ? ((totalPendapatan - totalIncomePreviousYear) / totalIncomePreviousYear) * 100 : 0,
          trend: totalPendapatan >= totalIncomePreviousYear ? 'up' : 'down',
          format: 'currency',
          category: 'income',
        },
        {
          id: 'total-biaya',
          label: 'Total Biaya',
          value: totalExpenseCurrentYear,
          previousValue: totalExpensePreviousYear,
          change: totalExpenseCurrentYear - totalExpensePreviousYear,
          changePercent: totalExpensePreviousYear > 0 ? ((totalExpenseCurrentYear - totalExpensePreviousYear) / totalExpensePreviousYear) * 100 : 0,
          trend: totalExpenseCurrentYear <= totalExpensePreviousYear ? 'up' : 'down', // Lower is better for expenses
          format: 'currency',
          category: 'expense',
        },
        {
          id: 'shu-bruto',
          label: 'SHU Bruto',
          value: shuBruto,
          previousValue: previousShu,
          change: shuBruto - previousShu,
          changePercent: previousShu > 0 ? ((shuBruto - previousShu) / previousShu) * 100 : 0,
          trend: shuBruto >= previousShu ? 'up' : 'down',
          format: 'currency',
          category: 'income',
        },
        {
          id: 'total-simpanan',
          label: 'Total Simpanan',
          value: totalSimpanan,
          previousValue: 0,
          change: 0,
          changePercent: 0,
          trend: 'neutral',
          format: 'currency',
          category: 'asset',
        },
        {
          id: 'total-piutang',
          label: 'Piutang Pinjaman',
          value: totalPiutang,
          previousValue: 0,
          change: 0,
          changePercent: 0,
          trend: 'neutral',
          format: 'currency',
          category: 'asset',
        },
        {
          id: 'npl-ratio',
          label: 'Rasio NPL',
          value: nplRatio,
          previousValue: 0,
          change: 0,
          changePercent: 0,
          trend: nplRatio <= 5 ? 'up' : 'down',
          format: 'percent',
          category: 'loan',
        },
        {
          id: 'member-count',
          label: 'Jumlah Anggota',
          value: activeMembers,
          previousValue: 0,
          change: pendingMembers,
          changePercent: 0,
          trend: 'neutral',
          format: 'number',
          category: 'member',
        },
        {
          id: 'loan-count',
          label: 'Pinjaman Aktif',
          value: activeLoansCount,
          previousValue: defaultedLoansCount,
          change: 0,
          changePercent: 0,
          trend: 'neutral',
          format: 'number',
          category: 'loan',
        },
      ];
      setKpis(newKpis);

      // Build Alerts
      const newAlerts: Alert[] = [];
      
      // NPL Alert
      if (nplRatio > 5) {
        newAlerts.push({
          id: 'npl-high',
          type: nplRatio > 10 ? 'critical' : 'warning',
          title: 'Rasio NPL Tinggi',
          message: `Rasio kredit bermasalah mencapai ${nplRatio.toFixed(2)}%, melebihi batas aman 5%`,
          metric: 'NPL Ratio',
          value: nplRatio,
          threshold: 5,
          category: 'loan',
        });
      }

      // Defaulted loans alert
      if (defaultedLoansCount > 0) {
        newAlerts.push({
          id: 'defaulted-loans',
          type: defaultedLoansCount > 3 ? 'critical' : 'warning',
          title: 'Pinjaman Bermasalah',
          message: `Terdapat ${defaultedLoansCount} pinjaman dengan status bermasalah yang perlu ditindaklanjuti`,
          metric: 'Defaulted Loans',
          value: defaultedLoansCount,
          threshold: 0,
          category: 'loan',
        });
      }

      // Pending members alert
      if (pendingMembers > 0) {
        newAlerts.push({
          id: 'pending-members',
          type: 'info',
          title: 'Pendaftaran Menunggu',
          message: `Ada ${pendingMembers} pendaftaran anggota baru yang menunggu persetujuan`,
          metric: 'Pending Members',
          value: pendingMembers,
          threshold: 0,
          category: 'member',
        });
      }

      // Low SHU alert
      if (shuBruto < 0) {
        newAlerts.push({
          id: 'negative-shu',
          type: 'critical',
          title: 'SHU Negatif',
          message: `Koperasi mengalami kerugian. SHU Bruto: Rp ${Math.abs(shuBruto).toLocaleString('id-ID')}`,
          metric: 'SHU Bruto',
          value: shuBruto,
          threshold: 0,
          category: 'income',
        });
      } else if (shuBruto < previousShu * 0.8 && previousShu > 0) {
        newAlerts.push({
          id: 'shu-decline',
          type: 'warning',
          title: 'Penurunan SHU',
          message: `SHU menurun ${((1 - shuBruto / previousShu) * 100).toFixed(1)}% dibanding tahun lalu`,
          metric: 'SHU Trend',
          value: shuBruto,
          threshold: previousShu * 0.8,
          category: 'income',
        });
      }

      // Overdue installments alert
      if (overdueInstallments && overdueInstallments.length > 0) {
        newAlerts.push({
          id: 'overdue-installments',
          type: overdueInstallments.length > 10 ? 'critical' : 'warning',
          title: 'Angsuran Tertunggak',
          message: `Terdapat ${overdueInstallments.length} angsuran yang melewati jatuh tempo senilai Rp ${overdueAmount.toLocaleString('id-ID')}`,
          metric: 'Overdue Count',
          value: overdueInstallments.length,
          threshold: 0,
          category: 'loan',
        });
      }

      setAlerts(newAlerts);

      // Build monthly trends
      const trends: TrendData[] = MONTH_NAMES.slice(0, currentMonth + 1).map((month, idx) => {
        const monthIncome = currentIncome.data?.filter(e => new Date(e.date).getMonth() === idx)
          .reduce((sum, e) => sum + e.amount, 0) || 0;
        const monthExpense = currentExpense.data?.filter(e => new Date(e.date).getMonth() === idx)
          .reduce((sum, e) => sum + e.amount, 0) || 0;
        
        return {
          period: month,
          pendapatan: monthIncome,
          biaya: monthExpense,
          shu: monthIncome - monthExpense,
          simpanan: Math.round(totalSimpanan * ((idx + 1) / 12)),
          pinjaman: Math.round(totalPiutang * ((idx + 1) / 12)),
        };
      });
      setMonthlyTrends(trends);

    } catch (error) {
      console.error('Error fetching executive dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const criticalAlerts = useMemo(() => alerts.filter(a => a.type === 'critical'), [alerts]);
  const warningAlerts = useMemo(() => alerts.filter(a => a.type === 'warning'), [alerts]);
  const infoAlerts = useMemo(() => alerts.filter(a => a.type === 'info'), [alerts]);

  return {
    loading,
    summary,
    kpis,
    alerts,
    criticalAlerts,
    warningAlerts,
    infoAlerts,
    monthlyTrends,
    refetch: fetchData,
  };
};
