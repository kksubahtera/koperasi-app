import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useAnimationConfig } from '@/hooks/useAnimationConfig';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Wallet, 
  CreditCard,
  Building2,
  Users, 
  ClipboardCheck,
  User,
  BarChart3,
  FileText,
  UserPlus,
  Settings
} from 'lucide-react';

interface BottomNavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

interface NavItem {
  id: string;
  labelId: string;
  labelEn: string;
  icon: React.ComponentType<{ className?: string }>;
}

const memberNavItems: NavItem[] = [
  { id: 'dashboard', labelId: 'Beranda', labelEn: 'Home', icon: LayoutDashboard },
  { id: 'savings', labelId: 'Transaksi', labelEn: 'Transactions', icon: Wallet },
  { id: 'loans', labelId: 'Pinjaman', labelEn: 'Loans', icon: CreditCard },
  { id: 'loan-apply', labelId: 'Ajukan', labelEn: 'Apply', icon: FileText },
  { id: 'profile', labelId: 'Profil', labelEn: 'Profile', icon: User },
];

const adminNavItems: NavItem[] = [
  { id: 'dashboard', labelId: 'Beranda', labelEn: 'Home', icon: LayoutDashboard },
  { id: 'registrations', labelId: 'Pendaftaran', labelEn: 'Registration', icon: UserPlus },
  { id: 'verify', labelId: 'Verifikasi', labelEn: 'Verify', icon: ClipboardCheck },
  { id: 'loan-manage', labelId: 'Unit Usaha', labelEn: 'Business', icon: Building2 },
  { id: 'members', labelId: 'Anggota', labelEn: 'Members', icon: Users },
  { id: 'summary', labelId: 'Laporan', labelEn: 'Reports', icon: BarChart3 },
  { id: 'coop-settings', labelId: 'Pengaturan', labelEn: 'Settings', icon: Settings },
];

export const BottomNavigation = forwardRef<HTMLElement, BottomNavigationProps>(
  function BottomNavigation({ currentView, onViewChange }, ref) {
    const { user } = useAuth();
    const { t } = useThemeLanguage();
    const config = useAnimationConfig();
    
    if (!user) return null;

    const navItems = user.activeRole === 'admin' ? adminNavItems : memberNavItems;

    return (
      <nav ref={ref} className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/20 glass-nav safe-area-pb">
        <div className="mx-auto flex h-16 sm:h-[68px] max-w-lg items-center justify-around px-2 sm:px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <motion.button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                whileTap={config.enabled ? { scale: 0.92 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 sm:py-2.5 touch-target min-w-0",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <motion.div 
                  animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={cn(
                    "flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl transition-colors duration-200",
                    isActive 
                      ? "bg-primary/15 border border-primary/25 shadow-sm" 
                      : "hover:bg-muted/50 active:bg-muted/70"
                  )}
                >
                  <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                </motion.div>
                <span className={cn(
                  "text-[10px] sm:text-[11px] font-medium transition-all duration-200 max-w-[52px] sm:max-w-[64px] truncate text-center leading-tight",
                  isActive ? "font-semibold" : "opacity-80"
                )}>
                  {t(item.labelId, item.labelEn)}
                </span>
                {/* Active indicator */}
                {isActive && (
                  <motion.div 
                    layoutId="bottomNavIndicator"
                    className="absolute -bottom-0.5 h-0.5 w-8 sm:w-10 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>
    );
  }
);