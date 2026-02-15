import React, { useState } from 'react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { useAdminUsers, AdminUser } from '@/hooks/useAdminUsers';
import { useAdminActivityLogs, ACTION_TYPE_OPTIONS } from '@/hooks/useAdminActivityLogs';
import { usePaginatedMembers } from '@/hooks/usePaginatedMembers';
import { useAllAdminPermissions, useCurrentAdminPermissions, PERMISSION_LABELS, PERMISSION_CATEGORIES, PermissionKey, ADMIN_ROLE_DEFINITIONS, AdminRoleType } from '@/hooks/useAdminPermissions';
import { Shield, ShieldCheck, ShieldX, Users, History, Settings, Search, UserPlus, Trash2, Eye, RefreshCw, Download, Clock, Activity, Info, Lock, UserCog, Crown, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import OrphanUserSync from './OrphanUserSync';


const AdminManagement: React.FC = () => {
  const { t } = useThemeLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-3 rounded-xl bg-primary/10">
          <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Manajemen Admin</h1>
          <p className="text-sm text-muted-foreground">Kelola akun admin dan pantau aktivitas</p>
        </div>
      </div>

      {/* Button Group Navigation */}
      <div className="flex flex-wrap gap-1 p-1 bg-muted/50 rounded-xl mb-4">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'list'
              ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Daftar Admin</span>
          <span className="sm:hidden">Admin</span>
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'activity'
              ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">Riwayat Aktivitas</span>
          <span className="sm:hidden">Aktivitas</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'settings'
              ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Pengaturan Izin</span>
          <span className="sm:hidden">Izin</span>
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'sync'
              ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <UserCog className="h-4 w-4" />
          <span className="hidden sm:inline">Sync User</span>
          <span className="sm:hidden">Sync</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'list' && <AdminListTab currentUserId={user?.id || ''} />}
      {activeTab === 'activity' && <AdminActivityTab />}
      {activeTab === 'settings' && <AdminPermissionsTab currentUserId={user?.id || ''} />}
      {activeTab === 'sync' && <OrphanUserSync />}
    </div>
  );
};

// Tab: Daftar Admin
const AdminListTab: React.FC<{ currentUserId: string }> = ({ currentUserId }) => {
  const { admins, loading, error, refetch, removeAdminRole, addAdminRole } = useAdminUsers();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [adminToRemove, setAdminToRemove] = useState<AdminUser | null>(null);

  const filteredAdmins = admins.filter(admin =>
    admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (admin.member_number?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleRemoveAdmin = async () => {
    if (adminToRemove) {
      await removeAdminRole(adminToRemove.user_id, currentUserId);
      setAdminToRemove(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="text-center text-destructive py-8">
            <ShieldX className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{error}</p>
            <Button variant="outline" onClick={refetch} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Coba Lagi
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Daftar Admin ({admins.length})</CardTitle>
              <CardDescription>Semua pengguna dengan akses administrator</CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Tambah Admin
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <div className="mb-4">
            <SearchInput
              placeholder="Cari admin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="w-full"
            />
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Diangkat Oleh</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? 'Tidak ada admin yang cocok' : 'Belum ada admin'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAdmins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{admin.name}</p>
                            <p className="text-sm text-muted-foreground">{admin.email}</p>
                            <p className="text-xs text-muted-foreground md:hidden mt-1">
                              {admin.member_number}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="space-y-1">
                          {admin.is_multi_role ? (
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              Admin + Anggota
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400">
                              Admin Only
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground">{admin.member_number}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-sm">
                          {admin.granted_by_name ? (
                            <>
                              <p>{admin.granted_by_name}</p>
                              {admin.role_granted_at && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(admin.role_granted_at), 'dd MMM yyyy', { locale: localeId })}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">Setup Awal</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setAdminToRemove(admin)}
                          disabled={admin.user_id === currentUserId || admins.length <= 1}
                          title={
                            admin.user_id === currentUserId
                              ? 'Tidak bisa menghapus diri sendiri'
                              : admins.length <= 1
                              ? 'Minimal harus ada satu admin'
                              : 'Hapus akses admin'
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Admin Dialog */}
      <AddAdminDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        currentUserId={currentUserId}
        existingAdminIds={admins.map(a => a.user_id)}
        onAddAdmin={addAdminRole}
      />

      {/* Remove Admin Confirmation */}
      <AlertDialog open={!!adminToRemove} onOpenChange={() => setAdminToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Akses Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus akses admin dari <strong>{adminToRemove?.name}</strong>.
              {adminToRemove?.is_multi_role && (
                <span className="block mt-2">
                  Pengguna ini masih akan memiliki akses sebagai anggota biasa.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveAdmin} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus Akses
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// Dialog: Tambah Admin
const AddAdminDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  existingAdminIds: string[];
  onAddAdmin: (userId: string, currentUserId: string, role: AdminRoleType) => Promise<boolean>;
}> = ({ open, onOpenChange, currentUserId, existingAdminIds, onAddAdmin }) => {
  const { members, isLoading } = usePaginatedMembers({ isActive: true, approvalStatus: 'approved' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AdminRoleType>('admin_pendaftaran');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out existing admins
  const availableMembers = members.filter(
    m => !existingAdminIds.includes(m.user_id)
  );

  const filteredMembers = availableMembers.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedMember) return;
    
    setIsSubmitting(true);
    const success = await onAddAdmin(selectedMember, currentUserId, selectedRole);
    setIsSubmitting(false);
    
    if (success) {
      setSelectedMember(null);
      setSearchQuery('');
      setSelectedRole('admin_pendaftaran');
      onOpenChange(false);
    }
  };

  const getRoleIcon = (role: AdminRoleType) => {
    switch (role) {
      case 'super_admin': return Crown;
      case 'admin_pendaftaran': return UserPlus;
      case 'admin_keuangan': return Wallet;
      default: return Settings;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Admin Baru</DialogTitle>
          <DialogDescription>
            Pilih anggota dan tentukan peran admin untuk diberikan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Role Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Pilih Peran Admin</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['super_admin', 'admin_pendaftaran', 'admin_keuangan'] as AdminRoleType[]).map((role) => {
                const config = ADMIN_ROLE_DEFINITIONS[role];
                const Icon = getRoleIcon(role);
                const isSelected = selectedRole === role;

                return (
                  <button
                    key={role}
                    type="button"
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedRole(role)}
                  >
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{config.label}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{config.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Member Search */}
          <div>
            <label className="text-sm font-medium mb-2 block">Pilih Anggota</label>
            <SearchInput
              placeholder="Cari anggota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="w-full"
            />
          </div>

          <ScrollArea className="h-48 rounded-md border">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {availableMembers.length === 0
                  ? 'Semua anggota sudah menjadi admin'
                  : 'Tidak ada anggota yang cocok'}
              </div>
            ) : (
              <div className="p-2">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedMember === member.user_id
                        ? 'bg-primary/10 border border-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedMember(member.user_id)}
                  >
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedMember || isSubmitting}>
            {isSubmitting ? 'Memproses...' : `Jadikan ${ADMIN_ROLE_DEFINITIONS[selectedRole].label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Tab: Riwayat Aktivitas
const AdminActivityTab: React.FC = () => {
  const [filters, setFilters] = useState({
    adminUserId: '',
    actionType: '',
    searchQuery: '',
  });
  
  const { logs, loading, error, totalCount, refetch } = useAdminActivityLogs(
    Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
  );
  const { admins } = useAdminUsers();

  const getActionBadge = (actionType: string) => {
    const actionConfig: Record<string, { color: string; label: string }> = {
      login: { color: 'bg-green-500/10 text-green-600', label: 'Login' },
      logout: { color: 'bg-gray-500/10 text-gray-600', label: 'Logout' },
      grant_admin_role: { color: 'bg-purple-500/10 text-purple-600', label: 'Berikan Admin' },
      remove_admin_role: { color: 'bg-red-500/10 text-red-600', label: 'Hapus Admin' },
      approve_transaction: { color: 'bg-blue-500/10 text-blue-600', label: 'Setujui Transaksi' },
      reject_transaction: { color: 'bg-orange-500/10 text-orange-600', label: 'Tolak Transaksi' },
      approve_loan: { color: 'bg-emerald-500/10 text-emerald-600', label: 'Setujui Pinjaman' },
      reject_loan: { color: 'bg-rose-500/10 text-rose-600', label: 'Tolak Pinjaman' },
      approve_registration: { color: 'bg-teal-500/10 text-teal-600', label: 'Setujui Pendaftaran' },
      reject_registration: { color: 'bg-amber-500/10 text-amber-600', label: 'Tolak Pendaftaran' },
      update_settings: { color: 'bg-indigo-500/10 text-indigo-600', label: 'Ubah Pengaturan' },
      update_member: { color: 'bg-cyan-500/10 text-cyan-600', label: 'Ubah Anggota' },
    };

    const config = actionConfig[actionType] || { color: 'bg-muted', label: actionType };
    return <Badge className={`${config.color} border-0`}>{config.label}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Riwayat Aktivitas Admin</CardTitle>
            <CardDescription>Total {totalCount} aktivitas tercatat</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex gap-2 flex-1">
            <Select
              value={filters.adminUserId}
              onValueChange={(value) => setFilters(f => ({ ...f, adminUserId: value === 'all' ? '' : value }))}
            >
              <SelectTrigger className="w-[140px] sm:w-[160px]">
                <SelectValue placeholder="Semua Admin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Admin</SelectItem>
                {admins.map(admin => (
                  <SelectItem key={admin.user_id} value={admin.user_id}>
                    {admin.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.actionType}
              onValueChange={(value) => setFilters(f => ({ ...f, actionType: value === 'all' ? '' : value }))}
            >
              <SelectTrigger className="w-[140px] sm:w-[160px]">
                <SelectValue placeholder="Tipe Aksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe Aksi</SelectItem>
                {ACTION_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SearchInput
            placeholder="Cari deskripsi..."
            value={filters.searchQuery}
            onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
            containerClassName="flex-1 sm:max-w-[240px]"
          />
        </div>

        {/* Activity List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-destructive py-8">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Belum ada aktivitas tercatat</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-3 pr-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium">{log.admin_name}</span>
                      {getActionBadge(log.action_type)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{log.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: localeId })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

// Tab: Pengaturan Izin
const AdminPermissionsTab: React.FC<{ currentUserId: string }> = ({ currentUserId }) => {
  const { permissionsList, loading, error, updatePermission, applyRoleTemplate, refetch } = useAllAdminPermissions();
  const { hasPermission: currentUserHasPermission } = useCurrentAdminPermissions();
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [updatingPermission, setUpdatingPermission] = useState<string | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  const canManagePermissions = currentUserHasPermission('manage_admins');

  const selectedAdmin = permissionsList.find(p => p.user_id === selectedAdminId);

  const handleTogglePermission = async (permission: PermissionKey, currentValue: boolean) => {
    if (!selectedAdminId || !canManagePermissions) return;
    
    // Prevent removing own manage_admins permission
    if (permission === 'manage_admins' && selectedAdminId === currentUserId && currentValue) {
      return;
    }
    
    setUpdatingPermission(permission);
    await updatePermission(selectedAdminId, permission, !currentValue, currentUserId);
    setUpdatingPermission(null);
  };

  const getPermissionValue = (permission: PermissionKey): boolean => {
    if (!selectedAdmin) return false;
    const key = `can_${permission}` as keyof typeof selectedAdmin;
    return selectedAdmin[key] as boolean;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="text-center text-destructive py-8">
            <ShieldX className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{error}</p>
            <Button variant="outline" onClick={refetch} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Coba Lagi
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Pengaturan Izin Admin</CardTitle>
            <CardDescription>Atur hak akses untuk setiap administrator</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        {!canManagePermissions && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-amber-600 dark:text-amber-400">Akses Terbatas</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Anda tidak memiliki izin untuk mengubah pengaturan izin admin. Hubungi super admin untuk mendapatkan akses.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Admin List */}
          <div className="lg:col-span-1">
            <h3 className="font-medium mb-3">Pilih Admin</h3>
            <ScrollArea className="h-[400px] rounded-md border">
              <div className="p-2 space-y-1">
                {permissionsList.map((admin) => {
                  const roleConfig = ADMIN_ROLE_DEFINITIONS[admin.admin_role || 'custom'];
                  return (
                    <button
                      key={admin.user_id}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedAdminId === admin.user_id
                          ? 'bg-primary/10 border border-primary'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                      onClick={() => setSelectedAdminId(admin.user_id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{admin.admin_name}</p>
                          <Badge className={`${roleConfig.color} text-xs border-0`}>
                            {roleConfig.label}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Permission Editor */}
          <div className="lg:col-span-2">
            {!selectedAdminId ? (
              <div className="h-full flex items-center justify-center text-muted-foreground border rounded-lg p-8">
                <div className="text-center">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Pilih admin untuk melihat dan mengatur izin</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-medium">Izin untuk {selectedAdmin?.admin_name}</h3>
                    <Badge className={`${ADMIN_ROLE_DEFINITIONS[selectedAdmin?.admin_role || 'custom'].color} text-xs border-0 mt-1`}>
                      {ADMIN_ROLE_DEFINITIONS[selectedAdmin?.admin_role || 'custom'].label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedAdminId === currentUserId && (
                      <Badge className="bg-blue-500/10 text-blue-600 border-0">Anda</Badge>
                    )}
                    {canManagePermissions && selectedAdminId !== currentUserId && (
                      <Select
                        value={selectedAdmin?.admin_role || 'custom'}
                        onValueChange={async (value) => {
                          setApplyingTemplate(true);
                          await applyRoleTemplate(selectedAdminId!, value as AdminRoleType, currentUserId);
                          setApplyingTemplate(false);
                        }}
                        disabled={applyingTemplate}
                      >
                        <SelectTrigger className="w-[160px] h-8 text-xs">
                          <SelectValue placeholder="Ubah Peran" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                          <SelectItem value="admin_pendaftaran">Admin Pendaftaran</SelectItem>
                          <SelectItem value="admin_keuangan">Admin Keuangan</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <ScrollArea className="h-[360px] rounded-md border">
                  <div className="p-4 space-y-6">
                    {PERMISSION_CATEGORIES.map((category) => {
                      const categoryPermissions = Object.entries(PERMISSION_LABELS).filter(
                        ([_, info]) => info.category === category
                      );

                      return (
                        <div key={category}>
                          <h4 className="text-sm font-medium text-muted-foreground mb-3">{category}</h4>
                          <div className="space-y-2">
                            {categoryPermissions.map(([key, info]) => {
                              const permissionKey = key as PermissionKey;
                              const isActive = getPermissionValue(permissionKey);
                              const isUpdating = updatingPermission === permissionKey;
                              const isOwnManageAdmins = permissionKey === 'manage_admins' && selectedAdminId === currentUserId;

                              return (
                                <div
                                  key={key}
                                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex-1 min-w-0 mr-4">
                                    <p className="font-medium text-sm">{info.label}</p>
                                    <p className="text-xs text-muted-foreground">{info.description}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isUpdating ? (
                                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                                    ) : (
                                      <Switch
                                        checked={isActive}
                                        onCheckedChange={() => handleTogglePermission(permissionKey, isActive)}
                                        disabled={!canManagePermissions || isOwnManageAdmins}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {selectedAdminId === currentUserId && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        Anda tidak dapat mengubah izin "Kelola Admin" untuk diri sendiri untuk mencegah terkunci dari sistem.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminManagement;
