import { useCallback, useRef, useState, useEffect } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

interface UseInfiniteScrollReturn {
  sentinelRef: (node: HTMLElement | null) => void;
  isIntersecting: boolean;
}

export const useInfiniteScroll = ({
  threshold = 0.1,
  rootMargin = '100px',
  enabled = true,
}: UseInfiniteScrollOptions = {}): UseInfiniteScrollReturn => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRef = useRef<HTMLElement | null>(null);

  const sentinelRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!enabled || !node) {
      nodeRef.current = null;
      return;
    }

    nodeRef.current = node;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold,
        rootMargin,
      }
    );

    observerRef.current.observe(node);
  }, [enabled, threshold, rootMargin]);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { sentinelRef, isIntersecting };
};

// Hook for scroll-based data fetching with automatic pagination
interface UsePaginatedDataOptions<T> {
  fetchFn: (page: number, pageSize: number) => Promise<{ data: T[]; hasMore: boolean }>;
  pageSize?: number;
  enabled?: boolean;
}

interface UsePaginatedDataReturn<T> {
  data: T[];
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
  sentinelRef: (node: HTMLElement | null) => void;
}

export const usePaginatedData = <T>({
  fetchFn,
  pageSize = 20,
  enabled = true,
}: UsePaginatedDataOptions<T>): UsePaginatedDataReturn<T> => {
  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const { sentinelRef, isIntersecting } = useInfiniteScroll({
    enabled: enabled && hasMore && !isFetchingMore && !isLoading,
  });

  const fetchData = useCallback(async (pageNum: number, isRefresh: boolean = false) => {
    if (!enabled) return;

    try {
      if (isRefresh) {
        setIsLoading(true);
      } else if (pageNum > 0) {
        setIsFetchingMore(true);
      }

      const result = await fetchFn(pageNum, pageSize);

      if (!isMounted.current) return;

      if (isRefresh || pageNum === 0) {
        setData(result.data);
      } else {
        setData(prev => [...prev, ...result.data]);
      }

      setHasMore(result.hasMore);
      setError(null);
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Error loading data');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    }
  }, [enabled, fetchFn, pageSize]);

  // Initial fetch
  useEffect(() => {
    isMounted.current = true;
    setPage(0);
    fetchData(0, true);

    return () => {
      isMounted.current = false;
    };
  }, [fetchData]);

  // Load more when sentinel is visible
  useEffect(() => {
    if (isIntersecting && hasMore && !isFetchingMore && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchData(nextPage, false);
    }
  }, [isIntersecting, hasMore, isFetchingMore, isLoading, page, fetchData]);

  const loadMore = useCallback(() => {
    if (hasMore && !isFetchingMore && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchData(nextPage, false);
    }
  }, [hasMore, isFetchingMore, isLoading, page, fetchData]);

  const refresh = useCallback(() => {
    setPage(0);
    setHasMore(true);
    fetchData(0, true);
  }, [fetchData]);

  return {
    data,
    isLoading,
    isFetchingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    sentinelRef,
  };
};
