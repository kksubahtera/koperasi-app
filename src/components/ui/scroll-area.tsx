import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  showBounceEffect?: boolean;
}

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, children, showBounceEffect = true, ...props }, ref) => {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [showTopBounce, setShowTopBounce] = React.useState(false);
  const [showBottomBounce, setShowBottomBounce] = React.useState(false);

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!showBounceEffect) return;
    
    const target = e.currentTarget;
    const isAtTop = target.scrollTop <= 0;
    const isAtBottom = Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) < 1;

    if (isAtTop && target.scrollTop === 0) {
      setShowTopBounce(true);
      setTimeout(() => setShowTopBounce(false), 400);
    }
    
    if (isAtBottom) {
      setShowBottomBounce(true);
      setTimeout(() => setShowBottomBounce(false), 400);
    }
  }, [showBounceEffect]);

  return (
    <ScrollAreaPrimitive.Root 
      ref={ref} 
      className={cn("relative overflow-hidden", className)} 
      {...props}
    >
      {/* Top bounce indicator */}
      {showBounceEffect && (
        <div 
          className={cn(
            "absolute top-0 left-0 right-0 h-8 pointer-events-none z-10 transition-opacity duration-300",
            "bg-gradient-to-b from-primary/10 to-transparent",
            showTopBounce ? "opacity-100 animate-overscroll-bounce" : "opacity-0"
          )}
        />
      )}
      
      <ScrollAreaPrimitive.Viewport 
        ref={viewportRef}
        className="h-full w-full rounded-[inherit] overscroll-contain scroll-smooth"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
        onScroll={handleScroll}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      
      {/* Bottom bounce indicator */}
      {showBounceEffect && (
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 h-8 pointer-events-none z-10 transition-opacity duration-300",
            "bg-gradient-to-t from-primary/10 to-transparent",
            showBottomBounce ? "opacity-100 animate-overscroll-bounce" : "opacity-0"
          )}
        />
      )}
      
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border hover:bg-muted-foreground/50 transition-colors" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
