import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Loader2, Users, Link2, KeyRound, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { readExcelFile as readExcel, createTemplateExcel } from '@/lib/excelUtils';

type ClaimMethod = 'magic_link' | 'password_change' | 'pending';

interface MemberData {
  name: string;
  email: string;
  phone?: string;
  nik?: string;
  address?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  bank_name?: string;
  simpanan_pokok: number;
  simpanan_wajib: number;
  simpanan_sukarela: number;
  gender?: string;
  birth_date?: string;
  birth_place?: string;
  occupation?: string;
  join_date?: string;
  member_number?: string;
}

interface ValidationResult {
  row: number;
  data: MemberData;
  valid: boolean;
  errors: string[];
}

interface ImportResult {
  success: { email: string; name: string; member_number: string; claim_url?: string }[];
  failed: { email: string; name: string; error: string }[];
}

export default function BulkMemberImport() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<MemberData[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult | null>(null);
  const [claimMethod, setClaimMethod] = useState<ClaimMethod>('password_change');
  const [defaultPassword, setDefaultPassword] = useState(''); // SECURITY: No default password - must be set by admin
  const [sendEmailNotification, setSendEmailNotification] = useState(false);

  const downloadTemplate = async () => {
    const templateData = [
      {
        'Nama Lengkap': 'John Doe',
        'Email': 'john@example.com',
        'No. HP': '08123456789',
        'NIK': '1234567890123456',
        'Alamat': 'Jl. Contoh No. 123',
        'No. Rekening': '1234567890',
        'Nama Bank': 'BCA',
        'Nama Pemilik Rekening': 'John Doe',
        'Jenis Kelamin': 'Laki-laki',
        'Tanggal Lahir': '1990-01-15',
        'Tempat Lahir': 'Jakarta',
        'Pekerjaan': 'Karyawan Swasta',
        'Tanggal Bergabung': '2024-01-15',
        'No. Anggota Lama': '', // Opsional - kosongkan jika ingin auto-generate
        'Simpanan Pokok': 100000,
        'Simpanan Wajib': 50000,
        'Simpanan Sukarela': 0,
      },
    ];

    const columnWidths = [20, 25, 15, 20, 30, 15, 12, 20, 12, 12, 15, 18, 18, 15, 15, 18];
    
    await createTemplateExcel(templateData, 'Template Anggota', 'template_import_anggota.xlsx', columnWidths);
    toast.success('Template berhasil diunduh');
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsValidating(true);

    try {
      const jsonData = await readExcel(uploadedFile);
      const data = transformExcelData(jsonData);
      setParsedData(data);
      
      const results = validateData(data);
      setValidationResults(results);
      setShowPreview(true);
    } catch (error) {
      toast.error('Gagal membaca file Excel');
      console.error(error);
    } finally {
      setIsValidating(false);
    }
  }, []);

  const transformExcelData = (jsonData: any[]): MemberData[] => {
    return jsonData.map((row: any) => ({
      name: row['Nama Lengkap'] || '',
      email: row['Email'] || '',
      phone: row['No. HP'] || '',
      nik: row['NIK']?.toString() || '',
      address: row['Alamat'] || '',
      bank_account_number: row['No. Rekening']?.toString() || '',
      bank_name: row['Nama Bank'] || '',
      bank_account_name: row['Nama Pemilik Rekening'] || '',
      gender: row['Jenis Kelamin'] === 'Laki-laki' ? 'male' : row['Jenis Kelamin'] === 'Perempuan' ? 'female' : '',
      birth_date: row['Tanggal Lahir'] || '',
      birth_place: row['Tempat Lahir'] || '',
      occupation: row['Pekerjaan'] || '',
      join_date: row['Tanggal Bergabung'] || '',
      member_number: row['No. Anggota Lama']?.toString().trim() || undefined,
      simpanan_pokok: parseFloat(row['Simpanan Pokok']) || 0,
      simpanan_wajib: parseFloat(row['Simpanan Wajib']) || 0,
      simpanan_sukarela: parseFloat(row['Simpanan Sukarela']) || 0,
    }));
  };

  const validateData = (data: MemberData[]): ValidationResult[] => {
    const emailSet = new Set<string>();
    const nikSet = new Set<string>();

    return data.map((item, index) => {
      const errors: string[] = [];

      // Required fields
      if (!item.name?.trim()) {
        errors.push('Nama wajib diisi');
      }
      if (!item.email?.trim()) {
        errors.push('Email wajib diisi');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
        errors.push('Format email tidak valid');
      } else if (emailSet.has(item.email.toLowerCase())) {
        errors.push('Email duplikat dalam file');
      } else {
        emailSet.add(item.email.toLowerCase());
      }

      // NIK validation (optional but if provided must be valid)
      if (item.nik && item.nik.length !== 16) {
        errors.push('NIK harus 16 digit');
      } else if (item.nik && nikSet.has(item.nik)) {
        errors.push('NIK duplikat dalam file');
      } else if (item.nik) {
        nikSet.add(item.nik);
      }

      // Phone validation
      if (item.phone && !/^(08|\+62)[0-9]{8,12}$/.test(item.phone.replace(/\s/g, ''))) {
        errors.push('Format No. HP tidak valid');
      }

      return {
        row: index + 2, // Excel rows start at 1, plus header
        data: item,
        valid: errors.length === 0,
        errors,
      };
    });
  };

  const handleImport = async () => {
    const validMembers = validationResults.filter(r => r.valid).map(r => r.data);
    
    if (validMembers.length === 0) {
      toast.error('Tidak ada data valid untuk diimport');
      return;
    }

    // Validate password for password_change method
    if (claimMethod === 'password_change' && (!defaultPassword || defaultPassword.length < 6)) {
      toast.error('Password default minimal 6 karakter');
      return;
    }

    setIsImporting(true);
    setShowPreview(false);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Anda harus login sebagai admin');
        return;
      }

      const { data, error } = await supabase.functions.invoke('bulk-create-members', {
        body: {
          members: validMembers,
          send_email: sendEmailNotification || claimMethod === 'magic_link',
          default_password: claimMethod === 'password_change' ? defaultPassword : undefined,
          claim_method: claimMethod,
          admin_user_id: userData.user.id,
        },
      });

      if (error) throw error;

      setImportResults(data.results);
      setShowResults(true);
      
      if (data.results.failed.length === 0) {
        toast.success(`${data.results.success.length} anggota berhasil diimport`);
      } else {
        toast.warning(`${data.results.success.length} berhasil, ${data.results.failed.length} gagal`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Gagal melakukan import');
    } finally {
      setIsImporting(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setParsedData([]);
    setValidationResults([]);
    setShowPreview(false);
    setShowResults(false);
    setImportResults(null);
  };

  const validCount = validationResults.filter(r => r.valid).length;
  const invalidCount = validationResults.filter(r => !r.valid).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Import Anggota Massal
          </CardTitle>
          <CardDescription>
            Upload file Excel untuk membuat akun anggota secara massal. Setiap anggota akan mendapatkan akun login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Download Template */}
          <div className="space-y-2">
            <h3 className="font-medium">Langkah 1: Unduh Template</h3>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Unduh Template Excel
            </Button>
            <p className="text-sm text-muted-foreground">
              Isi template dengan data anggota yang akan diimport. Simpanan awal akan otomatis dicatat.
            </p>
          </div>

          {/* Step 2: Upload File */}
          <div className="space-y-2">
            <h3 className="font-medium">Langkah 2: Upload File</h3>
            <div className="flex items-center gap-4">
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  <span>Pilih File Excel</span>
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isValidating || isImporting}
                />
              </Label>
              {file && (
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{file.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Metode Aktivasi Akun */}
          <div className="space-y-4">
            <h3 className="font-medium">Langkah 3: Metode Aktivasi Akun</h3>
            <p className="text-sm text-muted-foreground">
              Pilih bagaimana anggota baru akan mengakses akun mereka
            </p>
            
            <RadioGroup value={claimMethod} onValueChange={(v) => setClaimMethod(v as ClaimMethod)} className="space-y-3">
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="password_change" id="password_change" className="mt-1" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    <Label htmlFor="password_change" className="font-medium cursor-pointer">
                      Password Default + Wajib Ganti
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Anggota login dengan password default dan wajib menggantinya saat pertama kali login.
                    Cocok untuk migrasi data lama.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="magic_link" id="magic_link" className="mt-1" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    <Label htmlFor="magic_link" className="font-medium cursor-pointer">
                      Magic Link (Link Klaim)
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Kirim link unik ke email anggota untuk verifikasi dan buat password sendiri.
                    Lebih aman karena anggota memverifikasi email mereka.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="pending" id="pending" className="mt-1" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <Label htmlFor="pending" className="font-medium cursor-pointer">
                      Menunggu Konfirmasi Admin
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Simpan data anggota dan aktifkan akun nanti secara manual.
                    Berguna jika perlu verifikasi data lebih lanjut.
                  </p>
                </div>
              </div>
            </RadioGroup>
            
            {claimMethod === 'password_change' && (
              <div className="space-y-2 mt-4 p-4 bg-muted/50 rounded-lg">
                <Label htmlFor="default-password">Password Default *</Label>
                <Input
                  id="default-password"
                  type="password"
                  value={defaultPassword}
                  onChange={(e) => setDefaultPassword(e.target.value)}
                  placeholder="Masukkan password (min 6 karakter)"
                  className={!defaultPassword || defaultPassword.length < 6 ? 'border-amber-500' : ''}
                />
                <p className="text-xs text-muted-foreground">
                  Anggota akan diminta mengganti password ini saat login pertama kali.
                  Password minimal 6 karakter.
                </p>
                {defaultPassword && defaultPassword.length < 6 && (
                  <p className="text-xs text-amber-600">Password minimal 6 karakter</p>
                )}
              </div>
            )}
            
            {claimMethod === 'magic_link' && (
              <Alert className="mt-4">
                <Link2 className="h-4 w-4" />
                <AlertDescription>
                  Email dengan link klaim akan dikirim ke setiap anggota. Link berlaku selama 3 hari (72 jam).
                  Pastikan email anggota valid dan dapat menerima email.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {isValidating && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Memvalidasi data...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Preview Data Import</DialogTitle>
            <DialogDescription>
              Periksa data sebelum melakukan import. Data yang tidak valid akan dilewati.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4 mb-4">
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {validCount} Valid
            </Badge>
            <Badge variant="destructive" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {invalidCount} Tidak Valid
            </Badge>
          </div>

          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Baris</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Simpanan Pokok</TableHead>
                  <TableHead>Simpanan Wajib</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validationResults.map((result) => (
                  <TableRow key={result.row} className={result.valid ? '' : 'bg-red-50 dark:bg-red-900/10'}>
                    <TableCell>{result.row}</TableCell>
                    <TableCell>
                      {result.valid ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </TableCell>
                    <TableCell>{result.data.name}</TableCell>
                    <TableCell>{result.data.email}</TableCell>
                    <TableCell>Rp {result.data.simpanan_pokok.toLocaleString('id-ID')}</TableCell>
                    <TableCell>Rp {result.data.simpanan_wajib.toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-sm text-red-600">
                      {result.errors.join(', ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {invalidCount > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {invalidCount} data tidak valid dan akan dilewati saat import.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Batal
            </Button>
            <Button onClick={handleImport} disabled={validCount === 0 || isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Mengimport...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {validCount} Anggota
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Hasil Import</DialogTitle>
            <DialogDescription>
              Berikut hasil proses import anggota.
            </DialogDescription>
          </DialogHeader>

          {importResults && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {importResults.success.length} Berhasil
                </Badge>
                <Badge variant="destructive" className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {importResults.failed.length} Gagal
                </Badge>
              </div>

              {importResults.success.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-green-600">Berhasil Dibuat:</h4>
                  <ScrollArea className="h-[150px] border rounded-md p-2">
                    <ul className="text-sm space-y-1">
                      {importResults.success.map((item, idx) => (
                        <li key={idx}>
                          ✓ {item.name} ({item.email}) - No. Anggota: {item.member_number}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}

              {importResults.failed.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-red-600">Gagal Dibuat:</h4>
                  <ScrollArea className="h-[150px] border rounded-md p-2">
                    <ul className="text-sm space-y-1">
                      {importResults.failed.map((item, idx) => (
                        <li key={idx}>
                          ✗ {item.name} ({item.email}) - {item.error}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}

              {claimMethod === 'password_change' && importResults.success.length > 0 && (
                <Alert>
                  <KeyRound className="h-4 w-4" />
                  <AlertDescription>
                    Password default untuk semua anggota baru: <strong>{defaultPassword}</strong>
                    <br />
                    Anggota akan diminta mengganti password saat login pertama.
                  </AlertDescription>
                </Alert>
              )}
              
              {claimMethod === 'magic_link' && importResults.success.length > 0 && (
                <Alert>
                  <Link2 className="h-4 w-4" />
                  <AlertDescription>
                    Email dengan link klaim telah dikirim ke semua anggota yang berhasil dibuat.
                    Link berlaku selama 7 hari.
                  </AlertDescription>
                </Alert>
              )}
              
              {claimMethod === 'pending' && importResults.success.length > 0 && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Data anggota telah disimpan. Anda dapat mengaktifkan akun mereka kapan saja dari menu Data Anggota.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={resetForm}>
              Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
