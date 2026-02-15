import { useState, useEffect } from 'react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { getCooperativeSettings, CooperativeSettings } from '@/lib/cooperativeSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Mail, Building2, ArrowLeft, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { ThemeLanguageToggle } from '@/components/shared/ThemeLanguageToggle';
import { supabase } from '@/integrations/supabase/client';
import { getLogoFrameStyles, LogoFrameType, LogoZoomSize } from '@/lib/logoFrameUtils';

interface ForgotPasswordFormProps {
  onBack: () => void;
}

const emailSchema = z.object({
  email: z.string().email('Format email tidak valid'),
});

export const ForgotPasswordForm = ({ onBack }: ForgotPasswordFormProps) => {
  const { t } = useThemeLanguage();
  const [settings, setSettings] = useState<CooperativeSettings>(getCooperativeSettings());
  const [logoFrame, setLogoFrame] = useState<LogoFrameType>('circle');
  const [logoZoom, setLogoZoom] = useState<LogoZoomSize>('medium');
  const logo = settings.logoBase64 || settings.logoUrl;
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setSettings(getCooperativeSettings());
    
    const fetchLogoSettings = async () => {
      const { data } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', ['logo_frame', 'logo_size']);
      
      if (data) {
        const dbData: Record<string, any> = {};
        data.forEach(row => {
          dbData[row.key] = row.value;
        });
        
        if (dbData['logo_frame']) {
          setLogoFrame(dbData['logo_frame'] as LogoFrameType);
        }
        if (dbData['logo_size']) {
          setLogoZoom(dbData['logo_size'] as LogoZoomSize);
        }
      }
    };
    fetchLogoSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    const validation = emailSchema.safeParse({ email });
    if (!validation.success) {
      setErrorMessage(validation.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('Reset password error:', error);
        setErrorMessage(t('Gagal mengirim email reset password. Silakan coba lagi.', 'Failed to send reset password email. Please try again.'));
        toast.error(t('Gagal mengirim email', 'Failed to send email'));
      } else {
        setIsSuccess(true);
        toast.success(t('Email reset password telah dikirim', 'Password reset email has been sent'));
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setErrorMessage(t('Terjadi kesalahan. Silakan coba lagi.', 'An error occurred. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Gradient Background */}
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
                <h1 className="text-lg font-semibold text-white">{t('Reset Password', 'Reset Password')}</h1>
                <p className="text-sm text-white/70">{t('Email terkirim', 'Email sent')}</p>
              </div>
            </div>
            <ThemeLanguageToggle variant="splash" />
          </div>
        </div>

        <div className="auth-center-container relative z-10">
          <div className="w-full max-w-md space-y-6 animate-fade-in">
            <Card className="bg-white/95 dark:bg-card/95 backdrop-blur-xl border-white/30 dark:border-border">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="rounded-full bg-success/10 p-4">
                    <CheckCircle className="h-12 w-12 text-success" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">{t('Email Terkirim!', 'Email Sent!')}</h2>
                    <p className="text-muted-foreground">
                      {t(
                        'Kami telah mengirim link reset password ke email Anda. Silakan cek inbox email Anda.',
                        'We have sent a password reset link to your email. Please check your inbox.'
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{email}</p>
                  </div>
                  <div className="pt-4 w-full space-y-3">
                    <Button variant="outline" className="w-full" onClick={onBack}>
                      {t('Kembali ke Login', 'Back to Login')}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full text-sm" 
                      onClick={() => {
                        setIsSuccess(false);
                        setEmail('');
                      }}
                    >
                      {t('Kirim ulang email', 'Resend email')}
                    </Button>
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Gradient Background */}
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
              <h1 className="text-lg font-semibold text-white">{t('Lupa Password', 'Forgot Password')}</h1>
              <p className="text-sm text-white/70">{t('Reset password akun Anda', 'Reset your account password')}</p>
            </div>
          </div>
          <ThemeLanguageToggle variant="splash" />
        </div>
      </div>

      <div className="auth-center-container relative z-10">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          {/* Logo */}
          <div className="flex flex-col items-center text-center">
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
          </div>

          {/* Forgot Password Card */}
          <Card className="bg-white/95 dark:bg-card/95 backdrop-blur-xl border-white/30 dark:border-border">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">{t('Lupa Password?', 'Forgot Password?')}</CardTitle>
              <CardDescription>
                {t(
                  'Masukkan email Anda dan kami akan mengirimkan link untuk reset password.',
                  'Enter your email and we will send you a link to reset your password.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="input-icon-wrapper">
                    <Mail className="input-icon" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nama@email.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorMessage('');
                      }}
                      className={`pl-10 sm:pl-11 md:pl-12 ${errorMessage ? 'input-error' : ''}`}
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                  {errorMessage && (
                    <p className="text-sm text-destructive animate-fade-in">{errorMessage}</p>
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
                      {t('Mengirim...', 'Sending...')}
                    </>
                  ) : (
                    t('Kirim Link Reset Password', 'Send Reset Password Link')
                  )}
                </Button>

                <Button 
                  type="button"
                  variant="ghost" 
                  className="w-full" 
                  onClick={onBack}
                >
                  {t('Kembali ke Login', 'Back to Login')}
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
