import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MonthlyData {
  month: string;
  year: number;
  monthNum: number;
  income: number;
  expense: number;
  profit: number;
}

interface ProjectionData {
  month: string;
  income: number;
  expense: number;
  profit: number;
  isProjection: boolean;
}

// Simple linear regression for trend calculation
const calculateLinearRegression = (data: number[]): { slope: number; intercept: number } => {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  
  const xSum = data.reduce((sum, _, i) => sum + i, 0);
  const ySum = data.reduce((sum, val) => sum + val, 0);
  const xySum = data.reduce((sum, val, i) => sum + i * val, 0);
  const xxSum = data.reduce((sum, _, i) => sum + i * i, 0);
  
  const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum) || 0;
  const intercept = (ySum - slope * xSum) / n || 0;
  
  return { slope, intercept };
};

// Calculate moving average
const calculateMovingAverage = (data: number[], period: number = 3): number => {
  if (data.length === 0) return 0;
  const recentData = data.slice(-period);
  return recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
};

// Project future values
const projectValues = (
  historicalData: number[],
  monthsToProject: number,
  method: 'linear' | 'average' = 'linear'
): number[] => {
  if (historicalData.length === 0) {
    return Array(monthsToProject).fill(0);
  }
  
  if (method === 'linear') {
    const { slope, intercept } = calculateLinearRegression(historicalData);
    const startIndex = historicalData.length;
    return Array.from({ length: monthsToProject }, (_, i) => {
      const projected = slope * (startIndex + i) + intercept;
      return Math.max(0, projected); // Ensure non-negative
    });
  } else {
    const avg = calculateMovingAverage(historicalData);
    return Array(monthsToProject).fill(avg);
  }
};

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export const useFinancialProjections = (projectionMonths: number = 6) => {
  return useQuery({
    queryKey: ['financial-projections', projectionMonths],
    queryFn: async () => {
      // Fetch income entries
      const { data: incomeData, error: incomeError } = await supabase
        .from('income_entries')
        .select('amount, date, year')
        .order('date', { ascending: true });
      
      if (incomeError) throw incomeError;
      
      // Fetch expense entries
      const { data: expenseData, error: expenseError } = await supabase
        .from('expense_entries')
        .select('amount, date, year')
        .order('date', { ascending: true });
      
      if (expenseError) throw expenseError;
      
      // Aggregate data by month
      const monthlyMap = new Map<string, { income: number; expense: number }>();
      
      // Process income
      incomeData?.forEach(entry => {
        const date = new Date(entry.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const existing = monthlyMap.get(key) || { income: 0, expense: 0 };
        existing.income += Number(entry.amount);
        monthlyMap.set(key, existing);
      });
      
      // Process expenses
      expenseData?.forEach(entry => {
        const date = new Date(entry.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const existing = monthlyMap.get(key) || { income: 0, expense: 0 };
        existing.expense += Number(entry.amount);
        monthlyMap.set(key, existing);
      });
      
      // Convert to sorted array
      const sortedKeys = Array.from(monthlyMap.keys()).sort();
      const historicalData: MonthlyData[] = sortedKeys.map(key => {
        const [year, month] = key.split('-').map(Number);
        const data = monthlyMap.get(key)!;
        return {
          month: `${MONTH_NAMES[month - 1]} ${year}`,
          year,
          monthNum: month,
          income: data.income,
          expense: data.expense,
          profit: data.income - data.expense
        };
      });
      
      // Extract arrays for projection
      const incomeArray = historicalData.map(d => d.income);
      const expenseArray = historicalData.map(d => d.expense);
      
      // Calculate projections
      const projectedIncome = projectValues(incomeArray, projectionMonths, 'linear');
      const projectedExpense = projectValues(expenseArray, projectionMonths, 'linear');
      
      // Generate future month labels
      const lastDate = historicalData.length > 0 
        ? new Date(historicalData[historicalData.length - 1].year, historicalData[historicalData.length - 1].monthNum - 1)
        : new Date();
      
      const projectedData: ProjectionData[] = Array.from({ length: projectionMonths }, (_, i) => {
        const futureDate = new Date(lastDate);
        futureDate.setMonth(futureDate.getMonth() + i + 1);
        const income = projectedIncome[i];
        const expense = projectedExpense[i];
        return {
          month: `${MONTH_NAMES[futureDate.getMonth()]} ${futureDate.getFullYear()}`,
          income,
          expense,
          profit: income - expense,
          isProjection: true
        };
      });
      
      // Combine historical and projected data
      const combinedData: ProjectionData[] = [
        ...historicalData.slice(-6).map(d => ({
          month: d.month,
          income: d.income,
          expense: d.expense,
          profit: d.profit,
          isProjection: false
        })),
        ...projectedData
      ];
      
      // Calculate statistics
      const totalHistoricalIncome = incomeArray.reduce((sum, val) => sum + val, 0);
      const totalHistoricalExpense = expenseArray.reduce((sum, val) => sum + val, 0);
      const totalProjectedIncome = projectedIncome.reduce((sum, val) => sum + val, 0);
      const totalProjectedExpense = projectedExpense.reduce((sum, val) => sum + val, 0);
      
      const avgMonthlyIncome = incomeArray.length > 0 ? totalHistoricalIncome / incomeArray.length : 0;
      const avgMonthlyExpense = expenseArray.length > 0 ? totalHistoricalExpense / expenseArray.length : 0;
      
      // Calculate growth rates
      const incomeGrowth = incomeArray.length >= 2 
        ? ((incomeArray[incomeArray.length - 1] - incomeArray[0]) / (incomeArray[0] || 1)) * 100 
        : 0;
      const expenseGrowth = expenseArray.length >= 2 
        ? ((expenseArray[expenseArray.length - 1] - expenseArray[0]) / (expenseArray[0] || 1)) * 100 
        : 0;
      
      return {
        historicalData,
        projectedData,
        combinedData,
        statistics: {
          totalHistoricalIncome,
          totalHistoricalExpense,
          totalProjectedIncome,
          totalProjectedExpense,
          avgMonthlyIncome,
          avgMonthlyExpense,
          incomeGrowth,
          expenseGrowth,
          projectedProfit: totalProjectedIncome - totalProjectedExpense
        }
      };
    }
  });
};
