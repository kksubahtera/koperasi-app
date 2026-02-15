import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CorrectionTransaction, CorrectionType, CorrectionStatus, CorrectionMode } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { PenLine, ArrowUpDown, Flag, AlertTriangle, CheckCircle2, Plus, Minus, FileText, Receipt, Wallet, BookOpen } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface CorrectionHistoryProps {
  corrections: CorrectionTransaction[];
  onReportCorrection?: (correctionId: string, reason: string) => void;
}

const correctionTypeLabels: Record<CorrectionType, string> = {
  'simpanan_pokok': 'Simpanan Pokok',
  'simpanan_wajib': 'Simpanan Wajib',
  'simpanan_sukarela': 'Simpanan Sukarela',
  'angsuran_pinjaman': 'Angsuran Pinjaman',
};

const correctionStatusLabels: Record<CorrectionStatus, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  'applied': { label: 'Diterapkan', variant: 'success' },
  'reported': { label: 'Dilaporkan', variant: 'warning' },
  'resolved': { label: 'Diselesaikan', variant: 'secondary' },
  'resolved_approved': { label: 'Disetujui', variant: 'success' },
  'resolved_rejected': { label: 'Ditolak', variant: 'secondary' },
};

const correctionModeLabels: Record<CorrectionMode, { label: string; icon: typeof Wallet }> = {
  'nominal': { label: 'Nominal', icon: Wallet },
  'transaction_based': { label: 'Berbasis Transaksi', icon: Receipt },
};

export const CorrectionHistory = ({ corrections, onReportCorrection }: CorrectionHistoryProps) => {
  const [selectedCorrection, setSelectedCorrection] = useState<CorrectionTransaction | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');


  const handleReport = () => {
    if (!selectedCorrection || !reportReason.trim()) {
      toast.error('Alasan laporan harus diisi');
      return;
    }
    
    onReportCorrection?.(selectedCorrection.id, reportReason);
    toast.success('Laporan berhasil dikirim. Admin akan meninjau koreksi ini.');
    setShowReportDialog(false);
    setSelectedCorrection(null);
    setReportReason('');
  };

  const getDifference = (correction: CorrectionTransaction) => {
    return correction.operation === 'add' ? correction.amount : -correction.amount;
  };

  if (corrections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Riwayat Koreksi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <PenLine className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Tidak ada riwayat koreksi</p>
            <p className="text-xs text-muted-foreground mt-1">
              Koreksi adalah penyesuaian yang dilakukan oleh Admin terhadap transaksi Anda
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-lg">Riwayat Koreksi</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Penyesuaian transaksi yang dilakukan oleh Admin
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-muted bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Jika Anda merasa koreksi tidak sesuai, gunakan tombol "Laporkan" untuk mengajukan peninjauan.
              </p>
            </div>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {corrections.map((correction, index) => {
                const difference = getDifference(correction);
                const modeInfo = correction.correctionMode ? correctionModeLabels[correction.correctionMode] : correctionModeLabels['nominal'];
                const ModeIcon = modeInfo.icon;
                
                return (
                  <div 
                    key={correction.id} 
                    className="rounded-lg border p-4 space-y-3 animate-fade-in"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">
                            {correctionTypeLabels[correction.correctionType]}
                            {correction.installmentNumber && ` #${correction.installmentNumber}`}
                          </p>
                          <Badge variant={correctionStatusLabels[correction.status].variant}>
                            {correctionStatusLabels[correction.status].label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(correction.createdAt)}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${correction.operation === 'add' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                          {correction.operation === 'add' ? (
                            <Plus className="h-4 w-4 text-success" />
                          ) : (
                            <Minus className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <p className={`text-lg font-bold ${difference >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Correction Mode Badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-xs bg-muted/50 rounded-full px-2 py-1">
                        <ModeIcon className="h-3 w-3" />
                        <span>{modeInfo.label}</span>
                      </div>
                      
                      {/* Transaction Reference */}
                      {correction.transactionId && (
                        <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2 py-1">
                          <FileText className="h-3 w-3" />
                          <span>Ref: Transaksi</span>
                        </div>
                      )}
                      
                      {/* Journal Reference */}
                      {correction.journalEntryId && (
                        <div className="flex items-center gap-1 text-xs bg-success/10 text-success rounded-full px-2 py-1">
                          <BookOpen className="h-3 w-3" />
                          <span>Jurnal Tercatat</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded bg-muted/50 p-2">
                        <p className="text-muted-foreground">Saldo Sebelum</p>
                        <p className="font-medium">{formatCurrency(correction.currentBalance)}</p>
                      </div>
                      <div className="rounded bg-muted/50 p-2">
                        <p className="text-muted-foreground">Saldo Sesudah</p>
                        <p className="font-medium">{formatCurrency(correction.newBalance)}</p>
                      </div>
                    </div>

                    <div className="text-sm">
                      <p className="text-muted-foreground">Alasan:</p>
                      <p>{correction.reason}</p>
                    </div>

                    {correction.footnote && (
                      <div className="flex items-start gap-2 rounded bg-primary/5 p-2 text-sm border-l-2 border-primary">
                        <ArrowUpDown className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-muted-foreground italic">{correction.footnote}</p>
                      </div>
                    )}

                    {correction.status === 'reported' && (
                      <div className="flex items-start gap-2 rounded bg-warning/10 p-2 text-sm border-l-2 border-warning">
                        <Flag className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-warning">Laporan Anda sedang ditinjau</p>
                          {correction.reportReason && (
                            <p className="text-muted-foreground">{correction.reportReason}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {correction.status === 'resolved' && correction.resolutionNote && (
                      <div className="flex items-start gap-2 rounded bg-success/10 p-2 text-sm border-l-2 border-success">
                        <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-success">Diselesaikan</p>
                          <p className="text-muted-foreground">{correction.resolutionNote}</p>
                        </div>
                      </div>
                    )}

                    {correction.status === 'applied' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedCorrection(correction);
                          setShowReportDialog(true);
                        }}
                      >
                        <Flag className="mr-2 h-4 w-4" />
                        Laporkan Koreksi Ini
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          {corrections.length > 3 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Total {corrections.length} koreksi
            </p>
          )}
        </CardContent>
      </Card>

      {/* Report Dialog */}
      <AlertDialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Laporkan Koreksi</AlertDialogTitle>
            <AlertDialogDescription>
              Jelaskan mengapa Anda merasa koreksi ini tidak sesuai. Admin akan meninjau laporan Anda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {selectedCorrection && (
            <div className="rounded-lg border p-3 bg-muted/50 my-2">
              <p className="text-sm text-muted-foreground">Koreksi yang dilaporkan:</p>
              <p className="font-medium">{correctionTypeLabels[selectedCorrection.correctionType]}</p>
              <p className="text-sm">
                {selectedCorrection.operation === 'add' ? 'Penambahan' : 'Pengurangan'}: {' '}
                <span className={selectedCorrection.operation === 'add' ? 'text-success' : 'text-destructive'}>
                  {selectedCorrection.operation === 'add' ? '+' : '-'}{formatCurrency(selectedCorrection.amount)}
                </span>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="report-reason">Alasan Laporan *</Label>
            <Textarea
              id="report-reason"
              placeholder="Jelaskan mengapa koreksi ini tidak sesuai..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedCorrection(null);
              setReportReason('');
            }}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleReport}>
              <Flag className="mr-2 h-4 w-4" />
              Kirim Laporan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
