import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Mail, Loader2, CheckCircle2, AlertCircle, Info, Eye, EyeOff, Clock } from 'lucide-react';
import { toast } from 'sonner';

const RATE_LIMIT_HOURS = 1; // Limit: 1 request per hour

export const EmailChangeForm = () => {
  const { user, refreshUser } = useAuth();
  const { t } = useThemeLanguage();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitRemainingTime, setRateLimitRemainingTime] = useState<string>('');
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newEmail?: string;
    confirmEmail?: string;
  }>({});

  // Check rate limit on mount and periodically
  const checkRateLimit = useCallback(async () => {
    if (!user?.id) return;

    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - RATE_LIMIT_HOURS);

      const { data, error } = await supabase
        .from('email_change_logs')
        .select('changed_at')
        .eq('user_id', user.id)
        .gte('changed_at', cutoffTime.toISOString())
        .order('changed_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking rate limit:', error);
        return;
      }

      if (data && data.length > 0) {
        const lastChangeTime = new Date(data[0].changed_at);
        const unlockTime = new Date(lastChangeTime.getTime() + RATE_LIMIT_HOURS * 60 * 60 * 1000);
        const now = new Date();

        if (now < unlockTime) {
          setIsRateLimited(true);
          const remainingMs = unlockTime.getTime() - now.getTime();
          const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
          
          if (remainingMinutes >= 60) {
            const hours = Math.floor(remainingMinutes / 60);
            const mins = remainingMinutes % 60;
            setRateLimitRemainingTime(`${hours} jam ${mins} menit`);
          } else {
            setRateLimitRemainingTime(`${remainingMinutes} menit`);
          }
        } else {
          setIsRateLimited(false);
          setRateLimitRemainingTime('');
        }
      } else {
        setIsRateLimited(false);
        setRateLimitRemainingTime('');
      }
    } catch (err) {
      console.error('Rate limit check failed:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    checkRateLimit();
    // Re-check every minute
    const interval = setInterval(checkRateLimit, 60000);
    return () => clearInterval(interval);
  }, [checkRateLimit]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!currentPassword.trim()) {
      newErrors.currentPassword = t('Password saat ini wajib diisi', 'Current password is required');
    }

    if (!newEmail.trim()) {
      newErrors.newEmail = t('Email baru wajib diisi', 'New email is required');
    } else if (!validateEmail(newEmail)) {
      newErrors.newEmail = t('Format email tidak valid', 'Invalid email format');
    } else if (newEmail.toLowerCase() === user?.email.toLowerCase()) {
      newErrors.newEmail = t('Email baru tidak boleh sama dengan email saat ini', 'New email cannot be the same as current email');
    }

    if (!confirmEmail.trim()) {
      newErrors.confirmEmail = t('Konfirmasi email wajib diisi', 'Email confirmation is required');
    } else if (confirmEmail !== newEmail) {
      newErrors.confirmEmail = t('Email tidak cocok', 'Emails do not match');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setShowConfirmDialog(true);
  };

  const handleConfirmChange = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);

    try {
      // First verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) {
        toast.error(t('Password saat ini salah', 'Current password is incorrect'));
        setErrors({ currentPassword: t('Password salah', 'Incorrect password') });
        setIsSubmitting(false);
        return;
      }

      // Request email change - Supabase will send confirmation to new email
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (updateError) {
        console.error('Email change error:', updateError);
        
        if (updateError.message.includes('already registered') || updateError.message.includes('already exists')) {
          toast.error(t('Email sudah digunakan oleh pengguna lain', 'Email is already used by another user'));
          setErrors({ newEmail: t('Email sudah terdaftar', 'Email already registered') });
        } else if (updateError.message.includes('rate limit')) {
          toast.error(t('Terlalu banyak percobaan. Silakan coba lagi nanti', 'Too many attempts. Please try again later'));
        } else {
          toast.error(updateError.message || t('Gagal mengganti email', 'Failed to change email'));
        }
        setIsSubmitting(false);
        return;
      }

      // Send security alert to old email
      try {
        const requestTime = new Date().toLocaleString('id-ID', {
          dateStyle: 'full',
          timeStyle: 'short',
        });
        
        await supabase.functions.invoke('send-email-change-alert', {
          body: {
            oldEmail: user.email,
            newEmail: newEmail,
            memberName: user.name || user.email,
            requestTime: requestTime,
          },
        });
        console.log('Email change alert sent to old email');
      } catch (alertError) {
        console.error('Failed to send email change alert:', alertError);
        // Don't block the success flow if alert fails
      }

      // Log email change request for audit trail
      try {
        await supabase.from('email_change_logs').insert({
          user_id: user.id,
          old_email: user.email,
          new_email: newEmail,
          user_agent: navigator.userAgent,
        });
      } catch (logError) {
        console.error('Failed to log email change:', logError);
        // Don't block the success flow if logging fails
      }

      // Success - email confirmation sent
      setEmailSent(true);
      toast.success(t('Link konfirmasi telah dikirim ke email baru', 'Confirmation link has been sent to new email'));
      
      // Clear form
      setCurrentPassword('');
      setNewEmail('');
      setConfirmEmail('');
      setErrors({});

    } catch (error) {
      console.error('Email change error:', error);
      toast.error(t('Terjadi kesalahan saat mengganti email', 'An error occurred while changing email'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setEmailSent(false);
    setCurrentPassword('');
    setNewEmail('');
    setConfirmEmail('');
    setErrors({});
  };

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {t('Ganti Email', 'Change Email')}
        </CardTitle>
        <CardDescription>
          {t(
            'Ganti alamat email akun Anda dengan verifikasi keamanan',
            'Change your account email address with security verification'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {emailSent ? (
          <div className="space-y-4">
            <Alert className="border-success bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                {t(
                  'Link konfirmasi telah dikirim ke email baru Anda. Silakan cek inbox email baru dan klik link untuk menyelesaikan perubahan.',
                  'A confirmation link has been sent to your new email. Please check your new email inbox and click the link to complete the change.'
                )}
              </AlertDescription>
            </Alert>
            
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">{t('Langkah selanjutnya:', 'Next steps:')}</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>{t('Buka inbox email baru Anda', 'Open your new email inbox')}</li>
                <li>{t('Cari email dari sistem kami', 'Find the email from our system')}</li>
                <li>{t('Klik link konfirmasi di dalam email', 'Click the confirmation link in the email')}</li>
                <li>{t('Setelah dikonfirmasi, login kembali dengan email baru', 'After confirmation, login again with new email')}</li>
              </ol>
            </div>

            <Button onClick={handleReset} variant="outline" className="w-full">
              {t('Ganti Email Lagi', 'Change Email Again')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Email (Read Only) */}
            <div className="space-y-2">
              <Label>{t('Email Saat Ini', 'Current Email')}</Label>
              <Input
                value={user.email}
                disabled
                className="bg-muted"
              />
            </div>

            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current-password">
                {t('Password Saat Ini', 'Current Password')} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (errors.currentPassword) {
                      setErrors({ ...errors, currentPassword: undefined });
                    }
                  }}
                  placeholder={t('Masukkan password saat ini', 'Enter current password')}
                  className={errors.currentPassword ? 'border-destructive pr-10' : 'pr-10'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.currentPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.currentPassword}
                </p>
              )}
            </div>

            {/* New Email */}
            <div className="space-y-2">
              <Label htmlFor="new-email">
                {t('Email Baru', 'New Email')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  if (errors.newEmail) {
                    setErrors({ ...errors, newEmail: undefined });
                  }
                }}
                placeholder={t('Masukkan email baru', 'Enter new email')}
                className={errors.newEmail ? 'border-destructive' : ''}
              />
              {errors.newEmail && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.newEmail}
                </p>
              )}
            </div>

            {/* Confirm New Email */}
            <div className="space-y-2">
              <Label htmlFor="confirm-email">
                {t('Konfirmasi Email Baru', 'Confirm New Email')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirm-email"
                type="email"
                value={confirmEmail}
                onChange={(e) => {
                  setConfirmEmail(e.target.value);
                  if (errors.confirmEmail) {
                    setErrors({ ...errors, confirmEmail: undefined });
                  }
                }}
                placeholder={t('Masukkan ulang email baru', 'Re-enter new email')}
                className={errors.confirmEmail ? 'border-destructive' : ''}
              />
              {errors.confirmEmail && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.confirmEmail}
                </p>
              )}
              {confirmEmail && confirmEmail === newEmail && validateEmail(newEmail) && (
                <p className="text-xs text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('Email cocok', 'Emails match')}
                </p>
              )}
            </div>

            {/* Info Alert */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'Setelah mengirim permintaan, Anda akan menerima email konfirmasi di alamat email baru. Klik link di email tersebut untuk menyelesaikan perubahan.',
                  'After submitting the request, you will receive a confirmation email at the new address. Click the link in that email to complete the change.'
                )}
              </AlertDescription>
            </Alert>

            {/* Rate Limit Warning */}
            {isRateLimited && (
              <Alert variant="destructive">
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  {t(
                    `Anda baru saja mengajukan perubahan email. Silakan tunggu ${rateLimitRemainingTime} sebelum mengajukan permintaan baru.`,
                    `You recently requested an email change. Please wait ${rateLimitRemainingTime} before submitting a new request.`
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || isRateLimited}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('Memproses...', 'Processing...')}
                </>
              ) : isRateLimited ? (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  {t('Tunggu sebelum mengajukan lagi', 'Wait before requesting again')}
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  {t('Kirim Permintaan Ganti Email', 'Send Email Change Request')}
                </>
              )}
            </Button>
          </form>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('Konfirmasi Ganti Email', 'Confirm Email Change')}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  {t(
                    'Anda akan mengganti email dari:',
                    'You are about to change email from:'
                  )}
                </p>
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground">{t('Email lama:', 'Old email:')}</span>{' '}
                    <span className="font-medium">{user?.email}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">{t('Email baru:', 'New email:')}</span>{' '}
                    <span className="font-medium">{newEmail}</span>
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Link konfirmasi akan dikirim ke email baru. Pastikan Anda memiliki akses ke email tersebut.',
                    'A confirmation link will be sent to the new email. Make sure you have access to that email.'
                  )}
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>
                {t('Batal', 'Cancel')}
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmChange} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('Memproses...', 'Processing...')}
                  </>
                ) : (
                  t('Ya, Ganti Email', 'Yes, Change Email')
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
