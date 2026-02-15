import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Upload, Download, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExcelDropZoneProps {
  onFileSelect: (file: File) => void;
  onDownloadTemplate?: () => void;
  title?: string;
  description?: string;
  accept?: string;
  disabled?: boolean;
  isLoading?: boolean;
  selectedFile?: File | null;
  onClear?: () => void;
}

export const ExcelDropZone = ({
  onFileSelect,
  onDownloadTemplate,
  title = "Import data dari Excel",
  description = "Drag & drop file Excel atau klik untuk memilih file",
  accept = ".xlsx,.xls",
  disabled = false,
  isLoading = false,
  selectedFile: externalSelectedFile,
  onClear,
}: ExcelDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [internalSelectedFile, setInternalSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use external file if provided, otherwise use internal state
  const selectedFile = externalSelectedFile !== undefined ? externalSelectedFile : internalSelectedFile;
  const setSelectedFile = externalSelectedFile !== undefined ? () => {} : setInternalSelectedFile;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Check if file is Excel
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (isExcel) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    }
  }, [disabled, onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      onFileSelect(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileSelect]);

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const clearSelection = useCallback(() => {
    if (onClear) {
      onClear();
    } else {
      setInternalSelectedFile(null);
    }
  }, [onClear]);

  return (
    <Card 
      className={cn(
        "relative border-2 border-dashed transition-all duration-200 cursor-pointer",
        isDragOver && !disabled && !isLoading
          ? "border-primary bg-primary/5 scale-[1.01]" 
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
        (disabled || isLoading) && "opacity-50 cursor-not-allowed",
        selectedFile && "border-green-500/50 bg-green-50/50 dark:bg-green-900/10"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <CardContent className="py-6">
        <div className="flex flex-col items-center text-center gap-3">
          {/* Icon */}
          <div 
            className={cn(
              "p-4 rounded-full transition-all duration-200",
              isLoading
                ? "bg-muted text-muted-foreground animate-pulse"
                : isDragOver 
                  ? "bg-primary/20 text-primary scale-110" 
                  : selectedFile 
                    ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
            )}
          >
            {isLoading ? (
              <FileSpreadsheet className="h-8 w-8 animate-spin" />
            ) : selectedFile ? (
              <CheckCircle2 className="h-8 w-8" />
            ) : (
              <FileSpreadsheet className="h-8 w-8" />
            )}
          </div>

          {/* Text */}
          {isLoading ? (
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground">
                Memproses file...
              </p>
              <p className="text-sm text-muted-foreground">
                Mohon tunggu sebentar
              </p>
            </div>
          ) : selectedFile ? (
            <div className="space-y-1">
              <p className="font-medium text-green-700 dark:text-green-300">
                File siap diimport
              </p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {selectedFile.name}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelection();
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          )}

          {/* Drag over indicator */}
          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg border-2 border-primary">
              <div className="flex items-center gap-2 text-primary font-medium">
                <Upload className="h-5 w-5 animate-bounce" />
                <span>Lepaskan file di sini</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            {onDownloadTemplate && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadTemplate();
                }} 
                className="gap-2"
                disabled={isLoading}
              >
                <Download className="h-4 w-4" />
                Download Template
              </Button>
            )}
            <Button 
              variant="default" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }} 
              className="gap-2"
              disabled={disabled || isLoading}
            >
              <Upload className="h-4 w-4" />
              Pilih File
            </Button>
          </div>

          {/* Supported formats */}
          <p className="text-xs text-muted-foreground mt-1">
            Format yang didukung: .xlsx, .xls
          </p>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          accept={accept}
          className="hidden"
          onChange={handleFileInput}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
};
