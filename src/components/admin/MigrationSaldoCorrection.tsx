import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CurrencyInput } from '@/components/ui/currency-input';
import { 
  Edit, Search, Loader2, AlertCircle, History, Check, X, RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/mockData';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface MemberSavings {
  userId: string;
  name: string;
  memberNumber: string;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  totalSimpanan: number;
}

interface CorrectionHistory {
  id: string;
  createdAt: string;
  correctionType: string;
  amount: number;
  operation: string;
  reason: string;
  currentBalance: number;
  newBalance: number;
  createdByName?: string;
}

export default function MigrationSaldoCorrection() {
  const [members, setMembers] = useState<MemberSavings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberSavings | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [correctionHistory, setCorrectionHistory] = useState<CorrectionHistory[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Form state for corrections
  const [newSimpananPokok, setNewSimpananPokok] = useState(0);
  const [newSimpananWajib, setNewSimpananWajib] = useState(0);
  const [newSimpananSukarela, setNewSimpananSukarela] = useState(0);
  const [correctionReason, setCorrectionReason] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          name,
          member_number,
          savings_summary (
            simpanan_pokok,
            simpanan_wajib,
            simpanan_sukarela,
            total_simpanan
          )
        `)
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const mappedData: MemberSavings[] = (data || []).map(profile => ({
        userId: profile.user_id,
        name: profile.name,
        memberNumber: profile.member_number || '-',
        simpananPokok: (profile.savings_summary as any)?.[0]?.simpanan_pokok || 0,
        simpananWajib: (profile.savings_summary as any)?.[0]?.simpanan_wajib || 0,
        simpananSukarela: (profile.savings_summary as any)?.[0]?.simpanan_sukarela || 0,
        totalSimpanan: (profile.savings_summary as any)?.[0]?.total_simpanan || 0,
      }));

      setMembers(mappedData);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Gagal memuat data anggota');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (member: MemberSavings) => {
    setSelectedMember(member);
    setNewSimpananPokok(member.simpananPokok);
    setNewSimpananWajib(member.simpananWajib);
    setNewSimpananSukarela(member.simpananSukarela);
    setCorrectionReason('');
    setShowEditDialog(true);
  };

  const openHistoryDialog = async (member: MemberSavings) => {
    setSelectedMember(member);
    setShowHistoryDialog(true);
    setIsLoadingHistory(true);

    try {
      // Fetch corrections for this member
      const { data: corrections, error } = await supabase
        .from('corrections')
        .select(`
          id,
          created_at,
          correction_type,
          amount,
          operation,
          reason,
          current_balance,
          new_balance,
          created_by
        `)
        .eq('user_id', member.userId)
        .in('correction_type', ['simpanan_pokok', 'simpanan_wajib', 'simpanan_sukarela', 'saldo_awal_correction'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get admin names
      const adminIds = [...new Set((corrections || []).map(c => c.created_by).filter(Boolean))];
      let adminNames: Record<string, string> = {};
      
      if (adminIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', adminIds);
        
        adminNames = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = p.name;
          return acc;
        }, {} as Record<string, string>);
      }

      setCorrectionHistory((corrections || []).map(c => ({
        id: c.id,
        createdAt: c.created_at,
        correctionType: c.correction_type,
        amount: c.amount,
        operation: c.operation,
        reason: c.reason,
        currentBalance: c.current_balance,
        newBalance: c.new_balance,
        createdByName: c.created_by ? adminNames[c.created_by] || 'Admin' : 'System',
      })));
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Gagal memuat riwayat koreksi');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSaveCorrection = async () => {
    if (!selectedMember) return;
    if (!correctionReason.trim()) {
      toast.error('Alasan koreksi wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const adminId = userData?.user?.id;
      const now = new Date().toISOString();
      
      // Calculate differences
      const diffPokok = newSimpananPokok - selectedMember.simpananPokok;
      const diffWajib = newSimpananWajib - selectedMember.simpananWajib;
      const diffSukarela = newSimpananSukarela - selectedMember.simpananSukarela;
      
      const corrections = [];

      // Create correction records for each changed type
      if (diffPokok !== 0) {
        corrections.push({
          user_id: selectedMember.userId,
          correction_type: 'saldo_awal_correction',
          amount: Math.abs(diffPokok),
          operation: diffPokok > 0 ? 'add' : 'subtract',
          reason: `[Simpanan Pokok] ${correctionReason}`,
          current_balance: selectedMember.simpananPokok,
          new_balance: newSimpananPokok,
          created_by: adminId,
          status: 'approved',
        });
      }

      if (diffWajib !== 0) {
        corrections.push({
          user_id: selectedMember.userId,
          correction_type: 'saldo_awal_correction',
          amount: Math.abs(diffWajib),
          operation: diffWajib > 0 ? 'add' : 'subtract',
          reason: `[Simpanan Wajib] ${correctionReason}`,
          current_balance: selectedMember.simpananWajib,
          new_balance: newSimpananWajib,
          created_by: adminId,
          status: 'approved',
        });
      }

      if (diffSukarela !== 0) {
        corrections.push({
          user_id: selectedMember.userId,
          correction_type: 'saldo_awal_correction',
          amount: Math.abs(diffSukarela),
          operation: diffSukarela > 0 ? 'add' : 'subtract',
          reason: `[Simpanan Sukarela] ${correctionReason}`,
          current_balance: selectedMember.simpananSukarela,
          new_balance: newSimpananSukarela,
          created_by: adminId,
          status: 'approved',
        });
      }

      if (corrections.length === 0) {
        toast.info('Tidak ada perubahan saldo');
        setShowEditDialog(false);
        return;
      }

      // Insert correction records
      const { error: correctionError } = await supabase
        .from('corrections')
        .insert(corrections);

      if (correctionError) throw correctionError;

      // Update savings_summary directly
      const newTotal = newSimpananPokok + newSimpananWajib + newSimpananSukarela;
      const { error: updateError } = await supabase
        .from('savings_summary')
        .update({
          simpanan_pokok: newSimpananPokok,
          simpanan_wajib: newSimpananWajib,
          simpanan_sukarela: newSimpananSukarela,
          total_simpanan: newTotal,
          updated_at: now,
        })
        .eq('user_id', selectedMember.userId);

      if (updateError) throw updateError;

      // Log to audit
      await supabase.from('savings_audit_log').insert({
        user_id: selectedMember.userId,
        change_type: 'correction',
        old_simpanan_pokok: selectedMember.simpananPokok,
        new_simpanan_pokok: newSimpananPokok,
        old_simpanan_wajib: selectedMember.simpananWajib,
        new_simpanan_wajib: newSimpananWajib,
        old_simpanan_sukarela: selectedMember.simpananSukarela,
        new_simpanan_sukarela: newSimpananSukarela,
        old_total_simpanan: selectedMember.totalSimpanan,
        new_total_simpanan: newTotal,
        source: 'migration_correction',
        notes: correctionReason,
        changed_by: adminId,
      });

      toast.success('Koreksi saldo berhasil disimpan');
      setShowEditDialog(false);
      fetchMembers();
    } catch (error) {
      console.error('Error saving correction:', error);
      toast.error('Gagal menyimpan koreksi');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.memberNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCorrectionTypeLabel = (type: string) => {
    switch (type) {
      case 'simpanan_pokok': return 'Simpanan Pokok';
      case 'simpanan_wajib': return 'Simpanan Wajib';
      case 'simpanan_sukarela': return 'Simpanan Sukarela';
      case 'saldo_awal_correction': return 'Koreksi Saldo Awal';
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Koreksi Saldo Migrasi
          </CardTitle>
          <CardDescription>
            Edit saldo awal simpanan anggota yang sudah dimigrasi. Semua perubahan akan tercatat di audit log.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan nama atau nomor anggota..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={fetchMembers}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Anggota</TableHead>
                  <TableHead className="text-right">Simpanan Pokok</TableHead>
                  <TableHead className="text-right">Simpanan Wajib</TableHead>
                  <TableHead className="text-right">Simpanan Sukarela</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.memberNumber}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(member.simpananPokok)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(member.simpananWajib)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(member.simpananSukarela)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(member.totalSimpanan)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openHistoryDialog(member)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openEditDialog(member)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Koreksi
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Koreksi Saldo Simpanan</DialogTitle>
            <DialogDescription>
              {selectedMember && `Edit saldo simpanan ${selectedMember.name} (${selectedMember.memberNumber})`}
            </DialogDescription>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Perubahan akan langsung memperbarui saldo simpanan dan tercatat di audit log.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Simpanan Pokok</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-32">
                      Saat ini: {formatCurrency(selectedMember.simpananPokok)}
                    </span>
                    <CurrencyInput
                      value={newSimpananPokok}
                      onChange={setNewSimpananPokok}
                      className="flex-1"
                    />
                  </div>
                  {newSimpananPokok !== selectedMember.simpananPokok && (
                    <Badge variant={newSimpananPokok > selectedMember.simpananPokok ? 'default' : 'destructive'} className="w-fit">
                      {newSimpananPokok > selectedMember.simpananPokok ? '+' : ''}
                      {formatCurrency(newSimpananPokok - selectedMember.simpananPokok)}
                    </Badge>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label>Simpanan Wajib</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-32">
                      Saat ini: {formatCurrency(selectedMember.simpananWajib)}
                    </span>
                    <CurrencyInput
                      value={newSimpananWajib}
                      onChange={setNewSimpananWajib}
                      className="flex-1"
                    />
                  </div>
                  {newSimpananWajib !== selectedMember.simpananWajib && (
                    <Badge variant={newSimpananWajib > selectedMember.simpananWajib ? 'default' : 'destructive'} className="w-fit">
                      {newSimpananWajib > selectedMember.simpananWajib ? '+' : ''}
                      {formatCurrency(newSimpananWajib - selectedMember.simpananWajib)}
                    </Badge>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label>Simpanan Sukarela</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-32">
                      Saat ini: {formatCurrency(selectedMember.simpananSukarela)}
                    </span>
                    <CurrencyInput
                      value={newSimpananSukarela}
                      onChange={setNewSimpananSukarela}
                      className="flex-1"
                    />
                  </div>
                  {newSimpananSukarela !== selectedMember.simpananSukarela && (
                    <Badge variant={newSimpananSukarela > selectedMember.simpananSukarela ? 'default' : 'destructive'} className="w-fit">
                      {newSimpananSukarela > selectedMember.simpananSukarela ? '+' : ''}
                      {formatCurrency(newSimpananSukarela - selectedMember.simpananSukarela)}
                    </Badge>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label>Alasan Koreksi <span className="text-destructive">*</span></Label>
                  <Textarea
                    placeholder="Jelaskan alasan koreksi saldo ini..."
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveCorrection} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Simpan Koreksi
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Riwayat Koreksi</DialogTitle>
            <DialogDescription>
              {selectedMember && `Riwayat koreksi saldo ${selectedMember.name}`}
            </DialogDescription>
          </DialogHeader>

          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : correctionHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada riwayat koreksi</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Perubahan</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Oleh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {correctionHistory.map((history) => (
                    <TableRow key={history.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(history.createdAt), 'dd MMM yyyy HH:mm', { locale: id })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCorrectionTypeLabel(history.correctionType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="text-muted-foreground">{formatCurrency(history.currentBalance)}</span>
                          <span className="mx-2">→</span>
                          <span className="font-medium">{formatCurrency(history.newBalance)}</span>
                        </div>
                        <Badge 
                          variant={history.operation === 'add' ? 'default' : 'destructive'} 
                          className="mt-1"
                        >
                          {history.operation === 'add' ? '+' : '-'}{formatCurrency(history.amount)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={history.reason}>
                        {history.reason}
                      </TableCell>
                      <TableCell>{history.createdByName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
