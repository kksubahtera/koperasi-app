import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Wallet, 
  History, 
  CreditCard, 
  Users, 
  ClipboardCheck,
  Building2,
  Banknote,
  X,
  ChevronRight,
  User,
  BarChart3,
  UserMinus,
  UserPlus,
  Settings,
  FileArchive,
  Shield,
  Mail,
  Scale
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: string;
  labelId: string;
  labelEn: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('member' | 'admin')[];
  sectionId?: string;
  sectionEn?: string;
}

const navItems: NavItem[] = [
  // Member sections
  { id: 'dashboard', labelId: 'Beranda', labelEn: 'Dashboard', icon: LayoutDashboard, roles: ['member'], sectionId: 'Utama', sectionEn: 'Main' },
  { id: 'savings', labelId: 'Simpanan', labelEn: 'Savings', icon: Wallet, roles: ['member'], sectionId: 'Keuangan', sectionEn: 'Finance' },
  { id: 'transactions', labelId: 'Riwayat Transaksi', labelEn: 'Transaction History', icon: History, roles: ['member'], sectionId: 'Keuangan', sectionEn: 'Finance' },
  { id: 'loans', labelId: 'Angsuran Pinjaman', labelEn: 'Loan Installments', icon: CreditCard, roles: ['member'], sectionId: 'Keuangan', sectionEn: 'Finance' },
  { id: 'shu', labelId: 'Riwayat SHU', labelEn: 'Dividend History', icon: Banknote, roles: ['member'], sectionId: 'Keuangan', sectionEn: 'Finance' },
  { id: 'profile', labelId: 'Profil Saya', labelEn: 'My Profile', icon: User, roles: ['member'], sectionId: 'Akun', sectionEn: 'Account' },
  
  // Admin sections
  { id: 'dashboard', labelId: 'Beranda', labelEn: 'Dashboard', icon: LayoutDashboard, roles: ['admin'], sectionId: 'Utama', sectionEn: 'Main' },
  { id: 'registrations', labelId: 'Pendaftaran', labelEn: 'Registrations', icon: UserPlus, roles: ['admin'], sectionId: 'Kelola Anggota', sectionEn: 'Member Management' },
  { id: 'members', labelId: 'Data Anggota', labelEn: 'Member Data', icon: Users, roles: ['admin'], sectionId: 'Kelola Anggota', sectionEn: 'Member Management' },
  { id: 'inactive-report', labelId: 'Anggota Tidak Aktif', labelEn: 'Inactive Members', icon: UserMinus, roles: ['admin'], sectionId: 'Kelola Anggota', sectionEn: 'Member Management' },
  { id: 'verify', labelId: 'Verifikasi Transaksi', labelEn: 'Verify Transactions', icon: ClipboardCheck, roles: ['admin'], sectionId: 'Kelola Transaksi', sectionEn: 'Transaction Management' },
  { id: 'loan-manage', labelId: 'Unit Usaha', labelEn: 'Business Units', icon: Building2, roles: ['admin'], sectionId: 'Kelola Transaksi', sectionEn: 'Transaction Management' },
  { id: 'summary', labelId: 'Ringkasan Keuangan', labelEn: 'Financial Summary', icon: BarChart3, roles: ['admin'], sectionId: 'Laporan', sectionEn: 'Reports' },
  { id: 'accounting', labelId: 'Pembukuan', labelEn: 'Accounting', icon: Banknote, roles: ['admin'], sectionId: 'Laporan', sectionEn: 'Reports' },
  { id: 'letter-archive', labelId: 'Arsip Surat', labelEn: 'Letter Archive', icon: FileArchive, roles: ['admin'], sectionId: 'Laporan', sectionEn: 'Reports' },
  { id: 'migration-reports', labelId: 'Laporan Migrasi', labelEn: 'Migration Reports', icon: Scale, roles: ['admin'], sectionId: 'Laporan', sectionEn: 'Reports' },
  { id: 'password-audit-log', labelId: 'Log Audit Password', labelEn: 'Password Audit Log', icon: Shield, roles: ['admin'], sectionId: 'Keamanan', sectionEn: 'Security' },
  { id: 'notification-settings', labelId: 'Notifikasi Email', labelEn: 'Email Notifications', icon: Mail, roles: ['admin'], sectionId: 'Pengaturan', sectionEn: 'Settings' },
  { id: 'coop-settings', labelId: 'Pengaturan', labelEn: 'Settings', icon: Settings, roles: ['admin'], sectionId: 'Pengaturan', sectionEn: 'Settings' },
];

export const Sidebar = ({ currentView, onViewChange, isOpen, onClose }: SidebarProps) => {
  const { user } = useAuth();
  const { t } = useThemeLanguage();

  const filteredItems = navItems.filter(item => 
    user && item.roles.includes(user.activeRole)
  );

  // Group items by section
  const groupedItems = filteredItems.reduce((acc, item) => {
    const section = t(item.sectionId || 'Lainnya', item.sectionEn || 'Other');
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-72 bg-card border-r border-border transition-transform duration-300 ease-in-out md:static md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
              <span className="text-lg font-bold text-primary-foreground">K</span>
            </div>
            <span className="font-bold text-foreground">{t('Koperasi', 'Cooperative')}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-3 overflow-y-auto max-h-[calc(100vh-8rem)]">
          {Object.entries(groupedItems).map(([section, items], sectionIndex) => (
            <div key={section}>
              {sectionIndex > 0 && <Separator className="my-2" />}
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section}
              </p>
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;

                return (
                  <button
                    key={`${item.id}-${item.sectionEn}`}
                    onClick={() => {
                      onViewChange(item.id);
                      onClose();
                    }}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 w-full",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5 transition-transform duration-200",
                      isActive ? "" : "group-hover:scale-110"
                    )} />
                    <span className="flex-1 text-left">{t(item.labelId, item.labelEn)}</span>
                    {isActive && (
                      <ChevronRight className="h-4 w-4 opacity-70" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        {user && (
          <div className="absolute bottom-0 left-0 right-0 border-t border-border p-4 bg-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <span className="text-sm font-semibold text-primary">
                  {user.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.memberNumber}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
