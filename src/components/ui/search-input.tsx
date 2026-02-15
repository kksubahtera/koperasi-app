import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

export interface SearchInputProps extends React.ComponentProps<"input"> {
  containerClassName?: string;
  iconClassName?: string;
  onClear?: () => void;
  /** Compact size for mobile - reduces height and padding */
  compact?: boolean;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, iconClassName, value, onClear, onChange, compact = false, ...props }, ref) => {
    const hasValue = value !== undefined && value !== "";

    const handleClear = () => {
      if (onClear) {
        onClear();
      } else if (onChange) {
        const syntheticEvent = {
          target: { value: "" },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    return (
      <div className={cn("relative w-full flex items-center", containerClassName)}>
        <Search 
          className={cn(
            "absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10",
            compact ? "h-3.5 w-3.5" : "h-4 w-4",
            iconClassName
          )} 
        />
        <Input
          className={cn(
            // Base responsive styles with increased left padding for icon to prevent overlap
            compact 
              ? "h-8 sm:h-9 text-xs sm:text-sm pl-10 sm:pl-11 pr-8 sm:pr-9 rounded-lg"
              : "h-9 sm:h-10 md:h-11 text-xs sm:text-sm pl-11 sm:pl-12 rounded-lg sm:rounded-xl",
            hasValue && (compact ? "pr-8 sm:pr-9" : "pr-8 sm:pr-10"),
            className
          )}
          ref={ref}
          value={value}
          onChange={onChange}
          {...props}
        />
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10 p-1 rounded-full hover:bg-muted/50",
              compact ? "right-1.5 sm:right-2" : "right-2 sm:right-3"
            )}
            aria-label="Clear search"
          >
            <X className={compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5 sm:h-4 sm:w-4"} />
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
