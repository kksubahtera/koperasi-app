import { ReactNode } from 'react';
import { motion, AnimatePresence, Variants, Transition } from 'framer-motion';
import { useAnimationConfig } from '@/hooks/useAnimationConfig';
import { cn } from '@/lib/utils';

interface AnimatedListProps {
  children: ReactNode[];
  className?: string;
  itemClassName?: string;
  staggerDelay?: number;
  animation?: 'slideUp' | 'slideLeft' | 'fade' | 'scale';
}

export const AnimatedList = ({
  children,
  className,
  itemClassName,
  staggerDelay,
  animation = 'slideUp',
}: AnimatedListProps) => {
  const config = useAnimationConfig();
  const delay = staggerDelay ?? config.stagger.normal;

  const getItemVariants = (): Variants => {
    const baseTransition: Transition = { duration: config.duration.normal, ease: 'easeOut' };
    const exitTransition: Transition = { duration: config.duration.fast, ease: 'easeIn' };

    switch (animation) {
      case 'slideLeft':
        return {
          hidden: { opacity: 0, x: 20 },
          visible: { opacity: 1, x: 0, transition: baseTransition },
          exit: { opacity: 0, x: -10, transition: exitTransition },
        };
      case 'fade':
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: baseTransition },
          exit: { opacity: 0, transition: exitTransition },
        };
      case 'scale':
        return {
          hidden: { opacity: 0, scale: 0.9 },
          visible: { opacity: 1, scale: 1, transition: { type: 'spring', ...config.spring.gentle } },
          exit: { opacity: 0, scale: 0.95, transition: exitTransition },
        };
      case 'slideUp':
      default:
        return {
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0, transition: baseTransition },
          exit: { opacity: 0, y: -10, transition: exitTransition },
        };
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: delay,
      },
    },
  };

  const itemVariants = getItemVariants();

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={cn(className)}
    >
      <AnimatePresence mode="popLayout">
        {children.map((child, index) => (
          <motion.div
            key={index}
            variants={itemVariants}
            layout
            className={cn(itemClassName)}
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

// Single animated list item for manual control
interface AnimatedListItemProps {
  children: ReactNode;
  index?: number;
  className?: string;
}

export const AnimatedListItem = ({
  children,
  index = 0,
  className,
}: AnimatedListItemProps) => {
  const config = useAnimationConfig();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        delay: index * config.stagger.normal,
        duration: config.duration.normal,
        ease: 'easeOut',
      }}
      layout
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
};
