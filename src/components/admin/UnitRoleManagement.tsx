import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Trash2, Users, UserCheck, BookOpen, Percent, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessUnits, BusinessUnit } from '@/hooks/useBusinessUnits';

interface Member {
  id: string;
  user_id: string;
  name: string;
  member_number: string | null;
}

interface UnitRoleAssignment {
  id: string;
  name: string;
  role: 'pengurus' | 'pengawas' | 'penasihat';
  is_member: boolean;
  member_id: string | null;
  share_percentage: number;
  business_unit_id: string | null;
}

interface UnitRoleManagementProps {
  businessUnitId: string;
  businessUnitName: string;
}

export const UnitRoleManagement = ({ businessUnitId, businessUnitName }: UnitRoleManagementProps) => {
  const [assignments, setAssignments] = useState<UnitRoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newAssignment, setNewAssignment] = useState<{
    role: 'pengurus' | 'pengawas' | 'penasihat';
    isMember: boolean;
    memberId?: string;
    name?: string;
    sharePercentage: number;
  }>({
    role: 'pengurus',
    isMember: true,
    sharePercentage: 100,
  });

  // Fetch assignments for this business unit
  const fetchAssignments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('role_assignments')
      .select('*')
      .eq('business_unit_id', businessUnitId)
      .order('role', { ascending: true });

    if (error) {
      console.error('Error fetching unit role assignments:', error);
    } else {
      setAssignments((data || []).map(r => ({
        id: r.id,
        name: r.name,
        role: r.role as 'pengurus' | 'pengawas' | 'penasihat',
        is_member: r.is_member,
        member_id: r.member_id,
        share_percentage: r.share_percentage,
        business_unit_id: r.business_unit_id,
      })));
    }
    setLoading(false);
  };

  // Fetch active members from database
  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, name, member_number')
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .order('name');
      
      if (data) {
        setMembers(data);
      }
    };
    fetchMembers();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [businessUnitId]);

  const handleAdd = async () => {
    if (!newAssignment.name && !newAssignment.memberId) {
      toast.error('Pilih anggota atau masukkan nama');
      return;
    }

    const name = newAssignment.isMember 
      ? members.find(m => m.user_id === newAssignment.memberId)?.name || ''
      : newAssignment.name || '';

    if (!name) {
      toast.error('Nama tidak boleh kosong');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('role_assignments').insert([{
      name,
      role: newAssignment.role,
      is_member: newAssignment.isMember,
      member_id: newAssignment.isMember ? newAssignment.memberId : null,
      share_percentage: newAssignment.sharePercentage,
      business_unit_id: businessUnitId,
    }]);

    if (error) {
      console.error('Error adding unit role assignment:', error);
      toast.error('Gagal menambah pengurus unit');
    } else {
      toast.success(`${name} ditambahkan sebagai ${newAssignment.role} di ${businessUnitName}`);
      setIsAdding(false);
      setNewAssignment({
        role: 'pengurus',
        isMember: true,
        sharePercentage: 100,
      });
      fetchAssignments();
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('role_assignments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Gagal menghapus pengurus');
    } else {
      toast.success('Pengurus unit dihapus');
      fetchAssignments();
    }
  };

  const handleUpdateShare = async (id: string, sharePercentage: number) => {
    const { error } = await supabase
      .from('role_assignments')
      .update({ share_percentage: sharePercentage })
      .eq('id', id);

    if (error) {
      console.error('Error updating share:', error);
      toast.error('Gagal mengupdate persentase');
    } else {
      fetchAssignments();
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'pengurus': return <UserCheck className="h-4 w-4" />;
      case 'pengawas': return <BookOpen className="h-4 w-4" />;
      case 'penasihat': return <Percent className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'pengurus': return 'Pengurus';
      case 'pengawas': return 'Pengawas';
      case 'penasihat': return 'Penasihat';
      default: return role;
    }
  };

  const groupedAssignments = {
    pengurus: assignments.filter(a => a.role === 'pengurus'),
    pengawas: assignments.filter(a => a.role === 'pengawas'),
    penasihat: assignments.filter(a => a.role === 'penasihat'),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 sm:py-12">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Pengurus Unit: {businessUnitName}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Kelola pengurus yang bertanggung jawab untuk unit usaha ini
          </p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="gap-1.5 sm:gap-2 h-8 sm:h-10 text-xs sm:text-sm w-full sm:w-auto">
          <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Tambah Pengurus
        </Button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <Card className="border-primary/20">
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="text-sm sm:text-base">Tambah Pengurus Unit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Jenis Peran</Label>
              <Select 
                value={newAssignment.role} 
                onValueChange={(v) => setNewAssignment({ ...newAssignment, role: v as 'pengurus' | 'pengawas' | 'penasihat' })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pengurus" className="text-sm">Pengurus Unit</SelectItem>
                  <SelectItem value="pengawas" className="text-sm">Pengawas Unit</SelectItem>
                  <SelectItem value="penasihat" className="text-sm">Penasihat Unit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Switch 
                checked={newAssignment.isMember}
                onCheckedChange={(v) => setNewAssignment({ 
                  ...newAssignment, 
                  isMember: v,
                  memberId: undefined,
                  name: '',
                })}
              />
              <Label className="text-xs sm:text-sm">Dari Anggota Koperasi</Label>
            </div>

            {newAssignment.isMember ? (
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Pilih Anggota</Label>
                <Select 
                  value={newAssignment.memberId} 
                  onValueChange={(v) => setNewAssignment({ ...newAssignment, memberId: v })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Pilih anggota..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(member => (
                      <SelectItem key={member.user_id} value={member.user_id} className="text-sm">
                        {member.name} ({member.member_number || '-'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Nama</Label>
                <Input 
                  value={newAssignment.name || ''}
                  onChange={(e) => setNewAssignment({ ...newAssignment, name: e.target.value })}
                  placeholder="Masukkan nama..."
                  className="h-9 text-sm"
                />
              </div>
            )}

            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Persentase Bagian (dalam kelompok perannya)</Label>
              <Input 
                type="number"
                min={1}
                max={100}
                value={newAssignment.sharePercentage}
                onChange={(e) => setNewAssignment({ 
                  ...newAssignment, 
                  sharePercentage: Number(e.target.value) 
                })}
                className="h-9 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={isSaving} size="sm" className="text-xs sm:text-sm">
                {isSaving ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin mr-1.5 sm:mr-2" /> : null}
                Simpan
              </Button>
              <Button variant="outline" onClick={() => setIsAdding(false)} size="sm" className="text-xs sm:text-sm">Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Groups */}
      {(['pengurus', 'pengawas', 'penasihat'] as const).map(role => (
        <Card key={role}>
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
            <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
              {getRoleIcon(role)}
              {getRoleLabel(role)} Unit
              <Badge variant="secondary" className="ml-1.5 sm:ml-2 text-[10px] sm:text-xs">
                {groupedAssignments[role].length} orang
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {groupedAssignments[role].length === 0 ? (
              <p className="text-center text-xs sm:text-sm text-muted-foreground py-3 sm:py-4">
                Belum ada {getRoleLabel(role).toLowerCase()} unit yang ditetapkan
              </p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {groupedAssignments[role].map(assignment => (
                  <div 
                    key={assignment.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-2.5 sm:p-3 gap-2 sm:gap-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div>
                        <p className="font-medium text-xs sm:text-sm">{assignment.name}</p>
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                          {assignment.is_member ? (
                            <Badge variant="default" className="text-[8px] sm:text-[10px] h-4 sm:h-5">Anggota</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] sm:text-[10px] h-4 sm:h-5">Non-Anggota</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 justify-end">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Input 
                          type="number"
                          className="w-16 sm:w-20 h-7 sm:h-8 text-xs sm:text-sm"
                          value={assignment.share_percentage}
                          onChange={(e) => handleUpdateShare(assignment.id, Number(e.target.value))}
                          min={1}
                          max={100}
                        />
                        <span className="text-xs sm:text-sm text-muted-foreground">%</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(assignment.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Info */}
      <Card className="border-muted bg-muted/20">
        <CardContent className="py-3 sm:py-4 px-3 sm:px-6">
          <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
            <p><strong>Catatan:</strong></p>
            <ul className="list-disc list-inside space-y-0.5 sm:space-y-1 ml-1 sm:ml-2 text-[10px] sm:text-sm">
              <li>Pengurus unit bertanggung jawab atas operasional unit usaha {businessUnitName}</li>
              <li>Pengurus unit berbeda dengan pengurus koperasi pusat</li>
              <li>Persentase bagian akan digunakan untuk distribusi SHU unit jika berlaku</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnitRoleManagement;
