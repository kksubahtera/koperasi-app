/**
 * Database Service Layer
 * 
 * This provides services for authentication, member management,
 * and cooperative settings using Supabase.
 */

import { supabase } from '@/integrations/supabase/client';
import type { User, SavingsSummary, Transaction, Loan, LoanInstallment, SHURecord } from './types';

// ===========================================
// Types untuk Database Operations
// ===========================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegistrationData {
  email: string;
  password: string;
  name: string;
  phone: string;
  nik: string;
  bankAccount: string;
}

export interface LoginResult {
  success: boolean;
  message?: string;
  user?: DatabaseUser;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface DatabaseUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  nik: string;
  bankAccountNumber: string;
  bankAccountName: string;
  profilePhoto?: string;
  role: 'member' | 'admin';
  memberNumber: string;
  joinDate: string;
  exitDate?: string;
  exitYear?: number;
  isActive: boolean;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string;
  password?: string;
  paymentProofUrl?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: 'male' | 'female';
  occupation?: string;
}

export interface DatabaseSession {
  user: DatabaseUser;
  token?: string;
}

// ===========================================
// Local Storage Keys
// ===========================================

const STORAGE_KEYS = {
  CURRENT_USER: 'koperasi_current_user',
  USERS: 'koperasi_registered_users',
  SESSIONS: 'koperasi_sessions',
  COOP_SETTINGS: 'koperasi_coop_settings',
};

// ===========================================
// Helper Functions
// ===========================================

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const generateMemberNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `KOP-${year}-${random}`;
};

// ===========================================
// User Storage (Local Implementation)
// ===========================================

const getStoredUsers = (): DatabaseUser[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading stored users:', e);
  }
  
  // Initialize with empty array instead of mock data
  const initialUsers: DatabaseUser[] = [];
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
  return initialUsers;
};

const saveStoredUsers = (users: DatabaseUser[]): void => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

// ===========================================
// AUTH SERVICE
// ===========================================

export const AuthService = {
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    const { email, password } = credentials;
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const users = getStoredUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return { success: false, message: 'Email atau password salah' };
    }
    
    if (user.password !== password) {
      return { success: false, message: 'Email atau password salah' };
    }
    
    if (user.approvalStatus === 'pending') {
      return { success: false, message: 'Akun Anda masih menunggu persetujuan admin' };
    }
    
    if (user.approvalStatus === 'rejected') {
      return { success: false, message: 'Pendaftaran Anda ditolak' };
    }
    
    if (!user.isActive) {
      return { success: false, message: 'Akun Anda tidak aktif' };
    }
    
    const { password: _, ...userWithoutPassword } = user;
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userWithoutPassword));
    
    return { success: true, user: userWithoutPassword };
  },
  
  async logout(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },
  
  async register(data: RegistrationData): Promise<{ success: boolean; message?: string }> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const users = getStoredUsers();
    
    if (users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { success: false, message: 'Email sudah terdaftar' };
    }
    
    if (users.some(u => u.nik === data.nik)) {
      return { success: false, message: 'NIK sudah terdaftar' };
    }
    
    const newUser: DatabaseUser = {
      id: generateId(),
      name: data.name,
      email: data.email,
      phone: data.phone,
      nik: data.nik,
      bankAccountNumber: data.bankAccount,
      bankAccountName: data.name,
      role: 'member',
      memberNumber: generateMemberNumber(),
      joinDate: new Date().toISOString().split('T')[0],
      isActive: true,
      approvalStatus: 'approved', // Auto-approve for demo
      password: data.password,
    };
    
    users.push(newUser);
    saveStoredUsers(users);
    
    return { success: true };
  },
  
  getCurrentUser(): DatabaseUser | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },
  
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  },
  
  onAuthStateChange(callback: (user: DatabaseUser | null) => void): () => void {
    callback(this.getCurrentUser());
    
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.CURRENT_USER) {
        const user = e.newValue ? JSON.parse(e.newValue) : null;
        callback(user);
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  },
};

// ===========================================
// MEMBER SERVICE
// ===========================================

export const MemberService = {
  async getAllMembers(): Promise<DatabaseUser[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const users = getStoredUsers();
    return users.filter(u => u.approvalStatus === 'approved' && u.isActive);
  },
  
  async getAllRegistrations(): Promise<DatabaseUser[]> {
    try {
      // Fetch profiles with their roles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching registrations:', error);
        return getStoredUsers();
      }
      
      if (!profiles) return [];

      // Get all user_ids to fetch roles
      const userIds = profiles.map(p => p.user_id);
      
      // Fetch roles for all users
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      
      // Create a map of user_id to roles
      const userRolesMap: Record<string, string[]> = {};
      if (rolesData) {
        rolesData.forEach(r => {
          if (!userRolesMap[r.user_id]) {
            userRolesMap[r.user_id] = [];
          }
          userRolesMap[r.user_id].push(r.role);
        });
      }
      
      // Map Supabase data to DatabaseUser interface
      return profiles.map(profile => {
        const roles = userRolesMap[profile.user_id] || ['member'];
        const primaryRole = roles.includes('admin') ? 'admin' : 'member';
        
        return {
          id: profile.user_id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone || '',
          nik: '', // NIK is now encrypted - fetch separately via RPC if needed
          bankAccountNumber: profile.bank_account_number || '',
          bankAccountName: profile.bank_account_name || '',
          profilePhoto: profile.profile_photo || undefined,
          role: primaryRole as 'member' | 'admin',
          memberNumber: profile.member_number || '',
          joinDate: profile.join_date || profile.created_at || '',
          exitDate: profile.exit_date || undefined,
          exitYear: profile.exit_year || undefined,
          isActive: profile.is_active ?? true,
          approvalStatus: (profile.approval_status as 'pending' | 'approved' | 'rejected') || 'pending',
          rejectionReason: profile.rejection_reason || undefined,
          paymentProofUrl: profile.payment_proof_url || undefined,
          birthPlace: profile.birth_place || undefined,
          birthDate: profile.birth_date || undefined,
          gender: (profile.gender as 'male' | 'female') || undefined,
          occupation: profile.occupation || undefined,
        };
      });
    } catch (error) {
      console.error('Error in getAllRegistrations:', error);
      return getStoredUsers();
    }
  },
  
  async getPendingRegistrations(): Promise<DatabaseUser[]> {
    const users = getStoredUsers();
    return users.filter(u => u.approvalStatus === 'pending');
  },
  
  async approveRegistration(userId: string): Promise<{ success: boolean; message?: string }> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const users = getStoredUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: 'User tidak ditemukan' };
    }
    
    users[userIndex].approvalStatus = 'approved';
    users[userIndex].isActive = true;
    saveStoredUsers(users);
    
    return { success: true };
  },
  
  async rejectRegistration(userId: string, reason?: string): Promise<{ success: boolean; message?: string }> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const users = getStoredUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: 'User tidak ditemukan' };
    }
    
    users[userIndex].approvalStatus = 'rejected';
    users[userIndex].rejectionReason = reason;
    users[userIndex].isActive = false;
    saveStoredUsers(users);
    
    return { success: true };
  },
  
  async getInactiveMembers(): Promise<DatabaseUser[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const users = getStoredUsers();
    return users.filter(u => !u.isActive);
  },
  
  async getInactiveMembersByYear(year: number): Promise<DatabaseUser[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const users = getStoredUsers();
    return users.filter(u => !u.isActive && u.exitYear === year);
  },
  
  async deactivateMember(userId: string): Promise<{ success: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const users = getStoredUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return { success: false };
    }
    
    users[userIndex].isActive = false;
    users[userIndex].exitDate = new Date().toISOString().split('T')[0];
    users[userIndex].exitYear = new Date().getFullYear();
    saveStoredUsers(users);
    
    return { success: true };
  },
  
  async makeAdmin(userId: string): Promise<{ success: boolean; message?: string }> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const users = getStoredUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: 'User tidak ditemukan' };
    }
    
    if (users[userIndex].role === 'admin') {
      return { success: false, message: 'User sudah menjadi admin' };
    }
    
    users[userIndex].role = 'admin';
    saveStoredUsers(users);
    
    return { success: true };
  },
  
  async updateProfile(userId: string, data: Partial<DatabaseUser>): Promise<{ success: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const users = getStoredUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return { success: false };
    }
    
    users[userIndex] = { ...users[userIndex], ...data };
    saveStoredUsers(users);
    
    // Update current user if logged in
    const currentUser = AuthService.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(users[userIndex]));
    }
    
    return { success: true };
  },
};

// ===========================================
// COOPERATIVE SETTINGS SERVICE
// ===========================================

export const CooperativeSettingsService = {
  async getSettings(): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabase
        .from('cooperative_settings')
        .select('key, value');
      
      if (error) {
        console.error('Error fetching settings:', error);
        return {};
      }
      
      const result: Record<string, any> = {};
      data?.forEach(row => {
        try {
          result[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        } catch {
          result[row.key] = row.value;
        }
      });
      return result;
    } catch {
      return {};
    }
  },
  
  async getSetting(key: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('cooperative_settings')
        .select('value')
        .eq('key', key)
        .single();
      
      if (error || !data) return null;
      
      try {
        return typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      } catch {
        return data.value;
      }
    } catch {
      return null;
    }
  },
  
  async saveSetting(key: string, value: any): Promise<boolean> {
    try {
      // Don't double-stringify primitives
      const storedValue = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' 
        ? value 
        : JSON.stringify(value);
      
      const { error } = await supabase
        .from('cooperative_settings')
        .upsert({ 
          key, 
          value: storedValue,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      return !error;
    } catch {
      return false;
    }
  },
  
  async getMultipleSettings(keys: string[]): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', keys);
      
      if (error) {
        console.error('Error fetching multiple settings:', error);
        return {};
      }
      
      const result: Record<string, any> = {};
      data?.forEach(row => {
        // Supabase returns jsonb as already-parsed objects, no need to JSON.parse
        // Only parse if it's a string that looks like JSON
        if (typeof row.value === 'string') {
          try {
            // Try to parse if it looks like JSON object/array
            if (row.value.startsWith('{') || row.value.startsWith('[') || row.value.startsWith('"')) {
              result[row.key] = JSON.parse(row.value);
            } else {
              result[row.key] = row.value;
            }
          } catch {
            result[row.key] = row.value;
          }
        } else {
          // Already a primitive or object from jsonb column
          result[row.key] = row.value;
        }
      });
      return result;
    } catch {
      return {};
    }
  },
};

// ===========================================
// PLACEHOLDER SERVICES (Use mock data)
// ===========================================

export const TransactionService = {
  async getUserTransactions(userId: string): Promise<Transaction[]> {
    // Return empty array - will use mock data from components
    return [];
  },
};

export const LoanService = {
  async getUserLoans(userId: string): Promise<Loan[]> {
    return [];
  },
};

export const SavingsService = {
  async getUserSavings(userId: string): Promise<SavingsSummary | null> {
    // Use real database - this service is a placeholder
    // Components should use useUserSavings hook instead
    return null;
  },
};

export const SHUService = {
  async getUserSHU(userId: string): Promise<SHURecord[]> {
    // Use real database - this service is a placeholder
    // Components should use useUserSHU hook instead
    return [];
  },
};
