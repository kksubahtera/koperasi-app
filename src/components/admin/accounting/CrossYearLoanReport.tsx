import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileSpreadsheet, TrendingUp, TrendingDown, Calendar, Users, Banknote } from 'lucide-react';
import { formatCurrency } from '@/lib/mockData';
import { useCrossYearLoans } from '@/hooks/useCrossYearLoans';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';
import { toast } from 'sonner';

export const CrossYearLoanReport = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  const { data: loans, isLoading } = useCrossYearLoans(selectedYear);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Calculate totals
  const totals = loans?.reduce((acc, loan) => ({
    principalStartOfYear: acc.principalStartOfYear + loan.principalStartOfYear,
    principalPaidDuringYear: acc.principalPaidDuringYear + loan.principalPaidDuringYear,
    interestPaidDuringYear: acc.interestPaidDuringYear + loan.interestPaidDuringYear,
    penaltyPaidDuringYear: acc.penaltyPaidDuringYear + loan.penaltyPaidDuringYear,
    principalEndOfYear: acc.principalEndOfYear + loan.principalEndOfYear,
  }), {
    principalStartOfYear: 0,
    principalPaidDuringYear: 0,
    interestPaidDuringYear: 0,
    penaltyPaidDuringYear: 0,
    principalEndOfYear: 0,
  });

  const handleExportExcel = async () => {
    if (!loans || loans.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const exportData = loans.map((loan, idx) => ({
      'No': idx + 1,
      'No. Anggota': loan.memberNumber || '-',
      'Nama Anggota': loan.memberName,
      'Pokok Pinjaman': loan.principalAmount,
      'Tenor (Bulan)': loan.tenor,
      'Bunga (%)': loan.interestRate,
      'Tanggal Cair': format(new Date(loan.disbursementDate), 'dd/MM/yyyy'),
      'Sisa Pokok Awal Tahun': loan.principalStartOfYear,
      'Angsuran Terbayar Sebelumnya': loan.installmentsPaidBeforeYear,
      'Pokok Dibayar Tahun Ini': loan.principalPaidDuringYear,
      'Bunga Dibayar Tahun Ini': loan.interestPaidDuringYear,
      'Denda Dibayar Tahun Ini': loan.penaltyPaidDuringYear,
      'Angsuran Terbayar Tahun Ini': loan.installmentsPaidDuringYear,
      'Sisa Pokok Akhir Tahun': loan.principalEndOfYear,
      'Angsuran Tersisa': loan.installmentsRemaining,
      'Status': loan.status === 'active' ? 'Aktif' : 'Lunas',
    }));

    // Add totals row
    exportData.push({
      'No': null as any,
      'No. Anggota': '',
      'Nama Anggota': 'TOTAL',
      'Pokok Pinjaman': loans.reduce((sum, l) => sum + l.principalAmount, 0),
      'Tenor (Bulan)': null as any,
      'Bunga (%)': null as any,
      'Tanggal Cair': '',
      'Sisa Pokok Awal Tahun': totals?.principalStartOfYear || 0,
      'Angsuran Terbayar Sebelumnya': null as any,
      'Pokok Dibayar Tahun Ini': totals?.principalPaidDuringYear || 0,
      'Bunga Dibayar Tahun Ini': totals?.interestPaidDuringYear || 0,
      'Denda Dibayar Tahun Ini': totals?.penaltyPaidDuringYear || 0,
      'Angsuran Terbayar Tahun Ini': loans.reduce((sum, l) => sum + l.installmentsPaidDuringYear, 0),
      'Sisa Pokok Akhir Tahun': totals?.principalEndOfYear || 0,
      'Angsuran Tersisa': loans.reduce((sum, l) => sum + l.installmentsRemaining, 0),
      'Status': '',
    });

    await createAndDownloadExcelFromJson(
      [{ name: 'Pinjaman Lintas Tahun', data: exportData }],
      `Laporan_Pinjaman_Lintas_Tahun_${selectedYear}.xlsx`
    );
    toast.success('Laporan berhasil diekspor ke Excel');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Laporan Pinjaman Lintas Tahun</h2>
          <p className="text-sm text-muted-foreground">
            Status pinjaman di awal dan akhir tahun buku {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!loans?.length}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Peminjam</span>
            </div>
            <p className="text-2xl font-bold">{loans?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Sisa Pokok Awal</span>
            </div>
            <p className="text-lg font-bold">{formatCurrency(totals?.principalStartOfYear || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Pokok Terbayar</span>
            </div>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totals?.principalPaidDuringYear || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Sisa Pokok Akhir</span>
            </div>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(totals?.principalEndOfYear || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Income from Interest & Penalty */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pendapatan Pinjaman Tahun {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Pendapatan Bunga</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totals?.interestPaidDuringYear || 0)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Pendapatan Denda</p>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(totals?.penaltyPaidDuringYear || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detail Pinjaman</CardTitle>
          <CardDescription>
            Daftar pinjaman yang aktif selama tahun {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!loans || loans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Tidak ada data pinjaman lintas tahun untuk tahun {selectedYear}</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">No</TableHead>
                    <TableHead>Anggota</TableHead>
                    <TableHead className="text-right">Pokok Pinjaman</TableHead>
                    <TableHead className="text-center">Tenor</TableHead>
                    <TableHead className="text-right">Sisa Awal Tahun</TableHead>
                    <TableHead className="text-right">Terbayar Tahun Ini</TableHead>
                    <TableHead className="text-right">Sisa Akhir Tahun</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan, idx) => (
                    <TableRow key={loan.loanId}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{loan.memberName}</p>
                          <p className="text-xs text-muted-foreground">{loan.memberNumber || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(loan.principalAmount)}</TableCell>
                      <TableCell className="text-center">{loan.tenor} bln</TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p>{formatCurrency(loan.principalStartOfYear)}</p>
                          <p className="text-xs text-muted-foreground">
                            {loan.installmentsPaidBeforeYear} angsuran terbayar
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p className="text-green-600">{formatCurrency(loan.principalPaidDuringYear)}</p>
                          <p className="text-xs text-muted-foreground">
                            {loan.installmentsPaidDuringYear} angsuran
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p className="font-medium">{formatCurrency(loan.principalEndOfYear)}</p>
                          <p className="text-xs text-muted-foreground">
                            {loan.installmentsRemaining} tersisa
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={loan.status === 'active' ? 'default' : 'secondary'}>
                          {loan.status === 'active' ? 'Aktif' : 'Lunas'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>TOTAL</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(loans.reduce((sum, l) => sum + l.principalAmount, 0))}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{formatCurrency(totals?.principalStartOfYear || 0)}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(totals?.principalPaidDuringYear || 0)}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(totals?.principalEndOfYear || 0)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
