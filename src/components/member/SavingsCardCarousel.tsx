import { useState, useRef, useEffect, useCallback } from 'react';
import { SavingsSummary } from '@/lib/types';
import { formatCurrency } from '@/lib/mockData';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, Wallet, Coins, Banknote, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SavingsCardCarouselProps {
  savings: SavingsSummary | null;
}

const cardThemes = [
  {
    id: 'total',
    gradient: 'from-primary via-primary/90 to-primary/70',
    accent: 'bg-white/20',
    icon: CreditCard,
  },
  {
    id: 'pokok',
    gradient: 'from-emerald-600 via-emerald-500 to-teal-500',
    accent: 'bg-white/20',
    icon: Coins,
  },
  {
    id: 'wajib',
    gradient: 'from-indigo-600 via-indigo-500 to-purple-500',
    accent: 'bg-white/20',
    icon: Wallet,
  },
  {
    id: 'sukarela',
    gradient: 'from-amber-600 via-orange-500 to-rose-500',
    accent: 'bg-white/20',
    icon: Banknote,
  },
];

const AUTOPLAY_INTERVAL = 3000;

export const SavingsCardCarousel = ({ savings }: SavingsCardCarouselProps) => {
  const { t } = useThemeLanguage();
  const { user } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [bounceDirection, setBounceDirection] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoplayRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; time: number } | null>(null);

  const savingsData = [
    {
      label: t('Total Simpanan', 'Total Savings'),
      amount: savings?.totalSimpanan || 0,
      theme: cardThemes[0],
    },
    {
      label: t('Simpanan Pokok', 'Principal Savings'),
      amount: savings?.simpananPokok || 0,
      theme: cardThemes[1],
    },
    {
      label: t('Simpanan Wajib', 'Mandatory Savings'),
      amount: savings?.simpananWajib || 0,
      theme: cardThemes[2],
    },
    {
      label: t('Simpanan Sukarela', 'Voluntary Savings'),
      amount: savings?.simpananSukarela || 0,
      theme: cardThemes[3],
    },
  ];

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % savingsData.length);
  }, [savingsData.length]);

  const prevSlide = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + savingsData.length) % savingsData.length);
  }, [savingsData.length]);

  const goToSlide = (index: number) => {
    setActiveIndex(index);
  };

  // Auto-play functionality
  useEffect(() => {
    if (isPaused || isHovered || isDragging) {
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current);
        autoplayRef.current = null;
      }
      return;
    }

    autoplayRef.current = setInterval(() => {
      nextSlide();
    }, AUTOPLAY_INTERVAL);

    return () => {
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current);
      }
    };
  }, [isPaused, isHovered, isDragging, nextSlide]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Touch/Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    setIsDragging(true);
    touchStartRef.current = {
      x: e.touches[0].clientX,
      time: Date.now(),
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !isDragging) return;
    
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartRef.current.x;
    
    // Limit drag offset to prevent over-scrolling
    const containerWidth = containerRef.current?.offsetWidth || 300;
    const maxOffset = containerWidth * 0.4;
    const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, diff));
    
    setDragOffset(clampedOffset);
  };

  const triggerBounce = (direction: 'left' | 'right') => {
    setBounceDirection(direction);
    // Haptic feedback for bounce
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    setTimeout(() => setBounceDirection(null), 400);
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    
    const containerWidth = containerRef.current?.offsetWidth || 300;
    const threshold = containerWidth * 0.15; // 15% of container width
    const velocity = Math.abs(dragOffset) / (Date.now() - touchStartRef.current.time);
    
    // Swipe detection with velocity consideration and bounce at edges
    if (dragOffset < -threshold || (dragOffset < 0 && velocity > 0.5)) {
      if (activeIndex === savingsData.length - 1) {
        triggerBounce('left');
      } else {
        nextSlide();
      }
    } else if (dragOffset > threshold || (dragOffset > 0 && velocity > 0.5)) {
      if (activeIndex === 0) {
        triggerBounce('right');
      } else {
        prevSlide();
      }
    }
    
    // Reset states
    setIsDragging(false);
    setDragOffset(0);
    touchStartRef.current = null;
    
    // Resume autoplay after delay
    setTimeout(() => setIsPaused(false), 1000);
  };

  // Mouse drag handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    touchStartRef.current = {
      x: e.clientX,
      time: Date.now(),
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!touchStartRef.current || !isDragging) return;
    
    const currentX = e.clientX;
    const diff = currentX - touchStartRef.current.x;
    
    const containerWidth = containerRef.current?.offsetWidth || 300;
    const maxOffset = containerWidth * 0.4;
    const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, diff));
    
    setDragOffset(clampedOffset);
  };

  const handleMouseUp = () => {
    if (!touchStartRef.current) return;
    
    const containerWidth = containerRef.current?.offsetWidth || 300;
    const threshold = containerWidth * 0.15;
    const velocity = Math.abs(dragOffset) / (Date.now() - touchStartRef.current.time);
    
    if (dragOffset < -threshold || (dragOffset < 0 && velocity > 0.5)) {
      if (activeIndex === savingsData.length - 1) {
        triggerBounce('left');
      } else {
        nextSlide();
      }
    } else if (dragOffset > threshold || (dragOffset > 0 && velocity > 0.5)) {
      if (activeIndex === 0) {
        triggerBounce('right');
      } else {
        prevSlide();
      }
    }
    
    setIsDragging(false);
    setDragOffset(0);
    touchStartRef.current = null;
  };

  const maskNIK = (nik: string | null | undefined) => {
    if (!nik) return '••••••••••••••••';
    return nik.slice(0, 4) + ' •••• •••• ' + nik.slice(-4);
  };

  // Calculate transform with drag offset and bounce
  const getTransform = () => {
    const baseOffset = activeIndex * 100;
    const dragPercent = containerRef.current 
      ? (dragOffset / containerRef.current.offsetWidth) * 100 
      : 0;
    
    // Add bounce offset
    let bounceOffset = 0;
    if (bounceDirection === 'left') {
      bounceOffset = -3; // Bounce left (trying to go next at last slide)
    } else if (bounceDirection === 'right') {
      bounceOffset = 3; // Bounce right (trying to go prev at first slide)
    }
    
    return `translateX(calc(-${baseOffset}% + ${dragPercent}% + ${bounceOffset}%))`;
  };

  // Get transition class based on state
  const getTransitionClass = () => {
    if (isDragging) return "transition-none";
    if (bounceDirection) return "transition-transform duration-400 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)]";
    return "transition-transform duration-500 ease-out";
  };

  // Calculate parallax offset for background patterns
  const getParallaxOffset = () => {
    const containerWidth = containerRef.current?.offsetWidth || 300;
    // Parallax moves at 50% speed of main drag for depth effect
    const parallaxAmount = (dragOffset / containerWidth) * 30;
    return parallaxAmount;
  };

  // Calculate 3D tilt effect based on drag with dynamic shadow
  const getTiltStyle = (cardIndex: number) => {
    if (cardIndex !== activeIndex) return {};
    
    const containerWidth = containerRef.current?.offsetWidth || 300;
    const dragPercent = dragOffset / containerWidth;
    
    // Calculate rotation (max 8 degrees)
    const rotateY = dragPercent * 8;
    // Calculate slight vertical rotation for depth
    const rotateX = Math.abs(dragPercent) * -2;
    // Calculate slight scale change
    const scale = 1 - Math.abs(dragPercent) * 0.02;
    
    // Dynamic shadow based on tilt direction
    const shadowOffsetX = dragPercent * -20;
    const shadowBlur = 20 + Math.abs(dragPercent) * 10;
    const shadowOpacity = 0.3 + Math.abs(dragPercent) * 0.1;
    
    return {
      transform: isDragging 
        ? `perspective(1000px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) scale(${scale})`
        : 'perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1)',
      transformStyle: 'preserve-3d' as const,
      boxShadow: isDragging
        ? `${shadowOffsetX}px 10px ${shadowBlur}px rgba(0, 0, 0, ${shadowOpacity})`
        : '0 10px 20px rgba(0, 0, 0, 0.3)',
    };
  };

  return (
    <div className="w-full space-y-3 sm:space-y-4">
      {/* Main Carousel */}
      <div 
        ref={containerRef}
        className={cn(
          "relative select-none",
          isDragging && "cursor-grabbing"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={(e) => {
          handleMouseLeave();
          handleMouseUp();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Navigation Buttons */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm shadow-md rounded-full h-8 w-8 sm:h-9 sm:w-9 transition-opacity",
            isHovered ? "opacity-100" : "opacity-70"
          )}
          onClick={prevSlide}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm shadow-md rounded-full h-8 w-8 sm:h-9 sm:w-9 transition-opacity",
            isHovered ? "opacity-100" : "opacity-70"
          )}
          onClick={nextSlide}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Cards Container */}
        <div className="overflow-hidden px-8 sm:px-10 md:px-12 cursor-grab active:cursor-grabbing">
          <div 
            className={cn(
              "flex gap-2 sm:gap-3",
              getTransitionClass()
            )}
            style={{ transform: getTransform() }}
          >
            {savingsData.map((item, index) => {
              const Icon = item.theme.icon;
              
              return (
                <div
                  key={item.theme.id}
                  className="w-full flex-shrink-0"
                >
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-5 text-white shadow-xl",
                      "bg-gradient-to-br",
                      item.theme.gradient,
                      activeIndex === index && "scale-100",
                      activeIndex !== index && "scale-95 opacity-70",
                      isDragging && activeIndex === index ? "transition-none" : "transition-all duration-300"
                    )}
                    style={{
                      aspectRatio: '1.8/1',
                      maxHeight: '180px',
                      ...getTiltStyle(index),
                    }}
                  >
                    {/* Background Pattern with Parallax */}
                    <div 
                      className={cn(
                        "absolute inset-0 opacity-10",
                        isDragging ? "transition-none" : "transition-transform duration-500 ease-out"
                      )}
                      style={{
                        transform: `translateX(${getParallaxOffset()}px)`,
                      }}
                    >
                      <div 
                        className="absolute -right-6 -top-6 h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-white/30"
                        style={{
                          transform: `translateX(${getParallaxOffset() * 0.5}px) translateY(${getParallaxOffset() * 0.3}px)`,
                        }}
                      />
                      <div 
                        className="absolute -bottom-4 -left-4 h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-white/20"
                        style={{
                          transform: `translateX(${getParallaxOffset() * -0.3}px) translateY(${getParallaxOffset() * -0.2}px)`,
                        }}
                      />
                      <div 
                        className="absolute top-1/2 right-1/4 h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-white/10"
                        style={{
                          transform: `translateX(${getParallaxOffset() * 0.8}px)`,
                        }}
                      />
                      <div 
                        className="absolute bottom-1/3 left-1/3 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-white/15"
                        style={{
                          transform: `translateX(${getParallaxOffset() * -0.6}px)`,
                        }}
                      />
                    </div>

                    {/* Card Content */}
                    <div className="relative z-10 flex h-full flex-col justify-between">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] sm:text-xs font-medium text-white/80 uppercase tracking-wider">
                            {item.label}
                          </p>
                          <p className="mt-0.5 sm:mt-1 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                            {formatCurrency(item.amount)}
                          </p>
                        </div>
                        <div className={cn("p-1.5 sm:p-2 rounded-lg", item.theme.accent)}>
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                      </div>

                      {/* Member Info */}
                      <div className="space-y-0.5 sm:space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] sm:text-[10px] text-white/60 uppercase tracking-wider">
                              {t('Nama Anggota', 'Member Name')}
                            </p>
                            <p className="text-xs sm:text-sm font-semibold truncate">
                              {user?.name || 'Member'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[9px] sm:text-[10px] text-white/60 uppercase tracking-wider">
                              {t('No. Anggota', 'Member No.')}
                            </p>
                            <p className="text-xs sm:text-sm font-semibold font-mono">
                              {user?.memberNumber || '---'}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-[9px] sm:text-[10px] text-white/60 uppercase tracking-wider">NIK</p>
                          <p className="text-[10px] sm:text-xs font-mono tracking-widest">
                            {maskNIK(user?.nik)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Shine Effect */}
                    <div 
                      className={cn(
                        "absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent",
                        "translate-x-[-100%] transition-transform duration-700",
                        isHovered && activeIndex === index && "translate-x-[100%]"
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-8 right-8 sm:left-10 sm:right-10 md:left-12 md:right-12 h-0.5 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white/60 transition-all duration-300"
            style={{ 
              width: `${((activeIndex + 1) / savingsData.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-1.5 sm:gap-2 pt-1">
        {savingsData.map((item, index) => (
          <button
            key={item.theme.id}
            onClick={() => goToSlide(index)}
            className={cn(
              "h-1.5 sm:h-2 rounded-full transition-all duration-300",
              activeIndex === index 
                ? "w-5 sm:w-6 bg-primary" 
                : "w-1.5 sm:w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
            aria-label={`Go to ${item.label}`}
          />
        ))}
      </div>
    </div>
  );
};