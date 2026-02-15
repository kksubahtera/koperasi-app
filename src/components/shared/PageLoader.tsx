import { cn } from '@/lib/utils';

interface PageLoaderProps {
  className?: string;
}

export const PageLoader = ({ className }: PageLoaderProps) => {
  return (
    <div className={cn("space-y-6 animate-pulse", className)}>
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-xl bg-muted/60 shimmer-effect" />
        <div className="h-4 w-64 rounded-lg bg-muted/40 shimmer-effect" />
      </div>

      {/* Card skeleton */}
      <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-muted/60 shimmer-effect" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 rounded-lg bg-muted/50 shimmer-effect" />
            <div className="h-6 w-40 rounded-lg bg-muted/60 shimmer-effect" />
          </div>
        </div>
      </div>

      {/* Grid cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card/50 p-5 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-muted/60 shimmer-effect" />
            <div className="space-y-2">
              <div className="h-3 w-20 rounded-lg bg-muted/40 shimmer-effect" />
              <div className="h-5 w-28 rounded-lg bg-muted/60 shimmer-effect" />
            </div>
          </div>
        ))}
      </div>

      {/* List skeleton */}
      <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-border/30 last:border-0">
            <div className="h-10 w-10 rounded-xl bg-muted/60 shimmer-effect" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded-lg bg-muted/50 shimmer-effect" />
              <div className="h-3 w-24 rounded-lg bg-muted/40 shimmer-effect" />
            </div>
            <div className="h-5 w-20 rounded-lg bg-muted/60 shimmer-effect" />
          </div>
        ))}
      </div>
    </div>
  );
};

// Shimmer effect for individual elements
export const Shimmer = ({ className }: { className?: string }) => (
  <div className={cn("shimmer-effect rounded-xl bg-muted/50", className)} />
);