import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Shield,
  User,
  Mail,
  CreditCard,
  Clock,
  KeyRound
} from 'lucide-react';
import { toast } from 'sonner';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

const getPasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 10;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[a-z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  
  if (score < 40) return { score, label: 'Lemah', color: 'bg-red-500' };
  if (score < 70) return { score, label: 'Sedang', color: 'bg-yellow-500' };
  return { score, label: 'Kuat', color: 'bg-green-500' };
};

interface UserInfo {
  name: string;
  email: string;
  member_number: string;
  has_nik: boolean;
  expires_at: string;
}

export const ClaimAccountPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useThemeLanguage();
  const token = searchParams.get('token');

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const [nikVerification, setNikVerification] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [claimedEmail, setClaimedEmail] = useState('');

  const passwordStrength = getPasswordStrength(newPassword);

  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      setError('Token tidak ditemukan. Pastikan Anda mengakses link yang benar dari email.');
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('claim-account', {
        body: { action: 'validate', token }
      });

      if (error) throw error;

      if (data.valid) {
        setIsValid(true);
        setUserInfo(data.user_info);
      } else {
        setError(data.error || 'Token tidak valid');
      }
    } catch (err: any) {
      console.error('Error validating token:', err);
      setError(err.message || 'Gagal memvalidasi token');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error(t('Password baru dan konfirmasi harus diisi', 'New password and confirmation are required'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('Password tidak cocok', 'Passwords do not match'));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t('Password minimal 8 karakter', 'Password must be at least 8 characters'));
      return;
    }

    if (passwordStrength.score < 40) {
      toast.error(t('Password terlalu lemah', 'Password is too weak'));
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('claim-account', {
        body: {
          action: 'claim',
          token,
          new_password: newPassword,
          nik_verification: nikVerification || undefined
        }
      });

      if (error) throw error;

      if (data.success) {
        setIsSuccess(true);
        setClaimedEmail(data.email);
        toast.success(t('Akun berhasil diaktifkan!', 'Account activated successfully!'));
      } else {
        toast.error(data.error || t('Gagal mengaktifkan akun', 'Failed to activate account'));
      }
    } catch (err: any) {
      console.error('Error claiming account:', err);
      toast.error(err.message || t('Terjadi kesalahan', 'An error occurred'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToLogin = () => {
    navigate('/');
  };

  if (isValidating) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <Card className="w-full max-w-md relative z-10 bg-white/95 dark:bg-card/95 backdrop-blur-xl border-white/30 dark:border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t('Memvalidasi token...', 'Validating token...')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValid || error) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <Card className="w-full max-w-md relative z-10 bg-white/95 dark:bg-card/95 backdrop-blur-xl border-white/30 dark:border-border">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive">{t('Token Tidak Valid', 'Invalid Token')}</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'Kemungkinan penyebab: Link sudah pernah digunakan, link sudah kadaluarsa (lebih dari 72 jam), atau link tidak lengkap.',
                  'Possible causes: Link has been used before, link has expired (more than 72 hours), or link is incomplete.'
                )}
              </AlertDescription>
            </Alert>
            <Button onClick={handleGoToLogin} variant="hero" className="w-full">
              {t('Kembali ke Halaman Login', 'Back to Login Page')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <Card className="w-full max-w-md relative z-10 bg-white/95 dark:bg-card/95 backdrop-blur-xl border-white/30 dark:border-border">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-success">
              {t('Akun Berhasil Diaktifkan!', 'Account Activated Successfully!')}
            </CardTitle>
            <CardDescription>
              {t(
                'Selamat! Akun keanggotaan Anda sudah aktif. Anda sekarang dapat login menggunakan email dan password baru Anda.',
                'Congratulations! Your membership account is now active. You can now login using your email and new password.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('Email:', 'Email:')}</span>
                <span className="font-medium">{claimedEmail}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('Password:', 'Password:')}</span>
                <span className="font-medium">{t('Password baru Anda', 'Your new password')}</span>
              </div>
            </div>

            <Button onClick={handleGoToLogin} variant="hero" className="w-full" size="lg">
              {t('Login Sekarang', 'Login Now')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse-slow" />
      <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      <Card className="w-full max-w-md relative z-10 bg-white/95 dark:bg-card/95 backdrop-blur-xl border-white/30 dark:border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>{t('Aktivasi Akun Anggota', 'Activate Member Account')}</CardTitle>
          <CardDescription>
            {t(
              'Buat password baru untuk mengaktifkan akun keanggotaan Anda',
              'Create a new password to activate your membership account'
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* User Info */}
          {userInfo && (
            <div className="bg-muted rounded-lg p-4 mb-6 space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('Nama', 'Name')}</p>
                  <p className="font-medium">{userInfo.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('Email', 'Email')}</p>
                  <p className="font-medium">{userInfo.email}</p>
                </div>
              </div>
              {userInfo.member_number && (
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('No. Anggota', 'Member No.')}</p>
                    <p className="font-medium">{userInfo.member_number}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('Link berlaku hingga', 'Link valid until')}</p>
                  <p className="font-medium text-sm">
                    {new Date(userInfo.expires_at).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* NIK Verification (Optional) */}
            {userInfo?.has_nik && (
              <div className="space-y-2">
                <Label htmlFor="nikVerification">
                  {t('Verifikasi NIK (Opsional)', 'NIK Verification (Optional)')}
                </Label>
                <Input
                  id="nikVerification"
                  type="text"
                  placeholder={t('4 digit terakhir NIK', 'Last 4 digits of NIK')}
                  value={nikVerification}
                  onChange={(e) => setNikVerification(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                />
                <p className="text-xs text-muted-foreground">
                  {t(
                    'Masukkan 4 digit terakhir NIK Anda untuk keamanan tambahan',
                    'Enter the last 4 digits of your NIK for additional security'
                  )}
                </p>
              </div>
            )}

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('Password Baru', 'New Password')} *</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('Minimal 8 karakter', 'At least 8 characters')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {newPassword && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Progress value={passwordStrength.score} className="h-2 flex-1" />
                    <span className={`text-xs font-medium ${
                      passwordStrength.score < 40 ? 'text-red-500' :
                      passwordStrength.score < 70 ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol',
                      'Use a combination of uppercase, lowercase, numbers, and symbols'
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('Konfirmasi Password', 'Confirm Password')} *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('Ulangi password baru', 'Repeat new password')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">
                  {t('Password tidak cocok', 'Passwords do not match')}
                </p>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('Password cocok', 'Passwords match')}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('Mengaktifkan...', 'Activating...')}
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  {t('Aktifkan Akun', 'Activate Account')}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
