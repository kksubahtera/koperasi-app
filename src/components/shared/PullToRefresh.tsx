import React from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export const PullToRefresh = ({ onRefresh, children, className }: PullToRefreshProps) => {
  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh,
    threshold: 80,
    maxPull: 120,
  });

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-y-auto overscroll-contain",
        "-webkit-overflow-scrolling-touch",
        className
      )}
      style={{
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
      }}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center transition-all duration-200 ease-out z-10 pointer-events-none",
          pullDistance > 0 || isRefreshing ? "opacity-100" : "opacity-0"
        )}
        style={{
          top: -60,
          height: 60,
          transform: `translateY(${Math.min(pullDistance, 80)}px)`,
        }}
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20 shadow-lg transition-all duration-300",
            isRefreshing ? "w-12 h-12" : "w-10 h-10"
          )}
          style={{
            transform: `scale(${0.5 + progress * 0.5})`,
          }}
        >
          {isRefreshing ? (
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <ArrowDown
              className={cn(
                "w-5 h-5 text-primary transition-transform duration-200",
                progress >= 1 ? "rotate-180" : ""
              )}
              style={{
                transform: `rotate(${progress * 180}deg)`,
              }}
            />
          )}
        </div>
      </div>

      {/* Content wrapper with pull animation */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `translateY(${pullDistance > 0 ? Math.min(pullDistance * 0.5, 40) : 0}px)`,
        }}
      >
        {children}
      </div>

      {/* Refreshing overlay text */}
      {isRefreshing && (
        <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none animate-fade-in">
          <span className="text-xs text-primary font-medium bg-primary/10 px-3 py-1 rounded-full backdrop-blur-sm">
            Memperbarui...
          </span>
        </div>
      )}
    </div>
  );
};
