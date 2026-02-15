import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, Download, Shield, Package, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useCollaterals } from '@/hooks/useCollaterals';
import { Skeleton } from '@/components/ui/skeleton';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';

interface CollateralReportProps {
  onBack: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Menunggu Verifikasi', variant: 'secondary' },
  verified: { label: 'Terverifikasi', variant: 'outline' },
  active: { label: 'Aktif Disimpan', variant: 'default' },
  returned: { label: 'Sudah Dikembalikan', variant: 'secondary' },
  forfeited: { label: 'Disita', variant: 'destructive' },
};

const collateralTypeLabels: Record<string, string> = {
  sertifikat_tanah: 'Sertifikat Tanah',
  bpkb_kendaraan: 'BPKB Kendaraan',
  ijazah: 'Ijazah',
  surat_berharga: 'Surat Berharga',
  lainnya: 'Lainnya',
};

export function CollateralReport({ onBack }: CollateralReportProps) {
  const { collaterals, isLoading } = useCollaterals();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredCollaterals = useMemo(() => {
    return collaterals.filter((c) => {
      const matchesSearch =
        c.member?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.member?.member_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.collateral_description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesType = typeFilter === 'all' || c.collateral_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [collaterals, searchTerm, statusFilter, typeFilter]);

  const activeCollaterals = useMemo(() => 
    collaterals.filter(c => c.status === 'active' || c.status === 'verified'), 
    [collaterals]
  );

  const totalEstimatedValue = useMemo(() => 
    activeCollaterals.reduce((sum, c) => sum + (c.estimated_value || 0), 0),
    [activeCollaterals]
  );

  const totalLoanValue = useMemo(() => 
    activeCollaterals.reduce((sum, c) => sum + (c.loan?.principal_amount || 0), 0),
    [activeCollaterals]
  );

  const collateralsByType = useMemo(() => {
    const grouped: Record<string, { count: number; value: number }> = {};
    activeCollaterals.forEach(c => {
      const type = c.collateral_type;
      if (!grouped[type]) {
        grouped[type] = { count: 0, value: 0 };
      }
      grouped[type].count++;
      grouped[type].value += c.estimated_value || 0;
    });
    return grouped;
  }, [activeCollaterals]);

  const exportData = filteredCollaterals.map(c => ({
    'No. Anggota': c.member?.member_number || '-',
    'Nama Anggota': c.member?.name || '-',
    'Jenis Agunan': collateralTypeLabels[c.collateral_type] || c.collateral_type,
    'Deskripsi': c.collateral_description || '-',
    'No. Dokumen': c.document_number || '-',
    'Nilai Taksiran': c.estimated_value || 0,
    'Nilai Pinjaman': c.loan?.principal_amount || 0,
    'Status': statusLabels[c.status]?.label || c.status,
    'Penanggung Jawab': c.custodian?.name || '-',
    'Lokasi Penyimpanan': c.storage_location || '-',
    'Tanggal Diterima': c.received_date || '-',
    'Tanggal Dikembalikan': c.returned_date || '-',
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Laporan Agunan</h1>
            <p className="text-muted-foreground">Daftar agunan yang disimpan beserta nilai dan status</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await createAndDownloadExcelFromJson([{ name: 'Agunan', data: exportData }], 'laporan-agunan.xlsx');
          }}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span className="hidden sm:inline">Export Excel</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Agunan Aktif</p>
                <p className="text-2xl font-bold">{activeCollaterals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Shield className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Nilai Taksiran</p>
                <p className="text-2xl font-bold">{formatCurrency(totalEstimatedValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Nilai Pinjaman</p>
                <p className="text-2xl font-bold">{formatCurrency(totalLoanValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rasio Jaminan</p>
                <p className="text-2xl font-bold">
                  {totalLoanValue > 0 ? ((totalEstimatedValue / totalLoanValue) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collateral by Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ringkasan per Jenis Agunan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(collateralsByType).map(([type, data]) => (
              <div key={type} className="p-4 border rounded-lg">
                <p className="text-sm font-medium">{collateralTypeLabels[type] || type}</p>
                <p className="text-xl font-bold">{data.count}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(data.value)}</p>
              </div>
            ))}
            {Object.keys(collateralsByType).length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-4">
                Belum ada data agunan aktif
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daftar Agunan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <SearchInput
              placeholder="Cari nama, no. anggota, atau no. dokumen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              containerClassName="flex-1"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Menunggu Verifikasi</SelectItem>
                <SelectItem value="verified">Terverifikasi</SelectItem>
                <SelectItem value="active">Aktif Disimpan</SelectItem>
                <SelectItem value="returned">Sudah Dikembalikan</SelectItem>
                <SelectItem value="forfeited">Disita</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                <SelectItem value="sertifikat_tanah">Sertifikat Tanah</SelectItem>
                <SelectItem value="bpkb_kendaraan">BPKB Kendaraan</SelectItem>
                <SelectItem value="ijazah">Ijazah</SelectItem>
                <SelectItem value="surat_berharga">Surat Berharga</SelectItem>
                <SelectItem value="lainnya">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anggota</TableHead>
                  <TableHead>Jenis Agunan</TableHead>
                  <TableHead>Deskripsi / No. Dokumen</TableHead>
                  <TableHead className="text-right">Nilai Taksiran</TableHead>
                  <TableHead className="text-right">Nilai Pinjaman</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Penanggung Jawab</TableHead>
                  <TableHead>Lokasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCollaterals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Tidak ada data agunan
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCollaterals.map((collateral) => (
                    <TableRow key={collateral.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{collateral.member?.name || '-'}</p>
                          <p className="text-xs text-muted-foreground">{collateral.member?.member_number || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {collateralTypeLabels[collateral.collateral_type] || collateral.collateral_type}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{collateral.collateral_description || '-'}</p>
                          {collateral.document_number && (
                            <p className="text-xs text-muted-foreground">No: {collateral.document_number}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(collateral.estimated_value || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(collateral.loan?.principal_amount || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusLabels[collateral.status]?.variant || 'secondary'}>
                          {statusLabels[collateral.status]?.label || collateral.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{collateral.custodian?.name || '-'}</TableCell>
                      <TableCell className="text-sm">{collateral.storage_location || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            Menampilkan {filteredCollaterals.length} dari {collaterals.length} agunan
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
