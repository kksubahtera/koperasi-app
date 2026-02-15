import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Mail, 
  Calendar,
  Clock,
  Save,
  ArrowLeft,
  Wallet,
  CreditCard,
  Send,
  AlertCircle,
  Loader2,
  Settings,
  Eye,
  Users,
  MailWarning,
  Megaphone,
  History,
  Search,
  CheckCircle2,
  UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { CooperativeSettingsService } from '@/lib/database';
import { supabase } from '@/integrations/supabase/client';

interface NotificationEmailSettingsProps {
  onBack: () => void;
}

interface NotificationSettings {
  emailNotificationsEnabled: boolean;
  installmentReminderEnabled: boolean;
  installmentReminderDaysBefore: number;
  installmentReminderEmailEnabled: boolean;
  savingsReminderEnabled: boolean;
  savingsReminderDayOfMonth: number;
  savingsReminderEmailEnabled: boolean;
  adminNewRegistrationEmailEnabled: boolean;
}

interface InstallmentPreview {
  installmentId: string;
  loanId: string;
  memberName: string;
  memberNumber: string;
  email: string | null;
  installmentNumber: number;
  totalAmount: number;
  dueDate: string;
  daysUntilDue: number;
  status: string;
}

interface InstallmentPreviewData {
  preview: boolean;
  installments: InstallmentPreview[];
  totalCount: number;
  uniqueMembers: number;
  membersWithEmail: number;
  membersWithoutEmail: number;
  daysBefore: number;
  dateRange: { from: string; to: string };
}

interface SavingsMemberPreview {
  userId: string;
  memberName: string;
  memberNumber: string;
  email: string | null;
  currentSimpananWajib: number;
}

interface SavingsPreviewData {
  preview: boolean;
  members: SavingsMemberPreview[];
  totalCount: number;
  membersWithEmail: number;
  membersWithoutEmail: number;
  requiredAmount: number;
  monthName: string;
  alreadyNotifiedCount: number;
}

interface AnnouncementMemberPreview {
  userId: string;
  name: string;
  memberNumber: string;
  email: string | null;
}

interface AnnouncementPreviewData {
  preview: boolean;
  totalMembers: number;
  membersWithEmail: number;
  membersWithoutEmail: number;
  members: AnnouncementMemberPreview[];
}

interface AnnouncementHistory {
  id: string;
  title: string;
  message: string;
  announcement_type: string;
  target_type: string;
  email_sent_count: number;
  notification_sent_count: number;
  created_at: string;
}

const ANNOUNCEMENT_TEMPLATES = [
  { id: 'holiday', label: 'Libur Operasional', title: 'Pemberitahuan Libur Operasional', message: 'Diberitahukan bahwa kantor koperasi akan tutup pada tanggal [TANGGAL] dalam rangka [KETERANGAN]. Operasional akan kembali normal pada tanggal [TANGGAL BUKA].' },
  { id: 'rat', label: 'Pengumuman RAT', title: 'Undangan Rapat Anggota Tahunan (RAT)', message: 'Dengan hormat, kami mengundang Bapak/Ibu untuk menghadiri Rapat Anggota Tahunan (RAT) yang akan dilaksanakan pada:\n\nHari/Tanggal: [TANGGAL]\nWaktu: [WAKTU]\nTempat: [LOKASI]\n\nAgenda:\n1. Laporan Pengurus\n2. Laporan Keuangan\n3. Pembagian SHU\n\nDimohon kehadiran tepat waktu.' },
  { id: 'schedule_change', label: 'Perubahan Jam Kerja', title: 'Pemberitahuan Perubahan Jam Operasional', message: 'Diberitahukan bahwa mulai tanggal [TANGGAL], jam operasional koperasi akan berubah menjadi:\n\nSenin - Jumat: [JAM BUKA] - [JAM TUTUP]\nSabtu: [JAM BUKA] - [JAM TUTUP]\n\nTerima kasih atas pengertiannya.' },
  { id: 'custom', label: 'Tulis Sendiri', title: '', message: '' },
];

const DEFAULT_SETTINGS: NotificationSettings = {
  emailNotificationsEnabled: true,
  installmentReminderEnabled: true,
  installmentReminderDaysBefore: 7,
  installmentReminderEmailEnabled: true,
  savingsReminderEnabled: true,
  savingsReminderDayOfMonth: 1,
  savingsReminderEmailEnabled: true,
  adminNewRegistrationEmailEnabled: true,
};

export const NotificationEmailSettings = ({ onBack }: NotificationEmailSettingsProps) => {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  
  // Installment Preview state
  const [showInstallmentPreview, setShowInstallmentPreview] = useState(false);
  const [installmentPreviewData, setInstallmentPreviewData] = useState<InstallmentPreviewData | null>(null);
  const [isLoadingInstallmentPreview, setIsLoadingInstallmentPreview] = useState(false);
  const [isSendingInstallment, setIsSendingInstallment] = useState(false);

  // Savings Preview state
  const [showSavingsPreview, setShowSavingsPreview] = useState(false);
  const [savingsPreviewData, setSavingsPreviewData] = useState<SavingsPreviewData | null>(null);
  const [isLoadingSavingsPreview, setIsLoadingSavingsPreview] = useState(false);
  const [isSendingSavings, setIsSendingSavings] = useState(false);

  // Announcement state
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [showAnnouncementHistory, setShowAnnouncementHistory] = useState(false);
  const [announcementTemplate, setAnnouncementTemplate] = useState('custom');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementTargetType, setAnnouncementTargetType] = useState<'all_members' | 'selected_members'>('all_members');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [sendAnnouncementEmail, setSendAnnouncementEmail] = useState(true);
  const [showAnnouncementPreview, setShowAnnouncementPreview] = useState(false);
  const [announcementPreviewData, setAnnouncementPreviewData] = useState<AnnouncementPreviewData | null>(null);
  const [isLoadingAnnouncementPreview, setIsLoadingAnnouncementPreview] = useState(false);
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);
  const [announcementHistory, setAnnouncementHistory] = useState<AnnouncementHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [allMembers, setAllMembers] = useState<{ user_id: string; name: string; member_number: string; email: string | null }[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const settingsData = await CooperativeSettingsService.getMultipleSettings([
        'email_notifications_enabled',
        'installment_reminder_enabled',
        'installment_reminder_days_before',
        'installment_reminder_email_enabled',
        'savings_reminder_enabled',
        'savings_reminder_day_of_month',
        'savings_reminder_email_enabled',
        'admin_new_registration_email_enabled',
      ]);

      setSettings({
        emailNotificationsEnabled: settingsData['email_notifications_enabled'] !== false,
        installmentReminderEnabled: settingsData['installment_reminder_enabled'] !== false,
        installmentReminderDaysBefore: Number(settingsData['installment_reminder_days_before']) || 7,
        installmentReminderEmailEnabled: settingsData['installment_reminder_email_enabled'] !== false,
        savingsReminderEnabled: settingsData['savings_reminder_enabled'] !== false,
        savingsReminderDayOfMonth: Number(settingsData['savings_reminder_day_of_month']) || 1,
        savingsReminderEmailEnabled: settingsData['savings_reminder_email_enabled'] !== false,
        adminNewRegistrationEmailEnabled: settingsData['admin_new_registration_email_enabled'] !== false,
      });
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      toast.error('Gagal memuat pengaturan notifikasi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        CooperativeSettingsService.saveSetting('email_notifications_enabled', settings.emailNotificationsEnabled),
        CooperativeSettingsService.saveSetting('installment_reminder_enabled', settings.installmentReminderEnabled),
        CooperativeSettingsService.saveSetting('installment_reminder_days_before', settings.installmentReminderDaysBefore),
        CooperativeSettingsService.saveSetting('installment_reminder_email_enabled', settings.installmentReminderEmailEnabled),
        CooperativeSettingsService.saveSetting('savings_reminder_enabled', settings.savingsReminderEnabled),
        CooperativeSettingsService.saveSetting('savings_reminder_day_of_month', settings.savingsReminderDayOfMonth),
        CooperativeSettingsService.saveSetting('savings_reminder_email_enabled', settings.savingsReminderEmailEnabled),
        CooperativeSettingsService.saveSetting('admin_new_registration_email_enabled', settings.adminNewRegistrationEmailEnabled),
      ]);
      toast.success('Pengaturan notifikasi berhasil disimpan');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Gagal menyimpan pengaturan notifikasi');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewInstallments = async () => {
    setIsLoadingInstallmentPreview(true);
    try {
      const { data, error } = await supabase.functions.invoke('installment-reminder', {
        body: { preview: true }
      });
      if (error) throw error;
      setInstallmentPreviewData(data);
      setShowInstallmentPreview(true);
    } catch (error) {
      console.error('Error loading preview:', error);
      toast.error('Gagal memuat preview angsuran');
    } finally {
      setIsLoadingInstallmentPreview(false);
    }
  };

  const handleSendInstallmentFromPreview = async () => {
    setIsSendingInstallment(true);
    try {
      const { data, error } = await supabase.functions.invoke('installment-reminder');
      if (error) throw error;
      toast.success(`Pengingat angsuran berhasil dikirim: ${data?.count || 0} notifikasi, ${data?.emailsSent || 0} email`);
      setShowInstallmentPreview(false);
      setInstallmentPreviewData(null);
    } catch (error) {
      console.error('Error sending installment reminder:', error);
      toast.error('Gagal mengirim pengingat angsuran');
    } finally {
      setIsSendingInstallment(false);
    }
  };

  const handlePreviewSavings = async () => {
    setIsLoadingSavingsPreview(true);
    try {
      const { data, error } = await supabase.functions.invoke('savings-reminder', {
        body: { preview: true }
      });
      if (error) throw error;
      setSavingsPreviewData(data);
      setShowSavingsPreview(true);
    } catch (error) {
      console.error('Error loading savings preview:', error);
      toast.error('Gagal memuat preview simpanan');
    } finally {
      setIsLoadingSavingsPreview(false);
    }
  };

  const handleSendSavingsFromPreview = async () => {
    setIsSendingSavings(true);
    try {
      const { data, error } = await supabase.functions.invoke('savings-reminder');
      if (error) throw error;
      toast.success(`Pengingat simpanan berhasil dikirim: ${data?.notificationsSent || 0} notifikasi, ${data?.emailsSent || 0} email`);
      setShowSavingsPreview(false);
      setSavingsPreviewData(null);
    } catch (error) {
      console.error('Error sending savings reminder:', error);
      toast.error('Gagal mengirim pengingat simpanan');
    } finally {
      setIsSendingSavings(false);
    }
  };

  // Announcement functions
  const fetchAllMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, member_number, email')
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .order('name');
      if (error) throw error;
      setAllMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Gagal memuat daftar anggota');
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const fetchAnnouncementHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('cooperative_announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setAnnouncementHistory((data || []) as AnnouncementHistory[]);
    } catch (error) {
      console.error('Error fetching announcement history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setAnnouncementTemplate(templateId);
    const template = ANNOUNCEMENT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setAnnouncementTitle(template.title);
      setAnnouncementMessage(template.message);
    }
  };

  const handleOpenAnnouncementDialog = async () => {
    setShowAnnouncementDialog(true);
    await fetchAllMembers();
  };

  const handlePreviewAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      toast.error('Judul dan isi pengumuman harus diisi');
      return;
    }

    setIsLoadingAnnouncementPreview(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-announcement', {
        body: {
          title: announcementTitle,
          message: announcementMessage,
          announcement_type: announcementTemplate,
          target_type: announcementTargetType,
          target_user_ids: announcementTargetType === 'selected_members' ? selectedMemberIds : undefined,
          send_email: sendAnnouncementEmail,
          preview: true
        }
      });
      if (error) throw error;
      setAnnouncementPreviewData(data);
      setShowAnnouncementPreview(true);
    } catch (error) {
      console.error('Error loading announcement preview:', error);
      toast.error('Gagal memuat preview pengumuman');
    } finally {
      setIsLoadingAnnouncementPreview(false);
    }
  };

  const handleSendAnnouncementFromPreview = async () => {
    setIsSendingAnnouncement(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-announcement', {
        body: {
          title: announcementTitle,
          message: announcementMessage,
          announcement_type: announcementTemplate,
          target_type: announcementTargetType,
          target_user_ids: announcementTargetType === 'selected_members' ? selectedMemberIds : undefined,
          send_email: sendAnnouncementEmail,
          preview: false
        }
      });
      if (error) throw error;
      toast.success(`Pengumuman berhasil dikirim: ${data?.notificationsSent || 0} notifikasi, ${data?.emailsSent || 0} email`);
      setShowAnnouncementPreview(false);
      setShowAnnouncementDialog(false);
      resetAnnouncementForm();
    } catch (error) {
      console.error('Error sending announcement:', error);
      toast.error('Gagal mengirim pengumuman');
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  const resetAnnouncementForm = () => {
    setAnnouncementTemplate('custom');
    setAnnouncementTitle('');
    setAnnouncementMessage('');
    setAnnouncementTargetType('all_members');
    setSelectedMemberIds([]);
    setSendAnnouncementEmail(true);
    setAnnouncementPreviewData(null);
  };

  const toggleMemberSelection = (userId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredMembers = allMembers.filter(m => 
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.member_number?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const getUrgencyBadge = (daysUntilDue: number) => {
    if (daysUntilDue <= 0) {
      return <Badge variant="destructive" className="text-xs">Hari Ini</Badge>;
    } else if (daysUntilDue === 1) {
      return <Badge className="bg-orange-500 text-xs">Besok</Badge>;
    } else if (daysUntilDue <= 3) {
      return <Badge className="bg-amber-500 text-xs">{daysUntilDue} hari</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">{daysUntilDue} hari</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pengaturan Notifikasi Email</h1>
            <p className="text-sm text-muted-foreground">Kelola pengingat email otomatis untuk anggota</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan
        </Button>
      </div>

      {/* Master Switch */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Notifikasi Email</CardTitle>
                <CardDescription>Aktifkan fitur pengiriman email otomatis ke anggota</CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.emailNotificationsEnabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, emailNotificationsEnabled: checked }))}
            />
          </div>
        </CardHeader>
        {!settings.emailNotificationsEnabled && (
          <CardContent>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Semua notifikasi email dinonaktifkan. Aktifkan untuk menggunakan fitur pengingat email.</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Announcement Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-3/10">
                <Megaphone className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <CardTitle>Pengumuman Koperasi</CardTitle>
                <CardDescription>Kirim pengumuman ke anggota (libur, RAT, info penting)</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleOpenAnnouncementDialog} className="gap-2">
              <Send className="h-4 w-4" />
              Buat Pengumuman
            </Button>
            <Button 
              variant="outline" 
              onClick={() => { setShowAnnouncementHistory(true); fetchAnnouncementHistory(); }}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              Riwayat Pengumuman
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Admin New Registration Notification Settings */}
      <Card className={!settings.emailNotificationsEnabled ? 'opacity-60 pointer-events-none' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <UserPlus className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Notifikasi Admin - Pendaftaran Baru
                  {settings.adminNewRegistrationEmailEnabled && (
                    <Badge variant="secondary" className="text-xs">Aktif</Badge>
                  )}
                </CardTitle>
                <CardDescription>Kirim email ke admin saat ada user baru yang mendaftar</CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.adminNewRegistrationEmailEnabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, adminNewRegistrationEmailEnabled: checked }))}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {settings.adminNewRegistrationEmailEnabled 
                ? 'Email akan dikirim otomatis ke semua admin aktif saat ada pendaftaran baru'
                : 'Hanya notifikasi in-app yang akan dibuat (tanpa email)'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Installment Reminder Settings */}
      <Card className={!settings.emailNotificationsEnabled ? 'opacity-60 pointer-events-none' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-1/10">
                <CreditCard className="h-5 w-5 text-chart-1" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Pengingat Angsuran Pinjaman
                  {settings.installmentReminderEnabled && settings.installmentReminderEmailEnabled && (
                    <Badge variant="secondary" className="text-xs">Aktif</Badge>
                  )}
                </CardTitle>
                <CardDescription>Kirim pengingat sebelum jatuh tempo angsuran</CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.installmentReminderEnabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, installmentReminderEnabled: checked }))}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kirim Pengingat</Label>
              <Select
                value={String(settings.installmentReminderDaysBefore)}
                onValueChange={(value) => setSettings(prev => ({ ...prev, installmentReminderDaysBefore: Number(value) }))}
                disabled={!settings.installmentReminderEnabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hari sebelum jatuh tempo</SelectItem>
                  <SelectItem value="3">3 hari sebelum jatuh tempo</SelectItem>
                  <SelectItem value="5">5 hari sebelum jatuh tempo</SelectItem>
                  <SelectItem value="7">7 hari sebelum jatuh tempo</SelectItem>
                  <SelectItem value="14">14 hari sebelum jatuh tempo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kirim Email</Label>
              <div className="flex items-center gap-3 h-10 px-3 rounded-md border">
                <Switch
                  checked={settings.installmentReminderEmailEnabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, installmentReminderEmailEnabled: checked }))}
                  disabled={!settings.installmentReminderEnabled}
                />
                <span className="text-sm text-muted-foreground">
                  {settings.installmentReminderEmailEnabled ? 'Email aktif' : 'Hanya notifikasi app'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Pengingat dikirim otomatis setiap hari pada pukul 08:00 WIB</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePreviewInstallments}
              disabled={isLoadingInstallmentPreview || !settings.installmentReminderEnabled}
              className="gap-2"
            >
              {isLoadingInstallmentPreview ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Preview & Kirim
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Savings Reminder Settings */}
      <Card className={!settings.emailNotificationsEnabled ? 'opacity-60 pointer-events-none' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-2/10">
                <Wallet className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Pengingat Simpanan Wajib
                  {settings.savingsReminderEnabled && settings.savingsReminderEmailEnabled && (
                    <Badge variant="secondary" className="text-xs">Aktif</Badge>
                  )}
                </CardTitle>
                <CardDescription>Kirim pengingat bayar simpanan wajib bulanan</CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.savingsReminderEnabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, savingsReminderEnabled: checked }))}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tanggal Pengiriman</Label>
              <Select
                value={String(settings.savingsReminderDayOfMonth)}
                onValueChange={(value) => setSettings(prev => ({ ...prev, savingsReminderDayOfMonth: Number(value) }))}
                disabled={!settings.savingsReminderEnabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Tanggal 1 setiap bulan</SelectItem>
                  <SelectItem value="5">Tanggal 5 setiap bulan</SelectItem>
                  <SelectItem value="10">Tanggal 10 setiap bulan</SelectItem>
                  <SelectItem value="15">Tanggal 15 setiap bulan</SelectItem>
                  <SelectItem value="20">Tanggal 20 setiap bulan</SelectItem>
                  <SelectItem value="25">Tanggal 25 setiap bulan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kirim Email</Label>
              <div className="flex items-center gap-3 h-10 px-3 rounded-md border">
                <Switch
                  checked={settings.savingsReminderEmailEnabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, savingsReminderEmailEnabled: checked }))}
                  disabled={!settings.savingsReminderEnabled}
                />
                <span className="text-sm text-muted-foreground">
                  {settings.savingsReminderEmailEnabled ? 'Email aktif' : 'Hanya notifikasi app'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Pengingat dikirim pada tanggal {settings.savingsReminderDayOfMonth} setiap bulan</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePreviewSavings}
              disabled={isLoadingSavingsPreview || !settings.savingsReminderEnabled}
              className="gap-2"
            >
              {isLoadingSavingsPreview ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Preview & Kirim
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Settings className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Informasi Penting</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Email notifikasi membutuhkan konfigurasi Resend API Key yang sudah aktif</li>
                <li>Pengingat angsuran dikirim otomatis berdasarkan jadwal cron harian</li>
                <li>Pengingat simpanan dikirim pada tanggal yang ditentukan setiap bulan</li>
                <li>Anggota akan menerima notifikasi di aplikasi dan email (jika diaktifkan)</li>
                <li>Pengumuman koperasi langsung terkirim ke semua/pilih anggota</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Installment Preview Dialog */}
      <Dialog open={showInstallmentPreview} onOpenChange={setShowInstallmentPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Preview Pengingat Angsuran
            </DialogTitle>
            <DialogDescription>
              {installmentPreviewData && (
                <span>
                  Periode: {formatDate(installmentPreviewData.dateRange.from)} - {formatDate(installmentPreviewData.dateRange.to)} ({installmentPreviewData.daysBefore} hari ke depan)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {installmentPreviewData && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Anggota</p>
                    <p className="text-lg font-semibold">{installmentPreviewData.uniqueMembers}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <CreditCard className="h-5 w-5 text-chart-1" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Angsuran</p>
                    <p className="text-lg font-semibold">{installmentPreviewData.totalCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-5 w-5 text-chart-2" />
                  <div>
                    <p className="text-sm text-muted-foreground">Punya Email</p>
                    <p className="text-lg font-semibold">{installmentPreviewData.membersWithEmail}</p>
                  </div>
                </div>
              </div>

              {installmentPreviewData.membersWithoutEmail > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
                  <MailWarning className="h-4 w-4 shrink-0" />
                  <span>{installmentPreviewData.membersWithoutEmail} anggota tidak memiliki email (hanya notifikasi app)</span>
                </div>
              )}

              {/* Table */}
              {installmentPreviewData.installments.length > 0 ? (
                <ScrollArea className="flex-1 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No. Anggota</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead className="text-center">Angsuran</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                        <TableHead>Jatuh Tempo</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {installmentPreviewData.installments.map((inst) => (
                        <TableRow key={inst.installmentId}>
                          <TableCell className="font-medium">{inst.memberNumber}</TableCell>
                          <TableCell>
                            <div>
                              <p>{inst.memberName}</p>
                              {inst.email && (
                                <p className="text-xs text-muted-foreground">{inst.email}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">Ke-{inst.installmentNumber}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(inst.totalAmount)}</TableCell>
                          <TableCell>{formatDate(inst.dueDate)}</TableCell>
                          <TableCell className="text-center">{getUrgencyBadge(inst.daysUntilDue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium">Tidak ada angsuran dalam periode ini</p>
                  <p className="text-sm text-muted-foreground">
                    Tidak ada angsuran yang jatuh tempo dalam {installmentPreviewData.daysBefore} hari ke depan
                  </p>
                </div>
              )}
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowInstallmentPreview(false)}>
              Batal
            </Button>
            <Button 
              onClick={handleSendInstallmentFromPreview} 
              disabled={isSendingInstallment || !installmentPreviewData?.installments.length}
              className="gap-2"
            >
              {isSendingInstallment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Kirim {installmentPreviewData?.totalCount || 0} Notifikasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Savings Preview Dialog */}
      <Dialog open={showSavingsPreview} onOpenChange={setShowSavingsPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Preview Pengingat Simpanan Wajib
            </DialogTitle>
            <DialogDescription>
              {savingsPreviewData && (
                <span>Bulan: {savingsPreviewData.monthName} • Simpanan Wajib: {formatCurrency(savingsPreviewData.requiredAmount)}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {savingsPreviewData && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Anggota</p>
                    <p className="text-lg font-semibold">{savingsPreviewData.totalCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-5 w-5 text-chart-2" />
                  <div>
                    <p className="text-sm text-muted-foreground">Punya Email</p>
                    <p className="text-lg font-semibold">{savingsPreviewData.membersWithEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Sudah Dikirim Hari Ini</p>
                    <p className="text-lg font-semibold">{savingsPreviewData.alreadyNotifiedCount}</p>
                  </div>
                </div>
              </div>

              {savingsPreviewData.membersWithoutEmail > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
                  <MailWarning className="h-4 w-4 shrink-0" />
                  <span>{savingsPreviewData.membersWithoutEmail} anggota tidak memiliki email (hanya notifikasi app)</span>
                </div>
              )}

              {/* Table */}
              {savingsPreviewData.members.length > 0 ? (
                <ScrollArea className="flex-1 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No. Anggota</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Simpanan Wajib Saat Ini</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savingsPreviewData.members.map((member) => (
                        <TableRow key={member.userId}>
                          <TableCell className="font-medium">{member.memberNumber}</TableCell>
                          <TableCell>{member.memberName}</TableCell>
                          <TableCell>
                            {member.email ? (
                              <span className="text-sm">{member.email}</span>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Tidak ada</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(member.currentSimpananWajib)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Wallet className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium">Tidak ada anggota yang perlu dikirimi notifikasi</p>
                  <p className="text-sm text-muted-foreground">
                    Semua anggota sudah menerima notifikasi hari ini atau tidak ada anggota aktif
                  </p>
                </div>
              )}
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowSavingsPreview(false)}>
              Batal
            </Button>
            <Button 
              onClick={handleSendSavingsFromPreview} 
              disabled={isSendingSavings || !savingsPreviewData?.members.length}
              className="gap-2"
            >
              {isSendingSavings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Kirim {savingsPreviewData?.totalCount || 0} Notifikasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Announcement Dialog */}
      <Dialog open={showAnnouncementDialog} onOpenChange={(open) => { if (!open) resetAnnouncementForm(); setShowAnnouncementDialog(open); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Buat Pengumuman Koperasi
            </DialogTitle>
            <DialogDescription>
              Kirim pengumuman ke anggota via notifikasi aplikasi dan email
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="space-y-4 py-2 pr-2">
              {/* Template Selection */}
              <div className="space-y-2">
                <Label>Template Pengumuman</Label>
                <Select value={announcementTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANNOUNCEMENT_TEMPLATES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label>Judul Pengumuman</Label>
                <Input 
                  value={announcementTitle} 
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="Masukkan judul pengumuman..."
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label>Isi Pengumuman</Label>
                <Textarea 
                  value={announcementMessage} 
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  placeholder="Masukkan isi pengumuman..."
                  rows={6}
                />
              </div>

              {/* Target Selection */}
              <div className="space-y-2">
                <Label>Target Penerima</Label>
                <Select 
                  value={announcementTargetType} 
                  onValueChange={(v) => { setAnnouncementTargetType(v as 'all_members' | 'selected_members'); setSelectedMemberIds([]); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_members">Semua Anggota Aktif</SelectItem>
                    <SelectItem value="selected_members">Pilih Anggota Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Member Selection (if selected_members) */}
              {announcementTargetType === 'selected_members' && (
                <div className="space-y-2">
                  <Label>Pilih Anggota ({selectedMemberIds.length} dipilih)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Cari nama/no anggota..."
                      className="pl-10"
                    />
                  </div>
                  <div className="h-48 border rounded-lg p-2 overflow-y-auto">
                    {isLoadingMembers ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredMembers.length > 0 ? (
                      <div className="space-y-1">
                        {filteredMembers.map(member => (
                          <div 
                            key={member.user_id}
                            className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/50 ${selectedMemberIds.includes(member.user_id) ? 'bg-primary/10' : ''}`}
                            onClick={() => toggleMemberSelection(member.user_id)}
                          >
                            <Checkbox checked={selectedMemberIds.includes(member.user_id)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{member.name}</p>
                              <p className="text-xs text-muted-foreground">{member.member_number}</p>
                            </div>
                            {member.email && <Mail className="h-3 w-3 text-muted-foreground" />}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                        <Users className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">
                          {memberSearch ? 'Tidak ada anggota ditemukan' : 'Belum ada anggota'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Email Option */}
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Checkbox 
                  id="send-email"
                  checked={sendAnnouncementEmail}
                  onCheckedChange={(checked) => setSendAnnouncementEmail(!!checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="send-email" className="cursor-pointer">Kirim juga via Email</Label>
                  <p className="text-xs text-muted-foreground">Email akan dikirim ke anggota yang memiliki alamat email</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { resetAnnouncementForm(); setShowAnnouncementDialog(false); }}>
              Batal
            </Button>
            <Button 
              onClick={handlePreviewAnnouncement} 
              disabled={isLoadingAnnouncementPreview || !announcementTitle.trim() || !announcementMessage.trim() || (announcementTargetType === 'selected_members' && selectedMemberIds.length === 0)}
              className="gap-2"
            >
              {isLoadingAnnouncementPreview ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Announcement Preview Dialog */}
      <Dialog open={showAnnouncementPreview} onOpenChange={setShowAnnouncementPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Preview Pengumuman
            </DialogTitle>
            <DialogDescription>
              Periksa detail pengumuman sebelum dikirim
            </DialogDescription>
          </DialogHeader>

          {announcementPreviewData && (
            <>
              {/* Announcement Content Preview */}
              <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                <h3 className="font-semibold text-lg">{announcementTitle}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{announcementMessage}</p>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Penerima</p>
                    <p className="text-lg font-semibold">{announcementPreviewData.totalMembers}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-5 w-5 text-chart-2" />
                  <div>
                    <p className="text-sm text-muted-foreground">Punya Email</p>
                    <p className="text-lg font-semibold">{announcementPreviewData.membersWithEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <MailWarning className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tanpa Email</p>
                    <p className="text-lg font-semibold">{announcementPreviewData.membersWithoutEmail}</p>
                  </div>
                </div>
              </div>

              {sendAnnouncementEmail && announcementPreviewData.membersWithoutEmail > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
                  <MailWarning className="h-4 w-4 shrink-0" />
                  <span>{announcementPreviewData.membersWithoutEmail} anggota tidak memiliki email (hanya notifikasi app)</span>
                </div>
              )}

              {/* Member List */}
              <ScrollArea className="flex-1 border rounded-lg max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. Anggota</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {announcementPreviewData.members.map((member) => (
                      <TableRow key={member.userId}>
                        <TableCell className="font-medium">{member.memberNumber}</TableCell>
                        <TableCell>{member.name}</TableCell>
                        <TableCell>
                          {member.email ? (
                            <span className="text-sm">{member.email}</span>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">Tidak ada</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAnnouncementPreview(false)}>
              Kembali
            </Button>
            <Button 
              onClick={handleSendAnnouncementFromPreview} 
              disabled={isSendingAnnouncement}
              className="gap-2"
            >
              {isSendingAnnouncement ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Kirim {announcementPreviewData?.totalMembers || 0} Pengumuman
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Announcement History Dialog */}
      <Dialog open={showAnnouncementHistory} onOpenChange={setShowAnnouncementHistory}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Riwayat Pengumuman
            </DialogTitle>
            <DialogDescription>
              Daftar pengumuman yang pernah dikirim
            </DialogDescription>
          </DialogHeader>

          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : announcementHistory.length > 0 ? (
            <ScrollArea className="flex-1 max-h-[50vh] pr-2">
              <div className="space-y-3 pr-2">
                {announcementHistory.map((item) => (
                  <div key={item.id} className="p-4 rounded-lg border space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{item.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.message}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {ANNOUNCEMENT_TEMPLATES.find(t => t.id === item.announcement_type)?.label || 'Lainnya'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(item.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {item.notification_sent_count} notifikasi
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {item.email_sent_count} email
                      </span>
                      {item.target_type === 'all_members' ? (
                        <Badge variant="outline" className="text-xs">Semua Anggota</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Anggota Terpilih</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium">Belum ada pengumuman</p>
              <p className="text-sm text-muted-foreground">
                Pengumuman yang dikirim akan muncul di sini
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnnouncementHistory(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
