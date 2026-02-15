import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnimationConfig } from '@/hooks/useAnimationConfig';
import { cn } from '@/lib/utils';

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export const AnimatedModal = ({
  isOpen,
  onClose,
  children,
  className,
}: AnimatedModalProps) => {
  const config = useAnimationConfig();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: config.duration.fast }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />
          
          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{
              type: 'spring',
              ...config.spring.gentle,
              duration: config.duration.normal,
            }}
            className={cn(
              'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
              'w-full max-w-lg',
              className
            )}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Animated Sheet (slides from bottom on mobile)
interface AnimatedSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  side?: 'bottom' | 'right';
}

export const AnimatedSheet = ({
  isOpen,
  onClose,
  children,
  className,
  side = 'bottom',
}: AnimatedSheetProps) => {
  const config = useAnimationConfig();

  const getSlideAnimation = () => {
    if (side === 'right') {
      return {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
      };
    }
    return {
      initial: { y: '100%' },
      animate: { y: 0 },
      exit: { y: '100%' },
    };
  };

  const slideAnimation = getSlideAnimation();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: config.duration.fast }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />
          
          {/* Sheet Content */}
          <motion.div
            {...slideAnimation}
            transition={{
              type: 'spring',
              ...config.spring.stiff,
            }}
            className={cn(
              'fixed z-50 bg-background shadow-lg',
              side === 'bottom' && 'inset-x-0 bottom-0 rounded-t-2xl',
              side === 'right' && 'inset-y-0 right-0 w-full max-w-sm',
              className
            )}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
