import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Radio, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeIndicatorProps {
  className?: string;
}

export const RealtimeIndicator = ({ className = '' }: RealtimeIndicatorProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Browser online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Supabase realtime connection status
  useEffect(() => {
    const channel = supabase
      .channel('connection-status')
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
          setIsReconnecting(false);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsRealtimeConnected(false);
        } else if (status === 'TIMED_OUT') {
          setIsRealtimeConnected(false);
          setIsReconnecting(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Pulse animation when receiving updates
  useEffect(() => {
    const handleRealtimeUpdate = () => {
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 1000);
    };

    window.addEventListener('realtime-update', handleRealtimeUpdate);
    return () => window.removeEventListener('realtime-update', handleRealtimeUpdate);
  }, []);

  const isConnected = isOnline && isRealtimeConnected;

  const getStatus = () => {
    if (!isOnline) return { label: 'Offline', icon: WifiOff, color: 'destructive' };
    if (isReconnecting) return { label: 'Menyambung...', icon: RefreshCw, color: 'warning' };
    if (!isRealtimeConnected) return { label: 'Terputus', icon: WifiOff, color: 'destructive' };
    return { label: 'Live', icon: Radio, color: 'success' };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary"
            className={`
              gap-1 px-2 py-0.5 text-[10px] font-medium cursor-default transition-all
              ${status.color === 'success' ? 'bg-success/10 text-success border-success/30' : ''}
              ${status.color === 'destructive' ? 'bg-destructive/10 text-destructive border-destructive/30' : ''}
              ${status.color === 'warning' ? 'bg-warning/10 text-warning border-warning/30' : ''}
              ${isPulsing ? 'animate-pulse' : ''}
              ${isReconnecting ? 'animate-pulse' : ''}
              ${className}
            `}
          >
            <StatusIcon className={`h-3 w-3 ${isReconnecting ? 'animate-spin' : ''}`} />
            <span>{status.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>
            {!isOnline && 'Tidak ada koneksi internet'}
            {isOnline && isReconnecting && 'Mencoba menyambung ulang...'}
            {isOnline && !isRealtimeConnected && !isReconnecting && 'Koneksi real-time terputus'}
            {isConnected && 'Data diperbarui secara real-time'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Utility function to dispatch realtime update event
export const dispatchRealtimeUpdate = () => {
  window.dispatchEvent(new CustomEvent('realtime-update'));
};
