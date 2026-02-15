import { forwardRef } from 'react';
import { Sun, Moon, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark';

interface ThemeLanguageToggleProps {
  variant?: 'default' | 'minimal' | 'splash';
  className?: string;
}

export const ThemeLanguageToggle = forwardRef<HTMLDivElement, ThemeLanguageToggleProps>(
  ({ variant = 'default', className }, ref) => {
  const { theme, language, toggleTheme, setLanguage, setTheme } = useThemeLanguage();

  if (variant === 'splash') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* Language Toggle */}
        <div className="flex rounded-full bg-white/20 p-1 backdrop-blur-sm">
          <button
            onClick={() => setLanguage('id')}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-full transition-all",
              language === 'id' 
                ? "bg-white text-primary shadow-sm" 
                : "text-white/80 hover:text-white"
            )}
          >
            ID
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-full transition-all",
              language === 'en' 
                ? "bg-white text-primary shadow-sm" 
                : "text-white/80 hover:text-white"
            )}
          >
            EN
          </button>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-all hover:bg-white/30"
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
          className="h-8 gap-1 px-2"
        >
          <Languages className="h-4 w-4" />
          <span className="text-xs font-medium">{language.toUpperCase()}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-8 w-8"
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  // Default variant - for cards/settings
  return (
    <div className={cn("flex flex-col gap-4 p-4 rounded-lg border border-border bg-muted/30", className)}>
      {/* Language Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Languages className="h-4 w-4" />
          {language === 'id' ? 'Bahasa' : 'Language'}
        </label>
        <div className="flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setLanguage('id')}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-all",
              language === 'id' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            🇮🇩 Indonesia
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-all",
              language === 'en' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            🇺🇸 English
          </button>
        </div>
      </div>

      {/* Theme Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          {theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {language === 'id' ? 'Tema' : 'Theme'}
        </label>
        <div className="flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
              theme === 'light' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sun className="h-4 w-4" />
            Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
              theme === 'dark' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Moon className="h-4 w-4" />
            Dark
          </button>
        </div>
      </div>
    </div>
  );
});

ThemeLanguageToggle.displayName = 'ThemeLanguageToggle';
