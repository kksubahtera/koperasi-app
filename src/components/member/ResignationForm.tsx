import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useUserSavings } from '@/hooks/useUserSavings';
import { useUserLoans } from '@/hooks/useUserLoans';
import { useUserSHUEstimate } from '@/hooks/useUserSHUEstimate';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/mockData';
import { ResignationConfirmationLetter } from '@/components/shared/ResignationConfirmationLetter';
import { 
  UserMinus, 
  AlertTriangle, 
  Wallet, 
  CreditCard, 
  CheckCircle2,
  Clock,
  Info,
  MinusCircle,
  Ban,
  Loader2,
  Download,
  FileText,
  TrendingUp,
  Landmark
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const ResignationForm = () => {
  const { user } = useAuth();
  const { t } = useThemeLanguage();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showLetterDialog, setShowLetterDialog] = useState(false);

  // Fetch real savings data
  const { savings, isLoading: savingsLoading } = useUserSavings();
  
  // Fetch real loans data
  const { loans, installments, isLoading: loansLoading } = useUserLoans();

  // Fetch SHU estimate
  const { estimate: shuEstimate, loading: shuLoading } = useUserSHUEstimate();

  // Fetch withheld SHU for this user
  const { data: withheldSHU, isLoading: withheldLoading } = useQuery({
    queryKey: ['withheld-shu', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('shu_withheld')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'withheld');
      return data || [];
    },
    enabled: !!user?.id,
  });

  const totalWithheldSHU = withheldSHU?.reduce((sum, w) => sum + (w.shu_amount || 0), 0) || 0;

  // Check for existing pending or approved resignation request
  const { data: existingRequest, isLoading: requestLoading } = useQuery({
    queryKey: ['resignation-request', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('resignation_requests')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Submit resignation mutation
  const submitResignation = useMutation({
    mutationFn: async (data: {
      reason: string;
      totalSavings: number;
      totalArrears: number;
      refundAmount: number;
      simpananPokok: number;
      simpananWajib: number;
      simpananSukarela: number;
      remainingLoanPrincipal: number;
      totalPenalties: number;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('resignation_requests')
        .insert({
          user_id: user.id,
          reason: data.reason,
          total_savings: data.totalSavings,
          total_arrears: data.totalArrears,
          refund_amount: data.refundAmount,
          simpanan_pokok: data.simpananPokok,
          simpanan_wajib: data.simpananWajib,
          simpanan_sukarela: data.simpananSukarela,
          remaining_loan_principal: data.remainingLoanPrincipal,
          total_penalties: data.totalPenalties,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resignation-request'] });
      toast.success(t('Pengajuan pengunduran diri berhasil dikirim', 'Resignation request submitted successfully'));
    },
    onError: (error: any) => {
      console.error('Resignation submission error:', error);
      toast.error(t('Gagal mengirim pengajuan', 'Failed to submit request'), {
        description: error.message
      });
    }
  });

  if (!user) return null;

  const isLoading = savingsLoading || loansLoading || requestLoading || withheldLoading || shuLoading;

  // Find active loan
  const activeLoan = loans.find(l => l.status === 'active');
  
  // Get installments for active loan
  const loanInstallments = activeLoan 
    ? installments.filter(i => i.loanId === activeLoan.id)
    : [];

  // Calculate total arrears (overdue installments + remaining principal + penalties)
  const overdueInstallments = loanInstallments.filter(i => i.status === 'overdue');
  const totalPenalties = overdueInstallments.reduce((sum, i) => sum + (i.penaltyAmount || 0), 0);
  const remainingPrincipal = activeLoan?.remainingPrincipal || 0;
  
  // Total arrears = remaining principal + penalties
  const totalArrears = remainingPrincipal + totalPenalties;

  // Calculate refund/shortfall including withheld SHU
  const totalSavings = savings.totalSimpanan || 0;
  const totalAvailable = totalSavings + totalWithheldSHU; // Include withheld SHU
  const netAmount = totalAvailable - totalArrears;
  const hasShortfall = netAmount < 0;
  const refundAmount = hasShortfall ? 0 : netAmount;
  const shortfallAmount = hasShortfall ? Math.abs(netAmount) : 0;

  // Check if user can resign (no shortfall after including withheld SHU)
  const canResign = !hasShortfall;

  const handleSubmitResignation = () => {
    setShowConfirmDialog(false);
    
    submitResignation.mutate({
      reason,
      totalSavings,
      totalArrears,
      refundAmount,
      simpananPokok: savings.simpananPokok || 0,
      simpananWajib: savings.simpananWajib || 0,
      simpananSukarela: savings.simpananSukarela || 0,
      remainingLoanPrincipal: remainingPrincipal,
      totalPenalties,
    });
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('Pengunduran Diri', 'Resignation')}</h1>
          <p className="mt-1 text-muted-foreground">{t('Memuat data...', 'Loading data...')}</p>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show existing request status (pending or approved)
  if (existingRequest) {
    const isApproved = existingRequest.status === 'approved';
    
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('Pengunduran Diri', 'Resignation')}</h1>
          <p className="mt-1 text-muted-foreground">{t('Status pengajuan pengunduran diri', 'Resignation request status')}</p>
        </div>

        <Card className={isApproved ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isApproved ? 'bg-success/10' : 'bg-warning/10'}`}>
                {isApproved ? (
                  <CheckCircle2 className="h-6 w-6 text-success" />
                ) : (
                  <Clock className="h-6 w-6 text-warning" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">
                  {isApproved 
                    ? t('Pengunduran Diri Disetujui', 'Resignation Approved')
                    : t('Menunggu Persetujuan', 'Pending Approval')
                  }
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isApproved 
                    ? t(
                        'Pengajuan pengunduran diri Anda telah disetujui. Terima kasih atas keanggotaan Anda.',
                        'Your resignation request has been approved. Thank you for your membership.'
                      )
                    : t(
                        'Pengajuan pengunduran diri Anda sedang diproses oleh admin.',
                        'Your resignation request is being processed by admin.'
                      )
                  }
                  {!isApproved && existingRequest.refund_amount > 0 && ' ' + t(
                    'Anda akan menerima notifikasi ketika dana sudah dikembalikan.',
                    'You will be notified when the funds have been returned.'
                  )}
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('Total Simpanan', 'Total Savings')}</span>
                    <span className="font-medium text-foreground">{formatCurrency(existingRequest.total_savings)}</span>
                  </div>
                  {existingRequest.total_arrears > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('Pelunasan Pinjaman', 'Loan Payoff')}</span>
                      <span className="font-medium text-destructive">- {formatCurrency(existingRequest.total_arrears)}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 flex justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {t('Dana Dikembalikan', 'Refund Amount')}
                    </span>
                    <span className="font-bold text-success">
                      {formatCurrency(existingRequest.refund_amount)}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {isApproved 
                    ? `${t('Disetujui pada', 'Approved on')}: ${new Date(existingRequest.processed_at || existingRequest.updated_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}`
                    : `${t('Diajukan pada', 'Submitted on')}: ${new Date(existingRequest.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}`
                  }
                </p>

                {/* Download Letter Button for Approved */}
                {isApproved && (
                  <Button 
                    className="mt-4 w-full" 
                    onClick={() => setShowLetterDialog(true)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t('Unduh Surat Pengunduran Diri', 'Download Resignation Letter')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resignation Letter Dialog */}
        {isApproved && (
          <ResignationConfirmationLetter
            data={{
              id: existingRequest.id,
              memberName: user?.name || 'Unknown',
              memberNumber: user?.memberNumber || '-',
              memberEmail: user?.email,
              memberPhone: user?.phone,
              joinDate: user?.joinDate,
              exitDate: existingRequest.processed_at || existingRequest.updated_at,
              totalSavings: existingRequest.total_savings,
              totalArrears: existingRequest.total_arrears,
              refundAmount: existingRequest.refund_amount,
              simpananPokok: existingRequest.simpanan_pokok,
              simpananWajib: existingRequest.simpanan_wajib,
              simpananSukarela: existingRequest.simpanan_sukarela,
              remainingLoanPrincipal: existingRequest.remaining_loan_principal,
              totalPenalties: existingRequest.total_penalties,
              reason: existingRequest.reason,
              approvedDate: existingRequest.processed_at,
            }}
            open={showLetterDialog}
            onClose={() => setShowLetterDialog(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('Pengunduran Diri', 'Resignation')}</h1>
        <p className="mt-1 text-muted-foreground">{t('Ajukan pengunduran diri dari keanggotaan koperasi', 'Submit resignation from cooperative membership')}</p>
      </div>

      {/* Block message if has shortfall */}
      {hasShortfall && (
        <Alert variant="destructive">
          <Ban className="h-4 w-4" />
          <AlertTitle>{t('Tidak Dapat Mengundurkan Diri', 'Cannot Resign')}</AlertTitle>
          <AlertDescription>
            {t(
              `Simpanan Anda tidak mencukupi untuk melunasi sisa pinjaman. Anda memiliki kekurangan sebesar`,
              `Your savings are insufficient to pay off the remaining loan. You have a shortfall of`
            )} <strong>{formatCurrency(shortfallAmount)}</strong>.
            <br /><br />
            {t(
              'Untuk dapat mengundurkan diri, Anda harus terlebih dahulu melunasi pinjaman atau menambah simpanan hingga mencukupi.',
              'To resign, you must first pay off your loan or add savings until sufficient.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Savings Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-primary" />
            {t('Rincian Simpanan Anda', 'Your Savings Details')}
          </CardTitle>
          <CardDescription>
            {t('Total simpanan yang dimiliki', 'Total savings owned')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm text-muted-foreground">{t('Simpanan Pokok', 'Principal Savings')}</span>
              <span className="font-medium text-foreground">{formatCurrency(savings.simpananPokok || 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm text-muted-foreground">{t('Simpanan Wajib', 'Mandatory Savings')}</span>
              <span className="font-medium text-foreground">{formatCurrency(savings.simpananWajib || 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm text-muted-foreground">{t('Simpanan Sukarela', 'Voluntary Savings')}</span>
              <span className="font-medium text-foreground">{formatCurrency(savings.simpananSukarela || 0)}</span>
            </div>
          </div>

          <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
            <span className="font-medium text-foreground">{t('Total Simpanan', 'Total Savings')}</span>
            <span className="font-bold text-primary">{formatCurrency(totalSavings)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Withheld SHU (if any) */}
      {totalWithheldSHU > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-amber-500" />
              {t('SHU Ditahan', 'Withheld SHU')}
            </CardTitle>
            <CardDescription>
              {t('SHU yang ditahan akan digunakan untuk pembayaran tunggakan', 'Withheld SHU will be used for arrears payment')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="font-medium text-foreground">{t('Total SHU Ditahan', 'Total Withheld SHU')}</span>
              <span className="font-bold text-amber-600">+ {formatCurrency(totalWithheldSHU)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('SHU ini akan ditambahkan ke simpanan Anda untuk perhitungan pengembalian.', 'This SHU will be added to your savings for refund calculation.')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* SHU Estimate Card */}
      {shuEstimate && (
        <Card className="border-success/30 bg-success/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-success" />
              {t('Estimasi SHU Tahun Ini', 'This Year SHU Estimate')}
            </CardTitle>
            <CardDescription>
              {t(
                'Perkiraan SHU berdasarkan kontribusi simpanan dan jasa usaha Anda',
                'Estimated SHU based on your savings and business contributions'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Contribution Summary */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('Kontribusi Simpanan', 'Savings Contribution')}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-foreground">{formatCurrency(shuEstimate.totalSimpanan)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({shuEstimate.simpananSharePercent.toFixed(2)}%)</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('Kontribusi Jasa Usaha', 'Business Contribution')}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-foreground">{formatCurrency(shuEstimate.kontribusiBunga + shuEstimate.kontribusiUsaha)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({shuEstimate.usahaSharePercent.toFixed(2)}%)</span>
                </div>
              </div>
            </div>

            {/* SHU Breakdown */}
            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-sm font-medium text-foreground">{t('Perkiraan Pembagian SHU', 'Estimated SHU Distribution')}</h4>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('SHU Jasa Simpanan', 'Savings SHU')}</span>
                  <span className="font-medium text-foreground">{formatCurrency(shuEstimate.estimatedSimpananSHU)}</span>
                </div>
                <Progress 
                  value={shuEstimate.estimatedTotalSHU > 0 ? (shuEstimate.estimatedSimpananSHU / shuEstimate.estimatedTotalSHU) * 100 : 0} 
                  className="h-2"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('SHU Jasa Usaha', 'Business SHU')}</span>
                  <span className="font-medium text-foreground">{formatCurrency(shuEstimate.estimatedUsahaSHU)}</span>
                </div>
                <Progress 
                  value={shuEstimate.estimatedTotalSHU > 0 ? (shuEstimate.estimatedUsahaSHU / shuEstimate.estimatedTotalSHU) * 100 : 0} 
                  className="h-2"
                />
              </div>
            </div>

            {/* Total Estimated SHU */}
            <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-success/10 border border-success/20">
              <span className="font-medium text-foreground">{t('Total Estimasi SHU', 'Total Estimated SHU')}</span>
              <span className="font-bold text-success">{formatCurrency(shuEstimate.estimatedTotalSHU)}</span>
            </div>

            {/* Info Note */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {t(
                  'Estimasi ini berdasarkan SHU tahun sebelumnya dan kontribusi Anda saat ini. Jika Anda mengundurkan diri sebelum akhir tahun, SHU akan dihitung secara pro-rata berdasarkan periode keanggotaan Anda.',
                  'This estimate is based on last year\'s SHU and your current contributions. If you resign before year end, SHU will be calculated pro-rata based on your membership period.'
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}


      {activeLoan && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-destructive" />
              {t('Tunggakan Pinjaman', 'Loan Arrears')}
            </CardTitle>
            <CardDescription>
              {t('Sisa pinjaman yang harus dilunasi saat pengunduran diri', 'Remaining loan to be paid upon resignation')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">{t('Sisa Pokok Pinjaman', 'Remaining Principal')}</span>
                <span className="font-medium text-foreground">{formatCurrency(remainingPrincipal)}</span>
              </div>
              {totalPenalties > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm text-muted-foreground">{t('Total Denda Keterlambatan', 'Total Late Penalties')}</span>
                  <span className="font-medium text-foreground">{formatCurrency(totalPenalties)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <span className="font-medium text-foreground">{t('Total Tunggakan', 'Total Arrears')}</span>
              <span className="font-bold text-destructive">{formatCurrency(totalArrears)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Final Calculation */}
      <Card className={hasShortfall ? 'border-destructive/30 bg-destructive/5' : 'border-success/30 bg-success/5'}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {hasShortfall ? (
              <>
                <MinusCircle className="h-5 w-5 text-destructive" />
                {t('Estimasi Kekurangan', 'Estimated Shortfall')}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-success" />
                {t('Estimasi Pengembalian Dana', 'Estimated Refund')}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('Total Simpanan', 'Total Savings')}</span>
            <span className="font-medium text-foreground">{formatCurrency(totalSavings)}</span>
          </div>
          {totalArrears > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('Total Tunggakan', 'Total Arrears')}</span>
              <span className="font-medium text-destructive">- {formatCurrency(totalArrears)}</span>
            </div>
          )}
          <div className="border-t border-border pt-3 flex justify-between">
            <span className="font-medium text-foreground">
              {hasShortfall 
                ? t('Kekurangan yang Harus Dibayar', 'Shortfall to be Paid') 
                : t('Dana yang Akan Dikembalikan', 'Funds to be Returned')}
            </span>
            <span className={`text-xl font-bold ${hasShortfall ? 'text-destructive' : 'text-success'}`}>
              {hasShortfall ? formatCurrency(shortfallAmount) : formatCurrency(refundAmount)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Resignation Form - Only show if can resign */}
      {canResign ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserMinus className="h-5 w-5 text-destructive" />
              {t('Form Pengunduran Diri', 'Resignation Form')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">{t('Alasan Pengunduran Diri', 'Reason for Resignation')} <span className="text-destructive">*</span></Label>
              <Textarea
                id="reason"
                placeholder={t('Tuliskan alasan Anda mengundurkan diri dari koperasi...', 'Write your reason for leaving the cooperative...')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[120px]"
              />
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>{t('Informasi Penting', 'Important Information')}</AlertTitle>
              <AlertDescription className="text-sm">
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>{t('Pengajuan akan diproses dalam 3-7 hari kerja', 'Request will be processed within 3-7 business days')}</li>
                  {refundAmount > 0 && <li>{t('Dana akan ditransfer ke rekening terdaftar', 'Funds will be transferred to registered account')}</li>}
                  {totalArrears > 0 && <li>{t('Sisa pinjaman akan dilunasi dari simpanan Anda', 'Remaining loan will be paid from your savings')}</li>}
                  <li>{t('Keanggotaan akan berakhir setelah proses selesai', 'Membership will end after the process is complete')}</li>
                  <li>{t('Anda dapat bergabung kembali setelah 6 bulan', 'You can rejoin after 6 months')}</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Button 
              onClick={() => setShowConfirmDialog(true)}
              disabled={!reason.trim() || submitResignation.isPending}
              variant="destructive"
              className="w-full"
            >
              {submitResignation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('Memproses...', 'Processing...')}
                </>
              ) : (
                <>
                  <UserMinus className="mr-2 h-4 w-4" />
                  {t('Ajukan Pengunduran Diri', 'Submit Resignation')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 text-muted-foreground">
              <Ban className="h-8 w-8" />
              <div>
                <p className="font-medium">{t('Form pengunduran diri tidak tersedia', 'Resignation form not available')}</p>
                <p className="text-sm">{t('Lunasi kekurangan pinjaman terlebih dahulu untuk dapat mengundurkan diri.', 'Pay off the loan shortfall first to be able to resign.')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Konfirmasi Pengunduran Diri', 'Confirm Resignation')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Anda yakin ingin mengundurkan diri dari koperasi? Proses ini akan menghentikan keanggotaan Anda.',
                'Are you sure you want to resign from the cooperative? This will terminate your membership.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('Total Simpanan', 'Total Savings')}</span>
                <span className="font-medium text-foreground">{formatCurrency(totalSavings)}</span>
              </div>
              {totalArrears > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('Pelunasan Pinjaman', 'Loan Payoff')}</span>
                  <span className="font-medium text-destructive">- {formatCurrency(totalArrears)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-sm">
                <span className="font-medium text-foreground">
                  {t('Dana Dikembalikan', 'Refund Amount')}
                </span>
                <span className="font-bold text-success">
                  {formatCurrency(refundAmount)}
                </span>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Batal', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitResignation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('Ya, Ajukan', 'Yes, Submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
