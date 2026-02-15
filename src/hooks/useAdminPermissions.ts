import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type AdminRoleType = 'super_admin' | 'admin_pendaftaran' | 'admin_keuangan' | 'custom';

export interface AdminPermissions {
  id: string;
  user_id: string;
  admin_role: AdminRoleType;
  can_approve_transactions: boolean;
  can_manage_loans: boolean;
  can_manage_members: boolean;
  can_manage_registrations: boolean;
  can_manage_resignations: boolean;
  can_manage_admins: boolean;
  can_manage_settings: boolean;
  can_view_reports: boolean;
  can_export_data: boolean;
  can_manage_corrections: boolean;
  can_view_audit_logs: boolean;
  can_manage_accounting: boolean;
  created_at: string;
  updated_at: string;
}

export type PermissionKey = 
  | 'approve_transactions'
  | 'manage_loans'
  | 'manage_members'
  | 'manage_registrations'
  | 'manage_resignations'
  | 'manage_admins'
  | 'manage_settings'
  | 'view_reports'
  | 'export_data'
  | 'manage_corrections'
  | 'view_audit_logs'
  | 'manage_accounting';

// Admin role definitions with labels and descriptions
export const ADMIN_ROLE_DEFINITIONS: Record<AdminRoleType, { 
  label: string; 
  labelEn: string;
  description: string; 
  color: string;
  icon: 'crown' | 'user-plus' | 'wallet' | 'settings';
}> = {
  super_admin: {
    label: 'Super Admin',
    labelEn: 'Super Admin',
    description: 'Akses penuh ke semua fitur dan pengaturan sistem',
    color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    icon: 'crown',
  },
  admin_pendaftaran: {
    label: 'Admin Pendaftaran',
    labelEn: 'Registration Admin',
    description: 'Mengelola pendaftaran, anggota, dan pengunduran diri',
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    icon: 'user-plus',
  },
  admin_keuangan: {
    label: 'Admin Keuangan',
    labelEn: 'Finance Admin',
    description: 'Mengelola transaksi, pinjaman, dan pembukuan',
    color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
    icon: 'wallet',
  },
  custom: {
    label: 'Custom',
    labelEn: 'Custom',
    description: 'Izin yang dikustomisasi secara manual',
    color: 'text-slate-600 bg-slate-100 dark:bg-slate-900/30',
    icon: 'settings',
  },
};

export const PERMISSION_LABELS: Record<PermissionKey, { label: string; description: string; category: string }> = {
  approve_transactions: { 
    label: 'Approve Transaksi', 
    description: 'Menyetujui atau menolak transaksi simpanan',
    category: 'Transaksi'
  },
  manage_loans: { 
    label: 'Kelola Pinjaman', 
    description: 'Menyetujui, menolak, dan mengelola pinjaman',
    category: 'Transaksi'
  },
  manage_members: { 
    label: 'Kelola Anggota', 
    description: 'Melihat, mengedit, dan menonaktifkan anggota',
    category: 'Anggota'
  },
  manage_registrations: { 
    label: 'Kelola Pendaftaran', 
    description: 'Menyetujui atau menolak pendaftaran baru',
    category: 'Anggota'
  },
  manage_resignations: { 
    label: 'Kelola Pengunduran Diri', 
    description: 'Memproses pengajuan pengunduran diri anggota',
    category: 'Anggota'
  },
  manage_admins: { 
    label: 'Kelola Admin', 
    description: 'Menambah, menghapus, dan mengatur izin admin lain',
    category: 'Sistem'
  },
  manage_settings: { 
    label: 'Kelola Pengaturan', 
    description: 'Mengubah pengaturan koperasi',
    category: 'Sistem'
  },
  view_reports: { 
    label: 'Lihat Laporan', 
    description: 'Melihat laporan keuangan dan statistik',
    category: 'Laporan'
  },
  export_data: { 
    label: 'Export Data', 
    description: 'Mengunduh data dan laporan',
    category: 'Laporan'
  },
  manage_corrections: { 
    label: 'Kelola Koreksi', 
    description: 'Membuat dan mengelola koreksi data',
    category: 'Transaksi'
  },
  view_audit_logs: { 
    label: 'Lihat Audit Log', 
    description: 'Melihat riwayat aktivitas sistem',
    category: 'Sistem'
  },
  manage_accounting: { 
    label: 'Kelola Akuntansi', 
    description: 'Mengelola jurnal, buku besar, dan laporan keuangan',
    category: 'Akuntansi'
  },
};

export const PERMISSION_CATEGORIES = ['Transaksi', 'Anggota', 'Laporan', 'Akuntansi', 'Sistem'];

// Hook to get current user's permissions
export const useCurrentAdminPermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user?.id) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('admin_permissions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      setPermissions(data as AdminPermissions | null);
    } catch (err) {
      console.error('Error fetching permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPermissions();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('current-admin-permissions')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'admin_permissions',
          filter: `user_id=eq.${user?.id}`
        },
        () => fetchPermissions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPermissions, user?.id]);

  // Check if user has a specific permission
  const hasPermission = useCallback((permission: PermissionKey): boolean => {
    // If no permissions record, assume full access (backward compatibility)
    if (!permissions) return true;
    
    const key = `can_${permission}` as keyof AdminPermissions;
    return permissions[key] as boolean;
  }, [permissions]);

  // Check multiple permissions (returns true if user has ANY of them)
  const hasAnyPermission = useCallback((permissionList: PermissionKey[]): boolean => {
    return permissionList.some(p => hasPermission(p));
  }, [hasPermission]);

  // Check multiple permissions (returns true if user has ALL of them)
  const hasAllPermissions = useCallback((permissionList: PermissionKey[]): boolean => {
    return permissionList.every(p => hasPermission(p));
  }, [hasPermission]);

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refetch: fetchPermissions,
  };
};

// Hook to manage all admin permissions (for admin management panel)
export const useAllAdminPermissions = () => {
  const [permissionsList, setPermissionsList] = useState<(AdminPermissions & { admin_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAllPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('admin_permissions')
        .select('*')
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      // Get admin names
      const userIds = (data || []).map(p => p.user_id);
      
      let adminNames: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);

        if (profiles) {
          adminNames = profiles.reduce((acc, p) => {
            acc[p.user_id] = p.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const permissionsWithNames = (data || []).map(p => ({
        ...p,
        admin_role: (p.admin_role as AdminRoleType) || 'custom',
        admin_name: adminNames[p.user_id] || 'Unknown',
      })) as (AdminPermissions & { admin_name?: string })[];

      setPermissionsList(permissionsWithNames);
    } catch (err) {
      console.error('Error fetching all permissions:', err);
      setError('Gagal memuat data izin admin');
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePermission = async (
    userId: string, 
    permission: PermissionKey, 
    value: boolean,
    currentUserId: string
  ): Promise<boolean> => {
    try {
      const updateData = {
        [`can_${permission}`]: value,
        updated_at: new Date().toISOString(),
        updated_by: currentUserId,
      };

      const { error } = await supabase
        .from('admin_permissions')
        .update(updateData)
        .eq('user_id', userId);

      if (error) throw error;

      // Log the activity
      await supabase.from('admin_activity_logs').insert([{
        admin_user_id: currentUserId,
        action_type: 'update_admin_permission',
        target_entity: 'admin_permissions',
        target_id: userId,
        description: `Mengubah izin ${PERMISSION_LABELS[permission].label} menjadi ${value ? 'Aktif' : 'Nonaktif'}`,
        metadata: { permission, value, target_user_id: userId },
      }]);

      toast({
        title: 'Berhasil',
        description: `Izin ${PERMISSION_LABELS[permission].label} berhasil diperbarui.`,
      });

      await fetchAllPermissions();
      return true;
    } catch (err) {
      console.error('Error updating permission:', err);
      toast({
        title: 'Gagal',
        description: 'Gagal memperbarui izin.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateMultiplePermissions = async (
    userId: string,
    permissions: Partial<Record<PermissionKey, boolean>>,
    currentUserId: string
  ): Promise<boolean> => {
    try {
      const updateData: Record<string, boolean | string> = {
        updated_at: new Date().toISOString(),
        updated_by: currentUserId,
      };

      Object.entries(permissions).forEach(([key, value]) => {
        updateData[`can_${key}`] = value;
      });

      const { error } = await supabase
        .from('admin_permissions')
        .update(updateData)
        .eq('user_id', userId);

      if (error) throw error;

      // Log the activity
      await supabase.from('admin_activity_logs').insert([{
        admin_user_id: currentUserId,
        action_type: 'update_admin_permissions_bulk',
        target_entity: 'admin_permissions',
        target_id: userId,
        description: `Memperbarui ${Object.keys(permissions).length} izin admin`,
        metadata: { permissions, target_user_id: userId },
      }]);

      toast({
        title: 'Berhasil',
        description: 'Izin admin berhasil diperbarui.',
      });

      await fetchAllPermissions();
      return true;
    } catch (err) {
      console.error('Error updating permissions:', err);
      toast({
        title: 'Gagal',
        description: 'Gagal memperbarui izin.',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Apply a role template to an admin
  const applyRoleTemplate = async (
    userId: string,
    role: AdminRoleType,
    currentUserId: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('apply_admin_role_template', {
        p_user_id: userId,
        p_role: role,
        p_updated_by: currentUserId,
      });

      if (error) throw error;

      // Log the activity
      await supabase.from('admin_activity_logs').insert([{
        admin_user_id: currentUserId,
        action_type: 'apply_admin_role_template',
        target_entity: 'admin_permissions',
        target_id: userId,
        description: `Menerapkan template peran: ${ADMIN_ROLE_DEFINITIONS[role].label}`,
        metadata: { role, target_user_id: userId },
      }]);

      toast({
        title: 'Berhasil',
        description: `Template peran ${ADMIN_ROLE_DEFINITIONS[role].label} berhasil diterapkan.`,
      });

      await fetchAllPermissions();
      return true;
    } catch (err) {
      console.error('Error applying role template:', err);
      toast({
        title: 'Gagal',
        description: 'Gagal menerapkan template peran.',
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchAllPermissions();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('all-admin-permissions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_permissions' },
        () => fetchAllPermissions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAllPermissions]);

  return {
    permissionsList,
    loading,
    error,
    refetch: fetchAllPermissions,
    updatePermission,
    updateMultiplePermissions,
    applyRoleTemplate,
  };
};
