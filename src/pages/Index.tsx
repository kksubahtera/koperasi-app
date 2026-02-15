import { useState, useEffect, useMemo } from 'react';
import { useAuth, RegistrationData } from '@/contexts/AuthContext';
import { AuthLanding } from '@/components/auth/AuthLanding';
import { LoginForm } from '@/components/auth/LoginForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { CooperativeProfile } from '@/components/auth/CooperativeProfile';
import { RegistrationForm } from '@/components/auth/RegistrationForm';
import { PendingApprovalScreen } from '@/components/auth/PendingApprovalScreen';
import { ForcePasswordChangeForm } from '@/components/auth/ForcePasswordChangeForm';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { PageTransition } from '@/components/shared/PageTransition';
import { PageLoader } from '@/components/shared/PageLoader';
import { MemberDashboard } from '@/components/views/MemberDashboard';
import { AdminDashboard } from '@/components/views/AdminDashboard';

import { TransactionList } from '@/components/member/TransactionList';
import { SavingsCardCarousel } from '@/components/member/SavingsCardCarousel';
import { TransactionForm } from '@/components/member/TransactionForm';
import { LoanCard } from '@/components/member/LoanCard';
import { LoanDashboard } from '@/components/member/LoanDashboard';
import { SHUHistory } from '@/components/member/SHUHistory';
import { ProfilePage } from '@/components/member/ProfilePage';
import { NotificationsPage } from '@/components/member/NotificationsPage';
import { LoanApplicationForm } from '@/components/member/LoanApplicationForm';
import { ResignationForm } from '@/components/member/ResignationForm';
import { BusinessTransactionsHistory } from '@/components/member/BusinessTransactionsHistory';
import { EarlyPayoffHistory } from '@/components/member/EarlyPayoffHistory';
import { RefundNotification } from '@/components/member/RefundNotification';
import { TransactionManagement } from '@/components/admin/TransactionManagement';
import { CooperativeSummaryView } from '@/components/admin/CooperativeSummary';
import { MemberList } from '@/components/admin/MemberList';
import { ExitedMembersList } from '@/components/admin/ExitedMembersList';
import { BusinessUnitsHub } from '@/components/admin/BusinessUnitsHub';
import { InactiveMembersReport } from '@/components/admin/InactiveMembersReport';
import { RegistrationRequests } from '@/components/admin/RegistrationRequests';
import { CooperativeSettings } from '@/components/admin/CooperativeSettings';
import { AccountingDashboard } from '@/components/admin/AccountingDashboard';
import { CorrectionReports } from '@/components/admin/CorrectionReports';
import { SHUFundActivities } from '@/components/admin/SHUFundActivities';
import { LetterArchive } from '@/components/admin/LetterArchive';
import { DataMigrationWizard } from '@/components/admin/DataMigrationWizard';
import { OverdueDashboard } from '@/components/admin/OverdueDashboard';
import { ResignationManagement } from '@/components/admin/ResignationManagement';
import { ExitedMembersHistory } from '@/components/admin/ExitedMembersHistory';
import { PasswordAuditLog } from '@/components/admin/PasswordAuditLog';
import { NotificationEmailSettings } from '@/components/admin/NotificationEmailSettings';
import { SystemAuditLog } from '@/components/admin/SystemAuditLog';
import { DataBackupPanel } from '@/components/admin/DataBackupPanel';
import { UnderpaymentDashboard } from '@/components/admin/UnderpaymentDashboard';
import { BalanceReconciliationDashboard } from '@/components/admin/BalanceReconciliationDashboard';
import { SavingsAuditTrail } from '@/components/admin/SavingsAuditTrail';
import AdminManagement from '@/components/admin/AdminManagement';
import { OverpaymentReport } from '@/components/admin/OverpaymentReport';
import { OfficersManagement } from '@/components/admin/OfficersManagement';
import AdminMemberCreation from '@/components/admin/AdminMemberCreation';
import { UnclaimedAccountsReport } from '@/components/admin/UnclaimedAccountsReport';
import { MigrationReconciliationReport } from '@/components/admin/MigrationReconciliationReport';
import { MigrationReportsHub } from '@/components/admin/MigrationReportsHub';
import { formatDate } from '@/lib/mockData';
import { toast } from 'sonner';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useUserLoans } from '@/hooks/useUserLoans';
import { useUserSavings } from '@/hooks/useUserSavings';
import { useUserTransactions } from '@/hooks/useUserTransactions';
import { useAllTransactions, useAllTransactionsPaginated } from '@/hooks/useAllTransactions';
import { usePaginatedMembers, usePaginatedExitedMembers, MemberProfile } from '@/hooks/usePaginatedMembers';
import { useUserSHU } from '@/hooks/useUserSHU';
import { useTransactionNotifications } from '@/hooks/useTransactionNotifications';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { useProfileCompletionReminder } from '@/hooks/useProfileCompletionReminder';
import { useQuery } from '@tanstack/react-query';

type AuthView = 'landing' | 'login' | 'profile' | 'register' | 'pending' | 'forgot-password';

const AppContent = () => {
  const { user, isLoading, register, logout } = useAuth();
  const { t } = useThemeLanguage();
  const [currentView, setCurrentView] = useState('dashboard');
  const [authView, setAuthView] = useState<AuthView>('landing');
  const [prevUserId, setPrevUserId] = useState<string | null>(null);
  const [prevActiveRole, setPrevActiveRole] = useState<string | null>(null);

  // Reset to dashboard when user logs in, changes, or switches role
  useEffect(() => {
    if (user) {
      // Reset to dashboard on login or user change
      if (user.id !== prevUserId) {
        setCurrentView('dashboard');
        setPrevUserId(user.id);
        setPrevActiveRole(user.activeRole);
      }
      // Reset to dashboard when role changes
      else if (user.activeRole !== prevActiveRole) {
        setCurrentView('dashboard');
        setPrevActiveRole(user.activeRole);
      }
    } else if (prevUserId) {
      setPrevUserId(null);
      setPrevActiveRole(null);
    }
  }, [user, prevUserId, prevActiveRole]);

  // Enable real-time notifications for transaction updates (member)
  useTransactionNotifications();
  
  // Enable real-time notifications for new transactions/loans (admin)
  useAdminNotifications();
  
  // Show profile completion reminder on login
  useProfileCompletionReminder();

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Fetch loans from database
  const { loans: userLoans, installments: loanInstallments, isLoading: loansLoading, refetch: refetchLoans } = useUserLoans();
  
  // Fetch savings from database
  const { savings, isLoading: savingsLoading } = useUserSavings();
  
  // Fetch transactions from database
  const { transactions: userTransactions, isLoading: transactionsLoading } = useUserTransactions();
  
  // Fetch all transactions for admin (paginated)
  const { 
    transactions: allTransactions, 
    isLoading: allTransactionsLoading,
    isFetchingNextPage: isFetchingMoreTransactions,
    hasNextPage: hasMoreTransactions,
    fetchNextPage: fetchNextTransactions,
    refetch: refetchTransactions
  } = useAllTransactionsPaginated();
  
  // Fetch members for admin (paginated)
  const {
    members: paginatedMembers,
    isLoading: membersLoading,
    isFetchingNextPage: isFetchingMoreMembers,
    hasNextPage: hasMoreMembers,
    fetchNextPage: fetchNextMembers,
    refetch: refetchMembers
  } = usePaginatedMembers({ isActive: true, approvalStatus: 'approved' });
  
  // Fetch inactive/exited members for inactive report
  const { members: exitedMembersRaw } = usePaginatedExitedMembers();
  
  // Map exited members to User type for InactiveMembersReport
  const exitedMembers = useMemo(() => {
    return exitedMembersRaw.map((profile: MemberProfile) => ({
      id: profile.user_id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone || '',
      nik: profile.nik || '',
      address: profile.address || '',
      bankAccountNumber: profile.bank_account_number || '',
      bankAccountName: profile.bank_account_name || '',
      profilePhoto: profile.profile_photo || undefined,
      role: 'member' as const,
      memberNumber: profile.member_number || '',
      joinDate: profile.join_date || '',
      exitDate: profile.exit_date || undefined,
      exitYear: profile.exit_year || undefined,
      isActive: profile.is_active,
    }));
  }, [exitedMembersRaw]);
  
  // Fetch SHU records from database
  const { shuRecords: userSHU } = useUserSHU();

  // Fetch pending registrations count for admin dashboard
  const { data: pendingRegistrationsCount = 0 } = useQuery({
    queryKey: ['pending-registrations-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending');
      
      if (error) {
        console.error('Error fetching pending registrations count:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!user && user.roles?.includes('admin'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Handle navigation from notification click
  useEffect(() => {
    const handleNavigateToVerify = () => setCurrentView('verify');
    const handleNavigateToLoans = () => setCurrentView('loan-management');
    const handleNavigateToNotifications = () => setCurrentView('notifications');
    const handleNavigateToSavings = () => setCurrentView('savings');
    const handleNavigateToProfile = () => setCurrentView('profile');
    const handleNavigateToSHUWithheld = () => setCurrentView('accounting-shu-withheld');
    const handleNavigateToAccounting = () => setCurrentView('accounting');

    window.addEventListener('navigate-to-verify', handleNavigateToVerify);
    window.addEventListener('navigate-to-loans', handleNavigateToLoans);
    window.addEventListener('navigate-to-notifications', handleNavigateToNotifications);
    window.addEventListener('navigate-to-savings', handleNavigateToSavings);
    window.addEventListener('navigate-to-profile', handleNavigateToProfile);
    window.addEventListener('navigate-to-shu-withheld', handleNavigateToSHUWithheld);
    window.addEventListener('navigate-to-accounting', handleNavigateToAccounting);

    return () => {
      window.removeEventListener('navigate-to-verify', handleNavigateToVerify);
      window.removeEventListener('navigate-to-loans', handleNavigateToLoans);
      window.removeEventListener('navigate-to-notifications', handleNavigateToNotifications);
      window.removeEventListener('navigate-to-savings', handleNavigateToSavings);
      window.removeEventListener('navigate-to-profile', handleNavigateToProfile);
      window.removeEventListener('navigate-to-shu-withheld', handleNavigateToSHUWithheld);
      window.removeEventListener('navigate-to-accounting', handleNavigateToAccounting);
    };
  }, []);

  // Handle registration submission
  const handleRegistration = async (data: RegistrationData): Promise<{ success: boolean; message?: string }> => {
    const result = await register(data);
    if (result.success) {
      // Show pending approval screen after successful registration
      setAuthView('pending');
    }
    return result;
  };

  // Show loading state while checking auth
  if (isLoading) {
    return <PageLoader />;
  }

  // Check if user is pending approval (admin bypass - admin tidak perlu approval)
  if (user && user.approvalStatus === 'pending' && !user.roles?.includes('admin')) {
    return (
      <PendingApprovalScreen 
        onLogout={async () => {
          await logout();
          setAuthView('landing');
        }}
        userName={user.name}
      />
    );
  }

  // Check if user must change password (migrated account)
  if (user && user.mustChangePassword) {
    return <ForcePasswordChangeForm />;
  }

  // Check if user is rejected
  if (user && user.approvalStatus === 'rejected') {
    toast.error(t('Pendaftaran Anda ditolak', 'Your registration was rejected'), {
      description: user.rejectionReason || t('Silakan hubungi admin untuk informasi lebih lanjut', 'Please contact admin for more information'),
    });
    logout();
  }

  if (!user) {
    switch (authView) {
      case 'landing':
        return (
          <AuthLanding 
            onGetStarted={() => setAuthView('profile')} 
            onLogin={() => setAuthView('login')} 
          />
        );
      case 'login':
        return (
          <LoginForm 
            onBack={() => setAuthView('landing')} 
            onForgotPassword={() => setAuthView('forgot-password')}
          />
        );
      case 'forgot-password':
        return <ForgotPasswordForm onBack={() => setAuthView('login')} />;
      case 'profile':
        return (
          <CooperativeProfile 
            onBack={() => setAuthView('landing')} 
            onRegister={() => setAuthView('register')} 
          />
        );
      case 'register':
        return (
          <RegistrationForm 
            onBack={() => setAuthView('profile')} 
            onSubmit={handleRegistration} 
          />
        );
      case 'pending':
        return (
          <PendingApprovalScreen 
            onLogout={() => setAuthView('landing')}
          />
        );
      default:
        return (
          <AuthLanding 
            onGetStarted={() => setAuthView('profile')} 
            onLogin={() => setAuthView('login')} 
          />
        );
    }
  }

  const renderMemberView = () => {
    const userLoan = userLoans.find(l => l.status === 'active');

    // Check if user is inactive (resigned)
    const isInactive = !user.isActive;

    switch (currentView) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Show refund notification for inactive members */}
            {isInactive && (
              <RefundNotification 
                refundStatus="completed" 
                refundDate={user.exitDate} 
              />
            )}
            <MemberDashboard onNavigate={setCurrentView} />
          </div>
        );
      case 'savings':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('Simpanan Saya', 'My Savings')}</h1>
              <p className="mt-1 text-muted-foreground">
                {isInactive 
                  ? t('Data simpanan akhir keanggotaan', 'Final membership savings data') 
                  : t('Kelola simpanan koperasi Anda', 'Manage your cooperative savings')}
              </p>
            </div>
            
            {/* Desktop: Side by side | Mobile: Stacked */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start">
              <SavingsCardCarousel savings={savings} />
              {!isInactive && (
                <TransactionForm 
                  hasLoan={!!userLoan} 
                  loan={userLoan}
                  installments={loanInstallments}
                  voluntarySavings={savings.simpananSukarela}
                />
              )}
            </div>
            
            {!isInactive && (
              <TransactionList transactions={userTransactions} showAll />
            )}
          </div>
        );
      case 'transactions':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('Riwayat Transaksi', 'Transaction History')}</h1>
              <p className="mt-1 text-muted-foreground">{t('Lihat semua transaksi Anda', 'View all your transactions')}</p>
            </div>
            <TransactionList transactions={userTransactions} showAll />
          </div>
        );
      case 'loans':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('Pinjaman Saya', 'My Loans')}</h1>
              <p className="mt-1 text-muted-foreground">{t('Detail pinjaman aktif dan riwayat pinjaman Anda', 'Your active loan details and loan history')}</p>
            </div>
            <LoanDashboard loans={userLoans} installments={loanInstallments} />
            <LoanCard 
              loans={userLoans} 
              installments={loanInstallments} 
              onLoanDeleted={refetchLoans}
              onNavigate={setCurrentView}
            />
          </div>
        );
      case 'loan-apply':
        return <LoanApplicationForm />;
      case 'resign':
        return <ResignationForm />;
      case 'shu':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('Riwayat SHU', 'SHU History')}</h1>
              <p className="mt-1 text-muted-foreground">{t('Sisa Hasil Usaha yang telah Anda terima', 'Surplus you have received')}</p>
            </div>
            <SHUHistory records={userSHU} />
          </div>
        );
      case 'business-transactions':
        return <BusinessTransactionsHistory onBack={() => setCurrentView('dashboard')} />;
      case 'early-payoff-history':
        return <EarlyPayoffHistory onBack={() => setCurrentView('loans')} />;
      case 'profile':
        return <ProfilePage />;
      case 'notifications':
        return <NotificationsPage onBack={() => setCurrentView('dashboard')} onNavigate={setCurrentView} />;
      default:
        return <MemberDashboard onNavigate={setCurrentView} />;
    }
  };

  const renderAdminView = () => {
    switch (currentView) {
      case 'dashboard':
        return <AdminDashboard onNavigate={setCurrentView} pendingRegistrations={pendingRegistrationsCount} />;
      case 'verify':
        return (
          <TransactionManagement 
            transactions={allTransactions} 
            isLoading={allTransactionsLoading}
            isFetchingMore={isFetchingMoreTransactions}
            hasMore={hasMoreTransactions}
            onLoadMore={fetchNextTransactions}
            onRefresh={async () => { await refetchTransactions(); }}
          />
        );
      case 'registrations':
        return <RegistrationRequests />;
      case 'members':
        const handleMakeAdmin = async (memberId: string) => {
          const { error } = await supabase
            .from('user_roles')
            .insert({
              user_id: memberId,
              role: 'admin'
            });
          
          if (error) {
            if (error.code === '23505') {
              toast.error('User sudah memiliki role admin');
            } else {
              toast.error('Gagal menjadikan admin: ' + error.message);
            }
            return;
          }
          
          toast.success('Berhasil dijadikan admin');
        };

        const handleRemoveAdmin = async (memberId: string) => {
          const { error } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', memberId)
            .eq('role', 'admin');
          
          if (error) {
            toast.error('Gagal menghapus role admin: ' + error.message);
            return;
          }
          
          toast.success('Role admin berhasil dihapus');
        };

        const handleResetPassword = async (memberId: string, newPassword: string) => {
          try {
            const { data, error } = await supabase.functions.invoke('reset-password', {
              body: { user_id: memberId, new_password: newPassword }
            });

            if (error) {
              console.error('Password reset error:', error);
              toast.error('Gagal reset password: ' + error.message);
              return;
            }

            if (data?.error) {
              toast.error('Gagal reset password: ' + data.error);
              return;
            }

            toast.success('Password berhasil direset');
          } catch (err) {
            console.error('Password reset exception:', err);
            toast.error('Gagal reset password');
          }
        };

        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Data Anggota</h1>
              <p className="mt-1 text-muted-foreground">Kelola data anggota koperasi</p>
            </div>
            <MemberList 
              members={paginatedMembers.map(m => ({
                id: m.user_id,
                name: m.name,
                email: m.email,
                phone: m.phone || '',
                nik: m.nik || '',
                address: m.address || '',
                memberNumber: m.member_number || '',
                role: 'member' as const,
                joinDate: m.join_date || '',
                isActive: m.is_active,
                approvalStatus: m.approval_status || 'pending',
                activeRole: 'member',
                profilePhoto: m.profile_photo || undefined,
                bankAccountNumber: m.bank_account_number || undefined,
                bankAccountName: m.bank_account_name || undefined,
                exitDate: m.exit_date || undefined,
                exitYear: m.exit_year || undefined,
                branchId: m.branch_id || undefined,
              }))}
              onViewInactiveMembers={() => setCurrentView('exited-members-history')}
              onAddNewMember={() => setCurrentView('add-new-member')}
              onMakeAdmin={handleMakeAdmin}
              onRemoveAdmin={handleRemoveAdmin}
              onResetPassword={handleResetPassword}
              currentUserId={user?.id}
              isFetchingMore={isFetchingMoreMembers}
              hasMore={hasMoreMembers}
              onLoadMore={fetchNextMembers}
              onRefresh={async () => { await refetchMembers(); }}
            />
          </div>
        );
      case 'loan-manage':
        return <BusinessUnitsHub />;
      case 'summary':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Ringkasan Keuangan</h1>
              <p className="mt-1 text-muted-foreground">Laporan keuangan koperasi</p>
            </div>
            <CooperativeSummaryView />
          </div>
        );
      case 'inactive-report':
        return <InactiveMembersReport members={exitedMembers} />;
      case 'coop-settings':
        return <CooperativeSettings onBack={() => setCurrentView('dashboard')} onNavigate={setCurrentView} />;
      case 'accounting':
        return <AccountingDashboard onBack={() => setCurrentView('dashboard')} />;
      case 'correction-reports':
        return <CorrectionReports onBack={() => setCurrentView('dashboard')} />;
      case 'shu-activities':
        return <SHUFundActivities onBack={() => setCurrentView('dashboard')} />;
      case 'letter-archive':
        return <LetterArchive />;
      case 'data-migration':
        return <DataMigrationWizard onBack={() => setCurrentView('dashboard')} />;
      case 'overdue-dashboard':
        return <OverdueDashboard />;
      case 'resignation-management':
        return <ResignationManagement onBack={() => setCurrentView('dashboard')} />;
      case 'exited-members-history':
        return <ExitedMembersHistory />;
      case 'password-audit-log':
        return <PasswordAuditLog onBack={() => setCurrentView('coop-settings')} />;
      case 'notification-settings':
        return <NotificationEmailSettings onBack={() => setCurrentView('coop-settings')} />;
      case 'system-audit-log':
        return <SystemAuditLog onBack={() => setCurrentView('coop-settings')} />;
      case 'data-backup':
        return <DataBackupPanel onBack={() => setCurrentView('coop-settings')} />;
      case 'accounting-shu-withheld':
        return <AccountingDashboard onBack={() => setCurrentView('dashboard')} />;
      case 'underpayment-tracking':
        return <UnderpaymentDashboard onBack={() => setCurrentView('dashboard')} />;
      case 'balance-reconciliation':
        return <BalanceReconciliationDashboard />;
      case 'savings-audit-trail':
        return <SavingsAuditTrail onBack={() => setCurrentView('accounting')} />;
      case 'admin-management':
        return <AdminManagement />;
      case 'overpayment-report':
        return <OverpaymentReport onBack={() => setCurrentView('accounting')} />;
      case 'officers-management':
        return <OfficersManagement onBack={() => setCurrentView('dashboard')} />;
      case 'add-new-member':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tambah Anggota Baru</h1>
              <p className="mt-1 text-muted-foreground">Buat akun anggota baru secara manual</p>
            </div>
            <AdminMemberCreation onSuccess={() => refetchMembers()} />
          </div>
        );
      case 'unclaimed-accounts':
        return <UnclaimedAccountsReport onBack={() => setCurrentView('migration-reports')} />;
      case 'migration-reconciliation':
        return <MigrationReconciliationReport onBack={() => setCurrentView('migration-reports')} />;
      case 'migration-reports':
        return <MigrationReportsHub onBack={() => setCurrentView('dashboard')} />;
      default:
        return <AdminDashboard onNavigate={setCurrentView} pendingRegistrations={0} />;
    }
  };

  return (
    <div className="flex min-h-screen max-h-screen flex-col bg-background overflow-hidden">
      <AppHeader />
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 pt-4 pb-20 sm:px-4 sm:pt-6 sm:pb-24 md:px-6 md:pt-8 lg:px-8 lg:pt-10 main-content-with-nav">
        <div className="mx-auto max-w-6xl">
          <PageTransition viewKey={currentView}>
            {user.activeRole === 'admin' ? renderAdminView() : renderMemberView()}
          </PageTransition>
        </div>
      </main>
      <div className="hidden md:block">
        <AppFooter />
      </div>
      <BottomNavigation currentView={currentView} onViewChange={setCurrentView} />
    </div>
  );
};

export default AppContent;
