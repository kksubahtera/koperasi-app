import { Building2, Clock, Phone, Wallet, AlertCircle, Copy, Check, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/mockData';
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { CooperativeSettingsService } from '@/lib/database';

interface PendingApprovalScreenProps {
  onLogout: () => void;
  userName?: string;
}

interface CoopInfo {
  name: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  contactPhone: string;
  simpananPokok: number;
  simpananWajib: number;
}

export const PendingApprovalScreen = ({ onLogout, userName }: PendingApprovalScreenProps) => {
  const [coopInfo, setCoopInfo] = useState<CoopInfo>({
    name: 'Koperasi',
    bankName: 'BCA',
    bankAccountNumber: '',
    bankAccountName: '',
    contactPhone: '',
    simpananPokok: 500000,
    simpananWajib: 100000,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [understood, setUnderstood] = useState(false);

  const handleCopy = async (value: string, field: string, label: string) => {
    if (value && value !== '-') {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedField(field);
        toast({
          title: 'Berhasil Disalin',
          description: `${label} telah disalin ke clipboard`,
        });
        setTimeout(() => setCopiedField(null), 2000);
      } catch (err) {
        toast({
          title: 'Gagal Menyalin',
          description: `Tidak dapat menyalin ${label.toLowerCase()}`,
          variant: 'destructive',
        });
      }
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const settingsData = await CooperativeSettingsService.getMultipleSettings([
          'cooperative_name',
          'bank_name', 
          'bank_account_number', 
          'bank_account_name', 
          'contact_phone',
          'simpanan_pokok',
          'simpanan_wajib',
        ]);
        
        setCoopInfo({
          name: settingsData['cooperative_name'] || 'Koperasi Sejahtera Bersama',
          bankName: settingsData['bank_name'] || 'BCA',
          bankAccountNumber: settingsData['bank_account_number'] || '',
          bankAccountName: settingsData['bank_account_name'] || settingsData['cooperative_name'] || 'Koperasi Sejahtera Bersama',
          contactPhone: settingsData['contact_phone'] || '',
          simpananPokok: Number(settingsData['simpanan_pokok']) || 500000,
          simpananWajib: Number(settingsData['simpanan_wajib']) || 100000,
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalInitialDeposit = coopInfo.simpananPokok + coopInfo.simpananWajib;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 gradient-hero" />
      
      {/* Animated Orbs */}
      <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse-slow" />
      <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Header Icon */}
        <div className="animate-scale-in text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 shadow-xl backdrop-blur-sm">
            <Clock className="h-10 w-10 text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Menunggu Persetujuan
          </h1>
          {userName && (
            <p className="mt-2 text-lg text-white/80">
              Halo, {userName}!
            </p>
          )}
        </div>

        {/* Info Card */}
        <Card className="mt-14 sm:mt-16 w-full max-w-md animate-fade-in bg-white/95 backdrop-blur-sm" style={{ animationDelay: '0.2s' }}>
          <CardContent className="p-4 sm:p-6 space-y-5 sm:space-y-6">
            {/* Status */}
            <div className="flex items-start gap-3 rounded-lg bg-warning/10 border border-warning/30 p-3 sm:p-4 mt-2 sm:mt-3">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground text-sm sm:text-base">
                  Akun Anda Sedang Ditinjau
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Silakan transfer simpanan awal untuk mengaktifkan akun
                </p>
              </div>
            </div>

            {/* Transfer Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Simpanan Awal yang Harus Dibayar
              </h3>
              
              <div className="space-y-2 rounded-lg bg-muted/50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Simpanan Pokok</span>
                  <span className="font-medium">{formatCurrency(coopInfo.simpananPokok)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Simpanan Wajib (1 bulan)</span>
                  <span className="font-medium">{formatCurrency(coopInfo.simpananWajib)}</span>
                </div>
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Transfer</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary text-lg">{formatCurrency(totalInitialDeposit)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleCopy(totalInitialDeposit.toString(), 'total', 'Total transfer')}
                      >
                        {copiedField === 'total' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Account */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Transfer ke Rekening Koperasi
              </h3>
              
              {isLoading ? (
                <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center">
                  <p className="text-muted-foreground">Memuat...</p>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bank</span>
                    <span className="font-bold text-primary">{coopInfo.bankName}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">No. Rekening</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg">{coopInfo.bankAccountNumber || '-'}</span>
                      {coopInfo.bankAccountNumber && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleCopy(coopInfo.bankAccountNumber, 'account', 'Nomor rekening')}
                        >
                          {copiedField === 'account' ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Atas Nama</span>
                    <span className="font-medium">{coopInfo.bankAccountName || '-'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Contact Info */}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Setelah transfer, kirim bukti pembayaran ke WhatsApp koperasi:
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-bold text-lg">{coopInfo.contactPhone || '-'}</p>
                    {coopInfo.contactPhone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleCopy(coopInfo.contactPhone, 'phone', 'Nomor WhatsApp')}
                      >
                        {copiedField === 'phone' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sertakan nama lengkap Anda dalam pesan
                  </p>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Langkah Selanjutnya:
              </h4>
              <div className="space-y-2">
                {[
                  'Transfer simpanan awal ke rekening di atas',
                  'Kirim bukti transfer ke WhatsApp koperasi',
                  'Admin akan memverifikasi pembayaran Anda',
                  'Setelah disetujui, Anda bisa login sebagai anggota',
                ].map((step, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {index + 1}
                    </div>
                    <span className="text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Understand Checkbox & Button */}
        <div className="mt-6 w-full max-w-md animate-fade-in space-y-4" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-start gap-3 rounded-lg bg-white/10 backdrop-blur-sm p-4">
            <Checkbox 
              id="understood"
              checked={understood}
              onCheckedChange={(checked) => setUnderstood(checked === true)}
              className="mt-0.5 border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-primary"
            />
            <Label htmlFor="understood" className="text-sm leading-relaxed cursor-pointer text-white/90">
              Saya mengerti dan akan mentransfer simpanan awal ke rekening koperasi
            </Label>
          </div>
          
          <Button
            onClick={onLogout}
            variant="splash-outline"
            size="lg"
            className="w-full"
            disabled={!understood}
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            Saya Mengerti
          </Button>
        </div>
      </div>
    </div>
  );
};
