import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  ArrowLeft, 
  Clock, 
  User,
  ArrowRightLeft,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useSettingsChangeLogs, SettingsChangeLog } from '@/hooks/useSettingsChangeLogs';

interface SettingsChangeHistoryProps {
  onBack: () => void;
}

const SETTING_KEY_LABELS: Record<string, string> = {
  interestRate: 'Bunga Pinjaman',
  simpananSukarelaInterestRate: 'Bunga Simpanan Sukarela',
  latePaymentPenalty: 'Denda Keterlambatan',
  simpananPokok: 'Simpanan Pokok',
  simpananWajib: 'Simpanan Wajib',
  minLoanAmount: 'Pinjaman Minimal',
  maxLoanAmount: 'Pinjaman Maksimal',
  tenorMin: 'Tenor Minimal',
  tenorMax: 'Tenor Maksimal',
  shuDistribution: 'Distribusi SHU',
  bank_name: 'Nama Bank',
  bank_account_number: 'Nomor Rekening',
  bank_account_name: 'Nama Pemilik Rekening',
  contact_phone: 'Nomor Telepon',
};

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'number') {
    return value.toLocaleString('id-ID');
  }
  return String(value);
};

export const SettingsChangeHistory = ({ onBack }: SettingsChangeHistoryProps) => {
  const { logs, loading } = useSettingsChangeLogs();

  const getApplicationModeLabel = (mode: string) => {
    return mode === 'retroactive' ? 'Retroaktif' : 'Prospektif';
  };

  const getApplicationModeVariant = (mode: string) => {
    return mode === 'retroactive' ? 'destructive' : 'default';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Riwayat Perubahan Pengaturan</h1>
          <p className="text-sm text-muted-foreground">Log perubahan pengaturan koperasi</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Daftar Perubahan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada riwayat perubahan</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {logs.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-4 rounded-lg border border-border bg-muted/30 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="font-medium text-foreground">
                          {SETTING_KEY_LABELS[log.setting_key] || log.setting_key}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(log.created_at), 'dd MMMM yyyy, HH:mm', { locale: id })}
                        </div>
                      </div>
                      <Badge variant={getApplicationModeVariant(log.application_mode)}>
                        {getApplicationModeLabel(log.application_mode)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex-1 p-2 rounded bg-destructive/10 border border-destructive/20">
                        <span className="text-xs text-muted-foreground block mb-1">Nilai Lama</span>
                        <code className="text-xs">{formatValue(log.old_value)}</code>
                      </div>
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 p-2 rounded bg-primary/10 border border-primary/20">
                        <span className="text-xs text-muted-foreground block mb-1">Nilai Baru</span>
                        <code className="text-xs">{formatValue(log.new_value)}</code>
                      </div>
                    </div>

                    {log.change_reason && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Alasan:</span> {log.change_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
