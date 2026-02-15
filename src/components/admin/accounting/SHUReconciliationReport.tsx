import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Scale, RefreshCw, CheckCircle2, AlertTriangle, XCircle, 
  FileSpreadsheet, Loader2, Download, ArrowUpDown, Info
} from 'lucide-react';
import { useSHUReconciliation, SHUReconciliationDiscrepancy } from '@/hooks/useSHUReconciliation';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';
import { toast } from 'sonner';

export const SHUReconciliationReport = () => {
  const { t } = useThemeLanguage();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'difference', direction: 'desc' });

  const { result, loading, syncing, reconcile, syncFromDistribution } = useSHUReconciliation(selectedYear);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedDiscrepancies = [...(result?.discrepancies || [])].sort((a, b) => {
    const key = sortConfig.key as keyof SHUReconciliationDiscrepancy;
    const aVal = a[key];
    const bVal = b[key];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return sortConfig.direction === 'asc' 
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(result?.discrepancies.filter(d => d.status === 'missing_record').map(d => d.userId) || []);
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, userId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSyncSelected = async () => {
    if (selectedItems.length === 0) {
      toast.warning(t('Pilih anggota yang akan disinkronkan', 'Select members to sync'));
      return;
    }
    await syncFromDistribution(selectedItems);
    setSelectedItems([]);
  };

  const handleSyncAll = async () => {
    await syncFromDistribution();
    setSelectedItems([]);
  };

  const handleExportExcel = async () => {
    if (!result) return;

    const summaryData = [
      { 'Keterangan': 'Tahun', 'Nilai': result.year },
      { 'Keterangan': 'Status Distribusi', 'Nilai': result.distributionStatus === 'confirmed' ? 'Dikonfirmasi' : result.distributionStatus === 'draft' ? 'Draft' : 'Tidak Ada' },
      { 'Keterangan': 'Total dari Distribusi', 'Nilai': result.totalFromDistribution },
      { 'Keterangan': 'Total dari Records', 'Nilai': result.totalFromRecords },
      { 'Keterangan': 'Selisih', 'Nilai': result.difference },
      { 'Keterangan': 'Tingkat Kesesuaian', 'Nilai': `${result.matchRate.toFixed(2)}%` },
      { 'Keterangan': 'Total Anggota', 'Nilai': result.totalMembers },
      { 'Keterangan': 'Cocok', 'Nilai': result.matchedCount },
      { 'Keterangan': 'Tidak Cocok', 'Nilai': result.mismatchedCount },
      { 'Keterangan': 'Record Hilang', 'Nilai': result.missingRecordsCount },
      { 'Keterangan': 'Record Orphan', 'Nilai': result.orphanRecordsCount },
    ];

    const discrepancyData = result.discrepancies.map((d, idx) => ({
      'No': idx + 1,
      'Nama Anggota': d.memberName,
      'No. Anggota': d.memberNumber || '-',
      'Di Distribusi': d.distributionAmount,
      'Di Records': d.recordAmount,
      'Selisih': d.difference,
      'Status': d.status === 'match' ? 'Cocok' 
        : d.status === 'mismatch' ? 'Tidak Cocok' 
        : d.status === 'missing_record' ? 'Record Hilang' 
        : 'Record Orphan',
    }));

    await createAndDownloadExcelFromJson(
      [
        { name: 'Ringkasan', data: summaryData },
        { name: 'Diskrepansi', data: discrepancyData },
      ],
      `Rekonsiliasi_SHU_${selectedYear}.xlsx`
    );

    toast.success(t('Laporan berhasil diekspor', 'Report exported successfully'));
  };

  const getStatusBadge = (status: SHUReconciliationDiscrepancy['status']) => {
    switch (status) {
      case 'match':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{t('Cocok', 'Match')}</Badge>;
      case 'mismatch':
        return <Badge variant="destructive">{t('Tidak Cocok', 'Mismatch')}</Badge>;
      case 'missing_record':
        return <Badge variant="outline" className="border-amber-500 text-amber-600">{t('Record Hilang', 'Missing')}</Badge>;
      case 'orphan_record':
        return <Badge variant="secondary">{t('Orphan', 'Orphan')}</Badge>;
    }
  };

  const missingRecordsCount = result?.discrepancies.filter(d => d.status === 'missing_record').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            {t('Rekonsiliasi SHU', 'SHU Reconciliation')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('Perbandingan data distribusi SHU dengan record individual anggota', 'Comparison of SHU distribution data with individual member records')}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={reconcile} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {t('Refresh', 'Refresh')}
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!result || loading}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !result ? (
        <Card className="p-8 text-center">
          <CardContent>
            <p className="text-muted-foreground">{t('Data tidak tersedia', 'Data not available')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{t('Total dari Distribusi', 'From Distribution')}</p>
                <p className="text-lg font-bold">Rp {result.totalFromDistribution.toLocaleString('id-ID')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{t('Total dari Records', 'From Records')}</p>
                <p className="text-lg font-bold">Rp {result.totalFromRecords.toLocaleString('id-ID')}</p>
              </CardContent>
            </Card>
            
            <Card className={result.difference !== 0 ? 'border-amber-300 dark:border-amber-700' : 'border-emerald-300 dark:border-emerald-700'}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{t('Selisih', 'Difference')}</p>
                <p className={`text-lg font-bold ${result.difference !== 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  Rp {Math.abs(result.difference).toLocaleString('id-ID')}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{t('Kesesuaian', 'Match Rate')}</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold">{result.matchRate.toFixed(1)}%</p>
                  {result.matchRate === 100 ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : result.matchRate < 80 ? (
                    <XCircle className="h-5 w-5 text-destructive" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Overview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('Ringkasan Status', 'Status Overview')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>{t('Status Distribusi:', 'Distribution Status:')}</span>
                <Badge variant={result.distributionStatus === 'confirmed' ? 'default' : 'secondary'}>
                  {result.distributionStatus === 'confirmed' ? t('Dikonfirmasi', 'Confirmed') 
                    : result.distributionStatus === 'draft' ? t('Draft', 'Draft') 
                    : t('Tidak Ada', 'Not Found')}
                </Badge>
              </div>
              
              <Progress value={result.matchRate} className="h-3" />
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-2">
                  <span className="block text-2xl font-bold text-emerald-600">{result.matchedCount}</span>
                  <span className="text-xs text-muted-foreground">{t('Cocok', 'Matched')}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-950/30 rounded p-2">
                  <span className="block text-2xl font-bold text-red-600">{result.mismatchedCount}</span>
                  <span className="text-xs text-muted-foreground">{t('Tidak Cocok', 'Mismatched')}</span>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded p-2">
                  <span className="block text-2xl font-bold text-amber-600">{result.missingRecordsCount}</span>
                  <span className="text-xs text-muted-foreground">{t('Record Hilang', 'Missing')}</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/30 rounded p-2">
                  <span className="block text-2xl font-bold text-gray-600">{result.orphanRecordsCount}</span>
                  <span className="text-xs text-muted-foreground">{t('Orphan', 'Orphan')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sync Actions */}
          {missingRecordsCount > 0 && result.distributionStatus === 'confirmed' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>{t('Ditemukan Record Hilang', 'Missing Records Found')}</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  {t(
                    `Ada ${missingRecordsCount} anggota yang tercatat di distribusi SHU tetapi belum memiliki record individual.`,
                    `There are ${missingRecordsCount} members recorded in SHU distribution but don't have individual records.`
                  )}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSyncAll} disabled={syncing}>
                    {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                    {t('Sinkronkan Semua', 'Sync All')}
                  </Button>
                  {selectedItems.length > 0 && (
                    <Button size="sm" variant="outline" onClick={handleSyncSelected} disabled={syncing}>
                      {t(`Sinkronkan ${selectedItems.length} Terpilih`, `Sync ${selectedItems.length} Selected`)}
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Discrepancy Table */}
          {result.discrepancies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('Daftar Diskrepansi', 'Discrepancy List')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {missingRecordsCount > 0 && result.distributionStatus === 'confirmed' && (
                          <TableHead className="w-10">
                            <Checkbox 
                              checked={selectedItems.length === missingRecordsCount && missingRecordsCount > 0}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                        )}
                        <TableHead 
                          className="cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('memberName')}
                        >
                          <div className="flex items-center gap-1">
                            {t('Anggota', 'Member')}
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead>{t('No. Anggota', 'Member No.')}</TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('distributionAmount')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            {t('Di Distribusi', 'In Distribution')}
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('recordAmount')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            {t('Di Records', 'In Records')}
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('difference')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            {t('Selisih', 'Difference')}
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead className="text-center">{t('Status', 'Status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDiscrepancies.map((item) => (
                        <TableRow key={item.userId}>
                          {missingRecordsCount > 0 && result.distributionStatus === 'confirmed' && (
                            <TableCell>
                              {item.status === 'missing_record' && (
                                <Checkbox 
                                  checked={selectedItems.includes(item.userId)}
                                  onCheckedChange={(checked) => handleSelectItem(item.userId, !!checked)}
                                />
                              )}
                            </TableCell>
                          )}
                          <TableCell className="font-medium">{item.memberName}</TableCell>
                          <TableCell className="text-muted-foreground">{item.memberNumber || '-'}</TableCell>
                          <TableCell className="text-right">
                            Rp {item.distributionAmount.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right">
                            Rp {item.recordAmount.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${item.difference !== 0 ? 'text-amber-600' : ''}`}>
                            {item.difference !== 0 ? (item.difference > 0 ? '+' : '') : ''}
                            Rp {item.difference.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge(item.status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {result.discrepancies.length === 0 && result.matchRate === 100 && (
            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {t('Rekonsiliasi Lengkap', 'Reconciliation Complete')}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('Semua data SHU anggota sudah sesuai antara distribusi dan records.', 'All member SHU data matches between distribution and records.')}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
