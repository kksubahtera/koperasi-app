import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export interface RegistrationData {
  email: string;
  password: string;
  name: string;
  phone: string;
  nik: string;
  address: string;
  bankName: string;
  bankAccount: string;
  birthPlace: string;
  birthDate: string;
  gender: 'male' | 'female' | '';
  occupation: string;
  branchId?: string;
}

export type UserRole = 'member' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  nik: string;
  address: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  profilePhoto?: string;
  gender?: string;
  roles: UserRole[]; // Array of all roles user has
  activeRole: UserRole; // Currently active role
  memberNumber: string;
  joinDate: string;
  exitDate?: string;
  exitYear?: number;
  isActive: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  mustChangePassword?: boolean;
  isMigratedAccount?: boolean;
}

interface LoginResult {
  success: boolean;
  message?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  register: (data: RegistrationData) => Promise<{ success: boolean; message?: string }>;
  switchRole: (role: UserRole) => void;
  hasRole: (role: UserRole) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile and roles from database
  const fetchUserData = async (userId: string): Promise<AuthUser | null> => {
    try {
      // Get profile with decrypted NIK using RPC
      const { data: profile, error: profileError } = await supabase
        .rpc('get_profile_with_nik', { p_user_id: userId })
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        // Fallback to regular profile fetch without NIK
        const { data: basicProfile, error: basicError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (basicError) {
          console.error('Error fetching basic profile:', basicError);
          return null;
        }
        
        // Continue with basic profile (no NIK)
        return await buildAuthUser(userId, { ...basicProfile, nik: '' });
      }

      return await buildAuthUser(userId, profile);
    } catch (error) {
      console.error('Error in fetchUserData:', error);
      return null;
    }
  };

  // Helper function to build AuthUser object
  const buildAuthUser = async (userId: string, profile: any): Promise<AuthUser | null> => {
    try {

      // Get ALL roles for this user (multi-role support)
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      }

      // Extract roles array
      const roles: UserRole[] = rolesData?.map(r => r.role as UserRole) || ['member'];
      
      // Determine initial active role (prefer admin if user has it)
      const savedActiveRole = localStorage.getItem(`activeRole_${userId}`);
      let activeRole: UserRole = 'member';
      
      if (savedActiveRole && roles.includes(savedActiveRole as UserRole)) {
        activeRole = savedActiveRole as UserRole;
      } else if (roles.includes('admin')) {
        activeRole = 'admin';
      } else if (roles.length > 0) {
        activeRole = roles[0];
      }

      const authUser: AuthUser = {
        id: userId,
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        nik: profile.nik || '',
        address: profile.address || '',
        bankName: profile.bank_name || '',
        bankAccountNumber: profile.bank_account_number || '',
        bankAccountName: profile.bank_account_name || '',
        profilePhoto: profile.profile_photo || undefined,
        gender: profile.gender || undefined,
        roles,
        activeRole,
        memberNumber: profile.member_number || '',
        joinDate: profile.join_date || new Date().toISOString().split('T')[0],
        exitDate: profile.exit_date || undefined,
        exitYear: profile.exit_year || undefined,
        isActive: profile.is_active ?? true,
        approvalStatus: (profile.approval_status as 'pending' | 'approved' | 'rejected') || 'pending',
        rejectionReason: profile.rejection_reason || undefined,
        mustChangePassword: profile.must_change_password || false,
        isMigratedAccount: profile.is_migrated_account || false,
      };

      return authUser;
    } catch (error) {
      console.error('Error in buildAuthUser:', error);
      return null;
    }
  };

  // Switch between roles
  const switchRole = useCallback((role: UserRole) => {
    if (user && user.roles.includes(role)) {
      const updatedUser = { ...user, activeRole: role };
      setUser(updatedUser);
      // Save preference
      localStorage.setItem(`activeRole_${user.id}`, role);
    }
  }, [user]);

  // Check if user has a specific role
  const hasRole = useCallback((role: UserRole): boolean => {
    return user?.roles.includes(role) ?? false;
  }, [user]);

  // Refresh user data from database
  const refreshUser = useCallback(async () => {
    if (session?.user) {
      const userData = await fetchUserData(session.user.id);
      setUser(userData);
    }
  }, [session]);

  // Initialize auth state
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('Auth state changed:', event);
        setSession(newSession);
        
        if (newSession?.user) {
          // Defer Supabase calls with setTimeout to prevent deadlock
          setTimeout(async () => {
            const userData = await fetchUserData(newSession.user.id);
            setUser(userData);
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      
      if (existingSession?.user) {
        fetchUserData(existingSession.user.id).then((userData) => {
          setUser(userData);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Helper function to create missing profile for authenticated user
  const createMissingProfile = async (userId: string, email: string): Promise<boolean> => {
    try {
      console.log('Creating missing profile for user:', userId);
      
      // Get user metadata from auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const userName = authUser?.user_metadata?.name || email.split('@')[0];
      const memberNumber = 'MBR-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + userId.slice(0, 4).toUpperCase();
      
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          name: userName,
          email: email,
          member_number: memberNumber,
          approval_status: 'pending',
          is_active: false,
        });
      
      if (profileError) {
        console.error('Error creating profile:', profileError);
        return false;
      }
      
      // Create user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'member',
        });
      
      if (roleError && !roleError.message.includes('duplicate')) {
        console.error('Error creating role:', roleError);
      }
      
      // Create savings summary
      const { error: savingsError } = await supabase
        .from('savings_summary')
        .insert({
          user_id: userId,
          simpanan_pokok: 0,
          simpanan_wajib: 0,
          simpanan_sukarela: 0,
        });
      
      if (savingsError && !savingsError.message.includes('duplicate')) {
        console.error('Error creating savings summary:', savingsError);
      }
      
      console.log('Profile created successfully for user:', userId);
      return true;
    } catch (error) {
      console.error('Error in createMissingProfile:', error);
      return false;
    }
  };

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        
        // Translate common error messages
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, message: 'Email atau password salah' };
        }
        if (error.message.includes('Email not confirmed')) {
          return { success: false, message: 'Email belum dikonfirmasi' };
        }
        
        return { success: false, message: error.message };
      }

      if (data.user) {
        let userData = await fetchUserData(data.user.id);
        
        // If profile not found, try to create it (handle edge case where trigger failed)
        if (!userData) {
          console.log('Profile not found, attempting to create one...');
          const created = await createMissingProfile(data.user.id, data.user.email || email);
          
          if (created) {
            // Retry fetching user data after creating profile
            userData = await fetchUserData(data.user.id);
          }
          
          if (!userData) {
            return { 
              success: false, 
              message: 'Profil pengguna tidak ditemukan. Silakan hubungi admin atau coba daftar ulang.' 
            };
          }
        }
        
        // Allow pending users to login so they can see PendingApprovalScreen with payment instructions
        if (userData.approvalStatus === 'pending') {
          setUser(userData);
          return { success: true };
        }
        
        if (userData.approvalStatus === 'rejected') {
          await supabase.auth.signOut();
          return { success: false, message: `Pendaftaran ditolak: ${userData.rejectionReason || 'Tidak ada alasan'}` };
        }
        
        // Only check isActive for approved users
        if (!userData.isActive && userData.approvalStatus === 'approved') {
          await supabase.auth.signOut();
          return { success: false, message: 'Akun Anda tidak aktif' };
        }
        
        setUser(userData);
        return { success: true };
      }

      return { success: false, message: 'Terjadi kesalahan saat login' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Terjadi kesalahan saat login' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (user) {
      // Clear saved role preference on logout
      localStorage.removeItem(`activeRole_${user.id}`);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [user]);

  const register = useCallback(async (data: RegistrationData): Promise<{ success: boolean; message?: string }> => {
    try {
      setIsLoading(true);
      
      const redirectUrl = `${window.location.origin}/`;
      
      // Send ALL registration data via raw_user_meta_data
      // The database trigger will read and save all fields atomically
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: data.name,
            nik: data.nik,
            phone: data.phone,
            address: data.address,
            bank_name: data.bankName,
            bank_account_number: data.bankAccount,
            birth_place: data.birthPlace,
            birth_date: data.birthDate,
            gender: data.gender,
            occupation: data.occupation,
            branch_id: data.branchId || null,
          },
        },
      });

      if (signUpError) {
        console.error('Registration error:', signUpError);
        
        if (signUpError.message.includes('already registered')) {
          return { success: false, message: 'Email sudah terdaftar' };
        }
        
        return { success: false, message: signUpError.message };
      }

      if (authData.user) {
        // Sync profile metadata from auth to profiles table
        // This ensures all registration data is saved even if trigger didn't work
        try {
          await supabase.functions.invoke('sync-profile-metadata', {
            body: { user_id: authData.user.id },
          });
          console.log('Profile metadata synced successfully');
        } catch (syncError) {
          console.error('Error syncing profile metadata:', syncError);
          // Don't fail registration if sync fails - data is in auth.users
        }
        
        // Profile is created automatically by the database trigger with all data
        return { success: true, message: 'Pendaftaran berhasil. Silakan tunggu persetujuan admin.' };
      }

      return { success: false, message: 'Terjadi kesalahan saat pendaftaran' };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Terjadi kesalahan saat pendaftaran' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session,
      isLoading, 
      login, 
      logout, 
      register,
      switchRole,
      hasRole,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
