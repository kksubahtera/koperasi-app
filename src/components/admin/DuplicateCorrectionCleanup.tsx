import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { formatCurrency } from '@/lib/mockData';
import { useDuplicateCorrectionDetection, DuplicateGroup } from '@/hooks/useDuplicateCorrectionDetection';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const correctionTypeLabels: Record<string, string> = {
  simpanan_pokok: 'Simpanan Pokok',
  simpanan_wajib: 'Simpanan Wajib',
  simpanan_sukarela: 'Simpanan Sukarela',
};

const operationLabels: Record<string, string> = {
  add: 'Penambahan',
  subtract: 'Pengurangan',
};

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  onCleanup: (groupKey: string, keepFirst?: boolean) => Promise<boolean>;
  isCleaningUp: boolean;
}

const DuplicateGroupCard = ({ group, onCleanup, isCleaningUp }: DuplicateGroupCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCleanup = async () => {
    setIsProcessing(true);
    await onCleanup(group.key);
    setIsProcessing(false);
  };

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-sm font-medium">
                {group.userName}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {correctionTypeLabels[group.correction_type] || group.correction_type}
              </Badge>
              <Badge variant={group.operation === 'subtract' ? 'destructive' : 'default'} className="text-xs">
                {operationLabels[group.operation] || group.operation}
              </Badge>
            </div>
            <CardDescription className="mt-1">
              ID Transaksi: {group.transaction_id?.slice(0, 8)}...
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-destructive">
              {group.originalCount}x
            </p>
            <p className="text-xs text-muted-foreground">
              koreksi sama
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Nominal</p>
            <p className="font-semibold">{formatCurrency(group.amount)}</p>
          </div>
          <div className="p-2 rounded-lg bg-destructive/10">
            <p className="text-xs text-muted-foreground">Duplikat</p>
            <p className="font-semibold text-destructive">{group.excessCount}x</p>
          </div>
          <div className="p-2 rounded-lg bg-destructive/10 col-span-2">
            <p className="text-xs text-muted-foreground">Total Kelebihan Koreksi</p>
            <p className="font-semibold text-destructive">{formatCurrency(group.totalExcessAmount)}</p>
          </div>
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between mb-2">
              <span className="text-xs">Detail {group.originalCount} Koreksi</span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Waktu</TableHead>
                    <TableHead className="text-xs">Alasan</TableHead>
                    <TableHead className="text-xs text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.corrections.map((cor, idx) => (
                    <TableRow key={cor.id} className={idx === 0 ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}>
                      <TableCell className="text-xs">
                        {idx === 0 ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-[10px]">
                            Keep
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            Hapus
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(cor.created_at), 'dd MMM yyyy HH:mm', { locale: localeId })}
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">
                        {cor.reason}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        <Badge variant="secondary" className="text-[10px]">
                          {cor.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              size="sm" 
              className="w-full mt-2"
              disabled={isCleaningUp || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Hapus {group.excessCount} Duplikat
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Hapus Duplikat</AlertDialogTitle>
              <AlertDialogDescription>
                Anda akan menghapus {group.excessCount} koreksi duplikat untuk {group.userName}. 
                Koreksi pertama akan dipertahankan, sisanya akan dihapus.
                <br /><br />
                <strong>Total yang akan dihapus:</strong> {formatCurrency(group.totalExcessAmount)} ({group.operation === 'subtract' ? 'pengurangan' : 'penambahan'})
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleCleanup}>
                Ya, Hapus Duplikat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export const DuplicateCorrectionCleanup = () => {
  const {
    duplicateGroups,
    totalDuplicates,
    totalExcessAmount,
    affectedUsers,
    isLoading,
    error,
    refetch,
    cleanupDuplicate,
    cleanupAllDuplicates,
    isCleaningUp,
  } = useDuplicateCorrectionDetection();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Mendeteksi koreksi duplikat...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex items-center justify-center py-12 gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Coba Lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (duplicateGroups.length === 0) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
          <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
            Tidak Ada Koreksi Duplikat
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Semua koreksi transaksi sudah bersih. Tidak ada duplikasi yang terdeteksi.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Periksa Ulang
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="border-warning/50 bg-gradient-to-r from-warning/10 to-destructive/10">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <CardTitle className="text-lg">Koreksi Duplikat Terdeteksi</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={refetch} disabled={isCleaningUp}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isCleaningUp ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Ditemukan koreksi yang diterapkan lebih dari sekali untuk transaksi yang sama
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-background border">
              <p className="text-xs text-muted-foreground">Grup Duplikat</p>
              <p className="text-2xl font-bold text-warning">{duplicateGroups.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-background border">
              <p className="text-xs text-muted-foreground">Total Duplikat</p>
              <p className="text-2xl font-bold text-destructive">{totalDuplicates}</p>
            </div>
            <div className="p-3 rounded-lg bg-background border">
              <p className="text-xs text-muted-foreground">Anggota Terdampak</p>
              <p className="text-2xl font-bold">{affectedUsers}</p>
            </div>
            <div className="p-3 rounded-lg bg-background border">
              <p className="text-xs text-muted-foreground">Total Kelebihan</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(totalExcessAmount)}</p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="w-full"
                disabled={isCleaningUp}
              >
                {isCleaningUp ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Bersihkan Semua Duplikat ({totalDuplicates})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Bersihkan Semua Duplikat</AlertDialogTitle>
                <AlertDialogDescription>
                  Anda akan menghapus <strong>{totalDuplicates}</strong> koreksi duplikat dari <strong>{affectedUsers}</strong> anggota.
                  <br /><br />
                  Untuk setiap grup duplikat, hanya koreksi pertama yang akan dipertahankan.
                  <br /><br />
                  <span className="text-destructive font-medium">
                    Total kelebihan koreksi yang dihapus: {formatCurrency(totalExcessAmount)}
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={cleanupAllDuplicates}>
                  Ya, Bersihkan Semua
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Duplicate Groups List */}
      <div className="grid gap-3 sm:grid-cols-2">
        {duplicateGroups.map((group) => (
          <DuplicateGroupCard
            key={group.key}
            group={group}
            onCleanup={cleanupDuplicate}
            isCleaningUp={isCleaningUp}
          />
        ))}
      </div>
    </div>
  );
};
