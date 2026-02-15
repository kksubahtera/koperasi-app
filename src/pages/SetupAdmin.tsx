import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Shield, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Key, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ThemeLanguageToggle } from '@/components/shared/ThemeLanguageToggle';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const adminSchema = z.object({
  setupKey: z.string().min(1, 'Setup Key wajib diisi'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  name: z.string().min(1, 'Nama wajib diisi').max(255, 'Nama terlalu panjang'),
});

export default function SetupAdmin() {
  const navigate = useNavigate();
  const { t } = useThemeLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSetupKey, setShowSetupKey] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const [formData, setFormData] = useState({
    setupKey: '',
    email: '',
    password: '',
    name: '',
  });

  // Delay helper for retries
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Verify admin status after creation
  const verifyAdminStatus = useCallback(async (email: string): Promise<boolean> => {
    try {
      // Check if admin role exists for this email
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, approval_status, is_active')
        .eq('email', email.toLowerCase())
        .single();
      
      if (!profiles) return false;
      
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profiles.user_id)
        .eq('role', 'admin')
        .single();
      
      return !!roles && profiles.approval_status === 'approved' && profiles.is_active;
    } catch {
      return false;
    }
  }, []);

  // Create admin with retry logic
  const createAdminWithRetry = useCallback(async (attempt: number = 1): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-admin', {
        body: {
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          name: formData.name.trim(),
          setup_key: formData.setupKey,
        },
      });

      if (invokeError) {
        console.error(`Edge function error (attempt ${attempt}):`, invokeError);
        
        // Retry on network errors
        if (attempt < MAX_RETRIES && (invokeError.message?.includes('network') || invokeError.message?.includes('timeout'))) {
          await delay(RETRY_DELAY_MS * attempt);
          setRetryCount(attempt);
          return createAdminWithRetry(attempt + 1);
        }
        
        return { success: false, error: invokeError.message || 'Terjadi kesalahan saat membuat akun admin' };
      }

      if (data?.error) {
        // Handle specific error messages from edge function
        let errorMessage = data.error;
        if (data.error.includes('Invalid setup key')) {
          errorMessage = 'Setup Key tidak valid';
        } else if (data.error.includes('admin already exists')) {
          errorMessage = 'Admin sudah ada. Silakan login sebagai admin.';
        } else if (data.error.includes('Too many attempts')) {
          errorMessage = 'Terlalu banyak percobaan. Silakan coba lagi nanti.';
        } else if (data.error.includes('not configured')) {
          errorMessage = 'Pembuatan admin belum dikonfigurasi. Hubungi administrator sistem.';
        }
        return { success: false, error: errorMessage };
      }

      if (data?.success) {
        // Verify the admin was created correctly
        await delay(500); // Brief delay to allow database triggers to complete
        const isVerified = await verifyAdminStatus(formData.email);
        
        if (!isVerified && attempt < MAX_RETRIES) {
          console.log(`Admin verification failed, retrying (attempt ${attempt + 1})...`);
          await delay(RETRY_DELAY_MS * attempt);
          setRetryCount(attempt);
          
          // Re-verify after delay (trigger might just be slow)
          const retryVerify = await verifyAdminStatus(formData.email);
          if (retryVerify) {
            return { success: true };
          }
          
          // If still not verified, the edge function might need to re-run
          return createAdminWithRetry(attempt + 1);
        }
        
        return { success: true };
      }
      
      return { success: false, error: 'Respons tidak valid dari server' };
    } catch (err) {
      console.error(`Error creating admin (attempt ${attempt}):`, err);
      
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * attempt);
        setRetryCount(attempt);
        return createAdminWithRetry(attempt + 1);
      }
      
      return { success: false, error: 'Terjadi kesalahan saat membuat akun admin. Pastikan koneksi internet Anda stabil.' };
    }
  }, [formData, verifyAdminStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRetryCount(0);
    
    // Validate form data
    const validation = adminSchema.safeParse(formData);
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setIsLoading(true);

    const result = await createAdminWithRetry();
    
    if (result.success) {
      setSuccess(true);
      toast.success('Akun admin berhasil dibuat!');
    } else {
      setError(result.error || 'Terjadi kesalahan yang tidak diketahui');
    }
    
    setIsLoading(false);
    setRetryCount(0);
  };

  if (success) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse-slow" />
        
        <div className="absolute top-4 right-4 z-20">
          <ThemeLanguageToggle variant="splash" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
          <Card className="w-full max-w-md animate-scale-in bg-white/95 backdrop-blur-sm">
            <CardContent className="p-8 text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {t('Admin Berhasil Dibuat!', 'Admin Created Successfully!')}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {t(
                    'Akun admin telah dibuat dan disimpan di database. Anda sekarang bisa login dengan kredensial yang telah didaftarkan.',
                    'Admin account has been created and saved to database. You can now login with the registered credentials.'
                  )}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 text-left">
                <p className="text-sm font-medium text-foreground">Email:</p>
                <p className="text-sm text-muted-foreground font-mono">{formData.email}</p>
              </div>
              <Button onClick={() => navigate('/')} className="w-full" size="lg">
                {t('Login Sekarang', 'Login Now')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 gradient-hero" />
      
      {/* Animated Orbs */}
      <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse-slow" />
      <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

      {/* Header */}
      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="text-white hover:bg-white/20"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <div className="absolute top-4 right-4 z-20">
        <ThemeLanguageToggle variant="splash" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Icon & Title */}
        <div className="animate-scale-in text-center mb-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 shadow-xl backdrop-blur-sm">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
            {t('Setup Admin', 'Setup Admin')}
          </h1>
          <p className="mt-2 text-white/80">
            {t('Buat akun admin pertama untuk koperasi', 'Create the first admin account for the cooperative')}
          </p>
        </div>

        {/* Form Card */}
        <Card className="w-full max-w-md animate-fade-in bg-white/95 backdrop-blur-sm" style={{ animationDelay: '0.2s' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t('Buat Akun Admin', 'Create Admin Account')}
            </CardTitle>
            <CardDescription>
              {t(
                'Masukkan Setup Key dan data admin untuk membuat akun pertama',
                'Enter Setup Key and admin data to create the first account'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="setupKey" className="flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" />
                  {t('Setup Key', 'Setup Key')} *
                </Label>
                <div className="relative">
                  <Input
                    id="setupKey"
                    type={showSetupKey ? 'text' : 'password'}
                    value={formData.setupKey}
                    onChange={(e) => setFormData({ ...formData, setupKey: e.target.value })}
                    placeholder={t('Masukkan setup key', 'Enter setup key')}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowSetupKey(!showSetupKey)}
                  >
                    {showSetupKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    'Setup Key adalah kunci rahasia yang diberikan oleh sistem administrator',
                    'Setup Key is a secret key provided by the system administrator'
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  {t('Nama Admin', 'Admin Name')} *
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('Nama lengkap admin', 'Admin full name')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  {t('Email', 'Email')} *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@koperasi.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {t('Password', 'Password')} *
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={t('Minimal 8 karakter', 'Minimum 8 characters')}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
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
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    {retryCount > 0 ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {retryCount > 0 
                      ? t(`Mencoba ulang (${retryCount}/${MAX_RETRIES})...`, `Retrying (${retryCount}/${MAX_RETRIES})...`)
                      : t('Membuat Akun...', 'Creating Account...')
                    }
                  </>
                ) : (
                  t('Buat Akun Admin', 'Create Admin Account')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info */}
        <div className="mt-6 max-w-md text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <p className="text-sm text-white/70">
            {t(
              'Halaman ini hanya dapat digunakan sekali untuk membuat admin pertama. Setelah itu, admin baru harus dibuat melalui dashboard admin.',
              'This page can only be used once to create the first admin. After that, new admins must be created through the admin dashboard.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
