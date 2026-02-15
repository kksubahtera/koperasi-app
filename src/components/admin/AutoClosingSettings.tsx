import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CalendarClock, Loader2, CheckCircle2, AlertCircle, Play, CalendarDays, RefreshCw } from 'lucide-react';

interface MonthlyClosingSettings {
  enabled: boolean;
  dayOfMonth: number;
  hourOfDay: number;
  lastRun?: string;
}

interface YearlyClosingSettings {
  enabled: boolean;
  monthOfYear: number;
  dayOfMonth: number;
  lastRun?: string;
  lastYear?: number;
}

interface RolloverSettings {
  enabled: boolean;
  autoWithYearlyClosure: boolean;
}

export function AutoClosingSettings() {
  const [monthlySettings, setMonthlySettings] = useState<MonthlyClosingSettings>({
    enabled: false,
    dayOfMonth: 28,
    hourOfDay: 6,
  });
  const [yearlySettings, setYearlySettings] = useState<YearlyClosingSettings>({
    enabled: false,
    monthOfYear: 1,
    dayOfMonth: 15,
  });
  const [rolloverSettings, setRolloverSettings] = useState<RolloverSettings>({
    enabled: false,
    autoWithYearlyClosure: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingMonthly, setIsTestingMonthly] = useState(false);
  const [isTestingYearly, setIsTestingYearly] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('cooperative_settings')
          .select('key, value')
          .in('key', ['auto_monthly_closing', 'auto_yearly_closing', 'auto_shu_rollover']);

        if (error) throw error;

        (data || []).forEach(setting => {
          if (setting.key === 'auto_monthly_closing' && typeof setting.value === 'object' && !Array.isArray(setting.value)) {
            const val = setting.value as Record<string, unknown>;
            setMonthlySettings({
              enabled: Boolean(val.enabled ?? false),
              dayOfMonth: Number(val.dayOfMonth ?? 28),
              hourOfDay: Number(val.hourOfDay ?? 6),
              lastRun: val.lastRun as string | undefined,
            });
          }
          if (setting.key === 'auto_yearly_closing' && typeof setting.value === 'object' && !Array.isArray(setting.value)) {
            const val = setting.value as Record<string, unknown>;
            setYearlySettings({
              enabled: Boolean(val.enabled ?? false),
              monthOfYear: Number(val.monthOfYear ?? 1),
              dayOfMonth: Number(val.dayOfMonth ?? 15),
              lastRun: val.lastRun as string | undefined,
              lastYear: val.lastYear as number | undefined,
            });
          }
          if (setting.key === 'auto_shu_rollover' && typeof setting.value === 'object' && !Array.isArray(setting.value)) {
            const val = setting.value as Record<string, unknown>;
            setRolloverSettings({
              enabled: Boolean(val.enabled ?? false),
              autoWithYearlyClosure: Boolean(val.autoWithYearlyClosure ?? true),
            });
          }
        });
      } catch (err) {
        console.error('Error fetching auto-closing settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save monthly settings - use type assertion to satisfy TypeScript
      const monthlyData = {
        key: 'auto_monthly_closing',
        value: monthlySettings,
        updated_at: new Date().toISOString(),
      };
      
      const { error: monthlyError } = await supabase
        .from('cooperative_settings')
        .upsert(monthlyData as any, { onConflict: 'key' });

      if (monthlyError) throw monthlyError;

      // Save yearly settings
      const yearlyData = {
        key: 'auto_yearly_closing',
        value: yearlySettings,
        updated_at: new Date().toISOString(),
      };
      
      const { error: yearlyError } = await supabase
        .from('cooperative_settings')
        .upsert(yearlyData as any, { onConflict: 'key' });

      if (yearlyError) throw yearlyError;

      // Save rollover settings
      const rolloverData = {
        key: 'auto_shu_rollover',
        value: rolloverSettings,
        updated_at: new Date().toISOString(),
      };
      
      const { error: rolloverError } = await supabase
        .from('cooperative_settings')
        .upsert(rolloverData as any, { onConflict: 'key' });

      if (rolloverError) throw rolloverError;

      toast.success('Pengaturan tutup buku otomatis berhasil disimpan');
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestMonthly = async () => {
    setIsTestingMonthly(true);
    try {
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const { data, error } = await supabase.functions.invoke('monthly-closing', {
        body: { targetMonth: prevMonth.toISOString() },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Tutup buku bulanan berhasil! ${data.periodName}: ${data.memberCount} anggota`);
        setMonthlySettings(prev => ({ ...prev, lastRun: new Date().toISOString() }));
      } else {
        toast.info(data.message || 'Tutup buku tidak dapat dijalankan');
      }
    } catch (err) {
      console.error('Test monthly run error:', err);
      toast.error('Gagal menjalankan tutup buku bulanan');
    } finally {
      setIsTestingMonthly(false);
    }
  };

  const handleTestYearly = async () => {
    setIsTestingYearly(true);
    try {
      const now = new Date();
      const targetYear = now.getFullYear() - 1;

      const { data, error } = await supabase.functions.invoke('yearly-closing', {
        body: { targetYear },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Tutup buku tahun ${targetYear} berhasil! SHU: Rp ${data.shuBruto?.toLocaleString('id-ID')}`);
        setYearlySettings(prev => ({ 
          ...prev, 
          lastRun: new Date().toISOString(),
          lastYear: targetYear,
        }));
      } else {
        toast.info(data.message || 'Tutup buku tidak dapat dijalankan');
      }
    } catch (err) {
      console.error('Test yearly run error:', err);
      toast.error('Gagal menjalankan tutup buku tahunan');
    } finally {
      setIsTestingYearly(false);
    }
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Monthly Closing Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Tutup Buku Bulanan</CardTitle>
              <CardDescription>Jadwalkan perhitungan bunga simpanan otomatis setiap bulan</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="monthly-closing">Aktifkan Otomatis</Label>
              <p className="text-sm text-muted-foreground">
                Perhitungan bunga akan berjalan otomatis setiap bulan
              </p>
            </div>
            <Switch
              id="monthly-closing"
              checked={monthlySettings.enabled}
              onCheckedChange={(checked) => setMonthlySettings({ ...monthlySettings, enabled: checked })}
            />
          </div>

          {monthlySettings.enabled && (
            <>
              <div className="space-y-2">
                <Label>Tanggal Eksekusi</Label>
                <Select
                  value={String(monthlySettings.dayOfMonth)}
                  onValueChange={(v) => setMonthlySettings({ ...monthlySettings, dayOfMonth: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Tanggal 1 (Awal bulan berikutnya)</SelectItem>
                    <SelectItem value="25">Tanggal 25</SelectItem>
                    <SelectItem value="26">Tanggal 26</SelectItem>
                    <SelectItem value="27">Tanggal 27</SelectItem>
                    <SelectItem value="28">Tanggal 28 (Rekomendasi)</SelectItem>
                    <SelectItem value="29">Tanggal 29</SelectItem>
                    <SelectItem value="30">Tanggal 30</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Jam Eksekusi (WIB)</Label>
                <Select
                  value={String(monthlySettings.hourOfDay)}
                  onValueChange={(v) => setMonthlySettings({ ...monthlySettings, hourOfDay: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">00:00</SelectItem>
                    <SelectItem value="6">06:00 (Rekomendasi)</SelectItem>
                    <SelectItem value="12">12:00</SelectItem>
                    <SelectItem value="18">18:00</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            {monthlySettings.enabled ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">
                  Aktif - Tanggal {monthlySettings.dayOfMonth} pukul {String(monthlySettings.hourOfDay).padStart(2, '0')}:00 WIB
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tidak aktif</span>
              </>
            )}
          </div>

          {monthlySettings.lastRun && (
            <p className="text-sm text-muted-foreground">
              Terakhir: {new Date(monthlySettings.lastRun).toLocaleString('id-ID')}
            </p>
          )}

          <Button variant="outline" onClick={handleTestMonthly} disabled={isTestingMonthly} className="w-full">
            {isTestingMonthly ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menjalankan...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Jalankan Tutup Buku Bulanan</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Yearly Closing Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <CalendarDays className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">Tutup Buku Tahunan</CardTitle>
              <CardDescription>Jadwalkan finalisasi neraca dan perhitungan SHU otomatis</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="yearly-closing">Aktifkan Otomatis</Label>
              <p className="text-sm text-muted-foreground">
                Tutup buku tahunan akan berjalan otomatis di awal tahun baru
              </p>
            </div>
            <Switch
              id="yearly-closing"
              checked={yearlySettings.enabled}
              onCheckedChange={(checked) => setYearlySettings({ ...yearlySettings, enabled: checked })}
            />
          </div>

          {yearlySettings.enabled && (
            <>
              <div className="space-y-2">
                <Label>Bulan Eksekusi</Label>
                <Select
                  value={String(yearlySettings.monthOfYear)}
                  onValueChange={(v) => setYearlySettings({ ...yearlySettings, monthOfYear: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Januari (Rekomendasi)</SelectItem>
                    <SelectItem value="2">Februari</SelectItem>
                    <SelectItem value="3">Maret</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Tutup buku untuk tahun sebelumnya akan dijalankan pada bulan ini
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tanggal Eksekusi</Label>
                <Select
                  value={String(yearlySettings.dayOfMonth)}
                  onValueChange={(v) => setYearlySettings({ ...yearlySettings, dayOfMonth: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Tanggal 1</SelectItem>
                    <SelectItem value="5">Tanggal 5</SelectItem>
                    <SelectItem value="10">Tanggal 10</SelectItem>
                    <SelectItem value="15">Tanggal 15 (Rekomendasi)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            {yearlySettings.enabled ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">
                  Aktif - Tanggal {yearlySettings.dayOfMonth} {monthNames[yearlySettings.monthOfYear - 1]}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tidak aktif</span>
              </>
            )}
          </div>

          {yearlySettings.lastRun && yearlySettings.lastYear && (
            <p className="text-sm text-muted-foreground">
              Terakhir: Tahun {yearlySettings.lastYear} pada {new Date(yearlySettings.lastRun).toLocaleString('id-ID')}
            </p>
          )}

          <Button variant="outline" onClick={handleTestYearly} disabled={isTestingYearly} className="w-full">
            {isTestingYearly ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menjalankan...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Jalankan Tutup Buku Tahunan (Tahun Lalu)</>
            )}
          </Button>

          <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
            <strong>Catatan:</strong> Tutup buku tahunan akan membuat draft distribusi SHU yang perlu dikonfirmasi oleh admin di menu Akuntansi → SHU.
          </p>
        </CardContent>
      </Card>

      {/* SHU Rollover Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <RefreshCw className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base">Rollover SHU Otomatis</CardTitle>
              <CardDescription>Pindahkan saldo dana dan SHU ditahan ke tahun berikutnya secara otomatis</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-rollover">Aktifkan Auto Rollover</Label>
              <p className="text-sm text-muted-foreground">
                Saldo dana dan SHU ditahan akan dipindahkan ke tahun berikutnya secara otomatis
              </p>
            </div>
            <Switch
              id="auto-rollover"
              checked={rolloverSettings.enabled}
              onCheckedChange={(checked) => setRolloverSettings({ ...rolloverSettings, enabled: checked })}
            />
          </div>

          {rolloverSettings.enabled && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="rollover-with-yearly">Jalankan Bersamaan Tutup Buku Tahunan</Label>
                <p className="text-sm text-muted-foreground">
                  Rollover akan otomatis dilakukan setelah tutup buku tahunan selesai
                </p>
              </div>
              <Switch
                id="rollover-with-yearly"
                checked={rolloverSettings.autoWithYearlyClosure}
                onCheckedChange={(checked) => setRolloverSettings({ ...rolloverSettings, autoWithYearlyClosure: checked })}
              />
            </div>
          )}

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            {rolloverSettings.enabled ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">
                  Aktif - {rolloverSettings.autoWithYearlyClosure 
                    ? 'Rollover bersamaan tutup buku tahunan' 
                    : 'Rollover manual via menu Akuntansi → SHU → Rollover'}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tidak aktif - Rollover harus dilakukan manual</span>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg">
            <strong>Data yang di-rollover:</strong> Dana Cadangan, Dana Pendidikan, Dana Sosial, Dana Pembangunan, dan SHU yang ditahan dari anggota yang menunggak.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
        ) : (
          'Simpan Semua Pengaturan'
        )}
      </Button>
    </div>
  );
}
