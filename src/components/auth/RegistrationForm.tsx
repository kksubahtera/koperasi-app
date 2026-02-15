import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, User, CreditCard, Phone, Mail, MapPin, Building, Lock, Eye, EyeOff, CheckCircle2, Calendar, Briefcase, Star, Info, AlertCircle } from 'lucide-react';
import { ThemeLanguageToggle } from '@/components/shared/ThemeLanguageToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { z } from 'zod';
import { CooperativeSettingsService } from '@/lib/database';
import { useBranches } from '@/hooks/useBranches';
import { Badge } from '@/components/ui/badge';

interface RegistrationFormProps {
  onBack: () => void;
  onSubmit: (data: RegistrationData) => Promise<{ success: boolean; message?: string }>;
}

export interface RegistrationData {
  name: string;
  nik: string;
  phone: string;
  email: string;
  address: string;
  bankName: string;
  bankAccount: string;
  password: string;
  birthPlace: string;
  birthDate: string;
  gender: 'male' | 'female' | '';
  occupation: string;
  branchId?: string;
}

const DEFAULT_BANK_OPTIONS = ['BCA', 'Mandiri', 'BRI', 'BNI', 'CIMB', 'OCBC', 'BSI', 'Permata', 'Danamon', 'Maybank'];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
];

const registrationSchema = z.object({
  name: z.string().min(1, 'Nama lengkap wajib diisi'),
  nik: z.string().length(16, 'NIK harus 16 digit'),
  phone: z.string().min(10, 'Nomor HP tidak valid'),
  email: z.string().email('Email tidak valid'),
  address: z.string().min(1, 'Alamat domisili wajib diisi'),
  bankName: z.string().min(1, 'Pilih nama bank'),
  bankAccount: z.string().min(1, 'Nomor rekening wajib diisi'),
  password: z.string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/[A-Z]/, 'Password harus memiliki minimal 1 huruf besar')
    .regex(/[a-z]/, 'Password harus memiliki minimal 1 huruf kecil')
    .regex(/[0-9]/, 'Password harus memiliki minimal 1 angka')
    .regex(/[^A-Za-z0-9]/, 'Password harus memiliki minimal 1 simbol'),
  birthPlace: z.string().min(1, 'Tempat lahir wajib diisi'),
  birthDate: z.string().min(1, 'Tanggal lahir wajib diisi'),
  gender: z.enum(['male', 'female'], { errorMap: () => ({ message: 'Pilih jenis kelamin' }) }),
  occupation: z.string().min(1, 'Pekerjaan wajib diisi'),
});

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    symbol: boolean;
  };
}

const getPasswordStrength = (password: string): PasswordStrength => {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  if (score <= 1) return { score, label: 'Sangat Lemah', color: 'bg-destructive', checks };
  if (score === 2) return { score, label: 'Lemah', color: 'bg-orange-500', checks };
  if (score === 3) return { score, label: 'Sedang', color: 'bg-yellow-500', checks };
  if (score === 4) return { score, label: 'Kuat', color: 'bg-lime-500', checks };
  return { score, label: 'Sangat Kuat', color: 'bg-success', checks };
};

export const RegistrationForm = ({ onBack, onSubmit }: RegistrationFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSettings, setIsCheckingSettings] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [birthDateOpen, setBirthDateOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [availableBanks, setAvailableBanks] = useState<string[]>(DEFAULT_BANK_OPTIONS);
  const [cooperativeBank, setCooperativeBank] = useState<string>('');
  const [errorFields, setErrorFields] = useState<Record<string, string>>({});
  const [missingSettings, setMissingSettings] = useState<string[]>([]);
  const { activeBranches, branchFeatureEnabled, branchTerminology, getBranchById, isLoading: branchesLoading } = useBranches();
  const [formData, setFormData] = useState<RegistrationData>({
    name: '',
    nik: '',
    phone: '',
    email: '',
    address: '',
    bankName: '',
    bankAccount: '',
    password: '',
    birthPlace: '',
    birthDate: '',
    gender: '',
    occupation: '',
    branchId: '',
  });
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  
  const branchTerm = branchTerminology === 'unit' ? 'Unit' : 'Cabang';

  // Update password strength when password changes
  useEffect(() => {
    if (formData.password) {
      setPasswordStrength(getPasswordStrength(formData.password));
    } else {
      setPasswordStrength(null);
    }
  }, [formData.password]);

  const triggerShake = (field: string, message?: string) => {
    setErrorFields(prev => ({ ...prev, [field]: message || '' }));
    
    // Auto-scroll to error field and focus
    const element = document.getElementById(field);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        element.focus();
      }, 300);
    }
    
    setTimeout(() => {
      setErrorFields(prev => {
        const newState = { ...prev };
        delete newState[field];
        return newState;
      });
    }, 3000);
  };

  const clearFieldError = (field: string) => {
    setErrorFields(prev => {
      const newState = { ...prev };
      delete newState[field];
      return newState;
    });
  };

  useEffect(() => {
    fetchBankSettings();
  }, []);

  const fetchBankSettings = async () => {
    setIsCheckingSettings(true);
    try {
      const settings = await CooperativeSettingsService.getMultipleSettings([
        'bank_name',
        'bank_account_number',
        'bank_account_name',
        'simpanan_pokok',
        'simpanan_wajib',
        'available_banks',
      ]);
      
      // Check for missing required settings
      const missing: string[] = [];
      if (!settings['bank_name']) missing.push('Nama Bank Koperasi');
      if (!settings['bank_account_number']) missing.push('Nomor Rekening Koperasi');
      if (!settings['bank_account_name']) missing.push('Nama Pemilik Rekening');
      if (!settings['simpanan_pokok'] || Number(settings['simpanan_pokok']) <= 0) missing.push('Jumlah Simpanan Pokok');
      if (!settings['simpanan_wajib'] || Number(settings['simpanan_wajib']) <= 0) missing.push('Jumlah Simpanan Wajib');
      
      setMissingSettings(missing);
      
      const coopBank = settings['bank_name'] || '';
      const banks = settings['available_banks'];
      const bankList = Array.isArray(banks) ? banks : DEFAULT_BANK_OPTIONS;
      
      setCooperativeBank(coopBank);
      setAvailableBanks(bankList);
      
      // Set default bank to cooperative bank if available
      if (coopBank && bankList.includes(coopBank)) {
        setFormData(prev => ({ ...prev, bankName: coopBank }));
      } else if (bankList.length > 0) {
        setFormData(prev => ({ ...prev, bankName: bankList[0] }));
      }
    } catch (error) {
      console.error('Error fetching bank settings:', error);
      setMissingSettings(['Pengaturan koperasi tidak dapat dimuat']);
    } finally {
      setIsCheckingSettings(false);
    }
  };

  const handleChange = (field: keyof RegistrationData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    clearFieldError(field);
  };

  const handleValidateAndPreview = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate with zod
    const validation = registrationSchema.safeParse(formData);
    if (!validation.success) {
      // Show all errors
      validation.error.errors.forEach(err => {
        const errorPath = err.path[0] as string;
        triggerShake(errorPath, err.message);
      });
      return;
    }

    if (!agreeToTerms) {
      triggerShake('terms', 'Anda harus menyetujui AD/ART');
      return;
    }

    setShowPreview(true);
  };

  const handleConfirmSubmit = async () => {
    setIsLoading(true);
    try {
      const result = await onSubmit(formData);
      if (result.success) {
        toast.success('Pendaftaran berhasil!', {
          description: 'Silakan transfer simpanan awal untuk mengaktifkan akun Anda.',
        });
      } else {
        toast.error(result.message || 'Terjadi kesalahan saat pendaftaran');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getGenderLabel = (value: string) => {
    return GENDER_OPTIONS.find(opt => opt.value === value)?.label || value;
  };

  const getBankLabel = (value: string) => {
    // Hanya tampilkan "(Disarankan)" jika bank koperasi sudah diatur dan cocok
    const isCoopBank = cooperativeBank && value === cooperativeBank;
    return isCoopBank ? `${value} (Sama dengan bank koperasi)` : value;
  };

  // Preview Component
  if (showPreview) {
    return (
      <div className="min-h-screen max-h-screen flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
          <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
            <Button variant="ghost" size="icon" onClick={() => setShowPreview(false)} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Konfirmasi Data</h1>
              <p className="text-sm text-muted-foreground">Periksa data Anda sebelum mendaftar</p>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-lg p-4 pb-8">
          <Card className="animate-fade-in">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 mb-3">
                <CheckCircle2 className="h-8 w-8 text-amber-500" />
              </div>
              <CardTitle className="text-xl">Preview Data Pendaftaran</CardTitle>
              <CardDescription>
                Pastikan semua data sudah benar sebelum melanjutkan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Personal Info Section */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Data Pribadi
                </h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nama Lengkap</span>
                    <span className="font-medium text-foreground">{formData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NIK</span>
                    <span className="font-medium text-foreground">{formData.nik}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tempat/Tgl Lahir</span>
                    <span className="font-medium text-foreground">
                      {formData.birthPlace}, {formData.birthDate ? format(new Date(formData.birthDate), "dd MMM yyyy", { locale: localeId }) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jenis Kelamin</span>
                    <span className="font-medium text-foreground">{getGenderLabel(formData.gender)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pekerjaan</span>
                    <span className="font-medium text-foreground">{formData.occupation}</span>
                  </div>
                  {branchFeatureEnabled && formData.branchId && getBranchById(formData.branchId) && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{branchTerm}</span>
                      <Badge 
                        style={{ backgroundColor: getBranchById(formData.branchId)?.badge_color }}
                        className="text-white text-xs"
                      >
                        {getBranchById(formData.branchId)?.name}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Info Section */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Kontak
                </h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nomor HP</span>
                    <span className="font-medium text-foreground">{formData.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium text-foreground">{formData.email}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-muted-foreground">Alamat</span>
                    <span className="font-medium text-foreground text-right max-w-[200px]">{formData.address}</span>
                  </div>
                </div>
              </div>

              {/* Bank Info Section */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Informasi Bank
                </h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nama Bank</span>
                    <span className="font-medium text-foreground">{getBankLabel(formData.bankName)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nomor Rekening</span>
                    <span className="font-medium text-foreground">{formData.bankAccount}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setShowPreview(false)}
                  disabled={isLoading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Edit Data
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleConfirmSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mendaftar...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Konfirmasi & Daftar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while checking settings
  if (isCheckingSettings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Memeriksa pengaturan koperasi...</p>
        </div>
      </div>
    );
  }

  // Show error if required settings are missing
  if (missingSettings.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Pendaftaran Belum Tersedia</h1>
                <p className="text-sm text-muted-foreground">Pengaturan koperasi belum lengkap</p>
              </div>
            </div>
            <ThemeLanguageToggle variant="minimal" />
          </div>
        </div>

        <div className="mx-auto max-w-lg p-4 pb-8">
          <Card className="animate-fade-in">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mb-3">
                <Info className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">Pendaftaran Belum Tersedia</CardTitle>
              <CardDescription>
                Admin koperasi belum melengkapi pengaturan yang diperlukan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <h3 className="font-semibold text-sm text-foreground mb-2">
                  Pengaturan yang belum diisi:
                </h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {missingSettings.map((setting, index) => (
                    <li key={index}>{setting}</li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Silakan hubungi admin koperasi untuk menyelesaikan pengaturan terlebih dahulu.
              </p>
              <Button onClick={onBack} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke Beranda
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-h-screen flex flex-col relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse-slow" />
      <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      
      {/* Header */}
      <div className="sticky top-0 z-10 shrink-0 relative">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="splash-outline" 
              size="icon" 
              onClick={onBack} 
              className="shrink-0 h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-white">Formulir Pendaftaran</h1>
              <p className="text-sm text-white/70">Isi data diri Anda dengan lengkap</p>
            </div>
          </div>
          <ThemeLanguageToggle variant="splash" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto relative z-10">
        <div className="mx-auto max-w-lg p-4 pb-safe">
          <Card className="animate-fade-in bg-white/95 dark:bg-card/95 backdrop-blur-xl border-white/30 dark:border-border">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-glow mb-3">
              <User className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Daftar Anggota Baru</CardTitle>
            <CardDescription>
              Lengkapi formulir untuk bergabung dengan koperasi
            </CardDescription>
          </CardHeader>
          <CardContent>

            <form onSubmit={handleValidateAndPreview} className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <div className={`input-icon-wrapper ${errorFields['name'] ? 'input-shake' : ''}`}>
                  <User className="input-icon" />
                  <Input
                    id="name"
                    placeholder="Masukkan nama lengkap"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className={`pl-10 sm:pl-11 md:pl-12 ${errorFields['name'] ? 'input-error' : ''}`}
                    disabled={isLoading}
                    autoComplete="name"
                  />
                </div>
                {errorFields['name'] && (
                  <p className="text-sm text-destructive animate-fade-in">{errorFields['name']}</p>
                )}
              </div>

              {/* NIK */}
              <div className="space-y-2">
                <Label htmlFor="nik">NIK (Nomor Induk Kependudukan)</Label>
                <div className={`input-icon-wrapper ${errorFields['nik'] ? 'input-shake' : ''}`}>
                  <CreditCard className="input-icon" />
                  <Input
                    id="nik"
                    placeholder="16 digit NIK"
                    value={formData.nik}
                    onChange={(e) => handleChange('nik', e.target.value.replace(/\D/g, '').slice(0, 16))}
                    className={`pl-10 sm:pl-11 md:pl-12 ${errorFields['nik'] ? 'input-error' : ''}`}
                    disabled={isLoading}
                    maxLength={16}
                  />
                </div>
                {errorFields['nik'] && (
                  <p className="text-sm text-destructive animate-fade-in">{errorFields['nik']}</p>
                )}
              </div>

              {/* Birth Place & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="birthPlace">Tempat Lahir</Label>
                  <div className={`input-icon-wrapper ${errorFields['birthPlace'] ? 'input-shake' : ''}`}>
                    <MapPin className="input-icon" />
                    <Input
                      id="birthPlace"
                      placeholder="Kota kelahiran"
                      value={formData.birthPlace}
                      onChange={(e) => handleChange('birthPlace', e.target.value)}
                      className={`pl-10 sm:pl-11 md:pl-12 ${errorFields['birthPlace'] ? 'input-error' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errorFields['birthPlace'] && (
                    <p className="text-sm text-destructive animate-fade-in">{errorFields['birthPlace']}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Lahir</Label>
                  <div className={errorFields['birthDate'] ? 'input-shake' : ''}>
                    <Popover open={birthDateOpen} onOpenChange={setBirthDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="birthDate"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.birthDate && "text-muted-foreground",
                            errorFields['birthDate'] && "ring-2 ring-destructive/50 border-destructive"
                          )}
                          disabled={isLoading}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {formData.birthDate ? format(new Date(formData.birthDate), "dd MMM yyyy", { locale: localeId }) : "Pilih tanggal"}
                        </Button>
                      </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <div className="p-3">
                        <div className="flex gap-2 mb-3">
                          <Select
                            value={formData.birthDate ? new Date(formData.birthDate).getMonth().toString() : new Date().getMonth().toString()}
                            onValueChange={(month) => {
                              const currentDate = formData.birthDate ? new Date(formData.birthDate) : new Date();
                              const newDate = new Date(currentDate.getFullYear(), parseInt(month), currentDate.getDate());
                              handleChange('birthDate', format(newDate, 'yyyy-MM-dd'));
                            }}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                  {format(new Date(2000, i, 1), "MMMM", { locale: localeId })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={formData.birthDate ? new Date(formData.birthDate).getFullYear().toString() : new Date().getFullYear().toString()}
                            onValueChange={(year) => {
                              const currentDate = formData.birthDate ? new Date(formData.birthDate) : new Date();
                              const newDate = new Date(parseInt(year), currentDate.getMonth(), currentDate.getDate());
                              handleChange('birthDate', format(newDate, 'yyyy-MM-dd'));
                            }}
                          >
                            <SelectTrigger className="w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                              {Array.from({ length: new Date().getFullYear() - 1939 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <CalendarComponent
                          mode="single"
                          month={formData.birthDate ? new Date(formData.birthDate) : undefined}
                          selected={formData.birthDate ? new Date(formData.birthDate) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              handleChange('birthDate', format(date, 'yyyy-MM-dd'));
                              setBirthDateOpen(false);
                            }
                          }}
                          onMonthChange={(date) => {
                            if (formData.birthDate) {
                              const currentDate = new Date(formData.birthDate);
                              const newDate = new Date(date.getFullYear(), date.getMonth(), currentDate.getDate());
                              handleChange('birthDate', format(newDate, 'yyyy-MM-dd'));
                            }
                          }}
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  </div>
                  {errorFields['birthDate'] && (
                    <p className="text-sm text-destructive animate-fade-in">{errorFields['birthDate']}</p>
                  )}
                </div>
              </div>

              {/* Gender & Occupation */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="gender">Jenis Kelamin</Label>
                  <div className={errorFields['gender'] ? 'input-shake' : ''}>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => handleChange('gender', value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger id="gender" className={errorFields['gender'] ? 'input-error' : ''}>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {errorFields['gender'] && (
                    <p className="text-sm text-destructive animate-fade-in">{errorFields['gender']}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occupation">Pekerjaan</Label>
                  <div className={`input-icon-wrapper ${errorFields['occupation'] ? 'input-shake' : ''}`}>
                    <Briefcase className="input-icon" />
                    <Input
                      id="occupation"
                      placeholder="Pekerjaan Anda"
                      value={formData.occupation}
                      onChange={(e) => handleChange('occupation', e.target.value)}
                      className={`pl-10 sm:pl-11 md:pl-12 ${errorFields['occupation'] ? 'input-error' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errorFields['occupation'] && (
                    <p className="text-sm text-destructive animate-fade-in">{errorFields['occupation']}</p>
                  )}
                </div>
              </div>

              {/* Branch/Unit Selection - Only show if feature is enabled */}
              {!branchesLoading && branchFeatureEnabled && activeBranches.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="branchId">{branchTerm}</Label>
                  <Select
                    value={formData.branchId || ''}
                    onValueChange={(value) => handleChange('branchId', value === 'none' ? '' : value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="branchId">
                      <SelectValue placeholder={`Pilih ${branchTerm.toLowerCase()}`}>
                        {formData.branchId && getBranchById(formData.branchId) && (
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: getBranchById(formData.branchId)?.badge_color }}
                            />
                            {getBranchById(formData.branchId)?.name}
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak ada {branchTerm.toLowerCase()}</SelectItem>
                      {activeBranches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: branch.badge_color }}
                            />
                            {branch.name} ({branch.code})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phone">Nomor HP</Label>
                <div className={`input-icon-wrapper ${errorFields['phone'] ? 'input-shake' : ''}`}>
                  <Phone className="input-icon" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="08xxxxxxxxxx"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, ''))}
                    className={`pl-10 sm:pl-11 md:pl-12 ${errorFields['phone'] ? 'input-error' : ''}`}
                    disabled={isLoading}
                    autoComplete="tel"
                  />
                </div>
                {errorFields['phone'] && (
                  <p className="text-sm text-destructive animate-fade-in">{errorFields['phone']}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className={`input-icon-wrapper ${errorFields['email'] ? 'input-shake' : ''}`}>
                  <Mail className="input-icon" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nama@email.com"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className={`pl-10 sm:pl-11 md:pl-12 ${errorFields['email'] ? 'input-error' : ''}`}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                {errorFields['email'] && (
                  <p className="text-sm text-destructive animate-fade-in">{errorFields['email']}</p>
                )}
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Alamat Domisili</Label>
                <div className={`input-icon-wrapper ${errorFields['address'] ? 'input-shake' : ''}`}>
                  <MapPin className="input-icon" />
                  <Input
                    id="address"
                    placeholder="Alamat lengkap tempat tinggal"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className={`pl-10 sm:pl-11 md:pl-12 ${errorFields['address'] ? 'input-error' : ''}`}
                    disabled={isLoading}
                  />
                </div>
                {errorFields['address'] && (
                  <p className="text-sm text-destructive animate-fade-in">{errorFields['address']}</p>
                )}
              </div>

              {/* Bank Selection */}
              <div className="space-y-2">
                <Label htmlFor="bankName">Nama Bank</Label>
                <Select
                  value={formData.bankName}
                  onValueChange={(value) => handleChange('bankName', value)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="bankName">
                    <SelectValue placeholder="Pilih bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBanks.map(bank => (
                      <SelectItem key={bank} value={bank}>
                        <span className="flex items-center gap-2">
                          {bank}
                          {cooperativeBank && bank === cooperativeBank && (
                            <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                              <Star className="h-3 w-3 fill-primary" />
                              Sama dengan bank koperasi
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cooperativeBank && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-primary">
                        Bank Koperasi: {cooperativeBank}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Memilih bank yang sama dengan rekening koperasi dapat menghindari biaya admin transfer antar bank saat pencairan dana simpanan atau SHU.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bank Account */}
              <div className="space-y-2">
                <Label htmlFor="bankAccount">Nomor Rekening</Label>
                <div className={`input-icon-wrapper ${errorFields['bankAccount'] ? 'input-shake' : ''}`}>
                  <Building className="input-icon" />
                  <Input
                    id="bankAccount"
                    placeholder="Nomor rekening bank"
                    value={formData.bankAccount}
                    onChange={(e) => handleChange('bankAccount', e.target.value.replace(/\D/g, ''))}
                    className={`pl-10 sm:pl-11 md:pl-12 ${errorFields['bankAccount'] ? 'input-error' : ''}`}
                    disabled={isLoading}
                    inputMode="numeric"
                  />
                </div>
                {errorFields['bankAccount'] && (
                  <p className="text-sm text-destructive animate-fade-in">{errorFields['bankAccount']}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className={`input-icon-wrapper ${errorFields['password'] ? 'input-shake' : ''}`}>
                  <Lock className="input-icon" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 karakter, huruf besar, angka & simbol"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className={`pl-10 sm:pl-11 md:pl-12 pr-11 ${errorFields['password'] ? 'input-error' : ''}`}
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 hover:bg-muted/50"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errorFields['password'] && (
                  <p className="text-sm text-destructive animate-fade-in">{errorFields['password']}</p>
                )}
                
                {/* Password Strength Indicator */}
                {formData.password && passwordStrength && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        passwordStrength.score <= 2 ? 'text-destructive' : 
                        passwordStrength.score === 3 ? 'text-yellow-600' : 'text-success'
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.length ? 'text-success' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.length ? '✓' : '○'} Min. 8 karakter
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.uppercase ? 'text-success' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.uppercase ? '✓' : '○'} Huruf besar
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.lowercase ? 'text-success' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.lowercase ? '✓' : '○'} Huruf kecil
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.number ? 'text-success' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.number ? '✓' : '○'} Angka
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.symbol ? 'text-success' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.symbol ? '✓' : '○'} Simbol
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* AD/ART Agreement */}
              <div className="space-y-2">
                <div 
                  id="terms"
                  className={`flex items-start gap-3 rounded-lg p-4 transition-all duration-300 ${
                    errorFields['terms'] 
                      ? 'input-shake ring-2 ring-destructive bg-destructive/10 border border-destructive/30' 
                      : 'bg-muted/50'
                  }`}
                >
                  <Checkbox 
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => {
                      setAgreeToTerms(checked === true);
                      clearFieldError('terms');
                    }}
                    className={`mt-0.5 ${errorFields['terms'] ? 'border-destructive' : ''}`}
                    disabled={isLoading}
                  />
                  <div className="text-sm leading-relaxed">
                    Saya menyetujui AD/ART dan bersedia mematuhi seluruh ketentuan yang berlaku
                  </div>
                </div>
                {errorFields['terms'] && (
                  <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errorFields['terms']}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mendaftar...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Daftar Sekarang
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info */}
        <div className="mt-4 rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground space-y-1">
          <p>Setelah mendaftar, Anda akan diarahkan ke halaman pembayaran simpanan awal.</p>
          <p>Kirimkan bukti transfer ke WhatsApp koperasi untuk verifikasi.</p>
          <p>Setelah disetujui admin, Anda dapat login sebagai anggota.</p>
        </div>
        </div>
      </div>

    </div>
  );
};
