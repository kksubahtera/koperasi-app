import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Loader2, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FormData {
  name: string;
  email: string;
  phone: string;
  nik: string;
  address: string;
  bank_account_number: string;
  bank_account_name: string;
  bank_name: string;
  gender: string;
  birth_date: string;
  birth_place: string;
  occupation: string;
  simpanan_pokok: number;
  simpanan_wajib: number;
  simpanan_sukarela: number;
  password: string;
  join_date: string;
  member_number: string; // Nomor anggota manual (opsional)
  use_custom_member_number: boolean;
}

const initialFormData: FormData = {
  name: '',
  email: '',
  phone: '',
  nik: '',
  address: '',
  bank_account_number: '',
  bank_account_name: '',
  bank_name: '',
  gender: '',
  birth_date: '',
  birth_place: '',
  occupation: '',
  simpanan_pokok: 0,
  simpanan_wajib: 0,
  simpanan_sukarela: 0,
  password: '', // SECURITY: No default password - must be set by admin
  join_date: new Date().toISOString().split('T')[0],
  member_number: '',
  use_custom_member_number: false,
};

interface AdminMemberCreationProps {
  onSuccess?: () => void;
}

export default function AdminMemberCreation({ onSuccess }: AdminMemberCreationProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [createdMember, setCreatedMember] = useState<{ name: string; member_number: string; email: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nama wajib diisi';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format email tidak valid';
    }
    if (formData.nik && formData.nik.length !== 16) {
      newErrors.nik = 'NIK harus 16 digit';
    }
    if (formData.phone && !/^(08|\+62)[0-9]{8,12}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Format No. HP tidak valid';
    }
    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'Password minimal 6 karakter';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const sendCredentialsEmail = async (memberName: string, memberNumber: string, email: string, password: string) => {
    try {
      setIsSendingEmail(true);
      
      // Get cooperative name from settings
      const { data: settingsData } = await supabase
        .from('cooperative_settings')
        .select('value')
        .eq('key', 'cooperativeName')
        .maybeSingle();
      
      const cooperativeName = settingsData?.value as string || 'Koperasi';
      
      const { error } = await supabase.functions.invoke('send-member-credentials', {
        body: {
          member_name: memberName,
          member_number: memberNumber,
          email: email,
          password: password,
          cooperative_name: cooperativeName,
        },
      });

      if (error) throw error;
      
      toast.success('Email kredensial berhasil dikirim');
      return true;
    } catch (error) {
      console.error('Error sending credentials email:', error);
      toast.error('Gagal mengirim email kredensial');
      return false;
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Mohon lengkapi data yang diperlukan');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Anda harus login sebagai admin');
        return;
      }

      const { data, error } = await supabase.functions.invoke('bulk-create-members', {
        body: {
          members: [{
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            nik: formData.nik,
            address: formData.address,
            bank_account_number: formData.bank_account_number,
            bank_account_name: formData.bank_account_name,
            bank_name: formData.bank_name,
            gender: formData.gender,
            birth_date: formData.birth_date,
            birth_place: formData.birth_place,
            occupation: formData.occupation,
            simpanan_pokok: formData.simpanan_pokok,
            simpanan_wajib: formData.simpanan_wajib,
            simpanan_sukarela: formData.simpanan_sukarela,
            join_date: formData.join_date,
            member_number: formData.use_custom_member_number && formData.member_number.trim() 
              ? formData.member_number.trim() 
              : undefined,
          }],
          send_email: false,
          default_password: formData.password,
          admin_user_id: userData.user.id,
        },
      });

      if (error) throw error;

      if (data.results.success.length > 0) {
        const created = data.results.success[0];
        setCreatedMember({
          name: created.name,
          member_number: created.member_number,
          email: created.email,
        });
        toast.success('Anggota berhasil dibuat');
        
        // Send credentials email if enabled
        if (sendEmail) {
          await sendCredentialsEmail(
            created.name,
            created.member_number,
            created.email,
            formData.password
          );
        }
        
        setFormData(initialFormData);
        onSuccess?.();
      } else if (data.results.failed.length > 0) {
        toast.error(data.results.failed[0].error);
      }
    } catch (error) {
      console.error('Error creating member:', error);
      toast.error('Gagal membuat anggota');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | number | boolean) => {
    if (field === 'use_custom_member_number') {
      setFormData(prev => ({ ...prev, use_custom_member_number: value === true || value === 'true' }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Tambah Anggota Baru
          </CardTitle>
          <CardDescription>
            Buat akun anggota baru secara manual dengan data lengkap dan simpanan awal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Data Pribadi */}
            <div>
              <h3 className="font-medium mb-4">Data Pribadi</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Lengkap *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="email@example.com"
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">No. HP</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className={errors.phone ? 'border-red-500' : ''}
                  />
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nik">NIK</Label>
                  <Input
                    id="nik"
                    value={formData.nik}
                    onChange={(e) => handleInputChange('nik', e.target.value)}
                    placeholder="16 digit NIK"
                    maxLength={16}
                    className={errors.nik ? 'border-red-500' : ''}
                  />
                  {errors.nik && <p className="text-xs text-red-500">{errors.nik}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Jenis Kelamin</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => handleInputChange('gender', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis kelamin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Laki-laki</SelectItem>
                      <SelectItem value="female">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birth_date">Tanggal Lahir</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => handleInputChange('birth_date', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birth_place">Tempat Lahir</Label>
                  <Input
                    id="birth_place"
                    value={formData.birth_place}
                    onChange={(e) => handleInputChange('birth_place', e.target.value)}
                    placeholder="Kota kelahiran"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="occupation">Pekerjaan</Label>
                  <Input
                    id="occupation"
                    value={formData.occupation}
                    onChange={(e) => handleInputChange('occupation', e.target.value)}
                    placeholder="Pekerjaan saat ini"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="join_date">Tanggal Bergabung</Label>
                  <Input
                    id="join_date"
                    type="date"
                    value={formData.join_date}
                    onChange={(e) => handleInputChange('join_date', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Untuk anggota lama, isi dengan tanggal bergabung asli
                  </p>
                </div>

                {/* Custom Member Number Option */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="use_custom_member_number" 
                      checked={formData.use_custom_member_number}
                      onCheckedChange={(checked) => handleInputChange('use_custom_member_number', checked === true ? 'true' : '')}
                    />
                    <Label htmlFor="use_custom_member_number" className="text-sm font-normal cursor-pointer">
                      Gunakan nomor anggota lama (manual)
                    </Label>
                  </div>
                  {formData.use_custom_member_number && (
                    <div className="mt-2">
                      <Input
                        id="member_number"
                        value={formData.member_number}
                        onChange={(e) => handleInputChange('member_number', e.target.value)}
                        placeholder="Contoh: ANG-20230101-0001"
                        className={errors.member_number ? 'border-red-500' : ''}
                      />
                      {errors.member_number && <p className="text-xs text-red-500">{errors.member_number}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        Masukkan nomor anggota dari sistem lama
                      </p>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="address">Alamat</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Alamat lengkap"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Data Rekening */}
            <div>
              <h3 className="font-medium mb-4">Data Rekening Bank</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Nama Bank</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => handleInputChange('bank_name', e.target.value)}
                    placeholder="BCA, BRI, dll"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">No. Rekening</Label>
                  <Input
                    id="bank_account_number"
                    value={formData.bank_account_number}
                    onChange={(e) => handleInputChange('bank_account_number', e.target.value)}
                    placeholder="Nomor rekening"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_account_name">Nama Pemilik Rekening</Label>
                  <Input
                    id="bank_account_name"
                    value={formData.bank_account_name}
                    onChange={(e) => handleInputChange('bank_account_name', e.target.value)}
                    placeholder="Sesuai rekening"
                  />
                </div>
              </div>
            </div>

            {/* Simpanan Awal */}
            <div>
              <h3 className="font-medium mb-4">Simpanan Awal (Migrasi)</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="simpanan_pokok">Simpanan Pokok</Label>
                  <CurrencyInput
                    id="simpanan_pokok"
                    value={formData.simpanan_pokok}
                    onChange={(value) => handleInputChange('simpanan_pokok', value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="simpanan_wajib">Simpanan Wajib</Label>
                  <CurrencyInput
                    id="simpanan_wajib"
                    value={formData.simpanan_wajib}
                    onChange={(value) => handleInputChange('simpanan_wajib', value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="simpanan_sukarela">Simpanan Sukarela</Label>
                  <CurrencyInput
                    id="simpanan_sukarela"
                    value={formData.simpanan_sukarela}
                    onChange={(value) => handleInputChange('simpanan_sukarela', value)}
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <h3 className="font-medium mb-4">Kredensial Login</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="text"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Password minimal 6 karakter"
                    className={errors.password ? 'border-red-500' : ''}
                  />
                  {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                  <p className="text-xs text-muted-foreground">
                    Anggota disarankan mengganti password setelah login pertama
                  </p>
                </div>
                
                <div className="flex items-center space-x-2 mt-6">
                  <Checkbox 
                    id="sendEmail" 
                    checked={sendEmail}
                    onCheckedChange={(checked) => setSendEmail(checked === true)}
                  />
                  <Label htmlFor="sendEmail" className="text-sm font-normal cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Kirim kredensial via email
                    </div>
                  </Label>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting || isSendingEmail} className="w-full md:w-auto">
              {isSubmitting || isSendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isSendingEmail ? 'Mengirim Email...' : 'Membuat Anggota...'}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Buat Anggota
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Success Message */}
      {createdMember && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <p className="font-medium text-green-800 dark:text-green-200">
              Anggota berhasil dibuat!
            </p>
            <ul className="mt-2 text-sm text-green-700 dark:text-green-300">
              <li>Nama: {createdMember.name}</li>
              <li>No. Anggota: {createdMember.member_number}</li>
              <li>Email: {createdMember.email}</li>
              <li>Password: {formData.password || 'koperasi123'}</li>
            </ul>
            {sendEmail && (
              <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email kredensial telah dikirim ke anggota
              </p>
            )}
            {!sendEmail && (
              <p className="mt-2 text-xs">
                Informasikan kredensial ini kepada anggota baru.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
