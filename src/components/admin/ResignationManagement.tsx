import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { FilterSelect } from '@/components/ui/filter-select';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/mockData';
import { ResignationConfirmationLetter } from '@/components/shared/ResignationConfirmationLetter';
import { 
  UserMinus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye,
  Wallet,
  CreditCard,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  FileText,
  Download,
  BookOpen,
  RefreshCw
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useResignationJournal } from '@/hooks/useResignationJournal';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ResignationRequest {
  id: string;
  user_id: string;
  reason: string;
  status: string;
  total_savings: number;
  total_arrears: number;
  refund_amount: number;
  simpanan_pokok: number;
  simpanan_wajib: number;
  simpanan_sukarela: number;
  remaining_loan_principal: number;
  total_penalties: number;
  processed_at: string | null;
  processed_by: string | null;
  rejection_reason: string | null;
  journal_entry_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  profile?: {
    name: string;
    email: string;
    member_number: string | null;
    phone: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    bank_account_name: string | null;
  };
}

interface ResignationManagementProps {
  onBack: () => void;
}

export const ResignationManagement = ({ onBack }: ResignationManagementProps) => {
  const { t } = useThemeLanguage();
  const queryClient = useQueryClient();
  const { regenerateResignationJournal } = useResignationJournal();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<ResignationRequest | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showLetterDialog, setShowLetterDialog] = useState(false);
  const [letterData, setLetterData] = useState<any>(null);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [isBulkRegenerating, setIsBulkRegenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  // Fetch all resignation requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['resignation-requests-admin', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('resignation_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch profile data for each request
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (request) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, email, member_number, phone, bank_name, bank_account_number, bank_account_name')
            .eq('user_id', request.user_id)
            .single();
          
          return {
            ...request,
            profile: profile || undefined
          };
        })
      );
      
      return requestsWithProfiles as ResignationRequest[];
    },
  });

  // Approve resignation mutation
  const approveMutation = useMutation({
    mutationFn: async (request: ResignationRequest) => {
      // 1. Update resignation request status
      const { error: requestError } = await supabase
        .from('resignation_requests')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', request.id);
      
      if (requestError) throw requestError;

      // 2. Update member profile (deactivate)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_active: false,
          exit_date: new Date().toISOString().split('T')[0],
          exit_year: new Date().getFullYear()
        })
        .eq('user_id', request.user_id);
      
      if (profileError) throw profileError;

      // 3. If there's an active loan, mark it as completed (paid off from savings)
      if (request.remaining_loan_principal > 0) {
        const { error: loanError } = await supabase
          .from('loans')
          .update({
            status: 'completed',
            remaining_principal: 0
          })
          .eq('user_id', request.user_id)
          .eq('status', 'active');
        
        if (loanError) throw loanError;

        // Mark all pending/overdue installments as paid
        const { data: loans } = await supabase
          .from('loans')
          .select('id')
          .eq('user_id', request.user_id);
        
        if (loans && loans.length > 0) {
          const loanIds = loans.map(l => l.id);
          await supabase
            .from('loan_installments')
            .update({
              status: 'paid',
              paid_date: new Date().toISOString().split('T')[0],
              paid_amount: 0 // Paid from savings deduction
            })
            .in('loan_id', loanIds)
            .in('status', ['pending', 'overdue', 'unpaid']);
        }
      }

      // 4. Reset savings to 0
      const { error: savingsError } = await supabase
        .from('savings_summary')
        .update({
          simpanan_pokok: 0,
          simpanan_wajib: 0,
          simpanan_sukarela: 0,
          total_simpanan: 0
        })
        .eq('user_id', request.user_id);
      
      if (savingsError) throw savingsError;

      // 5. Create member notification
      await supabase
        .from('member_notifications')
        .insert({
          user_id: request.user_id,
          title: 'Pengunduran Diri Disetujui',
          message: `Pengajuan pengunduran diri Anda telah disetujui. ${request.refund_amount > 0 ? `Dana sebesar ${formatCurrency(request.refund_amount)} akan ditransfer ke rekening Anda.` : 'Terima kasih atas keanggotaan Anda.'}`,
          notification_type: 'resignation_approved',
          metadata: {
            request_id: request.id,
            refund_amount: request.refund_amount
          }
        });

      // 6. Send email notification
      try {
        await supabase.functions.invoke('send-resignation-notification', {
          body: {
            userId: request.user_id,
            status: 'approved',
            memberName: request.profile?.name,
            memberEmail: request.profile?.email,
            totalSavings: request.total_savings,
            totalArrears: request.total_arrears,
            refundAmount: request.refund_amount
          }
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't fail the mutation if email fails
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resignation-requests-admin'] });
      setShowApproveDialog(false);
      setSelectedRequest(null);
      toast.success(t('Pengunduran diri berhasil disetujui', 'Resignation approved successfully'));
    },
    onError: (error: any) => {
      console.error('Approve error:', error);
      toast.error(t('Gagal menyetujui pengunduran diri', 'Failed to approve resignation'), {
        description: error.message
      });
    }
  });

  // Reject resignation mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ request, reason }: { request: ResignationRequest; reason: string }) => {
      // 1. Update resignation request status
      const { error: requestError } = await supabase
        .from('resignation_requests')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          processed_at: new Date().toISOString(),
          processed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', request.id);
      
      if (requestError) throw requestError;

      // 2. Create member notification
      await supabase
        .from('member_notifications')
        .insert({
          user_id: request.user_id,
          title: 'Pengunduran Diri Ditolak',
          message: `Pengajuan pengunduran diri Anda ditolak dengan alasan: ${reason}`,
          notification_type: 'resignation_rejected',
          metadata: {
            request_id: request.id,
            rejection_reason: reason
          }
        });

      // 3. Send email notification
      try {
        await supabase.functions.invoke('send-resignation-notification', {
          body: {
            userId: request.user_id,
            status: 'rejected',
            rejectionReason: reason,
            memberName: request.profile?.name,
            memberEmail: request.profile?.email
          }
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't fail the mutation if email fails
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resignation-requests-admin'] });
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason('');
      toast.success(t('Pengunduran diri berhasil ditolak', 'Resignation rejected successfully'));
    },
    onError: (error: any) => {
      console.error('Reject error:', error);
      toast.error(t('Gagal menolak pengunduran diri', 'Failed to reject resignation'), {
        description: error.message
      });
    }
  });

  const filteredRequests = requests.filter(request => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      request.profile?.name?.toLowerCase().includes(searchLower) ||
      request.profile?.member_number?.toLowerCase().includes(searchLower) ||
      request.profile?.email?.toLowerCase().includes(searchLower)
    );
    
    // Additional filter for no_journal
    if (statusFilter === 'no_journal') {
      return matchesSearch && request.status === 'approved' && !request.journal_entry_id;
    }
    
    return matchesSearch;
  });

  // Count approved resignations without journals
  const resignationsWithoutJournal = requests.filter(
    r => r.status === 'approved' && !r.journal_entry_id
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30"><Clock className="w-3 h-3 mr-1" /> {t('Menunggu', 'Pending')}</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30"><CheckCircle2 className="w-3 h-3 mr-1" /> {t('Disetujui', 'Approved')}</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30"><XCircle className="w-3 h-3 mr-1" /> {t('Ditolak', 'Rejected')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  // Handle single journal regeneration
  const handleRegenerateJournal = async (request: ResignationRequest) => {
    setIsRegenerating(request.id);
    try {
      const result = await regenerateResignationJournal(request.id);
      if (result.success) {
        toast.success(t('Jurnal berhasil dibuat', 'Journal created successfully'), {
          description: `Nomor jurnal: ${result.journalNumber}`
        });
        queryClient.invalidateQueries({ queryKey: ['resignation-requests-admin'] });
      }
    } catch (error: any) {
      toast.error(t('Gagal membuat jurnal', 'Failed to create journal'), {
        description: error.message
      });
    } finally {
      setIsRegenerating(null);
    }
  };

  // Handle bulk journal regeneration
  const handleBulkRegenerate = async () => {
    if (resignationsWithoutJournal.length === 0) return;
    
    setIsBulkRegenerating(true);
    setBulkProgress({ current: 0, total: resignationsWithoutJournal.length });
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < resignationsWithoutJournal.length; i++) {
      const request = resignationsWithoutJournal[i];
      setBulkProgress({ current: i + 1, total: resignationsWithoutJournal.length });
      
      try {
        await regenerateResignationJournal(request.id);
        successCount++;
      } catch (error) {
        console.error(`Failed to regenerate journal for resignation ${request.id}:`, error);
        failCount++;
      }
    }
    
    setIsBulkRegenerating(false);
    queryClient.invalidateQueries({ queryKey: ['resignation-requests-admin'] });
    
    if (successCount > 0) {
      toast.success(t('Regenerasi jurnal selesai', 'Journal regeneration completed'), {
        description: `${successCount} jurnal berhasil dibuat${failCount > 0 ? `, ${failCount} gagal` : ''}`
      });
    } else if (failCount > 0) {
      toast.error(t('Regenerasi jurnal gagal', 'Journal regeneration failed'), {
        description: `${failCount} jurnal gagal dibuat`
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserMinus className="h-6 w-6 text-destructive" />
            {t('Manajemen Pengunduran Diri', 'Resignation Management')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t('Kelola pengajuan pengunduran diri anggota', 'Manage member resignation requests')}
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-lg px-3 py-1">
            {pendingCount} {t('Menunggu', 'Pending')}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <SearchInput
              placeholder={t('Cari nama atau nomor anggota...', 'Search name or member number...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              containerClassName="flex-1"
            />
            <FilterSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: 'pending', label: t('Menunggu', 'Pending') },
                { value: 'approved', label: t('Disetujui', 'Approved') },
                { value: 'rejected', label: t('Ditolak', 'Rejected') },
                { value: 'no_journal', label: t('Belum Ada Jurnal', 'No Journal') },
              ]}
              placeholder={t('Filter Status', 'Filter Status')}
              allLabel={t('Semua Status', 'All Status')}
              triggerClassName="w-full sm:w-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Resignations without journal alert */}
      {resignationsWithoutJournal.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
                  <BookOpen className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {resignationsWithoutJournal.length} {t('Pengunduran Diri Tanpa Jurnal', 'Resignations Without Journal')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('Pengunduran diri yang sudah disetujui tetapi belum memiliki jurnal akuntansi', 'Approved resignations without accounting journal')}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleBulkRegenerate}
                disabled={isBulkRegenerating}
                className="border-warning/30 hover:bg-warning/10"
              >
                {isBulkRegenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {bulkProgress.current}/{bulkProgress.total}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t('Buat Semua Jurnal', 'Create All Journals')}
                  </>
                )}
              </Button>
            </div>
            {isBulkRegenerating && (
              <Progress 
                value={(bulkProgress.current / bulkProgress.total) * 100} 
                className="mt-3 h-2"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Request List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <UserMinus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-foreground">
              {t('Tidak Ada Pengajuan', 'No Requests')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('Belum ada pengajuan pengunduran diri', 'No resignation requests yet')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <Card key={request.id} className={request.status === 'pending' ? 'border-warning/30' : ''}>
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Member Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 flex-shrink-0">
                        <UserMinus className="h-5 w-5 text-destructive" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground truncate">
                            {request.profile?.name || 'Unknown'}
                          </h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {request.profile?.member_number || '-'} • {request.profile?.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('Diajukan', 'Submitted')}: {format(new Date(request.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="flex flex-wrap gap-4 lg:gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">{t('Total Simpanan', 'Total Savings')}</p>
                      <p className="font-semibold text-foreground">{formatCurrency(request.total_savings)}</p>
                    </div>
                    {request.total_arrears > 0 && (
                      <div className="text-center">
                        <p className="text-muted-foreground text-xs">{t('Tunggakan', 'Arrears')}</p>
                        <p className="font-semibold text-destructive">{formatCurrency(request.total_arrears)}</p>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">{t('Pengembalian', 'Refund')}</p>
                      <p className="font-semibold text-success">{formatCurrency(request.refund_amount)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowDetailDialog(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {t('Detail', 'Detail')}
                    </Button>
                    {request.status === 'pending' && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-success hover:bg-success/90"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowApproveDialog(true);
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          {t('Setujui', 'Approve')}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowRejectDialog(true);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {t('Tolak', 'Reject')}
                        </Button>
                      </>
                    )}
                    {request.status === 'approved' && (
                      <>
                        {/* Journal status indicator and regenerate button */}
                        {request.journal_entry_id ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                                  <BookOpen className="h-3 w-3 mr-1" />
                                  {t('Jurnal Dibuat', 'Journal Created')}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('Jurnal akuntansi sudah dibuat', 'Accounting journal has been created')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRegenerateJournal(request)}
                            disabled={isRegenerating === request.id || isBulkRegenerating}
                            className="border-warning/30 hover:bg-warning/10"
                          >
                            {isRegenerating === request.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <BookOpen className="h-4 w-4 mr-1" />
                            )}
                            {t('Buat Jurnal', 'Create Journal')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLetterData({
                              id: request.id,
                              memberName: request.profile?.name || 'Unknown',
                              memberNumber: request.profile?.member_number || '-',
                              memberEmail: request.profile?.email,
                              memberPhone: request.profile?.phone,
                              exitDate: request.processed_at || request.updated_at,
                              totalSavings: request.total_savings,
                              totalArrears: request.total_arrears,
                              refundAmount: request.refund_amount,
                              simpananPokok: request.simpanan_pokok,
                              simpananWajib: request.simpanan_wajib,
                              simpananSukarela: request.simpanan_sukarela,
                              remainingLoanPrincipal: request.remaining_loan_principal,
                              totalPenalties: request.total_penalties,
                              reason: request.reason,
                              approvedDate: request.processed_at,
                            });
                            setShowLetterDialog(true);
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          {t('Surat', 'Letter')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('Detail Pengajuan Pengunduran Diri', 'Resignation Request Details')}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.profile?.name} ({selectedRequest?.profile?.member_number})
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            {selectedRequest && (
              <div className="space-y-6 p-1">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('Status', 'Status')}</span>
                  {getStatusBadge(selectedRequest.status)}
                </div>

                {/* Member Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('Informasi Anggota', 'Member Information')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Nama', 'Name')}</span>
                      <span className="font-medium">{selectedRequest.profile?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Email', 'Email')}</span>
                      <span className="font-medium">{selectedRequest.profile?.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Telepon', 'Phone')}</span>
                      <span className="font-medium">{selectedRequest.profile?.phone || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Rekening', 'Bank Account')}</span>
                      <span className="font-medium text-right">
                        {selectedRequest.profile?.bank_name ? (
                          <>
                            {selectedRequest.profile.bank_name}<br />
                            {selectedRequest.profile.bank_account_number}<br />
                            a.n. {selectedRequest.profile.bank_account_name}
                          </>
                        ) : '-'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Details */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      {t('Rincian Simpanan', 'Savings Details')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Simpanan Pokok', 'Principal Savings')}</span>
                      <span className="font-medium">{formatCurrency(selectedRequest.simpanan_pokok)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Simpanan Wajib', 'Mandatory Savings')}</span>
                      <span className="font-medium">{formatCurrency(selectedRequest.simpanan_wajib)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Simpanan Sukarela', 'Voluntary Savings')}</span>
                      <span className="font-medium">{formatCurrency(selectedRequest.simpanan_sukarela)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>{t('Total Simpanan', 'Total Savings')}</span>
                      <span className="text-primary">{formatCurrency(selectedRequest.total_savings)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Loan Details (if any) */}
                {selectedRequest.remaining_loan_principal > 0 && (
                  <Card className="border-destructive/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 text-destructive">
                        <CreditCard className="h-4 w-4" />
                        {t('Tunggakan Pinjaman', 'Loan Arrears')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Sisa Pokok', 'Remaining Principal')}</span>
                        <span className="font-medium">{formatCurrency(selectedRequest.remaining_loan_principal)}</span>
                      </div>
                      {selectedRequest.total_penalties > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('Total Denda', 'Total Penalties')}</span>
                          <span className="font-medium">{formatCurrency(selectedRequest.total_penalties)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>{t('Total Tunggakan', 'Total Arrears')}</span>
                        <span className="text-destructive">{formatCurrency(selectedRequest.total_arrears)}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Final Calculation */}
                <Card className="border-success/30 bg-success/5">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{t('Dana Dikembalikan', 'Refund Amount')}</span>
                      <span className="text-2xl font-bold text-success">{formatCurrency(selectedRequest.refund_amount)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Reason */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('Alasan Pengunduran Diri', 'Resignation Reason')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedRequest.reason}</p>
                  </CardContent>
                </Card>

                {/* Rejection Reason (if rejected) */}
                {selectedRequest.status === 'rejected' && selectedRequest.rejection_reason && (
                  <Card className="border-destructive/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-destructive">{t('Alasan Penolakan', 'Rejection Reason')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{selectedRequest.rejection_reason}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Timestamps */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{t('Diajukan', 'Submitted')}: {format(new Date(selectedRequest.created_at), 'dd MMMM yyyy, HH:mm', { locale: idLocale })}</p>
                  {selectedRequest.processed_at && (
                    <p>{t('Diproses', 'Processed')}: {format(new Date(selectedRequest.processed_at), 'dd MMMM yyyy, HH:mm', { locale: idLocale })}</p>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              {t('Tutup', 'Close')}
            </Button>
            {selectedRequest?.status === 'pending' && (
              <>
                <Button
                  variant="default"
                  className="bg-success hover:bg-success/90"
                  onClick={() => {
                    setShowDetailDialog(false);
                    setShowApproveDialog(true);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {t('Setujui', 'Approve')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowDetailDialog(false);
                    setShowRejectDialog(true);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  {t('Tolak', 'Reject')}
                </Button>
              </>
            )}
            {selectedRequest?.status === 'approved' && (
              <Button
                onClick={() => {
                  setLetterData({
                    id: selectedRequest.id,
                    memberName: selectedRequest.profile?.name || 'Unknown',
                    memberNumber: selectedRequest.profile?.member_number || '-',
                    memberEmail: selectedRequest.profile?.email,
                    memberPhone: selectedRequest.profile?.phone,
                    exitDate: selectedRequest.processed_at || selectedRequest.updated_at,
                    totalSavings: selectedRequest.total_savings,
                    totalArrears: selectedRequest.total_arrears,
                    refundAmount: selectedRequest.refund_amount,
                    simpananPokok: selectedRequest.simpanan_pokok,
                    simpananWajib: selectedRequest.simpanan_wajib,
                    simpananSukarela: selectedRequest.simpanan_sukarela,
                    remainingLoanPrincipal: selectedRequest.remaining_loan_principal,
                    totalPenalties: selectedRequest.total_penalties,
                    reason: selectedRequest.reason,
                    approvedDate: selectedRequest.processed_at,
                  });
                  setShowDetailDialog(false);
                  setShowLetterDialog(true);
                }}
              >
                <Download className="h-4 w-4 mr-1" />
                {t('Unduh Surat', 'Download Letter')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Konfirmasi Persetujuan', 'Confirm Approval')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Anda yakin ingin menyetujui pengunduran diri ini? Tindakan ini akan:',
                'Are you sure you want to approve this resignation? This action will:'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4 space-y-2 text-sm">
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>{t('Menonaktifkan keanggotaan anggota', 'Deactivate member membership')}</li>
              {selectedRequest && selectedRequest.remaining_loan_principal > 0 && (
                <li>{t('Melunasi sisa pinjaman dari simpanan', 'Pay off remaining loan from savings')}</li>
              )}
              <li>{t('Mengosongkan saldo simpanan', 'Reset savings balance to zero')}</li>
              {selectedRequest && selectedRequest.refund_amount > 0 && (
                <li className="text-success font-medium">
                  {t('Mengembalikan dana sebesar', 'Refund amount of')} {formatCurrency(selectedRequest.refund_amount)}
                </li>
              )}
              <li>{t('Membuat jurnal pembukuan otomatis', 'Create automatic accounting journal entry')}</li>
            </ul>
          </div>
          
          {selectedRequest && selectedRequest.refund_amount > 0 && (
            <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  {t(
                    'Pastikan Anda sudah mentransfer dana pengembalian ke rekening anggota sebelum menyetujui.',
                    'Make sure you have transferred the refund to the member\'s account before approving.'
                  )}
                </p>
              </div>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>
              {t('Batal', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedRequest && approveMutation.mutate(selectedRequest)}
              disabled={approveMutation.isPending}
              className="bg-success hover:bg-success/90"
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {t('Memproses...', 'Processing...')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {t('Ya, Setujui', 'Yes, Approve')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Tolak Pengunduran Diri', 'Reject Resignation')}</DialogTitle>
            <DialogDescription>
              {t('Berikan alasan penolakan pengajuan pengunduran diri.', 'Provide a reason for rejecting the resignation request.')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">{t('Alasan Penolakan', 'Rejection Reason')} <span className="text-destructive">*</span></Label>
              <Textarea
                id="rejection-reason"
                placeholder={t('Tuliskan alasan penolakan...', 'Write the rejection reason...')}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={rejectMutation.isPending}>
              {t('Batal', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequest && rejectMutation.mutate({ request: selectedRequest, reason: rejectionReason })}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {t('Memproses...', 'Processing...')}
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-1" />
                  {t('Tolak Pengajuan', 'Reject Request')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resignation Confirmation Letter */}
      {letterData && (
        <ResignationConfirmationLetter
          data={letterData}
          open={showLetterDialog}
          onClose={() => {
            setShowLetterDialog(false);
            setLetterData(null);
          }}
        />
      )}
    </div>
  );
};
