import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExportButtons } from '@/components/ui/export-buttons';
import { 
  Loader2, 
  Search, 
  Calendar,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  User,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { useInstallmentReport, InstallmentReportItem } from '@/hooks/useInstallmentReport';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { getCooperativeSettings } from '@/lib/cooperativeSettings';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MemberInstallmentSummary {
  userId: string;
  memberName: string;
  memberNumber: string;
  loanPrincipal: number;
  loanTenor: number;
  loanDisbursementDate: string | null;
  totalInstallments: number;
  paidCount: number;
  overdueCount: number;
  pendingCount: number;
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  installments: InstallmentReportItem[];
}

const statusOptions = [
  { value: 'all', label: 'Semua Status' },
  { value: 'has_overdue', label: 'Ada Terlambat' },
  { value: 'all_paid', label: 'Semua Lunas' },
  { value: 'has_pending', label: 'Ada Menunggu' },
];

export const InstallmentReport = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberInstallmentSummary | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { data, isLoading } = useInstallmentReport(selectedYear);

  // Group by member
  const memberSummaries = useMemo(() => {
    const memberMap = new Map<string, MemberInstallmentSummary>();

    data.forEach(item => {
      const key = `${item.userId}-${item.loanId}`;
      if (!memberMap.has(key)) {
        memberMap.set(key, {
          userId: item.userId,
          memberName: item.memberName,
          memberNumber: item.memberNumber,
          loanPrincipal: item.loanPrincipal,
          loanTenor: item.loanTenor,
          loanDisbursementDate: item.loanDisbursementDate,
          totalInstallments: 0,
          paidCount: 0,
          overdueCount: 0,
          pendingCount: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalOutstanding: 0,
          installments: [],
        });
      }

      const summary = memberMap.get(key)!;
      const effectiveInterest = item.adjustedInterestAmount ?? item.interestAmount;
      const effectivePenalty = item.adjustedPenaltyAmount ?? item.penaltyAmount;
      const effectiveTotal = item.principalAmount + effectiveInterest + effectivePenalty;

      summary.totalInstallments++;
      summary.totalAmount += effectiveTotal;
      summary.totalPaid += item.paidAmount;
      summary.installments.push(item);

      if (item.status === 'paid') {
        summary.paidCount++;
      } else if (item.status === 'overdue') {
        summary.overdueCount++;
        summary.totalOutstanding += effectiveTotal - item.paidAmount;
      } else {
        summary.pendingCount++;
        summary.totalOutstanding += effectiveTotal - item.paidAmount;
      }
    });

    return Array.from(memberMap.values()).sort((a, b) => a.memberName.localeCompare(b.memberName));
  }, [data]);

  // Filter members
  const filteredMembers = useMemo(() => {
    let result = memberSummaries;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(m => 
        m.memberName.toLowerCase().includes(term) ||
        m.memberNumber.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter === 'has_overdue') {
      result = result.filter(m => m.overdueCount > 0);
    } else if (statusFilter === 'all_paid') {
      result = result.filter(m => m.paidCount === m.totalInstallments);
    } else if (statusFilter === 'has_pending') {
      result = result.filter(m => m.pendingCount > 0);
    }

    return result;
  }, [memberSummaries, searchTerm, statusFilter]);

  // Summary stats
  const overallStats = useMemo(() => ({
    totalMembers: memberSummaries.length,
    totalWithOverdue: memberSummaries.filter(m => m.overdueCount > 0).length,
    totalAllPaid: memberSummaries.filter(m => m.paidCount === m.totalInstallments).length,
    totalOutstanding: memberSummaries.reduce((sum, m) => sum + m.totalOutstanding, 0),
  }), [memberSummaries]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-600 text-xs">Lunas</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-600 text-xs">Sebagian</Badge>;
      case 'overdue':
        return <Badge variant="destructive" className="text-xs">Terlambat</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Menunggu</Badge>;
    }
  };

  const openDetail = (member: MemberInstallmentSummary) => {
    setSelectedMember(member);
    setDetailDialogOpen(true);
  };

  const handleExportMemberExcel = (member: MemberInstallmentSummary) => {
    const settings = getCooperativeSettings();

    // Info sheet
    const infoData = [
      { 'Informasi': 'Nama Anggota', 'Nilai': member.memberName },
      { 'Informasi': 'No. Anggota', 'Nilai': member.memberNumber },
      { 'Informasi': 'Pokok Pinjaman', 'Nilai': member.loanPrincipal },
      { 'Informasi': 'Tenor', 'Nilai': `${member.loanTenor} bulan` },
      { 'Informasi': 'Tanggal Cair', 'Nilai': member.loanDisbursementDate || '-' },
      { 'Informasi': 'Total Angsuran', 'Nilai': member.totalInstallments },
      { 'Informasi': 'Sudah Lunas', 'Nilai': member.paidCount },
      { 'Informasi': 'Terlambat', 'Nilai': member.overdueCount },
      { 'Informasi': 'Total Dibayar', 'Nilai': member.totalPaid },
      { 'Informasi': 'Total Tertunggak', 'Nilai': member.totalOutstanding },
    ];

    // Detail sheet
    const detailData = member.installments.map((inst, idx) => {
      const effectiveInterest = inst.adjustedInterestAmount ?? inst.interestAmount;
      const effectivePenalty = inst.adjustedPenaltyAmount ?? inst.penaltyAmount;
      const effectiveTotal = inst.principalAmount + effectiveInterest + effectivePenalty;

      return {
        'No': idx + 1,
        'Angsuran Ke': inst.installmentNumber,
        'Jatuh Tempo': inst.dueDate,
        'Pokok': inst.principalAmount,
        'Bunga': effectiveInterest,
        'Denda': effectivePenalty,
        'Total': effectiveTotal,
        'Dibayar': inst.paidAmount,
        'Tgl Bayar': inst.paidDate || '-',
        'Status': inst.status === 'paid' ? 'Lunas' : inst.status === 'overdue' ? 'Terlambat' : 'Menunggu',
        'Keterangan': inst.adjustmentReason || '-',
      };
    });

    const fileName = `Angsuran_${member.memberNumber || 'Anggota'}_${member.memberName.replace(/\s+/g, '_')}_${selectedYear}.xlsx`;
    createAndDownloadExcelFromJson(
      [
        { name: 'Info Pinjaman', data: infoData },
        { name: 'Detail Angsuran', data: detailData }
      ],
      fileName
    );
  };

  const handleExportMemberPDF = (member: MemberInstallmentSummary) => {
    const settings = getCooperativeSettings();
    const doc = new jsPDF();

    // Header
    doc.setFontSize(14);
    doc.text(settings.name, 14, 15);
    doc.setFontSize(12);
    doc.text('Buku Angsuran Pinjaman', 14, 22);
    doc.setFontSize(10);
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 28);

    // Member info
    doc.setFontSize(10);
    doc.text(`Nama: ${member.memberName}`, 14, 38);
    doc.text(`No. Anggota: ${member.memberNumber}`, 14, 44);
    doc.text(`Pokok Pinjaman: Rp ${member.loanPrincipal.toLocaleString('id-ID')}`, 14, 50);
    doc.text(`Tenor: ${member.loanTenor} bulan`, 100, 50);
    doc.text(`Tanggal Cair: ${member.loanDisbursementDate || '-'}`, 14, 56);

    // Summary
    doc.text(`Lunas: ${member.paidCount}/${member.totalInstallments} | Terlambat: ${member.overdueCount} | Tertunggak: Rp ${member.totalOutstanding.toLocaleString('id-ID')}`, 14, 66);

    // Table
    const tableData = member.installments.map((inst, idx) => {
      const effectiveInterest = inst.adjustedInterestAmount ?? inst.interestAmount;
      const effectivePenalty = inst.adjustedPenaltyAmount ?? inst.penaltyAmount;
      const effectiveTotal = inst.principalAmount + effectiveInterest + effectivePenalty;

      return [
        inst.installmentNumber,
        inst.dueDate,
        `Rp ${inst.principalAmount.toLocaleString('id-ID')}`,
        `Rp ${effectiveInterest.toLocaleString('id-ID')}`,
        `Rp ${effectivePenalty.toLocaleString('id-ID')}`,
        `Rp ${effectiveTotal.toLocaleString('id-ID')}`,
        `Rp ${inst.paidAmount.toLocaleString('id-ID')}`,
        inst.status === 'paid' ? 'Lunas' : inst.status === 'overdue' ? 'Terlambat' : 'Menunggu',
      ];
    });

    autoTable(doc, {
      startY: 72,
      head: [['Ke-', 'Jatuh Tempo', 'Pokok', 'Bunga', 'Denda', 'Total', 'Dibayar', 'Status']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const fileName = `Angsuran_${member.memberNumber || 'Anggota'}_${member.memberName.replace(/\s+/g, '_')}_${selectedYear}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Buku Angsuran Per Anggota</h2>
          <p className="text-sm text-muted-foreground">Pilih anggota untuk melihat detail angsuran</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Tahun" />
              </SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari anggota..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Pinjaman</span>
            </div>
            <p className="text-xl font-bold text-foreground mt-1">{overallStats.totalMembers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Semua Lunas</span>
            </div>
            <p className="text-xl font-bold text-green-600 mt-1">{overallStats.totalAllPaid}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Ada Terlambat</span>
            </div>
            <p className="text-xl font-bold text-destructive mt-1">{overallStats.totalWithOverdue}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Total Tertunggak</span>
            </div>
            <p className="text-lg font-bold text-amber-600 mt-1">{formatCurrency(overallStats.totalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Member List */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Tidak ada data pinjaman untuk periode ini</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <div
                  key={`${member.userId}-${member.loanPrincipal}-${member.loanDisbursementDate}`}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => openDetail(member)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{member.memberName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{member.memberNumber}</span>
                        <span>•</span>
                        <span>{formatCurrency(member.loanPrincipal)}</span>
                        <span>•</span>
                        <span>{member.loanTenor} bln</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-green-600 font-medium">{member.paidCount}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-muted-foreground">{member.totalInstallments}</span>
                      </div>
                      {member.overdueCount > 0 ? (
                        <Badge variant="destructive" className="text-xs">{member.overdueCount} Terlambat</Badge>
                      ) : member.paidCount === member.totalInstallments ? (
                        <Badge className="bg-green-600 text-xs">Lunas</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Berjalan</Badge>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pr-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle>Detail Angsuran - {selectedMember?.memberName}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedMember?.memberNumber} • {formatCurrency(selectedMember?.loanPrincipal || 0)} • {selectedMember?.loanTenor} bulan
                </p>
              </div>
              {selectedMember && (
                <ExportButtons
                  onExportExcel={() => handleExportMemberExcel(selectedMember)}
                  onExportPDF={() => handleExportMemberPDF(selectedMember)}
                />
              )}
            </div>
          </DialogHeader>

          {selectedMember && (
            <div className="flex-1 overflow-auto space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Total Angsuran</p>
                  <p className="text-lg font-bold">{selectedMember.totalInstallments}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10">
                  <p className="text-xs text-muted-foreground">Sudah Lunas</p>
                  <p className="text-lg font-bold text-green-600">{selectedMember.paidCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/10">
                  <p className="text-xs text-muted-foreground">Terlambat</p>
                  <p className="text-lg font-bold text-destructive">{selectedMember.overdueCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <p className="text-xs text-muted-foreground">Tertunggak</p>
                  <p className="text-lg font-bold text-amber-600">{formatCurrency(selectedMember.totalOutstanding)}</p>
                </div>
              </div>

              {/* Table */}
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Ke-</TableHead>
                      <TableHead>Jatuh Tempo</TableHead>
                      <TableHead className="text-right">Pokok</TableHead>
                      <TableHead className="text-right">Bunga</TableHead>
                      <TableHead className="text-right">Denda</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Dibayar</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMember.installments.map((inst) => {
                      const effectiveInterest = inst.adjustedInterestAmount ?? inst.interestAmount;
                      const effectivePenalty = inst.adjustedPenaltyAmount ?? inst.penaltyAmount;
                      const effectiveTotal = inst.principalAmount + effectiveInterest + effectivePenalty;
                      const hasAdjustment = inst.adjustedInterestAmount !== null || inst.adjustedPenaltyAmount !== null;

                      return (
                        <TableRow key={inst.id} className={hasAdjustment ? 'bg-green-500/5' : ''}>
                          <TableCell className="font-medium">{inst.installmentNumber}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(inst.dueDate)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(inst.principalAmount)}</TableCell>
                          <TableCell className="text-right">
                            {hasAdjustment && inst.adjustedInterestAmount !== null ? (
                              <span className="text-green-600">{formatCurrency(effectiveInterest)}</span>
                            ) : (
                              formatCurrency(inst.interestAmount)
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {hasAdjustment && inst.adjustedPenaltyAmount !== null ? (
                              <span className="text-green-600">{formatCurrency(effectivePenalty)}</span>
                            ) : (
                              formatCurrency(inst.penaltyAmount)
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(effectiveTotal)}</TableCell>
                          <TableCell className="text-right">
                            {inst.paidAmount > 0 ? (
                              <span className={inst.paidAmount >= effectiveTotal ? 'text-green-600' : 'text-yellow-600'}>
                                {formatCurrency(inst.paidAmount)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(inst.status)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Total row */}
              <div className="flex justify-end gap-6 p-3 bg-muted/50 rounded-lg text-sm">
                <div>
                  <span className="text-muted-foreground">Total Tagihan: </span>
                  <span className="font-bold">{formatCurrency(selectedMember.totalAmount)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Dibayar: </span>
                  <span className="font-bold text-green-600">{formatCurrency(selectedMember.totalPaid)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sisa: </span>
                  <span className="font-bold text-amber-600">{formatCurrency(selectedMember.totalOutstanding)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
