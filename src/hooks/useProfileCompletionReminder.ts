import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { toast } from 'sonner';
import { User } from 'lucide-react';

// Profile completion calculation (matching ProfilePage logic)
const calculateProfileCompletion = (user: any) => {
  const fields = [
    { name: 'name', value: user?.name, label: 'Nama Lengkap' },
    { name: 'phone', value: user?.phone, label: 'Nomor Telepon' },
    { name: 'nik', value: user?.nik, label: 'NIK' },
    { name: 'email', value: user?.email, label: 'Email' },
    { name: 'memberNumber', value: user?.memberNumber, label: 'Nomor Anggota' },
    { name: 'profilePhoto', value: user?.profilePhoto, label: 'Foto Profil' },
    { name: 'bankName', value: user?.bankName, label: 'Nama Bank' },
    { name: 'bankAccountNumber', value: user?.bankAccountNumber, label: 'Nomor Rekening' },
    { name: 'bankAccountName', value: user?.bankAccountName, label: 'Nama Pemilik Rekening' },
  ];

  const filledFields = fields.filter(field => {
    const value = field.value;
    return value && String(value).trim() !== '';
  });

  const percentage = Math.round((filledFields.length / fields.length) * 100);
  const missingFields = fields.filter(field => {
    const value = field.value;
    return !value || String(value).trim() === '';
  });

  return { percentage, missingFields, filledCount: filledFields.length, totalCount: fields.length };
};

export const useProfileCompletionReminder = () => {
  const { user } = useAuth();
  const { t } = useThemeLanguage();
  const hasShownReminder = useRef(false);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    // Only show reminder once per login session
    if (!user || user.activeRole !== 'member') {
      hasShownReminder.current = false;
      previousUserId.current = null;
      return;
    }

    // Reset reminder flag if user changed (new login)
    if (previousUserId.current !== user.id) {
      hasShownReminder.current = false;
      previousUserId.current = user.id;
    }

    // Don't show if already shown this session
    if (hasShownReminder.current) return;

    // Small delay to ensure UI is ready
    const timer = setTimeout(() => {
      const { percentage, missingFields } = calculateProfileCompletion(user);

      if (percentage < 100) {
        const missingLabels = missingFields.slice(0, 3).map(f => f.label);
        const moreCount = missingFields.length - 3;
        
        let description = t(
          `Lengkapi: ${missingLabels.join(', ')}${moreCount > 0 ? ` dan ${moreCount} lainnya` : ''}`,
          `Complete: ${missingLabels.join(', ')}${moreCount > 0 ? ` and ${moreCount} more` : ''}`
        );

        toast.info(
          t('Profil Belum Lengkap', 'Profile Incomplete'),
          {
            description: `${percentage}% - ${description}`,
            duration: 8000,
            action: {
              label: t('Lengkapi', 'Complete'),
              onClick: () => {
                // Dispatch custom event to navigate to profile
                window.dispatchEvent(new CustomEvent('navigate-to-profile'));
              }
            },
          }
        );

        hasShownReminder.current = true;
      }
    }, 1500); // Delay 1.5 seconds after login

    return () => clearTimeout(timer);
  }, [user, t]);
};
