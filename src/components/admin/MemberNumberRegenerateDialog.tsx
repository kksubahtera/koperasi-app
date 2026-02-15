import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Users, User as UserIcon, AlertTriangle } from 'lucide-react';
import { useMemberNumberRegeneration } from '@/hooks/useMemberNumberRegeneration';
import { User } from '@/lib/types';

interface MemberNumberRegenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: User | null; // If provided, regenerate single member only
  isAdmin?: boolean;
  onSuccess?: () => void;
}

export const MemberNumberRegenerateDialog = ({
  open,
  onOpenChange,
  member,
  isAdmin = false,
  onSuccess,
}: MemberNumberRegenerateDialogProps) => {
  const { isRegenerating, regenerateSingleMemberNumber, regenerateAllMemberNumbers } = useMemberNumberRegeneration();
  const [regenerateMode, setRegenerateMode] = useState<'single' | 'all'>(member ? 'single' : 'all');
  const [showConfirmAll, setShowConfirmAll] = useState(false);

  const handleRegenerate = async () => {
    if (regenerateMode === 'single' && member) {
      const result = await regenerateSingleMemberNumber(member.id, isAdmin);
      if (result) {
        onSuccess?.();
        onOpenChange(false);
      }
    } else if (regenerateMode === 'all') {
      setShowConfirmAll(true);
    }
  };

  const handleConfirmAll = async () => {
    setShowConfirmAll(false);
    const success = await regenerateAllMemberNumbers();
    if (success) {
      onSuccess?.();
      onOpenChange(false);
    }
  };

  const getPreviewNumber = () => {
    if (!member) return 'MBR-20260103-0001';
    const prefix = isAdmin ? 'ADM' : 'MBR';
    const joinDate = member.joinDate || new Date().toISOString();
    const date = new Date(joinDate);
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return `${prefix}-${dateStr}-0001`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Regenerate Nomor Anggota
            </DialogTitle>
            <DialogDescription>
              Format baru: PREFIX-YYYYMMDD-XXXX (contoh: {getPreviewNumber()})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {member && (
              <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{member.name}</span>
                  {isAdmin && <Badge variant="outline">Admin</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">
                  Nomor saat ini: <span className="font-mono">{member.memberNumber}</span>
                </div>
              </div>
            )}

            <RadioGroup
              value={regenerateMode}
              onValueChange={(value) => setRegenerateMode(value as 'single' | 'all')}
              className="space-y-3"
            >
              {member && (
                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="single" id="single" />
                  <Label htmlFor="single" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      <span>Regenerate untuk anggota ini saja</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Hanya mengubah nomor anggota {member.name}
                    </p>
                  </Label>
                </div>
              )}
              
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Regenerate semua anggota</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Reset nomor seluruh anggota dengan format sequential baru
                  </p>
                </Label>
              </div>
            </RadioGroup>

            {regenerateMode === 'all' && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Perhatian!</p>
                  <p>Tindakan ini akan mengubah nomor anggota seluruh member. Pastikan tidak ada proses yang sedang menggunakan nomor anggota lama.</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isRegenerating}
            >
              Batal
            </Button>
            <Button onClick={handleRegenerate} disabled={isRegenerating}>
              {isRegenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmAll} onOpenChange={setShowConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Regenerate Semua Nomor Anggota</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan mengubah nomor anggota untuk SEMUA member dalam sistem. 
              Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin melanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAll}>
              Ya, Regenerate Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
