import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Landmark, TrendingUp, TrendingDown, Users, CreditCard, Wallet, Building2, Receipt, Shield, Coins } from 'lucide-react';
import { 
  RupiahIcon, 
  RupiahPlusIcon, 
  RupiahMinusIcon, 
  RupiahUpIcon, 
  RupiahDownIcon,
  RupiahCircleIcon,
  RupiahStackIcon
} from '@/components/ui/rupiah-icon';

// Predefined icon types for consistent Indonesian financial context
export type StatIconType = 
  | 'rupiah'           // Basic currency
  | 'rupiah-plus'      // Income/incoming
  | 'rupiah-minus'     // Expense/outgoing
  | 'rupiah-up'        // Growth
  | 'rupiah-down'      // Decrease
  | 'rupiah-circle'    // Balance/total
  | 'rupiah-stack'     // Large amounts
  | 'landmark'         // Institution/bank
  | 'savings'          // Savings (wallet)
  | 'loan'             // Loans (credit card)
  | 'members'          // Members
  | 'building'         // Business unit
  | 'receipt'          // Transaction
  | 'shield'           // Reserve/protection
  | 'coins'            // Small amounts
  | 'trend-up'         // Positive trend
  | 'trend-down';      // Negative trend

// Predefined color variants
export type StatColorVariant = 
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'teal'
  | 'amber'
  | 'rose'
  | 'indigo';

const iconMap: Record<StatIconType, React.ComponentType<{ className?: string }>> = {
  'rupiah': RupiahIcon,
  'rupiah-plus': RupiahPlusIcon,
  'rupiah-minus': RupiahMinusIcon,
  'rupiah-up': RupiahUpIcon,
  'rupiah-down': RupiahDownIcon,
  'rupiah-circle': RupiahCircleIcon,
  'rupiah-stack': RupiahStackIcon,
  'landmark': Landmark,
  'savings': Wallet,
  'loan': CreditCard,
  'members': Users,
  'building': Building2,
  'receipt': Receipt,
  'shield': Shield,
  'coins': Coins,
  'trend-up': TrendingUp,
  'trend-down': TrendingDown,
};

const colorVariants: Record<StatColorVariant, { bg: string; text: string; gradient: string }> = {
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    gradient: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20'
  },
  success: {
    bg: 'bg-green-500/10',
    text: 'text-green-600 dark:text-green-400',
    gradient: 'bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200 dark:border-green-800'
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    gradient: 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border-amber-200 dark:border-amber-800'
  },
  danger: {
    bg: 'bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    gradient: 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10 border-red-200 dark:border-red-800'
  },
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    gradient: 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border-blue-200 dark:border-blue-800'
  },
  purple: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    gradient: 'bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border-purple-200 dark:border-purple-800'
  },
  teal: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-600 dark:text-teal-400',
    gradient: 'bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-900/20 dark:to-teal-800/10 border-teal-200 dark:border-teal-800'
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    gradient: 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border-amber-200 dark:border-amber-800'
  },
  rose: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    gradient: 'bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-900/20 dark:to-rose-800/10 border-rose-200 dark:border-rose-800'
  },
  indigo: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-600 dark:text-indigo-400',
    gradient: 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-800/10 border-indigo-200 dark:border-indigo-800'
  },
};

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  iconBgColor?: string;
  className?: string;
}

interface IndonesianStatCardProps {
  iconType: StatIconType;
  value: string | number;
  label: string;
  colorVariant?: StatColorVariant;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  description?: string;
  useGradient?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Basic StatCard component (backward compatible)
 */
export function StatCard({ icon, value, label, iconBgColor = 'bg-primary/10', className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-3 sm:p-4 lg:p-5 xl:p-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={cn(
            "flex h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-lg",
            iconBgColor
          )}>
            <div className="[&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5 lg:[&>svg]:h-6 lg:[&>svg]:w-6">
              {icon}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground truncate">
              {value}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {label}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Indonesian-styled StatCard with predefined icons and colors
 * Designed for consistent financial UI in Indonesian cooperative apps
 */
export function IndonesianStatCard({
  iconType,
  value,
  label,
  colorVariant = 'primary',
  trend,
  trendValue,
  description,
  useGradient = false,
  size = 'md',
  className
}: IndonesianStatCardProps) {
  const IconComponent = iconMap[iconType];
  const colors = colorVariants[colorVariant];

  const sizeClasses = {
    sm: {
      card: 'p-2.5 sm:p-3',
      iconContainer: 'h-8 w-8 sm:h-9 sm:w-9',
      iconSize: '[&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-4.5 sm:[&>svg]:w-4.5',
      value: 'text-base sm:text-lg font-bold',
      label: 'text-[10px] sm:text-xs',
      trend: 'text-[10px]'
    },
    md: {
      card: 'p-3 sm:p-4',
      iconContainer: 'h-10 w-10 sm:h-12 sm:w-12',
      iconSize: '[&>svg]:h-5 [&>svg]:w-5 sm:[&>svg]:h-6 sm:[&>svg]:w-6',
      value: 'text-lg sm:text-2xl font-bold',
      label: 'text-xs sm:text-sm',
      trend: 'text-xs'
    },
    lg: {
      card: 'p-4 sm:p-6',
      iconContainer: 'h-12 w-12 sm:h-14 sm:w-14',
      iconSize: '[&>svg]:h-6 [&>svg]:w-6 sm:[&>svg]:h-7 sm:[&>svg]:w-7',
      value: 'text-xl sm:text-3xl font-bold',
      label: 'text-sm sm:text-base',
      trend: 'text-sm'
    }
  };

  const sizes = sizeClasses[size];

  return (
    <Card className={cn(
      useGradient ? colors.gradient : '',
      className
    )}>
      <CardContent className={sizes.card}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={cn(
            "flex shrink-0 items-center justify-center rounded-lg",
            sizes.iconContainer,
            colors.bg
          )}>
            <div className={cn(sizes.iconSize, colors.text)}>
              <IconComponent />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={cn(sizes.value, "text-foreground truncate")}>
                {value}
              </p>
              {trend && trendValue && (
                <span className={cn(
                  sizes.trend,
                  "flex items-center gap-0.5 font-medium",
                  trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
                )}>
                  {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
                  {trendValue}
                </span>
              )}
            </div>
            <p className={cn(sizes.label, "text-muted-foreground truncate")}>
              {label}
            </p>
            {description && (
              <p className="text-[10px] sm:text-xs text-muted-foreground/70 truncate mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact Indonesian stat for dashboard grids
 */
export function CompactStatCard({
  iconType,
  value,
  label,
  colorVariant = 'primary',
  className
}: Omit<IndonesianStatCardProps, 'trend' | 'trendValue' | 'description' | 'useGradient' | 'size'>) {
  const IconComponent = iconMap[iconType];
  const colors = colorVariants[colorVariant];

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded-lg border bg-card",
      className
    )}>
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
        colors.bg
      )}>
        <IconComponent className={cn("h-4 w-4", colors.text)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

/**
 * Financial summary card with multiple stats
 */
interface FinancialSummaryCardProps {
  title: string;
  stats: Array<{
    iconType: StatIconType;
    value: string | number;
    label: string;
    colorVariant?: StatColorVariant;
  }>;
  className?: string;
}

export function FinancialSummaryCard({ title, stats, className }: FinancialSummaryCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
        <div className="grid gap-2">
          {stats.map((stat, index) => {
            const IconComponent = iconMap[stat.iconType];
            const colors = colorVariants[stat.colorVariant || 'primary'];
            return (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <IconComponent className={cn("h-4 w-4", colors.text)} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <span className="text-sm font-semibold">{stat.value}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}