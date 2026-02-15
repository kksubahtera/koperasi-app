import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Link, Upload, Download, CheckCircle, XCircle, 
  AlertCircle, Loader2, FileSpreadsheet, Users, Trash2 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { readExcelFile as readExcelFileUtil, createAndDownloadExcelFromJson } from '@/lib/excelUtils';

interface PendingMemberData {
  id: string;
  name: string;
  nik?: string;
  email?: string;
  phone?: string;
  simpanan_pokok: number;
  simpanan_wajib: number;
  simpanan_sukarela: number;
  has_active_loan: boolean;
  loan_data?: any;
  matched_user_id?: string;
  status: string;
  created_at: string;
}

interface RegisteredMember {
  user_id: string;
  name: string;
  email: string;
  member_number?: string;
  approval_status: string;
}

export default function MigrationDataMatching() {
  const [pendingData, setPendingData] = useState<PendingMemberData[]>([]);
  const [registeredMembers, setRegisteredMembers] = useState<RegisteredMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [selectedPending, setSelectedPending] = useState<PendingMemberData | null>(null);
  const [selectedMember, setSelectedMember] = useState<RegisteredMember | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch pending member data
      const { data: pending, error: pendingError } = await supabase
        .from('pending_member_data')
        .select('*')
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;
      setPendingData(pending || []);

      // Fetch registered members who are approved but might need data matching
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('user_id, name, email, member_number, approval_status')
        .eq('approval_status', 'approved')
        .eq('is_active', true);

      if (membersError) throw membersError;
      setRegisteredMembers(members || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'Nama Lengkap': 'John Doe',
        'NIK': '1234567890123456',
        'Email': 'john@example.com',
        'No. HP': '08123456789',
        'Simpanan Pokok': 100000,
        'Simpanan Wajib': 500000,
        'Simpanan Sukarela': 200000,
        'Punya Pinjaman Aktif': 'Ya',
        'Pokok Pinjaman': 5000000,
        'Sisa Pokok': 3000000,
        'Tenor (Bulan)': 12,
        'Bunga (%)': 2,
        'Tanggal Pencairan (YYYY-MM-DD)': '2024-01-15',
        'Angsuran Sudah Dibayar': 3,
      },
    ];

    createAndDownloadExcelFromJson(
      [{ name: 'Data Anggota Lama', data: templateData }],
      'template_data_anggota_lama.xlsx'
    );
    toast.success('Template berhasil diunduh');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await readExcelFileUtil(file);
      
      // Insert into pending_member_data
      const { data: userData } = await supabase.auth.getUser();
      const batchId = `BATCH-${Date.now()}`;

      const insertData = data.map(row => {
        // Parse disbursement date from Excel
        let disbursementDate = row['Tanggal Pencairan (YYYY-MM-DD)'];
        if (typeof disbursementDate === 'number') {
          // Excel serial date to JS date
          const excelEpoch = new Date(1899, 11, 30);
          const date = new Date(excelEpoch.getTime() + disbursementDate * 24 * 60 * 60 * 1000);
          disbursementDate = date.toISOString().split('T')[0];
        }
        
        return {
          name: row['Nama Lengkap'] || '',
          nik: row['NIK']?.toString() || null,
          email: row['Email'] || null,
          phone: row['No. HP']?.toString() || null,
          simpanan_pokok: parseFloat(row['Simpanan Pokok']) || 0,
          simpanan_wajib: parseFloat(row['Simpanan Wajib']) || 0,
          simpanan_sukarela: parseFloat(row['Simpanan Sukarela']) || 0,
          has_active_loan: row['Punya Pinjaman Aktif']?.toLowerCase() === 'ya',
          loan_data: row['Punya Pinjaman Aktif']?.toLowerCase() === 'ya' ? {
            principal_amount: parseFloat(row['Pokok Pinjaman']) || 0,
            remaining_principal: parseFloat(row['Sisa Pokok']) || 0,
            tenor: parseInt(row['Tenor (Bulan)']) || 12,
            interest_rate: parseFloat(row['Bunga (%)']) || 2,
            disbursement_date: disbursementDate || null,
            paid_installments: parseInt(row['Angsuran Sudah Dibayar']) || 0,
          } : null,
          import_batch_id: batchId,
          status: 'pending',
        };
      });

      const { error } = await supabase
        .from('pending_member_data')
        .insert(insertData);

      if (error) throw error;

      // Log the import
      await supabase.from('member_import_logs').insert({
        import_type: 'pending_data',
        total_rows: data.length,
        success_count: data.length,
        failed_count: 0,
        file_name: file.name,
        performed_by: userData?.user?.id,
      });

      toast.success(`${data.length} data anggota lama berhasil diupload`);
      setShowUploadDialog(false);
      fetchData();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Gagal mengupload file');
    }
  };

  // Using imported readExcelFileUtil from excelUtils instead of local XLSX implementation

  const openMatchDialog = (pending: PendingMemberData) => {
    setSelectedPending(pending);
    setShowMatchDialog(true);
    setSelectedMember(null);
  };

  const handleMatch = async () => {
    if (!selectedPending || !selectedMember) return;

    setIsMatching(true);
    try {
      // Update pending data with matched user
      const { error: updatePendingError } = await supabase
        .from('pending_member_data')
        .update({ 
          matched_user_id: selectedMember.user_id,
          status: 'matched',
        })
        .eq('id', selectedPending.id);

      if (updatePendingError) throw updatePendingError;

      // Create migration transactions (trigger will update savings_summary)
      const now = new Date().toISOString();
      const transactions = [];
      
      if ((selectedPending.simpanan_pokok || 0) > 0) {
        transactions.push({
          user_id: selectedMember.user_id,
          type: 'saldo_awal_pokok' as const,
          amount: selectedPending.simpanan_pokok,
          status: 'approved' as const,
          payment_method: 'transfer_bank' as const,
          notes: 'Saldo awal dari pencocokan data migrasi',
          approved_at: now,
        });
      }
      
      if ((selectedPending.simpanan_wajib || 0) > 0) {
        transactions.push({
          user_id: selectedMember.user_id,
          type: 'saldo_awal_wajib' as const,
          amount: selectedPending.simpanan_wajib,
          status: 'approved' as const,
          payment_method: 'transfer_bank' as const,
          notes: 'Saldo awal dari pencocokan data migrasi',
          approved_at: now,
        });
      }
      
      if ((selectedPending.simpanan_sukarela || 0) > 0) {
        transactions.push({
          user_id: selectedMember.user_id,
          type: 'saldo_awal_sukarela' as const,
          amount: selectedPending.simpanan_sukarela,
          status: 'approved' as const,
          payment_method: 'transfer_bank' as const,
          notes: 'Saldo awal dari pencocokan data migrasi',
          approved_at: now,
        });
      }
      
      if (transactions.length > 0) {
        const { error: savingsError } = await supabase
          .from('transactions')
          .insert(transactions as any);
        
        if (savingsError) throw savingsError;
      }

      // If has active loan, create loan record with correct disbursement date and installments
      if (selectedPending.has_active_loan && selectedPending.loan_data) {
        const loanData = selectedPending.loan_data;
        const disbursementDate = loanData.disbursement_date || new Date().toISOString().split('T')[0];
        const paidInstallments = loanData.paid_installments || 0;
        
        // Insert the loan
        const { data: newLoan, error: loanError } = await supabase
          .from('loans')
          .insert({
            user_id: selectedMember.user_id,
            principal_amount: loanData.principal_amount,
            remaining_principal: loanData.remaining_principal,
            tenor: loanData.tenor,
            interest_rate: loanData.interest_rate / 100,
            status: 'active',
            disbursement_date: disbursementDate,
          })
          .select('id')
          .single();

        if (loanError) {
          console.error('Error creating loan:', loanError);
        } else if (newLoan) {
          // Generate installment schedule with correct paid status and realistic payment dates
          const monthlyPrincipal = loanData.principal_amount / loanData.tenor;
          const monthlyInterest = loanData.principal_amount * (loanData.interest_rate / 100);
          const monthlyTotal = monthlyPrincipal + monthlyInterest;
          const dueDaysInterval = 30; // Default interval
          
          const installments = [];
          for (let i = 1; i <= loanData.tenor; i++) {
            const dueDate = new Date(disbursementDate);
            dueDate.setDate(dueDate.getDate() + (i * dueDaysInterval));
            
            const isPaid = i <= paidInstallments;
            
            // Calculate realistic paid_date for migration (based on due date, not disbursement)
            let paidDate: string | null = null;
            if (isPaid) {
              // Use due date as paid date for historical accuracy
              paidDate = dueDate.toISOString().split('T')[0];
            }
            
            installments.push({
              loan_id: newLoan.id,
              installment_number: i,
              due_date: dueDate.toISOString().split('T')[0],
              principal_amount: monthlyPrincipal,
              interest_amount: monthlyInterest,
              total_amount: monthlyTotal,
              status: isPaid ? 'paid' : 'unpaid',
              paid_amount: isPaid ? monthlyTotal : null,
              paid_date: paidDate,
            });
          }
          
          const { error: installmentError } = await supabase
            .from('loan_installments')
            .insert(installments);
          
          if (installmentError) {
            console.error('Error creating installments:', installmentError);
          }

          // Create journal entry for loan migration (Piutang)
          // This ensures the balance sheet reflects the loan receivable
          try {
            // Get journal entry number
            const { data: entryNumber } = await supabase.rpc('generate_journal_entry_number');
            
            if (entryNumber) {
              // Get account IDs
              const { data: accounts } = await supabase
                .from('chart_of_accounts')
                .select('id, account_code')
                .in('account_code', ['1-2000', '3-9000', '3-0000']);

              const piutangAccount = accounts?.find(a => a.account_code === '1-2000');
              const migrationAccount = accounts?.find(a => a.account_code === '3-9000') || 
                                       accounts?.find(a => a.account_code === '3-0000');

              if (piutangAccount && migrationAccount) {
                // Create journal entry for loan migration
                const { data: journalEntry, error: journalError } = await supabase
                  .from('journal_entries')
                  .insert({
                    entry_number: entryNumber,
                    entry_date: disbursementDate,
                    description: `Migrasi saldo awal pinjaman - ${selectedMember.name || selectedPending.name}`,
                    total_debit: loanData.remaining_principal,
                    total_credit: loanData.remaining_principal,
                    is_balanced: true,
                    status: 'posted',
                    reference_type: 'migration',
                    reference_id: newLoan.id,
                  })
                  .select('id')
                  .single();

                if (!journalError && journalEntry) {
                  // Create journal lines
                  await supabase.from('journal_entry_lines').insert([
                    {
                      journal_entry_id: journalEntry.id,
                      account_id: piutangAccount.id,
                      debit_amount: loanData.remaining_principal,
                      credit_amount: 0,
                      description: `Piutang pinjaman migrasi - ${selectedMember.name || selectedPending.name}`,
                    },
                    {
                      journal_entry_id: journalEntry.id,
                      account_id: migrationAccount.id,
                      debit_amount: 0,
                      credit_amount: loanData.remaining_principal,
                      description: `Modal migrasi saldo awal - ${selectedMember.name || selectedPending.name}`,
                    },
                  ]);
                }
              }
            }
          } catch (journalError) {
            console.error('Error creating loan migration journal:', journalError);
            // Don't fail the whole operation if journal creation fails
          }
        }
      }

      toast.success('Data berhasil dicocokkan');
      setShowMatchDialog(false);
      setSelectedPending(null);
      setSelectedMember(null);
      fetchData();
    } catch (error) {
      console.error('Error matching data:', error);
      toast.error('Gagal mencocokkan data');
    } finally {
      setIsMatching(false);
    }
  };

  const handleDeletePending = async (id: string) => {
    if (!confirm('Yakin ingin menghapus data ini?')) return;

    try {
      const { error } = await supabase
        .from('pending_member_data')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Data berhasil dihapus');
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Gagal menghapus data');
    }
  };

  const filteredPending = pendingData.filter(p => 
    p.status === 'pending' &&
    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     p.nik?.includes(searchQuery) ||
     p.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const matchedData = pendingData.filter(p => p.status === 'matched');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Pencocokan Data Anggota
          </CardTitle>
          <CardDescription>
            Upload data anggota lama dan cocokkan dengan anggota yang sudah mendaftar untuk transfer simpanan dan pinjaman.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Unduh Template
            </Button>
            <Button onClick={() => setShowUploadDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Data Anggota Lama
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <SearchInput
              placeholder="Cari berdasarkan nama, NIK, atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="flex-1 max-w-md"
            />
            <div className="flex gap-2">
              <Badge variant="outline">{filteredPending.length} Menunggu</Badge>
              <Badge variant="secondary">{matchedData.length} Sudah Dicocokkan</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Menunggu Pencocokan</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPending.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Tidak ada data yang menunggu pencocokan</p>
              <p className="text-sm">Upload data anggota lama untuk memulai</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIK</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Simpanan Pokok</TableHead>
                    <TableHead>Simpanan Wajib</TableHead>
                    <TableHead>Pinjaman</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPending.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.nik || '-'}</TableCell>
                      <TableCell>{item.email || '-'}</TableCell>
                      <TableCell>{formatCurrency(item.simpanan_pokok)}</TableCell>
                      <TableCell>{formatCurrency(item.simpanan_wajib)}</TableCell>
                      <TableCell>
                        {item.has_active_loan ? (
                          <Badge variant="secondary">Ada</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => openMatchDialog(item)}
                          >
                            <Link className="h-4 w-4 mr-1" />
                            Cocokkan
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeletePending(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Data Anggota Lama</DialogTitle>
            <DialogDescription>
              Upload file Excel berisi data anggota dari pembukuan manual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="file-upload-match" className="cursor-pointer">
              <div className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-lg hover:bg-muted">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                <span className="font-medium">Klik untuk pilih file Excel</span>
                <span className="text-sm text-muted-foreground">.xlsx atau .xls</span>
              </div>
              <Input
                id="file-upload-match"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
            </Label>
          </div>
        </DialogContent>
      </Dialog>

      {/* Match Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cocokkan dengan Anggota Terdaftar</DialogTitle>
            <DialogDescription>
              Pilih anggota yang sudah mendaftar untuk dicocokkan dengan data lama.
            </DialogDescription>
          </DialogHeader>

          {selectedPending && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Data Lama:</strong> {selectedPending.name}
                  <br />
                  Simpanan: {formatCurrency(selectedPending.simpanan_pokok + selectedPending.simpanan_wajib + selectedPending.simpanan_sukarela)}
                  {selectedPending.has_active_loan && <><br />Memiliki pinjaman aktif</>}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Pilih Anggota Terdaftar:</Label>
                <ScrollArea className="h-[200px] border rounded-md">
                  {registeredMembers.map((member) => (
                    <div
                      key={member.user_id}
                      className={`p-3 cursor-pointer hover:bg-muted border-b ${
                        selectedMember?.user_id === member.user_id ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => setSelectedMember(member)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                        {selectedMember?.user_id === member.user_id && (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMatchDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleMatch} disabled={!selectedMember || isMatching}>
              {isMatching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Mencocokkan...
                </>
              ) : (
                <>
                  <Link className="h-4 w-4 mr-2" />
                  Cocokkan & Transfer Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
