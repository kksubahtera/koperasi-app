import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CreditCard, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  User,
  History,
  Loader2,
  FileText,
  Download,
  Info,
  Calculator,
  RefreshCcw,
} from 'lucide-react';
import { TabNavigation, TabItem } from '@/components/shared/TabNavigation';
import { RupiahIcon } from '@/components/ui/rupiah-icon';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { useAllLoans } from '@/hooks/useAllLoans';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useJournalTemplates, createJournalFromTransaction } from '@/hooks/useJournalTemplates';
import { LoanApprovalLetter } from '@/components/shared/LoanApprovalLetter';
import { getCooperativeSettings, defaultCooperativeSettings } from '@/lib/cooperativeSettings';
import { LoanInstallmentDetails } from './LoanInstallmentDetails';
import { LoanRestructureDialog } from './LoanRestructureDialog';

interface LoanApplication {
  id: string;
  userId: string;
  userName: string;
  memberNumber: string;
  amount: number;
  tenor: number;
  interestRate: number;
  status: 'pending' | 'active' | 'completed' | 'defaulted' | 'rejected';
  appliedAt: string;
  rejectionReason?: string;
}

interface ApplicantSavings {
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  totalSimpanan: number;
}

interface ActiveLoan {
  id: string;
  userId: string;
  userName: string;
  memberNumber: string;
  principalAmount: number;
  tenor: number;
  interestRate: number;
  disbursementDate: string;
  remainingPrincipal: number;
  status: 'active';
}

interface CompletedLoan {
  id: string;
  userId: string;
  userName: string;
  memberNumber: string;
  principalAmount: number;
  tenor: number;
  interestRate: number;
  disbursementDate: string;
  status: 'completed';
}

export const LoanManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: allLoans, isLoading } = useAllLoans();
  const { getTemplateByType } = useJournalTemplates();
  const [selectedApp, setSelectedApp] = useState<LoanApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [letterLoan, setLetterLoan] = useState<ActiveLoan | null>(null);
  const [completedLetterLoan, setCompletedLetterLoan] = useState<CompletedLoan | null>(null);
  const [showLetterAfterApprove, setShowLetterAfterApprove] = useState<{
    loan: LoanApplication;
    approvedAt: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [installmentDetailsLoan, setInstallmentDetailsLoan] = useState<ActiveLoan | null>(null);
  const [restructureLoan, setRestructureLoan] = useState<ActiveLoan | null>(null);
  
  // State for applicant savings check
  const [applicantSavings, setApplicantSavings] = useState<ApplicantSavings | null>(null);
  const [isLoadingSavings, setIsLoadingSavings] = useState(false);
  const [loanSettings, setLoanSettings] = useState<{ maxLoanMultiplier: number; simpananWajib: number }>({ maxLoanMultiplier: 3, simpananWajib: 100000 });
  const [savingsUnderpayment, setSavingsUnderpayment] = useState<{
    hasUnderpayment: boolean;
    expectedAmount: number;
    actualAmount: number;
    deficitAmount: number;
    deficitMonths: number;
  } | null>(null);
  const [warningConfirmed, setWarningConfirmed] = useState(false);

  // Fetch loan settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('cooperative_settings')
          .select('key, value')
          .in('key', ['loan_settings', 'maxLoanMultiplier', 'simpananWajib']);
        
        if (data) {
          const settingsMap: Record<string, any> = {};
          data.forEach((row) => {
            try {
              settingsMap[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            } catch {
              settingsMap[row.key] = row.value;
            }
          });
          
          const localSettings = getCooperativeSettings();
          const multiplier = settingsMap['loan_settings']?.maxLoanMultiplier 
            ?? settingsMap['maxLoanMultiplier'] 
            ?? localSettings.maxLoanMultiplier 
            ?? defaultCooperativeSettings.maxLoanMultiplier;
          const simpananWajib = settingsMap['simpananWajib'] 
            ?? localSettings.simpananWajib 
            ?? defaultCooperativeSettings.simpananWajib
            ?? 100000;
          
          setLoanSettings({ maxLoanMultiplier: multiplier, simpananWajib });
        }
      } catch (err) {
        console.error('Error fetching loan settings:', err);
      }
    };
    fetchSettings();
  }, []);

  // Fetch applicant savings and underpayment status when dialog opens
  useEffect(() => {
    const fetchApplicantData = async () => {
      if (!selectedApp?.userId) {
        setApplicantSavings(null);
        setSavingsUnderpayment(null);
        return;
      }

      setIsLoadingSavings(true);
      try {
        // Fetch savings summary
        const { data: savingsData, error: savingsError } = await supabase
          .from('savings_summary')
          .select('*')
          .eq('user_id', selectedApp.userId)
          .maybeSingle();

        // Fetch member profile for join date
        const { data: profileData } = await supabase
          .from('profiles')
          .select('join_date')
          .eq('user_id', selectedApp.userId)
          .maybeSingle();

        if (savingsError) {
          console.error('Error fetching applicant savings:', savingsError);
          return;
        }

        if (savingsData) {
          const savings = {
            simpananPokok: Number(savingsData.simpanan_pokok) || 0,
            simpananWajib: Number(savingsData.simpanan_wajib) || 0,
            simpananSukarela: Number(savingsData.simpanan_sukarela) || 0,
            totalSimpanan: Number(savingsData.total_simpanan) || 0,
          };
          setApplicantSavings(savings);

          // Check for simpanan wajib underpayment
          if (profileData?.join_date) {
            const joinDate = new Date(profileData.join_date);
            const now = new Date();
            const monthsJoined = Math.max(1,
              (now.getFullYear() - joinDate.getFullYear()) * 12 +
              (now.getMonth() - joinDate.getMonth()) + 1
            );
            const expectedAmount = monthsJoined * loanSettings.simpananWajib;
            const actualAmount = savings.simpananWajib;
            const deficitAmount = expectedAmount - actualAmount;
            const deficitMonths = Math.ceil(deficitAmount / loanSettings.simpananWajib);

            setSavingsUnderpayment({
              hasUnderpayment: deficitAmount > 0,
              expectedAmount,
              actualAmount,
              deficitAmount: Math.max(0, deficitAmount),
              deficitMonths: Math.max(0, deficitMonths),
            });
          } else {
            setSavingsUnderpayment(null);
          }
        } else {
          setApplicantSavings({
            simpananPokok: 0,
            simpananWajib: 0,
            simpananSukarela: 0,
            totalSimpanan: 0,
          });
          setSavingsUnderpayment(null);
        }
      } catch (err) {
        console.error('Error in fetchApplicantData:', err);
      } finally {
        setIsLoadingSavings(false);
      }
    };

    fetchApplicantData();
  }, [selectedApp?.userId, loanSettings.simpananWajib]);

  // Calculate if loan exceeds recommendation
  const maxLoanBasedOnSavings = applicantSavings ? applicantSavings.totalSimpanan * loanSettings.maxLoanMultiplier : 0;
  const exceedsRecommendation = selectedApp && applicantSavings && selectedApp.amount > maxLoanBasedOnSavings && maxLoanBasedOnSavings > 0;

  // Transform data from database
  const pendingApps: LoanApplication[] = allLoans
    ?.filter(l => l.status === 'pending')
    .map(l => ({
      id: l.id,
      userId: l.user_id,
      userName: l.profiles?.name || 'Unknown',
      memberNumber: l.profiles?.member_number || '-',
      amount: l.principal_amount,
      tenor: l.tenor,
      interestRate: l.interest_rate || 0.02,
      status: l.status as 'pending',
      appliedAt: l.application_date || '',
    })) || [];

  const activeLoans: ActiveLoan[] = allLoans
    ?.filter(l => l.status === 'active')
    .map(l => ({
      id: l.id,
      userId: l.user_id,
      userName: l.profiles?.name || 'Unknown',
      memberNumber: l.profiles?.member_number || '-',
      principalAmount: l.principal_amount,
      tenor: l.tenor,
      interestRate: l.interest_rate || 0.02,
      disbursementDate: l.disbursement_date || '',
      remainingPrincipal: l.remaining_principal || l.principal_amount,
      status: 'active' as const,
    })) || [];

  const completedLoans: CompletedLoan[] = allLoans
    ?.filter(l => l.status === 'completed')
    .map(l => ({
      id: l.id,
      userId: l.user_id,
      userName: l.profiles?.name || 'Unknown',
      memberNumber: l.profiles?.member_number || '-',
      principalAmount: l.principal_amount,
      tenor: l.tenor,
      interestRate: l.interest_rate || 0.02,
      disbursementDate: l.disbursement_date || '',
      status: 'completed' as const,
    })) || [];

  const rejectedApps = allLoans
    ?.filter(l => l.status === 'rejected')
    .map(l => ({
      id: l.id,
      userId: l.user_id,
      userName: l.profiles?.name || 'Unknown',
      memberNumber: l.profiles?.member_number || '-',
      amount: l.principal_amount,
      tenor: l.tenor,
      rejectionReason: l.rejection_reason,
      appliedAt: l.application_date || '',
    })) || [];

  const generateInstallmentSchedule = (
    loanId: string,
    principalAmount: number,
    tenor: number,
    interestRate: number,
    disbursementDate: Date
  ) => {
    const settings = getCooperativeSettings();
    const calculationMethod = settings.interestCalculationMethod || 'flat';
    const installments = [];
    
    // Calculate principal per month (can be adjusted for 50k multiples if needed)
    const basePrincipal = Math.floor(principalAmount / tenor / 50000) * 50000;
    const remainder = principalAmount - (basePrincipal * tenor);
    const monthsWithExtra = Math.round(remainder / 50000);
    
    let remainingPrincipal = principalAmount;
    
    for (let i = 1; i <= tenor; i++) {
      const dueDate = new Date(disbursementDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      
      // Calculate principal for this month
      const principalThisMonth = i <= monthsWithExtra ? basePrincipal + 50000 : basePrincipal;
      
      // Calculate interest based on method
      let interestAmount: number;
      if (calculationMethod === 'effective') {
        // Effective (declining): interest calculated from remaining principal
        interestAmount = remainingPrincipal * interestRate;
      } else {
        // Flat: interest calculated from original principal amount
        interestAmount = principalAmount * interestRate;
      }
      
      const totalAmount = principalThisMonth + interestAmount;
      
      installments.push({
        loan_id: loanId,
        installment_number: i,
        due_date: dueDate.toISOString().split('T')[0],
        principal_amount: principalThisMonth,
        interest_amount: interestAmount,
        total_amount: totalAmount,
        paid_amount: 0,
        status: 'pending' as const,
        penalty_amount: 0,
        penalty_months: 0,
      });
      
      // Update remaining principal for next iteration
      remainingPrincipal -= principalThisMonth;
    }
    
    return installments;
  };

  const sendLoanNotificationEmail = async (
    userId: string,
    status: 'approved' | 'rejected',
    loanAmount: number,
    tenor: number,
    interestRate: number,
    rejectionReason?: string
  ) => {
    try {
      const { error } = await supabase.functions.invoke('send-loan-notification', {
        body: {
          userId,
          status,
          loanAmount,
          tenor,
          interestRate,
          rejectionReason,
        },
      });

      if (error) {
        console.error('Error sending loan notification email:', error);
      } else {
        console.log(`Loan ${status} email sent successfully`);
      }
    } catch (err) {
      console.error('Failed to send loan notification email:', err);
    }
  };

  const handleApprove = async (appId: string) => {
    if (!user) return;
    
    const app = pendingApps.find(a => a.id === appId);
    if (!app) return;

    setIsProcessing(true);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Update loan status to active
      const { error: loanError } = await supabase
        .from('loans')
        .update({
          status: 'active',
          disbursement_date: today,
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq('id', appId);

      if (loanError) throw loanError;

      // Generate and insert installment schedule
      const installments = generateInstallmentSchedule(
        appId,
        app.amount,
        app.tenor,
        app.interestRate,
        new Date()
      );

      const { error: installmentError } = await supabase
        .from('loan_installments')
        .insert(installments);

      if (installmentError) throw installmentError;

      // Create automatic journal entry for loan disbursement
      const template = getTemplateByType('pencairan_pinjaman');
      let journalCreated = false;
      
      if (template) {
        const journalEntry = await createJournalFromTransaction(
          'pencairan_pinjaman',
          app.amount,
          'Pencairan Pinjaman',
          app.userName,
          template,
          undefined
        );
        
        if (journalEntry) {
          console.log('Auto-journal created for loan disbursement:', journalEntry.entry_number);
          journalCreated = true;
        }
      }

      // Send email notification (non-blocking)
      sendLoanNotificationEmail(
        app.userId,
        'approved',
        app.amount,
        app.tenor,
        app.interestRate
      );

      toast({
        title: 'Pinjaman Disetujui',
        description: journalCreated 
          ? `Pinjaman untuk ${app.userName} berhasil disetujui, jadwal angsuran & jurnal telah dibuat.`
          : `Pinjaman untuk ${app.userName} berhasil disetujui dan jadwal angsuran telah dibuat.`,
      });

      await queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      setSelectedApp(null);
      
      // Show approval letter dialog
      setShowLetterAfterApprove({
        loan: app,
        approvedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error approving loan:', error);
      toast({
        title: 'Gagal Menyetujui',
        description: 'Terjadi kesalahan saat menyetujui pinjaman.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (appId: string) => {
    if (!rejectionReason.trim()) {
      toast({
        title: 'Alasan Diperlukan',
        description: 'Silakan masukkan alasan penolakan.',
        variant: 'destructive',
      });
      return;
    }

    const app = pendingApps.find(a => a.id === appId);
    if (!app) return;

    setIsProcessing(true);
    
    try {
      const { error } = await supabase
        .from('loans')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', appId);

      if (error) throw error;

      // Send email notification (non-blocking)
      sendLoanNotificationEmail(
        app.userId,
        'rejected',
        app.amount,
        app.tenor,
        app.interestRate,
        rejectionReason.trim()
      );

      toast({
        title: 'Pengajuan Ditolak',
        description: 'Pengajuan pinjaman berhasil ditolak.',
      });

      await queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      setSelectedApp(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting loan:', error);
      toast({
        title: 'Gagal Menolak',
        description: 'Terjadi kesalahan saat menolak pengajuan.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Kelola Pinjaman</h1>
        <p className="mt-1 text-muted-foreground">Verifikasi pengajuan dan kelola pinjaman aktif</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:p-4 lg:p-5 xl:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-yellow-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground">{pendingApps.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Menunggu Verifikasi</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 lg:p-5 xl:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground">{activeLoans.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Pinjaman Aktif</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 lg:p-5 xl:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <RupiahIcon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-lg lg:text-xl font-bold text-foreground truncate">
                  {formatCurrency(activeLoans.reduce((sum, l) => sum + l.principalAmount, 0) + completedLoans.reduce((sum, l) => sum + l.principalAmount, 0))}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Disalurkan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 lg:p-5 xl:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-lg lg:text-xl font-bold text-foreground truncate">
                  {formatCurrency(activeLoans.reduce((sum, l) => sum + l.remainingPrincipal, 0))}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Sisa Piutang</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="space-y-4">
        <TabNavigation
          tabs={[
            { 
              value: 'pending', 
              icon: Clock, 
              label: 'Pengajuan Baru',
              badge: pendingApps.length > 0 ? pendingApps.length : undefined
            },
            { value: 'active', icon: CreditCard, label: 'Pinjaman Aktif' },
            { value: 'history', icon: History, label: 'Riwayat' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === 'pending' && (
          <div className="space-y-4">
            {pendingApps.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-lg font-medium text-foreground">Tidak Ada Pengajuan</p>
                  <p className="text-sm text-muted-foreground">Belum ada pengajuan pinjaman baru</p>
                </CardContent>
              </Card>
            ) : (
              pendingApps.map(app => (
                <Card key={app.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{app.userName}</p>
                          <p className="text-sm text-muted-foreground">{app.memberNumber}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="text-center">
                          <p className="text-lg font-bold text-primary">{formatCurrency(app.amount)}</p>
                          <p className="text-xs text-muted-foreground">{app.tenor} bulan</p>
                        </div>
                        <Button onClick={() => setSelectedApp(app)}>
                          Review
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'active' && (
          <div className="space-y-4">
            {activeLoans.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CreditCard className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-lg font-medium text-foreground">Tidak Ada Pinjaman Aktif</p>
                  <p className="text-sm text-muted-foreground">Belum ada pinjaman yang berjalan</p>
                </CardContent>
              </Card>
            ) : (
              activeLoans.map(loan => (
                <Card key={loan.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                          <CreditCard className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{loan.userName}</p>
                          <p className="text-sm text-muted-foreground">
                            Cair: {formatDate(loan.disbursementDate)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Pokok</p>
                          <p className="font-semibold text-foreground">{formatCurrency(loan.principalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Sisa</p>
                          <p className="font-semibold text-primary">{formatCurrency(loan.remainingPrincipal)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Progress</p>
                          <p className="font-semibold text-foreground">
                            {Math.round((1 - loan.remainingPrincipal / loan.principalAmount) * 100)}%
                          </p>
                        </div>
                        <Badge variant="default">Aktif</Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setInstallmentDetailsLoan(loan)}
                        >
                          <Calculator className="mr-2 h-4 w-4" />
                          Detail
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setRestructureLoan(loan)}
                        >
                          <RefreshCcw className="mr-2 h-4 w-4" />
                          Restruktur
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setLetterLoan(loan)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Surat
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {completedLoans.length === 0 && rejectedApps.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <History className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-lg font-medium text-foreground">Belum Ada Riwayat</p>
                  <p className="text-sm text-muted-foreground">Belum ada pinjaman yang selesai atau ditolak</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {completedLoans.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pinjaman Lunas</h3>
                    {completedLoans.map(loan => (
                      <Card key={loan.id} className="border-green-500/30">
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                                <CheckCircle className="h-6 w-6 text-green-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{loan.userName}</p>
                                <p className="text-sm text-muted-foreground">{loan.memberNumber}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Pokok</p>
                                <p className="font-semibold text-foreground">{formatCurrency(loan.principalAmount)}</p>
                              </div>
                              <Badge className="bg-green-600">Lunas</Badge>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setCompletedLetterLoan(loan)}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Surat
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {rejectedApps.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pengajuan Ditolak</h3>
                    {rejectedApps.map(app => (
                      <Card key={app.id} className="border-destructive/30">
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                                <XCircle className="h-6 w-6 text-destructive" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{app.userName}</p>
                                <p className="text-sm text-muted-foreground">{formatCurrency(app.amount)} - {app.tenor} bulan</p>
                                {app.rejectionReason && (
                                  <p className="text-xs text-destructive mt-1">Alasan: {app.rejectionReason}</p>
                                )}
                              </div>
                            </div>
                            <Badge variant="destructive">Ditolak</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedApp} onOpenChange={() => {
        setSelectedApp(null);
        setRejectionReason('');
        setWarningConfirmed(false);
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detail Pengajuan Pinjaman</DialogTitle>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selectedApp.userName}</p>
                  <p className="text-sm text-muted-foreground">{selectedApp.memberNumber}</p>
                </div>
              </div>

              {/* Warning if exceeds recommendation */}
              {exceedsRecommendation && (
                <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/10">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-700 dark:text-yellow-400 text-xs">
                    <strong>Peringatan:</strong> Jumlah pinjaman ({formatCurrency(selectedApp.amount)}) melebihi {loanSettings.maxLoanMultiplier}x total simpanan anggota ({formatCurrency(maxLoanBasedOnSavings)}). 
                    Pertimbangkan dengan hati-hati sebelum menyetujui.
                  </AlertDescription>
                </Alert>
              )}

              {/* Warning if simpanan wajib underpayment */}
              {savingsUnderpayment?.hasUnderpayment && (
                <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700 dark:text-red-400 text-xs">
                    <strong>Kekurangan Simpanan Wajib:</strong> Anggota ini memiliki tunggakan simpanan wajib sebesar {formatCurrency(savingsUnderpayment.deficitAmount)} ({savingsUnderpayment.deficitMonths} bulan).
                    <div className="mt-1 text-muted-foreground">
                      <span>Seharusnya: {formatCurrency(savingsUnderpayment.expectedAmount)}</span>
                      <span className="mx-2">|</span>
                      <span>Saat ini: {formatCurrency(savingsUnderpayment.actualAmount)}</span>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Applicant savings info */}
              {isLoadingSavings ? (
                <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-md p-3 animate-pulse">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Memuat data simpanan...</span>
                </div>
              ) : applicantSavings && (
                <div className="text-xs bg-muted/50 rounded-md p-3 border border-border/50 space-y-1.5">
                  <div className="flex items-center gap-2 font-medium text-muted-foreground">
                    <Info className="h-4 w-4" />
                    <span>Simpanan Pemohon</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <div>
                      <span className="text-muted-foreground">Pokok:</span>
                      <span className="font-medium text-foreground ml-1">{formatCurrency(applicantSavings.simpananPokok)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Wajib:</span>
                      <span className="font-medium text-foreground ml-1">{formatCurrency(applicantSavings.simpananWajib)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sukarela:</span>
                      <span className="font-medium text-foreground ml-1">{formatCurrency(applicantSavings.simpananSukarela)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-bold text-primary ml-1">{formatCurrency(applicantSavings.totalSimpanan)}</span>
                    </div>
                  </div>
                  <div className="pl-6 pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">Maks pinjaman ({loanSettings.maxLoanMultiplier}x):</span>
                    <span className={`font-bold ml-1 ${exceedsRecommendation ? 'text-yellow-600' : 'text-green-600'}`}>
                      {formatCurrency(maxLoanBasedOnSavings)}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Jumlah Pinjaman</span>
                  <span className={`font-semibold ${exceedsRecommendation ? 'text-yellow-600' : 'text-foreground'}`}>
                    {formatCurrency(selectedApp.amount)}
                    {exceedsRecommendation && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Tenor</span>
                  <span className="font-semibold text-foreground">{selectedApp.tenor} bulan</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Bunga per bulan</span>
                  <span className="font-semibold text-foreground">{(selectedApp.interestRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Angsuran per bulan</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency((selectedApp.amount / selectedApp.tenor) + (selectedApp.amount * selectedApp.interestRate))}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Tanggal Ajuan</span>
                  <span className="font-semibold text-foreground">{formatDate(selectedApp.appliedAt)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Alasan Penolakan (jika ditolak)</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Masukkan alasan penolakan..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>

              {/* Warning confirmation checkbox */}
              {(exceedsRecommendation || savingsUnderpayment?.hasUnderpayment) && (
                <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
                  <Checkbox
                    id="warning-confirm"
                    checked={warningConfirmed}
                    onCheckedChange={(checked) => setWarningConfirmed(checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="warning-confirm" className="text-sm font-medium text-amber-700 dark:text-amber-400 cursor-pointer">
                      Konfirmasi Persetujuan dengan Peringatan
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Saya telah mempertimbangkan peringatan di atas dan tetap menyetujui pengajuan pinjaman ini.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleReject(selectedApp.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Tolak
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => handleApprove(selectedApp.id)}
                  disabled={isProcessing || ((exceedsRecommendation || savingsUnderpayment?.hasUnderpayment) && !warningConfirmed)}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Setujui
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Loan Approval Letter Dialog - for active loans */}
      {letterLoan && (
        <LoanApprovalLetter
          open={!!letterLoan}
          onClose={() => setLetterLoan(null)}
          loan={{
            id: letterLoan.id,
            memberName: letterLoan.userName,
            memberNumber: letterLoan.memberNumber,
            principalAmount: letterLoan.principalAmount,
            tenor: letterLoan.tenor,
            interestRate: letterLoan.interestRate,
            disbursementDate: letterLoan.disbursementDate,
            approvedAt: letterLoan.disbursementDate,
          }}
        />
      )}

      {/* Loan Approval Letter Dialog - after approve */}
      {showLetterAfterApprove && (
        <LoanApprovalLetter
          open={!!showLetterAfterApprove}
          onClose={() => setShowLetterAfterApprove(null)}
          loan={{
            id: showLetterAfterApprove.loan.id,
            memberName: showLetterAfterApprove.loan.userName,
            memberNumber: showLetterAfterApprove.loan.memberNumber,
            principalAmount: showLetterAfterApprove.loan.amount,
            tenor: showLetterAfterApprove.loan.tenor,
            interestRate: showLetterAfterApprove.loan.interestRate,
            disbursementDate: new Date().toISOString().split('T')[0],
            approvedAt: showLetterAfterApprove.approvedAt,
          }}
        />
      )}

      {/* Loan Approval Letter Dialog - for completed loans */}
      {completedLetterLoan && (
        <LoanApprovalLetter
          open={!!completedLetterLoan}
          onClose={() => setCompletedLetterLoan(null)}
          loan={{
            id: completedLetterLoan.id,
            memberName: completedLetterLoan.userName,
            memberNumber: completedLetterLoan.memberNumber,
            principalAmount: completedLetterLoan.principalAmount,
            tenor: completedLetterLoan.tenor,
            interestRate: completedLetterLoan.interestRate,
            disbursementDate: completedLetterLoan.disbursementDate,
            approvedAt: completedLetterLoan.disbursementDate,
          }}
        />
      )}

      {/* Loan Installment Details Dialog */}
      {installmentDetailsLoan && (
        <LoanInstallmentDetails
          open={!!installmentDetailsLoan}
          onClose={() => setInstallmentDetailsLoan(null)}
          loan={installmentDetailsLoan}
        />
      )}

      {/* Loan Restructure Dialog */}
      {restructureLoan && (
        <LoanRestructureDialog
          open={!!restructureLoan}
          onClose={async () => {
            setRestructureLoan(null);
            await queryClient.invalidateQueries({ queryKey: ['all-loans'] });
          }}
          loan={restructureLoan}
        />
      )}
    </div>
  );
};
