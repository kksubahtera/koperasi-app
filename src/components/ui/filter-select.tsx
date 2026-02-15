import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LucideIcon } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  icon?: LucideIcon;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  allLabel?: string;
  showAllOption?: boolean;
  disabled?: boolean;
}

const FilterSelect = React.forwardRef<HTMLButtonElement, FilterSelectProps>(
  (
    {
      value,
      onValueChange,
      options,
      placeholder = "Pilih opsi",
      icon: Icon,
      className,
      triggerClassName,
      contentClassName,
      allLabel = "Semua",
      showAllOption = true,
      disabled = false,
    },
    ref
  ) => {
    return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          ref={ref}
          className={cn("w-full sm:w-40", triggerClassName, className)}
        >
          {Icon && <Icon className="h-4 w-4 mr-2 shrink-0" />}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={cn("bg-popover", contentClassName)}>
          {showAllOption && (
            <SelectItem value="all">{allLabel}</SelectItem>
          )}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
);

FilterSelect.displayName = "FilterSelect";

export { FilterSelect };
