import { useState, useEffect, useMemo } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  RefreshCcw,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { toast } from '@/hooks/use-toast';
import { addMonths, format } from 'date-fns';

interface ActiveLoan {
  id: string;
  userId: string;
  userName: string;
  memberNumber: string;
  principalAmount: number;
  tenor: number;
  interestRate: number;
  disbursementDate: string;
  remainingPrincipal: number;
}

interface LoanInstallment {
  id: string;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  paid_amount: number | null;
  status: string;
}

interface NewInstallment {
  installmentNumber: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
}

interface LoanRestructureDialogProps {
  open: boolean;
  onClose: () => void;
  loan: ActiveLoan;
}

export const LoanRestructureDialog = ({
  open,
  onClose,
  loan,
}: LoanRestructureDialogProps) => {
  const [currentInstallments, setCurrentInstallments] = useState<LoanInstallment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Restructure form state
  const [newTenor, setNewTenor] = useState<number>(loan.tenor);
  const [interestRate, setInterestRate] = useState<number>(loan.interestRate);
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [interestMethod, setInterestMethod] = useState<'flat' | 'effective'>('flat');

  useEffect(() => {
    if (open && loan.id) {
      fetchCurrentInstallments();
      setNewTenor(loan.tenor);
      setInterestRate(loan.interestRate);
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
      setReason('');
    }
  }, [open, loan.id]);

  const fetchCurrentInstallments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('loan_installments')
        .select('*')
        .eq('loan_id', loan.id)
        .order('installment_number', { ascending: true });

      if (error) throw error;
      setCurrentInstallments(data || []);
    } catch (error) {
      console.error('Error fetching installments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate summary of current state
  const currentSummary = useMemo(() => {
    const paidInstallments = currentInstallments.filter(i => i.status === 'paid');
    const unpaidInstallments = currentInstallments.filter(i => i.status !== 'paid');
    
    const totalPaid = paidInstallments.reduce((sum, i) => sum + (i.paid_amount || 0), 0);
    const paidPrincipal = paidInstallments.reduce((sum, i) => sum + i.principal_amount, 0);
    const remainingPrincipal = loan.remainingPrincipal > 0 
      ? loan.remainingPrincipal 
      : unpaidInstallments.reduce((sum, i) => sum + i.principal_amount, 0);
    
    const overdueCount = currentInstallments.filter(i => i.status === 'overdue').length;
    
    return {
      paidInstallments: paidInstallments.length,
      unpaidInstallments: unpaidInstallments.length,
      totalPaid,
      paidPrincipal,
      remainingPrincipal,
      overdueCount,
    };
  }, [currentInstallments, loan.remainingPrincipal]);

  // Generate new installment schedule based on restructure params
  const newInstallments = useMemo<NewInstallment[]>(() => {
    if (!newTenor || newTenor < 1) return [];
    
    const remainingPrincipal = currentSummary.remainingPrincipal;
    const monthlyPrincipal = Math.floor(remainingPrincipal / newTenor);
    const monthlyInterestRate = interestRate / 100;
    
    const schedule: NewInstallment[] = [];
    
    for (let i = 1; i <= newTenor; i++) {
      const dueDate = addMonths(new Date(startDate), i);
      
      let principalAmount = monthlyPrincipal;
      // Last installment gets the remainder
      if (i === newTenor) {
        principalAmount = remainingPrincipal - (monthlyPrincipal * (newTenor - 1));
      }
      
      let interestAmount: number;
      if (interestMethod === 'flat') {
        interestAmount = Math.round(remainingPrincipal * monthlyInterestRate);
      } else {
        // Effective method - interest on remaining balance
        const remainingAtStart = remainingPrincipal - (monthlyPrincipal * (i - 1));
        interestAmount = Math.round(remainingAtStart * monthlyInterestRate);
      }
      
      schedule.push({
        installmentNumber: i,
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        principalAmount,
        interestAmount,
        totalAmount: principalAmount + interestAmount,
      });
    }
    
    return schedule;
  }, [newTenor, interestRate, startDate, interestMethod, currentSummary.remainingPrincipal]);

  // Summary of new schedule
  const newSummary = useMemo(() => {
    const totalPrincipal = newInstallments.reduce((sum, i) => sum + i.principalAmount, 0);
    const totalInterest = newInstallments.reduce((sum, i) => sum + i.interestAmount, 0);
    const totalAmount = totalPrincipal + totalInterest;
    const avgMonthlyPayment = newInstallments.length > 0 
      ? Math.round(totalAmount / newInstallments.length) 
      : 0;
    
    return {
      totalPrincipal,
      totalInterest,
      totalAmount,
      avgMonthlyPayment,
    };
  }, [newInstallments]);

  const handleSave = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Error',
        description: 'Alasan restrukturisasi wajib diisi',
        variant: 'destructive',
      });
      return;
    }

    if (newInstallments.length === 0) {
      toast({
        title: 'Error',
        description: 'Jadwal angsuran baru tidak valid',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // 1. Delete unpaid installments
      const unpaidIds = currentInstallments
        .filter(i => i.status !== 'paid')
        .map(i => i.id);
      
      if (unpaidIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('loan_installments')
          .delete()
          .in('id', unpaidIds);
        
        if (deleteError) throw deleteError;
      }

      // 2. Insert new installments
      const installmentsToInsert = newInstallments.map(inst => ({
        loan_id: loan.id,
        installment_number: inst.installmentNumber + currentSummary.paidInstallments,
        due_date: inst.dueDate,
        principal_amount: inst.principalAmount,
        interest_amount: inst.interestAmount,
        total_amount: inst.totalAmount,
        paid_amount: 0,
        status: 'pending' as const,
      }));

      const { error: insertError } = await supabase
        .from('loan_installments')
        .insert(installmentsToInsert);

      if (insertError) throw insertError;

      // 3. Update loan tenor
      const { error: updateError } = await supabase
        .from('loans')
        .update({
          tenor: currentSummary.paidInstallments + newTenor,
          interest_rate: interestRate / 100,
        })
        .eq('id', loan.id);

      if (updateError) throw updateError;

      // 4. Create admin notification
      await supabase
        .from('admin_notifications')
        .insert({
          title: 'Restrukturisasi Pinjaman',
          message: `Pinjaman anggota ${loan.userName} (${loan.memberNumber}) telah direstrukturisasi. Tenor baru: ${newTenor} bulan dari sisa pokok ${formatCurrency(currentSummary.remainingPrincipal)}. Alasan: ${reason}`,
          notification_type: 'loan_restructure',
          metadata: {
            loan_id: loan.id,
            user_id: loan.userId,
            member_name: loan.userName,
            member_number: loan.memberNumber,
            old_tenor: loan.tenor,
            new_tenor: newTenor,
            remaining_principal: currentSummary.remainingPrincipal,
            reason,
          },
        });

      // 5. Create member notification
      await supabase
        .from('member_notifications')
        .insert({
          user_id: loan.userId,
          title: 'Pinjaman Anda Direstrukturisasi',
          message: `Pinjaman Anda telah direstrukturisasi dengan tenor baru ${newTenor} bulan. Angsuran bulanan baru: ${formatCurrency(newSummary.avgMonthlyPayment)}. Silakan cek jadwal angsuran terbaru.`,
          notification_type: 'loan_restructure',
          metadata: {
            loan_id: loan.id,
            new_tenor: newTenor,
            monthly_payment: newSummary.avgMonthlyPayment,
          },
        });

      toast({
        title: 'Berhasil',
        description: 'Pinjaman berhasil direstrukturisasi',
      });
      
      onClose();
    } catch (error) {
      console.error('Error restructuring loan:', error);
      toast({
        title: 'Error',
        description: 'Gagal merestrukturisasi pinjaman',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-primary" />
            Restrukturisasi Pinjaman
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Loan Summary */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Kondisi Pinjaman Saat Ini
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Anggota</p>
                    <p className="font-medium">{loan.userName}</p>
                    <p className="text-xs text-muted-foreground">{loan.memberNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pokok Awal</p>
                    <p className="font-medium">{formatCurrency(loan.principalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sisa Pokok</p>
                    <p className="font-medium text-primary">{formatCurrency(currentSummary.remainingPrincipal)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Angsuran Menunggak</p>
                    <p className="font-medium text-destructive flex items-center gap-1">
                      {currentSummary.overdueCount > 0 && <AlertTriangle className="h-4 w-4" />}
                      {currentSummary.overdueCount} bulan
                    </p>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center gap-4 text-xs">
                  <Badge variant="outline" className="bg-green-500/10 text-green-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {currentSummary.paidInstallments} Lunas
                  </Badge>
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700">
                    {currentSummary.unpaidInstallments} Belum Lunas
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Restructure Form */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Parameter Restrukturisasi
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Tenor Baru (bulan)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={newTenor}
                      onChange={(e) => setNewTenor(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bunga (%/bulan)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={interestRate}
                      onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal Mulai</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Metode Bunga</Label>
                    <Select value={interestMethod} onValueChange={(v) => setInterestMethod(v as 'flat' | 'effective')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat</SelectItem>
                        <SelectItem value="effective">Efektif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Alasan Restrukturisasi *</Label>
                  <Textarea
                    placeholder="Contoh: Anggota mengalami kesulitan keuangan karena PHK, disepakati perpanjangan tenor dengan bunga lebih ringan..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* New Schedule Preview */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Jadwal Angsuran Baru
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm p-3 bg-secondary rounded-lg">
                  <div>
                    <p className="text-muted-foreground">Total Pokok</p>
                    <p className="font-medium">{formatCurrency(newSummary.totalPrincipal)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Bunga</p>
                    <p className="font-medium">{formatCurrency(newSummary.totalInterest)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Bayar</p>
                    <p className="font-medium text-primary">{formatCurrency(newSummary.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rata-rata/bulan</p>
                    <p className="font-medium">{formatCurrency(newSummary.avgMonthlyPayment)}</p>
                  </div>
                </div>

                {/* Schedule Table */}
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Jatuh Tempo</TableHead>
                        <TableHead className="text-right">Pokok</TableHead>
                        <TableHead className="text-right">Bunga</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newInstallments.map((inst) => (
                        <TableRow key={inst.installmentNumber}>
                          <TableCell className="font-medium">{inst.installmentNumber}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDate(inst.dueDate)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(inst.principalAmount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(inst.interestAmount)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(inst.totalAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Terapkan Restrukturisasi
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
