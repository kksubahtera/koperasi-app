import { useState, useEffect, forwardRef } from 'react';
import { Building2, ArrowRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeLanguageToggle } from '@/components/shared/ThemeLanguageToggle';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { getCooperativeSettings, CooperativeSettings } from '@/lib/cooperativeSettings';
import { supabase } from '@/integrations/supabase/client';
import { getLogoFrameStylesForSplash, LogoFrameType, LogoZoomSize, LogoContainerSize, getContainerSize } from '@/lib/logoFrameUtils';
import { toast } from 'sonner';
import { CooperativeSettingsService } from '@/lib/database';

interface AuthLandingProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const AuthLanding = forwardRef<HTMLDivElement, AuthLandingProps>(({ onGetStarted, onLogin }, ref) => {
  const { t } = useThemeLanguage();
  const [settings, setSettings] = useState<CooperativeSettings>(getCooperativeSettings());
  const [logoFrame, setLogoFrame] = useState<LogoFrameType>('circle');
  const [logoZoom, setLogoZoom] = useState<LogoZoomSize>('medium');
  const [logoContainerSize, setLogoContainerSize] = useState<LogoContainerSize>('default');
  const [isCheckingSettings, setIsCheckingSettings] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const logo = settings.logoBase64 || settings.logoUrl;

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
            'cooperative_address',
            'cooperative_logo_base64',
            'logo_frame',
            'logo_size',
            'logo_container_splash',
          ]);

        if (error) {
          console.error('Error fetching settings:', error);
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
            const sizeVal = dbData['logo_size'] as string;
            // Normalize old zoom values to valid ones
            if (['small', 'medium', 'large', 'xlarge'].includes(sizeVal)) {
              setLogoZoom(sizeVal as LogoZoomSize);
            } else if (['120', '150', '175', '200', 'extra-large'].includes(sizeVal)) {
              setLogoZoom('xlarge');
            } else {
            setLogoZoom('medium');
            }
          }
          if (dbData['logo_container_splash']) {
            setLogoContainerSize(dbData['logo_container_splash'] as LogoContainerSize);
          }

          // Update settings
          const localSettings = getCooperativeSettings();
          setSettings({
            ...localSettings,
            name: dbData['cooperative_name'] ?? localSettings.name,
            legalNumber: dbData['cooperative_legal_number'] ?? localSettings.legalNumber,
            address: dbData['cooperative_address'] ?? localSettings.address,
            logoBase64: dbData['cooperative_logo_base64'] ?? localSettings.logoBase64,
          });
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
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

  const handleGetStarted = async () => {
    setIsCheckingSettings(true);
    try {
      const bankSettings = await CooperativeSettingsService.getMultipleSettings([
        'bank_name',
        'bank_account_number',
        'bank_account_name',
        'simpanan_pokok',
        'simpanan_wajib'
      ]);
      
      const missing: string[] = [];
      const bankName = bankSettings['bank_name'];
      const bankAccountNumber = bankSettings['bank_account_number'];
      const bankAccountName = bankSettings['bank_account_name'];
      const simpananPokok = bankSettings['simpanan_pokok'];
      const simpananWajib = bankSettings['simpanan_wajib'];
      
      console.log('Bank settings check:', { bankName, bankAccountNumber, bankAccountName, simpananPokok, simpananWajib });
      
      if (!bankName || (typeof bankName === 'string' && bankName.trim() === '')) missing.push('Nama Bank Koperasi');
      if (bankAccountNumber === undefined || bankAccountNumber === null || bankAccountNumber === '') missing.push('Nomor Rekening Koperasi');
      if (!bankAccountName || (typeof bankAccountName === 'string' && bankAccountName.trim() === '')) missing.push('Nama Pemilik Rekening');
      if (simpananPokok === undefined || simpananPokok === null || Number(simpananPokok) <= 0) missing.push('Jumlah Simpanan Pokok');
      if (simpananWajib === undefined || simpananWajib === null || Number(simpananWajib) <= 0) missing.push('Jumlah Simpanan Wajib');
      
      if (missing.length > 0) {
        toast.error(t('Pendaftaran Belum Tersedia', 'Registration Not Available'), {
          description: t(
            `Admin koperasi belum mengisi: ${missing.join(', ')}. Silakan hubungi admin.`,
            `Cooperative admin has not configured: ${missing.join(', ')}. Please contact admin.`
          ),
          duration: 6000,
        });
        return;
      }
      
      // All settings are complete, proceed to registration
      onGetStarted();
    } catch (error) {
      console.error('Error checking settings:', error);
      toast.error(t('Terjadi kesalahan', 'An error occurred'), {
        description: t('Tidak dapat memeriksa pengaturan koperasi', 'Unable to check cooperative settings'),
      });
    } finally {
      setIsCheckingSettings(false);
    }
  };

  const containerSizeClass = getContainerSize(logoContainerSize, 'splash');
  const frameStyles = getLogoFrameStylesForSplash(logoFrame, logoZoom, containerSizeClass);

  return (
    <div ref={ref} className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 gradient-hero" />
      
      {/* Animated Orbs */}
      <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse-slow" />
      <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-white/5 blur-2xl animate-float" />
      
      {/* Language & Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeLanguageToggle variant="splash" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Logo & Title */}
        <div className="animate-scale-in text-center">
          {isLoadingSettings ? (
            <>
              <div className="mx-auto h-28 w-28 rounded-full bg-white/20 animate-pulse" />
              <div className="mt-6 h-12 w-64 mx-auto rounded-lg bg-white/20 animate-pulse" />
              <div className="mt-3 h-6 w-48 mx-auto rounded-lg bg-white/10 animate-pulse" />
            </>
          ) : (
            <>
              <div className={`mx-auto ${frameStyles.containerClasses} transition-all duration-300`}>
                {logo ? (
                  <img src={logo} alt="Logo Koperasi" className={`${frameStyles.imageClasses} transition-all duration-300`} />
                ) : (
                  <div className={frameStyles.iconContainerClasses}>
                    <Building2 className={`h-14 w-14 ${frameStyles.iconClasses} transition-all duration-300`} />
                  </div>
                )}
              </div>
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-white md:text-5xl">
                {settings.name || t('Koperasi Digital', 'Digital Cooperative')}
              </h1>
              <p className="mt-3 text-lg text-white/80 md:text-xl">
                {t('Buku Anggota Koperasi', 'Member Passbook')}
              </p>
            </>
          )}
        </div>

        {/* Tagline */}
        <div className="mt-12 max-w-md animate-fade-in text-center" style={{ animationDelay: '0.2s' }}>
          <p className="text-white/90 leading-relaxed">
            {t(
              'Kelola simpanan, pinjaman, dan keanggotaan Anda dengan mudah dalam satu aplikasi',
              'Manage your savings, loans, and membership easily in one application'
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-12 flex w-full max-w-sm flex-col gap-4 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <Button
            onClick={handleGetStarted}
            size="xl"
            variant="splash"
            className="group w-full"
            disabled={isCheckingSettings}
          >
            {isCheckingSettings ? t('Memeriksa...', 'Checking...') : t('Mulai', 'Get Started')}
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
          
          <Button
            onClick={onLogin}
            variant="splash-outline"
            size="xl"
            className="w-full"
          >
            <User className="mr-2 h-5 w-5" />
            {t('Akun Saya', 'My Account')}
          </Button>

        </div>

        {/* Footer removed as requested */}
      </div>
    </div>
  );
});

AuthLanding.displayName = 'AuthLanding';
