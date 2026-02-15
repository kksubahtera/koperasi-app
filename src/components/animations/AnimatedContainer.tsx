import { ReactNode } from 'react';
import { motion, Variants, HTMLMotionProps, Transition } from 'framer-motion';
import { useAnimationConfig } from '@/hooks/useAnimationConfig';
import { cn } from '@/lib/utils';

type AnimationType = 'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale' | 'fadeScale';

interface AnimatedContainerProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  staggerChildren?: boolean;
  staggerDelay?: number;
  className?: string;
}

const getVariants = (type: AnimationType, duration: number): Variants => {
  const baseTransition: Transition = { duration, ease: 'easeOut' };
  const exitTransition: Transition = { duration: duration * 0.8, ease: 'easeIn' };

  const variants: Record<AnimationType, Variants> = {
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: baseTransition },
      exit: { opacity: 0, transition: exitTransition },
    },
    slideUp: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: baseTransition },
      exit: { opacity: 0, y: -10, transition: exitTransition },
    },
    slideDown: {
      hidden: { opacity: 0, y: -20 },
      visible: { opacity: 1, y: 0, transition: baseTransition },
      exit: { opacity: 0, y: 10, transition: exitTransition },
    },
    slideLeft: {
      hidden: { opacity: 0, x: 20 },
      visible: { opacity: 1, x: 0, transition: baseTransition },
      exit: { opacity: 0, x: -10, transition: exitTransition },
    },
    slideRight: {
      hidden: { opacity: 0, x: -20 },
      visible: { opacity: 1, x: 0, transition: baseTransition },
      exit: { opacity: 0, x: 10, transition: exitTransition },
    },
    scale: {
      hidden: { opacity: 0, scale: 0.95 },
      visible: { opacity: 1, scale: 1, transition: baseTransition },
      exit: { opacity: 0, scale: 0.95, transition: exitTransition },
    },
    fadeScale: {
      hidden: { opacity: 0, scale: 0.9 },
      visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 20 } },
      exit: { opacity: 0, scale: 0.95, transition: exitTransition },
    },
  };

  return variants[type];
};

export const AnimatedContainer = ({
  children,
  animation = 'fade',
  delay = 0,
  duration,
  staggerChildren = false,
  staggerDelay,
  className,
  ...props
}: AnimatedContainerProps) => {
  const config = useAnimationConfig();
  const actualDuration = duration ?? config.duration.normal;
  const actualStaggerDelay = staggerDelay ?? config.stagger.normal;

  const variants = getVariants(animation, actualDuration);

  const containerVariants: Variants = staggerChildren
    ? {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: actualStaggerDelay,
            delayChildren: delay,
          },
        },
        exit: { opacity: 0 },
      }
    : variants;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={containerVariants}
      transition={{ delay }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// Child component for staggered animations
export const AnimatedItem = ({
  children,
  animation = 'slideUp',
  className,
  ...props
}: Omit<AnimatedContainerProps, 'staggerChildren' | 'staggerDelay'>) => {
  const config = useAnimationConfig();
  const variants = getVariants(animation, config.duration.normal);

  return (
    <motion.div
      variants={variants}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};
