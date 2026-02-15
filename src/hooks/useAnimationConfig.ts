import { useReducedMotion } from './useReducedMotion';

interface AnimationConfig {
  enabled: boolean;
  duration: {
    fast: number;
    normal: number;
    slow: number;
  };
  spring: {
    gentle: { stiffness: number; damping: number };
    bouncy: { stiffness: number; damping: number };
    stiff: { stiffness: number; damping: number };
  };
  stagger: {
    fast: number;
    normal: number;
    slow: number;
  };
}

export const useAnimationConfig = (): AnimationConfig => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return {
      enabled: false,
      duration: { fast: 0, normal: 0, slow: 0 },
      spring: {
        gentle: { stiffness: 1000, damping: 100 },
        bouncy: { stiffness: 1000, damping: 100 },
        stiff: { stiffness: 1000, damping: 100 },
      },
      stagger: { fast: 0, normal: 0, slow: 0 },
    };
  }

  return {
    enabled: true,
    duration: {
      fast: 0.15,
      normal: 0.3,
      slow: 0.5,
    },
    spring: {
      gentle: { stiffness: 120, damping: 14 },
      bouncy: { stiffness: 300, damping: 10 },
      stiff: { stiffness: 400, damping: 30 },
    },
    stagger: {
      fast: 0.03,
      normal: 0.05,
      slow: 0.1,
    },
  };
};
