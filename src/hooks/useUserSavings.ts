import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SavingsSummary } from '@/lib/types';
import { useEffect } from 'react';

const defaultSavings: SavingsSummary = {
  simpananPokok: 0,
  simpananWajib: 0,
  simpananSukarela: 0,
  totalSimpanan: 0,
};

const fetchSavingsData = async (userId: string): Promise<SavingsSummary> => {
  const { data, error } = await supabase
    .from('savings_summary')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching savings:', error);
    throw error;
  }

  if (data) {
    return {
      simpananPokok: Number(data.simpanan_pokok) || 0,
      simpananWajib: Number(data.simpanan_wajib) || 0,
      simpananSukarela: Number(data.simpanan_sukarela) || 0,
      totalSimpanan: Number(data.total_simpanan) || 0,
    };
  }

  return defaultSavings;
};

export const useUserSavings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: savings = defaultSavings, isLoading, error, refetch } = useQuery({
    queryKey: ['user-savings', user?.id],
    queryFn: () => fetchSavingsData(user!.id),
    enabled: !!user?.id,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Real-time subscription for savings updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`savings-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'savings_summary',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Realtime] Savings updated:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['user-savings', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return {
    savings,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
};
