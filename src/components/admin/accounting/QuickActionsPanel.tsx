import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  ClipboardCheck,
  RefreshCw,
  FileSpreadsheet,
  Zap,
  ChevronUp,
  BookOpen,
  Scale,
  FileEdit
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface QuickActionsPanelProps {
  pendingCount?: number;
  onCreateJournal?: () => void;
  onViewPending?: () => void;
  onReconcile?: () => void;
  onExport?: () => void;
  onConfigureTemplates?: () => void;
}

export const QuickActionsPanel = ({
  pendingCount = 0,
  onCreateJournal,
  onViewPending,
  onReconcile,
  onExport,
  onConfigureTemplates,
}: QuickActionsPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const actions = [
    {
      id: 'journal',
      label: 'Buat Jurnal Manual',
      description: 'Buat entri jurnal baru',
      icon: <BookOpen className="h-4 w-4" />,
      onClick: onCreateJournal,
      shortcut: 'Ctrl+J',
    },
    {
      id: 'pending',
      label: 'Verifikasi Transaksi',
      description: pendingCount > 0 ? `${pendingCount} menunggu` : 'Semua sudah diproses',
      icon: <ClipboardCheck className="h-4 w-4" />,
      onClick: onViewPending,
      badge: pendingCount > 0 ? pendingCount : undefined,
      shortcut: 'Ctrl+V',
    },
    {
      id: 'reconcile',
      label: 'Rekonsiliasi Saldo',
      description: 'Periksa keseimbangan data',
      icon: <Scale className="h-4 w-4" />,
      onClick: onReconcile,
      shortcut: 'Ctrl+R',
    },
    {
      id: 'templates',
      label: 'Template Jurnal',
      description: 'Konfigurasi auto-jurnal',
      icon: <FileEdit className="h-4 w-4" />,
      onClick: onConfigureTemplates,
    },
    {
      id: 'export',
      label: 'Export Laporan',
      description: 'Download laporan keuangan',
      icon: <FileSpreadsheet className="h-4 w-4" />,
      onClick: onExport,
    },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className={cn(
              "rounded-full shadow-lg transition-all duration-300",
              "bg-primary hover:bg-primary/90",
              "h-14 w-14 p-0",
              isOpen && "rotate-180"
            )}
          >
            <div className="relative">
              <Zap className={cn("h-6 w-6 transition-transform", isOpen && "scale-0")} />
              <ChevronUp className={cn(
                "h-6 w-6 absolute inset-0 transition-transform",
                !isOpen && "scale-0"
              )} />
              {pendingCount > 0 && !isOpen && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          side="top"
          className="w-64 mb-2"
        >
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Aksi Cepat
          </div>
          <DropdownMenuSeparator />
          {actions.map((action, index) => (
            <DropdownMenuItem
              key={action.id}
              onClick={action.onClick}
              className="flex items-start gap-3 py-3 cursor-pointer"
            >
              <span className="mt-0.5 text-muted-foreground">{action.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{action.label}</span>
                  {action.badge && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                      {action.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {action.description}
                </p>
              </div>
              {action.shortcut && !isMobile && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {action.shortcut}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
