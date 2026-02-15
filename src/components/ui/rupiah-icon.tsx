import * as React from 'react';
import { cn } from '@/lib/utils';

interface RupiahIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Custom Rupiah (Rp) icon component - Base icon
 */
const RupiahIcon = React.forwardRef<SVGSVGElement, RupiahIconProps>(
  ({ className, size = 24, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("lucide", className)}
        {...props}
      >
        {/* R */}
        <path d="M6 5v14" />
        <path d="M6 5h4a3 3 0 0 1 0 6H6" />
        <path d="M10 11l3 8" />
        {/* p */}
        <path d="M16 10v9" />
        <path d="M16 13a2.5 2.5 0 1 1 0 5" />
      </svg>
    );
  }
);
RupiahIcon.displayName = 'RupiahIcon';

/**
 * Rupiah icon with plus sign - for income/incoming transactions
 */
const RupiahPlusIcon = React.forwardRef<SVGSVGElement, RupiahIconProps>(
  ({ className, size = 24, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("lucide", className)}
        {...props}
      >
        {/* R - smaller */}
        <path d="M4 6v12" />
        <path d="M4 6h3a2.5 2.5 0 0 1 0 5H4" />
        <path d="M7 11l2.5 7" />
        {/* p - smaller */}
        <path d="M12 10v8" />
        <path d="M12 12.5a2 2 0 1 1 0 4" />
        {/* Plus sign */}
        <path d="M19 5v6" />
        <path d="M16 8h6" />
      </svg>
    );
  }
);
RupiahPlusIcon.displayName = 'RupiahPlusIcon';

/**
 * Rupiah icon with minus sign - for expense/outgoing transactions
 */
const RupiahMinusIcon = React.forwardRef<SVGSVGElement, RupiahIconProps>(
  ({ className, size = 24, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("lucide", className)}
        {...props}
      >
        {/* R - smaller */}
        <path d="M4 6v12" />
        <path d="M4 6h3a2.5 2.5 0 0 1 0 5H4" />
        <path d="M7 11l2.5 7" />
        {/* p - smaller */}
        <path d="M12 10v8" />
        <path d="M12 12.5a2 2 0 1 1 0 4" />
        {/* Minus sign */}
        <path d="M16 8h6" />
      </svg>
    );
  }
);
RupiahMinusIcon.displayName = 'RupiahMinusIcon';

/**
 * Rupiah icon with arrow up - for large amounts/growth
 */
const RupiahUpIcon = React.forwardRef<SVGSVGElement, RupiahIconProps>(
  ({ className, size = 24, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("lucide", className)}
        {...props}
      >
        {/* R - smaller */}
        <path d="M4 6v12" />
        <path d="M4 6h3a2.5 2.5 0 0 1 0 5H4" />
        <path d="M7 11l2.5 7" />
        {/* p - smaller */}
        <path d="M12 10v8" />
        <path d="M12 12.5a2 2 0 1 1 0 4" />
        {/* Arrow up */}
        <path d="M19 11V5" />
        <path d="M16 8l3-3 3 3" />
      </svg>
    );
  }
);
RupiahUpIcon.displayName = 'RupiahUpIcon';

/**
 * Rupiah icon with arrow down - for small amounts/decrease
 */
const RupiahDownIcon = React.forwardRef<SVGSVGElement, RupiahIconProps>(
  ({ className, size = 24, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("lucide", className)}
        {...props}
      >
        {/* R - smaller */}
        <path d="M4 6v12" />
        <path d="M4 6h3a2.5 2.5 0 0 1 0 5H4" />
        <path d="M7 11l2.5 7" />
        {/* p - smaller */}
        <path d="M12 10v8" />
        <path d="M12 12.5a2 2 0 1 1 0 4" />
        {/* Arrow down */}
        <path d="M19 5v6" />
        <path d="M16 8l3 3 3-3" />
      </svg>
    );
  }
);
RupiahDownIcon.displayName = 'RupiahDownIcon';

/**
 * Rupiah icon in circle - for balance/total amounts
 */
const RupiahCircleIcon = React.forwardRef<SVGSVGElement, RupiahIconProps>(
  ({ className, size = 24, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("lucide", className)}
        {...props}
      >
        {/* Circle */}
        <circle cx="12" cy="12" r="10" />
        {/* R - centered and smaller */}
        <path d="M8 7v10" />
        <path d="M8 7h2.5a2 2 0 0 1 0 4H8" />
        <path d="M10.5 11l2 6" />
        {/* p - centered and smaller */}
        <path d="M14 9v7" />
        <path d="M14 11a1.5 1.5 0 1 1 0 3" />
      </svg>
    );
  }
);
RupiahCircleIcon.displayName = 'RupiahCircleIcon';

/**
 * Rupiah icon with stack - for large amounts/wealth
 */
const RupiahStackIcon = React.forwardRef<SVGSVGElement, RupiahIconProps>(
  ({ className, size = 24, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("lucide", className)}
        {...props}
      >
        {/* Stack lines */}
        <path d="M4 18h16" />
        <path d="M4 14h16" />
        {/* R */}
        <path d="M7 4v8" />
        <path d="M7 4h2.5a2 2 0 0 1 0 4H7" />
        <path d="M9.5 8l2 4" />
        {/* p */}
        <path d="M14 6v6" />
        <path d="M14 7.5a1.5 1.5 0 1 1 0 3" />
      </svg>
    );
  }
);
RupiahStackIcon.displayName = 'RupiahStackIcon';

export { 
  RupiahIcon, 
  RupiahPlusIcon, 
  RupiahMinusIcon, 
  RupiahUpIcon, 
  RupiahDownIcon,
  RupiahCircleIcon,
  RupiahStackIcon
};
