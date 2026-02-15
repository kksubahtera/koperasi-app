import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminRoleType } from './useAdminPermissions';

export interface AdminUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  member_number: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  role_granted_at: string | null;
  role_granted_by: string | null;
  granted_by_name?: string;
  is_multi_role: boolean;
  admin_role?: AdminRoleType;
}

export const useAdminUsers = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all users with admin role
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, granted_at, granted_by')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      if (!adminRoles || adminRoles.length === 0) {
        setAdmins([]);
        return;
      }

      const adminUserIds = adminRoles.map(r => r.user_id);

      // Get profiles for admin users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, name, email, member_number, phone, is_active, created_at')
        .in('user_id', adminUserIds);

      if (profilesError) throw profilesError;

      // Check which admins also have member role (multi-role)
      const { data: memberRoles, error: memberRolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'member')
        .in('user_id', adminUserIds);

      if (memberRolesError) throw memberRolesError;

      const multiRoleUserIds = new Set(memberRoles?.map(r => r.user_id) || []);

      // Get names of users who granted admin roles
      const grantedByIds = adminRoles
        .map(r => r.granted_by)
        .filter((id): id is string => id !== null);

      let grantedByNames: Record<string, string> = {};
      if (grantedByIds.length > 0) {
        const { data: grantedByProfiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', grantedByIds);

        if (grantedByProfiles) {
          grantedByNames = grantedByProfiles.reduce((acc, p) => {
            acc[p.user_id] = p.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Combine data
      const adminList: AdminUser[] = (profiles || []).map(profile => {
        const roleInfo = adminRoles.find(r => r.user_id === profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          name: profile.name,
          email: profile.email,
          member_number: profile.member_number,
          phone: profile.phone,
          is_active: profile.is_active ?? true,
          created_at: profile.created_at || '',
          role_granted_at: roleInfo?.granted_at || null,
          role_granted_by: roleInfo?.granted_by || null,
          granted_by_name: roleInfo?.granted_by ? grantedByNames[roleInfo.granted_by] : undefined,
          is_multi_role: multiRoleUserIds.has(profile.user_id),
        };
      });

      setAdmins(adminList);
    } catch (err) {
      console.error('Error fetching admins:', err);
      setError('Gagal memuat data admin');
    } finally {
      setLoading(false);
    }
  }, []);

  const removeAdminRole = async (userId: string, currentUserId: string): Promise<boolean> => {
    // Prevent removing own admin role
    if (userId === currentUserId) {
      toast({
        title: 'Tidak Diizinkan',
        description: 'Anda tidak dapat menghapus akses admin diri sendiri.',
        variant: 'destructive',
      });
      return false;
    }

    // Prevent removing last admin
    if (admins.length <= 1) {
      toast({
        title: 'Tidak Diizinkan',
        description: 'Minimal harus ada satu admin dalam sistem.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (error) throw error;

      // Log the activity
      await supabase.from('admin_activity_logs').insert([{
        admin_user_id: currentUserId,
        action_type: 'remove_admin_role',
        target_entity: 'user_roles',
        target_id: userId,
        description: `Menghapus akses admin dari user`,
        metadata: { removed_user_id: userId },
      }]);

      toast({
        title: 'Berhasil',
        description: 'Akses admin berhasil dihapus.',
      });

      await fetchAdmins();
      return true;
    } catch (err) {
      console.error('Error removing admin role:', err);
      toast({
        title: 'Gagal',
        description: 'Gagal menghapus akses admin.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const addAdminRole = async (
    userId: string, 
    currentUserId: string, 
    adminRole: AdminRoleType = 'custom'
  ): Promise<boolean> => {
    try {
      // Insert the user_roles entry
      const { error } = await supabase.from('user_roles').insert({
        user_id: userId,
        role: 'admin',
        granted_at: new Date().toISOString(),
        granted_by: currentUserId,
      });

      if (error) throw error;

      // Create admin_permissions entry with role template
      const { error: permError } = await supabase.from('admin_permissions').insert({
        user_id: userId,
        admin_role: adminRole,
        // These will be populated by applying template
        can_approve_transactions: false,
        can_manage_loans: false,
        can_manage_members: false,
        can_manage_registrations: false,
        can_manage_resignations: false,
        can_manage_admins: false,
        can_manage_settings: false,
        can_view_reports: false,
        can_export_data: false,
        can_manage_corrections: false,
        can_view_audit_logs: false,
        can_manage_accounting: false,
      });

      if (permError && !permError.message.includes('duplicate')) {
        console.error('Error creating permissions:', permError);
      }

      // Apply the role template using RPC
      if (adminRole !== 'custom') {
        const { error: rpcError } = await supabase.rpc('apply_admin_role_template', {
          p_user_id: userId,
          p_role: adminRole,
          p_updated_by: currentUserId,
        });

        if (rpcError) {
          console.error('Error applying role template:', rpcError);
        }
      }

      // Log the activity
      await supabase.from('admin_activity_logs').insert([{
        admin_user_id: currentUserId,
        action_type: 'grant_admin_role',
        target_entity: 'user_roles',
        target_id: userId,
        description: `Memberikan akses admin dengan peran: ${adminRole}`,
        metadata: { granted_user_id: userId, admin_role: adminRole },
      }]);

      toast({
        title: 'Berhasil',
        description: 'Akses admin berhasil diberikan.',
      });

      await fetchAdmins();
      return true;
    } catch (err) {
      console.error('Error adding admin role:', err);
      toast({
        title: 'Gagal',
        description: 'Gagal memberikan akses admin.',
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchAdmins();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('admin-users-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        () => fetchAdmins()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAdmins]);

  return {
    admins,
    loading,
    error,
    refetch: fetchAdmins,
    removeAdminRole,
    addAdminRole,
  };
};
