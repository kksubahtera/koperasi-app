import { useState } from 'react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useOverpaymentReport, OverpaymentRecord } from '@/hooks/useOverpaymentReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchInput } from '@/components/ui/search-input';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { FilterSelect } from '@/components/ui/filter-select';
import { ExportButtons } from '@/components/ui/export-buttons';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, TrendingUp, Wallet, ArrowDownToLine, RefreshCw } from 'lucide-react';
import { formatCurrency, formatShortDate } from '@/lib/mockData';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';

interface OverpaymentReportProps {
  onBack: () => void;
}

export const OverpaymentReport = ({ onBack }: OverpaymentReportProps) => {
  const { t } = useThemeLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [filterType, setFilterType] = useState<'all' | 'refund' | 'distributed'>('all');
  const [selectedRecord, setSelectedRecord] = useState<OverpaymentRecord | null>(null);

  const { records, statistics, isLoading, refetch } = useOverpaymentReport({
    startDate,
    endDate,
    searchQuery,
    filterType,
  });

  const handleClearFilters = () => {
    setSearchQuery('');
    setStartDate(undefined);
    setEndDate(undefined);
    setFilterType('all');
  };

  const handleExportExcel = async () => {
    // Summary sheet
    const summaryData = [
      { Keterangan: 'Total Kelebihan Pembayaran', Nilai: statistics.totalOverpayment },
      { Keterangan: 'Dikembalikan ke Simpanan', Nilai: statistics.totalRefund },
      { Keterangan: 'Diterapkan ke Angsuran', Nilai: statistics.totalDistributed },
      { Keterangan: 'Jumlah Transaksi', Nilai: statistics.totalRecords },
    ];

    // Detail sheet
    const detailData = records.map(record => ({
      'Tanggal': formatShortDate(record.createdAt),
      'Nama Anggota': record.memberName,
      'No. Anggota': record.memberNumber,
      'Total Kelebihan': record.overpaymentAmount,
      'Dikembalikan ke Simpanan': record.refundAmount,
      'Diterapkan ke Angsuran': record.distributedAmount,
      'Distribusi': record.distribution.map(d => 
        `#${d.installmentNumber}: Rp ${d.amount.toLocaleString('id-ID')}`
      ).join(', ') || '-',
      'Status': record.refundAmount > 0 ? 'Dikembalikan' : 'Diterapkan',
    }));

    const fileName = `Laporan_Kelebihan_Bayar_${new Date().toISOString().split('T')[0]}.xlsx`;
    await createAndDownloadExcelFromJson([
      { name: 'Ringkasan', data: summaryData },
      { name: 'Detail', data: detailData },
    ], fileName);
  };

  const filterOptions = [
    { value: 'all', label: t('Semua', 'All') },
    { value: 'refund', label: t('Dikembalikan', 'Refunded') },
    { value: 'distributed', label: t('Diterapkan', 'Applied') },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">
              {t('Laporan Kelebihan Pembayaran', 'Overpayment Report')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('Riwayat kelebihan bayar yang dikembalikan/diterapkan', 'History of refunded/applied overpayments')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('Refresh', 'Refresh')}
          </Button>
          <ExportButtons
            onExportExcel={handleExportExcel}
            hidePDF
            excelLabel={t('Export Excel', 'Export Excel')}
            disabled={records.length === 0}
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('Total Kelebihan', 'Total Overpayment')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(statistics.totalOverpayment)}</p>
            <p className="text-xs text-muted-foreground">{statistics.totalRecords} {t('transaksi', 'transactions')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-success" />
              {t('Dikembalikan ke Simpanan', 'Refunded to Savings')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{formatCurrency(statistics.totalRefund)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-info" />
              {t('Diterapkan ke Angsuran', 'Applied to Installments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-info">{formatCurrency(statistics.totalDistributed)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <SearchInput
              placeholder={t('Cari anggota...', 'Search member...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              className="w-full sm:w-64"
            />
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={handleClearFilters}
            />
            <FilterSelect
              value={filterType}
              onValueChange={(v) => setFilterType(v as 'all' | 'refund' | 'distributed')}
              options={filterOptions}
              placeholder={t('Tipe', 'Type')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Wallet className="h-10 w-10 mb-2" />
              <p>{t('Tidak ada data kelebihan pembayaran', 'No overpayment records found')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Tanggal', 'Date')}</TableHead>
                  <TableHead>{t('Anggota', 'Member')}</TableHead>
                  <TableHead className="text-right">{t('Kelebihan', 'Overpayment')}</TableHead>
                  <TableHead>{t('Status', 'Status')}</TableHead>
                  <TableHead className="text-center">{t('Detail', 'Detail')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatShortDate(record.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{record.memberName}</p>
                        <p className="text-xs text-muted-foreground">{record.memberNumber}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(record.overpaymentAmount)}
                    </TableCell>
                    <TableCell>
                      {record.refundAmount > 0 ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                          {t('Dikembalikan', 'Refunded')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-info/10 text-info border-info/30">
                          {t('Diterapkan', 'Applied')}
                        </Badge>
                      )}
                      {record.distribution.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {record.distribution.map(d => `#${d.installmentNumber}`).join(', ')}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Detail Kelebihan Pembayaran', 'Overpayment Details')}</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('Nama Anggota', 'Member Name')}</p>
                  <p className="font-medium">{selectedRecord.memberName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('No. Anggota', 'Member Number')}</p>
                  <p className="font-medium">{selectedRecord.memberNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('Tanggal', 'Date')}</p>
                  <p className="font-medium">{formatShortDate(selectedRecord.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('Total Kelebihan', 'Total Overpayment')}</p>
                  <p className="font-medium">{formatCurrency(selectedRecord.overpaymentAmount)}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">{t('Breakdown', 'Breakdown')}</p>
                <div className="space-y-2">
                  {selectedRecord.distribution.length > 0 && (
                    <div className="p-3 rounded-lg bg-info/10 border border-info/30">
                      <p className="text-sm font-medium text-info mb-2">
                        {t('Diterapkan ke Angsuran', 'Applied to Installments')}
                      </p>
                      <div className="space-y-1">
                        {selectedRecord.distribution.map((d, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{t('Angsuran', 'Installment')} #{d.installmentNumber}</span>
                            <span className="font-medium">{formatCurrency(d.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedRecord.refundAmount > 0 && (
                    <div className="p-3 rounded-lg bg-success/10 border border-success/30">
                      <div className="flex justify-between text-sm">
                        <span className="text-success font-medium">
                          {t('Dikembalikan ke Simpanan Sukarela', 'Refunded to Voluntary Savings')}
                        </span>
                        <span className="font-medium text-success">
                          {formatCurrency(selectedRecord.refundAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedRecord.transactionId && (
                <div className="text-xs text-muted-foreground">
                  Transaction ID: {selectedRecord.transactionId}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
