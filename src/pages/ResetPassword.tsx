import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { getCooperativeSettings, CooperativeSettings } from '@/lib/cooperativeSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Lock, Building2, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { ThemeLanguageToggle } from '@/components/shared/ThemeLanguageToggle';
import { supabase } from '@/integrations/supabase/client';
import { getLogoFrameStyles, LogoFrameType, LogoZoomSize } from '@/lib/logoFrameUtils';

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/[A-Z]/, 'Password harus memiliki minimal 1 huruf besar')
    .regex(/[a-z]/, 'Password harus memiliki minimal 1 huruf kecil')
    .regex(/[0-9]/, 'Password harus memiliki minimal 1 angka')
    .regex(/[^A-Za-z0-9]/, 'Password harus memiliki minimal 1 simbol'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Password tidak cocok',
  path: ['confirmPassword'],
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

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useThemeLanguage();
  const [settings, setSettings] = useState<CooperativeSettings>(getCooperativeSettings());
  const [logoFrame, setLogoFrame] = useState<LogoFrameType>('circle');
  const [logoZoom, setLogoZoom] = useState<LogoZoomSize>('medium');
  const logo = settings.logoBase64 || settings.logoUrl;
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);

  // Update password strength when password changes
  useEffect(() => {
    if (password) {
      setPasswordStrength(getPasswordStrength(password));
    } else {
      setPasswordStrength(null);
    }
  }, [password]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Fetch cooperative settings from database
        const { data, error } = await supabase
          .from('cooperative_settings')
          .select('key, value')
          .in('key', [
            'cooperative_name',
            'cooperative_logo_base64',
            'logo_frame',
            'logo_size',
          ]);

        if (error) {
          console.error('Error fetching settings:', error);
          setSettings(getCooperativeSettings());
          return;
        }

        if (data && data.length > 0) {
          const dbData: Record<string, any> = {};
          data.forEach(row => {
            try {
              if (typeof row.value === 'string') {
                try {
                  dbData[row.key] = JSON.parse(row.value);
                } catch {
                  dbData[row.key] = row.value;
                }
              } else {
                dbData[row.key] = row.value;
              }
            } catch {
              dbData[row.key] = row.value;
            }
          });

          // Get logo frame settings directly from individual keys
          if (dbData['logo_frame']) {
            setLogoFrame(dbData['logo_frame'] as LogoFrameType);
          }
          if (dbData['logo_size']) {
            setLogoZoom(dbData['logo_size'] as LogoZoomSize);
          }

          // Update settings
          const localSettings = getCooperativeSettings();
          setSettings({
            ...localSettings,
            name: dbData['cooperative_name'] ?? localSettings.name,
            logoBase64: dbData['cooperative_logo_base64'] ?? localSettings.logoBase64,
          });
        } else {
          setSettings(getCooperativeSettings());
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
        setSettings(getCooperativeSettings());
      }
    };
    
    fetchSettings();

    // Listen for settings updates
    const handleSettingsUpdate = (event: CustomEvent<CooperativeSettings>) => {
      setSettings(event.detail);
    };

    window.addEventListener('cooperative-settings-updated', handleSettingsUpdate as EventListener);
    
    return () => {
      window.removeEventListener('cooperative-settings-updated', handleSettingsUpdate as EventListener);
    };
  }, []);

  // Check if there's a valid recovery session
  useEffect(() => {
    const checkSession = async () => {
      // Get the current session - Supabase automatically handles the recovery token from URL
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session error:', error);
        setIsValidSession(false);
        setErrorMessage(t('Link reset password tidak valid atau sudah kadaluarsa.', 'Reset password link is invalid or expired.'));
        return;
      }

      // Check if there's an access_token in the URL hash (recovery flow)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      if (type === 'recovery' && accessToken) {
        // Set the session from recovery token
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get('refresh_token') || '',
        });
        
        if (setSessionError) {
          console.error('Set session error:', setSessionError);
          setIsValidSession(false);
          setErrorMessage(t('Link reset password tidak valid atau sudah kadaluarsa.', 'Reset password link is invalid or expired.'));
          return;
        }
        
        setIsValidSession(true);
      } else if (session) {
        // There's already a session, allow password reset
        setIsValidSession(true);
      } else {
        setIsValidSession(false);
        setErrorMessage(t('Link reset password tidak valid atau sudah kadaluarsa.', 'Reset password link is invalid or expired.'));
      }
    };

    checkSession();

    // Listen for auth state changes (recovery event)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setErrorMessage('');
    
    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        const path = err.path[0] as string;
        errors[path] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        console.error('Update password error:', error);
        if (error.message.includes('same as')) {
          setErrorMessage(t('Password baru tidak boleh sama dengan password lama.', 'New password cannot be the same as the old password.'));
        } else {
          setErrorMessage(t('Gagal mengubah password. Silakan coba lagi.', 'Failed to change password. Please try again.'));
        }
        toast.error(t('Gagal mengubah password', 'Failed to change password'));
      } else {
        setIsSuccess(true);
        toast.success(t('Password berhasil diubah', 'Password changed successfully'));
        
        // Sign out and redirect to login after 3 seconds
        setTimeout(async () => {
          await supabase.auth.signOut();
          navigate('/');
        }, 3000);
      }
    } catch (error) {
      console.error('Update password error:', error);
      setErrorMessage(t('Terjadi kesalahan. Silakan coba lagi.', 'An error occurred. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Still checking session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('Memverifikasi link...', 'Verifying link...')}</p>
        </div>
      </div>
    );
  }

  // Invalid session
  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-lg font-semibold text-foreground">{t('Reset Password', 'Reset Password')}</h1>
            </div>
            <ThemeLanguageToggle variant="minimal" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-4 pt-8">
          <div className="w-full max-w-md space-y-6 animate-fade-in">
            <Card variant="elevated">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="rounded-full bg-destructive/10 p-4">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">{t('Link Tidak Valid', 'Invalid Link')}</h2>
                    <p className="text-muted-foreground">{errorMessage}</p>
                  </div>
                  <Button className="w-full mt-4" onClick={() => navigate('/')}>
                    {t('Kembali ke Beranda', 'Back to Home')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-lg font-semibold text-foreground">{t('Reset Password', 'Reset Password')}</h1>
              <p className="text-sm text-muted-foreground">{t('Berhasil', 'Success')}</p>
            </div>
            <ThemeLanguageToggle variant="minimal" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-4 pt-8">
          <div className="w-full max-w-md space-y-6 animate-fade-in">
            <Card variant="elevated">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="rounded-full bg-success/10 p-4">
                    <CheckCircle className="h-12 w-12 text-success" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">{t('Password Berhasil Diubah!', 'Password Changed Successfully!')}</h2>
                    <p className="text-muted-foreground">
                      {t(
                        'Password Anda telah berhasil diubah. Anda akan diarahkan ke halaman login.',
                        'Your password has been successfully changed. You will be redirected to the login page.'
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('Mengalihkan...', 'Redirecting...')}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{t('Reset Password', 'Reset Password')}</h1>
            <p className="text-sm text-muted-foreground">{t('Buat password baru', 'Create new password')}</p>
          </div>
          <ThemeLanguageToggle variant="minimal" />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-4 pt-8">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          {/* Logo */}
          <div className="flex flex-col items-center text-center">
            {(() => {
              const frameStyles = getLogoFrameStyles(logoFrame, logoZoom, 'h-16 w-16');
              if (logo) {
                return (
                  <div className={frameStyles.containerClasses}>
                    <img src={logo} alt="Logo Koperasi" className={frameStyles.imageClasses} />
                  </div>
                );
              }
              return (
                <div className={frameStyles.containerClasses}>
                  <div className={frameStyles.iconContainerClasses}>
                    <Building2 className={`h-8 w-8 ${frameStyles.iconClasses}`} />
                  </div>
                </div>
              );
            })()}
            <h1 className="mt-4 text-2xl font-bold text-foreground">{settings.name || t('Koperasi Digital', 'Digital Cooperative')}</h1>
          </div>

          {/* Reset Password Card */}
          <Card variant="elevated">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">{t('Buat Password Baru', 'Create New Password')}</CardTitle>
              <CardDescription>
                {t(
                  'Masukkan password baru untuk akun Anda. Password minimal 6 karakter.',
                  'Enter a new password for your account. Password must be at least 6 characters.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t('Password Baru', 'New Password')}</Label>
                  <div className="input-icon-wrapper">
                    <Lock className="input-icon" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors(prev => ({ ...prev, password: '' }));
                      }}
                      className={`pl-10 sm:pl-11 md:pl-12 pr-11 ${fieldErrors.password ? 'input-error' : ''}`}
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
                  {fieldErrors.password && (
                    <p className="text-sm text-destructive animate-fade-in">{fieldErrors.password}</p>
                  )}
                  
                  {/* Password Strength Indicator */}
                  {password && passwordStrength && (
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
                          {passwordStrength.checks.length ? '✓' : '○'} {t('Min. 8 karakter', 'Min. 8 characters')}
                        </div>
                        <div className={`flex items-center gap-1 ${passwordStrength.checks.uppercase ? 'text-success' : 'text-muted-foreground'}`}>
                          {passwordStrength.checks.uppercase ? '✓' : '○'} {t('Huruf besar', 'Uppercase')}
                        </div>
                        <div className={`flex items-center gap-1 ${passwordStrength.checks.lowercase ? 'text-success' : 'text-muted-foreground'}`}>
                          {passwordStrength.checks.lowercase ? '✓' : '○'} {t('Huruf kecil', 'Lowercase')}
                        </div>
                        <div className={`flex items-center gap-1 ${passwordStrength.checks.number ? 'text-success' : 'text-muted-foreground'}`}>
                          {passwordStrength.checks.number ? '✓' : '○'} {t('Angka', 'Number')}
                        </div>
                        <div className={`flex items-center gap-1 ${passwordStrength.checks.symbol ? 'text-success' : 'text-muted-foreground'}`}>
                          {passwordStrength.checks.symbol ? '✓' : '○'} {t('Simbol', 'Symbol')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('Konfirmasi Password', 'Confirm Password')}</Label>
                  <div className="input-icon-wrapper">
                    <Lock className="input-icon" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
                      }}
                      className={`pl-10 sm:pl-11 md:pl-12 pr-11 ${fieldErrors.confirmPassword ? 'input-error' : ''}`}
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 hover:bg-muted/50"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="text-sm text-destructive animate-fade-in">{fieldErrors.confirmPassword}</p>
                  )}
                </div>

                {errorMessage && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                    <p className="text-sm text-destructive">{errorMessage}</p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  variant="hero" 
                  className="w-full" 
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('Menyimpan...', 'Saving...')}
                    </>
                  ) : (
                    t('Simpan Password Baru', 'Save New Password')
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground">
            &copy; {settings.copyrightYear || new Date().getFullYear()} {settings.name || t('Koperasi Digital', 'Digital Cooperative')}. {t('Hak cipta dilindungi.', 'All rights reserved.')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
