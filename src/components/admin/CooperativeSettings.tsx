import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Target, 
  Briefcase, 
  Percent, 
  Wallet, 
  FileText,
  Save,
  Plus,
  Trash2,
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  X,
  Phone,
  CreditCard,
  Hash,
  Users,
  TrendingUp,
  History,
  CalendarClock,
  Settings,
  Eye,
  CheckCircle2,
  AlertCircle,
  Mail,
  Shield,
  ChevronRight,
  ChevronLeft,
  Database,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  CooperativeSettings as CooperativeSettingsType,
  MemberNumberFormat,
  Signatory,
  AdArtDocument,
  AdArtChapter,
  AdArtArticle,
  POSITION_OPTIONS,
  getCooperativeSettings,
  saveCooperativeSettings,
  generateMemberNumber,
  getDefaultMemberNumberFormat
} from '@/lib/cooperativeSettings';
import { formatCurrency } from '@/lib/mockData';
import { ThemeLanguageToggle } from '@/components/shared/ThemeLanguageToggle';
import { CooperativeSettingsService } from '@/lib/database';
import { SettingsApplicationModeDialog } from './SettingsApplicationModeDialog';
import { SettingsChangeHistory } from './SettingsChangeHistory';
import { useCooperativeSettingsDB } from '@/hooks/useSettingsChangeLogs';
import { useCooperativeSettingsSync } from '@/hooks/useCooperativeSettingsSync';
import { AutoClosingSettings } from './AutoClosingSettings';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import { ExitedMemberSHUSettings } from './ExitedMemberSHUSettings';
import { useCollateralSettings, CollateralSettings as CollateralSettingsType } from '@/hooks/useCollateralSettings';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import BranchManagement from './BranchManagement';
import { AdminGuide } from './AdminGuide';

interface CooperativeSettingsProps {
  onBack: () => void;
  onNavigate?: (view: string) => void;
}

interface BankContactSettings {
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  contact_phone: string;
  available_banks: string[];
  simpanan_pokok: number;
  simpanan_wajib: number;
  logo_size: 'small' | 'medium' | 'large' | 'xlarge';
  logo_frame: 'circle' | 'rounded' | 'none';
  // Container size per context
  logo_container_header: 'default' | 'large' | 'xlarge' | 'xxlarge';
  logo_container_footer: 'default' | 'large' | 'xlarge' | 'xxlarge';
  logo_container_splash: 'default' | 'large' | 'xlarge' | 'xxlarge';
  logo_container_card: 'default' | 'large' | 'xlarge' | 'xxlarge';
  // Card gradient settings
  card_gradient_direction: 'diagonal' | 'horizontal' | 'vertical';
  card_use_gender_colors: boolean;
  // Default gradient colors
  card_gradient_start: string;
  card_gradient_end: string;
  // Male gradient colors
  card_gradient_male_start: string;
  card_gradient_male_end: string;
  // Female gradient colors
  card_gradient_female_start: string;
  card_gradient_female_end: string;
}

const DEFAULT_BANK_OPTIONS = [
  'BCA',
  'Mandiri',
  'BRI',
  'BNI',
  'CIMB',
  'OCBC',
  'BSI',
  'Permata',
  'Danamon',
  'Maybank',
];

export const CooperativeSettings = ({ onBack, onNavigate }: CooperativeSettingsProps) => {
  const [settings, setSettings] = useState<CooperativeSettingsType>(getCooperativeSettings());
  const [activeTab, setActiveTab] = useState('identity');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const handleNavScroll = () => {
    if (navScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navScrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scrollNav = (direction: 'left' | 'right') => {
    if (navScrollRef.current) {
      const scrollAmount = 200;
      navScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollToActiveTab = (tabValue: string) => {
    if (navScrollRef.current) {
      const tabButton = navScrollRef.current.querySelector(`[data-tab-value="${tabValue}"]`) as HTMLElement;
      if (tabButton) {
        const container = navScrollRef.current;
        const containerRect = container.getBoundingClientRect();
        const tabRect = tabButton.getBoundingClientRect();
        
        const tabCenter = tabRect.left + tabRect.width / 2;
        const containerCenter = containerRect.left + containerRect.width / 2;
        const scrollOffset = tabCenter - containerCenter;
        
        container.scrollBy({
          left: scrollOffset,
          behavior: 'smooth'
        });
      }
    }
  };

  const handleTabClick = (tabValue: string) => {
    setActiveTab(tabValue);
    setTimeout(() => scrollToActiveTab(tabValue), 50);
  };

  useEffect(() => {
    const navEl = navScrollRef.current;
    if (navEl) {
      handleNavScroll();
      navEl.addEventListener('scroll', handleNavScroll);
      window.addEventListener('resize', handleNavScroll);
      return () => {
        navEl.removeEventListener('scroll', handleNavScroll);
        window.removeEventListener('resize', handleNavScroll);
      };
    }
  }, []);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const [bankContactSettings, setBankContactSettings] = useState<BankContactSettings>({
    bank_name: 'BCA',
    bank_account_number: '',
    bank_account_name: '',
    contact_phone: '',
    available_banks: DEFAULT_BANK_OPTIONS,
    simpanan_pokok: 500000,
    simpanan_wajib: 100000,
    logo_size: 'medium',
    logo_frame: 'rounded',
    logo_container_header: 'default',
    logo_container_footer: 'default',
    logo_container_splash: 'default',
    logo_container_card: 'default',
    card_gradient_direction: 'diagonal',
    card_use_gender_colors: false,
    card_gradient_start: '#6366f1',
    card_gradient_end: '#8b5cf6',
    card_gradient_male_start: '#3b82f6',
    card_gradient_male_end: '#1d4ed8',
    card_gradient_female_start: '#ec4899',
    card_gradient_female_end: '#db2777',
  });
  const [newBankName, setNewBankName] = useState('');
  const [isSavingBankSettings, setIsSavingBankSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{
    key: string;
    name: string;
    oldValue: any;
    newValue: any;
  } | null>(null);
  const { saveSettingWithLog } = useCooperativeSettingsDB();
  const { 
    saveSettings: saveSettingsToDb, 
    isLoading: isLoadingSettings, 
    refreshSettings,
    syncStatus,
    lastSyncTime,
    error: syncError,
    retrySync,
    isSaving: isSyncingSaving,
    isOnline,
    retryCount
  } = useCooperativeSettingsSync();
  const [isSaving, setIsSaving] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Collateral settings
  const { settings: collateralSettings, saveSettings: saveCollateralSettings, isLoading: isLoadingCollateral } = useCollateralSettings();
  const { admins: adminUsers } = useAdminUsers();
  const [localCollateralSettings, setLocalCollateralSettings] = useState<CollateralSettingsType | null>(null);
  const [newCollateralType, setNewCollateralType] = useState('');

  useEffect(() => {
    refreshSettings().then(() => {
      // After refreshing from DB, update local state
    });
    fetchBankContactSettings();
  }, []);

  // Sync collateral settings to local state
  useEffect(() => {
    if (collateralSettings && !localCollateralSettings) {
      setLocalCollateralSettings(collateralSettings);
    }
  }, [collateralSettings, localCollateralSettings]);

  // Listen for auto-sync success events
  useEffect(() => {
    const handleSyncSuccess = () => {
      toast.success('Sinkronisasi otomatis berhasil!', {
        description: 'Data berhasil tersimpan ke server setelah koneksi pulih.',
        duration: 5000,
      });
    };

    window.addEventListener('sync-success', handleSyncSuccess);
    return () => window.removeEventListener('sync-success', handleSyncSuccess);
  }, []);

  const fetchBankContactSettings = async () => {
    try {
      const settingsData = await CooperativeSettingsService.getMultipleSettings([
        'bank_name', 
        'bank_account_number', 
        'bank_account_name', 
        'contact_phone',
        'available_banks',
        'simpanan_pokok',
        'simpanan_wajib',
        'logo_size',
        'logo_frame',
        'logo_container_header',
        'logo_container_footer',
        'logo_container_splash',
        'logo_container_card',
        'card_gradient_direction',
        'card_use_gender_colors',
        'card_gradient_start',
        'card_gradient_end',
        'card_gradient_male_start',
        'card_gradient_male_end',
        'card_gradient_female_start',
        'card_gradient_female_end',
      ]);
      
      const availableBanks = settingsData['available_banks'];
      const parsedBanks = Array.isArray(availableBanks) ? availableBanks : DEFAULT_BANK_OPTIONS;
      
      // Normalize old logo_size values
      let logoSize = settingsData['logo_size'] || 'medium';
      if (['120', '150', '175', '200'].includes(logoSize)) {
        logoSize = 'xlarge';
      }
      
      setBankContactSettings({
        bank_name: settingsData['bank_name'] || 'BCA',
        bank_account_number: settingsData['bank_account_number'] || '',
        bank_account_name: settingsData['bank_account_name'] || '',
        contact_phone: settingsData['contact_phone'] || '',
        available_banks: parsedBanks,
        simpanan_pokok: Number(settingsData['simpanan_pokok']) || 500000,
        simpanan_wajib: Number(settingsData['simpanan_wajib']) || 100000,
        logo_size: logoSize as BankContactSettings['logo_size'],
        logo_frame: (settingsData['logo_frame'] as BankContactSettings['logo_frame']) || 'rounded',
        logo_container_header: (settingsData['logo_container_header'] as BankContactSettings['logo_container_header']) || 'default',
        logo_container_footer: (settingsData['logo_container_footer'] as BankContactSettings['logo_container_footer']) || 'default',
        logo_container_splash: (settingsData['logo_container_splash'] as BankContactSettings['logo_container_splash']) || 'default',
        logo_container_card: (settingsData['logo_container_card'] as BankContactSettings['logo_container_card']) || 'default',
        card_gradient_direction: (settingsData['card_gradient_direction'] as BankContactSettings['card_gradient_direction']) || 'diagonal',
        card_use_gender_colors: settingsData['card_use_gender_colors'] === true || settingsData['card_use_gender_colors'] === 'true',
        card_gradient_start: (settingsData['card_gradient_start'] as string) || '#6366f1',
        card_gradient_end: (settingsData['card_gradient_end'] as string) || '#8b5cf6',
        card_gradient_male_start: (settingsData['card_gradient_male_start'] as string) || '#3b82f6',
        card_gradient_male_end: (settingsData['card_gradient_male_end'] as string) || '#1d4ed8',
        card_gradient_female_start: (settingsData['card_gradient_female_start'] as string) || '#ec4899',
        card_gradient_female_end: (settingsData['card_gradient_female_end'] as string) || '#db2777',
      });
    } catch (error) {
      console.error('Error fetching bank settings:', error);
    }
  };

  const saveBankContactSettings = async () => {
    setIsSavingBankSettings(true);
    try {
      await CooperativeSettingsService.saveSetting('bank_name', bankContactSettings.bank_name);
      await CooperativeSettingsService.saveSetting('bank_account_number', bankContactSettings.bank_account_number);
      await CooperativeSettingsService.saveSetting('bank_account_name', bankContactSettings.bank_account_name);
      await CooperativeSettingsService.saveSetting('contact_phone', bankContactSettings.contact_phone);
      await CooperativeSettingsService.saveSetting('available_banks', bankContactSettings.available_banks);
      await CooperativeSettingsService.saveSetting('simpanan_pokok', bankContactSettings.simpanan_pokok);
      await CooperativeSettingsService.saveSetting('simpanan_wajib', bankContactSettings.simpanan_wajib);
      await CooperativeSettingsService.saveSetting('logo_size', bankContactSettings.logo_size);
      await CooperativeSettingsService.saveSetting('logo_frame', bankContactSettings.logo_frame);
      await CooperativeSettingsService.saveSetting('logo_container_header', bankContactSettings.logo_container_header);
      await CooperativeSettingsService.saveSetting('logo_container_footer', bankContactSettings.logo_container_footer);
      await CooperativeSettingsService.saveSetting('logo_container_splash', bankContactSettings.logo_container_splash);
      await CooperativeSettingsService.saveSetting('logo_container_card', bankContactSettings.logo_container_card);
      await CooperativeSettingsService.saveSetting('card_gradient_direction', bankContactSettings.card_gradient_direction);
      await CooperativeSettingsService.saveSetting('card_use_gender_colors', bankContactSettings.card_use_gender_colors);
      await CooperativeSettingsService.saveSetting('card_gradient_start', bankContactSettings.card_gradient_start);
      await CooperativeSettingsService.saveSetting('card_gradient_end', bankContactSettings.card_gradient_end);
      await CooperativeSettingsService.saveSetting('card_gradient_male_start', bankContactSettings.card_gradient_male_start);
      await CooperativeSettingsService.saveSetting('card_gradient_male_end', bankContactSettings.card_gradient_male_end);
      await CooperativeSettingsService.saveSetting('card_gradient_female_start', bankContactSettings.card_gradient_female_start);
      await CooperativeSettingsService.saveSetting('card_gradient_female_end', bankContactSettings.card_gradient_female_end);
      
      toast.success('Pengaturan bank dan kontak berhasil disimpan');
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan bank dan kontak');
    } finally {
      setIsSavingBankSettings(false);
    }
  };

  const addBank = () => {
    if (!newBankName.trim()) return;
    if (bankContactSettings.available_banks.includes(newBankName.trim())) {
      toast.error('Bank sudah ada dalam daftar');
      return;
    }
    setBankContactSettings(prev => ({
      ...prev,
      available_banks: [...prev.available_banks, newBankName.trim()]
    }));
    setNewBankName('');
  };

  const removeBank = (bankName: string) => {
    if (bankContactSettings.bank_name === bankName) {
      toast.error('Tidak dapat menghapus bank yang sedang digunakan sebagai rekening koperasi');
      return;
    }
    setBankContactSettings(prev => ({
      ...prev,
      available_banks: prev.available_banks.filter(b => b !== bankName)
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to database
      const success = await saveSettingsToDb(settings);
      
      if (success) {
        // Also save bank contact settings
        await saveBankContactSettings();
        toast.success('Pengaturan koperasi berhasil disimpan ke server');
      } else {
        // Fallback to localStorage if DB fails
        saveCooperativeSettings(settings);
        await saveBankContactSettings();
        toast.warning('Pengaturan tersimpan lokal. Gunakan "Coba Lagi" untuk sinkronisasi ke server.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Gagal menyimpan pengaturan koperasi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetrySync = async () => {
    setIsRetrying(true);
    try {
      const success = await retrySync();
      if (success) {
        toast.success('Sinkronisasi berhasil! Data tersimpan ke server.');
      } else {
        toast.error('Sinkronisasi gagal. Silakan coba lagi nanti.');
      }
    } catch (error) {
      toast.error('Gagal melakukan sinkronisasi');
    } finally {
      setIsRetrying(false);
    }
  };

  // Save critical financial settings with mode dialog
  const handleCriticalSettingSave = (
    key: string,
    name: string,
    oldValue: any,
    newValue: any
  ) => {
    if (oldValue !== newValue) {
      setPendingChanges({ key, name, oldValue, newValue });
      setShowModeDialog(true);
    }
  };

  const handleModeConfirm = async (mode: 'prospective' | 'retroactive', reason: string) => {
    if (!pendingChanges) return;

    const success = await saveSettingWithLog(
      pendingChanges.key,
      pendingChanges.newValue,
      pendingChanges.oldValue,
      mode,
      reason
    );

    if (success) {
      toast.success(`Pengaturan ${pendingChanges.name} berhasil disimpan (${mode === 'prospective' ? 'prospektif' : 'retroaktif'})`);
    }
    setPendingChanges(null);
  };

  const updateSettings = (updates: Partial<CooperativeSettingsType>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateSettings({ logoBase64: base64, logoUrl: '' });
      toast.success('Logo berhasil diupload');
    };
    reader.onerror = () => {
      toast.error('Gagal membaca file');
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    updateSettings({ logoBase64: '', logoUrl: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateSettings({ signatureBase64: base64 });
      toast.success('Tanda tangan berhasil diupload');
    };
    reader.onerror = () => {
      toast.error('Gagal membaca file');
    };
    reader.readAsDataURL(file);
  };

  const removeSignature = () => {
    updateSettings({ signatureBase64: '' });
    if (signatureInputRef.current) {
      signatureInputRef.current.value = '';
    }
  };

  const handleStampUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateSettings({ stampBase64: base64 });
      toast.success('Stempel berhasil diupload');
    };
    reader.onerror = () => {
      toast.error('Gagal membaca file');
    };
    reader.readAsDataURL(file);
  };

  const removeStamp = () => {
    updateSettings({ stampBase64: '' });
    if (stampInputRef.current) {
      stampInputRef.current.value = '';
    }
  };

  const currentLogo = settings.logoBase64 || settings.logoUrl;

  const addMission = () => {
    updateSettings({ mission: [...settings.mission, ''] });
  };

  const removeMission = (index: number) => {
    updateSettings({ mission: settings.mission.filter((_, i) => i !== index) });
  };

  const updateMission = (index: number, value: string) => {
    const newMission = [...settings.mission];
    newMission[index] = value;
    updateSettings({ mission: newMission });
  };

  const addService = () => {
    updateSettings({ services: [...settings.services, { title: '', description: '' }] });
  };

  const removeService = (index: number) => {
    updateSettings({ services: settings.services.filter((_, i) => i !== index) });
  };

  const updateService = (index: number, field: 'title' | 'description', value: string) => {
    const newServices = [...settings.services];
    newServices[index] = { ...newServices[index], [field]: value };
    updateSettings({ services: newServices });
  };

  // AD/ART Chapter and Article management
  const addChapter = (type: 'ad' | 'art') => {
    const docKey = type === 'ad' ? 'adContent' : 'artContent';
    const doc = settings[docKey] || { chapters: [] };
    const newChapter: AdArtChapter = {
      id: `${type}-${Date.now()}`,
      title: `Bab ${doc.chapters.length + 1}`,
      articles: []
    };
    updateSettings({ 
      [docKey]: { 
        ...doc, 
        chapters: [...doc.chapters, newChapter] 
      } 
    });
  };

  const removeChapter = (type: 'ad' | 'art', chapterId: string) => {
    const docKey = type === 'ad' ? 'adContent' : 'artContent';
    const doc = settings[docKey] || { chapters: [] };
    updateSettings({ 
      [docKey]: { 
        ...doc, 
        chapters: doc.chapters.filter(c => c.id !== chapterId) 
      } 
    });
  };

  const updateChapterTitle = (type: 'ad' | 'art', chapterId: string, title: string) => {
    const docKey = type === 'ad' ? 'adContent' : 'artContent';
    const doc = settings[docKey] || { chapters: [] };
    updateSettings({ 
      [docKey]: { 
        ...doc, 
        chapters: doc.chapters.map(c => 
          c.id === chapterId ? { ...c, title } : c
        ) 
      } 
    });
  };

  const addArticle = (type: 'ad' | 'art', chapterId: string) => {
    const docKey = type === 'ad' ? 'adContent' : 'artContent';
    const doc = settings[docKey] || { chapters: [] };
    const chapter = doc.chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    
    const newArticle: AdArtArticle = {
      id: `${type}-art-${Date.now()}`,
      title: `Pasal ${chapter.articles.length + 1}`,
      content: ''
    };
    updateSettings({ 
      [docKey]: { 
        ...doc, 
        chapters: doc.chapters.map(c => 
          c.id === chapterId 
            ? { ...c, articles: [...c.articles, newArticle] }
            : c
        ) 
      } 
    });
  };

  const removeArticle = (type: 'ad' | 'art', chapterId: string, articleId: string) => {
    const docKey = type === 'ad' ? 'adContent' : 'artContent';
    const doc = settings[docKey] || { chapters: [] };
    updateSettings({ 
      [docKey]: { 
        ...doc, 
        chapters: doc.chapters.map(c => 
          c.id === chapterId 
            ? { ...c, articles: c.articles.filter(a => a.id !== articleId) }
            : c
        ) 
      } 
    });
  };

  const updateArticle = (type: 'ad' | 'art', chapterId: string, articleId: string, updates: Partial<AdArtArticle>) => {
    const docKey = type === 'ad' ? 'adContent' : 'artContent';
    const doc = settings[docKey] || { chapters: [] };
    updateSettings({ 
      [docKey]: { 
        ...doc, 
        chapters: doc.chapters.map(c => 
          c.id === chapterId 
            ? { 
                ...c, 
                articles: c.articles.map(a => 
                  a.id === articleId ? { ...a, ...updates } : a
                ) 
              }
            : c
        ) 
      } 
    });
  };

  // Legacy functions for backward compatibility
  const addAdArt = () => {
    updateSettings({ adArtContent: [...settings.adArtContent, ''] });
  };

  const removeAdArt = (index: number) => {
    updateSettings({ adArtContent: settings.adArtContent.filter((_, i) => i !== index) });
  };

  const updateAdArt = (index: number, value: string) => {
    const newAdArt = [...settings.adArtContent];
    newAdArt[index] = value;
    updateSettings({ adArtContent: newAdArt });
  };

  // Show history view
  if (showHistory) {
    return <SettingsChangeHistory onBack={() => setShowHistory(false)} />;
  }

  // Calculate settings completeness
  const requiredSettings = [
    { key: 'bank_name', label: 'Nama Bank', value: bankContactSettings.bank_name },
    { key: 'bank_account_number', label: 'Nomor Rekening', value: bankContactSettings.bank_account_number },
    { key: 'bank_account_name', label: 'Nama Pemilik Rekening', value: bankContactSettings.bank_account_name },
    { key: 'simpanan_pokok', label: 'Simpanan Pokok', value: bankContactSettings.simpanan_pokok > 0 },
    { key: 'simpanan_wajib', label: 'Simpanan Wajib', value: bankContactSettings.simpanan_wajib > 0 },
  ];

  const completedSettings = requiredSettings.filter(s => {
    if (typeof s.value === 'boolean') return s.value;
    return s.value && String(s.value).trim() !== '';
  });

  const isSettingsComplete = completedSettings.length === requiredSettings.length;
  const completionPercentage = Math.round((completedSettings.length / requiredSettings.length) * 100);
  const missingSettings = requiredSettings.filter(s => {
    if (typeof s.value === 'boolean') return !s.value;
    return !s.value || String(s.value).trim() === '';
  });

  return (
    <div className="space-y-6">
      {/* Mode Dialog */}
      <SettingsApplicationModeDialog
        open={showModeDialog}
        onOpenChange={setShowModeDialog}
        settingName={pendingChanges?.name || ''}
        onConfirm={handleModeConfirm}
      />

      {/* Settings Completeness Indicator */}
      {!isSettingsComplete && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  Pengaturan Belum Lengkap ({completionPercentage}%)
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Lengkapi pengaturan berikut agar calon anggota dapat mendaftar:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {missingSettings.map((setting) => (
                  <span
                    key={setting.key}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {setting.label}
                  </span>
                ))}
              </div>
              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2 mt-3">
                <div 
                  className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {isSettingsComplete && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <h3 className="font-semibold text-foreground">Pengaturan Lengkap</h3>
              <p className="text-sm text-muted-foreground">
                Semua pengaturan wajib sudah terisi. Calon anggota dapat mendaftar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pengaturan Koperasi</h1>
              <p className="text-sm text-muted-foreground">Kelola profil dan aturan koperasi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowHistory(true)} className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Riwayat</span>
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isSyncingSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </div>
        
        {/* Sync Status Indicator */}
        <div className="flex items-center justify-between px-1">
          <SyncStatusIndicator
            status={isSaving || isSyncingSaving ? 'syncing' : syncStatus}
            lastSyncTime={lastSyncTime}
            errorMessage={syncError}
            onRetry={handleRetrySync}
            isRetrying={isRetrying}
            retryCount={retryCount}
            isOnline={isOnline}
          />
        </div>
      </div>

      {/* Quick Access Cards */}
      {onNavigate && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => onNavigate('notification-settings')}
            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left group"
          >
            <div className="p-3 rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Notifikasi Email</h3>
              <p className="text-sm text-muted-foreground">Pengingat angsuran & simpanan</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
          
          <button
            onClick={() => onNavigate('password-audit-log')}
            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left group"
          >
            <div className="p-3 rounded-lg bg-chart-1/10">
              <Shield className="h-5 w-5 text-chart-1" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground group-hover:text-chart-1 transition-colors">Audit Password</h3>
              <p className="text-sm text-muted-foreground">Riwayat perubahan password</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-chart-1 transition-colors" />
          </button>

          <button
            onClick={() => onNavigate('system-audit-log')}
            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left group"
          >
            <div className="p-3 rounded-lg bg-info/10">
              <History className="h-5 w-5 text-info" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground group-hover:text-info transition-colors">Audit Log Sistem</h3>
              <p className="text-sm text-muted-foreground">Riwayat aktivitas admin</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-info transition-colors" />
          </button>

          <button
            onClick={() => onNavigate('data-backup')}
            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left group"
          >
            <div className="p-3 rounded-lg bg-success/10">
              <Database className="h-5 w-5 text-success" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground group-hover:text-success transition-colors">Backup Data</h3>
              <p className="text-sm text-muted-foreground">Ekspor & cadangkan data</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-success transition-colors" />
          </button>
        </div>
      )}

      {/* Navigation Pills - Button Group with Arrow Navigation */}
      <div className="relative">
        {/* Left Gradient Fade */}
        <div 
          className={`
            absolute left-0 top-0 bottom-0 w-12 z-[5] pointer-events-none
            bg-gradient-to-r from-background via-background/80 to-transparent
            transition-opacity duration-300
            ${showLeftArrow ? 'opacity-100' : 'opacity-0'}
          `}
        />

        {/* Left Arrow */}
        <button
          onClick={() => scrollNav('left')}
          className={`
            absolute left-1 top-1/2 -translate-y-1/2 z-10
            w-8 h-8 flex items-center justify-center
            bg-background/95 backdrop-blur-sm border border-border rounded-full shadow-md
            text-muted-foreground hover:text-foreground hover:bg-muted
            transition-all duration-200
            ${showLeftArrow ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}
          `}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Scrollable Container */}
        <div 
          ref={navScrollRef}
          className="overflow-x-auto pb-2 px-10 scroll-smooth hover:cursor-grab active:cursor-grabbing touch-pan-x scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40"
        >
          <TooltipProvider delayDuration={300}>
            <div className="inline-flex w-auto min-w-full gap-1 bg-muted/50 p-1.5 rounded-xl border border-border/50">
              {[
                { value: 'identity', icon: Building2, label: 'Identitas', tooltip: 'Identitas Koperasi' },
                { value: 'vision', icon: Target, label: 'Visi Misi', tooltip: 'Visi & Misi' },
                { value: 'services', icon: Briefcase, label: 'Layanan', tooltip: 'Layanan Koperasi' },
                { value: 'loan', icon: Percent, label: 'Pinjaman', tooltip: 'Pengaturan Pinjaman' },
                { value: 'savings', icon: Wallet, label: 'Simpanan', tooltip: 'Pengaturan Simpanan' },
                { value: 'shu', icon: TrendingUp, label: 'SHU', tooltip: 'Sisa Hasil Usaha' },
                { value: 'member-number', icon: Users, label: 'No. Anggota', tooltip: 'Format Nomor Anggota' },
                { value: 'branch', icon: Building2, label: 'Cabang', tooltip: 'Manajemen Cabang/Unit' },
                { value: 'adart', icon: FileText, label: 'AD/ART', tooltip: 'AD/ART Koperasi' },
                { value: 'auto-closing', icon: CalendarClock, label: 'Otomatis', tooltip: 'Tutup Buku Otomatis' },
                { value: 'preferences', icon: Settings, label: 'Preferensi', tooltip: 'Bahasa & Tema' },
                { value: 'guide', icon: BookOpen, label: 'Panduan', tooltip: 'Panduan Administrator' },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;
                return (
                  <Tooltip key={tab.value}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isActive ? "default" : "ghost"}
                        size="sm"
                        data-tab-value={tab.value}
                        onClick={() => handleTabClick(tab.value)}
                        className={`
                          relative gap-1.5 px-2.5 sm:px-3 py-2 h-auto text-xs font-medium
                          transition-all duration-200 rounded-lg
                          ${isActive 
                            ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20' 
                            : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                          }
                        `}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden md:inline">{tab.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="md:hidden">
                      <p>{tab.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scrollNav('right')}
          className={`
            absolute right-1 top-1/2 -translate-y-1/2 z-10
            w-8 h-8 flex items-center justify-center
            bg-background/95 backdrop-blur-sm border border-border rounded-full shadow-md
            text-muted-foreground hover:text-foreground hover:bg-muted
            transition-all duration-200
            ${showRightArrow ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'}
          `}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Right Gradient Fade */}
        <div 
          className={`
            absolute right-0 top-0 bottom-0 w-12 z-[5] pointer-events-none
            bg-gradient-to-l from-background via-background/80 to-transparent
            transition-opacity duration-300
            ${showRightArrow ? 'opacity-100' : 'opacity-0'}
          `}
        />
      </div>

      {/* Tab Contents */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">

        {/* Identity Tab */}
        <TabsContent value="identity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Identitas Koperasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload & Size Section */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Logo Koperasi</Label>
                
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Upload Area */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      {currentLogo ? (
                        <div className="relative shrink-0">
                          <img
                            src={currentLogo}
                            alt="Logo Koperasi"
                            className="h-16 w-16 object-contain rounded-lg border border-border bg-muted/30"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-1.5 -right-1.5 h-5 w-5"
                            onClick={removeLogo}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="gap-1.5"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload
                        </Button>
                        <p className="text-[11px] text-muted-foreground">
                          JPG, PNG, SVG. Maks 2MB
                        </p>
                      </div>
                    </div>

                    {/* Size & Frame Selectors */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Zoom Logo</Label>
                        <Select
                          value={bankContactSettings.logo_size}
                          onValueChange={(value: BankContactSettings['logo_size']) => 
                            setBankContactSettings(prev => ({ ...prev, logo_size: value }))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Zoom" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">70%</SelectItem>
                            <SelectItem value="medium">85%</SelectItem>
                            <SelectItem value="large">95%</SelectItem>
                            <SelectItem value="xlarge">100%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Bentuk Frame</Label>
                        <Select
                          value={bankContactSettings.logo_frame}
                          onValueChange={(value: BankContactSettings['logo_frame']) => 
                            setBankContactSettings(prev => ({ ...prev, logo_frame: value }))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Frame" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="circle">Bulat</SelectItem>
                            <SelectItem value="rounded">Rounded</SelectItem>
                            <SelectItem value="none">Tanpa Frame</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Container Size Per Context */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Ukuran Container per Konteks</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground">Header</Label>
                          <Select
                            value={bankContactSettings.logo_container_header}
                            onValueChange={(value: BankContactSettings['logo_container_header']) => 
                              setBankContactSettings(prev => ({ ...prev, logo_container_header: value }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Header" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Normal</SelectItem>
                              <SelectItem value="large">Besar</SelectItem>
                              <SelectItem value="xlarge">Lebih Besar</SelectItem>
                              <SelectItem value="xxlarge">Sangat Besar</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground">Footer</Label>
                          <Select
                            value={bankContactSettings.logo_container_footer}
                            onValueChange={(value: BankContactSettings['logo_container_footer']) => 
                              setBankContactSettings(prev => ({ ...prev, logo_container_footer: value }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Footer" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Normal</SelectItem>
                              <SelectItem value="large">Besar</SelectItem>
                              <SelectItem value="xlarge">Lebih Besar</SelectItem>
                              <SelectItem value="xxlarge">Sangat Besar</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground">Splash</Label>
                          <Select
                            value={bankContactSettings.logo_container_splash}
                            onValueChange={(value: BankContactSettings['logo_container_splash']) => 
                              setBankContactSettings(prev => ({ ...prev, logo_container_splash: value }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Splash" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Normal</SelectItem>
                              <SelectItem value="large">Besar</SelectItem>
                              <SelectItem value="xlarge">Lebih Besar</SelectItem>
                              <SelectItem value="xxlarge">Sangat Besar</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground">Kartu Anggota</Label>
                          <Select
                            value={bankContactSettings.logo_container_card}
                            onValueChange={(value: BankContactSettings['logo_container_card']) => 
                              setBankContactSettings(prev => ({ ...prev, logo_container_card: value }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Kartu" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Normal</SelectItem>
                              <SelectItem value="large">Besar</SelectItem>
                              <SelectItem value="xlarge">Lebih Besar</SelectItem>
                              <SelectItem value="xxlarge">Sangat Besar</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    
                    {/* Card Gradient Settings */}
                    <div className="space-y-4">
                      <Label className="text-xs font-medium text-muted-foreground">Pengaturan Gradien Kartu Anggota</Label>
                      
                      {/* Gradient Direction */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground">Arah Gradien</Label>
                        <div className="flex gap-2">
                          {[
                            { value: 'diagonal', label: 'Diagonal', angle: '135deg' },
                            { value: 'horizontal', label: 'Horizontal', angle: '90deg' },
                            { value: 'vertical', label: 'Vertikal', angle: '180deg' },
                          ].map((dir) => (
                            <button
                              key={dir.value}
                              type="button"
                              onClick={() => setBankContactSettings(prev => ({ ...prev, card_gradient_direction: dir.value as BankContactSettings['card_gradient_direction'] }))}
                              className={`
                                flex-1 h-10 rounded-lg border-2 transition-all duration-200 flex items-center justify-center gap-2 text-xs font-medium
                                ${bankContactSettings.card_gradient_direction === dir.value 
                                  ? 'border-primary bg-primary/10 text-primary' 
                                  : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'}
                              `}
                            >
                              <div 
                                className="h-4 w-6 rounded"
                                style={{
                                  background: `linear-gradient(${dir.angle}, ${bankContactSettings.card_gradient_start} 0%, ${bankContactSettings.card_gradient_end} 100%)`
                                }}
                              />
                              {dir.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Gender-based Colors Toggle */}
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                        <div className="space-y-0.5">
                          <Label className="text-xs font-medium">Warna Berdasarkan Jenis Kelamin</Label>
                          <p className="text-[10px] text-muted-foreground">Tampilkan warna berbeda untuk anggota pria dan wanita</p>
                        </div>
                        <Switch
                          checked={bankContactSettings.card_use_gender_colors}
                          onCheckedChange={(checked) => setBankContactSettings(prev => ({ ...prev, card_use_gender_colors: checked }))}
                        />
                      </div>
                      
                      {!bankContactSettings.card_use_gender_colors ? (
                        <>
                          {/* Default Gradient Presets */}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground">Preset Warna Default</Label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { name: 'Indigo Purple', start: '#6366f1', end: '#8b5cf6' },
                                { name: 'Blue Cyan', start: '#3b82f6', end: '#06b6d4' },
                                { name: 'Green Teal', start: '#10b981', end: '#14b8a6' },
                                { name: 'Orange Red', start: '#f97316', end: '#ef4444' },
                                { name: 'Pink Rose', start: '#ec4899', end: '#f43f5e' },
                                { name: 'Purple Blue', start: '#8b5cf6', end: '#3b82f6' },
                                { name: 'Amber Orange', start: '#f59e0b', end: '#f97316' },
                                { name: 'Slate Gray', start: '#475569', end: '#64748b' },
                                { name: 'Emerald Lime', start: '#059669', end: '#84cc16' },
                                { name: 'Fuchsia Pink', start: '#d946ef', end: '#ec4899' },
                              ].map((preset) => (
                                <button
                                  key={preset.name}
                                  type="button"
                                  onClick={() => setBankContactSettings(prev => ({ 
                                    ...prev, 
                                    card_gradient_start: preset.start, 
                                    card_gradient_end: preset.end 
                                  }))}
                                  className={`
                                    h-8 w-12 rounded-lg border-2 transition-all duration-200 hover:scale-110 hover:shadow-md
                                    ${bankContactSettings.card_gradient_start === preset.start && bankContactSettings.card_gradient_end === preset.end 
                                      ? 'border-primary ring-2 ring-primary/30' 
                                      : 'border-border hover:border-primary/50'}
                                  `}
                                  style={{
                                    background: `linear-gradient(135deg, ${preset.start} 0%, ${preset.end} 100%)`
                                  }}
                                  title={preset.name}
                                />
                              ))}
                            </div>
                          </div>
                          
                          {/* Custom Default Color Pickers */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-muted-foreground">Warna Awal</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={bankContactSettings.card_gradient_start}
                                  onChange={(e) => setBankContactSettings(prev => ({ ...prev, card_gradient_start: e.target.value }))}
                                  className="h-8 w-12 rounded border border-border cursor-pointer"
                                />
                                <Input
                                  value={bankContactSettings.card_gradient_start}
                                  onChange={(e) => setBankContactSettings(prev => ({ ...prev, card_gradient_start: e.target.value }))}
                                  className="h-8 text-xs font-mono flex-1"
                                  placeholder="#6366f1"
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-muted-foreground">Warna Akhir</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={bankContactSettings.card_gradient_end}
                                  onChange={(e) => setBankContactSettings(prev => ({ ...prev, card_gradient_end: e.target.value }))}
                                  className="h-8 w-12 rounded border border-border cursor-pointer"
                                />
                                <Input
                                  value={bankContactSettings.card_gradient_end}
                                  onChange={(e) => setBankContactSettings(prev => ({ ...prev, card_gradient_end: e.target.value }))}
                                  className="h-8 text-xs font-mono flex-1"
                                  placeholder="#8b5cf6"
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Male Gradient Settings */}
                          <div className="space-y-2 p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full bg-blue-500" />
                              <Label className="text-xs font-medium text-blue-700 dark:text-blue-300">Warna Pria</Label>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {[
                                { name: 'Blue', start: '#3b82f6', end: '#1d4ed8' },
                                { name: 'Cyan Blue', start: '#06b6d4', end: '#0284c7' },
                                { name: 'Indigo', start: '#6366f1', end: '#4338ca' },
                                { name: 'Slate', start: '#475569', end: '#334155' },
                                { name: 'Teal', start: '#14b8a6', end: '#0d9488' },
                              ].map((preset) => (
                                <button
                                  key={preset.name}
                                  type="button"
                                  onClick={() => setBankContactSettings(prev => ({ 
                                    ...prev, 
                                    card_gradient_male_start: preset.start, 
                                    card_gradient_male_end: preset.end 
                                  }))}
                                  className={`
                                    h-7 w-10 rounded-md border-2 transition-all duration-200 hover:scale-110
                                    ${bankContactSettings.card_gradient_male_start === preset.start && bankContactSettings.card_gradient_male_end === preset.end 
                                      ? 'border-blue-500 ring-2 ring-blue-300' 
                                      : 'border-blue-200 dark:border-blue-800 hover:border-blue-400'}
                                  `}
                                  style={{
                                    background: `linear-gradient(135deg, ${preset.start} 0%, ${preset.end} 100%)`
                                  }}
                                  title={preset.name}
                                />
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={bankContactSettings.card_gradient_male_start}
                                  onChange={(e) => setBankContactSettings(prev => ({ ...prev, card_gradient_male_start: e.target.value }))}
                                  className="h-7 w-10 rounded border border-blue-200 cursor-pointer"
                                />
                                <Input
                                  value={bankContactSettings.card_gradient_male_start}
                                  onChange={(e) => setBankContactSettings(prev => ({ ...prev, card_gradient_male_start: e.target.value }))}
                                  className="h-7 text-[10px] font-mono flex-1"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={bankContactSettings.card_gradient_male_end}
                                  onChange={(e) => setBankContactSettings(prev => ({ ...prev, card_gradient_male_end: e.target.value }))}
                                  className="h-7 w-10 rounded border border-blue-200 cursor-pointer"
                                />
                                <Input
                                  value={bankContactSettings.card_gradient_male_end}
                                  onChange={(e) => setBankContactSettings(prev => ({ ...prev, card_gradient_male_end: e.target.value }))}
                                  className="h-7 text-[10px] font-mono flex-1"
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* Female Gradient Settings */}
                          <div className="space-y-2 p-3 rounded-lg border border-pink-200 bg-pink-50/50 dark:border-pink-900 dark:bg-pink-950/30">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full bg-pink-500" />
                              <Label className="text-xs font-medium text-pink-700 dark:text-pink-300">Warna Wanita</Label>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {[
                                { name: 'Pink', start: '#ec4899', end: '#db2777' },
                                { name: 'Rose', start: '#f43f5e', end: '#e11d48' },
                                { name: 'Fuchsia', start: '#d946ef', end: '#c026d3' },
                                { name: 'Purple', start: '#a855f7', end: '#9333ea' },
                                { name: 'Coral', start: '#fb7185', end: '#f472b6' },
                              ].map((preset) => (
                                <button
                                  key={preset.name}
                                  type="button"
                                  onClick={() => setBankContactSettings(prev => ({ 
                                    ...prev, 
                                    card_gradient_female_start: preset.start, 
                                    card_gradient_female_end: preset.end 
                                  }))}
                                  className={`
                                    h-7 w-10 rounded-md border-2 transition-all duration-200 hover:scale-110
                                    ${bankContactSettings.card_gradient_female_start === preset.start && bankContactSettings.card_gradient_female_end === preset.end 
                                      ? 'border-pink-500 ring-2 ring-pink-300' 
                                      : 'border-pink-200 dark:border-pink-800 hover:border-pink-400'}
                                  `}
                                  style={{
                                    background: `linear-gradient(135deg, ${preset.start} 0%, ${preset.end} 100%)`
                                  }}
                                  title={preset.name}
                                />
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={bankContactSettings.card_gradient_female_start}
                                  onChange={(e) => setBankContactSettings(prev => ({ ...prev, card_gradient_female_start: e.target.value }))}
                                  className="h-7 w-10 rounded border border-pink-200 cursor-pointer"
                                />
                                <Input
                                  value={bankContactSettings.card_gradient_female_start}
                                  onChange={(e) => setBankContactSettings(prev => ({ ...prev, card_gradient_female_start: e.target.value }))}
                                  className="h-7 text-[10px] font-mono flex-1"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={bankContactSettings.card_gradient_female_end}
                                  onChange={(e) => setBankContactSettings(prev => ({ ...prev, card_gradient_female_end: e.target.value }))}
                                  className="h-7 w-10 rounded border border-pink-200 cursor-pointer"
                                />
                                <Input
                                  value={bankContactSettings.card_gradient_female_end}
                                  onChange={(e) => setBankContactSettings(prev => ({ ...prev, card_gradient_female_end: e.target.value }))}
                                  className="h-7 text-[10px] font-mono flex-1"
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Live Preview - 4 contexts */}
                  <div className="space-y-3">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Preview per Konteks</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Header Preview */}
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background p-3">
                        <span className="text-[9px] text-muted-foreground mb-2">Header</span>
                        <div 
                          className={`
                            flex items-center justify-center overflow-hidden transition-all duration-300
                            ${bankContactSettings.logo_container_header === 'default' ? 'h-10 w-10' : ''}
                            ${bankContactSettings.logo_container_header === 'large' ? 'h-12 w-12' : ''}
                            ${bankContactSettings.logo_container_header === 'xlarge' ? 'h-16 w-16' : ''}
                            ${bankContactSettings.logo_container_header === 'xxlarge' ? 'h-20 w-20' : ''}
                            ${bankContactSettings.logo_frame === 'circle' ? 'rounded-full bg-muted shadow' : ''}
                            ${bankContactSettings.logo_frame === 'rounded' ? 'rounded-xl bg-muted shadow' : ''}
                            ${bankContactSettings.logo_frame === 'none' ? 'drop-shadow' : ''}
                          `}
                        >
                          {currentLogo ? (
                            <img src={currentLogo} alt="Preview" className={`object-contain ${bankContactSettings.logo_size === 'small' ? 'h-[70%] w-[70%]' : bankContactSettings.logo_size === 'medium' ? 'h-[85%] w-[85%]' : bankContactSettings.logo_size === 'large' ? 'h-[95%] w-[95%]' : 'h-full w-full'}`} />
                          ) : (
                            <Building2 className="h-4 w-4 text-primary/60" />
                          )}
                        </div>
                      </div>
                      {/* Footer Preview */}
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background p-3">
                        <span className="text-[9px] text-muted-foreground mb-2">Footer</span>
                        <div 
                          className={`
                            flex items-center justify-center overflow-hidden transition-all duration-300
                            ${bankContactSettings.logo_container_footer === 'default' ? 'h-8 w-8' : ''}
                            ${bankContactSettings.logo_container_footer === 'large' ? 'h-10 w-10' : ''}
                            ${bankContactSettings.logo_container_footer === 'xlarge' ? 'h-12 w-12' : ''}
                            ${bankContactSettings.logo_container_footer === 'xxlarge' ? 'h-14 w-14' : ''}
                            ${bankContactSettings.logo_frame === 'circle' ? 'rounded-full bg-muted shadow' : ''}
                            ${bankContactSettings.logo_frame === 'rounded' ? 'rounded-lg bg-muted shadow' : ''}
                            ${bankContactSettings.logo_frame === 'none' ? 'drop-shadow' : ''}
                          `}
                        >
                          {currentLogo ? (
                            <img src={currentLogo} alt="Preview" className={`object-contain ${bankContactSettings.logo_size === 'small' ? 'h-[70%] w-[70%]' : bankContactSettings.logo_size === 'medium' ? 'h-[85%] w-[85%]' : bankContactSettings.logo_size === 'large' ? 'h-[95%] w-[95%]' : 'h-full w-full'}`} />
                          ) : (
                            <Building2 className="h-3 w-3 text-primary/60" />
                          )}
                        </div>
                      </div>
                      {/* Splash Preview */}
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-gradient-to-br from-primary/20 to-primary/10 p-3">
                        <span className="text-[9px] text-muted-foreground mb-2">Splash</span>
                        <div 
                          className={`
                            flex items-center justify-center overflow-hidden transition-all duration-300
                            ${bankContactSettings.logo_container_splash === 'default' ? 'h-14 w-14' : ''}
                            ${bankContactSettings.logo_container_splash === 'large' ? 'h-18 w-18' : ''}
                            ${bankContactSettings.logo_container_splash === 'xlarge' ? 'h-22 w-22' : ''}
                            ${bankContactSettings.logo_container_splash === 'xxlarge' ? 'h-26 w-26' : ''}
                            ${bankContactSettings.logo_frame === 'circle' ? 'rounded-full bg-white/20 shadow-lg backdrop-blur' : ''}
                            ${bankContactSettings.logo_frame === 'rounded' ? 'rounded-2xl bg-white/20 shadow-lg backdrop-blur' : ''}
                            ${bankContactSettings.logo_frame === 'none' ? 'drop-shadow-xl' : ''}
                          `}
                        >
                          {currentLogo ? (
                            <img src={currentLogo} alt="Preview" className={`object-contain ${bankContactSettings.logo_size === 'small' ? 'h-[70%] w-[70%]' : bankContactSettings.logo_size === 'medium' ? 'h-[85%] w-[85%]' : bankContactSettings.logo_size === 'large' ? 'h-[95%] w-[95%]' : 'h-full w-full'}`} />
                          ) : (
                            <Building2 className="h-6 w-6 text-white/60" />
                          )}
                        </div>
                      </div>
                      {/* Card Preview - with gender colors option */}
                      <div className="col-span-2 sm:col-span-1">
                        <div 
                          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-3"
                          style={{
                            background: `linear-gradient(${
                              bankContactSettings.card_gradient_direction === 'diagonal' ? '135deg' : 
                              bankContactSettings.card_gradient_direction === 'horizontal' ? '90deg' : '180deg'
                            }, ${bankContactSettings.card_gradient_start} 0%, ${bankContactSettings.card_gradient_end} 100%)`
                          }}
                        >
                          <span className="text-[9px] text-white/80 mb-2">{bankContactSettings.card_use_gender_colors ? 'Default' : 'Kartu'}</span>
                          <div 
                            className={`
                              flex items-center justify-center overflow-hidden transition-all duration-300
                              ${bankContactSettings.logo_container_card === 'default' ? 'h-10 w-10' : ''}
                              ${bankContactSettings.logo_container_card === 'large' ? 'h-12 w-12' : ''}
                              ${bankContactSettings.logo_container_card === 'xlarge' ? 'h-14 w-14' : ''}
                              ${bankContactSettings.logo_container_card === 'xxlarge' ? 'h-16 w-16' : ''}
                              ${bankContactSettings.logo_frame === 'circle' ? 'rounded-full bg-white/20 shadow backdrop-blur' : ''}
                              ${bankContactSettings.logo_frame === 'rounded' ? 'rounded-xl bg-white/20 shadow backdrop-blur' : ''}
                              ${bankContactSettings.logo_frame === 'none' ? 'drop-shadow' : ''}
                            `}
                          >
                            {currentLogo ? (
                              <img src={currentLogo} alt="Preview" className={`object-contain ${bankContactSettings.logo_size === 'small' ? 'h-[70%] w-[70%]' : bankContactSettings.logo_size === 'medium' ? 'h-[85%] w-[85%]' : bankContactSettings.logo_size === 'large' ? 'h-[95%] w-[95%]' : 'h-full w-full'}`} />
                            ) : (
                              <Building2 className="h-4 w-4 text-white/60" />
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Gender-specific Card Previews */}
                      {bankContactSettings.card_use_gender_colors && (
                        <>
                          <div 
                            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-blue-300 p-3"
                            style={{
                              background: `linear-gradient(${
                                bankContactSettings.card_gradient_direction === 'diagonal' ? '135deg' : 
                                bankContactSettings.card_gradient_direction === 'horizontal' ? '90deg' : '180deg'
                              }, ${bankContactSettings.card_gradient_male_start} 0%, ${bankContactSettings.card_gradient_male_end} 100%)`
                            }}
                          >
                            <span className="text-[9px] text-white/80 mb-2">Pria</span>
                            <div 
                              className={`
                                flex items-center justify-center overflow-hidden transition-all duration-300
                                ${bankContactSettings.logo_container_card === 'default' ? 'h-10 w-10' : ''}
                                ${bankContactSettings.logo_container_card === 'large' ? 'h-12 w-12' : ''}
                                ${bankContactSettings.logo_container_card === 'xlarge' ? 'h-14 w-14' : ''}
                                ${bankContactSettings.logo_container_card === 'xxlarge' ? 'h-16 w-16' : ''}
                                ${bankContactSettings.logo_frame === 'circle' ? 'rounded-full bg-white/20 shadow backdrop-blur' : ''}
                                ${bankContactSettings.logo_frame === 'rounded' ? 'rounded-xl bg-white/20 shadow backdrop-blur' : ''}
                                ${bankContactSettings.logo_frame === 'none' ? 'drop-shadow' : ''}
                              `}
                            >
                              {currentLogo ? (
                                <img src={currentLogo} alt="Preview" className={`object-contain ${bankContactSettings.logo_size === 'small' ? 'h-[70%] w-[70%]' : bankContactSettings.logo_size === 'medium' ? 'h-[85%] w-[85%]' : bankContactSettings.logo_size === 'large' ? 'h-[95%] w-[95%]' : 'h-full w-full'}`} />
                              ) : (
                                <Building2 className="h-4 w-4 text-white/60" />
                              )}
                            </div>
                          </div>
                          <div 
                            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-pink-300 p-3"
                            style={{
                              background: `linear-gradient(${
                                bankContactSettings.card_gradient_direction === 'diagonal' ? '135deg' : 
                                bankContactSettings.card_gradient_direction === 'horizontal' ? '90deg' : '180deg'
                              }, ${bankContactSettings.card_gradient_female_start} 0%, ${bankContactSettings.card_gradient_female_end} 100%)`
                            }}
                          >
                            <span className="text-[9px] text-white/80 mb-2">Wanita</span>
                            <div 
                              className={`
                                flex items-center justify-center overflow-hidden transition-all duration-300
                                ${bankContactSettings.logo_container_card === 'default' ? 'h-10 w-10' : ''}
                                ${bankContactSettings.logo_container_card === 'large' ? 'h-12 w-12' : ''}
                                ${bankContactSettings.logo_container_card === 'xlarge' ? 'h-14 w-14' : ''}
                                ${bankContactSettings.logo_container_card === 'xxlarge' ? 'h-16 w-16' : ''}
                                ${bankContactSettings.logo_frame === 'circle' ? 'rounded-full bg-white/20 shadow backdrop-blur' : ''}
                                ${bankContactSettings.logo_frame === 'rounded' ? 'rounded-xl bg-white/20 shadow backdrop-blur' : ''}
                                ${bankContactSettings.logo_frame === 'none' ? 'drop-shadow' : ''}
                              `}
                            >
                              {currentLogo ? (
                                <img src={currentLogo} alt="Preview" className={`object-contain ${bankContactSettings.logo_size === 'small' ? 'h-[70%] w-[70%]' : bankContactSettings.logo_size === 'medium' ? 'h-[85%] w-[85%]' : bankContactSettings.logo_size === 'large' ? 'h-[95%] w-[95%]' : 'h-full w-full'}`} />
                              ) : (
                                <Building2 className="h-4 w-4 text-white/60" />
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Koperasi</Label>
                  <Input
                    id="name"
                    value={settings.name}
                    onChange={(e) => updateSettings({ name: e.target.value })}
                    placeholder="Nama koperasi"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalNumber">Nomor Badan Hukum</Label>
                  <Input
                    id="legalNumber"
                    value={settings.legalNumber}
                    onChange={(e) => updateSettings({ legalNumber: e.target.value })}
                    placeholder="No. xxx/BH/xxx/xxxx"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Alamat</Label>
                  <Textarea
                    id="address"
                    value={settings.address}
                    onChange={(e) => updateSettings({ address: e.target.value })}
                    placeholder="Alamat lengkap koperasi"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="foundedDate">Tanggal Didirikan</Label>
                  <Input
                    id="foundedDate"
                    value={settings.foundedDate}
                    onChange={(e) => updateSettings({ foundedDate: e.target.value })}
                    placeholder="contoh: 15 Januari 2020"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="copyrightYear">Tahun Copyright</Label>
                  <Input
                    id="copyrightYear"
                    type="number"
                    value={settings.copyrightYear || new Date().getFullYear()}
                    onChange={(e) => updateSettings({ copyrightYear: parseInt(e.target.value) || new Date().getFullYear() })}
                    placeholder="2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">URL Logo (alternatif)</Label>
                  <Input
                    id="logoUrl"
                    value={settings.logoUrl || ''}
                    onChange={(e) => updateSettings({ logoUrl: e.target.value, logoBase64: '' })}
                    placeholder="https://..."
                    disabled={!!settings.logoBase64}
                  />
                </div>
              </div>

              {/* Bank & Contact Section */}
              <div className="border-t border-border pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Rekening Koperasi & Kontak
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Informasi rekening untuk transfer simpanan awal dan kontak admin untuk verifikasi pendaftaran
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Rekening Koperasi</Label>
                    <Select
                      value={bankContactSettings.bank_name}
                      onValueChange={(value) => setBankContactSettings(prev => ({ ...prev, bank_name: value }))}
                    >
                      <SelectTrigger id="bank_name">
                        <SelectValue placeholder="Pilih bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankContactSettings.available_banks.map(bank => (
                          <SelectItem key={bank} value={bank}>
                            {bank}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account_number">Nomor Rekening Koperasi</Label>
                    <Input
                      id="bank_account_number"
                      value={bankContactSettings.bank_account_number}
                      onChange={(e) => setBankContactSettings(prev => ({ ...prev, bank_account_number: e.target.value.replace(/\D/g, '') }))}
                      placeholder="Nomor rekening"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account_name">Nama Pemilik Rekening</Label>
                    <Input
                      id="bank_account_name"
                      value={bankContactSettings.bank_account_name}
                      onChange={(e) => setBankContactSettings(prev => ({ ...prev, bank_account_name: e.target.value }))}
                      placeholder="Atas nama rekening"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Nomor Telepon Koperasi
                    </Label>
                    <Input
                      id="contact_phone"
                      value={bankContactSettings.contact_phone}
                      onChange={(e) => setBankContactSettings(prev => ({ ...prev, contact_phone: e.target.value }))}
                      placeholder="08xxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">
                      Nomor ini akan ditampilkan ke calon anggota untuk verifikasi pendaftaran
                    </p>
                  </div>
                </div>

                {/* Simpanan Awal Pendaftaran */}
                <div className="border-t border-border pt-4 mt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    Simpanan Awal Pendaftaran
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Jumlah simpanan yang harus dibayar oleh calon anggota saat pendaftaran
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="simpanan_pokok">Simpanan Pokok</Label>
                      <Input
                        id="simpanan_pokok"
                        type="number"
                        value={bankContactSettings.simpanan_pokok}
                        onChange={(e) => setBankContactSettings(prev => ({ ...prev, simpanan_pokok: Number(e.target.value) || 0 }))}
                        placeholder="500000"
                      />
                      <p className="text-xs text-muted-foreground">
                        Simpanan satu kali saat menjadi anggota
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="simpanan_wajib">Simpanan Wajib (per bulan)</Label>
                      <Input
                        id="simpanan_wajib"
                        type="number"
                        value={bankContactSettings.simpanan_wajib}
                        onChange={(e) => setBankContactSettings(prev => ({ ...prev, simpanan_wajib: Number(e.target.value) || 0 }))}
                        placeholder="100000"
                      />
                      <p className="text-xs text-muted-foreground">
                        Simpanan bulanan wajib anggota
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm font-medium text-primary">
                      Total Simpanan Awal: {formatCurrency(bankContactSettings.simpanan_pokok + bankContactSettings.simpanan_wajib)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Jumlah ini akan ditampilkan di halaman pembayaran setelah pendaftaran
                    </p>
                  </div>
                </div>

                {/* Available Banks Management */}
                <div className="border-t border-border pt-4 mt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    Daftar Bank untuk Formulir Pendaftaran
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Bank yang sama dengan rekening koperasi akan ditandai di formulir pendaftaran untuk memudahkan calon anggota menghindari biaya admin transfer antar bank.
                  </p>
                  
                  <div className="flex gap-2 mb-3">
                    <Input
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                      placeholder="Nama bank baru"
                      onKeyDown={(e) => e.key === 'Enter' && addBank()}
                    />
                    <Button variant="outline" onClick={addBank} className="gap-1 shrink-0">
                      <Plus className="h-4 w-4" />
                      Tambah
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {bankContactSettings.available_banks.map(bank => (
                      <div 
                        key={bank} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border ${
                          bank === bankContactSettings.bank_name 
                            ? 'bg-primary/10 border-primary text-primary' 
                            : 'bg-muted/50 border-border'
                        }`}
                      >
                        {bank}
                        {bank === bankContactSettings.bank_name && (
                          <span className="text-xs">(Rekening Koperasi)</span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 ml-1 hover:bg-destructive/20"
                          onClick={() => removeBank(bank)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Signature & Stamp Section - Moved to Letter Archive */}
              <div className="border-t border-border pt-6 mt-6">
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Tanda Tangan & Stempel
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Pengaturan tanda tangan dan stempel telah dipindahkan ke menu <strong>Arsip Surat</strong> untuk pengelolaan yang lebih terpusat.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate?.('letter-archive')}
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Buka Arsip Surat
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vision & Mission Tab */}
        <TabsContent value="vision">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Visi & Misi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="vision">Visi</Label>
                <Textarea
                  id="vision"
                  value={settings.vision}
                  onChange={(e) => updateSettings({ vision: e.target.value })}
                  placeholder="Visi koperasi"
                  rows={3}
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Misi</Label>
                  <Button variant="outline" size="sm" onClick={addMission} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Tambah
                  </Button>
                </div>
                {settings.mission.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) => updateMission(index, e.target.value)}
                      placeholder={`Misi ${index + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMission(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Jenis Layanan
                </div>
                <Button variant="outline" size="sm" onClick={addService} className="gap-1">
                  <Plus className="h-4 w-4" />
                  Tambah
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.services.map((service, index) => (
                <div key={index} className="flex gap-2 items-start p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex-1 grid gap-2 sm:grid-cols-2">
                    <Input
                      value={service.title}
                      onChange={(e) => updateService(index, 'title', e.target.value)}
                      placeholder="Nama layanan"
                    />
                    <Input
                      value={service.description}
                      onChange={(e) => updateService(index, 'description', e.target.value)}
                      placeholder="Deskripsi singkat"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeService(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loan Interest Tab */}
        <TabsContent value="loan">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                Pengaturan Pinjaman
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="interestRate">Bunga per Bulan (%)</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.1"
                    value={settings.interestRate}
                    onChange={(e) => updateSettings({ interestRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interestCalculationMethod">Metode Perhitungan Bunga</Label>
                  <Select
                    value={settings.interestCalculationMethod || 'flat'}
                    onValueChange={(value) => updateSettings({ interestCalculationMethod: value as 'flat' | 'effective' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat (Bunga Tetap)</SelectItem>
                      <SelectItem value="effective">Efektif (Menurun)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {settings.interestCalculationMethod === 'effective' 
                      ? 'Bunga dihitung dari sisa pokok pinjaman (menurun setiap bulan)'
                      : 'Bunga dihitung dari pokok awal pinjaman (tetap setiap bulan)'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minLoanAmount">Pinjaman Minimal (Rp)</Label>
                  <Input
                    id="minLoanAmount"
                    type="number"
                    step="100000"
                    value={settings.minLoanAmount}
                    onChange={(e) => updateSettings({ minLoanAmount: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLoanAmount">Pinjaman Maksimal (Rp)</Label>
                  <Input
                    id="maxLoanAmount"
                    type="number"
                    step="1000000"
                    value={settings.maxLoanAmount}
                    onChange={(e) => updateSettings({ maxLoanAmount: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenorMin">Tenor Minimal (bulan)</Label>
                  <Input
                    id="tenorMin"
                    type="number"
                    value={settings.tenorMin}
                    onChange={(e) => updateSettings({ tenorMin: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenorMax">Tenor Maksimal (bulan)</Label>
                  <Input
                    id="tenorMax"
                    type="number"
                    value={settings.tenorMax}
                    onChange={(e) => updateSettings({ tenorMax: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLoanMultiplier">Maks. Pinjaman (x total simpanan)</Label>
                  <Input
                    id="maxLoanMultiplier"
                    type="number"
                    step="0.5"
                    value={settings.maxLoanMultiplier}
                    onChange={(e) => updateSettings({ maxLoanMultiplier: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="latePaymentPenalty">Denda Keterlambatan (%)</Label>
                  <Input
                    id="latePaymentPenalty"
                    type="number"
                    step="0.1"
                    value={settings.latePaymentPenalty}
                    onChange={(e) => updateSettings({ latePaymentPenalty: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="latePaymentPenaltyType">Periode Denda</Label>
                  <Select
                    value={settings.latePaymentPenaltyType || 'daily'}
                    onValueChange={(value) => updateSettings({ latePaymentPenaltyType: value as 'daily' | 'monthly' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Per Hari</SelectItem>
                      <SelectItem value="monthly">Per Bulan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="latePaymentPenaltyBase">Basis Perhitungan Denda</Label>
                  <Select
                    value={settings.latePaymentPenaltyBase || 'remaining_installment'}
                    onValueChange={(value) => updateSettings({ latePaymentPenaltyBase: value as 'remaining_installment' | 'remaining_principal' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remaining_installment">Sisa Angsuran</SelectItem>
                      <SelectItem value="remaining_principal">Sisa Pokok Pinjaman</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="penaltyGracePeriodDays">Masa Tenggang Denda</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="penaltyGracePeriodDays"
                      type="number"
                      min="0"
                      max="30"
                      value={settings.penaltyGracePeriodDays ?? 0}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (isNaN(value)) {
                          updateSettings({ penaltyGracePeriodDays: 0 });
                        } else if (value < 0) {
                          updateSettings({ penaltyGracePeriodDays: 0 });
                        } else if (value > 30) {
                          updateSettings({ penaltyGracePeriodDays: 30 });
                        } else {
                          updateSettings({ penaltyGracePeriodDays: value });
                        }
                      }}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">hari setelah jatuh tempo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Denda akan diterapkan setelah melewati masa tenggang ini. (0 = langsung dikenakan denda)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installmentDueDaysAfterDisbursement">Jatuh Tempo Setelah Pencairan</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="installmentDueDaysAfterDisbursement"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.installmentDueDaysAfterDisbursement || 30}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (isNaN(value)) {
                          updateSettings({ installmentDueDaysAfterDisbursement: 30 });
                        } else if (value < 1) {
                          updateSettings({ installmentDueDaysAfterDisbursement: 1 });
                        } else if (value > 365) {
                          updateSettings({ installmentDueDaysAfterDisbursement: 365 });
                        } else {
                          updateSettings({ installmentDueDaysAfterDisbursement: value });
                        }
                      }}
                      className={`w-24 ${
                        (settings.installmentDueDaysAfterDisbursement || 30) < 1 || 
                        (settings.installmentDueDaysAfterDisbursement || 30) > 365 
                          ? 'border-destructive focus-visible:ring-destructive' 
                          : ''
                      }`}
                    />
                    <span className="text-sm text-muted-foreground">hari</span>
                  </div>
                  {(settings.installmentDueDaysAfterDisbursement || 30) < 1 && (
                    <p className="text-xs text-destructive">
                      Nilai minimal adalah 1 hari
                    </p>
                  )}
                  {(settings.installmentDueDaysAfterDisbursement || 30) > 365 && (
                    <p className="text-xs text-destructive">
                      Nilai maksimal adalah 365 hari (1 tahun)
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Interval hari antar angsuran (1-365 hari), dihitung dari tanggal pencairan
                  </p>
                </div>
              </div>
              
              {/* Loan Requirements */}
              <div className="border-t border-border pt-6">
                <h4 className="font-medium text-foreground mb-4">Persyaratan Pengajuan Pinjaman</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Atur persyaratan yang harus dipenuhi anggota sebelum mengajukan pinjaman.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="space-y-0.5">
                      <Label>Wajib Bayar Simpanan Pokok</Label>
                      <p className="text-xs text-muted-foreground">
                        Anggota harus sudah membayar simpanan pokok sebelum dapat mengajukan pinjaman
                      </p>
                    </div>
                    <Switch
                      checked={settings.requireSimpananPokokForLoan ?? true}
                      onCheckedChange={(checked) => updateSettings({ requireSimpananPokokForLoan: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="space-y-0.5">
                      <Label>Minimal Simpanan Wajib</Label>
                      <p className="text-xs text-muted-foreground">
                        Anggota harus memiliki simpanan wajib minimal sebelum dapat mengajukan pinjaman
                      </p>
                    </div>
                    <Switch
                      checked={settings.requireMinSimpananWajibForLoan ?? false}
                      onCheckedChange={(checked) => updateSettings({ requireMinSimpananWajibForLoan: checked })}
                    />
                  </div>
                  {(settings.requireMinSimpananWajibForLoan ?? false) && (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="minSimpananWajibForLoan">Jumlah Minimal Simpanan Wajib (Rp)</Label>
                      <Input
                        id="minSimpananWajibForLoan"
                        type="number"
                        step="50000"
                        value={settings.minSimpananWajibForLoan ?? 100000}
                        onChange={(e) => updateSettings({ minSimpananWajibForLoan: parseFloat(e.target.value) || 100000 })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Anggota harus memiliki simpanan wajib minimal Rp {(settings.minSimpananWajibForLoan ?? 100000).toLocaleString('id-ID')} sebelum dapat mengajukan pinjaman
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Early Payoff Settings */}
              <div className="border-t border-border pt-6">
                <h4 className="font-medium text-foreground mb-4">Pengaturan Pelunasan Dini</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Atur opsi pelunasan dini pinjaman sebelum tenor berakhir. Anggota hanya membayar bunga periode berjalan, bunga selanjutnya ditiadakan.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="space-y-0.5">
                      <Label>Izinkan Pelunasan Dini</Label>
                      <p className="text-xs text-muted-foreground">
                        Anggota dapat melunasi pinjaman sebelum tenor berakhir
                      </p>
                    </div>
                    <Switch
                      checked={settings.earlyPayoffEnabled ?? true}
                      onCheckedChange={(checked) => updateSettings({ earlyPayoffEnabled: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="space-y-0.5">
                      <Label>Perlu Persetujuan Admin</Label>
                      <p className="text-xs text-muted-foreground">
                        Pengajuan pelunasan dini perlu diverifikasi admin
                      </p>
                    </div>
                    <Switch
                      checked={settings.earlyPayoffRequiresApproval ?? true}
                      onCheckedChange={(checked) => updateSettings({ earlyPayoffRequiresApproval: checked })}
                      disabled={!(settings.earlyPayoffEnabled ?? true)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="earlyPayoffFeeType">Biaya Pelunasan Dini</Label>
                    <Select
                      value={settings.earlyPayoffFeeType ?? 'none'}
                      onValueChange={(value) => updateSettings({ earlyPayoffFeeType: value as 'none' | 'fixed' | 'percentage' })}
                      disabled={!(settings.earlyPayoffEnabled ?? true)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tidak Ada Biaya</SelectItem>
                        <SelectItem value="fixed">Biaya Tetap</SelectItem>
                        <SelectItem value="percentage">Persentase dari Sisa Pokok</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(settings.earlyPayoffFeeType === 'fixed' || settings.earlyPayoffFeeType === 'percentage') && (
                    <div className="space-y-2">
                      <Label htmlFor="earlyPayoffFeeAmount">
                        {settings.earlyPayoffFeeType === 'fixed' ? 'Jumlah Biaya (Rp)' : 'Persentase Biaya (%)'}
                      </Label>
                      <Input
                        id="earlyPayoffFeeAmount"
                        type="number"
                        step={settings.earlyPayoffFeeType === 'percentage' ? '0.1' : '1000'}
                        value={settings.earlyPayoffFeeAmount ?? 0}
                        onChange={(e) => updateSettings({ earlyPayoffFeeAmount: parseFloat(e.target.value) || 0 })}
                        disabled={!(settings.earlyPayoffEnabled ?? true)}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
                <h4 className="font-medium text-foreground mb-2">Preview</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Pinjaman: {formatCurrency(settings.minLoanAmount)} - {formatCurrency(settings.maxLoanAmount)}</p>
                  <p>• Bunga: {settings.interestRate}% per bulan ({settings.interestCalculationMethod === 'effective' ? 'efektif/menurun' : 'flat'})</p>
                  <p>• Tenor: {settings.tenorMin} - {settings.tenorMax} bulan</p>
                  <p>• Maksimal pinjaman: {settings.maxLoanMultiplier}x total simpanan</p>
                  <p>• Jatuh tempo angsuran: setiap {settings.installmentDueDaysAfterDisbursement || 30} hari setelah pencairan</p>
                  <p>• Denda keterlambatan: {settings.latePaymentPenalty}% {settings.latePaymentPenaltyType === 'daily' ? 'per hari' : 'per bulan'} dari {settings.latePaymentPenaltyBase === 'remaining_installment' ? 'sisa angsuran' : 'sisa pokok'}</p>
                  <p>• Masa tenggang denda: {settings.penaltyGracePeriodDays ?? 0} hari setelah jatuh tempo</p>
                  <p>• Pelunasan dini: {(settings.earlyPayoffEnabled ?? true) ? 'Diizinkan' : 'Tidak Diizinkan'}
                    {(settings.earlyPayoffEnabled ?? true) && settings.earlyPayoffFeeType !== 'none' && ` (biaya: ${settings.earlyPayoffFeeType === 'fixed' ? formatCurrency(settings.earlyPayoffFeeAmount ?? 0) : `${settings.earlyPayoffFeeAmount ?? 0}%`})`}
                  </p>
                  <p>• Wajib simpanan pokok: {(settings.requireSimpananPokokForLoan ?? true) ? 'Ya' : 'Tidak'}</p>
                  <p>• Minimal simpanan wajib: {(settings.requireMinSimpananWajibForLoan ?? false) ? `Rp ${(settings.minSimpananWajibForLoan ?? 100000).toLocaleString('id-ID')}` : 'Tidak ada'}</p>
                </div>
              </div>

              {/* Save with Mode Selection */}
              <div className="mt-4 p-4 rounded-lg bg-info/10 border border-info/30">
                <h4 className="font-medium text-foreground mb-2">Simpan dengan Mode Penerapan</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Klik tombol di bawah untuk menyimpan perubahan bunga pinjaman atau denda dengan pilihan mode penerapan.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const oldSettings = getCooperativeSettings();
                      if (settings.interestRate !== oldSettings.interestRate) {
                        handleCriticalSettingSave('interestRate', 'Bunga Pinjaman', oldSettings.interestRate, settings.interestRate);
                      } else {
                        toast.info('Tidak ada perubahan pada bunga pinjaman');
                      }
                    }}
                  >
                    Simpan Bunga Pinjaman
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const oldSettings = getCooperativeSettings();
                      if (settings.latePaymentPenalty !== oldSettings.latePaymentPenalty) {
                        handleCriticalSettingSave('latePaymentPenalty', 'Denda Keterlambatan', oldSettings.latePaymentPenalty, settings.latePaymentPenalty);
                      } else {
                        toast.info('Tidak ada perubahan pada denda keterlambatan');
                      }
                    }}
                  >
                    Simpan Denda Keterlambatan
                  </Button>
                </div>
              </div>

              {/* Collateral Settings */}
              <div className="border-t border-border pt-6">
                <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Pengaturan Agunan (Jaminan)
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Atur batas pinjaman yang memerlukan agunan dan pengurus yang bertanggung jawab.
                </p>
                
                {localCollateralSettings && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="collateralThreshold">Batas Pinjaman Wajib Agunan (Rp)</Label>
                      <Input
                        id="collateralThreshold"
                        type="number"
                        step="500000"
                        value={localCollateralSettings.collateralThreshold}
                        onChange={(e) => setLocalCollateralSettings(prev => prev ? { ...prev, collateralThreshold: parseInt(e.target.value) || 0 } : null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Pinjaman di atas nilai ini wajib menyertakan agunan
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="collateralMinValueRatio">Rasio Minimum Nilai Agunan (%)</Label>
                      <Input
                        id="collateralMinValueRatio"
                        type="number"
                        step="10"
                        min="0"
                        max="200"
                        value={localCollateralSettings.collateralMinValueRatio}
                        onChange={(e) => setLocalCollateralSettings(prev => prev ? { ...prev, collateralMinValueRatio: parseInt(e.target.value) || 100 } : null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Nilai taksiran agunan harus minimal {localCollateralSettings.collateralMinValueRatio}% dari nilai pinjaman
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="collateralCustodian">Pengurus Penanggung Jawab Agunan</Label>
                      <Select
                        value={localCollateralSettings.collateralCustodianId || ''}
                        onValueChange={(value) => setLocalCollateralSettings(prev => prev ? { ...prev, collateralCustodianId: value || null } : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih pengurus..." />
                        </SelectTrigger>
                        <SelectContent>
                          {adminUsers?.map((admin) => (
                            <SelectItem key={admin.user_id} value={admin.user_id}>
                              {admin.name} ({admin.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Pengurus ini akan menjadi penanggung jawab penyimpanan dokumen agunan
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Agunan Perlu Verifikasi Admin</Label>
                        <p className="text-xs text-muted-foreground">
                          Agunan harus diverifikasi sebelum pinjaman dapat dicairkan
                        </p>
                      </div>
                      <Switch
                        checked={localCollateralSettings.collateralRequireApproval}
                        onCheckedChange={(checked) => setLocalCollateralSettings(prev => prev ? { ...prev, collateralRequireApproval: checked } : null)}
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-3">
                      <Label>Jenis Agunan yang Diterima</Label>
                      <div className="flex flex-wrap gap-2">
                        {localCollateralSettings.collateralTypes.map((type, index) => (
                          <Badge key={index} variant="secondary" className="gap-1">
                            {type}
                            <button
                              type="button"
                              onClick={() => {
                                setLocalCollateralSettings(prev => prev ? {
                                  ...prev,
                                  collateralTypes: prev.collateralTypes.filter((_, i) => i !== index)
                                } : null);
                              }}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Tambah jenis agunan baru..."
                          value={newCollateralType}
                          onChange={(e) => setNewCollateralType(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newCollateralType.trim()) {
                              e.preventDefault();
                              if (!localCollateralSettings.collateralTypes.includes(newCollateralType.trim())) {
                                setLocalCollateralSettings(prev => prev ? {
                                  ...prev,
                                  collateralTypes: [...prev.collateralTypes, newCollateralType.trim()]
                                } : null);
                              }
                              setNewCollateralType('');
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            if (newCollateralType.trim() && !localCollateralSettings.collateralTypes.includes(newCollateralType.trim())) {
                              setLocalCollateralSettings(prev => prev ? {
                                ...prev,
                                collateralTypes: [...prev.collateralTypes, newCollateralType.trim()]
                              } : null);
                              setNewCollateralType('');
                            }
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <Button
                        onClick={async () => {
                          if (localCollateralSettings) {
                            const result = await saveCollateralSettings(localCollateralSettings);
                            if (result.success) {
                              toast.success('Pengaturan agunan berhasil disimpan');
                            } else {
                              toast.error('Gagal menyimpan pengaturan agunan');
                            }
                          }
                        }}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Simpan Pengaturan Agunan
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Savings Rules Tab */}
        <TabsContent value="savings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Aturan Simpanan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="simpananPokok">Simpanan Pokok (Rp)</Label>
                  <Input
                    id="simpananPokok"
                    type="number"
                    value={settings.simpananPokok}
                    onChange={(e) => updateSettings({ simpananPokok: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="simpananWajib">Simpanan Wajib per Bulan (Rp)</Label>
                  <Input
                    id="simpananWajib"
                    type="number"
                    value={settings.simpananWajib}
                    onChange={(e) => updateSettings({ simpananWajib: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="simpananSukarelaMin">Min. Simpanan Sukarela (Rp)</Label>
                  <Input
                    id="simpananSukarelaMin"
                    type="number"
                    value={settings.simpananSukarelaMin}
                    onChange={(e) => updateSettings({ simpananSukarelaMin: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="simpananWajibDueDate">Batas Bayar Wajib (tanggal)</Label>
                  <Input
                    id="simpananWajibDueDate"
                    type="number"
                    min="1"
                    max="31"
                    value={settings.simpananWajibDueDate}
                    onChange={(e) => updateSettings({ simpananWajibDueDate: parseInt(e.target.value) || 10 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="withdrawalProcessDays">Proses Penarikan</Label>
                  <Input
                    id="withdrawalProcessDays"
                    value={settings.withdrawalProcessDays}
                    onChange={(e) => updateSettings({ withdrawalProcessDays: e.target.value })}
                    placeholder="contoh: 1-3 hari kerja"
                  />
                </div>
              </div>

              {/* Bunga Simpanan Sukarela Section */}
              <div className="border-t border-border pt-6">
                <h4 className="font-medium text-foreground mb-4">Bunga Simpanan Sukarela</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="simpananSukarelaInterestRate">Bunga per Bulan (%)</Label>
                    <Input
                      id="simpananSukarelaInterestRate"
                      type="number"
                      step="0.1"
                      value={settings.simpananSukarelaInterestRate}
                      onChange={(e) => updateSettings({ simpananSukarelaInterestRate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="simpananSukarelaInterestCutoffDate">Batas Tanggal Deposit</Label>
                    <Input
                      id="simpananSukarelaInterestCutoffDate"
                      type="number"
                      min="1"
                      max="31"
                      value={settings.simpananSukarelaInterestCutoffDate}
                      onChange={(e) => updateSettings({ simpananSukarelaInterestCutoffDate: parseInt(e.target.value) || 15 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="simpananSukarelaInterestMethod">Metode Perhitungan Bunga</Label>
                    <Select
                      value={settings.simpananSukarelaInterestMethod || 'opening_plus_eligible'}
                      onValueChange={(value) => updateSettings({ 
                        simpananSukarelaInterestMethod: value as 'opening_plus_eligible' | 'closing_if_eligible' 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="opening_plus_eligible">
                          Saldo Awal + Setoran Eligible
                        </SelectItem>
                        <SelectItem value="closing_if_eligible">
                          Saldo Akhir (jika ada setoran eligible)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {settings.simpananSukarelaInterestMethod === 'closing_if_eligible' 
                        ? 'Bunga = Saldo akhir bulan × Rate (jika ada setoran sebelum tanggal cutoff)'
                        : 'Bunga = (Saldo awal bulan + Setoran sebelum tanggal cutoff) × Rate'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="simpananSukarelaClosingDate">Tanggal Tutup Buku</Label>
                    <Input
                      id="simpananSukarelaClosingDate"
                      type="number"
                      min="1"
                      max="31"
                      value={settings.simpananSukarelaClosingDate || 31}
                      onChange={(e) => updateSettings({ 
                        simpananSukarelaClosingDate: parseInt(e.target.value) || 31 
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Tanggal setiap bulan untuk menghitung dan mencatat bunga simpanan sukarela
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="simpananSukarelaMinHoldingMonths">Minimal Lama Mengendap (Bulan)</Label>
                    <Input
                      id="simpananSukarelaMinHoldingMonths"
                      type="number"
                      min="0"
                      max="24"
                      value={settings.simpananSukarelaMinHoldingMonths || 0}
                      onChange={(e) => updateSettings({ 
                        simpananSukarelaMinHoldingMonths: parseInt(e.target.value) || 0 
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Simpanan sukarela harus mengendap selama minimal {settings.simpananSukarelaMinHoldingMonths || 0} bulan sebelum bisa ditarik. 
                      Masukkan 0 untuk tidak ada batasan.
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Deposit sebelum tanggal {settings.simpananSukarelaInterestCutoffDate} akan mendapat bunga pada tutup buku bulan tersebut. 
                  Deposit setelah tanggal tersebut akan dihitung bulan berikutnya.
                </p>
              </div>
              
              <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
                <h4 className="font-medium text-foreground mb-2">Preview</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Simpanan Pokok: {formatCurrency(settings.simpananPokok)} (dibayar sekali saat pendaftaran)</p>
                  <p>• Simpanan Wajib: {formatCurrency(settings.simpananWajib)}/bulan (maks. tanggal {settings.simpananWajibDueDate})</p>
                  <p>• Simpanan Sukarela: minimal {formatCurrency(settings.simpananSukarelaMin)} per transaksi</p>
                  <p>• Bunga Simpanan Sukarela: {settings.simpananSukarelaInterestRate}% per bulan</p>
                  <p>• Batas deposit untuk bunga bulan aktif: tanggal 1 s/d {settings.simpananSukarelaInterestCutoffDate}</p>
                  <p>• Metode perhitungan: {settings.simpananSukarelaInterestMethod === 'closing_if_eligible' 
                    ? 'Saldo Akhir (jika eligible)' 
                    : 'Saldo Awal + Setoran Eligible'}</p>
                  <p>• Tanggal tutup buku: setiap tanggal {settings.simpananSukarelaClosingDate || 31}</p>
                  <p>• Minimal lama mengendap: {settings.simpananSukarelaMinHoldingMonths || 0} bulan</p>
                  <p>• Penarikan diproses dalam {settings.withdrawalProcessDays}</p>
                </div>
              </div>

              {/* Save with Mode Selection */}
              <div className="mt-4 p-4 rounded-lg bg-info/10 border border-info/30">
                <h4 className="font-medium text-foreground mb-2">Simpan dengan Mode Penerapan</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Klik tombol di bawah untuk menyimpan perubahan bunga simpanan sukarela dengan pilihan mode penerapan.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const oldSettings = getCooperativeSettings();
                    if (settings.simpananSukarelaInterestRate !== oldSettings.simpananSukarelaInterestRate) {
                      handleCriticalSettingSave('simpananSukarelaInterestRate', 'Bunga Simpanan Sukarela', oldSettings.simpananSukarelaInterestRate, settings.simpananSukarelaInterestRate);
                    } else {
                      toast.info('Tidak ada perubahan pada bunga simpanan sukarela');
                    }
                  }}
                >
                  Simpan Bunga Simpanan
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SHU Distribution Tab */}
        <TabsContent value="shu">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                Pengaturan Distribusi SHU
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <h4 className="font-medium text-foreground mb-2">Rumus Distribusi SHU</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Total SHU dibagi berdasarkan persentase berikut sesuai AD/ART:
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="shuAnggota">SHU Anggota (%)</Label>
                  <Input
                    id="shuAnggota"
                    type="number"
                    step="1"
                    value={settings.shuDistribution.shuAnggota}
                    onChange={(e) => updateSettings({
                      shuDistribution: {
                        ...settings.shuDistribution,
                        shuAnggota: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                  <p className="text-xs text-muted-foreground">Bagian untuk seluruh anggota</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shuPengurus">SHU Pengurus (%)</Label>
                  <Input
                    id="shuPengurus"
                    type="number"
                    step="1"
                    value={settings.shuDistribution.shuPengurus}
                    onChange={(e) => updateSettings({
                      shuDistribution: {
                        ...settings.shuDistribution,
                        shuPengurus: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shuPengawas">SHU Pengawas (%)</Label>
                  <Input
                    id="shuPengawas"
                    type="number"
                    step="1"
                    value={settings.shuDistribution.shuPengawas}
                    onChange={(e) => updateSettings({
                      shuDistribution: {
                        ...settings.shuDistribution,
                        shuPengawas: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shuPenasihat">SHU Penasihat (%)</Label>
                  <Input
                    id="shuPenasihat"
                    type="number"
                    step="1"
                    value={settings.shuDistribution.shuPenasihat}
                    onChange={(e) => updateSettings({
                      shuDistribution: {
                        ...settings.shuDistribution,
                        shuPenasihat: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="danaCadangan">Dana Cadangan (%)</Label>
                  <Input
                    id="danaCadangan"
                    type="number"
                    step="1"
                    value={settings.shuDistribution.danaCadangan}
                    onChange={(e) => updateSettings({
                      shuDistribution: {
                        ...settings.shuDistribution,
                        danaCadangan: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>
              </div>

              {/* Sub-distribution for members */}
              <div className="border-t border-border pt-6">
                <h4 className="font-medium text-foreground mb-4">Pembagian SHU Anggota ({settings.shuDistribution.shuAnggota}%)</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  SHU Anggota dibagi lagi menjadi:
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="shuAnggotaSimpanan">SHU Jasa Simpanan (%)</Label>
                    <Input
                      id="shuAnggotaSimpanan"
                      type="number"
                      step="1"
                      value={settings.shuDistribution.shuAnggotaSimpanan}
                      onChange={(e) => updateSettings({
                        shuDistribution: {
                          ...settings.shuDistribution,
                          shuAnggotaSimpanan: parseFloat(e.target.value) || 0
                        }
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Dibagi proporsional berdasarkan (Simpanan Pokok + Wajib) anggota
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shuAnggotaJasaUsaha">SHU Jasa Usaha (%)</Label>
                    <Input
                      id="shuAnggotaJasaUsaha"
                      type="number"
                      step="1"
                      value={settings.shuDistribution.shuAnggotaJasaUsaha}
                      onChange={(e) => updateSettings({
                        shuDistribution: {
                          ...settings.shuDistribution,
                          shuAnggotaJasaUsaha: parseFloat(e.target.value) || 0
                        }
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Dibagi proporsional berdasarkan jasa usaha anggota (pinjaman)
                    </p>
                  </div>
                </div>
              </div>

              {/* Dana Alokasi SHU */}
              <div className="border-t border-border pt-6">
                <h4 className="font-medium text-foreground mb-4">Alokasi Dana SHU</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Dana yang dialokasikan untuk keperluan koperasi:
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="danaPendidikan">Dana Pendidikan (%)</Label>
                    <Input
                      id="danaPendidikan"
                      type="number"
                      step="0.5"
                      value={settings.shuDistribution.danaPendidikan}
                      onChange={(e) => updateSettings({
                        shuDistribution: {
                          ...settings.shuDistribution,
                          danaPendidikan: parseFloat(e.target.value) || 0
                        }
                      })}
                    />
                    <p className="text-xs text-muted-foreground">Pelatihan & pengembangan</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="danaSosial">Dana Sosial (%)</Label>
                    <Input
                      id="danaSosial"
                      type="number"
                      step="0.5"
                      value={settings.shuDistribution.danaSosial}
                      onChange={(e) => updateSettings({
                        shuDistribution: {
                          ...settings.shuDistribution,
                          danaSosial: parseFloat(e.target.value) || 0
                        }
                      })}
                    />
                    <p className="text-xs text-muted-foreground">Kegiatan sosial & bantuan</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="danaPembangunan">Dana Pembangunan (%)</Label>
                    <Input
                      id="danaPembangunan"
                      type="number"
                      step="0.5"
                      value={settings.shuDistribution.danaPembangunan}
                      onChange={(e) => updateSettings({
                        shuDistribution: {
                          ...settings.shuDistribution,
                          danaPembangunan: parseFloat(e.target.value) || 0
                        }
                      })}
                    />
                    <p className="text-xs text-muted-foreground">Pengembangan daerah kerja</p>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
                <h4 className="font-medium text-foreground mb-2">Preview Distribusi</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• SHU Anggota: {settings.shuDistribution.shuAnggota}%</p>
                  <p className="pl-4">- Jasa Simpanan: {settings.shuDistribution.shuAnggotaSimpanan}% dari {settings.shuDistribution.shuAnggota}% = {(settings.shuDistribution.shuAnggota * settings.shuDistribution.shuAnggotaSimpanan / 100).toFixed(1)}% total</p>
                  <p className="pl-4">- Jasa Usaha: {settings.shuDistribution.shuAnggotaJasaUsaha}% dari {settings.shuDistribution.shuAnggota}% = {(settings.shuDistribution.shuAnggota * settings.shuDistribution.shuAnggotaJasaUsaha / 100).toFixed(1)}% total</p>
                  <p>• SHU Pengurus: {settings.shuDistribution.shuPengurus}%</p>
                  <p>• SHU Pengawas: {settings.shuDistribution.shuPengawas}%</p>
                  <p>• SHU Penasihat: {settings.shuDistribution.shuPenasihat}%</p>
                  <p>• Dana Cadangan: {settings.shuDistribution.danaCadangan}%</p>
                  <p>• Dana Pendidikan: {settings.shuDistribution.danaPendidikan}%</p>
                  <p>• Dana Sosial: {settings.shuDistribution.danaSosial}%</p>
                  <p>• Dana Pembangunan: {settings.shuDistribution.danaPembangunan}%</p>
                  <p className="pt-2 font-medium text-foreground">
                    Total: {(settings.shuDistribution.shuAnggota + settings.shuDistribution.shuPengurus + settings.shuDistribution.shuPengawas + settings.shuDistribution.shuPenasihat + settings.shuDistribution.danaCadangan + settings.shuDistribution.danaPendidikan + settings.shuDistribution.danaSosial + settings.shuDistribution.danaPembangunan).toFixed(1)}%
                    {Math.abs((settings.shuDistribution.shuAnggota + settings.shuDistribution.shuPengurus + settings.shuDistribution.shuPengawas + settings.shuDistribution.shuPenasihat + settings.shuDistribution.danaCadangan + settings.shuDistribution.danaPendidikan + settings.shuDistribution.danaSosial + settings.shuDistribution.danaPembangunan) - 100) > 0.1 && 
                      <span className="text-destructive ml-2">(harus 100%)</span>
                    }
                  </p>
                </div>
              </div>

              {/* Formula explanation */}
              <div className="mt-4 p-4 rounded-lg bg-info/10 border border-info/30">
                <h4 className="font-medium text-foreground mb-2">Rumus SHU Jasa Simpanan per Anggota</h4>
                <p className="text-sm text-muted-foreground">
                  SHU Jasa Simpanan = ((Simpanan Pokok + Simpanan Wajib) × {settings.shuDistribution.shuAnggotaSimpanan}% × {settings.shuDistribution.shuAnggota}% × Total SHU) ÷ Total (Simpanan Pokok + Wajib) Seluruh Anggota
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Exited Member SHU Settings */}
          <div className="mt-6">
            <ExitedMemberSHUSettings />
          </div>
        </TabsContent>

        {/* Member Number Format Tab */}
        <TabsContent value="member-number">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-primary" />
                Format Nomor Anggota
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Atur format nomor anggota yang akan digenerate otomatis saat pendaftaran anggota baru.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="memberPrefix">Prefix</Label>
                  <Input
                    id="memberPrefix"
                    value={settings.memberNumberFormat?.prefix || 'MBR'}
                    onChange={(e) => updateSettings({
                      memberNumberFormat: {
                        ...getDefaultMemberNumberFormat(),
                        ...settings.memberNumberFormat,
                        prefix: e.target.value.toUpperCase()
                      }
                    })}
                    placeholder="MBR"
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">Contoh: MBR, ANG, KOP</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="memberSeparator">Pemisah</Label>
                  <Select
                    value={settings.memberNumberFormat?.separator || '-'}
                    onValueChange={(value) => updateSettings({
                      memberNumberFormat: {
                        ...getDefaultMemberNumberFormat(),
                        ...settings.memberNumberFormat,
                        separator: value
                      }
                    })}
                  >
                    <SelectTrigger id="memberSeparator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-">Dash (-)</SelectItem>
                      <SelectItem value="/">Slash (/)</SelectItem>
                      <SelectItem value=".">Dot (.)</SelectItem>
                      <SelectItem value="none">Tanpa pemisah</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="memberDateFormat">Format Tanggal</Label>
                  <Select
                    value={settings.memberNumberFormat?.dateFormat || 'YYYYMMDD'}
                    onValueChange={(value) => updateSettings({
                      memberNumberFormat: {
                        ...getDefaultMemberNumberFormat(),
                        ...settings.memberNumberFormat,
                        dateFormat: value as 'YYYYMMDD' | 'YYYYMM' | 'YYYY' | 'none'
                      }
                    })}
                  >
                    <SelectTrigger id="memberDateFormat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YYYYMMDD">YYYYMMDD (20241230)</SelectItem>
                      <SelectItem value="YYYYMM">YYYYMM (202412)</SelectItem>
                      <SelectItem value="YYYY">YYYY (2024)</SelectItem>
                      <SelectItem value="none">Tanpa tanggal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="memberSequenceLength">Panjang Nomor Urut</Label>
                  <Select
                    value={String(settings.memberNumberFormat?.sequenceLength || 4)}
                    onValueChange={(value) => updateSettings({
                      memberNumberFormat: {
                        ...getDefaultMemberNumberFormat(),
                        ...settings.memberNumberFormat,
                        sequenceLength: parseInt(value)
                      }
                    })}
                  >
                    <SelectTrigger id="memberSequenceLength">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 digit (001)</SelectItem>
                      <SelectItem value="4">4 digit (0001)</SelectItem>
                      <SelectItem value="5">5 digit (00001)</SelectItem>
                      <SelectItem value="6">6 digit (000001)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Auto Reset Option */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="space-y-0.5">
                  <Label className="text-base">Reset Otomatis Tahunan</Label>
                  <p className="text-sm text-muted-foreground">
                    Nomor urut akan reset ke 1 di awal tahun pembukuan baru
                  </p>
                </div>
                <Switch
                  checked={settings.memberNumberFormat?.autoResetYearly || false}
                  onCheckedChange={(checked) => updateSettings({
                    memberNumberFormat: {
                      ...getDefaultMemberNumberFormat(),
                      ...settings.memberNumberFormat,
                      autoResetYearly: checked
                    }
                  })}
                />
              </div>

              {/* Manual Reset */}
              <div className="p-4 rounded-lg border border-warning/30 bg-warning/5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label className="text-base text-warning">Reset Nomor Urut Manual</Label>
                    <p className="text-sm text-muted-foreground">
                      Nomor urut saat ini: <strong>{settings.memberNumberFormat?.currentSequence || 0}</strong>
                      {settings.memberNumberFormat?.lastResetYear && (
                        <span className="ml-2">
                          (terakhir reset: {settings.memberNumberFormat.lastResetYear})
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-warning text-warning hover:bg-warning hover:text-warning-foreground shrink-0"
                    onClick={() => {
                      if (confirm('Apakah Anda yakin ingin mereset nomor urut anggota ke 0? Ini akan mempengaruhi nomor anggota baru.')) {
                        updateSettings({
                          memberNumberFormat: {
                            ...getDefaultMemberNumberFormat(),
                            ...settings.memberNumberFormat,
                            currentSequence: 0,
                            lastResetYear: new Date().getFullYear()
                          }
                        });
                        toast.success('Nomor urut anggota berhasil direset');
                      }
                    }}
                  >
                    Reset Sekarang
                  </Button>
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <h4 className="font-medium text-foreground mb-3">Preview Nomor Anggota</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary" />
                    <code className="text-lg font-mono bg-primary/10 px-3 py-1 rounded">
                      {generateMemberNumber(1)}
                    </code>
                    <span className="text-sm text-muted-foreground">Anggota ke-1</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <code className="text-lg font-mono bg-muted px-3 py-1 rounded">
                      {generateMemberNumber(25)}
                    </code>
                    <span className="text-sm text-muted-foreground">Anggota ke-25</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <code className="text-lg font-mono bg-muted px-3 py-1 rounded">
                      {generateMemberNumber(100)}
                    </code>
                    <span className="text-sm text-muted-foreground">Anggota ke-100</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-info/10 border border-info/30">
                <p className="text-sm text-muted-foreground">
                  <strong>Catatan:</strong> Perubahan format hanya berlaku untuk anggota baru. 
                  Nomor anggota yang sudah ada tidak akan berubah.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AD/ART Tab */}
        <TabsContent value="adart">
          <div className="space-y-6">
            {/* Anggaran Dasar (AD) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Anggaran Dasar (AD)
                  </div>
                  <Button variant="outline" size="sm" onClick={() => addChapter('ad')} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Tambah Bab
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {(settings.adContent?.chapters || []).map((chapter, chapterIndex) => (
                  <div key={chapter.id} className="rounded-lg border border-border p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-semibold">
                        Bab {chapterIndex + 1}
                      </Badge>
                      <Input
                        value={chapter.title}
                        onChange={(e) => updateChapterTitle('ad', chapter.id, e.target.value)}
                        placeholder="Judul Bab"
                        className="flex-1 font-semibold"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeChapter('ad', chapter.id)}
                        className="text-destructive hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="pl-4 border-l-2 border-primary/20 space-y-3">
                      {chapter.articles.map((article, articleIndex) => (
                        <div key={article.id} className="space-y-2 bg-muted/30 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Pasal {articleIndex + 1}
                            </Badge>
                            <Input
                              value={article.title}
                              onChange={(e) => updateArticle('ad', chapter.id, article.id, { title: e.target.value })}
                              placeholder="Judul Pasal"
                              className="flex-1 h-8 text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeArticle('ad', chapter.id, article.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <Textarea
                            value={article.content}
                            onChange={(e) => updateArticle('ad', chapter.id, article.id, { content: e.target.value })}
                            placeholder="Isi pasal..."
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addArticle('ad', chapter.id)}
                        className="gap-1 text-primary hover:text-primary"
                      >
                        <Plus className="h-3 w-3" />
                        Tambah Pasal
                      </Button>
                    </div>
                  </div>
                ))}
                {(settings.adContent?.chapters || []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Belum ada bab. Klik "Tambah Bab" untuk menambahkan.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Anggaran Rumah Tangga (ART) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Anggaran Rumah Tangga (ART)
                  </div>
                  <Button variant="outline" size="sm" onClick={() => addChapter('art')} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Tambah Bab
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {(settings.artContent?.chapters || []).map((chapter, chapterIndex) => (
                  <div key={chapter.id} className="rounded-lg border border-border p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-semibold">
                        Bab {chapterIndex + 1}
                      </Badge>
                      <Input
                        value={chapter.title}
                        onChange={(e) => updateChapterTitle('art', chapter.id, e.target.value)}
                        placeholder="Judul Bab"
                        className="flex-1 font-semibold"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeChapter('art', chapter.id)}
                        className="text-destructive hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="pl-4 border-l-2 border-primary/20 space-y-3">
                      {chapter.articles.map((article, articleIndex) => (
                        <div key={article.id} className="space-y-2 bg-muted/30 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Pasal {articleIndex + 1}
                            </Badge>
                            <Input
                              value={article.title}
                              onChange={(e) => updateArticle('art', chapter.id, article.id, { title: e.target.value })}
                              placeholder="Judul Pasal"
                              className="flex-1 h-8 text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeArticle('art', chapter.id, article.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <Textarea
                            value={article.content}
                            onChange={(e) => updateArticle('art', chapter.id, article.id, { content: e.target.value })}
                            placeholder="Isi pasal..."
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addArticle('art', chapter.id)}
                        className="gap-1 text-primary hover:text-primary"
                      >
                        <Plus className="h-3 w-3" />
                        Tambah Pasal
                      </Button>
                    </div>
                  </div>
                ))}
                {(settings.artContent?.chapters || []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Belum ada bab. Klik "Tambah Bab" untuk menambahkan.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Branch Management Tab */}
        <TabsContent value="branch">
          <BranchManagement />
        </TabsContent>

        {/* Auto Closing Tab */}
        <TabsContent value="auto-closing">
          <AutoClosingSettings />
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Bahasa & Tema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md">
                <ThemeLanguageToggle />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guide Tab */}
        <TabsContent value="guide">
          <AdminGuide />
        </TabsContent>
      </Tabs>
    </div>
  );
};