import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
import { 
  User, 
  CreditCard, 
  Phone, 
  Mail, 
  Calendar, 
  Shield, 
  Camera,
  Eye,
  EyeOff,
  Save,
  Settings,
  IdCard,
  Gift,
  TrendingUp,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  UserX,
  Loader2,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatCurrency } from '@/lib/mockData';
import { ThemeLanguageToggle } from '@/components/shared/ThemeLanguageToggle';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { DigitalMemberCard } from './DigitalMemberCard';
import { ResignationForm } from './ResignationForm';
import { MemberGuide } from './MemberGuide';
import { EmailChangeForm } from './EmailChangeForm';
import { getSHUDistributions } from '@/lib/cooperativeSettings';
import { supabase } from '@/integrations/supabase/client';
import { CooperativeSettingsService } from '@/lib/database';

const DEFAULT_BANK_OPTIONS = ['BCA', 'Mandiri', 'BRI', 'BNI', 'CIMB', 'OCBC', 'BSI', 'Permata', 'Danamon', 'Maybank'];

export const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const { t } = useThemeLanguage();
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showMemberCard, setShowMemberCard] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasShownConfetti, setHasShownConfetti] = useState(false);
  const [availableBanks, setAvailableBanks] = useState<string[]>(DEFAULT_BANK_OPTIONS);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    bankName: user?.bankName || '',
    bankAccountNumber: user?.bankAccountNumber || '',
    bankAccountName: user?.bankAccountName || '',
  });

  const [formErrors, setFormErrors] = useState<{
    name?: string;
    phone?: string;
    address?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
  }>({});

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Password strength state
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

  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    label: '',
    color: '',
    checks: {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      symbol: false,
    },
  });

  // Password strength calculation
  const getPasswordStrength = (password: string): PasswordStrength => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/.test(password),
    };

    const score = Object.values(checks).filter(Boolean).length;

    let label = '';
    let color = '';

    if (password.length === 0) {
      label = '';
      color = '';
    } else if (score <= 2) {
      label = t('Lemah', 'Weak');
      color = 'bg-destructive';
    } else if (score <= 3) {
      label = t('Cukup', 'Fair');
      color = 'bg-warning';
    } else if (score === 4) {
      label = t('Kuat', 'Strong');
      color = 'bg-primary';
    } else {
      label = t('Sangat Kuat', 'Very Strong');
      color = 'bg-success';
    }

    return { score, label, color, checks };
  };

  // Update password strength when password changes
  useEffect(() => {
    setPasswordStrength(getPasswordStrength(passwordData.newPassword));
  }, [passwordData.newPassword]);

  // Fetch available banks from cooperative settings
  useEffect(() => {
    const fetchBankSettings = async () => {
      try {
        const banks = await CooperativeSettingsService.getSetting('available_banks');
        if (Array.isArray(banks) && banks.length > 0) {
          setAvailableBanks(banks);
        }
      } catch (error) {
        console.error('Error fetching bank settings:', error);
      }
    };
    fetchBankSettings();
  }, []);

  // Sync form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || '',
        bankName: user.bankName || '',
        bankAccountNumber: user.bankAccountNumber || '',
        bankAccountName: user.bankAccountName || '',
      });
    }
  }, [user]);

  if (!user) return null;

  // Validation functions
  const validateName = (name: string): string | undefined => {
    const trimmed = name.trim();
    if (!trimmed) {
      return t('Nama tidak boleh kosong', 'Name cannot be empty');
    }
    if (trimmed.length < 3) {
      return t('Nama minimal 3 karakter', 'Name must be at least 3 characters');
    }
    if (trimmed.length > 100) {
      return t('Nama maksimal 100 karakter', 'Name must be less than 100 characters');
    }
    if (!/^[a-zA-Z\s.']+$/.test(trimmed)) {
      return t('Nama hanya boleh huruf, spasi, titik, dan apostrof', 'Name can only contain letters, spaces, periods, and apostrophes');
    }
    return undefined;
  };

  const validatePhone = (phone: string): string | undefined => {
    const trimmed = phone.trim();
    if (!trimmed) return undefined; // Optional field
    
    // Remove spaces and dashes for validation
    const cleanPhone = trimmed.replace(/[\s\-]/g, '');
    
    // Check if starts with valid Indonesian prefix
    if (!/^(\+62|62|0)[0-9]+$/.test(cleanPhone)) {
      return t('Format nomor telepon tidak valid (contoh: 08123456789 atau +628123456789)', 'Invalid phone format (example: 08123456789 or +628123456789)');
    }
    
    // Check length (Indonesian numbers are 10-13 digits after prefix)
    if (cleanPhone.startsWith('+62')) {
      if (cleanPhone.length < 12 || cleanPhone.length > 15) {
        return t('Nomor telepon harus 10-13 digit setelah +62', 'Phone number must be 10-13 digits after +62');
      }
    } else if (cleanPhone.startsWith('62')) {
      if (cleanPhone.length < 11 || cleanPhone.length > 14) {
        return t('Nomor telepon harus 10-13 digit setelah 62', 'Phone number must be 10-13 digits after 62');
      }
    } else if (cleanPhone.startsWith('0')) {
      if (cleanPhone.length < 10 || cleanPhone.length > 13) {
        return t('Nomor telepon harus 10-13 digit', 'Phone number must be 10-13 digits');
      }
    }
    
    return undefined;
  };

  const validateBankAccountNumber = (accountNumber: string): string | undefined => {
    const trimmed = accountNumber.trim();
    if (!trimmed) return undefined; // Optional field
    
    // Remove spaces from formatted value before validation
    const cleanedDigits = trimmed.replace(/\s/g, '');
    
    // Bank account numbers should only contain digits
    if (!/^[0-9]+$/.test(cleanedDigits)) {
      return t('Nomor rekening hanya boleh angka', 'Account number can only contain digits');
    }
    
    // Bank account numbers are typically 10-16 digits
    if (cleanedDigits.length < 10 || cleanedDigits.length > 16) {
      return t('Nomor rekening harus 10-16 digit', 'Account number must be 10-16 digits');
    }
    
    return undefined;
  };

  const validateBankAccountName = (accountName: string, bankAccountNumber: string): string | undefined => {
    const trimmed = accountName.trim();
    const trimmedAccountNumber = bankAccountNumber.trim().replace(/\s/g, '');
    
    // If bank account number is filled, account holder name is required
    if (trimmedAccountNumber && !trimmed) {
      return t('Nama pemilik rekening wajib diisi jika nomor rekening diisi', 'Account holder name is required when account number is provided');
    }
    
    if (!trimmed) return undefined; // Optional field
    
    if (trimmed.length < 3) {
      return t('Nama pemilik rekening minimal 3 karakter', 'Account holder name must be at least 3 characters');
    }
    if (trimmed.length > 100) {
      return t('Nama pemilik rekening maksimal 100 karakter', 'Account holder name must be less than 100 characters');
    }
    if (!/^[a-zA-Z\s.']+$/.test(trimmed)) {
      return t('Nama pemilik rekening hanya boleh huruf', 'Account holder name can only contain letters');
    }
    return undefined;
  };

  const validateBankName = (bankName: string, bankAccountNumber: string): string | undefined => {
    const trimmedBankName = bankName.trim();
    const trimmedAccountNumber = bankAccountNumber.trim().replace(/\s/g, '');
    
    // If bank account number is filled, bank name is required
    if (trimmedAccountNumber && !trimmedBankName) {
      return t('Nama bank wajib dipilih jika nomor rekening diisi', 'Bank name is required when account number is provided');
    }
    
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: typeof formErrors = {};
    
    errors.name = validateName(formData.name);
    errors.phone = validatePhone(formData.phone);
    errors.bankName = validateBankName(formData.bankName, formData.bankAccountNumber);
    errors.bankAccountNumber = validateBankAccountNumber(formData.bankAccountNumber);
    errors.bankAccountName = validateBankAccountName(formData.bankAccountName, formData.bankAccountNumber);
    
    setFormErrors(errors);
    
    return !Object.values(errors).some(error => error !== undefined);
  };

  // Get validation status for real-time indicators
  const getFieldStatus = (field: keyof typeof formData): 'valid' | 'invalid' | 'empty' => {
    const value = formData[field]?.trim();
    if (!value) return 'empty';
    
    switch (field) {
      case 'name':
        return validateName(value) ? 'invalid' : 'valid';
      case 'phone':
        return validatePhone(value) ? 'invalid' : 'valid';
      case 'bankAccountNumber':
        return validateBankAccountNumber(value) ? 'invalid' : 'valid';
      case 'bankAccountName':
        return validateBankAccountName(value, formData.bankAccountNumber) ? 'invalid' : 'valid';
      default:
        return 'empty';
    }
  };

  // Get tooltip content for each field
  const getFieldTooltip = (field: keyof typeof formData): { valid: string; hint: string } => {
    switch (field) {
      case 'name':
        return {
          valid: t('Format nama valid', 'Valid name format'),
          hint: t('Min. 3 karakter, hanya huruf', 'Min. 3 characters, letters only')
        };
      case 'phone':
        return {
          valid: t('Nomor telepon valid', 'Valid phone number'),
          hint: t('Format: 0812-3456-7890 atau +62 812-3456-7890', 'Format: 0812-3456-7890 or +62 812-3456-7890')
        };
      case 'bankAccountNumber':
        return {
          valid: t('Nomor rekening valid', 'Valid account number'),
          hint: t('10-16 digit angka', '10-16 digits')
        };
      case 'bankAccountName':
        return {
          valid: t('Nama pemilik rekening valid', 'Valid account holder name'),
          hint: t('Min. 3 karakter, hanya huruf', 'Min. 3 characters, letters only')
        };
      default:
        return { valid: '', hint: '' };
    }
  };

  // Validation indicator component with smooth animations and tooltips
  const ValidationIndicator = ({ field }: { field: keyof typeof formData }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const status = getFieldStatus(field);
    const hasError = formErrors[field];
    const tooltip = getFieldTooltip(field);
    
    if (!isEditing) return null;

    const handleInteraction = () => {
      setShowTooltip(prev => !prev);
      // Auto-hide tooltip after 3 seconds on mobile
      setTimeout(() => setShowTooltip(false), 3000);
    };
    
    // Show valid indicator
    if (status === 'valid') {
      return (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
          <div 
            className="animate-validation-success cursor-pointer relative group"
            onClick={handleInteraction}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <CheckCircle2 className="h-4 w-4 text-success drop-shadow-sm" />
            
            {/* Tooltip */}
            <div className={`
              absolute right-0 top-full mt-2 z-50
              px-3 py-2 rounded-lg shadow-lg
              bg-success text-success-foreground text-xs font-medium
              whitespace-nowrap
              transition-all duration-200 origin-top-right
              ${showTooltip ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}
            `}>
              <div className="absolute -top-1 right-1.5 w-2 h-2 bg-success rotate-45" />
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                {tooltip.valid}
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Show error indicator only when there's an error
    if (status === 'invalid' && hasError) {
      return (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
          <div 
            className="animate-validation-error cursor-pointer relative group"
            onClick={handleInteraction}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <AlertCircle className="h-4 w-4 text-destructive drop-shadow-sm" />
            
            {/* Tooltip */}
            <div className={`
              absolute right-0 top-full mt-2 z-50
              px-3 py-2 rounded-lg shadow-lg
              bg-destructive text-destructive-foreground text-xs font-medium
              whitespace-nowrap
              transition-all duration-200 origin-top-right
              ${showTooltip ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}
            `}>
              <div className="absolute -top-1 right-1.5 w-2 h-2 bg-destructive rotate-45" />
              <div className="flex flex-col gap-0.5">
                <span>{hasError}</span>
                <span className="opacity-75">{tooltip.hint}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Show hint for empty optional fields when editing
    if (status === 'empty' && field !== 'name') {
      return (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
          <div 
            className="cursor-pointer relative group opacity-50 hover:opacity-100 transition-opacity"
            onClick={handleInteraction}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            
            {/* Tooltip */}
            <div className={`
              absolute right-0 top-full mt-2 z-50
              px-3 py-2 rounded-lg shadow-lg
              bg-muted text-muted-foreground text-xs font-medium
              whitespace-nowrap
              transition-all duration-200 origin-top-right
              ${showTooltip ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}
            `}>
              <div className="absolute -top-1 right-1.5 w-2 h-2 bg-muted rotate-45" />
              {tooltip.hint}
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Calculate profile completion percentage
  const getProfileCompletion = () => {
    const fields = [
      { key: 'name', label: t('Nama Lengkap', 'Full Name'), required: true },
      { key: 'phone', label: t('Nomor HP', 'Phone Number'), required: false },
      { key: 'bankAccountNumber', label: t('Nomor Rekening', 'Account Number'), required: false },
      { key: 'bankAccountName', label: t('Nama Pemilik Rekening', 'Account Holder Name'), required: false },
    ] as const;

    // Also check user data that's not editable
    const additionalFields = [
      { filled: !!user?.nik, label: 'NIK' },
      { filled: !!user?.email, label: 'Email' },
      { filled: !!user?.memberNumber, label: t('Nomor Anggota', 'Member Number') },
      { filled: !!user?.profilePhoto, label: t('Foto Profil', 'Profile Photo') },
    ];

    let filledCount = 0;
    let totalCount = fields.length + additionalFields.length;
    const missingFields: string[] = [];

    // Check editable fields
    fields.forEach(field => {
      const status = getFieldStatus(field.key);
      if (status === 'valid') {
        filledCount++;
      } else {
        missingFields.push(field.label);
      }
    });

    // Check additional fields
    additionalFields.forEach(field => {
      if (field.filled) {
        filledCount++;
      } else {
        missingFields.push(field.label);
      }
    });

    const percentage = Math.round((filledCount / totalCount) * 100);
    
    return { percentage, filledCount, totalCount, missingFields };
  };

  const profileCompletion = getProfileCompletion();

  // Trigger confetti when profile is complete
  useEffect(() => {
    if (profileCompletion.percentage >= 100 && !hasShownConfetti) {
      setShowConfetti(true);
      setHasShownConfetti(true);
      // Hide confetti after animation
      setTimeout(() => setShowConfetti(false), 4000);
    }
  }, [profileCompletion.percentage, hasShownConfetti]);

  // Confetti component
  const ConfettiEffect = () => {
    if (!showConfetti) return null;

    const confettiColors = [
      'bg-success',
      'bg-primary', 
      'bg-warning',
      'bg-accent',
      'bg-chart-5',
    ];

    const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
    }));

    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {confettiPieces.map((piece) => (
          <div
            key={piece.id}
            className={`absolute ${piece.color} rounded-sm animate-confetti-fall`}
            style={{
              left: `${piece.left}%`,
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              transform: `rotate(${piece.rotation}deg)`,
            }}
          />
        ))}
        {/* Celebration burst in center */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-celebration-burst">
          <div className="relative">
            <div className="absolute inset-0 bg-success/20 rounded-full blur-3xl animate-pulse scale-150" />
            <div className="bg-card shadow-2xl rounded-2xl p-6 border border-success/30">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <p className="text-lg font-bold text-foreground">
                  {t('Selamat!', 'Congratulations!')}
                </p>
                <p className="text-sm text-muted-foreground text-center">
                  {t('Profil Anda sudah lengkap 100%', 'Your profile is 100% complete')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Profile completion indicator component
  const ProfileCompletionIndicator = () => {
    const { percentage, filledCount, totalCount, missingFields } = profileCompletion;
    
    const getProgressColor = () => {
      if (percentage >= 100) return 'bg-success';
      if (percentage >= 75) return 'bg-primary';
      if (percentage >= 50) return 'bg-warning';
      return 'bg-destructive';
    };

    const getProgressBgColor = () => {
      if (percentage >= 100) return 'bg-success/20';
      if (percentage >= 75) return 'bg-primary/20';
      if (percentage >= 50) return 'bg-warning/20';
      return 'bg-destructive/20';
    };

    const getTextColor = () => {
      if (percentage >= 100) return 'text-success';
      if (percentage >= 75) return 'text-primary';
      if (percentage >= 50) return 'text-warning';
      return 'text-destructive';
    };

    return (
      <Card className={`overflow-hidden relative ${percentage >= 100 ? 'ring-2 ring-success/50' : ''}`}>
        {percentage >= 100 && (
          <div className="absolute inset-0 bg-gradient-to-r from-success/5 via-success/10 to-success/5 animate-pulse" />
        )}
        <CardContent className="p-3 sm:p-4 relative">
          {/* Mobile Layout: Compact */}
          <div className="sm:hidden">
            <div className="flex items-center gap-2 mb-2">
              <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${getProgressBgColor()} ${percentage >= 100 ? 'animate-bounce' : ''}`}>
                {percentage >= 100 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : (
                  <User className={`h-3.5 w-3.5 ${getTextColor()}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground truncate">
                    {t('Kelengkapan Profil', 'Profile Completion')}
                  </p>
                  <span className={`text-sm font-bold flex-shrink-0 ${getTextColor()}`}>
                    {percentage}%
                  </span>
                </div>
              </div>
            </div>
            
            {/* Compact Progress bar */}
            <div className={`h-1.5 w-full rounded-full ${getProgressBgColor()} overflow-hidden`}>
              <div 
                className={`h-full rounded-full ${getProgressColor()} transition-all duration-500 ease-out ${percentage >= 100 ? 'animate-pulse' : ''}`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Compact hints */}
            {percentage >= 100 ? (
              <p className="mt-1.5 text-[10px] text-success font-medium flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {t('Profil lengkap!', 'Complete!')}
              </p>
            ) : missingFields.length > 0 && (
              <p className="mt-1.5 text-[10px] text-muted-foreground truncate">
                {t('Lengkapi', 'Complete')}: {missingFields.slice(0, 2).join(', ')}
                {missingFields.length > 2 && ` +${missingFields.length - 2}`}
              </p>
            )}
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:block">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getProgressBgColor()} ${percentage >= 100 ? 'animate-bounce' : ''}`}>
                  {percentage >= 100 ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <User className={`h-4 w-4 ${getTextColor()}`} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('Kelengkapan Profil', 'Profile Completion')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {filledCount} / {totalCount} {t('field terisi', 'fields completed')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-bold ${getTextColor()}`}>
                  {percentage}%
                </span>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className={`h-2 w-full rounded-full ${getProgressBgColor()} overflow-hidden`}>
              <div 
                className={`h-full rounded-full ${getProgressColor()} transition-all duration-500 ease-out ${percentage >= 100 ? 'animate-pulse' : ''}`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Missing fields hint */}
            {missingFields.length > 0 && missingFields.length <= 3 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('Lengkapi', 'Complete')}: {missingFields.slice(0, 3).join(', ')}
                {missingFields.length > 3 && ` +${missingFields.length - 3} ${t('lainnya', 'more')}`}
              </p>
            )}

            {percentage >= 100 && (
              <p className="mt-2 text-xs text-success font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {t('Profil Anda sudah lengkap!', 'Your profile is complete!')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters except +
    let cleaned = value.replace(/[^\d+]/g, '');
    
    // Handle +62 prefix
    if (cleaned.startsWith('+62')) {
      const digits = cleaned.slice(3);
      if (digits.length <= 3) {
        return '+62 ' + digits;
      } else if (digits.length <= 7) {
        return '+62 ' + digits.slice(0, 3) + '-' + digits.slice(3);
      } else {
        return '+62 ' + digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7, 11);
      }
    }
    
    // Handle 62 prefix (without +)
    if (cleaned.startsWith('62') && cleaned.length > 2) {
      const digits = cleaned.slice(2);
      if (digits.length <= 3) {
        return '62 ' + digits;
      } else if (digits.length <= 7) {
        return '62 ' + digits.slice(0, 3) + '-' + digits.slice(3);
      } else {
        return '62 ' + digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7, 11);
      }
    }
    
    // Handle 0 prefix (local format: 0812-3456-7890)
    if (cleaned.startsWith('0')) {
      if (cleaned.length <= 4) {
        return cleaned;
      } else if (cleaned.length <= 8) {
        return cleaned.slice(0, 4) + '-' + cleaned.slice(4);
      } else {
        return cleaned.slice(0, 4) + '-' + cleaned.slice(4, 8) + '-' + cleaned.slice(8, 12);
      }
    }
    
    // If no recognized prefix, just return cleaned value
    return cleaned;
  };

  // Auto-format bank account number (4-digit groups: 1234 5678 90)
  const formatBankAccountNumber = (value: string): string => {
    // Remove all non-digit characters
    const cleaned = value.replace(/\D/g, '');
    
    // Split into groups of 4 digits
    const groups: string[] = [];
    for (let i = 0; i < cleaned.length; i += 4) {
      groups.push(cleaned.slice(i, i + 4));
    }
    
    return groups.join(' ');
  };

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    let processedValue = value;
    
    // Apply auto-format for phone field
    if (field === 'phone') {
      processedValue = formatPhoneNumber(value);
    }
    
    // Apply auto-format for bank account number
    if (field === 'bankAccountNumber') {
      processedValue = formatBankAccountNumber(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: processedValue }));
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleProfileUpdate = async () => {
    // Validate form before saving
    if (!validateForm()) {
      toast.error(t('Mohon perbaiki kesalahan pada form', 'Please fix the form errors'));
      return;
    }

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('Sesi tidak valid', 'Invalid session'));
        return;
      }

      // Clean phone and bank account number before saving (remove formatting)
      const cleanPhone = formData.phone.trim().replace(/[\s\-]/g, '');
      const cleanBankAccount = formData.bankAccountNumber.trim().replace(/\s/g, '');
      
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name.trim(),
          phone: cleanPhone,
          address: formData.address.trim(),
          bank_name: formData.bankName.trim(),
          bank_account_number: cleanBankAccount,
          bank_account_name: formData.bankAccountName.trim(),
        })
        .eq('user_id', session.user.id);

      if (error) {
        console.error('Profile update error:', error);
        toast.error(t('Gagal menyimpan profil', 'Failed to save profile'));
        return;
      }

      if (refreshUser) {
        await refreshUser();
      }

      toast.success(t('Profil berhasil diperbarui', 'Profile updated successfully'));
      setIsEditing(false);
      setFormErrors({});
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(t('Terjadi kesalahan', 'An error occurred'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    // Validate current password is provided
    if (!passwordData.currentPassword.trim()) {
      toast.error(t('Masukkan password saat ini', 'Please enter current password'));
      return;
    }

    // Validate password strength
    const { checks } = passwordStrength;
    
    if (!checks.length) {
      toast.error(t('Password minimal 8 karakter', 'Password must be at least 8 characters'));
      return;
    }
    if (!checks.uppercase) {
      toast.error(t('Password harus mengandung huruf besar', 'Password must contain uppercase letter'));
      return;
    }
    if (!checks.lowercase) {
      toast.error(t('Password harus mengandung huruf kecil', 'Password must contain lowercase letter'));
      return;
    }
    if (!checks.number) {
      toast.error(t('Password harus mengandung angka', 'Password must contain number'));
      return;
    }
    if (!checks.symbol) {
      toast.error(t('Password harus mengandung simbol', 'Password must contain symbol'));
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(t('Password baru tidak cocok', 'New password does not match'));
      return;
    }

    setIsChangingPassword(true);
    try {
      // Verify current password first by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: passwordData.currentPassword,
      });

      if (signInError) {
        // Log failed attempt
        await supabase.from('password_change_logs').insert({
          user_id: user?.id,
          status: 'failed',
          failure_reason: 'Invalid current password',
          user_agent: navigator.userAgent,
        });
        toast.error(t('Password saat ini salah', 'Current password is incorrect'));
        return;
      }

      // Current password verified, now update to new password
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) {
        console.error('Password change error:', error);
        // Log failed attempt
        await supabase.from('password_change_logs').insert({
          user_id: user?.id,
          status: 'failed',
          failure_reason: error.message,
          user_agent: navigator.userAgent,
        });
        toast.error(t('Gagal mengubah password', 'Failed to change password'));
        return;
      }

      // Log successful password change
      await supabase.from('password_change_logs').insert({
        user_id: user?.id,
        status: 'success',
        user_agent: navigator.userAgent,
      });

      // Send email notification via edge function
      try {
        await supabase.functions.invoke('send-password-notification', {
          body: {
            user_id: user?.id,
            notification_type: 'password_changed'
          }
        });
        console.log('Password change notification email sent');
      } catch (emailError) {
        console.error('Failed to send password notification email:', emailError);
        // Don't show error to user - password change was still successful
      }

      toast.success(t('Password berhasil diubah', 'Password changed successfully'));
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Password change error:', error);
      toast.error(t('Terjadi kesalahan', 'An error occurred'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('Hanya file gambar yang diperbolehkan', 'Only image files are allowed'));
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('Ukuran file maksimal 2MB', 'Maximum file size is 2MB'));
      return;
    }

    setIsUploadingPhoto(true);

    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('Sesi tidak valid', 'Invalid session'));
        return;
      }

      const userId = session.user.id;
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      // Use timestamp to avoid cache issues and ensure unique filename
      const timestamp = Date.now();
      const fileName = `${userId}/profile_${timestamp}.${fileExt}`;

      // List and delete all old photos for this user
      const { data: existingFiles } = await supabase.storage
        .from('profile-photos')
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        const filesToRemove = existingFiles.map(f => `${userId}/${f.name}`);
        await supabase.storage
          .from('profile-photos')
          .remove(filesToRemove);
      }

      // Upload new photo
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type 
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error(t('Gagal mengupload foto', 'Failed to upload photo'));
        return;
      }

      // Verify upload was successful
      if (!uploadData?.path) {
        console.error('Upload succeeded but no path returned');
        toast.error(t('Gagal mengupload foto', 'Failed to upload photo'));
        return;
      }

      // Get public URL with cache-busting query param
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);
      
      const publicUrlWithCacheBust = `${publicUrl}?t=${timestamp}`;

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_photo: publicUrlWithCacheBust })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Profile update error:', updateError);
        toast.error(t('Gagal menyimpan foto profil', 'Failed to save profile photo'));
        return;
      }

      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      }

      toast.success(t('Foto profil berhasil diperbarui', 'Profile photo updated successfully'));
    } catch (error) {
      console.error('Photo upload error:', error);
      toast.error(t('Terjadi kesalahan', 'An error occurred'));
    } finally {
      setIsUploadingPhoto(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Get SHU distributions for member
  const getSHUForMember = () => {
    const distributions = getSHUDistributions();
    const confirmedDistributions = distributions.filter(d => d.status === 'confirmed');
    
    return confirmedDistributions.map(dist => {
      const memberDist = dist.memberDistributions.find(m => m.memberId === user.id);
      const roleDist = dist.roleDistributions.find(r => r.isMember && r.assignmentId === user.id);
      
      return {
        year: dist.year,
        simpananShare: memberDist?.simpananShare || 0,
        jasaUsahaShare: memberDist?.jasaUsahaShare || 0,
        roleShare: roleDist?.amount || 0,
        roleName: roleDist?.role || null,
        totalShare: (memberDist?.totalShare || 0) + (roleDist?.amount || 0),
        confirmedAt: dist.confirmedAt,
      };
    });
  };

  const memberSHU = getSHUForMember();
  const totalSHUReceived = memberSHU.reduce((sum, s) => sum + s.totalShare, 0);
  // Use only real database data, no mock fallback
  const combinedTotalSHU = totalSHUReceived;

  return (
    <>
      {/* Confetti celebration effect */}
      <ConfettiEffect />
      
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('Profil Saya', 'My Profile')}</h1>
        <p className="mt-1 text-muted-foreground">{t('Kelola informasi akun Anda', 'Manage your account information')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Button Group Navigation */}
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="inline-flex w-auto gap-1 bg-muted/50 p-1.5 rounded-xl border border-border/50">
            <Button
              variant={activeTab === 'profile' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('profile')}
              className={`
                relative h-auto font-medium transition-all duration-200 rounded-lg px-3 py-2 text-sm gap-2
                ${activeTab === 'profile' 
                  ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20' 
                  : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{t('Profil', 'Profile')}</span>
            </Button>

            <Button
              variant={activeTab === 'shu' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('shu')}
              className={`
                relative h-auto font-medium transition-all duration-200 rounded-lg px-3 py-2 text-sm gap-2
                ${activeTab === 'shu' 
                  ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20' 
                  : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
            >
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">SHU</span>
            </Button>

            <Button
              variant={activeTab === 'security' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('security')}
              className={`
                relative h-auto font-medium transition-all duration-200 rounded-lg px-3 py-2 text-sm gap-2
                ${activeTab === 'security' 
                  ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20' 
                  : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">{t('Keamanan', 'Security')}</span>
            </Button>

            <Button
              variant={activeTab === 'preferences' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('preferences')}
              className={`
                relative h-auto font-medium transition-all duration-200 rounded-lg px-3 py-2 text-sm gap-2
                ${activeTab === 'preferences' 
                  ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20' 
                  : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">{t('Preferensi', 'Preferences')}</span>
            </Button>

            <Button
              variant={activeTab === 'resign' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('resign')}
              className={`
                relative h-auto font-medium transition-all duration-200 rounded-lg px-3 py-2 text-sm gap-2
                ${activeTab === 'resign' 
                  ? 'bg-destructive text-destructive-foreground shadow-md ring-2 ring-destructive/20' 
                  : 'bg-transparent text-destructive/70 hover:bg-destructive/10 hover:text-destructive'
                }
              `}
            >
              <UserX className="h-4 w-4" />
              <span className="hidden sm:inline">{t('Non-Aktif', 'Inactive')}</span>
            </Button>

            <Button
              variant={activeTab === 'guide' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('guide')}
              className={`
                relative h-auto font-medium transition-all duration-200 rounded-lg px-3 py-2 text-sm gap-2
                ${activeTab === 'guide' 
                  ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20' 
                  : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">{t('Panduan', 'Guide')}</span>
            </Button>
          </div>
        </div>

        <TabsContent value="profile" className="space-y-6">
          {/* Profile Completion Indicator */}
          <ProfileCompletionIndicator />

          {/* Profile Photo Card */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              {/* Mobile Layout: Stacked */}
              <div className="flex flex-col gap-4 sm:hidden">
                {/* Avatar + Info Row */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-16 w-16 border-2 border-primary/20">
                      <AvatarImage src={user.profilePhoto} alt={user.name} />
                      <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      onClick={triggerFileInput}
                      disabled={isUploadingPhoto}
                      className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110 disabled:opacity-50"
                    >
                      {isUploadingPhoto ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Camera className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-foreground truncate">{user.name}</h2>
                    <p className="text-xs text-muted-foreground">{user.memberNumber}</p>
                    <Badge variant={user.isActive ? 'success' : 'destructive'} className="mt-1.5 text-xs">
                      {user.isActive ? t('Aktif', 'Active') : t('Tidak Aktif', 'Inactive')}
                    </Badge>
                  </div>
                </div>
                {/* Member Card Button - Full Width on Mobile */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowMemberCard(true)}
                  className="w-full gap-2"
                >
                  <IdCard className="h-4 w-4" />
                  {t('Cetak Kartu Anggota', 'Print Member Card')}
                </Button>
              </div>

              {/* Desktop Layout: Horizontal */}
              <div className="hidden sm:flex sm:flex-row sm:items-center sm:gap-4">
                <div className="relative flex-shrink-0">
                  <Avatar className="h-24 w-24 border-4 border-primary/20">
                    <AvatarImage src={user.profilePhoto} alt={user.name} />
                    <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={triggerFileInput}
                    disabled={isUploadingPhoto}
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 disabled:opacity-50"
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-foreground">{user.name}</h2>
                  <p className="text-sm text-muted-foreground">{user.memberNumber}</p>
                  <Badge variant={user.isActive ? 'success' : 'destructive'} className="mt-2">
                    {user.isActive ? t('Aktif', 'Active') : t('Tidak Aktif', 'Inactive')}
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowMemberCard(true)}
                  className="gap-2 flex-shrink-0"
                >
                  <IdCard className="h-4 w-4" />
                  {t('Kartu Anggota', 'Member Card')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Digital Member Card Dialog */}
          <DigitalMemberCard 
            open={showMemberCard} 
            onClose={() => setShowMemberCard(false)} 
          />

          {/* Section Separator - Personal Info */}
          <div className="relative">
            <Separator className="my-2" />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-background px-2 text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {t('Informasi Pribadi', 'Personal Info')}
            </span>
          </div>

          {/* Personal Information */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6 pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                {t('Data Pribadi', 'Personal Information')}
              </CardTitle>
              <Button 
                variant={isEditing ? 'default' : 'outline'} 
                size="sm"
                onClick={() => {
                  if (isEditing) {
                    // Validate form before showing confirmation
                    if (!validateForm()) {
                      toast.error(t('Mohon perbaiki kesalahan pada form', 'Please fix the form errors'));
                      return;
                    }
                    setShowSaveConfirmation(true);
                  } else {
                    setIsEditing(true);
                  }
                }}
                disabled={isSaving}
                className="h-8 text-xs sm:text-sm"
              >
                {isEditing ? (
                  isSaving ? (
                    <>
                      <Loader2 className="mr-1.5 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4 animate-spin" />
                      <span className="hidden sm:inline">{t('Menyimpan...', 'Saving...')}</span>
                      <span className="sm:hidden">{t('...', '...')}</span>
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                      {t('Simpan', 'Save')}
                    </>
                  )
                ) : (
                  t('Edit', 'Edit')
                )}
              </Button>

              {/* Save Confirmation Dialog */}
              <AlertDialog open={showSaveConfirmation} onOpenChange={setShowSaveConfirmation}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('Konfirmasi Simpan', 'Confirm Save')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t(
                        'Apakah Anda yakin ingin menyimpan perubahan profil ini?',
                        'Are you sure you want to save these profile changes?'
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {t('Batal', 'Cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setShowSaveConfirmation(false);
                        handleProfileUpdate();
                      }}
                    >
                      {t('Ya, Simpan', 'Yes, Save')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3 sm:space-y-4">
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="name" className="text-xs sm:text-sm">{t('Nama Lengkap', 'Full Name')}</Label>
                  <div className="relative">
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      disabled={!isEditing}
                      className={`h-9 sm:h-10 text-sm pr-10 validation-input transition-all duration-300 ${formErrors.name ? 'border-destructive focus-visible:ring-destructive' : getFieldStatus('name') === 'valid' && isEditing ? 'border-success focus-visible:ring-success' : ''}`}
                    />
                    <ValidationIndicator field="name" />
                  </div>
                  {formErrors.name && (
                    <p className="text-[10px] sm:text-xs text-destructive">{formErrors.name}</p>
                  )}
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="nik" className="text-xs sm:text-sm">NIK</Label>
                  <Input
                    id="nik"
                    value={user.nik}
                    disabled
                    className="h-9 sm:h-10 text-sm bg-muted"
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="memberNumber" className="text-xs sm:text-sm">{t('Nomor Anggota', 'Member Number')}</Label>
                  <Input
                    id="memberNumber"
                    value={user.memberNumber}
                    disabled
                    className="h-9 sm:h-10 text-sm bg-muted"
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="joinDate" className="text-xs sm:text-sm">{t('Tanggal Bergabung', 'Join Date')}</Label>
                  <Input
                    id="joinDate"
                    value={formatDate(user.joinDate)}
                    disabled
                    className="h-9 sm:h-10 text-sm bg-muted"
                  />
                </div>
              </div>
              
              {/* Address Field */}
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="address" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <User className="h-3 w-3 sm:h-4 sm:w-4" />
                  {t('Alamat Domisili', 'Domicile Address')}
                </Label>
                <textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  disabled={!isEditing}
                  placeholder={isEditing ? t('Masukkan alamat lengkap...', 'Enter full address...') : ''}
                  rows={3}
                  className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none ${!isEditing ? 'bg-muted' : ''}`}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section Separator - Contact */}
          <div className="relative">
            <Separator className="my-2" />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-background px-2 text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {t('Kontak & Bank', 'Contact & Bank')}
            </span>
          </div>

          {/* Contact Information */}
          <Card>
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                {t('Informasi Kontak', 'Contact Information')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3 sm:space-y-4">
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={user.email}
                    disabled
                    className="h-9 sm:h-10 text-sm bg-muted"
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                    {t('Nomor HP', 'Phone Number')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      disabled={!isEditing}
                      placeholder={isEditing ? '0812-3456-7890' : ''}
                      className={`h-9 sm:h-10 text-sm pr-10 validation-input transition-all duration-300 ${formErrors.phone ? 'border-destructive focus-visible:ring-destructive' : getFieldStatus('phone') === 'valid' && isEditing ? 'border-success focus-visible:ring-success' : ''}`}
                    />
                    <ValidationIndicator field="phone" />
                  </div>
                  {formErrors.phone && (
                    <p className="text-[10px] sm:text-xs text-destructive">{formErrors.phone}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Account Information */}
          <Card>
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                {t('Rekening Bank', 'Bank Account')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3 sm:space-y-4">
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="bankName" className="text-xs sm:text-sm">{t('Nama Bank', 'Bank Name')}</Label>
                  {isEditing ? (
                    <Select
                      value={formData.bankName}
                      onValueChange={(value) => handleFieldChange('bankName', value)}
                    >
                      <SelectTrigger className={`h-9 sm:h-10 text-sm ${formErrors.bankName ? 'border-destructive ring-1 ring-destructive' : ''}`}>
                        <SelectValue placeholder={t('Pilih Bank', 'Select Bank')} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBanks.map((bank) => (
                          <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="bankName"
                      value={formData.bankName || '-'}
                      disabled
                      className="h-9 sm:h-10 text-sm bg-muted"
                    />
                  )}
                  {formErrors.bankName && (
                    <p className="text-[10px] sm:text-xs text-destructive">{formErrors.bankName}</p>
                  )}
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="bankAccountNumber" className="text-xs sm:text-sm">{t('Nomor Rekening', 'Account Number')}</Label>
                  <div className="relative">
                    <Input
                      id="bankAccountNumber"
                      value={formData.bankAccountNumber}
                      onChange={(e) => handleFieldChange('bankAccountNumber', e.target.value)}
                      disabled={!isEditing}
                      placeholder={isEditing ? '1234 5678 90' : ''}
                      className={`h-9 sm:h-10 text-sm pr-10 validation-input transition-all duration-300 ${formErrors.bankAccountNumber ? 'border-destructive focus-visible:ring-destructive' : getFieldStatus('bankAccountNumber') === 'valid' && isEditing ? 'border-success focus-visible:ring-success' : ''}`}
                    />
                    <ValidationIndicator field="bankAccountNumber" />
                  </div>
                  {formErrors.bankAccountNumber && (
                    <p className="text-[10px] sm:text-xs text-destructive">{formErrors.bankAccountNumber}</p>
                  )}
                </div>
                <div className="space-y-1 sm:space-y-2 sm:col-span-2">
                  <Label htmlFor="bankAccountName" className="text-xs sm:text-sm">{t('Nama Pemilik Rekening', 'Account Holder Name')}</Label>
                  <div className="relative">
                    <Input
                      id="bankAccountName"
                      value={formData.bankAccountName}
                      onChange={(e) => handleFieldChange('bankAccountName', e.target.value)}
                      disabled={!isEditing}
                      className={`h-9 sm:h-10 text-sm pr-10 validation-input transition-all duration-300 ${formErrors.bankAccountName ? 'border-destructive focus-visible:ring-destructive' : getFieldStatus('bankAccountName') === 'valid' && isEditing ? 'border-success focus-visible:ring-success' : ''}`}
                    />
                    <ValidationIndicator field="bankAccountName" />
                  </div>
                  {formErrors.bankAccountName && (
                    <p className="text-[10px] sm:text-xs text-destructive">{formErrors.bankAccountName}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SHU Tab */}
        <TabsContent value="shu" className="space-y-6">
          {/* SHU Summary */}
          <Card variant="accent" className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">{t('Total SHU Diterima', 'Total SHU Received')}</p>
                  <p className="mt-1 text-3xl font-bold">{formatCurrency(combinedTotalSHU)}</p>
                  <p className="mt-1 text-sm opacity-75">
                    {memberSHU.length} {t('tahun buku', 'fiscal years')}
                  </p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-foreground/20">
                  <Gift className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SHU History List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('Riwayat SHU per Tahun', 'SHU History by Year')}</CardTitle>
            </CardHeader>
            <CardContent>
              {memberSHU.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Gift className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">{t('Belum ada SHU yang didistribusikan', 'No SHU distributed yet')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('SHU dibagikan setelah Admin melakukan konfirmasi distribusi', 'SHU is distributed after Admin confirms distribution')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Confirmed distributions from admin */}
                  {memberSHU.map((shu, index) => (
                    <div
                      key={`confirmed-${shu.year}`}
                      className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/50 animate-slide-up"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                          <span className="text-lg font-bold text-success">{shu.year}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{t('Tahun Buku', 'Fiscal Year')} {shu.year}</p>
                            <Badge variant="success" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {t('Sudah Ditransfer', 'Transferred')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{t('Dikonfirmasi', 'Confirmed')} {shu.confirmedAt ? formatDate(shu.confirmedAt) : '-'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-success">{formatCurrency(shu.totalShare)}</p>
                        </div>
                      </div>
                      
                      {/* SHU Breakdown */}
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('Jasa Simpanan', 'Savings Share')}:</span>
                            <span className="font-medium">{formatCurrency(shu.simpananShare)}</span>
                          </div>
                          {shu.jasaUsahaShare > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('Jasa Usaha', 'Business Share')}:</span>
                              <span className="font-medium">{formatCurrency(shu.jasaUsahaShare)}</span>
                            </div>
                          )}
                          {shu.roleShare > 0 && shu.roleName && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground capitalize">{t(`Jasa ${shu.roleName}`, `${shu.roleName} Share`)}:</span>
                              <span className="font-medium">{formatCurrency(shu.roleShare)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <Card variant="flat" className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <TrendingUp className="h-5 w-5 text-primary shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{t('Tentang SHU', 'About SHU')}</p>
                  <p className="mt-1">
                    {t(
                      'Sisa Hasil Usaha (SHU) adalah bagian keuntungan koperasi yang dibagikan kepada anggota pada akhir tahun buku (Desember). Besaran SHU dihitung berdasarkan kontribusi simpanan dan partisipasi anggota dalam kegiatan koperasi.',
                      'Sisa Hasil Usaha (SHU) is the cooperative profit share distributed to members at the end of the fiscal year (December). The amount is calculated based on savings contribution and member participation in cooperative activities.'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {t('Ubah Password', 'Change Password')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t('Password Saat Ini', 'Current Password')}</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('Password Baru', 'New Password')}</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                
                {/* Password strength indicator */}
                {passwordData.newPassword && (
                  <div className="space-y-2 mt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('Kekuatan Password', 'Password Strength')}</span>
                      <span className={`font-medium ${
                        passwordStrength.score <= 2 ? 'text-destructive' :
                        passwordStrength.score <= 3 ? 'text-warning' :
                        passwordStrength.score === 4 ? 'text-primary' : 'text-success'
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                      <div className={`flex items-center gap-1.5 ${passwordStrength.checks.length ? 'text-success' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.length ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {t('Minimal 8 karakter', 'At least 8 characters')}
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordStrength.checks.uppercase ? 'text-success' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.uppercase ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {t('Huruf besar (A-Z)', 'Uppercase (A-Z)')}
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordStrength.checks.lowercase ? 'text-success' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.lowercase ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {t('Huruf kecil (a-z)', 'Lowercase (a-z)')}
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordStrength.checks.number ? 'text-success' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.number ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {t('Angka (0-9)', 'Number (0-9)')}
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordStrength.checks.symbol ? 'text-success' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.symbol ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {t('Simbol (!@#$%)', 'Symbol (!@#$%)')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('Konfirmasi Password Baru', 'Confirm New Password')}</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button 
                onClick={handlePasswordChange} 
                className="w-full sm:w-auto"
                disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('Mengubah...', 'Changing...')}
                  </>
                ) : (
                  t('Ubah Password', 'Change Password')
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Email Change Section */}
          <EmailChangeForm />
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                {t('Bahasa & Tema', 'Language & Theme')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ThemeLanguageToggle />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resign" className="space-y-6">
          <ResignationForm />
        </TabsContent>

        <TabsContent value="guide" className="space-y-6">
          <MemberGuide />
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
};