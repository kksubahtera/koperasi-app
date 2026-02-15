import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string;
  onChange: (value: number) => void;
  prefix?: string;
}

/**
 * Formats a number to Indonesian Rupiah format (e.g., 5000000 -> "5.000.000")
 */
export const formatRupiah = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/\D/g, '')) || 0 : value;
  return numValue.toLocaleString('id-ID');
};

/**
 * Parses a formatted Rupiah string back to a number (e.g., "5.000.000" -> 5000000)
 */
export const parseRupiah = (value: string): number => {
  return parseInt(value.replace(/\D/g, ''), 10) || 0;
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, prefix = 'Rp', ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState('');

    // Sync display value when external value changes
    React.useEffect(() => {
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
      if (numValue > 0) {
        setDisplayValue(formatRupiah(numValue));
      } else {
        setDisplayValue('');
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Remove all non-digit characters
      const numericValue = inputValue.replace(/\D/g, '');
      
      if (numericValue === '') {
        setDisplayValue('');
        onChange(0);
        return;
      }

      const numberValue = parseInt(numericValue, 10);
      setDisplayValue(formatRupiah(numberValue));
      onChange(numberValue);
    };

    return (
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm z-10 pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          className={cn(
            prefix ? 'pl-10' : '',
            'text-right pr-3',
            className
          )}
          value={displayValue}
          onChange={handleChange}
          {...props}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
