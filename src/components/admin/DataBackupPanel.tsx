import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Download, 
  Database, 
  Users, 
  Wallet, 
  FileText, 
  BookOpen,
  Clock,
  CheckCircle2,
  Loader2,
  HardDrive,
  RefreshCw,
  Calendar,
  AlertCircle,
  Archive
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { useDataBackup, BackupType } from '@/hooks/useDataBackup';
import YearlyDataExport from './YearlyDataExport';

interface DataBackupPanelProps {
  onBack: () => void;
}

const BACKUP_OPTIONS: { type: BackupType; label: string; description: string; icon: React.ReactNode }[] = [
  { 
    type: 'full', 
    label: 'Backup Lengkap', 
    description: 'Semua data termasuk anggota, transaksi, pinjaman, simpanan, dan jurnal',
    icon: <Database className="h-5 w-5" />
  },
  { 
    type: 'members', 
    label: 'Data Anggota', 
    description: 'Profil anggota dan data keanggotaan',
    icon: <Users className="h-5 w-5" />
  },
  { 
    type: 'transactions', 
    label: 'Data Transaksi', 
    description: 'Riwayat semua transaksi keuangan',
    icon: <Wallet className="h-5 w-5" />
  },
  { 
    type: 'loans', 
    label: 'Data Pinjaman', 
    description: 'Data pinjaman dan angsuran',
    icon: <FileText className="h-5 w-5" />
  },
  { 
    type: 'journals', 
    label: 'Data Jurnal', 
    description: 'Jurnal akuntansi dan bagan akun',
    icon: <BookOpen className="h-5 w-5" />
  },
];

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const DataBackupPanel = ({ onBack }: DataBackupPanelProps) => {
  const { 
    exportData, 
    isExporting, 
    progress, 
    history, 
    loadingHistory, 
    fetchBackupHistory,
    BACKUP_TYPE_LABELS 
  } = useDataBackup();

  const [selectedType, setSelectedType] = useState<BackupType | null>(null);

  useEffect(() => {
    fetchBackupHistory();
  }, []);

  const handleExport = async (type: BackupType) => {
    setSelectedType(type);
    const success = await exportData(type);
    if (success) {
      toast.success('Backup berhasil diunduh!', {
        description: `File ${BACKUP_TYPE_LABELS[type]} telah tersimpan.`,
      });
      fetchBackupHistory();
    } else {
      toast.error('Gagal membuat backup', {
        description: 'Terjadi kesalahan saat mengekspor data.',
      });
    }
    setSelectedType(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Backup Data</h1>
          <p className="text-sm text-muted-foreground">
            Ekspor dan cadangkan data koperasi
          </p>
        </div>
      </div>

      <Tabs defaultValue="backup" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Backup Data
          </TabsTrigger>
          <TabsTrigger value="yearly" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Arsip Tahun Buku
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backup" className="mt-6 space-y-6">
          {/* Export Progress */}
          {isExporting && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      Mengekspor {selectedType ? BACKUP_TYPE_LABELS[selectedType] : 'data'}...
                    </p>
                    <Progress value={progress} className="mt-2 h-2" />
                  </div>
                  <span className="text-sm font-medium text-primary">{progress}%</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export Options */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {BACKUP_OPTIONS.map((option) => (
              <Card 
                key={option.type}
                className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${
                  isExporting && selectedType === option.type ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {option.icon}
                    </div>
                    {option.type === 'full' && (
                      <Badge variant="default" className="text-xs">Direkomendasikan</Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-3">{option.label}</CardTitle>
                  <CardDescription className="text-sm">
                    {option.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    className="w-full gap-2"
                    variant={option.type === 'full' ? 'default' : 'outline'}
                    disabled={isExporting}
                    onClick={() => handleExport(option.type)}
                  >
                    {isExporting && selectedType === option.type ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Unduh Excel
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Info Card */}
          <Card className="bg-info/5 border-info/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-info mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Tips Backup Data</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Lakukan backup secara berkala (minimal mingguan)</li>
                    <li>Simpan file backup di lokasi yang aman dan terpisah</li>
                    <li>Backup Lengkap mencakup semua data untuk pemulihan penuh</li>
                    <li>File backup dalam format Excel (.xlsx) yang dapat dibuka di spreadsheet</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Backup History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Riwayat Backup
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchBackupHistory}
                  disabled={loadingHistory}
                >
                  {loadingHistory ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <HardDrive className="h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">Belum ada riwayat backup</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {history.map((backup, index) => (
                      <div
                        key={backup.id}
                        className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors animate-slide-up"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success shrink-0">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {backup.file_name}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(backup.created_at), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                            </span>
                            <span className="flex items-center gap-1">
                              <HardDrive className="h-3 w-3" />
                              {formatFileSize(backup.file_size)}
                            </span>
                            <span>{backup.record_count || 0} record</span>
                          </div>
                        </div>
                        <Badge variant={backup.backup_type === 'yearly_archive' ? 'default' : 'outline'}>
                          {backup.backup_type === 'yearly_archive' 
                            ? 'Arsip Tahunan' 
                            : (BACKUP_TYPE_LABELS[backup.backup_type as BackupType] || backup.backup_type)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="yearly" className="mt-6">
          <YearlyDataExport />
        </TabsContent>
      </Tabs>
    </div>
  );
};
