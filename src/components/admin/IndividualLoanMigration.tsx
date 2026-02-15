import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, AlertCircle, CreditCard, Plus, Check, Calculator,
  RefreshCw, User, Calendar, Percent, Clock, Banknote, FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/mockData';
import { format, addMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

interface Member {
  userId: string;
  name: string;
  memberNumber: string;
  email: string;
  hasActiveLoan: boolean;
}

interface LoanFormData {
  principalAmount: number;
  remainingPrincipal: number;
  tenor: number;
  interestRate: number;
  disbursementDate: string;
  paidInstallments: number;
  notes: string;
}

interface InstallmentPreview {
  installmentNumber: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  status: string;
  isPaid: boolean;
}

interface CooperativeSettings {
  calculationMethod: 'flat' | 'effective';
  installmentDueDay: number;
}

export default function IndividualLoanMigration() {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showLoanDialog, setShowLoanDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<CooperativeSettings>({
    calculationMethod: 'flat',
    installmentDueDay: 10,
  });
  const [migrationYear, setMigrationYear] = useState(new Date().getFullYear());
  
  // Form state
  const [formData, setFormData] = useState<LoanFormData>({
    principalAmount: 0,
    remainingPrincipal: 0,
    tenor: 12,
    interestRate: 1,
    disbursementDate: format(new Date(), 'yyyy-MM-dd'),
    paidInstallments: 0,
    notes: '',
  });

  // Installment preview
  const [installmentPreview, setInstallmentPreview] = useState<InstallmentPreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    Promise.all([fetchMembers(), fetchSettings()]);
  }, []);

  useEffect(() => {
    if (showPreview) {
      generateInstallmentPreview();
    }
  }, [formData, showPreview, settings]);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      // Get all approved active members
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, member_number, email')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .order('name');

      if (profileError) throw profileError;

      // Get members with active loans
      const { data: activeLoans } = await supabase
        .from('loans')
        .select('user_id')
        .eq('status', 'active');

      const activeLoanUserIds = new Set((activeLoans || []).map(l => l.user_id));

      const mappedData: Member[] = (profiles || []).map(profile => ({
        userId: profile.user_id,
        name: profile.name,
        memberNumber: profile.member_number || '-',
        email: profile.email,
        hasActiveLoan: activeLoanUserIds.has(profile.user_id),
      }));

      setMembers(mappedData);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Gagal memuat data anggota');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('cooperative_settings')
        .select('key, value')
        .in('key', ['interest_calculation_method', 'installment_due_day']);

      if (data) {
        const settingsMap = data.reduce((acc, item) => {
          acc[item.key] = item.value;
          return acc;
        }, {} as Record<string, any>);

        setSettings({
          calculationMethod: settingsMap.interest_calculation_method || 'flat',
          installmentDueDay: settingsMap.installment_due_day || 10,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const openLoanDialog = (member: Member) => {
    setSelectedMember(member);
    setFormData({
      principalAmount: 0,
      remainingPrincipal: 0,
      tenor: 12,
      interestRate: 1,
      disbursementDate: format(new Date(), 'yyyy-MM-dd'),
      paidInstallments: 0,
      notes: '',
    });
    setShowPreview(false);
    setInstallmentPreview([]);
    setShowLoanDialog(true);
  };

  const calculateDueDate = (disbursementDate: Date, installmentNumber: number, dueDay: number): Date => {
    const baseDate = addMonths(disbursementDate, installmentNumber);
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const actualDueDay = Math.min(dueDay, lastDayOfMonth);
    return new Date(year, month, actualDueDay);
  };

  const generateInstallmentPreview = () => {
    if (formData.principalAmount <= 0 || formData.tenor <= 0) {
      setInstallmentPreview([]);
      return;
    }

    const installments: InstallmentPreview[] = [];
    const disbursementDate = new Date(formData.disbursementDate);
    
    // Calculate principal distribution
    const basePrincipal = Math.floor(formData.principalAmount / formData.tenor / 50000) * 50000;
    const remainder = formData.principalAmount - (basePrincipal * formData.tenor);
    const monthsWithExtra = Math.round(remainder / 50000);
    
    let remainingPrincipalCalc = formData.principalAmount;
    const interestRateDecimal = formData.interestRate / 100;

    for (let i = 1; i <= formData.tenor; i++) {
      const dueDate = calculateDueDate(disbursementDate, i, settings.installmentDueDay);
      const principalThisMonth = i <= monthsWithExtra ? basePrincipal + 50000 : basePrincipal;
      
      let interestAmount: number;
      if (settings.calculationMethod === 'effective') {
        interestAmount = remainingPrincipalCalc * interestRateDecimal;
      } else {
        interestAmount = formData.principalAmount * interestRateDecimal;
      }
      
      const isPaid = i <= formData.paidInstallments;
      
      installments.push({
        installmentNumber: i,
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        principalAmount: principalThisMonth,
        interestAmount: interestAmount,
        totalAmount: principalThisMonth + interestAmount,
        status: isPaid ? 'paid' : 'pending',
        isPaid,
      });
      
      remainingPrincipalCalc -= principalThisMonth;
    }

    setInstallmentPreview(installments);
  };

  const calculateRemainingPrincipal = () => {
    if (formData.principalAmount <= 0 || formData.tenor <= 0) return 0;
    
    const basePrincipal = Math.floor(formData.principalAmount / formData.tenor / 50000) * 50000;
    const remainder = formData.principalAmount - (basePrincipal * formData.tenor);
    const monthsWithExtra = Math.round(remainder / 50000);
    
    let paidPrincipal = 0;
    for (let i = 1; i <= formData.paidInstallments; i++) {
      paidPrincipal += i <= monthsWithExtra ? basePrincipal + 50000 : basePrincipal;
    }
    
    return formData.principalAmount - paidPrincipal;
  };

  const handleAutoCalculateRemaining = () => {
    const remaining = calculateRemainingPrincipal();
    setFormData(prev => ({ ...prev, remainingPrincipal: remaining }));
  };

  const createLoanMigrationJournal = async (
    loanAmount: number,
    memberName: string,
    loanId: string
  ): Promise<string | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const entryDate = format(new Date(), 'yyyy-MM-dd');
      
      // Get piutang account (receivables for loans)
      const { data: piutangAccount } = await supabase
        .from('chart_of_accounts')
        .select('id, balance, account_code')
        .ilike('account_name', '%piutang%pinjaman%')
        .eq('is_active', true)
        .single();
      
      if (!piutangAccount) {
        console.error('Piutang account not found');
        toast.warning('Akun Piutang Pinjaman tidak ditemukan. Jurnal tidak dibuat.');
        return null;
      }

      // Get Modal Migrasi or Equity account
      let migrationAccount = null;
      const { data: migrationAcct } = await supabase
        .from('chart_of_accounts')
        .select('id, balance, account_code')
        .or('account_name.ilike.%modal migrasi%,account_name.ilike.%saldo awal%')
        .eq('is_active', true)
        .limit(1);
      
      if (migrationAcct && migrationAcct.length > 0) {
        migrationAccount = migrationAcct[0];
      } else {
        const { data: equityAcct } = await supabase
          .from('chart_of_accounts')
          .select('id, balance, account_code')
          .eq('account_type', 'equity')
          .eq('is_active', true)
          .limit(1);
        
        if (equityAcct && equityAcct.length > 0) {
          migrationAccount = equityAcct[0];
        }
      }

      if (!migrationAccount) {
        console.error('Migration/Equity account not found');
        toast.warning('Akun Modal Migrasi tidak ditemukan. Jurnal tidak dibuat.');
        return null;
      }

      // Generate journal entry number
      const yearMonth = format(new Date(), 'yyyyMM');
      const { count } = await supabase
        .from('journal_entries')
        .select('*', { count: 'exact', head: true })
        .ilike('entry_number', `JM-${yearMonth}%`);
      
      const sequence = (count || 0) + 1;
      const entryNumber = `JM-${yearMonth}-${sequence.toString().padStart(4, '0')}`;

      // Create journal entry
      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: entryDate,
          description: `Migrasi pinjaman anggota ${memberName}`,
          total_debit: loanAmount,
          total_credit: loanAmount,
          is_balanced: true,
          status: 'approved',
          reference_type: 'loan_migration',
          reference_id: loanId,
          created_by: userData?.user?.id,
          approved_by: userData?.user?.id,
          approved_at: now,
        })
        .select()
        .single();

      if (journalError) throw journalError;

      // Create journal lines
      const journalLines = [
        {
          journal_entry_id: journalEntry.id,
          account_id: piutangAccount.id,
          debit_amount: loanAmount,
          credit_amount: 0,
          description: `D. Piutang Pinjaman - ${memberName}`,
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: migrationAccount.id,
          debit_amount: 0,
          credit_amount: loanAmount,
          description: `K. Modal Migrasi - ${memberName}`,
        },
      ];

      await supabase.from('journal_entry_lines').insert(journalLines);

      // Update account balances
      await supabase
        .from('chart_of_accounts')
        .update({ 
          balance: (piutangAccount.balance || 0) + loanAmount, 
          updated_at: now 
        })
        .eq('id', piutangAccount.id);

      await supabase
        .from('chart_of_accounts')
        .update({ 
          balance: (migrationAccount.balance || 0) + loanAmount, 
          updated_at: now 
        })
        .eq('id', migrationAccount.id);

      console.log(`Created loan migration journal ${entryNumber}: D.Piutang ${loanAmount}, K.Modal Migrasi ${loanAmount}`);
      
      return journalEntry.id;
    } catch (error) {
      console.error('Error creating loan migration journal:', error);
      return null;
    }
  };

  const handleSaveLoan = async () => {
    if (!selectedMember) return;
    
    // Validation
    if (formData.principalAmount <= 0) {
      toast.error('Jumlah pokok pinjaman harus lebih dari 0');
      return;
    }
    if (formData.remainingPrincipal <= 0) {
      toast.error('Sisa pokok pinjaman harus lebih dari 0');
      return;
    }
    if (formData.remainingPrincipal > formData.principalAmount) {
      toast.error('Sisa pokok tidak boleh lebih besar dari pokok awal');
      return;
    }
    if (formData.tenor <= 0) {
      toast.error('Tenor harus lebih dari 0');
      return;
    }
    if (formData.paidInstallments < 0 || formData.paidInstallments >= formData.tenor) {
      toast.error('Jumlah angsuran terbayar tidak valid');
      return;
    }

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      
      // 1. Create loan record
      const { data: newLoan, error: loanError } = await supabase
        .from('loans')
        .insert({
          user_id: selectedMember.userId,
          principal_amount: formData.principalAmount,
          tenor: formData.tenor,
          interest_rate: formData.interestRate,
          status: 'active',
          remaining_principal: formData.remainingPrincipal,
          disbursement_date: formData.disbursementDate,
          application_date: formData.disbursementDate,
          approved_at: now,
          approved_by: userData?.user?.id,
        })
        .select()
        .single();

      if (loanError) throw loanError;

      // 2. Create migration transaction
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: selectedMember.userId,
          type: 'saldo_awal_pinjaman' as Database['public']['Enums']['transaction_type'],
          amount: formData.remainingPrincipal,
          status: 'approved' as Database['public']['Enums']['transaction_status'],
          payment_method: 'transfer_bank' as Database['public']['Enums']['payment_method'],
          notes: `Migrasi pinjaman individual - ${formData.notes || 'Tanpa catatan'}`,
          approved_at: now,
          is_migration: true,
        })
        .select('id')
        .single();

      // 3. Create journal entry
      let journalId: string | null = null;
      if (!txError && txData) {
        journalId = await createLoanMigrationJournal(
          formData.remainingPrincipal,
          selectedMember.name,
          newLoan.id
        );
        
        if (journalId) {
          await supabase.from('transactions')
            .update({ journal_entry_id: journalId })
            .eq('id', txData.id);
        }
      }

      // 4. Create installments
      const disbursementDate = new Date(formData.disbursementDate);
      const basePrincipal = Math.floor(formData.principalAmount / formData.tenor / 50000) * 50000;
      const remainder = formData.principalAmount - (basePrincipal * formData.tenor);
      const monthsWithExtra = Math.round(remainder / 50000);
      
      const installments = [];
      let remainingPrincipalCalc = formData.principalAmount;
      const interestRateDecimal = formData.interestRate / 100;

      for (let i = 1; i <= formData.tenor; i++) {
        const dueDate = calculateDueDate(disbursementDate, i, settings.installmentDueDay);
        const principalThisMonth = i <= monthsWithExtra ? basePrincipal + 50000 : basePrincipal;
        
        let interestAmount: number;
        if (settings.calculationMethod === 'effective') {
          interestAmount = remainingPrincipalCalc * interestRateDecimal;
        } else {
          interestAmount = formData.principalAmount * interestRateDecimal;
        }
        
        const isPaid = i <= formData.paidInstallments;
        
        installments.push({
          loan_id: newLoan.id,
          installment_number: i,
          principal_amount: principalThisMonth,
          interest_amount: interestAmount,
          total_amount: principalThisMonth + interestAmount,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          status: isPaid ? 'paid' : 'pending',
          paid_amount: isPaid ? principalThisMonth + interestAmount : 0,
          paid_date: isPaid ? format(dueDate, 'yyyy-MM-dd') : null,
        });
        
        remainingPrincipalCalc -= principalThisMonth;
      }

      const { error: installmentError } = await supabase
        .from('loan_installments')
        .insert(installments);

      if (installmentError) throw installmentError;

      // 5. Log to audit
      await supabase.from('audit_logs').insert({
        user_id: userData?.user?.id || '',
        action_type: 'create',
        entity_type: 'loan_migration',
        entity_id: newLoan.id,
        description: `Migrasi pinjaman individual untuk ${selectedMember.name}`,
        new_data: {
          loan_id: newLoan.id,
          principal_amount: formData.principalAmount,
          remaining_principal: formData.remainingPrincipal,
          tenor: formData.tenor,
          paid_installments: formData.paidInstallments,
          journal_id: journalId,
        },
      });

      toast.success('Pinjaman migrasi berhasil ditambahkan!');
      setShowLoanDialog(false);
      fetchMembers(); // Refresh to update active loan status
    } catch (error) {
      console.error('Error saving loan migration:', error);
      toast.error('Gagal menyimpan pinjaman migrasi');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.memberNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <CreditCard className="h-5 w-5" />
            Tambah Pinjaman Migrasi Individual
          </CardTitle>
          <CardDescription>
            Tambahkan data pinjaman aktif untuk anggota yang terlewat saat migrasi awal. 
            Sistem akan otomatis membuat jadwal angsuran dan jurnal akuntansi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Fitur ini hanya untuk menambahkan pinjaman yang sudah berjalan dari sistem lama. 
              Untuk pengajuan pinjaman baru, gunakan menu Pengajuan Pinjaman.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-4">
            <SearchInput
              placeholder="Cari berdasarkan nama atau nomor anggota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="flex-1 max-w-md"
            />
            <Button variant="outline" onClick={fetchMembers}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anggota</TableHead>
                  <TableHead>No. Anggota</TableHead>
                  <TableHead>Status Pinjaman</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{member.memberNumber}</TableCell>
                    <TableCell>
                      {member.hasActiveLoan ? (
                        <Badge variant="secondary">Memiliki Pinjaman Aktif</Badge>
                      ) : (
                        <Badge variant="outline">Tidak Ada Pinjaman</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => openLoanDialog(member)}
                        disabled={member.hasActiveLoan}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Tambah Pinjaman
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Tidak ada anggota ditemukan
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Loan Dialog */}
      <Dialog open={showLoanDialog} onOpenChange={setShowLoanDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Tambah Pinjaman Migrasi
            </DialogTitle>
            <DialogDescription>
              {selectedMember && `Input data pinjaman untuk ${selectedMember.name} (${selectedMember.memberNumber})`}
            </DialogDescription>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-6">
              {/* Member Info */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <User className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold">{selectedMember.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedMember.memberNumber} • {selectedMember.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Loan Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    Pokok Pinjaman Awal
                  </Label>
                  <CurrencyInput
                    value={formData.principalAmount}
                    onChange={(value) => setFormData(prev => ({ ...prev, principalAmount: value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    Sisa Pokok Saat Ini
                  </Label>
                  <div className="flex gap-2">
                    <CurrencyInput
                      value={formData.remainingPrincipal}
                      onChange={(value) => setFormData(prev => ({ ...prev, remainingPrincipal: value }))}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAutoCalculateRemaining}
                      title="Hitung otomatis berdasarkan angsuran terbayar"
                    >
                      <Calculator className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Tenor (Bulan)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={formData.tenor}
                    onChange={(e) => setFormData(prev => ({ ...prev, tenor: parseInt(e.target.value) || 12 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Suku Bunga (% per bulan)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={formData.interestRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, interestRate: parseFloat(e.target.value) || 1 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Tanggal Pencairan
                  </Label>
                  <Input
                    type="date"
                    value={formData.disbursementDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, disbursementDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Angsuran Sudah Terbayar
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={formData.tenor - 1}
                    value={formData.paidInstallments}
                    onChange={(e) => setFormData(prev => ({ ...prev, paidInstallments: parseInt(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sisa angsuran: {formData.tenor - formData.paidInstallments} bulan
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Catatan (Opsional)
                  </Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Catatan tambahan tentang migrasi pinjaman ini..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Settings Info */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Metode bunga: <strong>{settings.calculationMethod === 'flat' ? 'Flat' : 'Efektif'}</strong></span>
                <span>Jatuh tempo: <strong>Tanggal {settings.installmentDueDay}</strong></span>
              </div>

              {/* Preview Toggle */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                  disabled={formData.principalAmount <= 0 || formData.tenor <= 0}
                >
                  {showPreview ? 'Sembunyikan' : 'Lihat'} Jadwal Angsuran
                </Button>
                
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Pinjaman</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(formData.principalAmount)}</p>
                </div>
              </div>

              {/* Installment Preview */}
              {showPreview && installmentPreview.length > 0 && (
                <div className="border rounded-lg">
                  <div className="p-3 bg-muted/50 border-b">
                    <h4 className="font-medium">Jadwal Angsuran</h4>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">No.</TableHead>
                          <TableHead>Jatuh Tempo</TableHead>
                          <TableHead className="text-right">Pokok</TableHead>
                          <TableHead className="text-right">Bunga</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {installmentPreview.map((inst) => (
                          <TableRow key={inst.installmentNumber} className={inst.isPaid ? 'bg-muted/30' : ''}>
                            <TableCell>{inst.installmentNumber}</TableCell>
                            <TableCell>
                              {format(new Date(inst.dueDate), 'd MMM yyyy', { locale: localeId })}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(inst.principalAmount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(inst.interestAmount)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(inst.totalAmount)}</TableCell>
                            <TableCell>
                              <Badge variant={inst.isPaid ? 'default' : 'outline'}>
                                {inst.isPaid ? 'Lunas' : 'Belum'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="p-3 bg-muted/50 border-t">
                    <div className="flex justify-between text-sm">
                      <span>Total sudah terbayar:</span>
                      <span className="font-medium">
                        {formatCurrency(installmentPreview.filter(i => i.isPaid).reduce((sum, i) => sum + i.totalAmount, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total sisa angsuran:</span>
                      <span className="font-medium">
                        {formatCurrency(installmentPreview.filter(i => !i.isPaid).reduce((sum, i) => sum + i.totalAmount, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowLoanDialog(false)}>
                  Batal
                </Button>
                <Button onClick={handleSaveLoan} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Simpan Pinjaman
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
