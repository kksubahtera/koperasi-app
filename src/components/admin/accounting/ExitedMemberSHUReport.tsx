import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ExportButtons } from '@/components/ui/export-buttons';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useExitedMemberSHUReport,
  ExitedMemberSHURecord,
} from '@/hooks/useExitedMemberSHUReport';
import {
  Users,
  Calculator,
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Info,
  Trash2,
  Banknote,
  TrendingUp,
  Percent,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';

interface ExitedMemberSHUReportProps {
  year: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercent = (value: number) => {
  return `${(value * 100).toFixed(1)}%`;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'paid':
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Sudah Dibayar
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
          <XCircle className="h-3 w-3 mr-1" />
          Dibatalkan
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
  }
};

const getMethodLabel = (method: string) => {
  switch (method) {
    case 'pro_rata':
      return 'Pro-Rata (Proporsional)';
    case 'full':
      return 'Penuh (100%)';
    case 'at_exit':
      return 'Saat Keluar';
    default:
      return method;
  }
};

export const ExitedMemberSHUReport = ({ year }: ExitedMemberSHUReportProps) => {
  const {
    records,
    summary,
    settings,
    isLoading,
    isCalculating,
    calculateAndGenerateRecords,
    updatePaymentStatus,
    deleteRecord,
  } = useExitedMemberSHUReport(year);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<ExitedMemberSHURecord | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [paymentNote, setPaymentNote] = useState('');

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch =
        record.member_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.member_number?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || record.payment_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [records, searchTerm, statusFilter]);

  const handleMarkAsPaid = (record: ExitedMemberSHURecord) => {
    setSelectedRecord(record);
    setPaymentMethod('transfer');
    setPaymentNote('');
    setShowPaymentDialog(true);
  };

  const handleConfirmPayment = async () => {
    if (selectedRecord) {
      await updatePaymentStatus(selectedRecord.id, 'paid', paymentMethod, paymentNote);
      setShowPaymentDialog(false);
      setSelectedRecord(null);
    }
  };

  const handleCancelPayment = async (record: ExitedMemberSHURecord) => {
    await updatePaymentStatus(record.id, 'cancelled', undefined, 'Dibatalkan oleh admin');
  };

  const handleResetToPending = async (record: ExitedMemberSHURecord) => {
    await updatePaymentStatus(record.id, 'pending');
  };

  const handleDeleteConfirm = async () => {
    if (selectedRecord) {
      await deleteRecord(selectedRecord.id);
      setShowDeleteDialog(false);
      setSelectedRecord(null);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredRecords.map((record, index) => ({
      No: index + 1,
      'No. Anggota': record.member_number || '-',
      Nama: record.member_name,
      'Tanggal Bergabung': record.join_date
        ? format(new Date(record.join_date), 'dd/MM/yyyy')
        : '-',
      'Tanggal Keluar': format(new Date(record.exit_date), 'dd/MM/yyyy'),
      'Bulan Aktif': `${record.active_months}/${record.total_months}`,
      'Faktor Pro-rata': formatPercent(record.proportion_factor),
      'Metode Perhitungan': getMethodLabel(record.calculation_method),
      'Total Simpanan': record.total_simpanan,
      'Jasa Usaha': record.total_jasa_usaha,
      'SHU Simpanan (Base)': record.base_simpanan_share,
      'SHU Simpanan (Final)': record.final_simpanan_share,
      'SHU Jasa Usaha (Base)': record.base_jasa_usaha_share,
      'SHU Jasa Usaha (Final)': record.final_jasa_usaha_share,
      'Total SHU': record.total_shu_amount,
      Status: record.payment_status === 'paid' ? 'Sudah Dibayar' : record.payment_status === 'cancelled' ? 'Dibatalkan' : 'Pending',
      'Tanggal Pembayaran': record.payment_date
        ? format(new Date(record.payment_date), 'dd/MM/yyyy')
        : '-',
      'Metode Pembayaran': record.payment_method || '-',
      Catatan: record.payment_note || '-',
    }));

    createAndDownloadExcelFromJson(
      [{ name: 'Laporan SHU Anggota Keluar', data: exportData }],
      `Laporan_SHU_Anggota_Keluar_${year}.xlsx`
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Laporan SHU Anggota Keluar - Tahun {year}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Detail perhitungan dan status pembayaran SHU untuk anggota yang keluar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={calculateAndGenerateRecords}
            disabled={isCalculating}
            className="gap-2"
          >
            {isCalculating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4" />
            )}
            {isCalculating ? 'Menghitung...' : 'Hitung Ulang'}
          </Button>
          <ExportButtons
            onExportExcel={handleExportExcel}
            hidePDF
            excelLabel="Export Excel"
          />
        </div>
      </div>

      {/* Settings Info */}
      {settings.enabled && (
        <Card variant="flat" className="border-primary/20 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4 text-primary" />
              <span className="font-medium">Metode Aktif:</span>
              <Badge variant="secondary">{getMethodLabel(settings.calculationMethod)}</Badge>
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">
                Waktu Pembayaran: {settings.paymentTime === 'with_distribution' ? 'Bersamaan Distribusi' : settings.paymentTime === 'on_exit' ? 'Saat Keluar' : 'Akhir Tahun'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {!settings.enabled && (
        <Card variant="flat" className="border-warning/20 bg-warning/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertCircle className="h-4 w-4" />
              <span>
                Fitur SHU untuk anggota keluar belum diaktifkan. Aktifkan di menu Pengaturan SHU
                Anggota Keluar.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Anggota Keluar</p>
                <p className="text-xl font-bold">{summary.totalExitedMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Banknote className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total SHU</p>
                <p className="text-lg font-bold">{formatCurrency(summary.totalSHUAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sudah Dibayar</p>
                <p className="text-lg font-bold">{formatCurrency(summary.paidAmount)}</p>
                <p className="text-xs text-muted-foreground">{summary.paidCount} anggota</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Belum Dibayar</p>
                <p className="text-lg font-bold">{formatCurrency(summary.pendingAmount)}</p>
                <p className="text-xs text-muted-foreground">{summary.pendingCount} anggota</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau nomor anggota..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Sudah Dibayar</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detail SHU Anggota Keluar</CardTitle>
          <CardDescription>
            {filteredRecords.length} dari {records.length} data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Tidak ada data ditemukan</p>
              {records.length === 0 && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={calculateAndGenerateRecords}
                  disabled={isCalculating}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Hitung SHU Anggota Keluar
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead>Anggota</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Periode
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Percent className="h-3 w-3" />
                      Pro-rata
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingUp className="h-3 w-3" />
                      SHU Simpanan
                    </div>
                  </TableHead>
                  <TableHead className="text-right">SHU Jasa Usaha</TableHead>
                  <TableHead className="text-right">Total SHU</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record, index) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{record.member_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {record.member_number || '-'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-xs">
                        <p className="text-muted-foreground">
                          {record.join_date
                            ? format(new Date(record.join_date), 'dd MMM yyyy', { locale: localeId })
                            : '-'}
                        </p>
                        <p className="font-medium">
                          → {format(new Date(record.exit_date), 'dd MMM yyyy', { locale: localeId })}
                        </p>
                        <p className="text-muted-foreground">
                          {record.active_months}/{record.total_months} bulan
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {formatPercent(record.proportion_factor)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-xs">
                        <p className="text-muted-foreground line-through">
                          {formatCurrency(record.base_simpanan_share)}
                        </p>
                        <p className="font-medium text-success">
                          {formatCurrency(record.final_simpanan_share)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-xs">
                        <p className="text-muted-foreground line-through">
                          {formatCurrency(record.base_jasa_usaha_share)}
                        </p>
                        <p className="font-medium text-success">
                          {formatCurrency(record.final_jasa_usaha_share)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-bold text-primary">
                        {formatCurrency(record.total_shu_amount)}
                      </p>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(record.payment_status)}
                      {record.payment_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(record.payment_date), 'dd/MM/yy')}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {record.payment_status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => handleMarkAsPaid(record)}>
                                <CheckCircle className="h-4 w-4 mr-2 text-success" />
                                Tandai Dibayar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCancelPayment(record)}>
                                <XCircle className="h-4 w-4 mr-2 text-destructive" />
                                Batalkan
                              </DropdownMenuItem>
                            </>
                          )}
                          {record.payment_status === 'paid' && (
                            <DropdownMenuItem onClick={() => handleResetToPending(record)}>
                              <Clock className="h-4 w-4 mr-2" />
                              Kembalikan ke Pending
                            </DropdownMenuItem>
                          )}
                          {record.payment_status === 'cancelled' && (
                            <DropdownMenuItem onClick={() => handleResetToPending(record)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Aktifkan Kembali
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedRecord(record);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Hapus Data
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembayaran SHU</DialogTitle>
            <DialogDescription>
              Tandai pembayaran SHU untuk {selectedRecord?.member_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Jumlah SHU</p>
              <p className="text-2xl font-bold text-primary">
                {selectedRecord && formatCurrency(selectedRecord.total_shu_amount)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Metode Pembayaran</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transfer Bank</SelectItem>
                  <SelectItem value="cash">Tunai</SelectItem>
                  <SelectItem value="check">Cek/Giro</SelectItem>
                  <SelectItem value="other">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Catatan (opsional)</Label>
              <Textarea
                placeholder="Tambahkan catatan pembayaran..."
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleConfirmPayment}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Konfirmasi Pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Data SHU</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus data SHU untuk {selectedRecord?.member_name}? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              <Trash2 className="h-4 w-4 mr-2" />
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
