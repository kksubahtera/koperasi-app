import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Calendar as CalendarIcon, User, Phone, Mail, MapPin, Building2, Briefcase, IdCard } from 'lucide-react';
import { User as UserType } from '@/lib/types';
import { CooperativeSettingsService } from '@/lib/database';
import { useBranches, CooperativeBranch } from '@/hooks/useBranches';

interface MemberEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: UserType;
  onSuccess: () => void;
}

interface MemberFormData {
  name: string;
  nik: string;
  phone: string;
  email: string;
  address: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  birthPlace: string;
  birthDate: string;
  gender: 'male' | 'female' | '';
  occupation: string;
  branchId: string;
}

const DEFAULT_BANK_OPTIONS = ['BCA', 'Mandiri', 'BRI', 'BNI', 'CIMB', 'OCBC', 'BSI', 'Permata', 'Danamon', 'Maybank'];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
];

export const MemberEditDialog = ({ open, onOpenChange, member, onSuccess }: MemberEditDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [birthDateOpen, setBirthDateOpen] = useState(false);
  const [availableBanks, setAvailableBanks] = useState<string[]>(DEFAULT_BANK_OPTIONS);
  const { activeBranches, branchFeatureEnabled, getBranchById } = useBranches();
  const [formData, setFormData] = useState<MemberFormData>({
    name: '',
    nik: '',
    phone: '',
    email: '',
    address: '',
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: '',
    birthPlace: '',
    birthDate: '',
    gender: '',
    occupation: '',
    branchId: '',
  });

  // Fetch member data and bank settings when dialog opens
  useEffect(() => {
    if (open && member) {
      fetchMemberData();
      fetchBankSettings();
    }
  }, [open, member]);

  const fetchBankSettings = async () => {
    try {
      const settings = await CooperativeSettingsService.getSetting('available_banks');
      if (Array.isArray(settings)) {
        setAvailableBanks(settings);
      }
    } catch (error) {
      console.error('Error fetching bank settings:', error);
    }
  };

  const fetchMemberData = async () => {
    setIsFetching(true);
    try {
      // Fetch profile with decrypted NIK using RPC
      const { data, error } = await supabase
        .rpc('get_profile_with_nik', { p_user_id: member.id })
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name || '',
          nik: data.nik || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          bankName: data.bank_name || '',
          bankAccountNumber: data.bank_account_number || '',
          bankAccountName: data.bank_account_name || '',
          birthPlace: data.birth_place || '',
          birthDate: data.birth_date || '',
          gender: (data.gender as 'male' | 'female') || '',
          occupation: data.occupation || '',
          branchId: data.branch_id || '',
        });
      }
    } catch (error) {
      console.error('Error fetching member data:', error);
      // Use existing member data as fallback (without NIK for security)
      setFormData({
        name: member.name || '',
        nik: '',
        phone: member.phone || '',
        email: member.email || '',
        address: member.address || '',
        bankName: '',
        bankAccountNumber: member.bankAccountNumber || '',
        bankAccountName: member.bankAccountName || '',
        birthPlace: '',
        birthDate: '',
        gender: '',
        occupation: '',
        branchId: '',
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleChange = (field: keyof MemberFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nama lengkap wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      // Update profile without NIK (NIK is encrypted separately)
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          phone: formData.phone || null,
          email: formData.email,
          address: formData.address || null,
          bank_name: formData.bankName || null,
          bank_account_number: formData.bankAccountNumber || null,
          bank_account_name: formData.bankAccountName || null,
          birth_place: formData.birthPlace || null,
          birth_date: formData.birthDate || null,
          gender: formData.gender || null,
          occupation: formData.occupation || null,
          branch_id: formData.branchId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', member.id);

      if (error) throw error;

      // Update NIK separately via RPC if changed
      if (formData.nik) {
        const { error: nikError } = await supabase
          .rpc('update_member_nik', { p_user_id: member.id, p_nik: formData.nik });
        
        if (nikError) {
          console.error('Error updating NIK:', nikError);
          // Don't fail the whole update if NIK encryption fails
        }
      }

      toast.success('Data anggota berhasil diperbarui');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating member:', error);
      toast.error(`Gagal memperbarui data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getGenderLabel = (value: string) => {
    return GENDER_OPTIONS.find(opt => opt.value === value)?.label || '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Data Anggota
          </DialogTitle>
        </DialogHeader>

        {isFetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Memuat data...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nama Lengkap */}
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Nama Lengkap <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Masukkan nama lengkap"
              />
            </div>

            {/* NIK */}
            <div className="space-y-2">
              <Label htmlFor="nik" className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-muted-foreground" />
                NIK
              </Label>
              <Input
                id="nik"
                value={formData.nik}
                onChange={(e) => handleChange('nik', e.target.value.replace(/\D/g, '').slice(0, 16))}
                placeholder="16 digit NIK"
                maxLength={16}
              />
            </div>

            {/* Tempat & Tanggal Lahir */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthPlace">Tempat Lahir</Label>
                <Input
                  id="birthPlace"
                  value={formData.birthPlace}
                  onChange={(e) => handleChange('birthPlace', e.target.value)}
                  placeholder="Kota/Kabupaten"
                />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Lahir</Label>
                <Popover open={birthDateOpen} onOpenChange={setBirthDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.birthDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.birthDate
                        ? format(new Date(formData.birthDate), "dd MMM yyyy", { locale: localeId })
                        : "Pilih tanggal"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.birthDate ? new Date(formData.birthDate) : undefined}
                      onSelect={(date) => {
                        handleChange('birthDate', date ? format(date, 'yyyy-MM-dd') : '');
                        setBirthDateOpen(false);
                      }}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      captionLayout="dropdown-buttons"
                      fromYear={1940}
                      toYear={new Date().getFullYear()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Jenis Kelamin */}
            <div className="space-y-2">
              <Label>Jenis Kelamin</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => handleChange('gender', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis kelamin" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pekerjaan */}
            <div className="space-y-2">
              <Label htmlFor="occupation" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                Pekerjaan
              </Label>
              <Input
                id="occupation"
                value={formData.occupation}
                onChange={(e) => handleChange('occupation', e.target.value)}
                placeholder="Contoh: Karyawan Swasta"
              />
            </div>

            {/* Cabang/Unit - Only show if feature is enabled */}
            {branchFeatureEnabled && activeBranches.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Cabang/Unit
                </Label>
                <Select
                  value={formData.branchId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, branchId: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih cabang/unit">
                      {formData.branchId && getBranchById(formData.branchId) && (
                        <div className="flex items-center gap-2">
                          <Badge 
                            style={{ backgroundColor: getBranchById(formData.branchId)?.badge_color }}
                            className="text-white text-xs"
                          >
                            {getBranchById(formData.branchId)?.name}
                          </Badge>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada cabang</SelectItem>
                    {activeBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: branch.badge_color }}
                          />
                          {branch.name} ({branch.code})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            {/* Telepon */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Nomor HP
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, ''))}
                placeholder="08xxxxxxxxxx"
              />
            </div>

            {/* Alamat */}
            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Alamat Domisili
              </Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Alamat lengkap"
                rows={3}
              />
            </div>

            {/* Bank Info */}
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Informasi Rekening
              </h4>
              
              <div className="space-y-2">
                <Label>Nama Bank</Label>
                <Select
                  value={formData.bankName}
                  onValueChange={(value) => handleChange('bankName', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBanks.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankAccountNumber">Nomor Rekening</Label>
                <Input
                  id="bankAccountNumber"
                  value={formData.bankAccountNumber}
                  onChange={(e) => handleChange('bankAccountNumber', e.target.value.replace(/\D/g, ''))}
                  placeholder="Nomor rekening"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankAccountName">Nama Pemilik Rekening</Label>
                <Input
                  id="bankAccountName"
                  value={formData.bankAccountName}
                  onChange={(e) => handleChange('bankAccountName', e.target.value.toUpperCase())}
                  placeholder="Nama sesuai rekening"
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Perubahan'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
