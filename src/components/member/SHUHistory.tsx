import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SHURecord } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { Gift, Calendar, TrendingUp } from 'lucide-react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SHUHistoryProps {
  records: SHURecord[];
}

export const SHUHistory = ({ records }: SHUHistoryProps) => {
  const { t } = useThemeLanguage();
  const totalSHU = records.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card variant="accent" className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">{t('Total SHU Diterima', 'Total SHU Received')}</p>
              <p className="mt-1 text-3xl font-bold">{formatCurrency(totalSHU)}</p>
              <p className="mt-1 text-sm opacity-75">{records.length} {t('tahun buku', 'fiscal years')}</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-foreground/20">
              <Gift className="h-7 w-7" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Riwayat SHU per Tahun', 'SHU History by Year')}</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Gift className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{t('Belum ada riwayat SHU', 'No SHU history yet')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('SHU dibagikan pada tutup buku bulan Desember', 'SHU is distributed at fiscal year end in December')}
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                  {records.map((record, index) => (
                    <div
                      key={record.id}
                      className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50 animate-fade-in"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <span className="text-lg font-bold text-primary">{record.year}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{t('Tahun Buku', 'Fiscal Year')} {record.year}</p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{t('Dibagikan', 'Distributed')} {formatDate(record.distributedAt)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-success">{formatCurrency(record.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {records.length > 3 && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {t(`Total ${records.length} riwayat SHU`, `Total ${records.length} SHU records`)}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card variant="flat" className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <TrendingUp className="h-5 w-5 text-primary shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{t('Tentang SHU', 'About SHU')}</p>
              <p className="mt-1">
                {t(
                  'Sisa Hasil Usaha (SHU) adalah bagian keuntungan koperasi yang dibagikan kepada anggota pada akhir tahun buku (Desember). Besaran SHU dihitung berdasarkan kontribusi simpanan dan partisipasi anggota dalam kegiatan koperasi.',
                  'SHU (Surplus Revenue Sharing) is the cooperative\'s profit distributed to members at fiscal year end (December). The amount is calculated based on savings contribution and member participation in cooperative activities.'
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};