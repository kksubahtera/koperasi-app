import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Percent, Calculator } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/mockData';
import { useQueryClient } from '@tanstack/react-query';

interface Installment {
  id: string;
  loan_id: string;
  installment_number: number;
  principal_amount: number;
  interest_amount: number;
  penalty_amount: number;
  total_amount: number;
  status: string;
  due_date: string;
  adjusted_interest_amount?: number | null;
  adjusted_penalty_amount?: number | null;
  adjustment_reason?: string | null;
}

interface LoanAdjustmentDialogProps {
  open: boolean;
  onClose: () => void;
  installment: Installment;
  userId: string;
  memberName: string;
}

export const LoanAdjustmentDialog = ({
  open,
  onClose,
  installment,
  userId,
  memberName,
}: LoanAdjustmentDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Use existing adjustment values if present
  const [adjustedInterest, setAdjustedInterest] = useState<string>(
    installment.adjusted_interest_amount !== null && installment.adjusted_interest_amount !== undefined
      ? String(installment.adjusted_interest_amount)
      : String(installment.interest_amount)
  );
  const [adjustedPenalty, setAdjustedPenalty] = useState<string>(
    installment.adjusted_penalty_amount !== null && installment.adjusted_penalty_amount !== undefined
      ? String(installment.adjusted_penalty_amount)
      : String(installment.penalty_amount || 0)
  );
  const [reason, setReason] = useState(installment.adjustment_reason || '');

  const originalInterest = installment.interest_amount;
  const originalPenalty = installment.penalty_amount || 0;
  const newInterest = parseFloat(adjustedInterest) || 0;
  const newPenalty = parseFloat(adjustedPenalty) || 0;
  
  const interestReduction = originalInterest - newInterest;
  const penaltyReduction = originalPenalty - newPenalty;
  const totalReduction = interestReduction + penaltyReduction;
  
  const originalTotal = installment.principal_amount + originalInterest + originalPenalty;
  const newTotal = installment.principal_amount + newInterest + newPenalty;

  const hasExistingAdjustment = installment.adjusted_interest_amount !== null || installment.adjusted_penalty_amount !== null;

  const handleSaveAdjustment = async () => {
    if (!user) return;
    
    if (!reason.trim()) {
      toast({
        title: 'Alasan Diperlukan',
        description: 'Silakan masukkan alasan penyesuaian.',
        variant: 'destructive',
      });
      return;
    }

    if (newInterest < 0 || newPenalty < 0) {
      toast({
        title: 'Nilai Tidak Valid',
        description: 'Bunga dan denda tidak boleh negatif.',
        variant: 'destructive',
      });
      return;
    }

    if (newInterest > originalInterest || newPenalty > originalPenalty) {
      toast({
        title: 'Nilai Tidak Valid',
        description: 'Nilai penyesuaian tidak boleh lebih besar dari nilai asli.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Update loan_installments with adjusted amounts
      const { error: updateError } = await supabase
        .from('loan_installments')
        .update({
          adjusted_interest_amount: newInterest,
          adjusted_penalty_amount: newPenalty,
          adjustment_reason: reason.trim(),
          adjusted_by: user.id,
          adjusted_at: new Date().toISOString(),
          // Update total_amount to reflect adjusted values
          total_amount: installment.principal_amount + newInterest + newPenalty,
        })
        .eq('id', installment.id);

      if (updateError) throw updateError;

      // Insert into adjustment history for audit
      const { error: historyError } = await supabase
        .from('loan_adjustment_history')
        .insert({
          installment_id: installment.id,
          loan_id: installment.loan_id,
          user_id: userId,
          original_interest_amount: originalInterest,
          original_penalty_amount: originalPenalty,
          adjusted_interest_amount: newInterest,
          adjusted_penalty_amount: newPenalty,
          interest_reduction: interestReduction,
          penalty_reduction: penaltyReduction,
          reason: reason.trim(),
          adjusted_by: user.id,
        });

      if (historyError) {
        console.error('Error saving adjustment history:', historyError);
        // Don't throw here, the main adjustment was successful
      }

      // Create notification for member
      await supabase.from('member_notifications').insert({
        user_id: userId,
        title: 'Keringanan Angsuran Disetujui',
        message: `Angsuran ke-${installment.installment_number} Anda mendapat keringanan. Pengurangan bunga: ${formatCurrency(interestReduction)}, Pengurangan denda: ${formatCurrency(penaltyReduction)}. Total yang harus dibayar: ${formatCurrency(newTotal)}.`,
        notification_type: 'loan_adjustment',
        metadata: {
          installment_id: installment.id,
          installment_number: installment.installment_number,
          original_total: originalTotal,
          new_total: newTotal,
          interest_reduction: interestReduction,
          penalty_reduction: penaltyReduction,
          reason: reason.trim(),
        },
      });

      toast({
        title: 'Keringanan Berhasil Disimpan',
        description: `Angsuran ke-${installment.installment_number} untuk ${memberName} telah disesuaikan.`,
      });

      await queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      await queryClient.invalidateQueries({ queryKey: ['user-loans'] });
      await queryClient.invalidateQueries({ queryKey: ['loan-installments'] });
      
      onClose();
    } catch (error) {
      console.error('Error saving adjustment:', error);
      toast({
        title: 'Gagal Menyimpan',
        description: 'Terjadi kesalahan saat menyimpan keringanan.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveAdjustment = async () => {
    if (!user) return;
    
    setIsProcessing(true);

    try {
      // Reset adjustment values
      const { error } = await supabase
        .from('loan_installments')
        .update({
          adjusted_interest_amount: null,
          adjusted_penalty_amount: null,
          adjustment_reason: null,
          adjusted_by: null,
          adjusted_at: null,
          // Reset total to original
          total_amount: installment.principal_amount + originalInterest + originalPenalty,
        })
        .eq('id', installment.id);

      if (error) throw error;

      toast({
        title: 'Keringanan Dibatalkan',
        description: 'Angsuran kembali ke nilai asli.',
      });

      await queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      await queryClient.invalidateQueries({ queryKey: ['user-loans'] });
      await queryClient.invalidateQueries({ queryKey: ['loan-installments'] });
      
      onClose();
    } catch (error) {
      console.error('Error removing adjustment:', error);
      toast({
        title: 'Gagal Membatalkan',
        description: 'Terjadi kesalahan saat membatalkan keringanan.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Keringanan Bunga & Denda
          </DialogTitle>
          <DialogDescription>
            Sesuaikan bunga dan denda untuk anggota yang tidak mampu membayar penuh
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Member Info */}
          <div className="p-3 rounded-lg bg-secondary">
            <p className="font-medium text-foreground">{memberName}</p>
            <p className="text-sm text-muted-foreground">
              Angsuran ke-{installment.installment_number} • Jatuh tempo: {new Date(installment.due_date).toLocaleDateString('id-ID')}
            </p>
          </div>

          {hasExistingAdjustment && (
            <Alert className="border-blue-500/50 bg-blue-500/10">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">
                Angsuran ini sudah memiliki penyesuaian sebelumnya. Anda dapat memperbarui atau membatalkannya.
              </AlertDescription>
            </Alert>
          )}

          {/* Original Values */}
          <div className="grid grid-cols-2 gap-4 p-3 rounded-lg border border-border bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground">Pokok Asli</p>
              <p className="font-semibold text-foreground">{formatCurrency(installment.principal_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Asli</p>
              <p className="font-semibold text-foreground">{formatCurrency(originalTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bunga Asli</p>
              <p className="font-semibold text-foreground">{formatCurrency(originalInterest)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Denda Asli</p>
              <p className="font-semibold text-foreground">{formatCurrency(originalPenalty)}</p>
            </div>
          </div>

          {/* Adjustment Inputs */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="adjusted-interest" className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Bunga yang Dikenakan
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                <Input
                  id="adjusted-interest"
                  type="number"
                  min="0"
                  max={originalInterest}
                  value={adjustedInterest}
                  onChange={(e) => setAdjustedInterest(e.target.value)}
                  className="pl-10"
                  placeholder="0"
                />
              </div>
              {interestReduction > 0 && (
                <p className="text-xs text-green-600">
                  Pengurangan: {formatCurrency(interestReduction)} ({Math.round((interestReduction / originalInterest) * 100)}%)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjusted-penalty" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Denda yang Dikenakan
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                <Input
                  id="adjusted-penalty"
                  type="number"
                  min="0"
                  max={originalPenalty}
                  value={adjustedPenalty}
                  onChange={(e) => setAdjustedPenalty(e.target.value)}
                  className="pl-10"
                  placeholder="0"
                  disabled={originalPenalty === 0}
                />
              </div>
              {penaltyReduction > 0 && (
                <p className="text-xs text-green-600">
                  Pengurangan: {formatCurrency(penaltyReduction)} ({Math.round((penaltyReduction / originalPenalty) * 100)}%)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Alasan Keringanan *</Label>
              <Textarea
                id="reason"
                placeholder="Contoh: Anggota mengalami musibah, kehilangan pekerjaan, dll."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Summary */}
          {totalReduction > 0 && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-700 dark:text-green-400">Total Pengurangan:</span>
                <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(totalReduction)}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm text-muted-foreground">Yang harus dibayar:</span>
                <span className="font-bold text-foreground">{formatCurrency(newTotal)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {hasExistingAdjustment && (
              <Button
                variant="outline"
                onClick={handleRemoveAdjustment}
                disabled={isProcessing}
                className="text-destructive hover:text-destructive"
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Batalkan Keringanan
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveAdjustment}
              disabled={isProcessing || !reason.trim()}
              className="flex-1"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Keringanan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
