import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfiniteScrollLoaderProps {
  isFetching: boolean;
  hasMore: boolean;
  onLoadMore?: () => void;
  sentinelRef?: (node: HTMLElement | null) => void;
  className?: string;
}

export const InfiniteScrollLoader = ({
  isFetching,
  hasMore,
  onLoadMore,
  sentinelRef,
  className,
}: InfiniteScrollLoaderProps) => {
  if (!hasMore && !isFetching) {
    return (
      <div className={cn("flex items-center justify-center py-4 sm:py-6 text-xs sm:text-sm text-muted-foreground", className)}>
        <div className="flex items-center gap-2">
          <div className="h-px w-6 sm:w-8 bg-border" />
          <span>Semua data telah dimuat</span>
          <div className="h-px w-6 sm:w-8 bg-border" />
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={sentinelRef}
      className={cn("flex items-center justify-center py-4 sm:py-6", className)}
    >
      {isFetching ? (
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Memuat lebih banyak...</span>
        </div>
      ) : hasMore ? (
        <button
          onClick={onLoadMore}
          className="text-xs sm:text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded px-2 py-1 touch-target-sm"
        >
          Muat lebih banyak
        </button>
      ) : null}
    </div>
  );
};

// Skeleton loader for list items
export const ListItemSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="divide-y divide-border animate-pulse">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4">
        <div className="h-10 w-10 rounded-full bg-muted/60 shimmer-effect" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-muted/50 shimmer-effect" />
          <div className="h-3 w-24 rounded bg-muted/40 shimmer-effect" />
        </div>
        <div className="h-5 w-20 rounded bg-muted/60 shimmer-effect" />
      </div>
    ))}
  </div>
);
