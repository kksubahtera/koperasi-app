import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, User, Building2 } from 'lucide-react';
import { RealtimeIndicator } from '@/components/shared/RealtimeIndicator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCooperativeSettings, CooperativeSettings } from '@/lib/cooperativeSettings';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';
import { NotificationDropdown } from '@/components/shared/NotificationDropdown';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { getLogoFrameStyles, LogoFrameType, LogoZoomSize, LogoContainerSize, getContainerSize } from '@/lib/logoFrameUtils';
import { cn } from '@/lib/utils';

export const AppHeader = () => {
  const { user, logout } = useAuth();
  const { t } = useThemeLanguage();
  const [settings, setSettings] = useState<CooperativeSettings>(getCooperativeSettings());
  const [logoFrame, setLogoFrame] = useState<LogoFrameType>('circle');
  const [logoZoom, setLogoZoom] = useState<LogoZoomSize>('medium');
  const [logoContainerSize, setLogoContainerSize] = useState<LogoContainerSize>('default');
  const [isVisible, setIsVisible] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoadingSettings(true);
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
            'logo_container_header',
          ]);

        if (error) {
          console.error('Error fetching header settings:', error);
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
          if (dbData['logo_container_header']) {
            setLogoContainerSize(dbData['logo_container_header'] as LogoContainerSize);
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

  // Handle scroll to show/hide header
  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const scrollDiff = currentScrollY - lastScrollY.current;
          
          // Only hide if scrolled down more than 10px and past initial 100px
          if (scrollDiff > 10 && currentScrollY > 100) {
            setIsVisible(false);
          } 
          // Show if scrolling up more than 5px or near top
          else if (scrollDiff < -5 || currentScrollY < 50) {
            setIsVisible(true);
          }
          
          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavigate = (view: string) => {
    window.dispatchEvent(new CustomEvent(`navigate-to-${view}`));
  };

  const containerSizeClass = getContainerSize(logoContainerSize, 'header');
  const frameStyles = getLogoFrameStyles(logoFrame, logoZoom, containerSizeClass);

  return (
    <header 
      className={cn(
        "sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 transition-transform duration-300 ease-out",
        !isVisible && "-translate-y-full"
      )}
    >
      <div className="flex h-auto min-h-12 md:min-h-14 items-center justify-between px-3 md:px-6 py-1.5 md:py-2 gap-2">
        {/* Logo and Name */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          {isLoadingSettings ? (
            <>
              <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-24 md:w-32 rounded bg-muted animate-pulse" />
                <div className="h-2 w-16 md:w-24 rounded bg-muted/60 animate-pulse" />
              </div>
            </>
          ) : (
            <>
              <div className={`${frameStyles.containerClasses} transition-transform hover:scale-105 shrink-0`}>
                {settings.logoBase64 ? (
                  <img 
                    src={settings.logoBase64} 
                    alt={settings.name} 
                    className={frameStyles.imageClasses}
                  />
                ) : (
                  <div className={frameStyles.iconContainerClasses}>
                    <Building2 className={`h-4 w-4 md:h-5 md:w-5 ${frameStyles.iconClasses}`} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[11px] sm:text-xs md:text-sm font-bold text-foreground leading-tight line-clamp-1">
                  {settings.name}
                </h1>
                <p className="text-[9px] md:text-[10px] text-muted-foreground truncate leading-tight">
                  {settings.legalNumber}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Right side: Live Indicator + Notifications + Role Switcher + User Menu */}
        {user && (
          <div className="flex items-center gap-1.5 md:gap-2">
            {/* Live Indicator - for admin only */}
            {user.activeRole === 'admin' && (
              <RealtimeIndicator />
            )}

            {/* Notification Dropdown - only for members */}
            {user.activeRole === 'member' && (
              <NotificationDropdown onNavigate={handleNavigate} />
            )}

            {/* Role Switcher - only shows if user has multiple roles */}
            <RoleSwitcher />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-9 px-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 overflow-hidden border-2 border-primary/20">
                    {user.profilePhoto ? (
                      <img 
                        src={user.profilePhoto} 
                        alt={user.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {user.activeRole === 'admin' ? t('Admin', 'Admin') : t('Anggota', 'Member')}
                    </span>
                    <span className="max-w-[100px] truncate text-sm font-medium leading-tight">
                      {user.name.split(' ')[0]}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border z-50">
                <DropdownMenuLabel>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 overflow-hidden border-2 border-primary/20">
                      {user.profilePhoto ? (
                        <img 
                          src={user.profilePhoto} 
                          alt={user.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.memberNumber}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('Keluar', 'Logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
};
