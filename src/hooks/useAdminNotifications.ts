import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getTransactionTypeLabel } from '@/lib/mockData';
import { dispatchRealtimeUpdate } from '@/components/shared/RealtimeIndicator';

export const useAdminNotifications = () => {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = hasRole('admin');

  useEffect(() => {
    // Only subscribe if user is logged in and is an admin
    if (!user?.id || !isAdmin) return;

    console.log('Setting up admin push notifications');

    const channel = supabase
      .channel('admin-push-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
        },
        async (payload) => {
          console.log('🔔 New transaction received:', payload);
          
          const newRecord = payload.new as {
            id: string;
            user_id: string;
            status: string;
            type: string;
            amount: number;
          };

          // Trigger realtime indicator pulse
          dispatchRealtimeUpdate();

          // Only notify for pending transactions
          if (newRecord.status === 'pending') {
            // Fetch user profile to get the name
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, member_number')
              .eq('user_id', newRecord.user_id)
              .maybeSingle();

            const userName = profile?.name || 'Anggota';
            const memberNumber = profile?.member_number || '';
            const transactionType = getTransactionTypeLabel(newRecord.type as any);
            const amount = new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              minimumFractionDigits: 0,
            }).format(newRecord.amount);

            // Play notification sound
            playNotificationSound();

            toast.info('🔔 Transaksi Baru Masuk!', {
              description: `${userName} (${memberNumber}) mengajukan ${transactionType} sebesar ${amount}`,
              duration: 10000,
              action: {
                label: 'Verifikasi',
                onClick: () => {
                  window.dispatchEvent(new CustomEvent('navigate-to-verify'));
                },
              },
            });

            // Refresh transactions list
            queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
            queryClient.invalidateQueries({ queryKey: ['all-transactions-paginated'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'loans',
        },
        async (payload) => {
          console.log('🔔 New loan application received:', payload);
          
          const newRecord = payload.new as {
            id: string;
            user_id: string;
            status: string;
            principal_amount: number;
            tenor: number;
          };

          // Trigger realtime indicator pulse
          dispatchRealtimeUpdate();

          // Only notify for pending loans
          if (newRecord.status === 'pending') {
            // Fetch user profile to get the name
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, member_number')
              .eq('user_id', newRecord.user_id)
              .maybeSingle();

            const userName = profile?.name || 'Anggota';
            const memberNumber = profile?.member_number || '';
            const amount = new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              minimumFractionDigits: 0,
            }).format(newRecord.principal_amount);

            // Play notification sound
            playNotificationSound();

            toast.info('🔔 Pengajuan Pinjaman Baru!', {
              description: `${userName} (${memberNumber}) mengajukan pinjaman ${amount} untuk ${newRecord.tenor} bulan`,
              duration: 10000,
              action: {
                label: 'Verifikasi',
                onClick: () => {
                  window.dispatchEvent(new CustomEvent('navigate-to-loans'));
                },
              },
            });

            // Refresh loans list
            queryClient.invalidateQueries({ queryKey: ['all-loans'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles',
          filter: 'approval_status=eq.pending',
        },
        async (payload) => {
          console.log('🔔 New member registration:', payload);
          
          const newRecord = payload.new as {
            id: string;
            name: string;
            email: string;
            approval_status: string;
          };

          // Trigger realtime indicator pulse
          dispatchRealtimeUpdate();

          if (newRecord.approval_status === 'pending') {
            // Play notification sound
            playNotificationSound();

            toast.info('🔔 Pendaftaran Anggota Baru!', {
              description: `${newRecord.name} (${newRecord.email}) menunggu persetujuan`,
              duration: 10000,
              action: {
                label: 'Lihat',
                onClick: () => {
                  window.dispatchEvent(new CustomEvent('navigate-to-registrations'));
                },
              },
            });

            // Refresh members list
            queryClient.invalidateQueries({ queryKey: ['members-paginated'] });
            queryClient.invalidateQueries({ queryKey: ['all-members'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'resignation_requests',
        },
        async (payload) => {
          console.log('🔔 New resignation request:', payload);
          
          const newRecord = payload.new as {
            id: string;
            user_id: string;
            status: string;
          };

          // Trigger realtime indicator pulse
          dispatchRealtimeUpdate();

          if (newRecord.status === 'pending') {
            // Fetch user profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, member_number')
              .eq('user_id', newRecord.user_id)
              .maybeSingle();

            const userName = profile?.name || 'Anggota';
            const memberNumber = profile?.member_number || '';

            // Play notification sound
            playNotificationSound();

            toast.warning('🔔 Pengajuan Pengunduran Diri!', {
              description: `${userName} (${memberNumber}) mengajukan pengunduran diri`,
              duration: 10000,
              action: {
                label: 'Proses',
                onClick: () => {
                  window.dispatchEvent(new CustomEvent('navigate-to-resignations'));
                },
              },
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('Admin push notification subscription status:', status);
      });

    return () => {
      console.log('Cleaning up admin push notifications');
      supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin, queryClient]);
};

// Play a subtle notification sound
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.log('Could not play notification sound:', error);
  }
};
