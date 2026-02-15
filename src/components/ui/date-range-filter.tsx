import * as React from "react";
import { Calendar, X } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Calendar as CalendarComponent } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface DateRangeFilterProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onClear?: () => void;
  startPlaceholder?: string;
  endPlaceholder?: string;
  dateFormat?: string;
  showLabel?: boolean;
  label?: string;
  className?: string;
  buttonClassName?: string;
  align?: "start" | "center" | "end";
  disabled?: boolean;
}

const DateRangeFilter = React.forwardRef<HTMLDivElement, DateRangeFilterProps>(
  (
    {
      startDate,
      endDate,
      onStartDateChange,
      onEndDateChange,
      onClear,
      startPlaceholder = "Dari",
      endPlaceholder = "Sampai",
      dateFormat = "dd MMM yyyy",
      showLabel = false,
      label = "Rentang Tanggal:",
      className,
      buttonClassName,
      align = "start",
      disabled = false,
    },
    ref
  ) => {
    const [showStartCalendar, setShowStartCalendar] = React.useState(false);
    const [showEndCalendar, setShowEndCalendar] = React.useState(false);

    const hasValue = startDate || endDate;

    const handleClear = () => {
      onStartDateChange(undefined);
      onEndDateChange(undefined);
      onClear?.();
    };

    const handleStartDateSelect = (date: Date | undefined) => {
      onStartDateChange(date);
      setShowStartCalendar(false);
    };

    const handleEndDateSelect = (date: Date | undefined) => {
      onEndDateChange(date);
      setShowEndCalendar(false);
    };

    return (
      <div ref={ref} className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
        {showLabel && (
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {label}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {/* Start Date */}
          <Popover open={showStartCalendar} onOpenChange={setShowStartCalendar}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={disabled}
                className={cn(
                  "w-[140px] sm:w-[160px] justify-start text-left font-normal",
                  !startDate && "text-muted-foreground",
                  buttonClassName
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {startDate 
                  ? format(startDate, dateFormat, { locale: idLocale }) 
                  : startPlaceholder
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align={align}>
              <CalendarComponent
                mode="single"
                selected={startDate}
                onSelect={handleStartDateSelect}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground">—</span>

          {/* End Date */}
          <Popover open={showEndCalendar} onOpenChange={setShowEndCalendar}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={disabled}
                className={cn(
                  "w-[140px] sm:w-[160px] justify-start text-left font-normal",
                  !endDate && "text-muted-foreground",
                  buttonClassName
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {endDate 
                  ? format(endDate, dateFormat, { locale: idLocale }) 
                  : endPlaceholder
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align={align}>
              <CalendarComponent
                mode="single"
                selected={endDate}
                onSelect={handleEndDateSelect}
                disabled={(date) => startDate ? date < startDate : false}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Clear Button */}
          {hasValue && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={disabled}
              className="h-9 px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }
);

DateRangeFilter.displayName = "DateRangeFilter";

export { DateRangeFilter };
