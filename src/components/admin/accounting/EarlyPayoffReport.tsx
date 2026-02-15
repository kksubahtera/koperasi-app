import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/filter-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Calculator, 
  TrendingDown, 
  Banknote, 
  FileText,
  Download,
  Calendar,
  User,
  CheckCircle,
  Clock,
  XCircle,
  Landmark,
  Percent,
  ArrowRight
} from 'lucide-react';
import { useEarlyPayoffReport, EarlyPayoffRecord } from '@/hooks/useEarlyPayoffReport';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'approved':
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Disetujui</Badge>;
    case 'pending':
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3 mr-1" />Menunggu</Badge>;
    case 'rejected':
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="h-3 w-3 mr-1" />Ditolak</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export const EarlyPayoffReport: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const { records, summary, isLoading, error } = useEarlyPayoffReport(selectedYear);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleExportExcel = () => {
    if (!records.length) return;

    const exportData = records.map(record => ({
      'Tanggal Pelunasan': record.payoffDate ? format(new Date(record.payoffDate), 'dd MMMM yyyy', { locale: id }) : '-',
      'Nama Anggota': record.memberName,
      'No. Anggota': record.memberNumber,
      'Pokok Pinjaman': record.principalAmount,
      'Sisa Pokok': record.remainingPrincipal,
      'Bunga Periode Sebelumnya': record.overdueInterest,
      'Denda Periode Sebelumnya': record.overduePenalty,
      'Bunga Periode Berjalan': record.currentInterest,
      'Denda Periode Berjalan': record.currentPenalty,
      'Total Bunga': record.totalInterestPaid,
      'Total Denda': record.totalPenaltyPaid,
      'Biaya Pelunasan': record.earlyPayoffFee,
      'Total Dibayar': record.totalPaid,
      'Penghematan Bunga': record.interestSaved,
      'Tenor Asli (Bulan)': record.originalTenor,
      'Angsuran Tertunggak': record.overdueInstallmentsCount,
      'Angsuran Terbayar': record.paidInstallments,
      'Sisa Angsuran': record.remainingInstallments,
      'Status': record.status === 'approved' ? 'Disetujui' : record.status === 'pending' ? 'Menunggu' : 'Ditolak',
    }));

    // Add summary row
    exportData.push({
      'Tanggal Pelunasan': 'TOTAL',
      'Nama Anggota': '',
      'No. Anggota': '',
      'Pokok Pinjaman': '',
      'Sisa Pokok': summary?.totalPrincipalRecovered || 0,
      'Bunga Periode Sebelumnya': '',
      'Denda Periode Sebelumnya': '',
      'Bunga Periode Berjalan': '',
      'Denda Periode Berjalan': '',
      'Total Bunga': summary?.totalInterestCollected || 0,
      'Total Denda': summary?.totalPenaltyCollected || 0,
      'Biaya Pelunasan': summary?.totalFeesCollected || 0,
      'Total Dibayar': records.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.totalPaid, 0),
      'Penghematan Bunga': summary?.totalInterestSaved || 0,
      'Tenor Asli (Bulan)': '',
      'Angsuran Tertunggak': '',
      'Angsuran Terbayar': '',
      'Sisa Angsuran': '',
      'Status': '',
    } as any);

    // Add accounting journal sheet
    const journalData = records
      .filter(r => r.status === 'approved')
      .flatMap(record => [
        {
          'Tanggal': record.payoffDate ? format(new Date(record.payoffDate), 'dd/MM/yyyy') : '-',
          'Keterangan': `Pelunasan Dini - ${record.memberName}`,
          'Akun': 'Kas/Bank',
          'Debit': record.totalPaid,
          'Kredit': 0,
        },
        {
          'Tanggal': '',
          'Keterangan': '',
          'Akun': 'Piutang Pinjaman',
          'Debit': 0,
          'Kredit': record.remainingPrincipal,
        },
        {
          'Tanggal': '',
          'Keterangan': '',
          'Akun': 'Pendapatan Bunga',
          'Debit': 0,
          'Kredit': record.totalInterestPaid,
        },
        ...(record.totalPenaltyPaid > 0 ? [{
          'Tanggal': '',
          'Keterangan': '',
          'Akun': 'Pendapatan Denda',
          'Debit': 0,
          'Kredit': record.totalPenaltyPaid,
        }] : []),
        ...(record.earlyPayoffFee > 0 ? [{
          'Tanggal': '',
          'Keterangan': '',
          'Akun': 'Pendapatan Biaya Admin',
          'Debit': 0,
          'Kredit': record.earlyPayoffFee,
        }] : []),
        {
          'Tanggal': '',
          'Keterangan': '---',
          'Akun': '',
          'Debit': '',
          'Kredit': '',
        },
      ]);

    createAndDownloadExcelFromJson(
      [
        { name: 'Pelunasan Dini', data: exportData },
        { name: 'Jurnal Akuntansi', data: journalData }
      ],
      `Laporan_Pelunasan_Dini_${selectedYear}.xlsx`
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Laporan Pelunasan Dini</h2>
          <p className="text-muted-foreground">
            Daftar pinjaman yang dilunasi lebih awal beserta penghematan bunga
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FilterSelect
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
            options={years.map(year => ({ value: year.toString(), label: year.toString() }))}
            showAllOption={false}
            icon={Calendar}
            triggerClassName="w-32"
          />
          <Button onClick={handleExportExcel} disabled={!records.length}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pelunasan</p>
                <p className="text-2xl font-bold">{summary?.totalEarlyPayoffs || 0}</p>
                <p className="text-xs text-muted-foreground">transaksi disetujui</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <Banknote className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pokok Diterima</p>
                <p className="text-2xl font-bold">{formatCurrency(summary?.totalPrincipalRecovered || 0)}</p>
                <p className="text-xs text-muted-foreground">piutang terlunasi</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <Percent className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bunga Diterima</p>
                <p className="text-2xl font-bold">{formatCurrency(summary?.totalInterestCollected || 0)}</p>
                <p className="text-xs text-muted-foreground">+ biaya: {formatCurrency(summary?.totalFeesCollected || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Landmark className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Penghematan Anggota</p>
                <p className="text-2xl font-bold">{formatCurrency(summary?.totalInterestSaved || 0)}</p>
                <p className="text-xs text-muted-foreground">
                  rata-rata: {formatCurrency(summary?.averageSavingsPerPayoff || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounting Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Ringkasan Jurnal Akuntansi
          </CardTitle>
          <CardDescription>
            Pencatatan pelunasan dini sesuai standar akuntansi koperasi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Debit Side */}
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                Sisi Debit
              </h4>
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Kas/Bank</span>
                  <span className="font-mono font-medium text-green-600">
                    {formatCurrency(
                      records
                        .filter(r => r.status === 'approved')
                        .reduce((sum, r) => sum + r.totalPaid, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Credit Side */}
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                Sisi Kredit
              </h4>
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Piutang Pinjaman</span>
                  <span className="font-mono font-medium text-blue-600">
                    {formatCurrency(summary?.totalPrincipalRecovered || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pendapatan Bunga</span>
                  <span className="font-mono font-medium text-blue-600">
                    {formatCurrency(summary?.totalInterestCollected || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pendapatan Denda</span>
                  <span className="font-mono font-medium text-blue-600">
                    {formatCurrency(summary?.totalPenaltyCollected || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pendapatan Biaya Admin</span>
                  <span className="font-mono font-medium text-blue-600">
                    {formatCurrency(summary?.totalFeesCollected || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Balance Check */}
          <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Selisih (harus 0)</span>
              <span className="font-mono font-semibold">
                {formatCurrency(
                  records
                    .filter(r => r.status === 'approved')
                    .reduce((sum, r) => sum + r.totalPaid, 0) -
                  (summary?.totalPrincipalRecovered || 0) -
                  (summary?.totalInterestCollected || 0) -
                  (summary?.totalFeesCollected || 0)
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Daftar Transaksi Pelunasan Dini
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-12">
              <TrendingDown className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Belum ada transaksi pelunasan dini di tahun {selectedYear}
              </p>
            </div>
          ) : (
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Anggota</TableHead>
                    <TableHead className="text-right">Sisa Pokok</TableHead>
                    <TableHead className="text-right">Bunga + Denda</TableHead>
                    <TableHead className="text-right">Biaya</TableHead>
                    <TableHead className="text-right">Total Bayar</TableHead>
                    <TableHead className="text-right">Penghematan</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {record.payoffDate 
                          ? format(new Date(record.payoffDate), 'dd MMM yyyy', { locale: id })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{record.memberName}</p>
                            <p className="text-xs text-muted-foreground">{record.memberNumber}</p>
                            {record.overdueInstallmentsCount > 0 && (
                              <p className="text-xs text-amber-600">
                                {record.overdueInstallmentsCount} angsuran tertunggak
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(record.remainingPrincipal)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-mono">
                          {formatCurrency(record.totalInterestPaid + record.totalPenaltyPaid)}
                        </div>
                        {(record.overdueInterest > 0 || record.overduePenalty > 0) && (
                          <p className="text-xs text-amber-600">
                            Tertunggak: {formatCurrency(record.overdueInterest + record.overduePenalty)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(record.earlyPayoffFee)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(record.totalPaid)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-green-600 font-semibold">
                          {formatCurrency(record.interestSaved)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(record.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>

      {/* Accounting Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catatan Pembukuan</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Jurnal Pelunasan Dini:</strong>
          </p>
          <div className="bg-muted/30 rounded-lg p-4 font-mono text-xs space-y-1">
            <p>Kas/Bank (D) ................... Rp XXX</p>
            <p className="pl-4">Piutang Pinjaman (K) ........ Rp XXX</p>
            <p className="pl-4">Pendapatan Bunga (K) ........ Rp XXX</p>
            <p className="pl-4">Pendapatan Denda (K) ........ Rp XXX</p>
            <p className="pl-4">Pendapatan Biaya Admin (K) .. Rp XXX</p>
          </div>
          <ul className="list-disc list-inside space-y-1 mt-4">
            <li>Bunga yang dibebankan hanya untuk periode berjalan saat pelunasan</li>
            <li>Bunga periode mendatang tidak dibebankan (penghematan anggota)</li>
            <li>Biaya pelunasan dini dicatat sebagai pendapatan lain-lain</li>
            <li>Piutang pinjaman berkurang sesuai sisa pokok yang dilunasi</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default EarlyPayoffReport;
