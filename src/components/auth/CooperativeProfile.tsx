import { useState, useEffect } from 'react';
import { ArrowLeft, Building2, Target, Briefcase, Wallet, FileText, Check, Banknote, X, BookOpen, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getCooperativeSettings, CooperativeSettings, AdArtDocument } from '@/lib/cooperativeSettings';
import { formatCurrency } from '@/lib/mockData';
import { getLogoFrameStyles, LogoFrameType, LogoZoomSize } from '@/lib/logoFrameUtils';
import { supabase } from '@/integrations/supabase/client';

interface CooperativeProfileProps {
  onBack: () => void;
  onRegister: () => void;
}

export const CooperativeProfile = ({ onBack, onRegister }: CooperativeProfileProps) => {
  const [hasReadADART, setHasReadADART] = useState(false);
  const [adartExpanded, setAdartExpanded] = useState(false);
  const [settings, setSettings] = useState<CooperativeSettings>(getCooperativeSettings());
  const [logoFrame, setLogoFrame] = useState<LogoFrameType>('circle');
  const [logoZoom, setLogoZoom] = useState<LogoZoomSize>('medium');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  
  // Extended settings from admin panel
  const [extendedSettings, setExtendedSettings] = useState({
    interestRate: 2,
    interestMethod: 'flat',
    tenorMin: 1,
    tenorMax: 12,
    minLoanAmount: 0,
    maxLoanAmount: 0,
    maxLoanMultiplier: 3,
    latePaymentPenalty: 0,
    latePaymentPenaltyType: 'daily',
    simpananSukarelaInterestRate: 0,
    simpananWajibDueDate: 25,
    withdrawalProcessDays: '1-3 hari kerja',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const { data, error } = await supabase
          .from('cooperative_settings')
          .select('key, value')
          .in('key', [
            // Basic cooperative info
            'cooperative_name',
            'cooperative_legal_number',
            'cooperative_address',
            'cooperative_founded_date',
            'cooperative_founding_date',
            'cooperative_logo_base64',
            'cooperative_vision',
            'cooperative_mission',
            'cooperative_services',
            'cooperative_ad_art_content',
            // Savings settings
            'simpanan_pokok',
            'simpanan_wajib',
            'cooperative_simpanan_sukarela_min',
            'cooperative_simpanan_sukarela_interest_rate',
            'simpanan_wajib_due_date',
            'cooperative_withdrawal_process_days',
            'cooperative_withdrawal_rules',
            // Loan settings
            'cooperative_interest_rate',
            'cooperative_interest_calculation_method',
            'cooperative_tenor_min',
            'cooperative_tenor_max',
            'cooperative_min_loan_amount',
            'cooperative_max_loan_amount',
            'cooperative_max_loan_multiplier',
            'cooperative_late_payment_penalty',
            'cooperative_late_payment_penalty_type',
            // Logo settings
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

          const localSettings = getCooperativeSettings();
          
          // Set extended settings from DB
          setExtendedSettings({
            interestRate: Number(dbData['cooperative_interest_rate']) || localSettings.interestRate || 2,
            interestMethod: String(dbData['cooperative_interest_calculation_method'] || 'flat'),
            tenorMin: Number(dbData['cooperative_tenor_min']) || localSettings.tenorMin || 1,
            tenorMax: Number(dbData['cooperative_tenor_max']) || localSettings.tenorMax || 12,
            minLoanAmount: Number(dbData['cooperative_min_loan_amount']) || 0,
            maxLoanAmount: Number(dbData['cooperative_max_loan_amount']) || 0,
            maxLoanMultiplier: Number(dbData['cooperative_max_loan_multiplier']) || localSettings.maxLoanMultiplier || 3,
            latePaymentPenalty: Number(dbData['cooperative_late_payment_penalty']) || localSettings.latePaymentPenalty || 0,
            latePaymentPenaltyType: String(dbData['cooperative_late_payment_penalty_type'] || 'daily'),
            simpananSukarelaInterestRate: Number(dbData['cooperative_simpanan_sukarela_interest_rate']) || 0,
            simpananWajibDueDate: Number(dbData['simpanan_wajib_due_date']) || localSettings.simpananWajibDueDate || 25,
            withdrawalProcessDays: String(dbData['cooperative_withdrawal_process_days'] || localSettings.withdrawalProcessDays || '1-3 hari kerja'),
          });
          
          // Handle founded_date - check both key names
          const foundedDate = dbData['cooperative_founding_date'] || dbData['cooperative_founded_date'] || localSettings.foundedDate;
          
          setSettings({
            ...localSettings,
            name: dbData['cooperative_name'] ?? localSettings.name,
            legalNumber: dbData['cooperative_legal_number'] ?? localSettings.legalNumber,
            address: dbData['cooperative_address'] ?? localSettings.address,
            foundedDate: foundedDate,
            logoBase64: dbData['cooperative_logo_base64'] ?? localSettings.logoBase64,
            vision: dbData['cooperative_vision'] ?? localSettings.vision,
            mission: Array.isArray(dbData['cooperative_mission']) ? dbData['cooperative_mission'] : localSettings.mission,
            services: Array.isArray(dbData['cooperative_services']) ? dbData['cooperative_services'] : localSettings.services,
            adArtContent: Array.isArray(dbData['cooperative_ad_art_content']) ? dbData['cooperative_ad_art_content'] : localSettings.adArtContent,
            simpananPokok: Number(dbData['simpanan_pokok']) || localSettings.simpananPokok,
            simpananWajib: Number(dbData['simpanan_wajib']) || localSettings.simpananWajib,
            simpananSukarelaMin: Number(dbData['cooperative_simpanan_sukarela_min']) || localSettings.simpananSukarelaMin,
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

    const handleSettingsUpdate = (event: CustomEvent<CooperativeSettings>) => {
      setSettings(event.detail);
    };

    window.addEventListener('cooperative-settings-updated', handleSettingsUpdate as EventListener);
    
    return () => {
      window.removeEventListener('cooperative-settings-updated', handleSettingsUpdate as EventListener);
    };
  }, []);
  
  const getInterestMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      'flat': 'Flat',
      'effective': 'Efektif',
      'declining': 'Menurun'
    };
    return methods[method] || method;
  };
  
  const getPenaltyTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'daily': 'per hari',
      'monthly': 'per bulan',
      'fixed': 'tetap'
    };
    return types[type] || type;
  };

  const handleProceedToRegister = () => {
    if (!hasReadADART) {
      toast.error('Harap baca dan setujui AD/ART terlebih dahulu');
      return;
    }
    onRegister();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Profil Koperasi</h1>
            <p className="text-sm text-muted-foreground">Informasi lengkap sebelum bergabung</p>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-80px)]">
        <div className="mx-auto max-w-2xl space-y-6 p-4 pb-32">
          {/* Identity */}
          <Card className="animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                Identitas Koperasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {isLoadingSettings ? (
                <div className="space-y-4">
                  <div className="flex justify-center pb-2">
                    <div className="h-20 w-20 rounded-full bg-muted animate-pulse" />
                  </div>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="grid grid-cols-[120px_1fr] gap-2">
                      <div className="h-4 w-16 rounded bg-muted/60 animate-pulse" />
                      <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Logo Display with Frame Settings */}
                  <div className="flex justify-center pb-2">
                    {(() => {
                      const frameStyles = getLogoFrameStyles(logoFrame, logoZoom, 'h-20 w-20');
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
                            <Building2 className={`h-10 w-10 ${frameStyles.iconClasses}`} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-muted-foreground">Nama</span>
                    <span className="font-medium">{settings.name}</span>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-muted-foreground">Badan Hukum</span>
                    <span className="font-medium">{settings.legalNumber}</span>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-muted-foreground">Alamat</span>
                    <span className="font-medium">{settings.address}</span>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-muted-foreground">Didirikan</span>
                    <span className="font-medium">{settings.foundedDate}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Vision & Mission */}
          <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                  <Target className="h-4 w-4 text-accent" />
                </div>
                Visi & Misi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold text-foreground mb-1">Visi</h4>
                <p className="text-muted-foreground">{settings.vision}</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Misi</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {settings.mission.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Services */}
          <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                  <Briefcase className="h-4 w-4 text-success" />
                </div>
                Jenis Layanan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {settings.services.map((service, index) => (
                  <div key={index} className="rounded-lg border border-border bg-muted/30 p-3">
                    <h4 className="font-medium text-foreground">{service.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Loan Rules */}
          <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
                  <Banknote className="h-4 w-4 text-warning" />
                </div>
                Aturan Pinjaman
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {isLoadingSettings ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="text-center">
                      <span className="text-3xl font-bold text-primary">{extendedSettings.interestRate}%</span>
                      <span className="text-muted-foreground ml-1">per bulan</span>
                    </div>
                    <p className="text-center text-muted-foreground mt-2">
                      Metode bunga: <span className="font-medium text-foreground">{getInterestMethodLabel(extendedSettings.interestMethod)}</span>
                    </p>
                  </div>
                  <div className="space-y-2 text-muted-foreground">
                    <p>• Tenor pinjaman: {extendedSettings.tenorMin} - {extendedSettings.tenorMax} bulan</p>
                    {(extendedSettings.minLoanAmount > 0 || extendedSettings.maxLoanAmount > 0) && (
                      <p>• Jumlah pinjaman: {formatCurrency(extendedSettings.minLoanAmount)} - {formatCurrency(extendedSettings.maxLoanAmount)}</p>
                    )}
                    <p>• Maksimal pinjaman: {extendedSettings.maxLoanMultiplier}x total simpanan</p>
                    {extendedSettings.latePaymentPenalty > 0 && (
                      <p>• Denda keterlambatan: {extendedSettings.latePaymentPenalty}% {getPenaltyTypeLabel(extendedSettings.latePaymentPenaltyType)}</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Savings Rules */}
          <Card className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                Aturan Simpanan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {isLoadingSettings ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <p>• Simpanan Pokok {formatCurrency(settings.simpananPokok)} dibayar sekali saat pendaftaran</p>
                  <p>• Simpanan Wajib {formatCurrency(settings.simpananWajib)} dibayar setiap bulan maksimal tanggal {extendedSettings.simpananWajibDueDate}</p>
                  <p>• Simpanan Sukarela minimal {formatCurrency(settings.simpananSukarelaMin)} per transaksi</p>
                  {extendedSettings.simpananSukarelaInterestRate > 0 && (
                    <p>• Bunga Simpanan Sukarela: <span className="text-success font-medium">{extendedSettings.simpananSukarelaInterestRate}% per bulan</span></p>
                  )}
                  <p>• Penarikan simpanan sukarela diproses {extendedSettings.withdrawalProcessDays}</p>
                  <p>• Simpanan Pokok & Wajib tidak dapat ditarik selama masih menjadi anggota</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* AD/ART */}
          <Card className="animate-fade-in border-primary/20" style={{ animationDelay: '0.5s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
                  <FileText className="h-4 w-4 text-destructive" />
                </div>
                Anggaran Dasar / Anggaran Rumah Tangga (AD/ART)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                variant="outline" 
                className="w-full justify-between"
                onClick={() => setAdartExpanded(true)}
              >
                <span className="font-medium">Baca Dokumen AD/ART Lengkap</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </Button>

              <div className="flex items-start gap-3 rounded-lg bg-primary/5 p-4">
                <Checkbox 
                  id="adart-agreement"
                  checked={hasReadADART}
                  onCheckedChange={(checked) => setHasReadADART(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="adart-agreement" className="text-sm leading-relaxed cursor-pointer">
                  Saya telah membaca, memahami, dan menyetujui seluruh isi Anggaran Dasar dan Anggaran Rumah Tangga (AD/ART) {settings.name}
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* AD/ART Sheet - Fullscreen Floating Modal with Tabs */}
          <Sheet open={adartExpanded} onOpenChange={setAdartExpanded}>
            <SheetContent side="bottom" className="h-[90vh] rounded-t-xl p-0">
              <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background px-4 py-4">
                <div className="flex items-center justify-between">
                  <SheetTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-destructive" />
                    AD/ART {settings.name}
                  </SheetTitle>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setAdartExpanded(false)}
                    className="shrink-0"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </SheetHeader>
              
              <Tabs defaultValue="ad" className="h-[calc(90vh-80px)]">
                <div className="px-4 pt-3 pb-2 border-b border-border bg-background">
                  <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-muted/50 rounded-xl">
                    <TabsTrigger 
                      value="ad" 
                      className="gap-2 py-3 px-4 rounded-lg font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-primary/20"
                    >
                      <FileText className="h-4 w-4" />
                      Anggaran Dasar
                    </TabsTrigger>
                    <TabsTrigger 
                      value="art" 
                      className="gap-2 py-3 px-4 rounded-lg font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-primary/20"
                    >
                      <BookOpen className="h-4 w-4" />
                      Anggaran Rumah Tangga
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                {/* Anggaran Dasar Tab */}
                <TabsContent value="ad" className="h-[calc(100%-50px)] mt-0">
                  <ScrollArea className="h-full">
                    <div className="p-4 pb-8 space-y-4">
                      {(settings.adContent?.chapters || []).length > 0 ? (
                        settings.adContent?.chapters.map((chapter, chapterIndex) => (
                          <Collapsible key={chapter.id} defaultOpen={chapterIndex === 0}>
                            <div className="rounded-lg border border-border overflow-hidden">
                              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-primary/5 hover:bg-primary/10 transition-colors">
                                <div className="flex items-center gap-3">
                                  <Badge variant="secondary" className="font-bold">
                                    Bab {chapterIndex + 1}
                                  </Badge>
                                  <span className="font-semibold text-foreground">{chapter.title}</span>
                                </div>
                                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-4 space-y-3">
                                  {chapter.articles.map((article, articleIndex) => (
                                    <div key={article.id} className="rounded-lg bg-muted/30 p-4">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline" className="text-xs font-semibold">
                                          {article.title || `Pasal ${articleIndex + 1}`}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-foreground leading-relaxed">
                                        {article.content}
                                      </p>
                                    </div>
                                  ))}
                                  {chapter.articles.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                      Tidak ada pasal dalam bab ini.
                                    </p>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        ))
                      ) : settings.adArtContent?.length > 0 ? (
                        // Fallback to legacy format
                        settings.adArtContent.map((item, index) => (
                          <div key={index} className="rounded-lg border border-border bg-muted/20 p-4">
                            <h4 className="font-semibold text-primary mb-2">Pasal {index + 1}</h4>
                            <p className="text-sm text-foreground leading-relaxed">{item}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Belum ada dokumen Anggaran Dasar.
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                {/* Anggaran Rumah Tangga Tab */}
                <TabsContent value="art" className="h-[calc(100%-50px)] mt-0">
                  <ScrollArea className="h-full">
                    <div className="p-4 pb-8 space-y-4">
                      {(settings.artContent?.chapters || []).length > 0 ? (
                        settings.artContent?.chapters.map((chapter, chapterIndex) => (
                          <Collapsible key={chapter.id} defaultOpen={chapterIndex === 0}>
                            <div className="rounded-lg border border-border overflow-hidden">
                              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-primary/5 hover:bg-primary/10 transition-colors">
                                <div className="flex items-center gap-3">
                                  <Badge variant="secondary" className="font-bold">
                                    Bab {chapterIndex + 1}
                                  </Badge>
                                  <span className="font-semibold text-foreground">{chapter.title}</span>
                                </div>
                                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-4 space-y-3">
                                  {chapter.articles.map((article, articleIndex) => (
                                    <div key={article.id} className="rounded-lg bg-muted/30 p-4">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline" className="text-xs font-semibold">
                                          {article.title || `Pasal ${articleIndex + 1}`}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-foreground leading-relaxed">
                                        {article.content}
                                      </p>
                                    </div>
                                  ))}
                                  {chapter.articles.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                      Tidak ada pasal dalam bab ini.
                                    </p>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Belum ada dokumen Anggaran Rumah Tangga.
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>
        </div>
      </ScrollArea>

      {/* Fixed Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm p-4 safe-area-pb">
        <div className="mx-auto max-w-2xl">
          <Button 
            onClick={handleProceedToRegister} 
            className="w-full" 
            size="lg"
            disabled={!hasReadADART}
          >
            {hasReadADART ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Lanjut Daftar
              </>
            ) : (
              'Baca & Setujui AD/ART untuk Melanjutkan'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
