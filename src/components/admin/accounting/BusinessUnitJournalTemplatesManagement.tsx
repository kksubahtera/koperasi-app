import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Loader2, Settings, ArrowRight, Check, X, Info, Zap, HelpCircle,
  ShoppingCart, Package, Wrench, Ticket, Building2
} from 'lucide-react';
import { 
  useBusinessUnitJournalTemplates, 
  BusinessUnitJournalTemplate,
  BUSINESS_UNIT_TRANSACTION_TYPES 
} from '@/hooks/useBusinessUnitJournalTemplates';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { useBusinessUnits } from '@/hooks/useBusinessUnits';

const getUnitIcon = (code: string) => {
  switch (code) {
    case 'TK':
      return <ShoppingCart className="h-4 w-4" />;
    case 'PRD':
      return <Package className="h-4 w-4" />;
    case 'JS':
      return <Wrench className="h-4 w-4" />;
    case 'PRW':
      return <Ticket className="h-4 w-4" />;
    default:
      return <Building2 className="h-4 w-4" />;
  }
};

const getUnitColor = (code: string) => {
  switch (code) {
    case 'TK':
      return 'text-orange-600';
    case 'PRD':
      return 'text-green-600';
    case 'JS':
      return 'text-blue-600';
    case 'PRW':
      return 'text-purple-600';
    default:
      return 'text-gray-600';
  }
};

export const BusinessUnitJournalTemplatesManagement = () => {
  const { 
    templates, 
    loading, 
    updateTemplateLine, 
    toggleTemplate,
    getTemplatesByUnit,
    isTemplateConfigured,
    getConfiguredCount,
    autoMapAccounts 
  } = useBusinessUnitJournalTemplates();
  const { accounts, loading: accountsLoading } = useChartOfAccounts();
  const { units, loading: unitsLoading } = useBusinessUnits();
  const [selectedTemplate, setSelectedTemplate] = useState<BusinessUnitJournalTemplate | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [isAutoMapping, setIsAutoMapping] = useState(false);

  if (loading || accountsLoading || unitsLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Filter to non-primary active units
  const businessUnits = units.filter(u => !u.is_primary && u.is_active);

  const assetAccounts = accounts.filter(a => a.account_type === 'asset' && a.is_active);
  const liabilityAccounts = accounts.filter(a => a.account_type === 'liability' && a.is_active);
  const incomeAccounts = accounts.filter(a => a.account_type === 'income' && a.is_active);

  const getAccountOptions = (isDebit: boolean) => {
    if (isDebit) {
      return [...assetAccounts];
    }
    return [...incomeAccounts, ...liabilityAccounts];
  };

  const handleConfigureTemplate = (template: BusinessUnitJournalTemplate) => {
    setSelectedTemplate(template);
    setShowConfigDialog(true);
  };

  const handleUpdateLine = (lineIndex: number, accountId: string) => {
    if (selectedTemplate) {
      updateTemplateLine(selectedTemplate.id, lineIndex, accountId);
      const account = accounts.find(a => a.id === accountId);
      setSelectedTemplate(prev => {
        if (!prev) return null;
        const newLines = [...prev.lines];
        newLines[lineIndex] = {
          ...newLines[lineIndex],
          accountId,
          accountCode: account?.account_code,
          accountName: account?.account_name,
        };
        return { ...prev, lines: newLines };
      });
    }
  };

  const handleAutoMap = async () => {
    setIsAutoMapping(true);
    await autoMapAccounts();
    setIsAutoMapping(false);
  };

  const { configured, total } = getConfiguredCount();

  if (businessUnits.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Tidak ada unit usaha</AlertTitle>
        <AlertDescription>
          Tambahkan unit usaha terlebih dahulu di menu Kelola Unit Usaha untuk mengkonfigurasi template jurnal.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Template Jurnal Unit Usaha
          </h4>
          <p className="text-sm text-muted-foreground">
            Konfigurasi jurnal otomatis untuk transaksi unit usaha (Toko, Produksi, Jasa, dll)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {configured}/{total} Template Siap
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAutoMap}
            disabled={isAutoMapping}
          >
            {isAutoMapping ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Auto-Map Akun
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Integrasi Otomatis</AlertTitle>
        <AlertDescription>
          Template ini akan membuat jurnal secara otomatis setiap kali transaksi unit usaha dicatat. 
          Pastikan semua akun sudah dikonfigurasi dengan benar.
        </AlertDescription>
      </Alert>

      {/* Templates by Business Unit */}
      {businessUnits.map(unit => {
        const unitTemplates = getTemplatesByUnit(unit.code);
        if (unitTemplates.length === 0) return null;

        return (
          <Card key={unit.id}>
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <span className={getUnitColor(unit.code)}>
                  {getUnitIcon(unit.code)}
                </span>
                {unit.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">Aktif</TableHead>
                    <TableHead>Tipe Transaksi</TableHead>
                    <TableHead>Jurnal Debit</TableHead>
                    <TableHead className="text-center w-12">→</TableHead>
                    <TableHead>Jurnal Kredit</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-24">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unitTemplates.map(template => {
                    const configured = isTemplateConfigured(template);
                    const debitLines = template.lines.filter(l => l.isDebit);
                    const creditLines = template.lines.filter(l => !l.isDebit);
                    const txTypes = BUSINESS_UNIT_TRANSACTION_TYPES[unit.code];
                    const txType = txTypes?.find(t => t.value === template.transactionType);

                    return (
                      <TableRow key={template.id} className={!template.isActive ? 'opacity-50' : ''}>
                        <TableCell>
                          <Switch
                            checked={template.isActive}
                            onCheckedChange={() => toggleTemplate(template.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <p className="font-medium">{template.name}</p>
                              <p className="text-xs text-muted-foreground">{template.description}</p>
                            </div>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                    <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs p-3">
                                  <div className="space-y-2 text-xs">
                                    <p className="font-semibold text-sm">{template.name}</p>
                                    <p className="text-muted-foreground">{template.description}</p>
                                    <div className="pt-2 border-t space-y-1">
                                      <p><span className="font-medium text-emerald-600">Debit:</span> {txType?.debitDesc || 'Kas/Bank'}</p>
                                      <p><span className="font-medium text-rose-600">Kredit:</span> {txType?.creditDesc || 'Pendapatan'}</p>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                        <TableCell>
                          {debitLines.map((line, idx) => (
                            <div key={idx} className="text-sm">
                              {line.accountCode ? (
                                <Badge variant="outline" className="font-mono text-xs">
                                  {line.accountCode} - {line.accountName}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground italic">Belum dikonfigurasi</span>
                              )}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="text-center">
                          <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                        </TableCell>
                        <TableCell>
                          {creditLines.map((line, idx) => (
                            <div key={idx} className="text-sm mb-1">
                              {line.accountCode ? (
                                <Badge variant="outline" className="font-mono text-xs">
                                  {line.accountCode} - {line.accountName}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground italic">Belum dikonfigurasi</span>
                              )}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          {configured ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <Check className="h-3 w-3 mr-1" />
                              Siap
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <X className="h-3 w-3 mr-1" />
                              Perlu Setup
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConfigureTemplate(template)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Konfigurasi Template: {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Pilih akun yang sesuai untuk setiap baris jurnal
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4 mt-4">
              {selectedTemplate.lines.map((line, idx) => (
                <div key={idx} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Badge variant={line.isDebit ? 'default' : 'secondary'} className="text-xs">
                      {line.isDebit ? 'DEBIT' : 'KREDIT'}
                    </Badge>
                    {line.description}
                  </Label>
                  <Select
                    value={line.accountId || 'none'}
                    onValueChange={(v) => handleUpdateLine(idx, v === 'none' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih akun..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Pilih Akun --</SelectItem>
                      {getAccountOptions(line.isDebit).map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_code} - {acc.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Preview Jurnal:</p>
                <div className="bg-muted rounded-lg p-3 font-mono text-sm">
                  {selectedTemplate.lines.map((line, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className={line.isDebit ? '' : 'pl-4'}>
                        {line.accountCode || '????'} - {line.accountName || 'Belum dipilih'}
                      </span>
                      <span className={line.isDebit ? 'text-emerald-600' : 'text-rose-600'}>
                        {line.isDebit ? 'D' : 'K'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
