import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, UserPlus, Users, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface OrphanUser {
  id: string;
  email: string;
  created_at: string;
  name: string | null;
  last_sign_in_at: string | null;
}

const OrphanUserSync: React.FC = () => {
  const [orphanUsers, setOrphanUsers] = useState<OrphanUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const fetchOrphanUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sesi tidak valid');
        return;
      }

      const response = await supabase.functions.invoke('sync-orphan-users', {
        body: { action: 'list' },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setOrphanUsers(response.data.orphanUsers || []);
    } catch (error: any) {
      console.error('Error fetching orphan users:', error);
      toast.error('Gagal memuat data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const syncUser = async (userId: string) => {
    setSyncing(userId);
    try {
      const response = await supabase.functions.invoke('sync-orphan-users', {
        body: { action: 'sync', userId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success('Profile berhasil disinkronkan');
      // Remove synced user from list
      setOrphanUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error: any) {
      console.error('Error syncing user:', error);
      toast.error('Gagal sinkronisasi: ' + error.message);
    } finally {
      setSyncing(null);
    }
  };

  const syncAllUsers = async () => {
    if (orphanUsers.length === 0) {
      toast.info('Tidak ada user yang perlu disinkronkan');
      return;
    }

    setSyncingAll(true);
    try {
      const response = await supabase.functions.invoke('sync-orphan-users', {
        body: { action: 'sync-all' },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { syncedCount, totalOrphans, errors } = response.data;
      
      if (errors && errors.length > 0) {
        toast.warning(`${syncedCount}/${totalOrphans} user berhasil disinkronkan. ${errors.length} gagal.`);
      } else {
        toast.success(`${syncedCount} user berhasil disinkronkan`);
      }
      
      // Refresh the list
      await fetchOrphanUsers();
    } catch (error: any) {
      console.error('Error syncing all users:', error);
      toast.error('Gagal sinkronisasi: ' + error.message);
    } finally {
      setSyncingAll(false);
    }
  };

  useEffect(() => {
    fetchOrphanUsers();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Tanpa Profile
            </CardTitle>
            <CardDescription>
              Daftar user yang terdaftar di sistem autentikasi namun belum memiliki profile
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOrphanUsers}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {orphanUsers.length > 0 && (
              <Button
                size="sm"
                onClick={syncAllUsers}
                disabled={syncingAll}
              >
                {syncingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Sync Semua ({orphanUsers.length})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : orphanUsers.length === 0 ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Semua user sudah memiliki profile. Tidak ada yang perlu disinkronkan.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert className="mb-4" variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Ditemukan {orphanUsers.length} user tanpa profile. User ini tidak dapat login dengan benar 
                hingga profile dibuat. Klik "Sync" untuk membuat profile otomatis.
              </AlertDescription>
            </Alert>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Terdaftar</TableHead>
                    <TableHead>Login Terakhir</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orphanUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        {user.name || (
                          <Badge variant="secondary">Tidak ada</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(user.created_at), 'dd MMM yyyy HH:mm', { locale: id })}
                      </TableCell>
                      <TableCell>
                        {user.last_sign_in_at ? (
                          format(new Date(user.last_sign_in_at), 'dd MMM yyyy HH:mm', { locale: id })
                        ) : (
                          <Badge variant="outline">Belum pernah</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => syncUser(user.id)}
                          disabled={syncing === user.id}
                        >
                          {syncing === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 mr-1" />
                              Sync
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OrphanUserSync;
