import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  BookOpen, TrendingUp, PieChart, 
  Calculator, Scale, BarChart3, Building2, Bell,
  Banknote, GitCompare, Sparkles, ClipboardList,
  Coins, Users, Activity, Package, ClipboardCheck, Gift, AlertTriangle,
  ChevronDown, RefreshCw, FileEdit, History, Calendar, Wallet, Shield,
  CheckSquare
} from 'lucide-react';
import { RupiahIcon } from '@/components/ui/rupiah-icon';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Scrollable dropdown content with shadow indicators
const ScrollableDropdownContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    const { scrollTop, scrollHeight, clientHeight } = el;
    setShowTopShadow(scrollTop > 10);
    setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    // Initial check
    checkScroll();
    
    el.addEventListener('scroll', checkScroll);
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll]);

  // Check on mount and when children change
  useEffect(() => {
    const timer = setTimeout(checkScroll, 100);
    return () => clearTimeout(timer);
  }, [children, checkScroll]);

  return (
    <div className={cn("relative", className)}>
      {/* Top shadow indicator */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-popover to-transparent z-10 pointer-events-none transition-opacity duration-200",
          showTopShadow ? "opacity-100" : "opacity-0"
        )}
      />
      
      {/* Scrollable content */}
      <div 
        ref={scrollRef}
        className="max-h-[60vh] overflow-y-auto"
      >
        {children}
      </div>
      
      {/* Bottom shadow indicator */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-popover to-transparent z-10 pointer-events-none transition-opacity duration-200",
          showBottomShadow ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
};

interface MenuItem {
  id: string;
  labelId: string;
  labelEn: string;
  descriptionId: string;
  descriptionEn: string;
  icon: React.ReactNode;
}

interface MenuSection {
  id: string;
  titleId: string;
  titleEn: string;
  descriptionId: string;
  descriptionEn: string;
  color: string;
  activeColor: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    id: 'umum',
    titleId: 'Umum',
    titleEn: 'General',
    descriptionId: 'Dashboard dan notifikasi',
    descriptionEn: 'Dashboard and notifications',
    color: 'hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400',
    activeColor: 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30',
    items: [
      { id: 'eksekutif', labelId: 'Dashboard', labelEn: 'Dashboard', descriptionId: 'Dashboard eksekutif dengan KPI dan trend', descriptionEn: 'Executive dashboard with KPI and trends', icon: <BarChart3 className="h-4 w-4" /> },
      { id: 'notif', labelId: 'Notifikasi', labelEn: 'Notifications', descriptionId: 'Notifikasi aktivitas keuangan', descriptionEn: 'Financial activity notifications', icon: <Bell className="h-4 w-4" /> },
    ]
  },
  {
    id: 'laporan',
    titleId: 'Laporan',
    titleEn: 'Reports',
    descriptionId: 'Laporan keuangan koperasi',
    descriptionEn: 'Cooperative financial reports',
    color: 'hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400',
    activeColor: 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30',
    items: [
      { id: 'neraca', labelId: 'Neraca', labelEn: 'Balance Sheet', descriptionId: 'Posisi keuangan', descriptionEn: 'Financial position', icon: <BookOpen className="h-4 w-4" /> },
      { id: 'labarugi', labelId: 'Laba Rugi', labelEn: 'Income Statement', descriptionId: 'Pendapatan dan beban', descriptionEn: 'Income and expenses', icon: <TrendingUp className="h-4 w-4" /> },
      { id: 'aruskas', labelId: 'Arus Kas', labelEn: 'Cash Flow', descriptionId: 'Arus masuk/keluar kas', descriptionEn: 'Cash inflows/outflows', icon: <Banknote className="h-4 w-4" /> },
      { id: 'rasio', labelId: 'Rasio', labelEn: 'Ratios', descriptionId: 'Analisis rasio keuangan', descriptionEn: 'Financial ratio analysis', icon: <Activity className="h-4 w-4" /> },
      { id: 'perbandingan', labelId: 'Perbandingan', labelEn: 'Comparison', descriptionId: 'Perbandingan antar periode', descriptionEn: 'Period comparison', icon: <GitCompare className="h-4 w-4" /> },
      { id: 'proyeksi', labelId: 'Proyeksi', labelEn: 'Projections', descriptionId: 'Proyeksi keuangan', descriptionEn: 'Financial projections', icon: <Sparkles className="h-4 w-4" /> },
      { id: 'laporan', labelId: 'Unit Usaha', labelEn: 'Business Units', descriptionId: 'Laporan per unit', descriptionEn: 'Per unit reports', icon: <ClipboardList className="h-4 w-4" /> },
      { id: 'pinjaman-lintas', labelId: 'Lintas Tahun', labelEn: 'Cross-Year', descriptionId: 'Laporan pinjaman lintas tahun buku', descriptionEn: 'Cross fiscal year loan report', icon: <Calendar className="h-4 w-4" /> },
      { id: 'pelunasan-dini', labelId: 'Pelunasan Dini', labelEn: 'Early Payoff', descriptionId: 'Laporan pelunasan dini pinjaman', descriptionEn: 'Early loan payoff report', icon: <Coins className="h-4 w-4" /> },
      { id: 'keringanan', labelId: 'Keringanan', labelEn: 'Relief', descriptionId: 'Laporan keringanan bunga & denda', descriptionEn: 'Interest & penalty relief report', icon: <Gift className="h-4 w-4" /> },
      { id: 'tunggakan', labelId: 'Tunggakan', labelEn: 'Overdue', descriptionId: 'Dashboard statistik tunggakan anggota', descriptionEn: 'Member overdue statistics dashboard', icon: <AlertTriangle className="h-4 w-4" /> },
      { id: 'kelebihan-bayar', labelId: 'Kelebihan Bayar', labelEn: 'Overpayment', descriptionId: 'Laporan kelebihan pembayaran anggota', descriptionEn: 'Member overpayment report', icon: <Wallet className="h-4 w-4" /> },
      { id: 'laporan-angsuran', labelId: 'Buku Angsuran', labelEn: 'Installment Book', descriptionId: 'Laporan angsuran seluruh anggota', descriptionEn: 'All member installment report', icon: <ClipboardList className="h-4 w-4" /> },
      { id: 'agunan', labelId: 'Agunan', labelEn: 'Collateral', descriptionId: 'Laporan agunan yang disimpan', descriptionEn: 'Stored collateral report', icon: <Shield className="h-4 w-4" /> },
    ]
  },
  {
    id: 'bukubesar',
    titleId: 'Buku Besar',
    titleEn: 'General Ledger',
    descriptionId: 'Pencatatan transaksi',
    descriptionEn: 'Transaction recording',
    color: 'hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400',
    activeColor: 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30',
    items: [
      { id: 'verifikasi', labelId: 'Verifikasi', labelEn: 'Verification', descriptionId: 'Approve transaksi pending', descriptionEn: 'Approve pending transactions', icon: <CheckSquare className="h-4 w-4" /> },
      { id: 'jurnal', labelId: 'Jurnal Umum', labelEn: 'General Journal', descriptionId: 'Catat transaksi double-entry', descriptionEn: 'Record double-entry transactions', icon: <BookOpen className="h-4 w-4" /> },
      { id: 'auto-jurnal', labelId: 'Jurnal Otomatis', labelEn: 'Auto Journal', descriptionId: 'Riwayat jurnal dari transaksi anggota', descriptionEn: 'Journal history from member transactions', icon: <Sparkles className="h-4 w-4" /> },
      { id: 'jurnal-template', labelId: 'Template Jurnal', labelEn: 'Journal Templates', descriptionId: 'Konfigurasi template jurnal otomatis', descriptionEn: 'Auto journal template configuration', icon: <FileEdit className="h-4 w-4" /> },
      { id: 'kasbank', labelId: 'Kas & Bank', labelEn: 'Cash & Bank', descriptionId: 'Mutasi kas dan bank', descriptionEn: 'Cash and bank transactions', icon: <RupiahIcon className="h-4 w-4" /> },
      { id: 'rekonbank', labelId: 'Rekonsiliasi Bank', labelEn: 'Bank Reconciliation', descriptionId: 'Rekonsiliasi bank', descriptionEn: 'Bank reconciliation', icon: <Scale className="h-4 w-4" /> },
      { id: 'rekonjurnal', labelId: 'Rekonsiliasi Jurnal', labelEn: 'Journal Reconciliation', descriptionId: 'Rekonsiliasi transaksi vs jurnal', descriptionEn: 'Transaction vs journal reconciliation', icon: <ClipboardCheck className="h-4 w-4" /> },
      { id: 'rekonsaldo', labelId: 'Rekonsiliasi Saldo', labelEn: 'Balance Reconciliation', descriptionId: 'Perbandingan saldo kalkulasi vs database', descriptionEn: 'Calculation vs database balance comparison', icon: <GitCompare className="h-4 w-4" /> },
      { id: 'audit-simpanan', labelId: 'Audit Simpanan', labelEn: 'Savings Audit', descriptionId: 'Riwayat perubahan simpanan sukarela', descriptionEn: 'Voluntary savings change history', icon: <History className="h-4 w-4" /> },
    ]
  },
  {
    id: 'shu',
    titleId: 'SHU',
    titleEn: 'SHU',
    descriptionId: 'Sisa Hasil Usaha',
    descriptionEn: 'Surplus Equity',
    color: 'hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400',
    activeColor: 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30',
    items: [
      { id: 'shu', labelId: 'Distribusi', labelEn: 'Distribution', descriptionId: 'Distribusi SHU', descriptionEn: 'SHU Distribution', icon: <PieChart className="h-4 w-4" /> },
      { id: 'shu-anggota-keluar', labelId: 'Anggota Keluar', labelEn: 'Exited Members', descriptionId: 'SHU anggota yang keluar', descriptionEn: 'Exited member SHU', icon: <Users className="h-4 w-4" /> },
      { id: 'shu-ditahan', labelId: 'SHU Ditahan', labelEn: 'Retained SHU', descriptionId: 'Kelola SHU yang ditahan', descriptionEn: 'Manage retained SHU', icon: <Scale className="h-4 w-4" /> },
      { id: 'shu-rollover', labelId: 'Rollover', labelEn: 'Rollover', descriptionId: 'Rollover saldo SHU ke tahun berikutnya', descriptionEn: 'Rollover SHU balance to next year', icon: <RefreshCw className="h-4 w-4" /> },
      { id: 'shu-rekonsiliasi', labelId: 'Rekonsiliasi', labelEn: 'Reconciliation', descriptionId: 'Rekonsiliasi data SHU anggota', descriptionEn: 'Member SHU data reconciliation', icon: <GitCompare className="h-4 w-4" /> },
      { id: 'bunga', labelId: 'Bunga', labelEn: 'Interest', descriptionId: 'Laporan bunga', descriptionEn: 'Interest report', icon: <Coins className="h-4 w-4" /> },
      { id: 'grafik', labelId: 'Grafik', labelEn: 'Charts', descriptionId: 'Grafik SHU', descriptionEn: 'SHU Charts', icon: <BarChart3 className="h-4 w-4" /> },
    ]
  },
  {
    id: 'pengaturan',
    titleId: 'Pengaturan',
    titleEn: 'Settings',
    descriptionId: 'Konfigurasi sistem',
    descriptionEn: 'System configuration',
    color: 'hover:bg-slate-500/10 hover:text-slate-600 dark:hover:text-slate-400',
    activeColor: 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30',
    items: [
      { id: 'coa', labelId: 'Bagan Akun', labelEn: 'Chart of Accounts', descriptionId: 'Chart of Accounts', descriptionEn: 'Chart of Accounts', icon: <Calculator className="h-4 w-4" /> },
      { id: 'unit', labelId: 'Unit Usaha', labelEn: 'Business Units', descriptionId: 'Kelola unit usaha', descriptionEn: 'Manage business units', icon: <Building2 className="h-4 w-4" /> },
      { id: 'aset', labelId: 'Aset Tetap', labelEn: 'Fixed Assets', descriptionId: 'Aset dan penyusutan', descriptionEn: 'Assets and depreciation', icon: <Package className="h-4 w-4" /> },
    ]
  }
];

interface AccountingMenuProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AccountingMenu = ({ activeTab, onTabChange }: AccountingMenuProps) => {
  const isMobile = useIsMobile();
  const { t } = useThemeLanguage();
  
  // Find active section based on activeTab
  const getActiveSection = () => {
    for (const section of menuSections) {
      if (section.items.some(item => item.id === activeTab)) {
        return section.id;
      }
    }
    return 'umum';
  };

  const [selectedCategory, setSelectedCategory] = useState(getActiveSection());
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayedItems, setDisplayedItems] = useState<MenuItem[]>([]);
  
  const activeSection = menuSections.find(s => s.id === selectedCategory) || menuSections[0];
  const activeItem = activeSection.items.find(item => item.id === activeTab);
  const activeItemLabel = activeItem ? t(activeItem.labelId, activeItem.labelEn) : t('Pilih Menu', 'Select Menu');

  // Handle animation when category changes
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => {
      setDisplayedItems(activeSection.items);
      setIsAnimating(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedCategory, activeSection.items]);

  // Initialize displayed items
  useEffect(() => {
    setDisplayedItems(activeSection.items);
  }, []);

  const handleCategoryClick = (sectionId: string) => {
    if (sectionId === selectedCategory) return;
    setSelectedCategory(sectionId);
    const section = menuSections.find(s => s.id === sectionId);
    if (section && section.items.length > 0) {
      onTabChange(section.items[0].id);
    }
  };

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {/* Category Button Group - Scrollable */}
        <ScrollArea className="w-full">
          <div className="flex gap-1 p-1 bg-muted/50 rounded-xl border border-border/50">
            {menuSections.map((section) => (
              <Button
                key={section.id}
                variant="ghost"
                size="sm"
                onClick={() => handleCategoryClick(section.id)}
                className={cn(
                  "flex-shrink-0 h-9 px-3 rounded-lg font-medium text-xs transition-all duration-200",
                  selectedCategory === section.id 
                    ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 hover:bg-primary/90"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                  )}
                >
                  {t(section.titleId, section.titleEn)}
                </Button>
              ))}
            </div>
          <ScrollBar orientation="horizontal" className="h-1.5" />
        </ScrollArea>

        {/* Sub-menu Dropdown for Mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between h-11 px-4 bg-background border-border/50 shadow-sm"
            >
              <div className="flex items-center gap-2">
                {activeItem?.icon}
                <span className="font-medium">{activeItemLabel}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[calc(100vw-2rem)] max-w-md p-0 overflow-hidden">
            <ScrollableDropdownContent>
              <div className="p-1">
                {displayedItems.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      "flex items-center gap-3 py-3 cursor-pointer",
                      activeTab === item.id && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <span className={cn(
                      "flex-shrink-0",
                      activeTab === item.id ? "text-primary" : "text-muted-foreground"
                    )}>
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t(item.labelId, item.labelEn)}</p>
                      <p className="text-xs text-muted-foreground truncate">{t(item.descriptionId, item.descriptionEn)}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            </ScrollableDropdownContent>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Desktop Layout
  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-3">
        {/* Category Button Group */}
        <div className="flex gap-1 p-1.5 bg-muted/40 rounded-xl border border-border/40">
          {menuSections.map((section) => (
            <Tooltip key={section.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCategoryClick(section.id)}
                  className={cn(
                    "h-9 px-4 rounded-lg font-medium text-sm transition-all duration-200",
                    selectedCategory === section.id 
                      ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 hover:bg-primary/90"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                  )}
                >
                  {t(section.titleId, section.titleEn)}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-popover text-popover-foreground border shadow-md">
                <p className="text-xs">{t(section.descriptionId, section.descriptionEn)}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Sub-menu Button Group with animation */}
        <div 
          className={cn(
            "flex flex-wrap gap-1.5 p-2 rounded-xl bg-background border border-border/40 shadow-sm transition-all duration-200",
            isAnimating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
          )}
        >
          {displayedItems.map((item, index) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "gap-2 h-9 px-3 rounded-lg transition-all duration-200",
                    activeTab === item.id 
                      ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 hover:bg-primary/90" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                  style={{
                    animationDelay: isAnimating ? '0ms' : `${index * 30}ms`,
                  }}
                >
                  {item.icon}
                  <span className="text-xs font-medium">{t(item.labelId, item.labelEn)}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-popover text-popover-foreground border shadow-md">
                <p className="text-xs">{t(item.descriptionId, item.descriptionEn)}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};
