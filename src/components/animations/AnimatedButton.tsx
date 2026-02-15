import { ReactNode, forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { useAnimationConfig } from '@/hooks/useAnimationConfig';
import { cn } from '@/lib/utils';
import { Loader2, Check, X } from 'lucide-react';

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

interface AnimatedButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  state?: ButtonState;
  className?: string;
  ripple?: boolean;
}

export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ children, state = 'idle', className, ripple = false, disabled, ...props }, ref) => {
    const config = useAnimationConfig();

    const getContent = () => {
      switch (state) {
        case 'loading':
          return (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </motion.span>
          );
        case 'success':
          return (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', ...config.spring.bouncy }}
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              <span>Success!</span>
            </motion.span>
          );
        case 'error':
          return (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, x: [0, -4, 4, -4, 4, 0] }}
              transition={{ x: { duration: 0.4 } }}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              <span>Error</span>
            </motion.span>
          );
        default:
          return children;
      }
    };

    return (
      <motion.button
        ref={ref}
        whileHover={config.enabled && !disabled ? { scale: 1.02 } : {}}
        whileTap={config.enabled && !disabled ? { scale: 0.98 } : {}}
        transition={{ type: 'spring', ...config.spring.stiff }}
        disabled={disabled || state === 'loading'}
        className={cn(
          'relative overflow-hidden transition-colors',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: config.duration.fast }}
        >
          {getContent()}
        </motion.span>
      </motion.button>
    );
  }
);

AnimatedButton.displayName = 'AnimatedButton';
