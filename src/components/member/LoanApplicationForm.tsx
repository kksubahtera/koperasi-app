import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/mockData';
import { CreditCard, Calculator, Info, Send, AlertTriangle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { getCooperativeSettings, defaultCooperativeSettings } from '@/lib/cooperativeSettings';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserLoans } from '@/hooks/useUserLoans';
import { useUserSavings } from '@/hooks/useUserSavings';
import { useCollateralSettings } from '@/hooks/useCollateralSettings';
import { CollateralForm } from './CollateralForm';
import { z } from 'zod';

interface LoanSettings {
  minLoanAmount: number;
  maxLoanAmount: number;
  tenorMin: number;
  tenorMax: number;
  interestRate: number;
  interestCalculationMethod: 'flat' | 'effective';
  maxLoanMultiplier: number;
  requireSimpananPokokForLoan: boolean;
  requireMinSimpananWajibForLoan: boolean;
  minSimpananWajibForLoan: number;
}

export const LoanApplicationForm = () => {
  const localSettings = getCooperativeSettings();
  const { t } = useThemeLanguage();
  const { user } = useAuth();
  const { loans, refetch: refetchLoans } = useUserLoans();
  const { savings } = useUserSavings();
  const { settings: collateralSettings, isLoading: isLoadingCollateral } = useCollateralSettings();
  
  // State for settings from database
  const [dbSettings, setDbSettings] = useState<LoanSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  
  const [amount, setAmount] = useState(0);
  const [tenor, setTenor] = useState(0);
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Collateral state
  const [collateralData, setCollateralData] = useState<{
    collateralType: string;
    collateralDescription: string;
    estimatedValue: number;
    documentNumber: string;
  } | null>(null);
  const [custodianInfo, setCustodianInfo] = useState<{ name: string; position?: string } | null>(null);
  
  // Check if collateral is required
  const requiresCollateral = amount >= collateralSettings.collateralThreshold;

  // Calculate max loan based on multiplier and savings
  const maxLoanBasedOnSavings = useMemo(() => {
    const multiplier = dbSettings?.maxLoanMultiplier ?? localSettings.maxLoanMultiplier ?? 3;
    return savings.totalSimpanan * multiplier;
  }, [dbSettings, localSettings, savings.totalSimpanan]);

  // Check if current amount exceeds recommendation
  const exceedsRecommendation = useMemo(() => {
    return amount > maxLoanBasedOnSavings && maxLoanBasedOnSavings > 0;
  }, [amount, maxLoanBasedOnSavings]);

  // Fetch settings from database on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoadingSettings(true);
        
        // Fetch loan-related settings from cooperative_settings table
        const { data, error } = await supabase
          .from('cooperative_settings')
          .select('key, value')
          .in('key', [
            'loan_settings',
            'interestRate',
            'interestCalculationMethod',
            'minLoanAmount',
            'maxLoanAmount',
            'maxLoanMultiplier',
            'tenorMin',
            'tenorMax',
            'requireSimpananPokokForLoan',
            'requireMinSimpananWajibForLoan',
            'minSimpananWajibForLoan'
          ]);

        if (error) {
          console.error('Error fetching loan settings:', error);
          // Fallback to local settings
          setDbSettings({
            minLoanAmount: localSettings.minLoanAmount,
            maxLoanAmount: localSettings.maxLoanAmount,
            tenorMin: localSettings.tenorMin,
            tenorMax: localSettings.tenorMax,
            interestRate: localSettings.interestRate,
            interestCalculationMethod: localSettings.interestCalculationMethod || 'flat',
            maxLoanMultiplier: localSettings.maxLoanMultiplier || 3,
            requireSimpananPokokForLoan: localSettings.requireSimpananPokokForLoan ?? true,
            requireMinSimpananWajibForLoan: localSettings.requireMinSimpananWajibForLoan ?? false,
            minSimpananWajibForLoan: localSettings.minSimpananWajibForLoan ?? 100000,
          });
          return;
        }

        // Parse settings from database
        const settingsMap: Record<string, any> = {};
        data?.forEach((row) => {
          try {
            settingsMap[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          } catch {
            settingsMap[row.key] = row.value;
          }
        });

        // Check if we have loan_settings object or individual settings
        const loanSettingsObj = settingsMap['loan_settings'];
        
        const resolvedSettings: LoanSettings = {
          minLoanAmount: loanSettingsObj?.minLoanAmount ?? settingsMap['minLoanAmount'] ?? localSettings.minLoanAmount ?? defaultCooperativeSettings.minLoanAmount,
          maxLoanAmount: loanSettingsObj?.maxLoanAmount ?? settingsMap['maxLoanAmount'] ?? localSettings.maxLoanAmount ?? defaultCooperativeSettings.maxLoanAmount,
          tenorMin: loanSettingsObj?.tenorMin ?? settingsMap['tenorMin'] ?? localSettings.tenorMin ?? defaultCooperativeSettings.tenorMin,
          tenorMax: loanSettingsObj?.tenorMax ?? settingsMap['tenorMax'] ?? localSettings.tenorMax ?? defaultCooperativeSettings.tenorMax,
          interestRate: loanSettingsObj?.interestRate ?? settingsMap['interestRate'] ?? localSettings.interestRate ?? defaultCooperativeSettings.interestRate,
          interestCalculationMethod: loanSettingsObj?.interestCalculationMethod ?? settingsMap['interestCalculationMethod'] ?? localSettings.interestCalculationMethod ?? 'flat',
          maxLoanMultiplier: loanSettingsObj?.maxLoanMultiplier ?? settingsMap['maxLoanMultiplier'] ?? localSettings.maxLoanMultiplier ?? defaultCooperativeSettings.maxLoanMultiplier,
          requireSimpananPokokForLoan: loanSettingsObj?.requireSimpananPokokForLoan ?? settingsMap['requireSimpananPokokForLoan'] ?? localSettings.requireSimpananPokokForLoan ?? true,
          requireMinSimpananWajibForLoan: loanSettingsObj?.requireMinSimpananWajibForLoan ?? settingsMap['requireMinSimpananWajibForLoan'] ?? localSettings.requireMinSimpananWajibForLoan ?? false,
          minSimpananWajibForLoan: loanSettingsObj?.minSimpananWajibForLoan ?? settingsMap['minSimpananWajibForLoan'] ?? localSettings.minSimpananWajibForLoan ?? 100000,
        };

        setDbSettings(resolvedSettings);
      } catch (err) {
        console.error('Error in fetchSettings:', err);
        // Fallback to local settings
        setDbSettings({
          minLoanAmount: localSettings.minLoanAmount,
          maxLoanAmount: localSettings.maxLoanAmount,
          tenorMin: localSettings.tenorMin,
          tenorMax: localSettings.tenorMax,
          interestRate: localSettings.interestRate,
          interestCalculationMethod: localSettings.interestCalculationMethod || 'flat',
          maxLoanMultiplier: localSettings.maxLoanMultiplier || 3,
          requireSimpananPokokForLoan: localSettings.requireSimpananPokokForLoan ?? true,
          requireMinSimpananWajibForLoan: localSettings.requireMinSimpananWajibForLoan ?? false,
          minSimpananWajibForLoan: localSettings.minSimpananWajibForLoan ?? 100000,
        });
      } finally {
        setIsLoadingSettings(false);
      }
    };

    fetchSettings();
  }, []);

  // Use database settings with fallback
  const settings = useMemo(() => dbSettings ?? {
    minLoanAmount: localSettings.minLoanAmount,
    maxLoanAmount: localSettings.maxLoanAmount,
    tenorMin: localSettings.tenorMin,
    tenorMax: localSettings.tenorMax,
    interestRate: localSettings.interestRate,
    interestCalculationMethod: localSettings.interestCalculationMethod || 'flat',
    maxLoanMultiplier: localSettings.maxLoanMultiplier || 3,
    requireSimpananPokokForLoan: localSettings.requireSimpananPokokForLoan ?? true,
    requireMinSimpananWajibForLoan: localSettings.requireMinSimpananWajibForLoan ?? false,
    minSimpananWajibForLoan: localSettings.minSimpananWajibForLoan ?? 100000,
  }, [dbSettings, localSettings]);

  // Initialize amount and tenor when settings are loaded
  useEffect(() => {
    if (dbSettings) {
      setAmount(dbSettings.minLoanAmount);
      setTenor(dbSettings.tenorMin);
    }
  }, [dbSettings]);

  // Fetch custodian info when collateral is required
  useEffect(() => {
    const fetchCustodianInfo = async () => {
      if (!collateralSettings.collateralCustodianId) {
        setCustodianInfo(null);
        return;
      }
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', collateralSettings.collateralCustodianId)
          .single();
        
        if (data) {
          setCustodianInfo({ name: data.name, position: 'Pengurus' });
        }
      } catch (err) {
        console.error('Error fetching custodian info:', err);
      }
    };

    if (requiresCollateral) {
      fetchCustodianInfo();
    }
  }, [collateralSettings.collateralCustodianId, requiresCollateral]);

  // Validation schema using dynamic settings
  const loanApplicationSchema = useMemo(() => z.object({
    amount: z.number().min(settings.minLoanAmount).max(settings.maxLoanAmount),
    tenor: z.number().min(settings.tenorMin).max(settings.tenorMax),
    purpose: z.string().trim().min(10, 'Tujuan pinjaman minimal 10 karakter').max(500, 'Tujuan pinjaman maksimal 500 karakter'),
  }), [settings]);

  // Check if user has active/pending loan
  const hasActiveLoan = loans.some(l => l.status === 'active');
  const hasPendingLoan = loans.some(l => l.status === 'pending' as any);
  
  // Check if user has paid simpanan pokok
  const hasPaidSimpananPokok = savings.simpananPokok > 0;
  const requiresSimpananPokok = settings.requireSimpananPokokForLoan;

  // Check if user meets minimum simpanan wajib requirement
  const requiresMinSimpananWajib = settings.requireMinSimpananWajibForLoan;
  const minSimpananWajibRequired = settings.minSimpananWajibForLoan ?? 100000;
  const meetsMinSimpananWajib = savings.simpananWajib >= minSimpananWajibRequired;

  // Use interest rate from settings (convert from percentage to decimal)
  const interestRate = settings.interestRate / 100;
  const calculationMethod = settings.interestCalculationMethod || 'flat';
  
  // Calculate installments based on interest calculation method
  const calculateInstallments = () => {
    if (amount === 0 || tenor === 0) return [];
    
    const installments: { principal: number; interest: number; total: number }[] = [];
    let remainingPrincipal = amount;
    
    // Calculate principal per month with 50k multiples
    const basePrincipal = Math.floor(amount / tenor / 50000) * 50000;
    const remainder = amount - (basePrincipal * tenor);
    const monthsWithExtra = Math.round(remainder / 50000);
    
    for (let i = 0; i < tenor; i++) {
      const principalThisMonth = i < monthsWithExtra ? basePrincipal + 50000 : basePrincipal;
      
      // Calculate interest based on method
      let interestThisMonth: number;
      if (calculationMethod === 'effective') {
        // Effective (declining): interest calculated from remaining principal
        interestThisMonth = remainingPrincipal * interestRate;
      } else {
        // Flat: interest calculated from original principal amount
        interestThisMonth = amount * interestRate;
      }
      
      installments.push({
        principal: principalThisMonth,
        interest: interestThisMonth,
        total: principalThisMonth + interestThisMonth,
      });
      
      remainingPrincipal -= principalThisMonth;
    }
    
    return installments;
  };

  const installments = calculateInstallments();
  const totalInterest = installments.reduce((sum, i) => sum + i.interest, 0);

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error(t('Silakan login terlebih dahulu', 'Please login first'));
      return;
    }

    // Validate input
    const validation = loanApplicationSchema.safeParse({ amount, tenor, purpose });
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    if (hasActiveLoan) {
      toast.error(t('Anda masih memiliki pinjaman aktif. Lunasi terlebih dahulu sebelum mengajukan pinjaman baru.', 'You still have an active loan. Please pay it off first before applying for a new loan.'));
      return;
    }

    if (hasPendingLoan) {
      toast.error(t('Anda memiliki pengajuan pinjaman yang sedang diproses.', 'You have a pending loan application being processed.'));
      return;
    }

    // Check simpanan pokok requirement
    if (requiresSimpananPokok && !hasPaidSimpananPokok) {
      toast.error(t('Anda harus membayar simpanan pokok terlebih dahulu sebelum mengajukan pinjaman.', 'You must pay the principal savings first before applying for a loan.'));
      return;
    }

    // Check simpanan wajib minimum requirement
    if (requiresMinSimpananWajib && !meetsMinSimpananWajib) {
      toast.error(t(
        `Anda harus memiliki simpanan wajib minimal Rp ${minSimpananWajibRequired.toLocaleString('id-ID')} sebelum mengajukan pinjaman. Simpanan wajib Anda saat ini: Rp ${savings.simpananWajib.toLocaleString('id-ID')}.`,
        `You must have at least Rp ${minSimpananWajibRequired.toLocaleString('id-ID')} in mandatory savings before applying for a loan. Your current mandatory savings: Rp ${savings.simpananWajib.toLocaleString('id-ID')}.`
      ));
      return;
    }

    // Check collateral requirement
    if (requiresCollateral) {
      if (!collateralData || !collateralData.collateralType) {
        toast.error(t('Pinjaman di atas batas agunan memerlukan data agunan.', 'Loans above collateral threshold require collateral data.'));
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Insert loan application
      const { data: loanData, error: loanError } = await supabase
        .from('loans')
        .insert({
          user_id: user.id,
          principal_amount: amount,
          tenor: tenor,
          interest_rate: interestRate, // Store as decimal (0.02 for 2%)
          status: 'pending',
          application_date: new Date().toISOString().split('T')[0],
          remaining_principal: amount,
          requires_collateral: requiresCollateral,
          collateral_status: requiresCollateral ? 'submitted' : null,
        })
        .select()
        .single();

      if (loanError) {
        console.error('Error creating loan application:', loanError);
        toast.error(t('Gagal mengajukan pinjaman. Silakan coba lagi.', 'Failed to submit loan application. Please try again.'));
        return;
      }

      // Insert collateral data if required
      if (requiresCollateral && collateralData && loanData) {
        const { error: collateralError } = await supabase
          .from('loan_collaterals')
          .insert({
            loan_id: loanData.id,
            collateral_type: collateralData.collateralType,
            collateral_description: collateralData.collateralDescription || null,
            estimated_value: collateralData.estimatedValue || 0,
            document_number: collateralData.documentNumber || null,
            status: 'pending',
          });

        if (collateralError) {
          console.error('Error creating collateral:', collateralError);
          // Don't fail the loan application, just log the error
        }
      }

      toast.success(t(
        requiresCollateral 
          ? 'Pengajuan pinjaman dengan agunan berhasil dikirim. Menunggu verifikasi admin.'
          : 'Pengajuan pinjaman berhasil dikirim. Menunggu verifikasi admin.', 
        requiresCollateral
          ? 'Loan application with collateral submitted successfully. Awaiting admin verification.'
          : 'Loan application submitted successfully. Awaiting admin verification.'
      ));
      
      // Reset form
      setAmount(settings.minLoanAmount);
      setTenor(settings.tenorMin);
      setPurpose('');
      setCollateralData(null);
      
      // Refetch loans to update the list
      await refetchLoans();
    } catch (err) {
      console.error('Error in loan application:', err);
      toast.error(t('Terjadi kesalahan. Silakan coba lagi.', 'An error occurred. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading skeleton while fetching settings
  if (isLoadingSettings) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-48 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/40">
            <CardHeader className="pb-3 pt-4 px-4">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-full" />
              </div>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardHeader className="pb-3 pt-4 px-4">
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('Ajukan Pinjaman', 'Apply for Loan')}</h1>
        <p className="text-sm text-muted-foreground">{t('Simulasikan dan ajukan pinjaman', 'Simulate and apply for a loan')}</p>
      </div>

      {/* Warning if simpanan pokok not paid */}
      {requiresSimpananPokok && !hasPaidSimpananPokok && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {t(
              'Anda belum membayar simpanan pokok. Silakan bayar simpanan pokok terlebih dahulu sebelum mengajukan pinjaman.',
              'You have not paid the principal savings. Please pay the principal savings first before applying for a loan.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Warning if simpanan wajib not enough */}
      {requiresMinSimpananWajib && !meetsMinSimpananWajib && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {t(
              `Simpanan wajib Anda (Rp ${savings.simpananWajib.toLocaleString('id-ID')}) belum mencapai minimal Rp ${minSimpananWajibRequired.toLocaleString('id-ID')}. Silakan setorkan simpanan wajib terlebih dahulu.`,
              `Your mandatory savings (Rp ${savings.simpananWajib.toLocaleString('id-ID')}) has not reached the minimum of Rp ${minSimpananWajibRequired.toLocaleString('id-ID')}. Please deposit mandatory savings first.`
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Savings-based limit info */}
      {savings.totalSimpanan > 0 && (
        <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-md p-3 border border-border/50">
          <Info className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="space-y-0.5">
            <p className="text-muted-foreground">
              {t('Total Simpanan Anda', 'Your Total Savings')}: <span className="font-medium text-foreground">{formatCurrency(savings.totalSimpanan)}</span>
            </p>
            <p className="text-muted-foreground">
              {t('Batas pinjaman yang direkomendasikan', 'Recommended loan limit')} ({settings.maxLoanMultiplier}x): <span className="font-medium text-foreground">{formatCurrency(maxLoanBasedOnSavings)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Warning if exceeds recommendation */}
      {exceedsRecommendation && (
        <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700 dark:text-yellow-400 text-xs">
            {t(
              `Jumlah pinjaman melebihi ${settings.maxLoanMultiplier}x total simpanan Anda. Pengajuan tetap dapat diproses namun memerlukan pertimbangan khusus dari pengurus koperasi.`,
              `Loan amount exceeds ${settings.maxLoanMultiplier}x your total savings. Application can still be processed but requires special consideration from cooperative management.`
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Collateral requirement alert */}
      {requiresCollateral && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
            {t(
              `Pinjaman di atas ${formatCurrency(collateralSettings.collateralThreshold)} memerlukan agunan. Silakan lengkapi data agunan di bawah.`,
              `Loans above ${formatCurrency(collateralSettings.collateralThreshold)} require collateral. Please complete the collateral information below.`
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Collateral Form */}
      {requiresCollateral && (
        <CollateralForm
          collateralTypes={collateralSettings.collateralTypes}
          custodianName={custodianInfo?.name}
          custodianPosition={custodianInfo?.position}
          onCollateralChange={setCollateralData}
          minValue={amount * (collateralSettings.collateralMinValueRatio / 100)}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Form - Compact */}
        <Card className="border-border/40">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              {t('Detail Pinjaman', 'Loan Details')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {/* Amount Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('Jumlah', 'Amount')}</Label>
                <span className={`text-sm font-bold ${exceedsRecommendation ? 'text-yellow-600' : 'text-primary'}`}>{formatCurrency(amount)}</span>
              </div>
              <Slider
                value={[amount]}
                onValueChange={(v) => setAmount(v[0])}
                min={settings.minLoanAmount}
                max={settings.maxLoanAmount}
                step={100000}
                className={exceedsRecommendation ? '[&_[role=slider]]:border-yellow-500 [&_[role=slider]]:bg-yellow-500' : ''}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatCurrency(settings.minLoanAmount)}</span>
                {maxLoanBasedOnSavings > 0 && maxLoanBasedOnSavings < settings.maxLoanAmount && (
                  <span className="text-yellow-600">↓ {formatCurrency(maxLoanBasedOnSavings)}</span>
                )}
                <span>{formatCurrency(settings.maxLoanAmount)}</span>
              </div>
            </div>

            {/* Tenor Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('Tenor', 'Tenor')}</Label>
                <span className="text-sm font-bold text-primary">{tenor} {t('bln', 'mo')}</span>
              </div>
              <Slider
                value={[tenor]}
                onValueChange={(v) => setTenor(v[0])}
                min={settings.tenorMin}
                max={settings.tenorMax}
                step={1}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{settings.tenorMin} {t('bln', 'mo')}</span>
                <span>{settings.tenorMax} {t('bln', 'mo')}</span>
              </div>
            </div>

            {/* Purpose */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('Tujuan Penggunaan', 'Purpose')}</Label>
              <Textarea
                placeholder={t('Jelaskan tujuan pinjaman...', 'Explain loan purpose...')}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="min-h-[80px] text-sm resize-none"
              />
            </div>

            <Button 
              className="w-full h-9 text-sm" 
              onClick={handleSubmit}
              disabled={isSubmitting || (requiresSimpananPokok && !hasPaidSimpananPokok)}
            >
              {isSubmitting ? (
                t('Mengirim...', 'Submitting...')
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  {t('Kirim Pengajuan', 'Submit')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Simulation - Compact */}
        <Card className="border-border/40">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              {t('Simulasi', 'Simulation')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Interest Info */}
            <div className="flex items-center gap-2 text-xs bg-primary/5 rounded-md p-2 border border-primary/10">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span>
                {t('Bunga', 'Interest')} {settings.interestRate}% {' '}
                {calculationMethod === 'effective' ? t('efektif', 'effective') : t('flat', 'flat')}
              </span>
            </div>

            {/* Summary */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">{t('Pokok', 'Principal')}</span>
                <span className="font-medium">{formatCurrency(amount)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">{t('Tenor', 'Tenor')}</span>
                <span className="font-medium">{tenor} {t('bulan', 'months')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">{t('Total Bunga', 'Total Interest')}</span>
                <span className="font-medium">{formatCurrency(totalInterest)}</span>
              </div>
              <div className="flex justify-between py-2 bg-primary/5 rounded-md px-2 -mx-2">
                <span className="font-medium">{t('Total Bayar', 'Total Payment')}</span>
                <span className="font-bold text-primary">{formatCurrency(amount + totalInterest)}</span>
              </div>
            </div>

            {/* Installments - Compact List */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t('Detail Angsuran', 'Installment Details')}</p>
              <div className="max-h-36 overflow-y-auto space-y-0.5 bg-muted/30 rounded-md p-2">
                {installments.map((inst, index) => (
                  <div key={index} className="flex justify-between text-xs py-1 border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground">{t('Bln', 'Mo')} {index + 1}</span>
                    <div className="text-right">
                      <span className="font-medium text-primary">{formatCurrency(inst.total)}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">
                        (P:{formatCurrency(inst.principal)})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              * {t('Pokok dibulatkan kelipatan Rp50.000', 'Principal rounded to Rp50,000')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};