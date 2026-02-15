import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

interface SettingsApplicationModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settingName: string;
  onConfirm: (mode: 'prospective' | 'retroactive', reason: string) => void;
}

export const SettingsApplicationModeDialog = ({
  open,
  onOpenChange,
  settingName,
  onConfirm,
}: SettingsApplicationModeDialogProps) => {
  const [mode, setMode] = useState<'prospective' | 'retroactive'>('prospective');
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(mode, reason);
    setMode('prospective');
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mode Penerapan Perubahan</DialogTitle>
          <DialogDescription>
            Pilih bagaimana perubahan <strong>{settingName}</strong> akan diterapkan
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'prospective' | 'retroactive')}>
            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="prospective" id="prospective" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="prospective" className="font-medium cursor-pointer">
                  Prospektif (Ke Depan)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Perubahan hanya berlaku untuk transaksi/pinjaman baru setelah tanggal perubahan
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="retroactive" id="retroactive" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="retroactive" className="font-medium cursor-pointer">
                  Retroaktif (Semua Data)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Perubahan berlaku untuk semua data termasuk yang sudah ada sebelumnya
                </p>
              </div>
            </div>
          </RadioGroup>

          {mode === 'retroactive' && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Perhatian</p>
                <p className="text-muted-foreground">
                  Mode retroaktif akan mempengaruhi perhitungan data historis. Pastikan Anda memahami konsekuensinya.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Alasan Perubahan (opsional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masukkan alasan perubahan untuk dokumentasi..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleConfirm}>
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
