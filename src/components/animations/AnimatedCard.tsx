import { ReactNode } from 'react';
import { motion, HTMLMotionProps, TargetAndTransition } from 'framer-motion';
import { useAnimationConfig } from '@/hooks/useAnimationConfig';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  className?: string;
  hoverLift?: boolean;
  tapScale?: boolean;
  delay?: number;
}

export const AnimatedCard = ({
  children,
  className,
  hoverLift = true,
  tapScale = true,
  delay = 0,
  ...props
}: AnimatedCardProps) => {
  const config = useAnimationConfig();
  const isMobile = useIsMobile();

  const hoverAnimation: TargetAndTransition | undefined = 
    hoverLift && !isMobile && config.enabled
      ? {
          y: -4,
          boxShadow: '0 12px 24px -8px hsl(var(--primary) / 0.15)',
          transition: { type: 'spring' as const, ...config.spring.gentle },
        }
      : undefined;

  const tapAnimation: TargetAndTransition | undefined = 
    tapScale && config.enabled
      ? { scale: 0.98 }
      : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{
        delay,
        duration: config.duration.normal,
        ease: 'easeOut',
      }}
      whileHover={hoverAnimation}
      whileTap={tapAnimation}
      className={cn(
        'transition-colors duration-200',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// 3D Tilt Card (Desktop only)
interface AnimatedTiltCardProps extends AnimatedCardProps {
  tiltDegree?: number;
}

export const AnimatedTiltCard = ({
  children,
  className,
  tiltDegree = 5,
  delay = 0,
  ...props
}: AnimatedTiltCardProps) => {
  const config = useAnimationConfig();
  const isMobile = useIsMobile();

  if (isMobile || !config.enabled) {
    return (
      <AnimatedCard className={className} delay={delay} {...props}>
        {children}
      </AnimatedCard>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: config.duration.normal }}
      whileHover={{
        rotateX: tiltDegree,
        rotateY: -tiltDegree,
        scale: 1.02,
        transition: { type: 'spring' as const, ...config.spring.gentle },
      }}
      whileTap={{ scale: 0.98 }}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
      className={cn('transition-shadow duration-200', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};
