import { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { getCooperativeSettings, CooperativeSettings } from '@/lib/cooperativeSettings';
import { formatDate } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Building2, CreditCard, User, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getLogoFrameStylesForCard, LogoFrameType, LogoContainerSize, getContainerSize } from '@/lib/logoFrameUtils';
import { useBranches } from '@/hooks/useBranches';

interface DigitalMemberCardProps {
  open: boolean;
  onClose: () => void;
}

export const DigitalMemberCard = ({ open, onClose }: DigitalMemberCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { t } = useThemeLanguage();
  const [settings, setSettings] = useState<CooperativeSettings>(getCooperativeSettings());
  const [logoFrame, setLogoFrame] = useState<LogoFrameType>('circle');
  const [logoContainerSize, setLogoContainerSize] = useState<LogoContainerSize>('default');
  const [cardGradientDirection, setCardGradientDirection] = useState<'diagonal' | 'horizontal' | 'vertical'>('diagonal');
  const [cardUseGenderColors, setCardUseGenderColors] = useState(false);
  const [cardGradientStart, setCardGradientStart] = useState('#6366f1');
  const [cardGradientEnd, setCardGradientEnd] = useState('#8b5cf6');
  const [cardGradientMaleStart, setCardGradientMaleStart] = useState('#3b82f6');
  const [cardGradientMaleEnd, setCardGradientMaleEnd] = useState('#1d4ed8');
  const [cardGradientFemaleStart, setCardGradientFemaleStart] = useState('#ec4899');
  const [cardGradientFemaleEnd, setCardGradientFemaleEnd] = useState('#db2777');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [memberBranchId, setMemberBranchId] = useState<string | null>(null);
  const { getBranchById, branchFeatureEnabled, isLoading: branchesLoading } = useBranches();

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const { data, error } = await supabase
          .from('cooperative_settings')
          .select('key, value')
          .in('key', [
            'cooperative_name',
            'cooperative_legal_number',
            'cooperative_logo_base64',
            'logo_frame',
            'logo_container_card',
            'card_gradient_direction',
            'card_use_gender_colors',
            'card_gradient_start',
            'card_gradient_end',
            'card_gradient_male_start',
            'card_gradient_male_end',
            'card_gradient_female_start',
            'card_gradient_female_end',
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

          // Get logo frame setting directly from individual key
          if (dbData['logo_frame']) {
            setLogoFrame(dbData['logo_frame'] as LogoFrameType);
          }
          
          // Get logo container size for card context
          if (dbData['logo_container_card']) {
            setLogoContainerSize(dbData['logo_container_card'] as LogoContainerSize);
          }
          
          // Get card gradient colors
          if (dbData['card_gradient_direction']) {
            setCardGradientDirection(dbData['card_gradient_direction'] as 'diagonal' | 'horizontal' | 'vertical');
          }
          if (dbData['card_use_gender_colors'] === true || dbData['card_use_gender_colors'] === 'true') {
            setCardUseGenderColors(true);
          }
          if (dbData['card_gradient_start']) {
            setCardGradientStart(dbData['card_gradient_start'] as string);
          }
          if (dbData['card_gradient_end']) {
            setCardGradientEnd(dbData['card_gradient_end'] as string);
          }
          if (dbData['card_gradient_male_start']) {
            setCardGradientMaleStart(dbData['card_gradient_male_start'] as string);
          }
          if (dbData['card_gradient_male_end']) {
            setCardGradientMaleEnd(dbData['card_gradient_male_end'] as string);
          }
          if (dbData['card_gradient_female_start']) {
            setCardGradientFemaleStart(dbData['card_gradient_female_start'] as string);
          }
          if (dbData['card_gradient_female_end']) {
            setCardGradientFemaleEnd(dbData['card_gradient_female_end'] as string);
          }

          const localSettings = getCooperativeSettings();
          setSettings({
            ...localSettings,
            name: dbData['cooperative_name'] ?? localSettings.name,
            legalNumber: dbData['cooperative_legal_number'] ?? localSettings.legalNumber,
            logoBase64: dbData['cooperative_logo_base64'] ?? localSettings.logoBase64,
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
    
    if (open) fetchSettings();

    // Fetch member branch
    const fetchMemberBranch = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('branch_id')
        .eq('user_id', user.id)
        .single();
      if (data?.branch_id) setMemberBranchId(data.branch_id);
    };
    if (open) fetchMemberBranch();

    const handleSettingsUpdate = (event: CustomEvent<CooperativeSettings>) => {
      setSettings(event.detail);
    };

    window.addEventListener('cooperative-settings-updated', handleSettingsUpdate as EventListener);
    
    return () => {
      window.removeEventListener('cooperative-settings-updated', handleSettingsUpdate as EventListener);
    };
  }, [open]);

  if (!user) return null;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });
      
      const link = document.createElement('a');
      link.download = `member-card-${user.memberNumber}-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to download card:', error);
    }
  };

  const containerSizeClass = getContainerSize(logoContainerSize, 'card');
  const frameStyles = getLogoFrameStylesForCard(logoFrame, containerSizeClass);

  const renderLogo = () => {
    if (isLoadingSettings) {
      return <div className="h-12 w-12 rounded-full bg-white/30 animate-pulse" />;
    }
    if (settings.logoBase64) {
      return (
        <div className={frameStyles.containerClasses}>
          <img 
            src={settings.logoBase64} 
            alt={settings.name} 
            className={frameStyles.imageClasses}
          />
        </div>
      );
    }
    return (
      <div className={frameStyles.containerClasses}>
        <div className={frameStyles.iconContainerClasses}>
          <Building2 className={`h-6 w-6 ${frameStyles.iconClasses}`} />
        </div>
      </div>
    );
  };

  // Render member photo
  const renderMemberPhoto = () => {
    if (user.profilePhoto) {
      return (
        <img 
          src={user.profilePhoto} 
          alt={user.name}
          className="w-20 h-20 rounded-xl object-cover border-2 border-white/80 shadow-xl ring-2 ring-white/20"
        />
      );
    }
    return (
      <div className="w-20 h-20 rounded-xl bg-white/15 border-2 border-white/80 flex items-center justify-center shadow-xl ring-2 ring-white/20">
        <User className="h-10 w-10 text-white/70" />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('Kartu Anggota Digital', 'Digital Member Card')}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Card Front */}
          <div ref={cardRef}>
            <Card className="overflow-hidden border-0 shadow-2xl">
              {/* Card Front */}
              <div 
                className="relative p-6 text-white min-h-[220px]"
                style={{
                  background: (() => {
                    const angle = cardGradientDirection === 'diagonal' ? '135deg' : 
                                  cardGradientDirection === 'horizontal' ? '90deg' : '180deg';
                    let startColor = cardGradientStart;
                    let endColor = cardGradientEnd;
                    
                    if (cardUseGenderColors && user?.gender) {
                      if (user.gender.toLowerCase() === 'laki-laki' || user.gender.toLowerCase() === 'male' || user.gender.toLowerCase() === 'pria') {
                        startColor = cardGradientMaleStart;
                        endColor = cardGradientMaleEnd;
                      } else if (user.gender.toLowerCase() === 'perempuan' || user.gender.toLowerCase() === 'female' || user.gender.toLowerCase() === 'wanita') {
                        startColor = cardGradientFemaleStart;
                        endColor = cardGradientFemaleEnd;
                      }
                    }
                    
                    return `linear-gradient(${angle}, ${startColor} 0%, ${endColor} 100%)`;
                  })(),
                }}
              >
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                
                {/* Header */}
                <div className="relative flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    {renderLogo()}
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{settings.name}</h3>
                      <p className="text-xs text-white/70">{t('Kartu Anggota', 'Member Card')}</p>
                    </div>
                  </div>
                  {/* Branch Badge - Premium Design */}
                  {!branchesLoading && branchFeatureEnabled && memberBranchId && getBranchById(memberBranchId) && (
                    <div 
                      className="relative flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg backdrop-blur-sm border border-white/20 max-w-[100px]"
                      style={{ 
                        background: `linear-gradient(135deg, ${getBranchById(memberBranchId)?.badge_color}cc 0%, ${getBranchById(memberBranchId)?.badge_color} 100%)`,
                      }}
                    >
                      <Building2 className="h-5 w-5 text-white/90 shrink-0" />
                      <span className="text-xs font-semibold text-white tracking-wide leading-tight">
                        {getBranchById(memberBranchId)?.name}
                      </span>
                      {/* Glossy effect */}
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/25 to-transparent pointer-events-none" style={{ height: '50%' }} />
                    </div>
                  )}
                </div>

                {/* Member Info */}
                <div className="relative space-y-4">
                  <div>
                    <p className="text-xs text-white/70 uppercase tracking-wider mb-1">{t('Nama Anggota', 'Member Name')}</p>
                    <p className="font-semibold text-xl">{user.name}</p>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-white/70 uppercase tracking-wider mb-1">{t('No. Anggota', 'Member No.')}</p>
                      <p className="font-mono font-bold text-lg tracking-wider">{user.memberNumber}</p>
                    </div>
                    
                    {/* Member Photo */}
                    {renderMemberPhoto()}
                  </div>
                </div>
              </div>

              {/* Card Back / Additional Info */}
              <div className="bg-card p-4 space-y-3 border-t border-border">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('Bergabung', 'Joined')}</p>
                      <p className="font-medium">{formatDate(user.joinDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className={`font-medium ${user.isActive ? 'text-success' : 'text-destructive'}`}>
                        {user.isActive ? t('Aktif', 'Active') : t('Tidak Aktif', 'Inactive')}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
                  {settings.address}
                </div>
              </div>
            </Card>
          </div>

          {/* Download Button */}
          <Button onClick={handleDownload} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            {t('Unduh Kartu Anggota', 'Download Member Card')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};