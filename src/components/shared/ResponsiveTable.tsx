import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ResponsiveTableProps {
  children: ReactNode;
  className?: string;
}

export const ResponsiveTable = ({ children, className }: ResponsiveTableProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const scrollable = scrollWidth > clientWidth;
      setIsScrollable(scrollable);
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scrollTo = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.6;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className={cn("relative group", className)}>
      {/* Left scroll indicator */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pointer-events-none">
          <div className="h-full w-8 bg-gradient-to-r from-background to-transparent" />
          <button
            onClick={() => scrollTo('left')}
            className="absolute left-1 p-1.5 rounded-full bg-card border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto hover:bg-muted"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
        </div>
      )}

      {/* Right scroll indicator */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pointer-events-none">
          <div className="h-full w-8 bg-gradient-to-l from-background to-transparent" />
          <button
            onClick={() => scrollTo('right')}
            className="absolute right-1 p-1.5 rounded-full bg-card border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto hover:bg-muted"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        </div>
      )}

      {/* Scroll container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="overflow-x-auto overflow-y-hidden scroll-smooth [-webkit-overflow-scrolling:touch] scrollbar-thin"
      >
        {children}
      </div>

      {/* Bottom scroll hint for mobile */}
      {isScrollable && (
        <div className="flex items-center justify-center gap-2 py-2 text-[10px] sm:text-xs text-muted-foreground md:hidden">
          <ChevronLeft className="h-3 w-3" />
          <span>Geser untuk melihat lebih banyak</span>
          <ChevronRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );
};

// Simple table wrapper for basic horizontal scroll
export const ScrollableTableWrapper = ({ 
  children, 
  className 
}: { 
  children: ReactNode; 
  className?: string 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftShadow(scrollLeft > 0);
      setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    handleScroll();
    const ref = scrollRef.current;
    if (ref) {
      const observer = new ResizeObserver(handleScroll);
      observer.observe(ref);
      return () => observer.disconnect();
    }
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* Left shadow */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity duration-200",
          showLeftShadow ? "opacity-100" : "opacity-0"
        )}
      />
      
      {/* Right shadow */}
      <div 
        className={cn(
          "absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity duration-200",
          showRightShadow ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Scroll container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] scrollbar-thin scroll-smooth"
      >
        {children}
      </div>
    </div>
  );
};