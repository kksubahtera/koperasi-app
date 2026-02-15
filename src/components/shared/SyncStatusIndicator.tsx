import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type SyncStatus = 'synced' | 'pending' | 'error' | 'syncing' | 'offline';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  lastSyncTime?: Date | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  retryCount?: number;
  isOnline?: boolean;
  className?: string;
  showLabel?: boolean;
}

const statusConfig = {
  synced: {
    icon: CheckCircle2,
    label: 'Tersinkronisasi',
    description: 'Semua perubahan tersimpan di server',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  pending: {
    icon: CloudOff,
    label: 'Pending',
    description: 'Perubahan belum tersimpan ke server',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  error: {
    icon: AlertCircle,
    label: 'Gagal Sinkronisasi',
    description: 'Gagal menyimpan ke server',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  syncing: {
    icon: Loader2,
    label: 'Menyimpan...',
    description: 'Sedang menyimpan ke server',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  offline: {
    icon: CloudOff,
    label: 'Offline',
    description: 'Tersimpan secara lokal saja',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    borderColor: 'border-gray-200 dark:border-gray-800',
  },
};

export const SyncStatusIndicator = ({
  status,
  lastSyncTime,
  errorMessage,
  onRetry,
  isRetrying = false,
  retryCount = 0,
  isOnline = true,
  className,
  showLabel = true,
}: SyncStatusIndicatorProps) => {
  const config = statusConfig[status];
  const Icon = config.icon;
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Listen for sync success events
  useEffect(() => {
    const handleSyncSuccess = () => {
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 3000);
    };

    window.addEventListener('sync-success', handleSyncSuccess);
    return () => window.removeEventListener('sync-success', handleSyncSuccess);
  }, []);

  const formatLastSync = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMinutes < 1) return 'Baru saja';
    if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`;
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    return date.toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const showRetryButton = (status === 'error' || status === 'pending' || status === 'offline') && onRetry;
  const nextRetryText = retryCount > 0 && retryCount < 3 ? `Auto-retry ${retryCount}/3` : null;

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-2 flex-wrap', className)}>
        {/* Online/Offline indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              isOnline 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
                : 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400'
            )}>
              {isOnline ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{isOnline ? 'Terhubung ke server' : 'Tidak ada koneksi internet'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Sync status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all',
                showSyncSuccess && status === 'synced' 
                  ? 'ring-2 ring-green-400 ring-offset-2 dark:ring-offset-background' 
                  : '',
                config.bgColor,
                config.borderColor,
                config.color
              )}
            >
              <Icon 
                className={cn(
                  'h-4 w-4',
                  status === 'syncing' && 'animate-spin'
                )} 
              />
              {showLabel && <span>{config.label}</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{config.description}</p>
              {lastSyncTime && status === 'synced' && (
                <p className="text-xs text-muted-foreground">
                  Terakhir disimpan: {formatLastSync(lastSyncTime)}
                </p>
              )}
              {errorMessage && status === 'error' && (
                <p className="text-xs text-red-500">{errorMessage}</p>
              )}
              {nextRetryText && (
                <p className="text-xs text-amber-500">{nextRetryText} - akan mencoba lagi otomatis</p>
              )}
              {!isOnline && status !== 'synced' && (
                <p className="text-xs text-muted-foreground">
                  Akan otomatis sinkronisasi saat online
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Retry info badge */}
        {nextRetryText && status === 'error' && (
          <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
            {nextRetryText}
          </span>
        )}

        {/* Retry button */}
        {showRetryButton && isOnline && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            className={cn(
              'h-8 px-3 gap-1.5',
              status === 'error' && 'border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRetrying && 'animate-spin')} />
            {isRetrying ? 'Mencoba...' : 'Coba Lagi'}
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
};
