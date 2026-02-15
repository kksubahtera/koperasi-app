import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Variable, Copy, Check } from 'lucide-react';
import { getVariablesForLetterType, TemplateVariableCategory, TemplateVariable } from '@/lib/templateVariables';

interface VariablePickerProps {
  letterType: string;
  onInsert: (variable: string) => void;
  compact?: boolean;
}

export function VariablePicker({ letterType, onInsert, compact = false }: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const categories = getVariablesForLetterType(letterType);

  const handleInsert = (variable: TemplateVariable) => {
    onInsert(variable.key);
    setCopiedKey(variable.key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  if (categories.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size={compact ? 'icon' : 'sm'} type="button" className="shrink-0">
          <Variable className="h-4 w-4" />
          {!compact && <span className="ml-1.5">Variabel</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">Sisipkan Variabel</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Klik variabel untuk menyisipkan ke teks
          </p>
        </div>
        <ScrollArea className="max-h-72">
          <div className="p-2 space-y-3">
            {categories.map((category) => (
              <div key={category.id}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm">{category.icon}</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {category.label}
                  </span>
                </div>
                <div className="space-y-1">
                  {category.variables.map((variable) => (
                    <TooltipProvider key={variable.key} delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleInsert(variable)}
                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-muted text-left transition-colors group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="secondary" className="font-mono text-[10px] shrink-0">
                                {variable.key}
                              </Badge>
                              <span className="text-xs text-muted-foreground truncate">
                                {variable.label}
                              </span>
                            </div>
                            {copiedKey === variable.key ? (
                              <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="font-medium text-xs">{variable.description}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Contoh: <span className="font-medium">{variable.sample}</span>
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-2 border-t bg-muted/50">
          <p className="text-[10px] text-muted-foreground text-center">
            Variabel akan diganti dengan data anggota saat surat dicetak
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
