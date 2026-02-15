import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Users, 
  Calculator, 
  Clock, 
  ArrowRightLeft,
  Save,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ExitedMemberSHUSettings {
  enabled: boolean;
  calculationMethod: 'pro_rata' | 'full' | 'at_exit';
  paymentTime: 'on_resignation' | 'year_end' | 'after_rat';
  fallbackAllocation: 'reserve_fund' | 'redistribute' | 'forfeited';
}

const defaultSettings: ExitedMemberSHUSettings = {
  enabled: true,
  calculationMethod: 'pro_rata',
  paymentTime: 'year_end',
  fallbackAllocation: 'reserve_fund',
};

export const ExitedMemberSHUSettings = () => {
  const [settings, setSettings] = useState<ExitedMemberSHUSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', [
          'exited_member_shu_enabled',
          'exited_member_shu_calculation',
          'exited_member_shu_payment_time',
          'exited_member_shu_fallback'
        ]);

      if (error) throw error;

      const settingsMap = new Map(data?.map(d => [d.key, d.value]));
      
      setSettings({
        enabled: settingsMap.get('exited_member_shu_enabled') === true || settingsMap.get('exited_member_shu_enabled') === 'true',
        calculationMethod: (settingsMap.get('exited_member_shu_calculation') as ExitedMemberSHUSettings['calculationMethod']) || 'pro_rata',
        paymentTime: (settingsMap.get('exited_member_shu_payment_time') as ExitedMemberSHUSettings['paymentTime']) || 'year_end',
        fallbackAllocation: (settingsMap.get('exited_member_shu_fallback') as ExitedMemberSHUSettings['fallbackAllocation']) || 'reserve_fund',
      });
    } catch (error) {
      console.error('Error fetching exited member SHU settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { key: 'exited_member_shu_enabled', value: settings.enabled },
        { key: 'exited_member_shu_calculation', value: settings.calculationMethod },
        { key: 'exited_member_shu_payment_time', value: settings.paymentTime },
        { key: 'exited_member_shu_fallback', value: settings.fallbackAllocation },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('cooperative_settings')
          .upsert(
            { key: update.key, value: update.value as any, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          );
        if (error) throw error;
      }

      toast.success('Pengaturan SHU anggota keluar berhasil disimpan');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            <span>Memuat pengaturan...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Toggle Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Pengaturan SHU Anggota Keluar
          </CardTitle>
          <CardDescription>
            Atur bagaimana SHU diberikan kepada anggota yang keluar di tengah tahun buku
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
            <div className="space-y-1">
              <Label className="text-base font-medium">Berikan SHU untuk Anggota Keluar</Label>
              <p className="text-sm text-muted-foreground">
                {settings.enabled 
                  ? 'Anggota yang keluar di tahun buku berjalan tetap berhak mendapat SHU'
                  : 'Anggota yang keluar tidak mendapat SHU tahun tersebut'}
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
            />
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {settings.enabled ? (
              <Badge variant="default" className="gap-1 bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
                <CheckCircle2 className="h-3 w-3" />
                SHU Aktif untuk Anggota Keluar
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                SHU Tidak Diberikan untuk Anggota Keluar
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Calculation Method Card - Only show if enabled */}
      {settings.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" />
              Metode Perhitungan SHU
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cara Menghitung Proporsi SHU</Label>
              <Select
                value={settings.calculationMethod}
                onValueChange={(value: ExitedMemberSHUSettings['calculationMethod']) => 
                  setSettings(prev => ({ ...prev, calculationMethod: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro_rata">
                    <div className="flex flex-col">
                      <span className="font-medium">Pro-rata Berdasarkan Bulan Aktif</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="full">
                    <div className="flex flex-col">
                      <span className="font-medium">Full SHU (Jika Pernah Aktif)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="at_exit">
                    <div className="flex flex-col">
                      <span className="font-medium">Berdasarkan Saldo Saat Keluar</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Method Description */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground">
                  {settings.calculationMethod === 'pro_rata' && (
                    <p>
                      SHU dihitung proporsional berdasarkan berapa bulan anggota aktif di tahun tersebut.
                      <br />
                      <strong>Contoh:</strong> Anggota aktif 6 bulan = 50% dari proporsi SHU normalnya.
                    </p>
                  )}
                  {settings.calculationMethod === 'full' && (
                    <p>
                      Anggota tetap mendapat SHU penuh berdasarkan total simpanan dan jasa pinjaman 
                      selama masih tercatat aktif di tahun tersebut.
                    </p>
                  )}
                  {settings.calculationMethod === 'at_exit' && (
                    <p>
                      SHU dihitung berdasarkan saldo simpanan dan total bunga pinjaman yang sudah 
                      dibayar sampai tanggal keluar.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Time Card - Only show if enabled */}
      {settings.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Waktu Pembayaran SHU
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Kapan SHU Dibayarkan</Label>
              <Select
                value={settings.paymentTime}
                onValueChange={(value: ExitedMemberSHUSettings['paymentTime']) => 
                  setSettings(prev => ({ ...prev, paymentTime: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_resignation">
                    <span className="font-medium">Saat Pengunduran Diri Disetujui</span>
                  </SelectItem>
                  <SelectItem value="year_end">
                    <span className="font-medium">Setelah Tutup Buku Tahunan</span>
                  </SelectItem>
                  <SelectItem value="after_rat">
                    <span className="font-medium">Ditahan Sampai RAT</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Time Description */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground">
                  {settings.paymentTime === 'on_resignation' && (
                    <p>
                      SHU langsung dihitung estimasi dan dibayarkan bersama refund simpanan 
                      saat pengunduran diri disetujui.
                      <br />
                      <strong>Catatan:</strong> Nilai bersifat estimasi karena tutup buku belum dilakukan.
                    </p>
                  )}
                  {settings.paymentTime === 'year_end' && (
                    <p>
                      SHU baru dibayarkan setelah penutupan buku tahunan selesai dan distribusi 
                      SHU dikonfirmasi. Anggota keluar akan dicatat untuk pembayaran nanti.
                    </p>
                  )}
                  {settings.paymentTime === 'after_rat' && (
                    <p>
                      SHU ditahan dan baru dibayarkan setelah Rapat Anggota Tahunan (RAT) 
                      menyetujui distribusi SHU.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fallback Allocation Card - Only show if disabled */}
      {!settings.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Alokasi SHU Anggota Keluar
            </CardTitle>
            <CardDescription>
              Karena SHU tidak diberikan kepada anggota keluar, tentukan kemana bagian SHU mereka dialokasikan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Alokasi Bagian SHU</Label>
              <Select
                value={settings.fallbackAllocation}
                onValueChange={(value: ExitedMemberSHUSettings['fallbackAllocation']) => 
                  setSettings(prev => ({ ...prev, fallbackAllocation: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reserve_fund">
                    <span className="font-medium">Masuk Dana Cadangan</span>
                  </SelectItem>
                  <SelectItem value="redistribute">
                    <span className="font-medium">Dibagi ke Anggota Aktif</span>
                  </SelectItem>
                  <SelectItem value="forfeited">
                    <span className="font-medium">Hangus (Tidak Dialokasikan)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fallback Description */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground">
                  {settings.fallbackAllocation === 'reserve_fund' && (
                    <p>
                      Bagian SHU yang seharusnya untuk anggota keluar akan masuk ke dana cadangan koperasi
                      untuk memperkuat modal dan cadangan.
                    </p>
                  )}
                  {settings.fallbackAllocation === 'redistribute' && (
                    <p>
                      Bagian SHU anggota keluar akan didistribusikan ulang kepada anggota yang masih aktif
                      secara proporsional.
                    </p>
                  )}
                  {settings.fallbackAllocation === 'forfeited' && (
                    <p>
                      Bagian SHU tersebut tidak dialokasikan ke manapun dan tidak masuk dalam perhitungan
                      distribusi SHU.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </Button>
      </div>
    </div>
  );
};
