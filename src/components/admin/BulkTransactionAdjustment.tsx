import { useState, useMemo, useCallback } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ExcelDropZone } from './ExcelDropZone';
import { 
  FileSpreadsheet, 
  Check, 
  AlertTriangle, 
  ArrowRight,
  Loader2,
  PenLine,
  Banknote,
  Download,
  Link2,
  Link2Off,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatShortDate, getTransactionTypeLabel } from '@/lib/mockData';
import { useJournalTemplates, createJournalFromTransaction, TemplateType } from '@/hooks/useJournalTemplates';
import { createAndDownloadExcelAoA, readExcelFileRaw } from '@/lib/excelUtils';

interface PendingTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  date: string | null;
  status: string;
  payment_method: string;
  account_holder_name: string | null;
  notes: string | null;
  profiles: {
    name: string;
    member_number: string | null;
  } | null;
}

interface BankRecord {
  date: string;
  description: string;
  amount: number;
  rowIndex: number;
}

interface MatchedAdjustment {
  transaction: PendingTransaction;
  bankRecord: BankRecord;
  newAmount: number;
  newDate: string;
  hasAmountChange: boolean;
  hasDateChange: boolean;
  selected: boolean;
  matchConfidence: 'high' | 'medium' | 'low';
}

interface BulkTransactionAdjustmentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingTransactions: PendingTransaction[];
  onSuccess?: () => void;
}

export const BulkTransactionAdjustment = ({
  open,
  onOpenChange,
  pendingTransactions,
  onSuccess,
}: BulkTransactionAdjustmentProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { getTemplateByType } = useJournalTemplates();
  
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm'>('upload');
  const [bankRecords, setBankRecords] = useState<BankRecord[]>([]);
  const [matchedAdjustments, setMatchedAdjustments] = useState<MatchedAdjustment[]>([]);
  const [unmatchedRecords, setUnmatchedRecords] = useState<BankRecord[]>([]);
  const [adjustmentReason, setAdjustmentReason] = useState('Disesuaikan dengan data rekonsiliasi bank');
  const [autoApprove, setAutoApprove] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Parse Excel file
  const handleFileSelect = useCallback(async (file: File) => {
    try {
      const jsonData = await readExcelFileRaw(file);

        // Find header row (look for date, amount columns)
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const row = jsonData[i];
          if (row && row.some((cell: any) => 
            String(cell).toLowerCase().includes('tanggal') || 
            String(cell).toLowerCase().includes('date') ||
            String(cell).toLowerCase().includes('nominal') ||
            String(cell).toLowerCase().includes('amount') ||
            String(cell).toLowerCase().includes('jumlah')
          )) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = jsonData[headerRowIndex]?.map((h: any) => String(h || '').toLowerCase()) || [];
        
        // Find column indices
        const dateColIndex = headers.findIndex((h: string) => 
          h.includes('tanggal') || h.includes('date') || h.includes('tgl')
        );
        const amountColIndex = headers.findIndex((h: string) => 
          h.includes('nominal') || h.includes('amount') || h.includes('jumlah') || 
          h.includes('kredit') || h.includes('credit') || h.includes('debit')
        );
        const descColIndex = headers.findIndex((h: string) => 
          h.includes('keterangan') || h.includes('description') || h.includes('uraian') || 
          h.includes('berita') || h.includes('memo')
        );

        if (dateColIndex === -1 || amountColIndex === -1) {
          toast.error('Format file tidak sesuai. Pastikan ada kolom Tanggal dan Nominal/Amount');
          return;
        }

        // Parse bank records
        const records: BankRecord[] = [];
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[dateColIndex]) continue;

          let dateValue = row[dateColIndex];
          let parsedDate = '';
          
          // Handle Excel date serial number
          if (typeof dateValue === 'number') {
            const excelDate = new Date((dateValue - 25569) * 86400 * 1000);
            parsedDate = excelDate.toISOString().split('T')[0];
          } else if (typeof dateValue === 'string') {
            // Try to parse various date formats
            const dateStr = dateValue.trim();
            // DD/MM/YYYY or DD-MM-YYYY
            const dmyMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (dmyMatch) {
              parsedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
            } else {
              // Try direct parsing
              const parsed = new Date(dateStr);
              if (!isNaN(parsed.getTime())) {
                parsedDate = parsed.toISOString().split('T')[0];
              }
            }
          }

          if (!parsedDate) continue;

          // Parse amount
          let amountValue = row[amountColIndex];
          let amount = 0;
          if (typeof amountValue === 'number') {
            amount = Math.abs(amountValue);
          } else if (typeof amountValue === 'string') {
            // Remove currency symbols and parse
            amount = Math.abs(parseFloat(amountValue.replace(/[^\d.-]/g, '')) || 0);
          }

          if (amount <= 0) continue;

          records.push({
            date: parsedDate,
            description: descColIndex >= 0 ? String(row[descColIndex] || '') : '',
            amount,
            rowIndex: i + 1,
          });
        }

        if (records.length === 0) {
          toast.error('Tidak ada data valid ditemukan dalam file');
          return;
        }

        setBankRecords(records);
        matchTransactions(records);
        setStep('preview');
        toast.success(`${records.length} record bank berhasil diparse`);
      } catch (error) {
        console.error('Error parsing Excel:', error);
        toast.error('Gagal membaca file Excel');
      }
  }, [pendingTransactions]);

  // Match bank records with pending transactions
  const matchTransactions = useCallback((records: BankRecord[]) => {
    const matched: MatchedAdjustment[] = [];
    const unmatched: BankRecord[] = [];
    const usedTransactionIds = new Set<string>();

    for (const record of records) {
      // Try to find matching transaction
      // Priority: exact amount match, then close date match
      let bestMatch: PendingTransaction | null = null;
      let bestConfidence: 'high' | 'medium' | 'low' = 'low';

      for (const txn of pendingTransactions) {
        if (usedTransactionIds.has(txn.id)) continue;

        const amountDiff = Math.abs(txn.amount - record.amount);
        const amountMatch = amountDiff === 0;
        const closeAmountMatch = amountDiff > 0 && amountDiff <= txn.amount * 0.1; // Within 10%
        
        let dateMatch = false;
        let closeDateMatch = false;
        if (txn.date) {
          const txnDate = new Date(txn.date);
          const recordDate = new Date(record.date);
          const daysDiff = Math.abs((txnDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
          dateMatch = daysDiff === 0;
          closeDateMatch = daysDiff <= 3; // Within 3 days
        }

        // Check name match in description
        const nameMatch = record.description && txn.profiles?.name && 
          record.description.toLowerCase().includes(txn.profiles.name.toLowerCase().split(' ')[0]);

        // Determine confidence
        if (amountMatch && dateMatch) {
          // High confidence - exact match, may not need adjustment
          bestMatch = txn;
          bestConfidence = 'high';
          break;
        } else if (amountMatch && closeDateMatch) {
          bestMatch = txn;
          bestConfidence = 'high';
        } else if (closeAmountMatch && (dateMatch || closeDateMatch)) {
          if (bestConfidence !== 'high') {
            bestMatch = txn;
            bestConfidence = 'medium';
          }
        } else if ((amountMatch || closeAmountMatch || nameMatch) && bestConfidence === 'low') {
          bestMatch = txn;
          bestConfidence = 'low';
        }
      }

      if (bestMatch) {
        usedTransactionIds.add(bestMatch.id);
        const hasAmountChange = bestMatch.amount !== record.amount;
        const hasDateChange = bestMatch.date !== record.date;
        
        // Only add to matched if there's a change needed
        if (hasAmountChange || hasDateChange) {
          matched.push({
            transaction: bestMatch,
            bankRecord: record,
            newAmount: record.amount,
            newDate: record.date,
            hasAmountChange,
            hasDateChange,
            selected: bestConfidence !== 'low', // Auto-select high/medium confidence
            matchConfidence: bestConfidence,
          });
        }
      } else {
        unmatched.push(record);
      }
    }

    setMatchedAdjustments(matched);
    setUnmatchedRecords(unmatched);
  }, [pendingTransactions]);

  // Toggle selection
  const toggleSelection = (index: number) => {
    setMatchedAdjustments(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    const allSelected = matchedAdjustments.every(m => m.selected);
    setMatchedAdjustments(prev => 
      prev.map(item => ({ ...item, selected: !allSelected }))
    );
  };

  // Remove adjustment from list
  const removeAdjustment = (index: number) => {
    setMatchedAdjustments(prev => prev.filter((_, i) => i !== index));
  };

  // Stats
  const selectedCount = matchedAdjustments.filter(m => m.selected).length;
  const highConfidenceCount = matchedAdjustments.filter(m => m.matchConfidence === 'high').length;
  const mediumConfidenceCount = matchedAdjustments.filter(m => m.matchConfidence === 'medium').length;
  const lowConfidenceCount = matchedAdjustments.filter(m => m.matchConfidence === 'low').length;

  // Process bulk adjustment
  const handleConfirm = async () => {
    if (!user) return;
    
    const selectedAdjustments = matchedAdjustments.filter(m => m.selected);
    if (selectedAdjustments.length === 0) {
      toast.error('Pilih minimal satu transaksi untuk disesuaikan');
      return;
    }

    if (!adjustmentReason.trim()) {
      toast.error('Mohon isi alasan penyesuaian');
      return;
    }

    setIsProcessing(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const adjustment of selectedAdjustments) {
        try {
          // Update transaction
          const updateData: any = {
            original_amount: adjustment.transaction.amount,
            original_date: adjustment.transaction.date,
            amount: adjustment.newAmount,
            date: adjustment.newDate,
            adjusted_by: user.id,
            adjustment_reason: adjustmentReason.trim(),
            adjusted_at: new Date().toISOString(),
          };

          if (autoApprove) {
            updateData.status = 'approved';
            updateData.approved_at = new Date().toISOString();
            updateData.approved_by = user.id;
          }

          const { error } = await supabase
            .from('transactions')
            .update(updateData)
            .eq('id', adjustment.transaction.id);

          if (error) throw error;

          // If auto-approve, create journal entry with the NEW adjusted values
          if (autoApprove) {
            const templateType = adjustment.transaction.type as TemplateType;
            const template = getTemplateByType(templateType);
            
            if (template && template.lines.every(l => l.accountId)) {
              const typeLabels: Record<string, string> = {
                simpanan_pokok: 'Simpanan Pokok',
                simpanan_wajib: 'Simpanan Wajib',
                simpanan_sukarela: 'Simpanan Sukarela',
                setor_simpanan_wajib: 'Setor Simpanan Wajib',
                setor_simpanan_sukarela: 'Setor Simpanan Sukarela',
                penarikan_simpanan_sukarela: 'Penarikan Simpanan Sukarela',
                pencairan_pinjaman: 'Pencairan Pinjaman',
                bayar_angsuran_pinjaman: 'Pembayaran Angsuran',
              };
              const description = typeLabels[templateType] || templateType;
              const memberName = adjustment.transaction.profiles?.name || 'Unknown';

              // Create journal using NEW adjusted amount
              const journalEntry = await createJournalFromTransaction(
                templateType,
                adjustment.newAmount, // Use adjusted amount
                description,
                memberName,
                template
              );

              if (journalEntry) {
                // Update transaction with journal reference
                await supabase
                  .from('transactions')
                  .update({ notes: `Jurnal: ${journalEntry.entry_number}` })
                  .eq('id', adjustment.transaction.id);
              }
            }
          }

          // Send notification to member
          const transactionTypeLabel = getTransactionTypeLabel(adjustment.transaction.type as any);
          let adjustmentDetails = '';
          if (adjustment.hasAmountChange) {
            adjustmentDetails += `Nominal: Rp ${adjustment.transaction.amount.toLocaleString('id-ID')} → Rp ${adjustment.newAmount.toLocaleString('id-ID')}`;
          }
          if (adjustment.hasDateChange) {
            if (adjustmentDetails) adjustmentDetails += '. ';
            adjustmentDetails += `Tanggal: ${formatShortDate(adjustment.transaction.date || '')} → ${formatShortDate(adjustment.newDate)}`;
          }

          await supabase.from('member_notifications').insert({
            user_id: adjustment.transaction.user_id,
            title: autoApprove ? 'Transaksi Disetujui dengan Penyesuaian' : 'Transaksi Disesuaikan',
            message: `Transaksi ${transactionTypeLabel} Anda telah disesuaikan. ${adjustmentDetails}. Alasan: ${adjustmentReason.trim()}`,
            notification_type: 'transaction_adjusted',
            metadata: {
              transaction_id: adjustment.transaction.id,
              transaction_type: adjustment.transaction.type,
              original_amount: adjustment.transaction.amount,
              new_amount: adjustment.newAmount,
              original_date: adjustment.transaction.date,
              new_date: adjustment.newDate,
              adjustment_reason: adjustmentReason.trim(),
              bulk_adjustment: true,
            }
          });

          successCount++;
        } catch (error) {
          console.error('Error adjusting transaction:', error);
          errorCount++;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['all-transactions'] });

      if (successCount > 0) {
        toast.success(`${successCount} transaksi berhasil disesuaikan${autoApprove ? ' dan disetujui' : ''}`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} transaksi gagal disesuaikan`);
      }

      if (onSuccess) {
        onSuccess();
      }
      handleClose();
    } catch (error) {
      console.error('Error processing bulk adjustment:', error);
      toast.error('Gagal memproses penyesuaian massal');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download template
  const handleDownloadTemplate = async () => {
    const template = [
      ['Tanggal', 'Nominal', 'Keterangan'],
      ['2026-01-08', '150000', 'Transfer dari John Doe'],
      ['2026-01-07', '200000', 'Setoran simpanan wajib'],
      ['08/01/2026', '100000', 'Pembayaran angsuran'],
    ];

    await createAndDownloadExcelAoA([
      { name: 'Rekonsiliasi', data: template }
    ], 'template-rekonsiliasi-bank.xlsx');
  };

  // Reset and close
  const handleClose = () => {
    setStep('upload');
    setBankRecords([]);
    setMatchedAdjustments([]);
    setUnmatchedRecords([]);
    setAdjustmentReason('Disesuaikan dengan data rekonsiliasi bank');
    setAutoApprove(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Penyesuaian Massal dari Rekonsiliasi Bank
          </DialogTitle>
          <DialogDescription>
            Upload file rekonsiliasi bank untuk menyesuaikan transaksi pending secara massal
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <ExcelDropZone
              onFileSelect={handleFileSelect}
              onDownloadTemplate={handleDownloadTemplate}
              title="Import File Rekonsiliasi Bank"
              description="Drag & drop file Excel atau klik untuk memilih file mutasi bank"
            />

            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">Format file yang didukung:</span>
                <ul className="mt-2 list-disc list-inside text-sm">
                  <li>File Excel (.xlsx, .xls) dengan kolom Tanggal dan Nominal/Amount</li>
                  <li>Format tanggal: DD/MM/YYYY, DD-MM-YYYY, atau YYYY-MM-DD</li>
                  <li>Kolom keterangan opsional untuk membantu pencocokan</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium">Transaksi pending saat ini: {pendingTransactions.length}</p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold">{bankRecords.length}</p>
                <p className="text-xs text-muted-foreground">Record Bank</p>
              </div>
              <div className="rounded-lg border bg-green-50 dark:bg-green-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{matchedAdjustments.length}</p>
                <p className="text-xs text-green-600 dark:text-green-400">Matched</p>
              </div>
              <div className="rounded-lg border bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{selectedCount}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Dipilih</p>
              </div>
              <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{unmatchedRecords.length}</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400">Tidak Cocok</p>
              </div>
            </div>

            {/* Confidence Legend */}
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  <Link2 className="h-3 w-3 mr-1" />
                  High ({highConfidenceCount})
                </Badge>
              </span>
              <span className="flex items-center gap-1">
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                  <Link2 className="h-3 w-3 mr-1" />
                  Medium ({mediumConfidenceCount})
                </Badge>
              </span>
              <span className="flex items-center gap-1">
                <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                  <Link2Off className="h-3 w-3 mr-1" />
                  Low ({lowConfidenceCount})
                </Badge>
              </span>
            </div>

            {matchedAdjustments.length === 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Tidak ada transaksi yang perlu disesuaikan. Semua transaksi sudah sesuai dengan data bank atau tidak ada kecocokan.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Select All */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={matchedAdjustments.every(m => m.selected)}
                      onCheckedChange={toggleSelectAll}
                    />
                    <Label htmlFor="select-all" className="text-sm cursor-pointer">
                      Pilih Semua
                    </Label>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setStep('confirm')}
                    disabled={selectedCount === 0}
                  >
                    Lanjut ke Konfirmasi ({selectedCount})
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                {/* Matched Adjustments Table */}
                <ScrollArea className="flex-1 rounded-md border min-h-[200px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Anggota</TableHead>
                        <TableHead>Jenis</TableHead>
                        <TableHead className="text-right">Nominal Lama</TableHead>
                        <TableHead className="text-center">→</TableHead>
                        <TableHead className="text-right">Nominal Baru</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead className="text-center">Match</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchedAdjustments.map((item, index) => (
                        <TableRow 
                          key={index}
                          className={cn(
                            item.selected && 'bg-primary/5'
                          )}
                        >
                          <TableCell>
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() => toggleSelection(index)}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.transaction.profiles?.name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{item.transaction.profiles?.member_number}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {getTransactionTypeLabel(item.transaction.type as any)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <span className={cn(item.hasAmountChange && 'line-through text-muted-foreground')}>
                              {formatCurrency(item.transaction.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {(item.hasAmountChange || item.hasDateChange) && (
                              <ArrowRight className="h-4 w-4 text-primary mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.hasAmountChange ? (
                              <span className="text-primary font-medium">
                                {formatCurrency(item.newAmount)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.hasDateChange ? (
                              <div className="flex items-center gap-1">
                                <span className="line-through text-muted-foreground">
                                  {formatShortDate(item.transaction.date || '')}
                                </span>
                                <ArrowRight className="h-3 w-3" />
                                <span className="text-primary font-medium">
                                  {formatShortDate(item.newDate)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                {formatShortDate(item.transaction.date || '')}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs",
                                item.matchConfidence === 'high' && 'bg-green-100 text-green-700 border-green-300',
                                item.matchConfidence === 'medium' && 'bg-blue-100 text-blue-700 border-blue-300',
                                item.matchConfidence === 'low' && 'bg-yellow-100 text-yellow-700 border-yellow-300'
                              )}
                            >
                              {item.matchConfidence === 'high' && 'Tinggi'}
                              {item.matchConfidence === 'medium' && 'Sedang'}
                              {item.matchConfidence === 'low' && 'Rendah'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeAdjustment(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4 py-4">
            <Alert className="border-primary/50 bg-primary/5">
              <Check className="h-4 w-4 text-primary" />
              <AlertDescription>
                <span className="font-medium">{selectedCount} transaksi</span> akan disesuaikan dan 
                {autoApprove ? ' langsung disetujui' : ' tetap pending (perlu approval manual)'}
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adjustment-reason">Alasan Penyesuaian *</Label>
                <Textarea
                  id="adjustment-reason"
                  placeholder="Contoh: Disesuaikan dengan mutasi rekening bank periode Januari 2026"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="auto-approve"
                  checked={autoApprove}
                  onCheckedChange={(checked) => setAutoApprove(checked === true)}
                />
                <Label htmlFor="auto-approve" className="cursor-pointer">
                  Langsung setujui semua transaksi setelah penyesuaian
                </Label>
              </div>
            </div>

            {/* Summary of changes */}
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-2">Ringkasan Perubahan:</h4>
              <ul className="space-y-1 text-sm">
                {matchedAdjustments.filter(m => m.selected).slice(0, 5).map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-green-600" />
                    <span>{item.transaction.profiles?.name}</span>
                    <span className="text-muted-foreground">-</span>
                    {item.hasAmountChange && (
                      <span className="text-muted-foreground">
                        {formatCurrency(item.transaction.amount)} → {formatCurrency(item.newAmount)}
                      </span>
                    )}
                    {item.hasAmountChange && item.hasDateChange && <span>, </span>}
                    {item.hasDateChange && (
                      <span className="text-muted-foreground">
                        {formatShortDate(item.transaction.date || '')} → {formatShortDate(item.newDate)}
                      </span>
                    )}
                  </li>
                ))}
                {selectedCount > 5 && (
                  <li className="text-muted-foreground">...dan {selectedCount - 5} transaksi lainnya</li>
                )}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Batal
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Upload Ulang
              </Button>
              <Button 
                onClick={() => setStep('confirm')}
                disabled={selectedCount === 0}
                className="gap-2"
              >
                <PenLine className="h-4 w-4" />
                Konfirmasi {selectedCount} Penyesuaian
              </Button>
            </>
          )}
          
          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={() => setStep('preview')} disabled={isProcessing}>
                Kembali
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={isProcessing || !adjustmentReason.trim()}
                className="gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {autoApprove ? 'Sesuaikan & Setujui' : 'Sesuaikan Saja'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
