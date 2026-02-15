import { useState, useEffect, forwardRef } from 'react';
import { Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getLogoFrameStyles, LogoFrameType, LogoZoomSize, LogoContainerSize, getContainerSize } from '@/lib/logoFrameUtils';
import { getCooperativeSettings, CooperativeSettings, defaultCooperativeSettings } from '@/lib/cooperativeSettings';

export const AppFooter = forwardRef<HTMLElement>(function AppFooter(_, ref) {
  const [settings, setSettings] = useState<CooperativeSettings>(getCooperativeSettings());
  const [logoFrame, setLogoFrame] = useState<LogoFrameType>('circle');
  const [logoZoom, setLogoZoom] = useState<LogoZoomSize>('medium');
  const [logoContainerSize, setLogoContainerSize] = useState<LogoContainerSize>('default');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        // Fetch settings from database
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
            'logo_container_footer',
          ]);

        if (error) {
          console.error('Error fetching footer settings:', error);
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
          if (dbData['logo_container_footer']) {
            setLogoContainerSize(dbData['logo_container_footer'] as LogoContainerSize);
          }

          // Merge with local settings
          const localSettings = getCooperativeSettings();
          setSettings({
            ...localSettings,
            name: dbData['cooperative_name'] ?? localSettings.name,
            legalNumber: dbData['cooperative_legal_number'] ?? localSettings.legalNumber,
            address: dbData['cooperative_address'] ?? localSettings.address,
            logoBase64: dbData['cooperative_logo_base64'] ?? localSettings.logoBase64,
          });
        } else {
          setSettings(getCooperativeSettings());
        }
      } catch (err) {
        console.error('Error in fetchSettings:', err);
        setSettings(getCooperativeSettings());
      } finally {
        setIsLoading(false);
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

  const containerSizeClass = getContainerSize(logoContainerSize, 'footer');
  const frameStyles = getLogoFrameStyles(logoFrame, logoZoom, containerSizeClass);

  return (
    <footer ref={ref} className="border-t border-border bg-card/50 py-4 md:py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center gap-2 md:gap-3 text-center">
          {isLoading ? (
            <>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-40 rounded bg-muted/60 animate-pulse mx-auto" />
                <div className="h-3 w-48 rounded bg-muted/60 animate-pulse mx-auto" />
              </div>
              <div className="h-2.5 w-28 rounded bg-muted/40 animate-pulse" />
            </>
          ) : (
            <>
              {/* Logo and Name */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className={`${frameStyles.containerClasses} shrink-0`}>
                  {settings.logoBase64 ? (
                    <img 
                      src={settings.logoBase64} 
                      alt={settings.name} 
                      className={frameStyles.imageClasses}
                    />
                  ) : (
                    <div className={frameStyles.iconContainerClasses}>
                      <Building2 className={`h-4 w-4 ${frameStyles.iconClasses}`} />
                    </div>
                  )}
                </div>
                <span className="font-semibold text-foreground text-sm md:text-base text-center leading-tight px-2">
                  {settings.name}
                </span>
              </div>
              
              {/* Legal and Address Info */}
              <div className="text-[10px] md:text-xs text-muted-foreground space-y-0.5 md:space-y-1 max-w-xs sm:max-w-md md:max-w-lg">
                <p className="leading-tight">{settings.legalNumber}</p>
                <p className="leading-tight">{settings.address}</p>
              </div>
              
              {/* Copyright */}
              <p className="text-[10px] md:text-xs text-muted-foreground/70 leading-tight">
                © {new Date().getFullYear()} {settings.name}
              </p>
            </>
          )}
        </div>
      </div>
    </footer>
  );
});
