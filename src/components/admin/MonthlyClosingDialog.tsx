import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMonthlyClosing, MonthlyClosingResult } from '@/hooks/useMonthlyClosing';
import { useCriticalSettings } from '@/hooks/useSettingsChangeLogs';
import { format, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { CalendarCheck, Calculator, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';

interface MonthlyClosingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MonthlyClosingDialog({ open, onOpenChange, onSuccess }: MonthlyClosingDialogProps) {
  const { isProcessing, processMonthlyClosing, checkClosingStatus, lastClosingResult } = useMonthlyClosing();
  const { settings: criticalSettings } = useCriticalSettings();
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isAlreadyClosed, setIsAlreadyClosed] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<MonthlyClosingResult | null>(null);

  // Generate last 6 months options
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), i + 1);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: localeId }),
      date,
    };
  });

  // Check closing status when month changes
  useEffect(() => {
    if (selectedMonth && open) {
      const checkStatus = async () => {
        setCheckingStatus(true);
        const monthDate = monthOptions.find(m => m.value === selectedMonth)?.date;
        if (monthDate) {
          const closed = await checkClosingStatus(monthDate);
          setIsAlreadyClosed(closed);
        }
        setCheckingStatus(false);
      };
      checkStatus();
    }
  }, [selectedMonth, open]);

  // Set default to last month
  useEffect(() => {
    if (open && !selectedMonth && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[0].value);
    }
  }, [open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setShowResult(false);
      setResult(null);
    }
  }, [open]);

  const handleProcess = async () => {
    const monthDate = monthOptions.find(m => m.value === selectedMonth)?.date;
    if (monthDate) {
      const closingResult = await processMonthlyClosing(monthDate);
      if (closingResult) {
        setResult(closingResult);
        setShowResult(true);
        onSuccess?.();
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const interestRate = criticalSettings?.simpananSukarelaInterestRate ?? 0.4;
  const cooperativeSettings = getCooperativeSettings();
  const interestMethod = cooperativeSettings.simpananSukarelaInterestMethod || 'opening_plus_eligible';
  const cutoffDate = cooperativeSettings.simpananSukarelaInterestCutoffDate || 15;

  if (showResult && result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Tutup Buku Berhasil
            </DialogTitle>
            <DialogDescription>
              Tutup buku untuk {result.month} telah berhasil dilakukan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Periode</p>
                    <p className="font-semibold">{result.month}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Jumlah Anggota</p>
                    <p className="font-semibold">{result.memberCalculations.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bunga (%)</p>
                    <p className="font-semibold">{interestRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Beban Bunga</p>
                    <p className="font-semibold text-green-600">{formatCurrency(result.totalInterestExpense)}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground">
                    <strong>Metode:</strong> {interestMethod === 'closing_if_eligible' 
                      ? 'Saldo Akhir (jika ada setoran sebelum cutoff)' 
                      : 'Saldo Awal + Setoran Eligible'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Rincian Per Anggota</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Anggota</TableHead>
                        <TableHead className="text-right">Saldo Awal</TableHead>
                        <TableHead className="text-right">Saldo Akhir</TableHead>
                        <TableHead className="text-right">Setoran Eligible</TableHead>
                        <TableHead className="text-right">Saldo Eligible</TableHead>
                        <TableHead className="text-right">Bunga</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.memberCalculations.map((mc) => (
                        <TableRow key={mc.userId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{mc.memberName}</p>
                              <p className="text-xs text-muted-foreground">{mc.memberNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(mc.openingBalance)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(mc.closingBalance)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(mc.depositsBeforeCutoff)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(mc.eligibleBalance)}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {formatCurrency(mc.interestAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {result.memberCalculations.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Tidak ada anggota dengan bunga untuk periode ini
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Tutup Buku Bulanan
          </DialogTitle>
          <DialogDescription>
            Hitung dan catat beban bunga simpanan sukarela untuk periode yang dipilih
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Pilih Periode</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih bulan" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {checkingStatus && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memeriksa status...
            </div>
          )}

          {!checkingStatus && isAlreadyClosed && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Periode ini sudah ditutup sebelumnya
              </p>
            </div>
          )}

          {!checkingStatus && !isAlreadyClosed && selectedMonth && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Informasi Perhitungan</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Bunga akan dihitung berdasarkan saldo eligible</p>
                  <p>• Metode: <Badge variant="outline" className="ml-1">
                    {interestMethod === 'closing_if_eligible' 
                      ? 'Saldo Akhir (jika eligible)' 
                      : 'Saldo Awal + Setoran Eligible'}
                  </Badge></p>
                  <p>• Batas tanggal deposit: <Badge variant="secondary">Tanggal {cutoffDate}</Badge></p>
                  <p>• Bunga: <Badge variant="secondary">{interestRate}% per bulan</Badge></p>
                  <p>• Total beban akan dicatat sebagai expense entry</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button 
            onClick={handleProcess} 
            disabled={isProcessing || isAlreadyClosed || !selectedMonth}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memproses...
              </>
            ) : (
              'Proses Tutup Buku'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
