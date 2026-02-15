import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSavings } from '@/hooks/useUserSavings';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';

export const useSavingsRequirementNotification = () => {
  const { user } = useAuth();
  const { savings } = useUserSavings();
  const hasChecked = useRef(false);

  useEffect(() => {
    const checkAndCreateNotification = async () => {
      if (!user?.id || hasChecked.current) return;

      const settings = getCooperativeSettings();
      
      // Only check if the setting is enabled
      if (!settings.requireMinSimpananWajibForLoan) return;

      const minRequired = settings.minSimpananWajibForLoan ?? 100000;
      const currentSimpananWajib = savings.simpananWajib;

      // Check if simpanan wajib is below minimum required
      if (currentSimpananWajib >= minRequired) return;

      hasChecked.current = true;

      try {
        // Check if we already sent this notification today
        const today = new Date().toISOString().split('T')[0];
        const { data: existingNotification } = await supabase
          .from('member_notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('notification_type', 'savings_requirement_reminder')
          .gte('created_at', `${today}T00:00:00`)
          .maybeSingle();

        if (existingNotification) {
          console.log('Savings requirement notification already sent today');
          return;
        }

        // Calculate how much more is needed
        const amountNeeded = minRequired - currentSimpananWajib;

        // Create notification
        await supabase.from('member_notifications').insert({
          user_id: user.id,
          title: 'Simpanan Wajib Belum Mencukupi',
          message: `Simpanan wajib Anda (Rp ${currentSimpananWajib.toLocaleString('id-ID')}) belum mencapai minimal Rp ${minRequired.toLocaleString('id-ID')} yang diperlukan untuk mengajukan pinjaman. Anda perlu menambah Rp ${amountNeeded.toLocaleString('id-ID')} lagi.`,
          notification_type: 'savings_requirement_reminder',
          metadata: {
            current_amount: currentSimpananWajib,
            required_amount: minRequired,
            amount_needed: amountNeeded,
          }
        });

        console.log('Savings requirement notification created');
      } catch (error) {
        console.error('Error creating savings requirement notification:', error);
      }
    };

    // Only run when savings data is loaded
    if (savings.simpananWajib !== undefined) {
      checkAndCreateNotification();
    }
  }, [user?.id, savings.simpananWajib]);
};
