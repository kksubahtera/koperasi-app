import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SavingsInterestHistory } from '@/components/member/SavingsInterestHistory';
import { UnderpaymentNotification } from '@/components/member/UnderpaymentNotification';
import { ProfileDashboard } from '@/components/member/ProfileDashboard';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { formatCurrency } from '@/lib/mockData';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useUserSavings } from '@/hooks/useUserSavings';
import { useUserLoans } from '@/hooks/useUserLoans';
import { useSavingsRequirementNotification } from '@/hooks/useSavingsRequirementNotification';
import { useMemberRealtimeUpdates } from '@/hooks/useRealtimeSubscription';
import { TrendingUp, CreditCard, Percent, Gift, Lightbulb, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface MemberDashboardProps {
  onNavigate: (view: string) => void;
}

// Smooth scroll utility
const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start'
    });
  }
};

export const MemberDashboard = ({ onNavigate }: MemberDashboardProps) => {
  const { user } = useAuth();
  const { t } = useThemeLanguage();
  const { savings, refetch: refetchSavings } = useUserSavings();
  const { loans, installments: loanInstallments, refetch: refetchLoans } = useUserLoans();
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Enable real-time updates for member data
  useMemberRealtimeUpdates(user?.id);

  // Check savings requirement and create notification if needed
  useSavingsRequirementNotification();

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    try {
      await Promise.all([
        refetchSavings(),
        refetchLoans()
      ]);
      toast.success(t('Data berhasil diperbarui', 'Data refreshed successfully'));
    } catch (error) {
      toast.error(t('Gagal memperbarui data', 'Failed to refresh data'));
    }
  }, [refetchSavings, refetchLoans, t]);

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  if (!user) return null;

  // Check if user has active loan
  const hasActiveLoan = loans.some(l => l.status === 'active');

  // Calculate months since joining for expected savings
  const joinDate = new Date(user.joinDate);
  const today = new Date();
  const monthsJoined = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                       (today.getMonth() - joinDate.getMonth()) + 1;
  const expectedMonthlySaving = 50000; // Rp50,000 per month for simpanan wajib

  // Quick navigation items - ordered as requested
  const quickNavItems = [
    ...(hasActiveLoan ? [{ 
      id: 'installment-section', 
      label: t('Angsuran', 'Installment'), 
      icon: CreditCard,
    }] : []),
    ...(savings.simpananSukarela > 0 ? [{ 
      id: 'interest-history', 
      label: t('Bunga', 'Interest'), 
      icon: Percent,
    }] : []),
    { 
      id: 'savings-growth', 
      label: t('Pertumbuhan', 'Growth'), 
      icon: TrendingUp,
    },
    { 
      id: 'shu-section', 
      label: t('SHU', 'SHU'), 
      icon: Gift,
    },
    { 
      id: 'insights-section', 
      label: t('Insight', 'Insight'), 
      icon: Lightbulb,
    },
  ];

  // Prepare interest history component to pass to ProfileDashboard
  const interestHistoryComponent = savings.simpananSukarela > 0 ? (
    <SavingsInterestHistory simpananSukarela={savings.simpananSukarela} />
  ) : null;

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-[50vh]">
      <div className="space-y-4 md:space-y-6">
      {/* Hero Welcome Banner - Mobile Optimized */}
      <div id="hero-section" className="animate-fade-in rounded-2xl md:rounded-3xl overflow-hidden relative">
        {/* Background with gradient and pattern */}
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.1),transparent_50%)]" />
        
        {/* Content */}
        <div className="relative z-10 p-4 md:p-8">
          {/* Welcome Header - Compact for Mobile */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Profile Photo - Smaller on Mobile */}
            <div className="shrink-0">
              <div className="h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-2xl bg-white/20 backdrop-blur-md border-2 border-white/30 overflow-hidden shadow-lg">
                {user.profilePhoto ? (
                  <img 
                    src={user.profilePhoto} 
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-white text-lg md:text-2xl font-bold bg-white/10">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            
            {/* Welcome text - Compact */}
            <div className="flex-1 min-w-0">
              <p className="text-primary-foreground/70 text-[10px] md:text-xs font-medium">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
              <h1 className="text-lg md:text-2xl font-bold text-primary-foreground truncate">
                {t('Halo', 'Hello')}, {user.name.split(' ')[0]}! 👋
              </h1>
              <p className="text-primary-foreground/80 text-[11px] md:text-sm truncate">
                {t('Selamat datang di koperasi', 'Welcome to the cooperative')}
              </p>
            </div>
          </div>
          
          {/* Stats Cards - Responsive Grid */}
          <div className="mt-4 md:mt-6 space-y-2 md:space-y-0 md:grid md:grid-cols-3 md:gap-3">
            {/* Total Simpanan - Full Width on Mobile */}
            <button 
              onClick={() => scrollToSection('savings-growth')}
              className="w-full rounded-xl md:rounded-2xl bg-white/15 backdrop-blur-md p-3 md:p-4 border border-white/20 transition-all duration-300 hover:bg-white/25 active:scale-[0.98] text-left group"
            >
              <div className="flex items-center justify-between md:flex-col md:items-start md:gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg md:rounded-xl bg-white/20 flex items-center justify-center">
                    <span className="text-xs md:text-sm">💰</span>
                  </div>
                  <p className="text-[11px] md:text-xs text-primary-foreground/80 font-medium">{t('Total Simpanan', 'Total Savings')}</p>
                </div>
                <p className="text-base md:text-xl font-bold text-primary-foreground">{formatCurrency(savings.totalSimpanan)}</p>
              </div>
            </button>
            
            {/* Simpanan Wajib & Sukarela - Side by Side on Mobile */}
            <div className="grid grid-cols-2 gap-2 md:contents">
              <button 
                onClick={() => scrollToSection('savings-growth')}
                className="rounded-xl md:rounded-2xl bg-white/15 backdrop-blur-md p-3 md:p-4 border border-white/20 transition-all duration-300 hover:bg-white/25 active:scale-[0.98] text-left group"
              >
                <div className="flex items-center gap-1.5 mb-1 md:mb-2">
                  <div className="h-6 w-6 md:h-8 md:w-8 rounded-lg md:rounded-xl bg-white/20 flex items-center justify-center">
                    <span className="text-[10px] md:text-sm">📊</span>
                  </div>
                  <p className="text-[10px] md:text-xs text-primary-foreground/80 font-medium truncate">{t('Wajib', 'Mandatory')}</p>
                </div>
                <p className="text-sm md:text-xl font-bold text-primary-foreground truncate">{formatCurrency(savings.simpananWajib)}</p>
              </button>
              
              <button 
                onClick={() => scrollToSection(savings.simpananSukarela > 0 ? 'interest-history' : 'savings-growth')}
                className="rounded-xl md:rounded-2xl bg-white/15 backdrop-blur-md p-3 md:p-4 border border-white/20 transition-all duration-300 hover:bg-white/25 active:scale-[0.98] text-left group"
              >
                <div className="flex items-center gap-1.5 mb-1 md:mb-2">
                  <div className="h-6 w-6 md:h-8 md:w-8 rounded-lg md:rounded-xl bg-white/20 flex items-center justify-center">
                    <span className="text-[10px] md:text-sm">✨</span>
                  </div>
                  <p className="text-[10px] md:text-xs text-primary-foreground/80 font-medium truncate">{t('Sukarela', 'Voluntary')}</p>
                </div>
                <p className="text-sm md:text-xl font-bold text-primary-foreground truncate">{formatCurrency(savings.simpananSukarela)}</p>
              </button>
            </div>
          </div>

          {/* Quick Navigation Pills - Scrollable */}
          <div className="mt-3 md:mt-4 flex items-center gap-1.5 md:gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] scrollbar-hide">
            <span className="text-[10px] md:text-xs text-primary-foreground/60 shrink-0">{t('Ke:', 'To:')}</span>
            {quickNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-[10px] md:text-xs font-medium text-primary-foreground/90 hover:bg-white/30 transition-all duration-200 active:scale-95 shrink-0"
                >
                  <Icon className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Underpayment Notifications */}
      <UnderpaymentNotification 
        installments={loanInstallments}
        savings={savings}
        expectedMonthlySaving={expectedMonthlySaving}
        monthsJoined={monthsJoined}
      />

      {/* Profile Dashboard with all sections in correct order:
          1. Progress Angsuran (if has loan)
          2. Riwayat Bunga Simpanan Sukarela (passed as prop)
          3. Grafik Pertumbuhan Simpanan
          4. Estimasi SHU
          5. Insight
      */}
      <ProfileDashboard 
        onNavigate={onNavigate} 
        interestHistoryComponent={interestHistoryComponent}
      />

      {/* Scroll to Top Button */}
      <Button
        onClick={scrollToTop}
        className={`fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg transition-all duration-300 ${
          showScrollTop 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        size="icon"
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
      </div>
    </PullToRefresh>
  );
};
