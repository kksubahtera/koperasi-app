import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useEffect } from 'react';
import { dispatchRealtimeUpdate } from '@/components/shared/RealtimeIndicator';
import { toast } from 'sonner';

export interface MemberProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  nik?: string | null; // Now optional - fetched via RPC when needed
  address: string | null;
  member_number: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  profile_photo: string | null;
  is_active: boolean;
  approval_status: string | null;
  join_date: string | null;
  exit_date: string | null;
  exit_year: number | null;
  created_at: string | null;
  branch_id: string | null;
}

const PAGE_SIZE = 20;

export const usePaginatedMembers = (options?: {
  isActive?: boolean;
  approvalStatus?: string;
  searchQuery?: string;
}) => {
  const queryClient = useQueryClient();
  const { isActive = true, approvalStatus, searchQuery } = options || {};

  // Set up real-time subscription for profiles
  useEffect(() => {
    const channel = supabase
      .channel('profiles-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        (payload: any) => {
          console.log('[Realtime] New profile inserted:', payload);
          // Show toast for new registration (pending approval status)
          if (payload.new?.approval_status === 'pending') {
            toast.info('Pendaftaran Baru', {
              description: 'Ada pendaftaran anggota baru yang perlu disetujui',
              duration: 4000,
            });
          }
          dispatchRealtimeUpdate();
          queryClient.invalidateQueries({ queryKey: ['members-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['all-members'] });
          queryClient.invalidateQueries({ queryKey: ['exited-members-paginated'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          console.log('[Realtime] Profile updated:', payload);
          dispatchRealtimeUpdate();
          queryClient.invalidateQueries({ queryKey: ['members-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['all-members'] });
          queryClient.invalidateQueries({ queryKey: ['exited-members-paginated'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to profiles table');
        }
      });

    return () => {
      console.log('[Realtime] Unsubscribing from profiles');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
  const query = useInfiniteQuery({
    queryKey: ['members-paginated', { isActive, approvalStatus, searchQuery }],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let queryBuilder = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('name', { ascending: true });

      // Apply filters
      if (isActive !== undefined) {
        queryBuilder = queryBuilder.eq('is_active', isActive);
      }

      if (approvalStatus) {
        queryBuilder = queryBuilder.eq('approval_status', approvalStatus);
      }

      // Apply search filter
      if (searchQuery && searchQuery.trim()) {
        const search = searchQuery.trim().toLowerCase();
        queryBuilder = queryBuilder.or(`name.ilike.%${search}%,email.ilike.%${search}%,member_number.ilike.%${search}%`);
      }

      // Apply pagination
      queryBuilder = queryBuilder.range(from, to);

      const { data: members, error, count } = await queryBuilder;

      if (error) throw error;

      const hasNextPage = count ? from + (members?.length || 0) < count : (members?.length || 0) === PAGE_SIZE;

      return {
        data: (members || []).map(m => ({ ...m, nik: undefined })) as MemberProfile[],
        nextPage: hasNextPage ? pageParam + 1 : null,
        totalCount: count || 0,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 5000, // 5 seconds
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const members = useMemo(() => 
    query.data?.pages.flatMap(page => page.data) || [],
    [query.data]
  );

  const totalCount = query.data?.pages[0]?.totalCount || 0;

  return {
    members,
    totalCount,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    error: query.error?.message || null,
    fetchNextPage: query.fetchNextPage,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['members-paginated'] }),
  };
};

// Hook for exited members with pagination
export const usePaginatedExitedMembers = () => {
  const queryClient = useQueryClient();
  
  const query = useInfiniteQuery({
    queryKey: ['exited-members-paginated'],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: members, error, count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('is_active', false)
        .not('exit_date', 'is', null)
        .order('exit_date', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const hasNextPage = count ? from + (members?.length || 0) < count : (members?.length || 0) === PAGE_SIZE;

      return {
        data: (members || []).map(m => ({ ...m, nik: undefined })) as MemberProfile[],
        nextPage: hasNextPage ? pageParam + 1 : null,
        totalCount: count || 0,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });

  const members = useMemo(() => 
    query.data?.pages.flatMap(page => page.data) || [],
    [query.data]
  );

  const totalCount = query.data?.pages[0]?.totalCount || 0;

  return {
    members,
    totalCount,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    error: query.error?.message || null,
    fetchNextPage: query.fetchNextPage,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['exited-members-paginated'] }),
  };
};
