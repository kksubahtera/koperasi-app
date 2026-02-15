import { useState, useRef, ReactNode } from 'react';
import { Check, Trash2 } from 'lucide-react';

interface SwipeableNotificationItemProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: 'delete' | 'mark-read';
  rightAction?: 'delete' | 'mark-read';
  disabled?: boolean;
  isDeleting?: boolean;
}

export const SwipeableNotificationItem = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction = 'delete',
  rightAction = 'mark-read',
  disabled = false,
  isDeleting = false,
}: SwipeableNotificationItemProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80;
  const MAX_SWIPE = 100;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isDeleting) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || disabled || isDeleting) return;
    
    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;
    
    // Limit the swipe distance
    const limitedDiff = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, diff));
    
    // Only allow swipe if there's a handler for that direction
    if (diff < 0 && !onSwipeLeft) return;
    if (diff > 0 && !onSwipeRight) return;
    
    setTranslateX(limitedDiff);
  };

  const handleTouchEnd = () => {
    if (!isDragging || disabled || isDeleting) return;
    setIsDragging(false);
    
    const diff = currentXRef.current - startXRef.current;
    
    if (diff < -THRESHOLD && onSwipeLeft) {
      // Animate out then trigger action
      setTranslateX(-MAX_SWIPE * 2);
      setTimeout(() => {
        onSwipeLeft();
        setTranslateX(0);
      }, 200);
    } else if (diff > THRESHOLD && onSwipeRight) {
      // Animate out then trigger action
      setTranslateX(MAX_SWIPE * 2);
      setTimeout(() => {
        onSwipeRight();
        setTranslateX(0);
      }, 200);
    } else {
      // Snap back
      setTranslateX(0);
    }
  };

  const getActionColor = (action: 'delete' | 'mark-read') => {
    return action === 'delete' ? 'bg-destructive' : 'bg-emerald-500';
  };

  const getActionIcon = (action: 'delete' | 'mark-read') => {
    return action === 'delete' ? <Trash2 className="h-5 w-5 text-white" /> : <Check className="h-5 w-5 text-white" />;
  };

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden transition-all duration-300 ease-out ${
        isDeleting ? 'opacity-0 max-h-0 -mt-1' : 'opacity-100 max-h-[500px]'
      }`}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Background actions - always full width */}
      <div className="absolute inset-0 flex">
        {/* Right action background (shown on swipe right - mark as read) */}
        <div 
          className={`flex items-center justify-start pl-4 flex-1 ${onSwipeRight ? getActionColor(rightAction) : 'bg-transparent'}`}
          style={{ 
            opacity: translateX > 0 ? Math.min(1, translateX / THRESHOLD) : 0,
          }}
        >
          {onSwipeRight && getActionIcon(rightAction)}
          {onSwipeRight && <span className="ml-2 text-white text-xs font-medium">
            {rightAction === 'mark-read' ? 'Tandai Dibaca' : 'Hapus'}
          </span>}
        </div>
        {/* Left action background (shown on swipe left - delete) */}
        <div 
          className={`flex items-center justify-end pr-4 flex-1 ${onSwipeLeft ? getActionColor(leftAction) : 'bg-transparent'}`}
          style={{ 
            opacity: translateX < 0 ? Math.min(1, -translateX / THRESHOLD) : 0,
          }}
        >
          {onSwipeLeft && <span className="mr-2 text-white text-xs font-medium">
            {leftAction === 'delete' ? 'Hapus' : 'Tandai Dibaca'}
          </span>}
          {onSwipeLeft && getActionIcon(leftAction)}
        </div>
      </div>
      
      {/* Main content */}
      <div
        className={`relative bg-background ${isDragging ? '' : 'transition-transform duration-200 ease-out'}`}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};
