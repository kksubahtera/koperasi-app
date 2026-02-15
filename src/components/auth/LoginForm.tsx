import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { getCooperativeSettings, CooperativeSettings } from '@/lib/cooperativeSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Building2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import { ThemeLanguageToggle } from '@/components/shared/ThemeLanguageToggle';
import { supabase } from '@/integrations/supabase/client';
import { getLogoFrameStyles, LogoFrameType, LogoZoomSize } from '@/lib/logoFrameUtils';

interface LoginFormProps {
  onBack: () => void;
  onForgotPassword?: () => void;
}

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

export const LoginForm = ({ onBack, onForgotPassword }: LoginFormProps) => {
  const { login, isLoading } = useAuth();
  const { t } = useThemeLanguage();
  const [settings, setSettings] = useState<CooperativeSettings>(getCooperativeSettings());
  const [logoFrame, setLogoFrame] = useState<LogoFrameType>('circle');
  const [logoZoom, setLogoZoom] = useState<LogoZoomSize>('medium');
  const logo = settings.logoBase64 || settings.logoUrl;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorFields, setErrorFields] = useState<Record<string, string>>({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const emailRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoadingSettings(true);
      try {
        // Fetch cooperative settings from database
        const { data, error } = await supabase
          .from('cooperative_settings')
          .select('key, value')
          .in('key', [
            'cooperative_name',
            'cooperative_legal_number',
            'cooperative_logo_base64',
            'cooperative_copyright_year',
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
            legalNumber: dbData['cooperative_legal_number'] ?? localSettings.legalNumber,
            logoBase64: dbData['cooperative_logo_base64'] ?? localSettings.logoBase64,
            copyrightYear: dbData['cooperative_copyright_year'] ?? localSettings.copyrightYear,
          });
        } else {
          setSettings(getCooperativeSettings());
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
        setSettings(getCooperativeSettings());
      } finally {
        setIsLoadingSettings(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      // Show all errors
      validation.error.errors.forEach(err => {
        const errorPath = err.path[0] as string;
        triggerShake(errorPath, err.message);
      });
      return;
    }

    const result = await login(email, password);
    
    if (result.success) {
      toast.success(t('Login berhasil', 'Login successful'));
    } else {
      // Shake both fields on login failure
      const errorMsg = result.message || t('Email atau password salah', 'Invalid email or password');
      triggerShake('email', errorMsg);
      triggerShake('password', '');
      toast.error(errorMsg);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Gradient Background - matching landing page */}
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse-slow" />
      <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      
      {/* Header */}
      <div className="sticky top-0 z-10 relative">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
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
              <h1 className="text-lg font-semibold text-white">{t('Akun Saya', 'My Account')}</h1>
              <p className="text-sm text-white/70">{t('Masuk ke akun Anda', 'Sign in to your account')}</p>
            </div>
          </div>
          <ThemeLanguageToggle variant="splash" />
        </div>
      </div>

      <div className="auth-center-container relative z-10">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          {/* Logo */}
          <div className="flex flex-col items-center text-center">
            {isLoadingSettings ? (
              <>
                <div className="h-20 w-20 rounded-full bg-white/20 animate-pulse" />
                <div className="mt-4 h-7 w-48 rounded-lg bg-white/20 animate-pulse" />
                <div className="mt-2 h-4 w-40 rounded-lg bg-white/10 animate-pulse" />
              </>
            ) : (
              <>
                {(() => {
                  const frameStyles = getLogoFrameStyles(logoFrame, logoZoom, 'h-20 w-20');
                  if (logo) {
                    return (
                      <div className={`${frameStyles.containerClasses} bg-white/20 backdrop-blur-sm border-2 border-white/30`}>
                        <img src={logo} alt="Logo Koperasi" className={frameStyles.imageClasses} />
                      </div>
                    );
                  }
                  return (
                    <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center">
                      <Building2 className="h-10 w-10 text-white" />
                    </div>
                  );
                })()}
                <h1 className="mt-4 text-2xl font-bold text-white">{settings.name || t('Koperasi Digital', 'Digital Cooperative')}</h1>
                <p className="mt-1 text-white/70">{t('Buku Anggota Koperasi', 'Cooperative Member Book')}</p>
              </>
            )}
          </div>

          {/* Login Card */}
          <Card variant="glass" className="bg-white/95 dark:bg-card/95 backdrop-blur-xl border-white/30 dark:border-border">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">{t('Masuk ke Akun Anda', 'Sign in to Your Account')}</CardTitle>
              <CardDescription>
                {t('Masukkan email dan password untuk melanjutkan', 'Enter your email and password to continue')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className={`input-icon-wrapper ${errorFields['email'] ? 'input-shake' : ''}`}>
                    <Mail className="input-icon" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nama@email.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError('email');
                      }}
                      className={`pl-10 sm:pl-11 md:pl-12 ${errorFields['email'] ? 'input-error' : ''}`}
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                  {errorFields['email'] && (
                    <p className="text-sm text-destructive animate-fade-in">{errorFields['email']}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {onForgotPassword && (
                      <Button
                        type="button"
                        variant="link"
                        className="px-0 h-auto text-xs text-primary"
                        onClick={onForgotPassword}
                      >
                        {t('Lupa Password?', 'Forgot Password?')}
                      </Button>
                    )}
                  </div>
                  <div className={`input-icon-wrapper ${errorFields['password'] ? 'input-shake' : ''}`}>
                    <Lock className="input-icon" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError('password');
                      }}
                      className={`pl-10 sm:pl-11 md:pl-12 pr-11 ${errorFields['password'] ? 'input-error' : ''}`}
                      disabled={isLoading}
                      autoComplete="current-password"
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
                </div>

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
                      {t('Memproses...', 'Processing...')}
                    </>
                  ) : (
                    t('Masuk', 'Sign In')
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-xs text-white/70">
            &copy; {settings.copyrightYear || new Date().getFullYear()} {settings.name || t('Koperasi Digital', 'Digital Cooperative')}. {t('Hak cipta dilindungi.', 'All rights reserved.')}
          </p>
        </div>
      </div>
    </div>
  );
};
