import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { ExportButtons } from '@/components/ui/export-buttons';
import { 
  Loader2, 
  Calendar, 
  User, 
  CreditCard,
  Calculator,
  History,
  ChevronDown,
  ChevronUp,
  Gift,
  RefreshCcw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';
import { LoanAdjustmentDialog } from './LoanAdjustmentDialog';
import { LoanRestructureDialog } from './LoanRestructureDialog';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LoanInstallment {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  penalty_amount: number;
  total_amount: number;
  paid_amount: number | null;
  paid_date: string | null;
  status: string;
  adjusted_interest_amount: number | null;
  adjusted_penalty_amount: number | null;
  adjustment_reason: string | null;
  adjusted_at: string | null;
}

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

interface LoanInstallmentDetailsProps {
  open: boolean;
  onClose: () => void;
  loan: ActiveLoan;
}

export const LoanInstallmentDetails = ({
  open,
  onClose,
  loan,
}: LoanInstallmentDetailsProps) => {
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<LoanInstallment | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [adjustmentHistory, setAdjustmentHistory] = useState<any[]>([]);
  const [restructureDialogOpen, setRestructureDialogOpen] = useState(false);

  useEffect(() => {
    if (open && loan.id) {
      fetchInstallments();
      fetchAdjustmentHistory();
    }
  }, [open, loan.id]);

  const fetchInstallments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('loan_installments')
        .select('*')
        .eq('loan_id', loan.id)
        .order('installment_number', { ascending: true });

      if (error) throw error;
      setInstallments(data || []);
    } catch (error) {
      console.error('Error fetching installments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdjustmentHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('loan_adjustment_history')
        .select('*')
        .eq('loan_id', loan.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdjustmentHistory(data || []);
    } catch (error) {
      console.error('Error fetching adjustment history:', error);
    }
  };

  const handleOpenAdjustment = (installment: LoanInstallment) => {
    setSelectedInstallment(installment);
    setAdjustmentDialogOpen(true);
  };

  const handleCloseAdjustment = () => {
    setAdjustmentDialogOpen(false);
    setSelectedInstallment(null);
    fetchInstallments();
    fetchAdjustmentHistory();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-600">Lunas</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-600">Sebagian</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Terlambat</Badge>;
      default:
        return <Badge variant="secondary">Menunggu</Badge>;
    }
  };

  const totalAdjustedReduction = installments.reduce((sum, inst) => {
    const interestReduction = inst.adjusted_interest_amount !== null 
      ? inst.interest_amount - inst.adjusted_interest_amount 
      : 0;
    const penaltyReduction = inst.adjusted_penalty_amount !== null 
      ? (inst.penalty_amount || 0) - inst.adjusted_penalty_amount 
      : 0;
    return sum + interestReduction + penaltyReduction;
  }, 0);

  const adjustedInstallmentsCount = installments.filter(
    i => i.adjusted_interest_amount !== null || i.adjusted_penalty_amount !== null
  ).length;

  // Export to Excel
  const handleExportExcel = () => {
    const settings = getCooperativeSettings();
    
    // Loan info sheet
    const loanInfo = [
      { 'Field': 'Nama Anggota', 'Nilai': loan.userName },
      { 'Field': 'Nomor Anggota', 'Nilai': loan.memberNumber },
      { 'Field': 'Pokok Pinjaman', 'Nilai': loan.principalAmount },
      { 'Field': 'Tenor', 'Nilai': `${loan.tenor} bulan` },
      { 'Field': 'Bunga', 'Nilai': `${loan.interestRate}%` },
      { 'Field': 'Tanggal Cair', 'Nilai': loan.disbursementDate || '-' },
      { 'Field': 'Sisa Pokok', 'Nilai': loan.remainingPrincipal },
      { 'Field': 'Total Keringanan', 'Nilai': totalAdjustedReduction },
    ];

    // Installments sheet
    const installmentData = installments.map(inst => {
      const effectiveInterest = inst.adjusted_interest_amount ?? inst.interest_amount;
      const effectivePenalty = inst.adjusted_penalty_amount ?? (inst.penalty_amount || 0);
      const effectiveTotal = inst.principal_amount + effectiveInterest + effectivePenalty;
      const statusLabel: Record<string, string> = {
        paid: 'Lunas',
        partial: 'Sebagian',
        overdue: 'Terlambat',
        pending: 'Menunggu',
      };

      return {
        'No': inst.installment_number,
        'Jatuh Tempo': inst.due_date,
        'Pokok': inst.principal_amount,
        'Bunga Awal': inst.interest_amount,
        'Bunga Final': effectiveInterest,
        'Denda Awal': inst.penalty_amount || 0,
        'Denda Final': effectivePenalty,
        'Total': effectiveTotal,
        'Dibayar': inst.paid_amount || 0,
        'Tanggal Bayar': inst.paid_date || '-',
        'Status': statusLabel[inst.status] || inst.status,
        'Keterangan': inst.adjustment_reason || '-',
      };
    });

    const fileName = `Angsuran_${loan.memberNumber.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    createAndDownloadExcelFromJson(
      [
        { name: 'Info Pinjaman', data: loanInfo },
        { name: 'Detail Angsuran', data: installmentData }
      ],
      fileName
    );
  };

  // Export to PDF
  const handleExportPDF = () => {
    const settings = getCooperativeSettings();
    const doc = new jsPDF('portrait');
    
    // Header
    doc.setFontSize(14);
    doc.text(settings.name, 14, 15);
    doc.setFontSize(12);
    doc.text('Detail Angsuran Pinjaman', 14, 22);
    doc.setFontSize(10);
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 28);

    // Member info
    doc.setFontSize(10);
    doc.text(`Nama: ${loan.userName}`, 14, 38);
    doc.text(`No. Anggota: ${loan.memberNumber}`, 14, 44);
    doc.text(`Pokok: Rp ${loan.principalAmount.toLocaleString('id-ID')}`, 14, 50);
    doc.text(`Tenor: ${loan.tenor} bulan | Bunga: ${loan.interestRate}%`, 100, 50);
    doc.text(`Sisa Pokok: Rp ${loan.remainingPrincipal.toLocaleString('id-ID')}`, 14, 56);
    doc.text(`Total Keringanan: Rp ${totalAdjustedReduction.toLocaleString('id-ID')}`, 100, 56);

    // Table
    const tableData = installments.map(inst => {
      const effectiveInterest = inst.adjusted_interest_amount ?? inst.interest_amount;
      const effectivePenalty = inst.adjusted_penalty_amount ?? (inst.penalty_amount || 0);
      const effectiveTotal = inst.principal_amount + effectiveInterest + effectivePenalty;
      const statusLabel: Record<string, string> = {
        paid: 'Lunas',
        partial: 'Sebagian',
        overdue: 'Terlambat',
        pending: 'Menunggu',
      };

      return [
        inst.installment_number,
        inst.due_date,
        `Rp ${inst.principal_amount.toLocaleString('id-ID')}`,
        `Rp ${effectiveInterest.toLocaleString('id-ID')}`,
        `Rp ${effectivePenalty.toLocaleString('id-ID')}`,
        `Rp ${effectiveTotal.toLocaleString('id-ID')}`,
        `Rp ${(inst.paid_amount || 0).toLocaleString('id-ID')}`,
        statusLabel[inst.status] || inst.status,
      ];
    });

    autoTable(doc, {
      startY: 62,
      head: [['No', 'Jatuh Tempo', 'Pokok', 'Bunga', 'Denda', 'Total', 'Dibayar', 'Status']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const fileName = `Angsuran_${loan.memberNumber.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Detail Angsuran Pinjaman
              </DialogTitle>
              <ExportButtons
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                disabled={isLoading || installments.length === 0}
                size="sm"
              />
            </div>
          </DialogHeader>

          {/* Member Info */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{loan.userName}</p>
              <p className="text-sm text-muted-foreground">{loan.memberNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Pokok Pinjaman</p>
              <p className="font-bold text-primary">{formatCurrency(loan.principalAmount)}</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Tenor</p>
              <p className="font-bold text-foreground">{loan.tenor} bulan</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Sisa Pokok</p>
              <p className="font-bold text-primary">{formatCurrency(loan.remainingPrincipal)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Angsuran Keringanan</p>
              <p className="font-bold text-foreground">{adjustedInstallmentsCount}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Total Keringanan</p>
              <p className="font-bold text-green-600">{formatCurrency(totalAdjustedReduction)}</p>
            </Card>
          </div>

          {/* Restructure Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setRestructureDialogOpen(true)}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Restrukturisasi Pinjaman
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Installments Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Jatuh Tempo</TableHead>
                      <TableHead className="text-right">Pokok</TableHead>
                      <TableHead className="text-right">Bunga</TableHead>
                      <TableHead className="text-right">Denda</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Dibayar</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.map((inst) => {
                      const hasAdjustment = inst.adjusted_interest_amount !== null || inst.adjusted_penalty_amount !== null;
                      const effectiveInterest = inst.adjusted_interest_amount ?? inst.interest_amount;
                      const effectivePenalty = inst.adjusted_penalty_amount ?? (inst.penalty_amount || 0);
                      const effectiveTotal = inst.principal_amount + effectiveInterest + effectivePenalty;
                      
                      return (
                        <TableRow key={inst.id} className={hasAdjustment ? 'bg-green-500/5' : ''}>
                          <TableCell className="font-medium">
                            {inst.installment_number}
                            {hasAdjustment && (
                              <Gift className="h-3 w-3 text-green-600 inline ml-1" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDate(inst.due_date)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(inst.principal_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {hasAdjustment && inst.adjusted_interest_amount !== null ? (
                              <div>
                                <span className="line-through text-muted-foreground text-xs">
                                  {formatCurrency(inst.interest_amount)}
                                </span>
                                <br />
                                <span className="text-green-600 font-medium">
                                  {formatCurrency(inst.adjusted_interest_amount)}
                                </span>
                              </div>
                            ) : (
                              formatCurrency(inst.interest_amount)
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {hasAdjustment && inst.adjusted_penalty_amount !== null ? (
                              <div>
                                <span className="line-through text-muted-foreground text-xs">
                                  {formatCurrency(inst.penalty_amount || 0)}
                                </span>
                                <br />
                                <span className="text-green-600 font-medium">
                                  {formatCurrency(inst.adjusted_penalty_amount)}
                                </span>
                              </div>
                            ) : (
                              formatCurrency(inst.penalty_amount || 0)
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {hasAdjustment ? (
                              <span className="text-green-600">{formatCurrency(effectiveTotal)}</span>
                            ) : (
                              formatCurrency(inst.total_amount)
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {inst.paid_amount ? (
                              <span className={inst.paid_amount >= effectiveTotal ? 'text-green-600 font-medium' : 'text-yellow-600'}>
                                {formatCurrency(inst.paid_amount)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(inst.status)}</TableCell>
                          <TableCell className="max-w-[150px]">
                            {inst.adjustment_reason ? (
                              <span className="text-xs text-muted-foreground truncate block" title={inst.adjustment_reason}>
                                {inst.adjustment_reason}
                              </span>
                            ) : inst.paid_date ? (
                              <span className="text-xs text-muted-foreground">
                                Bayar: {formatDate(inst.paid_date)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {inst.status !== 'paid' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenAdjustment(inst)}
                                className="h-8 text-xs"
                              >
                                <Calculator className="h-3.5 w-3.5 mr-1" />
                                {hasAdjustment ? 'Edit' : 'Keringanan'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Adjustment History */}
              {adjustmentHistory.length > 0 && (
                <Card>
                  <CardHeader 
                    className="cursor-pointer py-3"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Riwayat Keringanan ({adjustmentHistory.length})
                      </span>
                      {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </CardTitle>
                  </CardHeader>
                  {showHistory && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {adjustmentHistory.map((hist) => (
                          <div 
                            key={hist.id} 
                            className="p-3 rounded-lg bg-muted/50 text-sm border border-border/50"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-foreground">
                                  Angsuran ke-{installments.find(i => i.id === hist.installment_id)?.installment_number || '?'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">{hist.reason}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-green-600 font-medium">
                                  -{formatCurrency(hist.interest_reduction + hist.penalty_reduction)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(hist.created_at).toLocaleDateString('id-ID')}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjustment Dialog */}
      {selectedInstallment && (
        <LoanAdjustmentDialog
          open={adjustmentDialogOpen}
          onClose={handleCloseAdjustment}
          installment={selectedInstallment}
          userId={loan.userId}
          memberName={loan.userName}
        />
      )}

      {/* Restructure Dialog */}
      <LoanRestructureDialog
        open={restructureDialogOpen}
        onClose={() => {
          setRestructureDialogOpen(false);
          fetchInstallments();
        }}
        loan={loan}
      />
    </>
  );
};
