import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RefreshCw, CheckCircle, AlertTriangle, Download, Wrench } from 'lucide-react';
import { useSavingsReconciliation, SavingsDiscrepancy } from '@/hooks/useSavingsReconciliation';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';

const typeLabels: Record<string, string> = {
  simpanan_pokok: 'Simpanan Pokok',
  simpanan_wajib: 'Simpanan Wajib',
  simpanan_sukarela: 'Simpanan Sukarela',
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const SavingsReconciliation = () => {
  const { language } = useThemeLanguage();
  const { loading, discrepancies, summary, calculateReconciliation, fixDiscrepancy, fixAllDiscrepancies } = useSavingsReconciliation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<SavingsDiscrepancy | null>(null);
  const [fixMode, setFixMode] = useState<'adjust_savings' | 'create_correction'>('create_correction');
  const [showFixAllDialog, setShowFixAllDialog] = useState(false);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    calculateReconciliation();
  }, []);

  const filteredDiscrepancies = discrepancies.filter(d => {
    const matchesSearch = d.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.memberNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || d.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleFixClick = (discrepancy: SavingsDiscrepancy) => {
    setSelectedDiscrepancy(discrepancy);
  };

  const handleConfirmFix = async () => {
    if (!selectedDiscrepancy) return;
    setFixing(true);
    await fixDiscrepancy(selectedDiscrepancy, fixMode);
    setSelectedDiscrepancy(null);
    await calculateReconciliation();
    setFixing(false);
  };

  const handleFixAll = async () => {
    setFixing(true);
    await fixAllDiscrepancies(fixMode);
    setShowFixAllDialog(false);
    setFixing(false);
  };

  const handleExport = async () => {
    const exportData = filteredDiscrepancies.map(d => ({
      'No. Anggota': d.memberNumber,
      'Nama': d.memberName,
      'Tipe Simpanan': typeLabels[d.type],
      'Saldo Perhitungan': d.calculatedAmount,
      'Saldo Aktual': d.actualAmount,
      'Selisih': d.difference,
      'Jumlah Transaksi': d.transactionCount,
      'Jumlah Koreksi': d.correctionCount,
    }));

    await createAndDownloadExcelFromJson(
      [{ name: 'Rekonsiliasi Simpanan', data: exportData }],
      `rekonsiliasi-simpanan-${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Rekonsiliasi Simpanan</h2>
          <p className="text-muted-foreground">Validasi kesesuaian saldo simpanan dengan transaksi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={discrepancies.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button onClick={calculateReconciliation} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tingkat Rekonsiliasi</CardDescription>
              <CardTitle className="text-2xl">
                {summary.reconciliationRate.toFixed(1)}%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={summary.reconciliationRate === 100 ? 'default' : 'destructive'}>
                {summary.reconciliationRate === 100 ? 'Sempurna' : 'Perlu Perbaikan'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Anggota</CardDescription>
              <CardTitle className="text-2xl">{summary.totalMembers}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Anggota aktif</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Anggota Berselisih</CardDescription>
              <CardTitle className="text-2xl text-destructive">{summary.membersWithDiscrepancy}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {summary.membersWithDiscrepancy === 0 ? 'Tidak ada selisih' : 'Perlu diperbaiki'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Selisih</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(summary.totalDiscrepancyAmount)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Nilai absolut</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success State */}
      {!loading && discrepancies.length === 0 && summary && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="flex items-center gap-4 py-8">
            <CheckCircle className="h-12 w-12 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                Semua Data Konsisten
              </h3>
              <p className="text-green-600 dark:text-green-400">
                Saldo simpanan semua anggota sesuai dengan perhitungan transaksi.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discrepancies Table */}
      {discrepancies.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Daftar Selisih ({filteredDiscrepancies.length})
                </CardTitle>
                <CardDescription>Klik tombol Perbaiki untuk menyamakan saldo</CardDescription>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="destructive" 
                  onClick={() => setShowFixAllDialog(true)}
                  disabled={filteredDiscrepancies.length === 0}
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  Perbaiki Semua ({filteredDiscrepancies.length})
                </Button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mt-4">
              <SearchInput
                placeholder="Cari nama atau nomor anggota..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                containerClassName="flex-1"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="simpanan_pokok">Simpanan Pokok</SelectItem>
                  <SelectItem value="simpanan_wajib">Simpanan Wajib</SelectItem>
                  <SelectItem value="simpanan_sukarela">Simpanan Sukarela</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anggota</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">Saldo Perhitungan</TableHead>
                    <TableHead className="text-right">Saldo Aktual</TableHead>
                    <TableHead className="text-right">Selisih</TableHead>
                    <TableHead className="text-center">Transaksi</TableHead>
                    <TableHead className="text-center">Koreksi</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDiscrepancies.map((d, idx) => (
                    <TableRow key={`${d.userId}-${d.type}-${idx}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{d.memberName}</p>
                          <p className="text-sm text-muted-foreground">{d.memberNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabels[d.type]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(d.calculatedAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(d.actualAmount)}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${d.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {d.difference > 0 ? '+' : ''}{formatCurrency(d.difference)}
                      </TableCell>
                      <TableCell className="text-center">{d.transactionCount}</TableCell>
                      <TableCell className="text-center">{d.correctionCount}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => handleFixClick(d)}>
                          <Wrench className="h-4 w-4 mr-1" />
                          Perbaiki
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fix Single Dialog */}
      <AlertDialog open={!!selectedDiscrepancy} onOpenChange={() => setSelectedDiscrepancy(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Perbaiki Selisih Simpanan</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Memperbaiki selisih {typeLabels[selectedDiscrepancy?.type || 'simpanan_pokok']} untuk{' '}
                  <strong>{selectedDiscrepancy?.memberName}</strong>
                </p>
                <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Saldo Perhitungan:</span>
                    <span className="font-mono">{formatCurrency(selectedDiscrepancy?.calculatedAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saldo Aktual:</span>
                    <span className="font-mono">{formatCurrency(selectedDiscrepancy?.actualAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Selisih:</span>
                    <span className={`font-mono ${(selectedDiscrepancy?.difference || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(selectedDiscrepancy?.difference || 0)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-medium">Metode Perbaikan:</p>
                  <Select value={fixMode} onValueChange={(v) => setFixMode(v as typeof fixMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create_correction">Buat Koreksi (dengan jejak audit)</SelectItem>
                      <SelectItem value="adjust_savings">Sesuaikan Langsung</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={fixing}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmFix} disabled={fixing}>
              {fixing ? 'Memproses...' : 'Perbaiki'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fix All Dialog */}
      <AlertDialog open={showFixAllDialog} onOpenChange={setShowFixAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Perbaiki Semua Selisih</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Anda akan memperbaiki <strong>{filteredDiscrepancies.length}</strong> selisih sekaligus.
                </p>

                <div className="space-y-2">
                  <p className="font-medium">Metode Perbaikan:</p>
                  <Select value={fixMode} onValueChange={(v) => setFixMode(v as typeof fixMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create_correction">Buat Koreksi (dengan jejak audit)</SelectItem>
                      <SelectItem value="adjust_savings">Sesuaikan Langsung</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={fixing}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleFixAll} disabled={fixing} className="bg-destructive text-destructive-foreground">
              {fixing ? 'Memproses...' : `Perbaiki ${filteredDiscrepancies.length} Selisih`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
