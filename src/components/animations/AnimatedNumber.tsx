import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform, useInView } from 'framer-motion';
import { useAnimationConfig } from '@/hooks/useAnimationConfig';
import { cn } from '@/lib/utils';

interface AnimatedNumberProps {
  value: number;
  format?: 'number' | 'currency' | 'percent';
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  locale?: string;
}

export const AnimatedNumber = ({
  value,
  format = 'number',
  duration = 1.5,
  className,
  prefix = '',
  suffix = '',
  locale = 'id-ID',
}: AnimatedNumberProps) => {
  const config = useAnimationConfig();
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const spring = useSpring(0, {
    stiffness: 50,
    damping: 20,
    duration: config.enabled ? duration : 0,
  });

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [spring, value, isInView]);

  const formatted = useTransform(spring, (latest) => {
    const num = Math.round(latest);
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(num);
      case 'percent':
        return `${num}%`;
      default:
        return new Intl.NumberFormat(locale).format(num);
    }
  });

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      <motion.span>{formatted}</motion.span>
      {suffix}
    </span>
  );
};

// Compact version for smaller numbers
interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export const AnimatedCounter = ({ value, className }: AnimatedCounterProps) => {
  const config = useAnimationConfig();

  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: config.enabled ? 10 : 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: config.enabled ? -10 : 0 }}
      transition={{ duration: config.duration.fast }}
      className={cn('inline-block tabular-nums', className)}
    >
      {value}
    </motion.span>
  );
};
