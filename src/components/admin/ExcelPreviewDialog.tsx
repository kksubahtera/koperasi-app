import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileSpreadsheet, 
  Check, 
  X, 
  AlertTriangle, 
  FileWarning,
  ChevronLeft,
  ChevronRight,
  Import
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PreviewColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'currency';
}

export interface PreviewRow {
  [key: string]: any;
  _rowIndex?: number;
  _errors?: string[];
  _warnings?: string[];
}

interface ExcelPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  data: PreviewRow[];
  columns: PreviewColumn[];
  validRowCount: number;
  invalidRowCount: number;
  warningRowCount?: number;
  errors?: string[];
  warnings?: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  formatters?: {
    [key: string]: (value: any) => string;
  };
}

const ROWS_PER_PAGE = 20;

export const ExcelPreviewDialog = ({
  open,
  onOpenChange,
  title,
  description,
  data,
  columns,
  validRowCount,
  invalidRowCount,
  warningRowCount = 0,
  errors = [],
  warnings = [],
  onConfirm,
  onCancel,
  isLoading = false,
  formatters = {},
}: ExcelPreviewDialogProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [filterView, setFilterView] = useState<'all' | 'valid' | 'invalid' | 'warnings'>('all');

  // Filter data based on current view
  const filteredData = data.filter(row => {
    if (filterView === 'valid') return !row._errors?.length && !row._warnings?.length;
    if (filterView === 'invalid') return row._errors && row._errors.length > 0;
    if (filterView === 'warnings') return row._warnings && row._warnings.length > 0;
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = Math.min(startIndex + ROWS_PER_PAGE, filteredData.length);
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  const handleFilterChange = (value: string) => {
    setFilterView(value as 'all' | 'valid' | 'invalid' | 'warnings');
    setCurrentPage(1);
  };

  // Format cell value
  const formatCellValue = (column: PreviewColumn, value: any): string => {
    if (value === null || value === undefined) return '-';
    
    // Use custom formatter if provided
    if (formatters[column.key]) {
      return formatters[column.key](value);
    }
    
    // Default formatting based on type
    if (column.type === 'currency') {
      const numValue = Number(value);
      if (isNaN(numValue)) return String(value);
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numValue);
    }
    
    if (column.type === 'number') {
      const numValue = Number(value);
      if (isNaN(numValue)) return String(value);
      return new Intl.NumberFormat('id-ID').format(numValue);
    }
    
    return String(value);
  };

  // Get row status
  const getRowStatus = (row: PreviewRow): 'valid' | 'invalid' | 'warning' => {
    if (row._errors && row._errors.length > 0) return 'invalid';
    if (row._warnings && row._warnings.length > 0) return 'warning';
    return 'valid';
  };

  const canConfirm = validRowCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-green-50 dark:bg-green-900/20 p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span className="font-medium">Valid</span>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{validRowCount}</p>
            <p className="text-xs text-green-600/80 dark:text-green-400/70">baris siap import</p>
          </div>
          
          {warningRowCount > 0 && (
            <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Peringatan</span>
              </div>
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{warningRowCount}</p>
              <p className="text-xs text-yellow-600/80 dark:text-yellow-400/70">perlu perhatian</p>
            </div>
          )}
          
          <div className={cn(
            "rounded-lg border p-3 text-center",
            invalidRowCount > 0 
              ? "bg-red-50 dark:bg-red-900/20" 
              : "bg-muted"
          )}>
            <div className={cn(
              "flex items-center justify-center gap-2",
              invalidRowCount > 0 
                ? "text-red-700 dark:text-red-400" 
                : "text-muted-foreground"
            )}>
              <X className="h-4 w-4" />
              <span className="font-medium">Invalid</span>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              invalidRowCount > 0 
                ? "text-red-700 dark:text-red-400" 
                : "text-muted-foreground"
            )}>{invalidRowCount}</p>
            <p className={cn(
              "text-xs",
              invalidRowCount > 0 
                ? "text-red-600/80 dark:text-red-400/70" 
                : "text-muted-foreground/70"
            )}>baris tidak valid</p>
          </div>
        </div>

        {/* Error Summary */}
        {errors.length > 0 && (
          <Alert variant="destructive" className="py-2">
            <FileWarning className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Ditemukan {errors.length} error:</span>
              <ul className="mt-1 list-disc list-inside text-xs max-h-[60px] overflow-y-auto">
                {errors.slice(0, 5).map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
                {errors.length > 5 && (
                  <li className="text-muted-foreground">...dan {errors.length - 5} error lainnya</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Warning Summary */}
        {warnings.length > 0 && (
          <Alert className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10 py-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <span className="font-medium">Peringatan ({warnings.length}):</span>
              <ul className="mt-1 list-disc list-inside text-xs max-h-[40px] overflow-y-auto">
                {warnings.slice(0, 3).map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Filter Tabs */}
        <Tabs value={filterView} onValueChange={handleFilterChange}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="gap-1">
              Semua <Badge variant="secondary" className="ml-1">{data.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="valid" className="gap-1">
              Valid <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700">{validRowCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="warnings" className="gap-1" disabled={warningRowCount === 0}>
              Peringatan <Badge variant="secondary" className="ml-1 bg-yellow-100 text-yellow-700">{warningRowCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="invalid" className="gap-1" disabled={invalidRowCount === 0}>
              Invalid <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700">{invalidRowCount}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Data Table */}
        <ScrollArea className="flex-1 rounded-md border min-h-[200px] max-h-[300px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[60px] text-center">No.</TableHead>
                <TableHead className="w-[80px] text-center">Status</TableHead>
                {columns.map(col => (
                  <TableHead 
                    key={col.key} 
                    className={cn(
                      "min-w-[120px]",
                      col.type === 'number' || col.type === 'currency' ? 'text-right' : ''
                    )}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 2} className="text-center py-8 text-muted-foreground">
                    Tidak ada data untuk ditampilkan
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, idx) => {
                  const status = getRowStatus(row);
                  const rowNum = row._rowIndex ?? (startIndex + idx + 1);
                  
                  return (
                    <TableRow 
                      key={idx} 
                      className={cn(
                        status === 'invalid' && 'bg-red-50/50 dark:bg-red-900/10',
                        status === 'warning' && 'bg-yellow-50/50 dark:bg-yellow-900/10'
                      )}
                    >
                      <TableCell className="text-center text-muted-foreground text-sm">
                        {rowNum}
                      </TableCell>
                      <TableCell className="text-center">
                        {status === 'valid' && (
                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                        {status === 'warning' && (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            !
                          </Badge>
                        )}
                        {status === 'invalid' && (
                          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-xs">
                            <X className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        )}
                      </TableCell>
                      {columns.map(col => (
                        <TableCell 
                          key={col.key}
                          className={cn(
                            "text-sm",
                            col.type === 'number' || col.type === 'currency' ? 'text-right font-mono' : ''
                          )}
                        >
                          {formatCellValue(col, row[col.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Menampilkan {startIndex + 1}-{endIndex} dari {filteredData.length} baris
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Batal
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={!canConfirm || isLoading}
            className="gap-2"
          >
            <Import className="h-4 w-4" />
            Import {validRowCount} Data Valid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
