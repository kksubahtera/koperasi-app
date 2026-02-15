import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CashFlowItem {
  id: string;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: 'operating' | 'investing' | 'financing';
  date: string;
  source: 'transaction' | 'loan' | 'installment' | 'journal' | 'manual';
  referenceId?: string;
  memberName?: string;
}

export interface CashFlowCategory {
  items: CashFlowItem[];
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
}

export interface CashFlowSummary {
  operating: CashFlowCategory;
  investing: CashFlowCategory;
  financing: CashFlowCategory;
  openingBalance: number;
  closingBalance: number;
  netCashFlow: number;
}

export const useCashFlowCalculation = (year: number) => {
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
  const [cashFlowItems, setCashFlowItems] = useState<CashFlowItem[]>([]);
  const [loading, setLoading] = useState(true);

  const calculateCashFlow = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const prevYearEnd = `${year - 1}-12-31`;

      // Fetch all required data in parallel
      const [
        transactionsRes,
        loansRes,
        installmentsRes,
        profilesRes,
        incomeRes,
        expenseRes,
        balanceSheetRes,
        prevBalanceSheetRes
      ] = await Promise.all([
        // Approved transactions within the year
        supabase
          .from('transactions')
          .select('*, profiles:user_id(name)')
          .eq('status', 'approved')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true }),
        
        // Active and completed loans with disbursement in the year
        supabase
          .from('loans')
          .select('*, profiles:user_id(name)')
          .in('status', ['active', 'completed'])
          .gte('disbursement_date', startDate)
          .lte('disbursement_date', endDate),
        
        // Paid installments within the year
        supabase
          .from('loan_installments')
          .select('*, loans!inner(user_id, profiles:user_id(name))')
          .eq('status', 'paid')
          .gte('paid_date', startDate)
          .lte('paid_date', endDate),
        
        // Profiles for member names
        supabase.from('profiles').select('user_id, name'),
        
        // Income entries for the year
        supabase
          .from('income_entries')
          .select('*')
          .eq('year', year),
        
        // Expense entries for the year
        supabase
          .from('expense_entries')
          .select('*')
          .eq('year', year),
        
        // Current year balance sheet for cash/bank opening
        supabase
          .from('balance_sheets')
          .select('kas, bank')
          .eq('year', year)
          .maybeSingle(),
        
        // Previous year balance sheet for opening balance
        supabase
          .from('balance_sheets')
          .select('kas, bank')
          .eq('year', year - 1)
          .maybeSingle()
      ]);

      const transactions = transactionsRes.data || [];
      const loans = loansRes.data || [];
      const installments = installmentsRes.data || [];
      const profiles = profilesRes.data || [];
      const incomeEntries = incomeRes.data || [];
      const expenseEntries = expenseRes.data || [];
      const currentBS = balanceSheetRes.data;
      const prevBS = prevBalanceSheetRes.data;

      // Helper to get member name
      const getMemberName = (userId: string): string => {
        const profile = profiles.find(p => p.user_id === userId);
        return profile?.name || 'Anggota';
      };

      const items: CashFlowItem[] = [];

      // ===== FINANCING ACTIVITIES =====
      // 1. Simpanan Pokok - New member deposits (inflow)
      transactions
        .filter(t => t.type === 'simpanan_pokok')
        .forEach(t => {
          items.push({
            id: `tx-${t.id}`,
            description: `Simpanan Pokok - ${(t as any).profiles?.name || getMemberName(t.user_id)}`,
            amount: t.amount,
            type: 'inflow',
            category: 'financing',
            date: t.date || t.created_at?.split('T')[0] || '',
            source: 'transaction',
            referenceId: t.id,
            memberName: (t as any).profiles?.name
          });
        });

      // 2. Simpanan Wajib (inflow)
      transactions
        .filter(t => t.type === 'simpanan_wajib' || t.type === 'setor_simpanan_wajib')
        .forEach(t => {
          items.push({
            id: `tx-${t.id}`,
            description: `Simpanan Wajib - ${(t as any).profiles?.name || getMemberName(t.user_id)}`,
            amount: t.amount,
            type: 'inflow',
            category: 'financing',
            date: t.date || t.created_at?.split('T')[0] || '',
            source: 'transaction',
            referenceId: t.id,
            memberName: (t as any).profiles?.name
          });
        });

      // 3. Simpanan Sukarela deposits (inflow)
      transactions
        .filter(t => t.type === 'simpanan_sukarela' || t.type === 'setor_simpanan_sukarela')
        .forEach(t => {
          items.push({
            id: `tx-${t.id}`,
            description: `Setoran Simpanan Sukarela - ${(t as any).profiles?.name || getMemberName(t.user_id)}`,
            amount: t.amount,
            type: 'inflow',
            category: 'financing',
            date: t.date || t.created_at?.split('T')[0] || '',
            source: 'transaction',
            referenceId: t.id,
            memberName: (t as any).profiles?.name
          });
        });

      // 4. Simpanan Sukarela withdrawals (outflow)
      transactions
        .filter(t => t.type === 'penarikan_simpanan_sukarela')
        .forEach(t => {
          items.push({
            id: `tx-${t.id}`,
            description: `Penarikan Simpanan Sukarela - ${(t as any).profiles?.name || getMemberName(t.user_id)}`,
            amount: t.amount,
            type: 'outflow',
            category: 'financing',
            date: t.date || t.created_at?.split('T')[0] || '',
            source: 'transaction',
            referenceId: t.id,
            memberName: (t as any).profiles?.name
          });
        });

      // ===== INVESTING ACTIVITIES =====
      // 5. Loan disbursements (outflow - money going out to members)
      loans.forEach(loan => {
        items.push({
          id: `loan-${loan.id}`,
          description: `Pencairan Pinjaman - ${(loan as any).profiles?.name || getMemberName(loan.user_id)}`,
          amount: loan.principal_amount,
          type: 'outflow',
          category: 'investing',
          date: loan.disbursement_date || loan.approved_at?.split('T')[0] || '',
          source: 'loan',
          referenceId: loan.id,
          memberName: (loan as any).profiles?.name
        });
      });

      // 6. Loan principal repayments (inflow - money coming back from members)
      installments.forEach(inst => {
        const loanData = (inst as any).loans;
        const memberName = loanData?.profiles?.name || 'Anggota';
        
        // Principal portion
        if (inst.principal_amount > 0) {
          items.push({
            id: `inst-p-${inst.id}`,
            description: `Angsuran Pokok #${inst.installment_number} - ${memberName}`,
            amount: inst.principal_amount,
            type: 'inflow',
            category: 'investing',
            date: inst.paid_date || '',
            source: 'installment',
            referenceId: inst.id,
            memberName
          });
        }
      });

      // ===== OPERATING ACTIVITIES =====
      // 7. Interest income from loan installments (inflow)
      installments.forEach(inst => {
        const loanData = (inst as any).loans;
        const memberName = loanData?.profiles?.name || 'Anggota';
        
        if (inst.interest_amount > 0) {
          items.push({
            id: `inst-i-${inst.id}`,
            description: `Pendapatan Bunga Pinjaman #${inst.installment_number} - ${memberName}`,
            amount: inst.interest_amount,
            type: 'inflow',
            category: 'operating',
            date: inst.paid_date || '',
            source: 'installment',
            referenceId: inst.id,
            memberName
          });
        }

        // Penalty income
        if ((inst.penalty_amount || 0) > 0) {
          items.push({
            id: `inst-d-${inst.id}`,
            description: `Pendapatan Denda Keterlambatan #${inst.installment_number} - ${memberName}`,
            amount: inst.penalty_amount || 0,
            type: 'inflow',
            category: 'operating',
            date: inst.paid_date || '',
            source: 'installment',
            referenceId: inst.id,
            memberName
          });
        }
      });

      // 8. Manual income entries (inflow)
      incomeEntries
        .filter(e => e.type === 'manual')
        .forEach(e => {
          items.push({
            id: `income-${e.id}`,
            description: e.description,
            amount: e.amount,
            type: 'inflow',
            category: 'operating',
            date: e.date?.split('T')[0] || '',
            source: 'manual',
            referenceId: e.id
          });
        });

      // 9. Manual expense entries (outflow)
      expenseEntries
        .filter(e => e.type === 'manual')
        .forEach(e => {
          items.push({
            id: `expense-${e.id}`,
            description: e.description,
            amount: e.amount,
            type: 'outflow',
            category: 'operating',
            date: e.date?.split('T')[0] || '',
            source: 'manual',
            referenceId: e.id
          });
        });

      // Sort items by date
      items.sort((a, b) => a.date.localeCompare(b.date));

      // Calculate category totals
      const calcCategory = (category: 'operating' | 'investing' | 'financing'): CashFlowCategory => {
        const categoryItems = items.filter(i => i.category === category);
        const totalInflow = categoryItems
          .filter(i => i.type === 'inflow')
          .reduce((sum, i) => sum + i.amount, 0);
        const totalOutflow = categoryItems
          .filter(i => i.type === 'outflow')
          .reduce((sum, i) => sum + i.amount, 0);
        
        return {
          items: categoryItems,
          totalInflow,
          totalOutflow,
          netFlow: totalInflow - totalOutflow
        };
      };

      const operating = calcCategory('operating');
      const investing = calcCategory('investing');
      const financing = calcCategory('financing');

      // Calculate opening balance from previous year balance sheet
      const openingBalance = (prevBS?.kas || 0) + (prevBS?.bank || 0);
      
      // Calculate net cash flow
      const netCashFlow = operating.netFlow + investing.netFlow + financing.netFlow;
      
      // Closing balance
      const closingBalance = openingBalance + netCashFlow;

      const summary: CashFlowSummary = {
        operating,
        investing,
        financing,
        openingBalance,
        closingBalance,
        netCashFlow
      };

      setCashFlow(summary);
      setCashFlowItems(items);
    } catch (error) {
      console.error('Error calculating cash flow:', error);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    calculateCashFlow();
  }, [calculateCashFlow]);

  // Summary statistics
  const statistics = useMemo(() => {
    if (!cashFlow) return null;

    return {
      totalTransactions: cashFlowItems.length,
      operatingItems: cashFlow.operating.items.length,
      investingItems: cashFlow.investing.items.length,
      financingItems: cashFlow.financing.items.length,
      largestInflow: cashFlowItems
        .filter(i => i.type === 'inflow')
        .reduce((max, i) => i.amount > max.amount ? i : max, { amount: 0, description: '-' } as CashFlowItem),
      largestOutflow: cashFlowItems
        .filter(i => i.type === 'outflow')
        .reduce((max, i) => i.amount > max.amount ? i : max, { amount: 0, description: '-' } as CashFlowItem),
    };
  }, [cashFlow, cashFlowItems]);

  return {
    cashFlow,
    cashFlowItems,
    statistics,
    loading,
    refetch: calculateCashFlow
  };
};
