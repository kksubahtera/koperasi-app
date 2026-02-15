import { useState, useEffect, useCallback } from 'react';
import { IncomeEntry, ExpenseEntry, BalanceSheet, RoleAssignment, SHUDistributionResult } from '@/lib/cooperativeSettings';
import { toast } from 'sonner';

// Storage keys for localStorage
const STORAGE_KEYS = {
  INCOME_ENTRIES: 'koperasi_income_entries',
  EXPENSE_ENTRIES: 'koperasi_expense_entries',
  BALANCE_SHEETS: 'koperasi_balance_sheets',
  ROLE_ASSIGNMENTS: 'koperasi_role_assignments',
  SHU_DISTRIBUTIONS: 'koperasi_shu_distributions',
};

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

// Get/Set from localStorage helpers
const getFromStorage = <T>(key: string, defaultValue: T[]): T[] => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveToStorage = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Mock initial data
const mockIncomeEntries: IncomeEntry[] = [
  { id: '1', description: 'Bunga Pinjaman Anggota', amount: 500000, type: 'bunga_pinjaman', date: '2024-06-15', year: 2024 },
  { id: '2', description: 'Denda Keterlambatan', amount: 50000, type: 'denda_pinjaman', date: '2024-06-20', year: 2024 },
  { id: '3', description: 'Pendapatan Lainnya', amount: 100000, type: 'manual', date: '2024-05-10', year: 2024 },
];

const mockExpenseEntries: ExpenseEntry[] = [
  { id: '1', description: 'Biaya Bunga Simpanan', amount: 300000, type: 'biaya_bunga_simpanan', date: '2024-06-30', year: 2024 },
  { id: '2', description: 'Biaya Operasional Kantor', amount: 150000, type: 'manual', date: '2024-06-25', year: 2024 },
];

const mockRoleAssignments: RoleAssignment[] = [
  { id: '1', name: 'Budi Santoso', role: 'pengurus', isMember: true, memberId: 'admin1', sharePercentage: 40 },
  { id: '2', name: 'Siti Rahayu', role: 'pengurus', isMember: true, memberId: '2', sharePercentage: 30 },
  { id: '3', name: 'Ahmad Wijaya', role: 'pengurus', isMember: true, memberId: '1', sharePercentage: 30 },
  { id: '4', name: 'Dewi Lestari', role: 'pengawas', isMember: false, sharePercentage: 100 },
];

// Income Entries Hook
export function useIncomeEntries(year?: number) {
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
    
    let storedEntries = getFromStorage<IncomeEntry>(STORAGE_KEYS.INCOME_ENTRIES, mockIncomeEntries);
    
    if (year) {
      storedEntries = storedEntries.filter(e => e.year === year);
    }
    
    setEntries(storedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setLoading(false);
  }, [year]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = async (entry: Omit<IncomeEntry, 'id'>) => {
    const newEntry: IncomeEntry = { ...entry, id: generateId() };
    const allEntries = getFromStorage<IncomeEntry>(STORAGE_KEYS.INCOME_ENTRIES, mockIncomeEntries);
    allEntries.push(newEntry);
    saveToStorage(STORAGE_KEYS.INCOME_ENTRIES, allEntries);
    await fetchEntries();
    return newEntry;
  };

  const deleteEntry = async (id: string) => {
    const allEntries = getFromStorage<IncomeEntry>(STORAGE_KEYS.INCOME_ENTRIES, mockIncomeEntries);
    const filtered = allEntries.filter(e => e.id !== id);
    saveToStorage(STORAGE_KEYS.INCOME_ENTRIES, filtered);
    await fetchEntries();
    return true;
  };

  return { entries, loading, addEntry, deleteEntry, refetch: fetchEntries };
}

// Expense Entries Hook
export function useExpenseEntries(year?: number) {
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    let storedEntries = getFromStorage<ExpenseEntry>(STORAGE_KEYS.EXPENSE_ENTRIES, mockExpenseEntries);
    
    if (year) {
      storedEntries = storedEntries.filter(e => e.year === year);
    }
    
    setEntries(storedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setLoading(false);
  }, [year]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = async (entry: Omit<ExpenseEntry, 'id'>) => {
    const newEntry: ExpenseEntry = { ...entry, id: generateId() };
    const allEntries = getFromStorage<ExpenseEntry>(STORAGE_KEYS.EXPENSE_ENTRIES, mockExpenseEntries);
    allEntries.push(newEntry);
    saveToStorage(STORAGE_KEYS.EXPENSE_ENTRIES, allEntries);
    await fetchEntries();
    return newEntry;
  };

  const deleteEntry = async (id: string) => {
    const allEntries = getFromStorage<ExpenseEntry>(STORAGE_KEYS.EXPENSE_ENTRIES, mockExpenseEntries);
    const filtered = allEntries.filter(e => e.id !== id);
    saveToStorage(STORAGE_KEYS.EXPENSE_ENTRIES, filtered);
    await fetchEntries();
    return true;
  };

  return { entries, loading, addEntry, deleteEntry, refetch: fetchEntries };
}

// Balance Sheets Hook
export function useBalanceSheets() {
  const [sheets, setSheets] = useState<BalanceSheet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSheets = useCallback(async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const storedSheets = getFromStorage<BalanceSheet>(STORAGE_KEYS.BALANCE_SHEETS, []);
    setSheets(storedSheets.sort((a, b) => b.year - a.year));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  const saveSheet = async (sheet: BalanceSheet) => {
    const allSheets = getFromStorage<BalanceSheet>(STORAGE_KEYS.BALANCE_SHEETS, []);
    const existingIndex = allSheets.findIndex(s => s.year === sheet.year);
    
    if (existingIndex >= 0) {
      allSheets[existingIndex] = sheet;
    } else {
      allSheets.push(sheet);
    }
    
    saveToStorage(STORAGE_KEYS.BALANCE_SHEETS, allSheets);
    await fetchSheets();
    return sheet;
  };

  return { sheets, loading, saveSheet, refetch: fetchSheets };
}

// Role Assignments Hook
export function useRoleAssignments() {
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const storedAssignments = getFromStorage<RoleAssignment>(STORAGE_KEYS.ROLE_ASSIGNMENTS, mockRoleAssignments);
    setAssignments(storedAssignments);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const addAssignment = async (assignment: Omit<RoleAssignment, 'id'>) => {
    const newAssignment: RoleAssignment = { ...assignment, id: generateId() };
    const allAssignments = getFromStorage<RoleAssignment>(STORAGE_KEYS.ROLE_ASSIGNMENTS, mockRoleAssignments);
    allAssignments.push(newAssignment);
    saveToStorage(STORAGE_KEYS.ROLE_ASSIGNMENTS, allAssignments);
    await fetchAssignments();
    return newAssignment;
  };

  const updateAssignment = async (id: string, updates: Partial<RoleAssignment>) => {
    const allAssignments = getFromStorage<RoleAssignment>(STORAGE_KEYS.ROLE_ASSIGNMENTS, mockRoleAssignments);
    const index = allAssignments.findIndex(a => a.id === id);
    
    if (index >= 0) {
      allAssignments[index] = { ...allAssignments[index], ...updates };
      saveToStorage(STORAGE_KEYS.ROLE_ASSIGNMENTS, allAssignments);
      await fetchAssignments();
      return true;
    }
    return false;
  };

  const deleteAssignment = async (id: string) => {
    const allAssignments = getFromStorage<RoleAssignment>(STORAGE_KEYS.ROLE_ASSIGNMENTS, mockRoleAssignments);
    const filtered = allAssignments.filter(a => a.id !== id);
    saveToStorage(STORAGE_KEYS.ROLE_ASSIGNMENTS, filtered);
    await fetchAssignments();
    return true;
  };

  return { assignments, loading, addAssignment, updateAssignment, deleteAssignment, refetch: fetchAssignments };
}

// SHU Distributions Hook
export function useSHUDistributions() {
  const [distributions, setDistributions] = useState<SHUDistributionResult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDistributions = useCallback(async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const storedDistributions = getFromStorage<SHUDistributionResult>(STORAGE_KEYS.SHU_DISTRIBUTIONS, []);
    setDistributions(storedDistributions.sort((a, b) => b.year - a.year));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDistributions();
  }, [fetchDistributions]);

  const saveDistribution = async (distribution: SHUDistributionResult) => {
    const allDistributions = getFromStorage<SHUDistributionResult>(STORAGE_KEYS.SHU_DISTRIBUTIONS, []);
    const existingIndex = allDistributions.findIndex(d => d.year === distribution.year);
    
    if (existingIndex >= 0) {
      allDistributions[existingIndex] = distribution;
    } else {
      allDistributions.push(distribution);
    }
    
    saveToStorage(STORAGE_KEYS.SHU_DISTRIBUTIONS, allDistributions);
    await fetchDistributions();
    return distribution;
  };

  return { distributions, loading, saveDistribution, refetch: fetchDistributions };
}
