import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnimationConfig } from '@/hooks/useAnimationConfig';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: ReactNode;
  viewKey: string;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export const PageTransition = ({ 
  children, 
  viewKey, 
  className,
  direction = 'up' 
}: PageTransitionProps) => {
  const config = useAnimationConfig();

  const getDirectionOffset = () => {
    switch (direction) {
      case 'up': return { y: 20, x: 0 };
      case 'down': return { y: -20, x: 0 };
      case 'left': return { y: 0, x: 20 };
      case 'right': return { y: 0, x: -20 };
    }
  };

  const offset = getDirectionOffset();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewKey}
        initial={{ 
          opacity: 0, 
          y: config.enabled ? offset.y : 0,
          x: config.enabled ? offset.x : 0
        }}
        animate={{ 
          opacity: 1, 
          y: 0, 
          x: 0 
        }}
        exit={{ 
          opacity: 0, 
          y: config.enabled ? offset.y * -0.5 : 0,
          x: config.enabled ? offset.x * -0.5 : 0
        }}
        transition={{
          duration: config.duration.normal,
          ease: 'easeOut',
        }}
        className={cn(className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};