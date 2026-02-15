import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  useBalanceReconciliation, 
  MemberBalanceDiscrepancy 
} from '@/hooks/useBalanceReconciliation';
import { formatCurrency } from '@/lib/mockData';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  Wrench,
  Search,
  FileDown,
  Scale
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';

const typeLabels: Record<string, string> = {
  simpanan_pokok: 'Simpanan Pokok',
  simpanan_wajib: 'Simpanan Wajib',
  simpanan_sukarela: 'Simpanan Sukarela',
};

export const BalanceReconciliationDashboard = () => {
  const { 
    loading, 
    discrepancies, 
    summary, 
    calculateBalanceFromTransactions,
    fixDiscrepancy 
  } = useBalanceReconciliation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<MemberBalanceDiscrepancy | null>(null);

  useEffect(() => {
    calculateBalanceFromTransactions();
  }, [calculateBalanceFromTransactions]);

  const handleRefresh = () => {
    calculateBalanceFromTransactions();
    toast.success('Rekonsiliasi diperbarui');
  };

  const handleFixClick = (discrepancy: MemberBalanceDiscrepancy) => {
    setSelectedDiscrepancy(discrepancy);
    setFixDialogOpen(true);
  };

  const handleConfirmFix = async (mode: 'adjust_savings' | 'create_correction') => {
    if (!selectedDiscrepancy) return;

    setFixing(selectedDiscrepancy.userId + selectedDiscrepancy.type);
    setFixDialogOpen(false);

    const success = await fixDiscrepancy(selectedDiscrepancy, mode);
    
    if (success) {
      toast.success('Selisih berhasil diperbaiki');
      calculateBalanceFromTransactions();
    } else {
      toast.error('Gagal memperbaiki selisih');
    }

    setFixing(null);
    setSelectedDiscrepancy(null);
  };

  const handleExportExcel = async () => {
    if (discrepancies.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const exportData = discrepancies.map(d => ({
      'No. Anggota': d.memberNumber || '-',
      'Nama Anggota': d.memberName,
      'Jenis Simpanan': typeLabels[d.type],
      'Saldo Kalkulasi': d.calculatedBalance,
      'Saldo Aktual': d.actualBalance,
      'Selisih': d.difference,
      'Jumlah Transaksi': d.transactionCount,
      'Jumlah Koreksi': d.correctionCount,
      'Total Koreksi': d.totalCorrections,
    }));

    await createAndDownloadExcelFromJson(
      [{ name: 'Rekonsiliasi Saldo', data: exportData }],
      `Rekonsiliasi-Saldo-${new Date().toISOString().split('T')[0]}.xlsx`
    );
    toast.success('File Excel berhasil diunduh');
  };

  const filteredDiscrepancies = discrepancies.filter(d => {
    const matchesSearch = 
      d.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.memberNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || d.type === filterType;
    return matchesSearch && matchesType;
  });

  const reconciliationRate = summary ? 100 - summary.discrepancyRate : 100;
  const isHealthy = reconciliationRate >= 95;
  const isWarning = reconciliationRate >= 80 && reconciliationRate < 95;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Dashboard Rekonsiliasi Saldo</h2>
            <p className="text-sm text-muted-foreground">
              Perbandingan saldo kalkulasi vs saldo aktual database
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={loading || discrepancies.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={handleRefresh} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className={`${isHealthy ? 'border-success/30' : isWarning ? 'border-warning/30' : 'border-destructive/30'}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tingkat Rekonsiliasi</p>
                  <p className={`text-2xl font-bold ${isHealthy ? 'text-success' : isWarning ? 'text-warning' : 'text-destructive'}`}>
                    {reconciliationRate.toFixed(1)}%
                  </p>
                </div>
                {isHealthy ? (
                  <CheckCircle2 className="h-8 w-8 text-success" />
                ) : isWarning ? (
                  <AlertTriangle className="h-8 w-8 text-warning" />
                ) : (
                  <XCircle className="h-8 w-8 text-destructive" />
                )}
              </div>
              <Progress 
                value={reconciliationRate} 
                className="mt-3 h-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Anggota</p>
                  <p className="text-2xl font-bold">{summary.totalMembers}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Dengan Selisih</p>
                  <p className="text-xl font-bold text-destructive">
                    {summary.membersWithDiscrepancies}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Selisih</p>
              <p className="text-2xl font-bold text-warning">
                {formatCurrency(summary.totalDiscrepancyAmount)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Dari {discrepancies.length} item ketidaksesuaian
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Distribusi per Jenis</p>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Pokok:</span>
                  <span className="font-medium">{summary.byType.simpanan_pokok.count}</span>
                </div>
                <div className="flex justify-between">
                  <span>Wajib:</span>
                  <span className="font-medium">{summary.byType.simpanan_wajib.count}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sukarela:</span>
                  <span className="font-medium">{summary.byType.simpanan_sukarela.count}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Discrepancies Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Daftar Ketidaksesuaian</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari anggota..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Tabs value={filterType} onValueChange={setFilterType}>
                <TabsList className="h-9">
                  <TabsTrigger value="all" className="text-xs">Semua</TabsTrigger>
                  <TabsTrigger value="simpanan_pokok" className="text-xs">Pokok</TabsTrigger>
                  <TabsTrigger value="simpanan_wajib" className="text-xs">Wajib</TabsTrigger>
                  <TabsTrigger value="simpanan_sukarela" className="text-xs">Sukarela</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredDiscrepancies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <p className="mt-4 text-lg font-medium">Semua Saldo Sesuai!</p>
              <p className="text-muted-foreground">
                Tidak ada ketidaksesuaian antara saldo kalkulasi dan saldo database.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anggota</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="text-right">Saldo Kalkulasi</TableHead>
                    <TableHead className="text-right">Saldo Aktual</TableHead>
                    <TableHead className="text-right">Selisih</TableHead>
                    <TableHead className="text-center">Transaksi</TableHead>
                    <TableHead className="text-center">Koreksi</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDiscrepancies.map((d, idx) => (
                    <TableRow key={`${d.userId}-${d.type}-${idx}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{d.memberName}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.memberNumber || '-'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabels[d.type]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(d.calculatedBalance)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(d.actualBalance)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {d.difference > 0 ? (
                            <ArrowUpCircle className="h-4 w-4 text-success" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className={`font-mono font-medium ${d.difference > 0 ? 'text-success' : 'text-destructive'}`}>
                            {d.difference > 0 ? '+' : ''}{formatCurrency(d.difference)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{d.transactionCount}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{d.correctionCount}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFixClick(d)}
                          disabled={fixing === d.userId + d.type}
                        >
                          {fixing === d.userId + d.type ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wrench className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fix Dialog */}
      <AlertDialog open={fixDialogOpen} onOpenChange={setFixDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Perbaiki Ketidaksesuaian</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedDiscrepancy && (
                <div className="space-y-3 pt-2">
                  <p>
                    <strong>{selectedDiscrepancy.memberName}</strong> - {typeLabels[selectedDiscrepancy.type]}
                  </p>
                  <div className="rounded-lg border p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Saldo Kalkulasi:</span>
                      <span className="font-mono">{formatCurrency(selectedDiscrepancy.calculatedBalance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Saldo Aktual:</span>
                      <span className="font-mono">{formatCurrency(selectedDiscrepancy.actualBalance)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span>Selisih:</span>
                      <span className={`font-mono font-bold ${selectedDiscrepancy.difference > 0 ? 'text-success' : 'text-destructive'}`}>
                        {selectedDiscrepancy.difference > 0 ? '+' : ''}{formatCurrency(selectedDiscrepancy.difference)}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground">
                    Pilih metode perbaikan:
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleConfirmFix('adjust_savings')}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Update Langsung
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleConfirmFix('create_correction')}
            >
              Buat Koreksi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
