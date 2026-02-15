import { useState, useEffect, useCallback } from 'react';
import { MemberService, DatabaseUser, ApprovalStatus, CooperativeSettingsService } from '@/lib/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TabNavigation } from '@/components/shared/TabNavigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CurrencyInput } from '@/components/ui/currency-input';
import { 
  Check, 
  X, 
  Mail, 
  Phone, 
  CreditCard, 
  Calendar, 
  Clock, 
  CheckCircle2,
  XCircle,
  UserPlus,
  AlertTriangle,
  Image as ImageIcon,
  ExternalLink,
  Wallet,
  Coins,
  Pencil,
  User,
  Briefcase,
  ChevronDown,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { formatCurrency } from '@/lib/mockData';

interface CoopBankSettings {
  bank_account_number: string;
  contact_phone: string;
}

interface InitialSavings {
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
}

interface MemberSavings {
  user_id: string;
  simpanan_pokok: number;
  simpanan_wajib: number;
  simpanan_sukarela: number;
  total_simpanan: number;
}

export const RegistrationRequests = () => {
  const { t } = useThemeLanguage();
  const [registrations, setRegistrations] = useState<DatabaseUser[]>([]);
  const [memberSavings, setMemberSavings] = useState<Record<string, MemberSavings>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DatabaseUser | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [coopSettings, setCoopSettings] = useState<CoopBankSettings>({ bank_account_number: '', contact_phone: '' });
  const [settingsConfigured, setSettingsConfigured] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isEditingSavings, setIsEditingSavings] = useState(false);
  const [editSavingsDialogOpen, setEditSavingsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [defaultSavings, setDefaultSavings] = useState<{ simpananPokok: number; simpananWajib: number }>({
    simpananPokok: 0,
    simpananWajib: 0,
  });
  const [initialSavings, setInitialSavings] = useState<InitialSavings>({
    simpananPokok: 0,
    simpananWajib: 0,
    simpananSukarela: 0,
  });
  const [decryptedNiks, setDecryptedNiks] = useState<Record<string, string>>({});
  const [editSavings, setEditSavings] = useState<InitialSavings>({
    simpananPokok: 0,
    simpananWajib: 0,
    simpananSukarela: 0,
  });

  const fetchDecryptedNiks = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    const niksMap: Record<string, string> = {};
    
    // Fetch decrypted NIKs in parallel
    const results = await Promise.allSettled(
      userIds.map(async (userId) => {
        const { data, error } = await supabase.rpc('get_decrypted_nik', { 
          p_user_id: userId 
        });
        if (!error && data) {
          return { userId, nik: data as string };
        }
        return null;
      })
    );
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        niksMap[result.value.userId] = result.value.nik;
      }
    });
    
    setDecryptedNiks(prev => ({ ...prev, ...niksMap }));
  }, []);

  const fetchCoopSettings = async () => {
    try {
      const settings = await CooperativeSettingsService.getMultipleSettings([
        'bank_account_number', 
        'contact_phone',
        'simpanan_pokok',
        'simpanan_wajib'
      ]);
      const bankNumber = settings['bank_account_number'];
      const phone = settings['contact_phone'];
      
      // Safely convert to string and trim - handles number, string, null, undefined
      const bankStr = bankNumber != null ? String(bankNumber).trim() : '';
      const phoneStr = phone != null ? String(phone).trim() : '';
      
      setCoopSettings({ bank_account_number: bankStr, contact_phone: phoneStr });
      setSettingsConfigured(bankStr !== '' && phoneStr !== '');
      
      // Set default savings from cooperative settings
      setDefaultSavings({
        simpananPokok: Number(settings['simpanan_pokok']) || 0,
        simpananWajib: Number(settings['simpanan_wajib']) || 0,
      });
    } catch (error) {
      console.error('Error fetching coop settings:', error);
    }
  };

  const fetchRegistrations = async () => {
    try {
      setIsLoading(true);
      const data = await MemberService.getAllRegistrations();
      // Filter out admin users, only show member registrations
      const members = data.filter(m => m.role === 'member');
      setRegistrations(members);
      
      // Fetch decrypted NIKs for all members
      const allUserIds = members.map(m => m.id);
      if (allUserIds.length > 0) {
        fetchDecryptedNiks(allUserIds);
      }
      
      // Fetch savings for approved members
      const approvedMembers = members.filter(m => m.approvalStatus === 'approved');
      if (approvedMembers.length > 0) {
        const userIds = approvedMembers.map(m => m.id);
        const { data: savingsData, error } = await supabase
          .from('savings_summary')
          .select('user_id, simpanan_pokok, simpanan_wajib, simpanan_sukarela, total_simpanan')
          .in('user_id', userIds);
        
        if (!error && savingsData) {
          const savingsMap: Record<string, MemberSavings> = {};
          savingsData.forEach(s => {
            savingsMap[s.user_id] = s as MemberSavings;
          });
          setMemberSavings(savingsMap);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching registrations:', error);
      toast.error('Gagal memuat data pendaftaran');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
    fetchCoopSettings();
  }, []);

  const openApproveDialog = (user: DatabaseUser) => {
    setSelectedUser(user);
    setInitialSavings({
      simpananPokok: defaultSavings.simpananPokok,
      simpananWajib: defaultSavings.simpananWajib,
      simpananSukarela: 0,
    });
    setApproveDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedUser) return;
    
    // Validate required savings
    if (initialSavings.simpananPokok <= 0) {
      toast.error(t('Simpanan Pokok harus diisi', 'Principal Savings is required'));
      return;
    }
    
    if (initialSavings.simpananWajib <= 0) {
      toast.error(t('Simpanan Wajib harus diisi', 'Mandatory Savings is required'));
      return;
    }

    setIsApproving(true);
    
    try {
      // First, update the profile to approved status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          approval_status: 'approved',
          is_active: true,
        })
        .eq('user_id', selectedUser.id);

      if (profileError) throw profileError;

      // Note: savings_summary will be updated by the database trigger when transactions are created below

      // Create initial transactions for record keeping
      const now = new Date().toISOString();
      const transactions = [];

      if (initialSavings.simpananPokok > 0) {
        transactions.push({
          user_id: selectedUser.id,
          type: 'simpanan_pokok' as const,
          amount: initialSavings.simpananPokok,
          status: 'approved' as const,
          payment_method: 'transfer_bank' as const,
          account_holder_name: selectedUser.name,
          notes: 'Setoran awal saat pendaftaran',
          approved_at: now,
        });
      }

      if (initialSavings.simpananWajib > 0) {
        transactions.push({
          user_id: selectedUser.id,
          type: 'simpanan_wajib' as const,
          amount: initialSavings.simpananWajib,
          status: 'approved' as const,
          payment_method: 'transfer_bank' as const,
          account_holder_name: selectedUser.name,
          notes: 'Setoran awal saat pendaftaran',
          approved_at: now,
        });
      }

      if (initialSavings.simpananSukarela > 0) {
        transactions.push({
          user_id: selectedUser.id,
          type: 'simpanan_sukarela' as const,
          amount: initialSavings.simpananSukarela,
          status: 'approved' as const,
          payment_method: 'transfer_bank' as const,
          account_holder_name: selectedUser.name,
          notes: 'Setoran awal saat pendaftaran',
          approved_at: now,
        });
      }

      let transactionsFailed = false;
      
      if (transactions.length > 0) {
        const { error: txError } = await supabase
          .from('transactions')
          .insert(transactions);

        if (txError) {
          console.error('Error creating initial transactions:', txError);
          transactionsFailed = true;
          
          // Fallback: Update savings_summary directly if transaction insert failed
          // This ensures member savings are recorded even if RLS blocks transaction insert
          const totalSimpanan = initialSavings.simpananPokok + initialSavings.simpananWajib + initialSavings.simpananSukarela;
          
          const { error: savingsError } = await supabase
            .from('savings_summary')
            .upsert({
              user_id: selectedUser.id,
              simpanan_pokok: initialSavings.simpananPokok,
              simpanan_wajib: initialSavings.simpananWajib,
              simpanan_sukarela: initialSavings.simpananSukarela,
              total_simpanan: totalSimpanan,
            }, { onConflict: 'user_id' });
          
          if (savingsError) {
            console.error('Error updating savings summary:', savingsError);
            toast.error(t('Simpanan awal gagal disimpan, silakan update manual', 'Initial savings failed to save, please update manually'));
          } else {
            console.log('Savings summary updated directly via fallback');
          }
        }
      }

      // Send email notification to member
      try {
        await supabase.functions.invoke('send-registration-notification', {
          body: {
            userId: selectedUser.id,
            status: 'approved',
            memberName: selectedUser.name,
            memberEmail: selectedUser.email,
          },
        });
        console.log('Approval email sent successfully');
      } catch (emailError) {
        console.error('Error sending approval email:', emailError);
        // Don't fail the approval if email fails
      }

      toast.success(`${t('Pendaftaran', 'Registration')} ${selectedUser.name} ${t('telah disetujui dengan simpanan awal', 'has been approved with initial savings')}: ${formatCurrency(initialSavings.simpananPokok + initialSavings.simpananWajib + initialSavings.simpananSukarela)}`);
      fetchRegistrations();
      setApproveDialogOpen(false);
      setSelectedUser(null);
      setInitialSavings({ simpananPokok: 0, simpananWajib: 0, simpananSukarela: 0 });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error approving registration:', error);
      toast.error(t('Gagal menyetujui pendaftaran', 'Failed to approve registration'));
    } finally {
      setIsApproving(false);
    }
  };

  const openEditSavingsDialog = (member: DatabaseUser) => {
    setSelectedUser(member);
    const savings = memberSavings[member.id];
    setEditSavings({
      simpananPokok: savings?.simpanan_pokok || 0,
      simpananWajib: savings?.simpanan_wajib || 0,
      simpananSukarela: savings?.simpanan_sukarela || 0,
    });
    setEditSavingsDialogOpen(true);
  };

  const handleEditSavings = async () => {
    if (!selectedUser) return;
    
    // Validate required savings
    if (editSavings.simpananPokok <= 0) {
      toast.error(t('Simpanan Pokok harus diisi', 'Principal Savings is required'));
      return;
    }
    
    if (editSavings.simpananWajib <= 0) {
      toast.error(t('Simpanan Wajib harus diisi', 'Mandatory Savings is required'));
      return;
    }

    setIsEditingSavings(true);
    
    try {
      const totalSimpanan = editSavings.simpananPokok + editSavings.simpananWajib + editSavings.simpananSukarela;
      
      const { error: savingsError } = await supabase
        .from('savings_summary')
        .update({
          simpanan_pokok: editSavings.simpananPokok,
          simpanan_wajib: editSavings.simpananWajib,
          simpanan_sukarela: editSavings.simpananSukarela,
          total_simpanan: totalSimpanan,
        })
        .eq('user_id', selectedUser.id);

      if (savingsError) throw savingsError;

      toast.success(`${t('Simpanan', 'Savings')} ${selectedUser.name} ${t('berhasil diperbarui', 'has been updated')}: ${formatCurrency(totalSimpanan)}`);
      fetchRegistrations();
      setEditSavingsDialogOpen(false);
      setSelectedUser(null);
      setEditSavings({ simpananPokok: 0, simpananWajib: 0, simpananSukarela: 0 });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error updating savings:', error);
      toast.error(t('Gagal memperbarui simpanan', 'Failed to update savings'));
    } finally {
      setIsEditingSavings(false);
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;
    
    try {
      // Update profile directly in Supabase
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          approval_status: 'rejected',
          rejection_reason: rejectionReason || null,
          is_active: false,
        })
        .eq('user_id', selectedUser.id);

      if (profileError) {
        console.error('Error rejecting registration:', profileError);
        toast.error(t('Gagal menolak pendaftaran', 'Failed to reject registration'));
        return;
      }

      // Send email notification to member
      try {
        await supabase.functions.invoke('send-registration-notification', {
          body: {
            userId: selectedUser.id,
            status: 'rejected',
            rejectionReason: rejectionReason || undefined,
            memberName: selectedUser.name,
            memberEmail: selectedUser.email,
          },
        });
        console.log('Rejection email sent successfully');
      } catch (emailError) {
        console.error('Error sending rejection email:', emailError);
        // Don't fail the rejection if email fails
      }

      toast.success(`${t('Pendaftaran', 'Registration')} ${selectedUser.name} ${t('telah ditolak', 'has been rejected')}`);
      fetchRegistrations();
      setRejectDialogOpen(false);
      setSelectedUser(null);
      setRejectionReason('');
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error rejecting registration:', error);
      toast.error(t('Gagal menolak pendaftaran', 'Failed to reject registration'));
    }
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-warning text-warning"><Clock className="mr-1 h-3 w-3" /> {t('Menunggu', 'Pending')}</Badge>;
      case 'approved':
        return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3 w-3" /> {t('Disetujui', 'Approved')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> {t('Ditolak', 'Rejected')}</Badge>;
      default:
        return null;
    }
  };

  const pendingRegistrations = registrations.filter(r => r.approvalStatus === 'pending');
  const approvedRegistrations = registrations.filter(r => r.approvalStatus === 'approved');
  const rejectedRegistrations = registrations.filter(r => r.approvalStatus === 'rejected');

  const renderRegistrationCard = (member: DatabaseUser) => (
    <Card key={member.id} className="animate-fade-in">
      <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg truncate">{member.name}</CardTitle>
            <div className="mt-1.5 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('Daftar', 'Registered')}: {formatDate(member.joinDate)}</span>
            </div>
          </div>
          <div className="shrink-0">{getStatusBadge(member.approvalStatus)}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-6 pt-0 sm:pt-0 md:pt-0">
        <div className="grid gap-2.5 sm:gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
            <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">NIK:</span>
            <span className="font-medium truncate">
              {decryptedNiks[member.id] || member.nik || '(memuat...)'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">{t('TTL', 'DOB')}:</span>
            <span className="font-medium truncate">
              {member.birthPlace || '-'}, {member.birthDate ? formatDate(member.birthDate) : '-'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">{t('Jenis Kelamin', 'Gender')}:</span>
            <span className="font-medium truncate">{member.gender === 'male' ? t('Laki-laki', 'Male') : member.gender === 'female' ? t('Perempuan', 'Female') : '-'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
            <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">{t('Pekerjaan', 'Occupation')}:</span>
            <span className="font-medium truncate">{member.occupation || '-'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
            <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">HP:</span>
            <span className="font-medium truncate">{member.phone || '-'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
            <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">Email:</span>
            <span className="font-medium truncate">{member.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm col-span-2 min-w-0">
            <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{t('No. Rekening', 'Account No')}:</span>
            <span className="font-medium">{member.bankAccountNumber || '-'}</span>
          </div>
        </div>

        {/* Payment Proof or Approval Date with Savings */}
        {member.approvalStatus === 'approved' ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-success/30 bg-success/5 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-success">
                  {t('Tanggal bergabung menjadi anggota', 'Member join date')}: {formatDate(member.joinDate)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">({t('Tanggal disetujui admin', 'Admin approval date')})</p>
            </div>
            
            {/* Initial Savings Display */}
            {memberSavings[member.id] && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{t('Simpanan Awal', 'Initial Savings')}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => openEditSavingsDialog(member)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    {t('Edit', 'Edit')}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('Pokok', 'Principal')}:</span>
                    <span className="font-medium">{formatCurrency(memberSavings[member.id].simpanan_pokok || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('Wajib', 'Mandatory')}:</span>
                    <span className="font-medium">{formatCurrency(memberSavings[member.id].simpanan_wajib || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('Sukarela', 'Voluntary')}:</span>
                    <span className="font-medium">{formatCurrency(memberSavings[member.id].simpanan_sukarela || 0)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-primary">
                    <span>{t('Total', 'Total')}:</span>
                    <span>{formatCurrency(memberSavings[member.id].total_simpanan || 0)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : member.paymentProofUrl ? (
          <div className="rounded-lg border border-success/30 bg-success/5 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-success">{t('Bukti Transfer Tersedia', 'Payment Proof Available')}</span>
              </div>
              <a 
                href={member.paymentProofUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {t('Lihat', 'View')}
              </a>
            </div>
            <div className="mt-2 rounded overflow-hidden">
              <img 
                src={member.paymentProofUrl} 
                alt={t('Bukti transfer', 'Payment proof')} 
                className="w-full max-h-40 object-contain bg-muted"
              />
            </div>
          </div>
        ) : null}

        {member.approvalStatus === 'rejected' && member.rejectionReason && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive">{t('Alasan Penolakan', 'Rejection Reason')}:</p>
            <p className="text-muted-foreground">{member.rejectionReason}</p>
          </div>
        )}

        {member.approvalStatus === 'pending' && (
          <div className="flex gap-3 pt-2">
            <Button 
              onClick={() => openApproveDialog(member)}
              className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
            >
              <Check className="mr-2 h-4 w-4" />
              {t('Setujui', 'Approve')}
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                setSelectedUser(member);
                setRejectDialogOpen(true);
              }}
              className="flex-1"
            >
              <X className="mr-2 h-4 w-4" />
              {t('Tolak', 'Reject')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('Permintaan Pendaftaran', 'Registration Requests')}</h1>
          <p className="mt-1 text-muted-foreground">{t('Kelola permintaan pendaftaran anggota baru', 'Manage new member registration requests')}</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">{t('Memuat data...', 'Loading data...')}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('Permintaan Pendaftaran', 'Registration Requests')}</h1>
        <p className="mt-1 text-muted-foreground">{t('Kelola permintaan pendaftaran anggota baru', 'Manage new member registration requests')}</p>
      </div>

      <TabNavigation
        tabs={[
          {
            value: 'pending',
            icon: Clock,
            label: t('Menunggu', 'Pending'),
            badge: pendingRegistrations.length > 0 ? pendingRegistrations.length : undefined,
          },
          {
            value: 'approved',
            icon: CheckCircle2,
            label: t('Disetujui', 'Approved'),
            badge: approvedRegistrations.length > 0 ? approvedRegistrations.length : undefined,
          },
          {
            value: 'rejected',
            icon: XCircle,
            label: t('Ditolak', 'Rejected'),
            badge: rejectedRegistrations.length > 0 ? rejectedRegistrations.length : undefined,
          },
        ]}
        activeTab={activeTab}
        onTabChange={(value) => setActiveTab(value as 'pending' | 'approved' | 'rejected')}
      />

      {activeTab === 'pending' && (
        <div className="space-y-4 animate-fade-in">
          {pendingRegistrations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <UserPlus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{t('Tidak Ada Permintaan', 'No Requests')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('Belum ada permintaan pendaftaran yang menunggu persetujuan', 'No pending registration requests')}
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingRegistrations.map(renderRegistrationCard)
          )}
        </div>
      )}

      {activeTab === 'approved' && (
        <div className="space-y-4 animate-fade-in">
          {approvedRegistrations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{t('Tidak Ada Data', 'No Data')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('Belum ada pendaftaran yang disetujui', 'No approved registrations yet')}
                </p>
              </CardContent>
            </Card>
          ) : (
            approvedRegistrations.map(renderRegistrationCard)
          )}
        </div>
      )}

      {activeTab === 'rejected' && (
        <div className="space-y-4 animate-fade-in">
          {rejectedRegistrations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <XCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{t('Tidak Ada Data', 'No Data')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('Belum ada pendaftaran yang ditolak', 'No rejected registrations yet')}
                </p>
              </CardContent>
            </Card>
          ) : (
            rejectedRegistrations.map(renderRegistrationCard)
          )}
        </div>
      )}

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Tolak Pendaftaran', 'Reject Registration')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `Apakah Anda yakin ingin menolak pendaftaran ${selectedUser?.name}? Calon anggota tidak akan bisa login dengan akun ini.`,
                `Are you sure you want to reject the registration of ${selectedUser?.name}? The applicant will not be able to login with this account.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">{t('Alasan Penolakan (opsional)', 'Rejection Reason (optional)')}</label>
            <Textarea
              placeholder={t('Jelaskan alasan penolakan...', 'Explain the rejection reason...')}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedUser(null);
              setRejectionReason('');
            }}>
              {t('Batal', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('Tolak Pendaftaran', 'Reject Registration')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Dialog with Initial Savings Input */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-2xl mx-4 sm:mx-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success shrink-0" />
              {t('Setujui Pendaftaran', 'Approve Registration')}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {t('Masukkan simpanan awal untuk', 'Enter initial savings for')} <strong>{selectedUser?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 sm:py-4">
            {/* Hint for default values */}
            {(defaultSavings.simpananPokok > 0 || defaultSavings.simpananWajib > 0) && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-xs text-muted-foreground">
                <span className="text-primary font-medium">{t('💡 Nilai saran', '💡 Suggested values')}</span>
                {' '}{t('dari pengaturan sistem. Dapat diubah jika diperlukan.', 'from system settings. Can be modified if needed.')}
              </div>
            )}

            {/* Simpanan Pokok - Required */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <Coins className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{t('Simpanan Pokok', 'Principal Savings')}</span>
                <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput
                value={initialSavings.simpananPokok}
                onChange={(value) => setInitialSavings(prev => ({ ...prev, simpananPokok: value }))}
                placeholder="0"
              />
            </div>

            {/* Simpanan Wajib - Required */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <Wallet className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{t('Simpanan Wajib', 'Mandatory Savings')}</span>
                <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput
                value={initialSavings.simpananWajib}
                onChange={(value) => setInitialSavings(prev => ({ ...prev, simpananWajib: value }))}
                placeholder="0"
              />
            </div>

            {/* Simpanan Sukarela - Collapsible */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between px-2 h-8 text-muted-foreground hover:text-foreground">
                  <span className="flex items-center gap-1.5 text-sm">
                    <CreditCard className="h-3.5 w-3.5 shrink-0" />
                    {t('Simpanan Sukarela', 'Voluntary Savings')}
                    <span className="text-xs">({t('opsional', 'optional')})</span>
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <CurrencyInput
                  value={initialSavings.simpananSukarela}
                  onChange={(value) => setInitialSavings(prev => ({ ...prev, simpananSukarela: value }))}
                  placeholder="0"
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Summary - Compact */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t('Pokok', 'Principal')}:</span>
                <span className="font-medium">{formatCurrency(initialSavings.simpananPokok)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t('Wajib', 'Mandatory')}:</span>
                <span className="font-medium">{formatCurrency(initialSavings.simpananWajib)}</span>
              </div>
              {initialSavings.simpananSukarela > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('Sukarela', 'Voluntary')}:</span>
                  <span className="font-medium">{formatCurrency(initialSavings.simpananSukarela)}</span>
                </div>
              )}
              <div className="border-t pt-1 flex justify-between text-sm font-semibold">
                <span>{t('Total', 'Total')}:</span>
                <span className="text-primary">
                  {formatCurrency(initialSavings.simpananPokok + initialSavings.simpananWajib + initialSavings.simpananSukarela)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setApproveDialogOpen(false);
                setSelectedUser(null);
                setInitialSavings({ simpananPokok: 0, simpananWajib: 0, simpananSukarela: 0 });
              }}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              {t('Batal', 'Cancel')}
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isApproving || initialSavings.simpananPokok <= 0 || initialSavings.simpananWajib <= 0}
              className="bg-success hover:bg-success/90 text-success-foreground w-full sm:w-auto order-1 sm:order-2"
            >
              {isApproving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  {t('Memproses...', 'Processing...')}
                </span>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {t('Setujui', 'Approve')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Savings Dialog */}
      <Dialog open={editSavingsDialogOpen} onOpenChange={setEditSavingsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              {t('Edit Simpanan Awal', 'Edit Initial Savings')}
            </DialogTitle>
            <DialogDescription>
              {t('Perbarui simpanan awal untuk', 'Update initial savings for')} <strong>{selectedUser?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Simpanan Pokok - Required */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                {t('Simpanan Pokok', 'Principal Savings')} <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput
                value={editSavings.simpananPokok}
                onChange={(value) => setEditSavings(prev => ({ ...prev, simpananPokok: value }))}
                placeholder="0"
              />
            </div>

            {/* Simpanan Wajib - Required */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                {t('Simpanan Wajib', 'Mandatory Savings')} <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput
                value={editSavings.simpananWajib}
                onChange={(value) => setEditSavings(prev => ({ ...prev, simpananWajib: value }))}
                placeholder="0"
              />
            </div>

            {/* Simpanan Sukarela - Optional */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                {t('Simpanan Sukarela', 'Voluntary Savings')} <span className="text-muted-foreground text-xs">({t('opsional', 'optional')})</span>
              </Label>
              <CurrencyInput
                value={editSavings.simpananSukarela}
                onChange={(value) => setEditSavings(prev => ({ ...prev, simpananSukarela: value }))}
                placeholder="0"
              />
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('Simpanan Pokok', 'Principal')}:</span>
                <span className="font-medium">{formatCurrency(editSavings.simpananPokok)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('Simpanan Wajib', 'Mandatory')}:</span>
                <span className="font-medium">{formatCurrency(editSavings.simpananWajib)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('Simpanan Sukarela', 'Voluntary')}:</span>
                <span className="font-medium">{formatCurrency(editSavings.simpananSukarela)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                <span>{t('Total Simpanan', 'Total Savings')}:</span>
                <span className="text-primary">
                  {formatCurrency(editSavings.simpananPokok + editSavings.simpananWajib + editSavings.simpananSukarela)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setEditSavingsDialogOpen(false);
                setSelectedUser(null);
                setEditSavings({ simpananPokok: 0, simpananWajib: 0, simpananSukarela: 0 });
              }}
            >
              {t('Batal', 'Cancel')}
            </Button>
            <Button
              onClick={handleEditSavings}
              disabled={isEditingSavings || editSavings.simpananPokok <= 0 || editSavings.simpananWajib <= 0}
            >
              {isEditingSavings ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  {t('Menyimpan...', 'Saving...')}
                </span>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {t('Simpan Perubahan', 'Save Changes')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
