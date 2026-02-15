import { useState, useMemo } from 'react';
import { User } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatCurrency } from '@/lib/mockData';
import { UserMinus, Calendar, UserCheck, Loader2, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TabNavigation } from '@/components/shared/TabNavigation';
import { useInactiveMemberData, getMemberSavingsFromMap } from '@/hooks/useInactiveMemberData';

interface ExitedMembersListProps {
  members: User[];
  onMemberReactivated?: () => void;
}

export const ExitedMembersList = ({ members, onMemberReactivated }: ExitedMembersListProps) => {
  const { toast } = useToast();
  const [reactivatingMember, setReactivatingMember] = useState<User | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const [activeTab, setActiveTab] = useState<'this-year' | 'previous-years'>('this-year');
  
  const currentYear = new Date().getFullYear();
  const exitedMembers = members.filter(m => !m.isActive && m.exitYear);
  
  // Get user IDs for fetching data
  const userIds = useMemo(() => exitedMembers.map(m => m.id), [exitedMembers]);
  
  // Fetch real savings data from database
  const { savingsMap, isLoading } = useInactiveMemberData(userIds);
  
  // Split into this year and previous years
  const thisYearExited = exitedMembers.filter(m => m.exitYear === currentYear);
  const previousYearsExited = exitedMembers.filter(m => m.exitYear && m.exitYear < currentYear);

  const handleReactivateMember = async () => {
    if (!reactivatingMember) return;
    
    setIsReactivating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_active: true,
          exit_date: null,
          exit_year: null,
        })
        .eq('user_id', reactivatingMember.id);

      if (error) throw error;

      toast({
        title: 'Anggota Diaktifkan Kembali',
        description: `${reactivatingMember.name} telah diaktifkan kembali sebagai anggota aktif.`,
      });
      
      onMemberReactivated?.();
    } catch (error: any) {
      console.error('Error reactivating member:', error);
      toast({
        title: 'Gagal Reaktivasi',
        description: error.message || 'Terjadi kesalahan saat mengaktifkan kembali anggota.',
        variant: 'destructive',
      });
    } finally {
      setIsReactivating(false);
      setReactivatingMember(null);
    }
  };

  const renderMemberList = (memberList: User[], emptyMessage: string) => {
    if (memberList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <UserMinus className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {memberList.map((member) => {
          const savings = getMemberSavingsFromMap(member.id, savingsMap);
          const totalSavings = savings?.totalSimpanan || 0;

          return (
            <div
              key={member.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {member.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.memberNumber}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Bergabung</p>
                  <p className="font-medium text-foreground">{formatDate(member.joinDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Keluar</p>
                  <p className="font-medium text-foreground">
                    {member.exitDate ? formatDate(member.exitDate) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Simpanan</p>
                  <p className="font-medium text-foreground">{formatCurrency(totalSavings)}</p>
                </div>
                <Badge variant="destructive">Tidak Aktif</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReactivatingMember(member)}
                  className="ml-2"
                >
                  <UserCheck className="mr-1 h-4 w-4" />
                  Aktifkan
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const exitedTabs = [
    { 
      value: 'this-year', 
      icon: Calendar, 
      label: `Tahun ${currentYear}`,
      badge: thisYearExited.length > 0 ? thisYearExited.length : undefined
    },
    { 
      value: 'previous-years', 
      icon: History, 
      label: 'Tahun Sebelumnya',
      badge: previousYearsExited.length > 0 ? previousYearsExited.length : undefined
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <Calendar className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{thisYearExited.length}</p>
                <p className="text-sm text-muted-foreground">Keluar Tahun Ini ({currentYear})</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <UserMinus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{previousYearsExited.length}</p>
                <p className="text-sm text-muted-foreground">Tahun Sebelumnya (Akumulasi)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <TabNavigation
        tabs={exitedTabs}
        activeTab={activeTab}
        onTabChange={(value) => setActiveTab(value as typeof activeTab)}
      />

      {/* This Year Content */}
      {activeTab === 'this-year' && (
        <Card className="animate-fade-in">
          <CardContent className="pt-6">
            {renderMemberList(thisYearExited, `Tidak ada anggota keluar di tahun ${currentYear}`)}
          </CardContent>
        </Card>
      )}

      {/* Previous Years Content */}
      {activeTab === 'previous-years' && (
        <Card className="animate-fade-in">
          <CardContent className="pt-6">
            {renderMemberList(previousYearsExited, 'Tidak ada data anggota keluar tahun sebelumnya')}
          </CardContent>
        </Card>
      )}

      {/* Reactivation Confirmation Dialog */}
      <AlertDialog open={!!reactivatingMember} onOpenChange={(open) => !open && setReactivatingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aktifkan Kembali Anggota</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin mengaktifkan kembali <strong>{reactivatingMember?.name}</strong> ({reactivatingMember?.memberNumber}) sebagai anggota aktif?
              <br /><br />
              Status anggota akan diubah menjadi aktif dan tanggal keluar akan dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReactivating}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivateMember} disabled={isReactivating}>
              {isReactivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Aktifkan
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
