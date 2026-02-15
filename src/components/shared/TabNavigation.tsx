import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LucideIcon } from 'lucide-react';

export interface TabItem {
  value: string;
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  badge?: number | string;
}

interface TabNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (value: string) => void;
  size?: 'sm' | 'default';
}

export const TabNavigation = ({
  tabs,
  activeTab,
  onTabChange,
  size = 'default',
}: TabNavigationProps) => {
  const sizeClasses = size === 'sm' 
    ? 'px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs gap-1 sm:gap-1.5' 
    : 'px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm gap-1 sm:gap-2';

  return (
    <div className="overflow-x-auto pb-2 -mx-2 sm:-mx-1 px-2 sm:px-1 scrollbar-hide">
      <TooltipProvider delayDuration={300}>
        <div className="inline-flex w-max gap-0.5 sm:gap-1 bg-muted/50 p-1 sm:p-1.5 rounded-lg sm:rounded-xl border border-border/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <Tooltip key={tab.value}>
                <TooltipTrigger asChild>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onTabChange(tab.value)}
                    className={`
                      relative h-auto font-medium whitespace-nowrap
                      transition-all duration-200 rounded-md sm:rounded-lg
                      ${sizeClasses}
                      ${isActive 
                        ? 'bg-primary text-primary-foreground shadow-md ring-1 sm:ring-2 ring-primary/20' 
                        : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                      }
                    `}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span className="hidden xs:inline sm:inline truncate max-w-[60px] sm:max-w-none">{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className={`
                        ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-xs font-bold rounded-full flex-shrink-0
                        ${isActive 
                          ? 'bg-primary-foreground/20 text-primary-foreground' 
                          : 'bg-warning text-warning-foreground'
                        }
                      `}>
                        {tab.badge}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                {tab.tooltip && (
                  <TooltipContent side="bottom" className="text-xs">
                    <p>{tab.tooltip}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
};
