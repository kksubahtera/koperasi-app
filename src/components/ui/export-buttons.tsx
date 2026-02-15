import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ExportButtonsProps {
  onExportExcel?: () => void | Promise<void>;
  onExportPDF?: () => void | Promise<void>;
  disabled?: boolean;
  isExporting?: boolean;
  excelLabel?: string;
  pdfLabel?: string;
  triggerLabel?: string;
  exportingLabel?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  className?: string;
  showDropdown?: boolean;
  hideExcel?: boolean;
  hidePDF?: boolean;
}

export const ExportButtons = ({
  onExportExcel,
  onExportPDF,
  disabled = false,
  isExporting = false,
  excelLabel = 'Export ke Excel',
  pdfLabel = 'Export ke PDF',
  triggerLabel = 'Export',
  exportingLabel = 'Mengekspor...',
  size = 'sm',
  variant = 'outline',
  className,
  showDropdown = true,
  hideExcel = false,
  hidePDF = false,
}: ExportButtonsProps) => {
  const [internalExporting, setInternalExporting] = useState(false);
  const loading = isExporting || internalExporting;

  const handleExport = async (exportFn?: () => void | Promise<void>) => {
    if (!exportFn) return;
    setInternalExporting(true);
    try {
      await exportFn();
    } finally {
      setInternalExporting(false);
    }
  };

  // If showDropdown is false, render inline buttons
  if (!showDropdown) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {!hideExcel && onExportExcel && (
          <Button
            variant={variant}
            size={size}
            onClick={() => handleExport(onExportExcel)}
            disabled={disabled || loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-success" />
            )}
            {excelLabel}
          </Button>
        )}
        {!hidePDF && onExportPDF && (
          <Button
            variant={variant}
            size={size}
            onClick={() => handleExport(onExportPDF)}
            disabled={disabled || loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 text-destructive" />
            )}
            {pdfLabel}
          </Button>
        )}
      </div>
    );
  }

  // Dropdown menu style
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn('gap-2', className)}
          disabled={disabled || loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {loading ? exportingLabel : triggerLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!hideExcel && onExportExcel && (
          <DropdownMenuItem onClick={() => handleExport(onExportExcel)}>
            <FileSpreadsheet className="h-4 w-4 mr-2 text-success" />
            {excelLabel}
          </DropdownMenuItem>
        )}
        {!hidePDF && onExportPDF && (
          <DropdownMenuItem onClick={() => handleExport(onExportPDF)}>
            <FileText className="h-4 w-4 mr-2 text-destructive" />
            {pdfLabel}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
