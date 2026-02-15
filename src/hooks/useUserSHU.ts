import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SHURecord } from '@/lib/types';

interface UseUserSHUReturn {
  shuRecords: SHURecord[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useUserSHU = (): UseUserSHUReturn => {
  const { user } = useAuth();
  const [shuRecords, setSHURecords] = useState<SHURecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSHU = async () => {
    if (!user?.id) {
      setSHURecords([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('shu_records')
        .select('*')
        .eq('user_id', user.id)
        .order('year', { ascending: false });

      if (fetchError) {
        console.error('Error fetching SHU records:', fetchError);
        setError(fetchError.message);
        return;
      }

      // Map database records to SHURecord type
      const mappedRecords: SHURecord[] = (data || []).map(record => ({
        id: record.id,
        userId: record.user_id,
        year: record.year,
        amount: Number(record.amount),
        distributedAt: record.distributed_at || '',
        notes: record.notes || undefined,
      }));

      setSHURecords(mappedRecords);
    } catch (err) {
      console.error('Error in useUserSHU:', err);
      setError('Failed to fetch SHU data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSHU();
  }, [user?.id]);

  return {
    shuRecords,
    isLoading,
    error,
    refetch: fetchSHU,
  };
};
