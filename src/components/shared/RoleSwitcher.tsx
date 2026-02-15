import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Shield, User, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const roleConfig: Record<UserRole, { labelId: string; labelEn: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  admin: {
    labelId: 'Admin',
    labelEn: 'Admin',
    icon: Shield,
    color: 'text-amber-600 dark:text-amber-400',
  },
  member: {
    labelId: 'Anggota',
    labelEn: 'Member',
    icon: User,
    color: 'text-primary',
  },
};

export const RoleSwitcher = () => {
  const { user, switchRole, hasRole } = useAuth();
  const { t } = useThemeLanguage();

  // Only show if user has multiple roles
  if (!user || user.roles.length <= 1) {
    return null;
  }

  const currentRole = roleConfig[user.activeRole];
  const CurrentIcon = currentRole.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1.5 h-8 px-2 sm:px-3 border-border/50 bg-background/50 backdrop-blur-sm hover:bg-accent/50"
        >
          <CurrentIcon className={cn("h-3.5 w-3.5", currentRole.color)} />
          <span className="hidden sm:inline text-xs font-medium">
            {t(currentRole.labelId, currentRole.labelEn)}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 backdrop-blur-xl bg-card/95 border-border/50">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          {t('Mode Tampilan', 'View Mode')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.roles.map((role) => {
          const config = roleConfig[role];
          const Icon = config.icon;
          const isActive = user.activeRole === role;

          return (
            <DropdownMenuItem
              key={role}
              onClick={() => switchRole(role)}
              className={cn(
                "gap-2 cursor-pointer",
                isActive && "bg-accent"
              )}
            >
              <Icon className={cn("h-4 w-4", config.color)} />
              <span className="flex-1">{t(config.labelId, config.labelEn)}</span>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
