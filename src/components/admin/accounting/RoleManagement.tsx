import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useRoleAssignmentsData, RoleAssignment, DEFAULT_PENGURUS_POSITIONS, SIGNATORY_POSITIONS } from '@/hooks/useSHUCalculation';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Trash2, Users, UserCheck, BookOpen, Percent, Loader2, Crown, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { getCooperativeSettings, saveCooperativeSettings, Signatory } from '@/lib/cooperativeSettings';

interface Member {
  id: string;
  user_id: string;
  name: string;
  member_number: string | null;
}

export const RoleManagement = () => {
  const { assignments, loading, addAssignment, updateAssignment, deleteAssignment, refetch } = useRoleAssignmentsData();
  const [members, setMembers] = useState<Member[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customPositions, setCustomPositions] = useState<string[]>([]);
  const [newCustomPosition, setNewCustomPosition] = useState('');
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [editingPositionValue, setEditingPositionValue] = useState('');
  const [newAssignment, setNewAssignment] = useState<{
    role: 'pengurus' | 'pengawas' | 'penasihat';
    position: string;
    isMember: boolean;
    memberId?: string;
    name?: string;
    sharePercentage: number;
  }>({
    role: 'pengurus',
    position: '',
    isMember: true,
    sharePercentage: 100,
  });

  // Load custom positions from cooperative settings
  useEffect(() => {
    const settings = getCooperativeSettings();
    if (settings.customOfficerPositions) {
      setCustomPositions(settings.customOfficerPositions);
    }
  }, []);

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

  // All available positions for pengurus
  const allPositions = [...DEFAULT_PENGURUS_POSITIONS, ...customPositions];

  // Sync officer to signatories when added/updated
  const syncToSignatories = async (name: string, position: string, action: 'add' | 'remove' | 'update', oldPosition?: string) => {
    // Only sync positions that can sign letters
    const canSign = SIGNATORY_POSITIONS.includes(position as typeof SIGNATORY_POSITIONS[number]) || 
                    (oldPosition && SIGNATORY_POSITIONS.includes(oldPosition as typeof SIGNATORY_POSITIONS[number]));
    
    if (!canSign) return;

    const settings = getCooperativeSettings();
    let signatories = [...(settings.signatories || [])];

    if (action === 'add') {
      // Check if this position+name already exists
      const exists = signatories.some(s => s.name === name && s.position === position);
      if (!exists && SIGNATORY_POSITIONS.includes(position as typeof SIGNATORY_POSITIONS[number])) {
        const newSignatory: Signatory = {
          id: Date.now().toString(),
          name,
          position,
          signatureBase64: '',
          isActive: true,
        };
        signatories.push(newSignatory);
        await saveCooperativeSettings({ ...settings, signatories });
        toast.info(`${name} ditambahkan ke daftar penandatangan surat`);
      }
    } else if (action === 'remove') {
      signatories = signatories.filter(s => !(s.name === name && s.position === position));
      await saveCooperativeSettings({ ...settings, signatories });
    } else if (action === 'update' && oldPosition) {
      // Update existing signatory
      signatories = signatories.map(s => {
        if (s.name === name && s.position === oldPosition) {
          return { ...s, position };
        }
        return s;
      });
      await saveCooperativeSettings({ ...settings, signatories });
    }
  };

  const handleAdd = async () => {
    if (!newAssignment.name && !newAssignment.memberId) {
      toast.error('Pilih anggota atau masukkan nama');
      return;
    }

    // Position is required for pengurus
    if (newAssignment.role === 'pengurus' && !newAssignment.position) {
      toast.error('Pilih jabatan untuk pengurus');
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
    const result = await addAssignment({
      name,
      role: newAssignment.role,
      position: newAssignment.role === 'pengurus' ? newAssignment.position : null,
      is_member: newAssignment.isMember,
      member_id: newAssignment.isMember ? newAssignment.memberId || null : null,
      share_percentage: newAssignment.sharePercentage,
    });

    if (result) {
      // Sync to signatories if applicable
      if (newAssignment.role === 'pengurus' && newAssignment.position) {
        await syncToSignatories(name, newAssignment.position, 'add');
      }
      
      const positionLabel = newAssignment.position ? ` (${newAssignment.position})` : '';
      toast.success(`${name} ditambahkan sebagai ${newAssignment.role}${positionLabel}`);
      setIsAdding(false);
      setNewAssignment({
        role: 'pengurus',
        position: '',
        isMember: true,
        sharePercentage: 100,
      });
    }
    setIsSaving(false);
  };

  const handleDelete = async (assignment: RoleAssignment) => {
    const success = await deleteAssignment(assignment.id);
    if (success) {
      // Remove from signatories if applicable
      if (assignment.role === 'pengurus' && assignment.position) {
        await syncToSignatories(assignment.name, assignment.position, 'remove');
      }
      toast.success('Peran dihapus');
    }
  };

  const handleUpdateShare = async (id: string, sharePercentage: number) => {
    await updateAssignment(id, { share_percentage: sharePercentage });
  };

  const handleUpdatePosition = async (assignment: RoleAssignment, newPosition: string) => {
    const oldPosition = assignment.position;
    const success = await updateAssignment(assignment.id, { position: newPosition });
    if (success) {
      // Sync to signatories
      if (oldPosition && SIGNATORY_POSITIONS.includes(oldPosition as typeof SIGNATORY_POSITIONS[number])) {
        await syncToSignatories(assignment.name, newPosition, 'update', oldPosition);
      } else if (SIGNATORY_POSITIONS.includes(newPosition as typeof SIGNATORY_POSITIONS[number])) {
        await syncToSignatories(assignment.name, newPosition, 'add');
      }
      setEditingPositionId(null);
    }
  };

  const handleAddCustomPosition = async () => {
    if (!newCustomPosition.trim()) return;
    if (allPositions.includes(newCustomPosition.trim())) {
      toast.error('Jabatan sudah ada');
      return;
    }
    
    const updated = [...customPositions, newCustomPosition.trim()];
    setCustomPositions(updated);
    
    // Save to cooperative settings
    const settings = getCooperativeSettings();
    await saveCooperativeSettings({ ...settings, customOfficerPositions: updated });
    
    setNewCustomPosition('');
    toast.success('Jabatan baru ditambahkan');
  };

  const handleRemoveCustomPosition = async (position: string) => {
    const updated = customPositions.filter(p => p !== position);
    setCustomPositions(updated);
    
    const settings = getCooperativeSettings();
    await saveCooperativeSettings({ ...settings, customOfficerPositions: updated });
    toast.success('Jabatan dihapus');
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

  const getPositionBadgeColor = (position: string | null) => {
    if (!position) return 'bg-muted text-muted-foreground';
    switch (position) {
      case 'Ketua': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'Wakil Ketua': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
      case 'Sekretaris': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'Bendahara': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      default: return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30';
    }
  };

  const groupedAssignments = {
    pengurus: assignments.filter(a => a.role === 'pengurus'),
    pengawas: assignments.filter(a => a.role === 'pengawas'),
    penasihat: assignments.filter(a => a.role === 'penasihat'),
  };

  // Sort pengurus by position priority
  const positionPriority: Record<string, number> = {
    'Ketua': 1,
    'Wakil Ketua': 2,
    'Sekretaris': 3,
    'Bendahara': 4,
  };

  groupedAssignments.pengurus.sort((a, b) => {
    const priorityA = positionPriority[a.position || ''] || 99;
    const priorityB = positionPriority[b.position || ''] || 99;
    return priorityA - priorityB;
  });

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
          <h2 className="text-base sm:text-xl font-bold text-foreground">Manajemen Peran</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Kelola pengurus, pengawas, dan penasihat koperasi untuk distribusi SHU</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="gap-1.5 sm:gap-2 h-8 sm:h-10 text-xs sm:text-sm w-full sm:w-auto">
          <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Tambah Peran
        </Button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <Card className="border-primary/20">
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="text-sm sm:text-base">Tambah Peran Baru</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Jenis Peran</Label>
              <Select 
                value={newAssignment.role} 
                onValueChange={(v) => setNewAssignment({ ...newAssignment, role: v as 'pengurus' | 'pengawas' | 'penasihat', position: '' })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pengurus" className="text-sm">Pengurus</SelectItem>
                  <SelectItem value="pengawas" className="text-sm">Pengawas</SelectItem>
                  <SelectItem value="penasihat" className="text-sm">Penasihat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Position selector for pengurus */}
            {newAssignment.role === 'pengurus' && (
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Jabatan <span className="text-destructive">*</span></Label>
                <Select 
                  value={newAssignment.position} 
                  onValueChange={(v) => setNewAssignment({ ...newAssignment, position: v })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Pilih jabatan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allPositions.map(pos => (
                      <SelectItem key={pos} value={pos} className="text-sm">
                        <div className="flex items-center gap-2">
                          {pos === 'Ketua' && <Crown className="h-3 w-3 text-amber-500" />}
                          {pos}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Jabatan seperti Ketua, Sekretaris, Bendahara akan otomatis tersedia untuk penandatangan surat
                </p>
              </div>
            )}

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
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Jika ada beberapa orang dalam satu peran, total persentase akan dinormalisasi
              </p>
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

      {/* Custom Positions Manager */}
      <Card className="border-dashed">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
            <Crown className="h-4 w-4 text-amber-500" />
            Kelola Jabatan Pengurus
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {DEFAULT_PENGURUS_POSITIONS.map(pos => (
                <Badge key={pos} variant="outline" className={`${getPositionBadgeColor(pos)} text-xs`}>
                  {pos}
                  <span className="ml-1 text-muted-foreground">(default)</span>
                </Badge>
              ))}
              {customPositions.map(pos => (
                <Badge key={pos} variant="outline" className={`${getPositionBadgeColor(pos)} text-xs group`}>
                  {pos}
                  <button 
                    onClick={() => handleRemoveCustomPosition(pos)}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newCustomPosition}
                onChange={(e) => setNewCustomPosition(e.target.value)}
                placeholder="Tambah jabatan baru..."
                className="h-8 text-xs flex-1 max-w-xs"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomPosition()}
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAddCustomPosition}
                disabled={!newCustomPosition.trim()}
                className="h-8 text-xs"
              >
                Tambah
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Groups */}
      {(['pengurus', 'pengawas', 'penasihat'] as const).map(role => (
        <Card key={role}>
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
            <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
              {getRoleIcon(role)}
              {getRoleLabel(role)}
              <Badge variant="secondary" className="ml-1.5 sm:ml-2 text-[10px] sm:text-xs">
                {groupedAssignments[role].length} orang
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {groupedAssignments[role].length === 0 ? (
              <p className="text-center text-xs sm:text-sm text-muted-foreground py-3 sm:py-4">
                Belum ada {getRoleLabel(role).toLowerCase()} yang ditetapkan
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-xs sm:text-sm">{assignment.name}</p>
                          {assignment.position && (
                            editingPositionId === assignment.id ? (
                              <div className="flex items-center gap-1">
                                <Select 
                                  value={editingPositionValue} 
                                  onValueChange={setEditingPositionValue}
                                >
                                  <SelectTrigger className="h-6 text-xs w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allPositions.map(pos => (
                                      <SelectItem key={pos} value={pos} className="text-xs">{pos}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5"
                                  onClick={() => handleUpdatePosition(assignment, editingPositionValue)}
                                >
                                  <Check className="h-3 w-3 text-green-500" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5"
                                  onClick={() => setEditingPositionId(null)}
                                >
                                  <X className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <Badge 
                                variant="outline" 
                                className={`${getPositionBadgeColor(assignment.position)} text-[8px] sm:text-[10px] cursor-pointer hover:opacity-80`}
                                onClick={() => {
                                  setEditingPositionId(assignment.id);
                                  setEditingPositionValue(assignment.position || '');
                                }}
                              >
                                {assignment.position === 'Ketua' && <Crown className="h-2.5 w-2.5 mr-0.5" />}
                                {assignment.position}
                                <Edit2 className="h-2 w-2 ml-1 opacity-50" />
                              </Badge>
                            )
                          )}
                        </div>
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
                        onClick={() => handleDelete(assignment)}
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
              <li>Pengurus, Pengawas, dan Penasihat bisa dari anggota atau non-anggota</li>
              <li>Jika dari anggota, mereka juga akan mendapat SHU Anggota secara terpisah</li>
              <li>Persentase bagian dalam satu peran akan dinormalisasi secara proporsional</li>
              <li>Data peran yang dikelola di sini akan digunakan untuk distribusi SHU</li>
              <li><strong>Pengurus dengan jabatan Ketua, Sekretaris, Bendahara otomatis tersedia sebagai penandatangan surat</strong></li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
