import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Shield,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface PasswordStrength {
  score: number;
  label: string;
}

const getPasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 10;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[a-z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  
  if (score < 40) return { score, label: 'Lemah' };
  if (score < 70) return { score, label: 'Sedang' };
  return { score, label: 'Kuat' };
};

interface ForcePasswordChangeFormProps {
  onSuccess?: () => void;
}

export const ForcePasswordChangeForm = ({ onSuccess }: ForcePasswordChangeFormProps) => {
  const { user, refreshUser } = useAuth();
  const { t } = useThemeLanguage();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordStrength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error(t('Semua field harus diisi', 'All fields are required'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('Password tidak cocok', 'Passwords do not match'));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t('Password minimal 8 karakter', 'Password must be at least 8 characters'));
      return;
    }

    if (passwordStrength.score < 40) {
      toast.error(t('Password terlalu lemah', 'Password is too weak'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Update profile to mark password as changed
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          must_change_password: false,
          password_changed_at: new Date().toISOString(),
          claim_method: 'password_change'
        })
        .eq('id', user?.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      toast.success(t('Password berhasil diubah!', 'Password changed successfully!'));
      
      // Refresh user data - this will clear the mustChangePassword flag
      await refreshUser();
      
      // Call success callback if provided
      onSuccess?.();
    } catch (err: any) {
      console.error('Error changing password:', err);
      toast.error(err.message || t('Gagal mengubah password', 'Failed to change password'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
            <Shield className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle>{t('Ganti Password', 'Change Password')}</CardTitle>
          <CardDescription>
            {t(
              'Demi keamanan akun Anda, silakan buat password baru sebelum melanjutkan',
              'For your account security, please create a new password before continuing'
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              {t(
                'Akun Anda menggunakan password default. Untuk keamanan, Anda wajib mengganti password sebelum dapat mengakses fitur lainnya.',
                'Your account uses a default password. For security, you must change your password before accessing other features.'
              )}
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('Password Baru', 'New Password')} *</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder={t('Minimal 8 karakter', 'At least 8 characters')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {newPassword && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Progress value={passwordStrength.score} className="h-2 flex-1" />
                    <span className={`text-xs font-medium ${
                      passwordStrength.score < 40 ? 'text-red-500' :
                      passwordStrength.score < 70 ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol',
                      'Use a combination of uppercase, lowercase, numbers, and symbols'
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('Konfirmasi Password', 'Confirm Password')} *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('Ulangi password baru', 'Repeat new password')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">
                  {t('Password tidak cocok', 'Passwords do not match')}
                </p>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('Password cocok', 'Passwords match')}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('Menyimpan...', 'Saving...')}
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  {t('Simpan Password Baru', 'Save New Password')}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
