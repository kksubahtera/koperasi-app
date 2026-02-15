import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, RefreshCw, Download, Building2, TrendingDown, 
  Calendar, Percent, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Trash2, Edit, Eye, Calculator
} from 'lucide-react';
import { RupiahIcon } from '@/components/ui/rupiah-icon';
import { useFixedAssets, calculateAssetDepreciation, FixedAsset, DepreciationSchedule } from '@/hooks/useFixedAssetDepreciation';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { createAndDownloadExcelFromJson } from '@/lib/excelUtils';
import { QuickEquationGuide } from './QuickEquationGuide';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const ASSET_CATEGORIES = [
  'Peralatan Kantor',
  'Kendaraan',
  'Gedung/Bangunan',
  'Mesin',
  'Inventaris',
  'Komputer & IT',
  'Furnitur',
  'Lainnya'
];

interface AssetFormData {
  asset_code: string;
  asset_name: string;
  category: string;
  acquisition_date: string;
  acquisition_cost: number;
  useful_life_months: number;
  depreciation_method: 'straight_line' | 'declining_balance';
  location: string;
}

const initialFormData: AssetFormData = {
  asset_code: '',
  asset_name: '',
  category: 'Peralatan Kantor',
  acquisition_date: format(new Date(), 'yyyy-MM-dd'),
  acquisition_cost: 0,
  useful_life_months: 60,
  depreciation_method: 'straight_line',
  location: ''
};

export const FixedAssetDepreciation: React.FC = () => {
  const { assets, loading, summary, depreciationByCategory, addAsset, updateAsset, deleteAsset, runDepreciationUpdate, refetch } = useFixedAssets();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [formData, setFormData] = useState<AssetFormData>(initialFormData);
  const [isEditing, setIsEditing] = useState(false);

  const handleSubmit = async () => {
    if (!formData.asset_code || !formData.asset_name || formData.acquisition_cost <= 0) {
      return;
    }

    if (isEditing && selectedAsset) {
      await updateAsset(selectedAsset.id, formData);
    } else {
      await addAsset({
        ...formData,
        status: 'active'
      });
    }

    setShowAddDialog(false);
    setFormData(initialFormData);
    setIsEditing(false);
    setSelectedAsset(null);
  };

  const handleEdit = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setFormData({
      asset_code: asset.asset_code,
      asset_name: asset.asset_name,
      category: asset.category || 'Lainnya',
      acquisition_date: asset.acquisition_date,
      acquisition_cost: asset.acquisition_cost,
      useful_life_months: asset.useful_life_months,
      depreciation_method: asset.depreciation_method as 'straight_line' | 'declining_balance',
      location: asset.location || ''
    });
    setIsEditing(true);
    setShowAddDialog(true);
  };

  const handleViewSchedule = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setShowScheduleDialog(true);
  };

  const handleDelete = async (asset: FixedAsset) => {
    if (window.confirm(`Hapus aset "${asset.asset_name}"?`)) {
      await deleteAsset(asset.id);
    }
  };

  const exportToExcel = () => {
    const data = assets.map(asset => {
      const dep = calculateAssetDepreciation(asset);
      return {
        'Kode Aset': asset.asset_code,
        'Nama Aset': asset.asset_name,
        'Kategori': asset.category || '-',
        'Tanggal Perolehan': asset.acquisition_date,
        'Harga Perolehan': asset.acquisition_cost,
        'Umur Ekonomis (Bulan)': asset.useful_life_months,
        'Metode Penyusutan': asset.depreciation_method === 'straight_line' ? 'Garis Lurus' : 'Saldo Menurun',
        'Akum. Penyusutan': dep.accumulatedToDate,
        'Nilai Buku': dep.currentValue,
        'Penyusutan/Bulan': dep.monthlyDepreciation,
        'Sisa Bulan': dep.remainingMonths,
        'Status': asset.status
      };
    });

    createAndDownloadExcelFromJson(
      [{ name: 'Aset Tetap', data }],
      `Daftar_Aset_Tetap_${format(new Date(), 'yyyyMMdd')}.xlsx`
    );
  };

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <Skeleton className="h-24 sm:h-32 w-full" />
        <Skeleton className="h-48 sm:h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Reference Guide */}
      <QuickEquationGuide variant="depreciation" />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold">Aset Tetap & Penyusutan</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Kelola aset tetap dan hitung penyusutan otomatis
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={runDepreciationUpdate} className="h-8 text-xs sm:text-sm">
            <Calculator className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Update Penyusutan</span>
            <span className="sm:hidden">Update</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} className="h-8 text-xs sm:text-sm">
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button variant="outline" size="sm" onClick={refetch} className="h-8 w-8 p-0">
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => { setIsEditing(false); setFormData(initialFormData); }} className="h-8 text-xs sm:text-sm">
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Tambah Aset</span>
                <span className="sm:hidden">Tambah</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">{isEditing ? 'Edit Aset Tetap' : 'Tambah Aset Tetap'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:gap-4 py-3 sm:py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Kode Aset</Label>
                    <Input
                      value={formData.asset_code}
                      onChange={(e) => setFormData({ ...formData, asset_code: e.target.value })}
                      placeholder="AT-001"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Kategori</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSET_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat} className="text-sm">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Nama Aset</Label>
                  <Input
                    value={formData.asset_name}
                    onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
                    placeholder="Laptop Dell Latitude"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Tanggal Perolehan</Label>
                    <Input
                      type="date"
                      value={formData.acquisition_date}
                      onChange={(e) => setFormData({ ...formData, acquisition_date: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Harga Perolehan</Label>
                    <Input
                      type="number"
                      value={formData.acquisition_cost || ''}
                      onChange={(e) => setFormData({ ...formData, acquisition_cost: Number(e.target.value) })}
                      placeholder="10000000"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Umur Ekonomis (Bulan)</Label>
                    <Input
                      type="number"
                      value={formData.useful_life_months}
                      onChange={(e) => setFormData({ ...formData, useful_life_months: Number(e.target.value) })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Metode Penyusutan</Label>
                    <Select 
                      value={formData.depreciation_method} 
                      onValueChange={(v: 'straight_line' | 'declining_balance') => setFormData({ ...formData, depreciation_method: v })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="straight_line" className="text-sm">Garis Lurus</SelectItem>
                        <SelectItem value="declining_balance" className="text-sm">Saldo Menurun</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Lokasi</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Kantor Pusat"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowAddDialog(false)} size="sm" className="text-xs sm:text-sm">Batal</Button>
                <Button onClick={handleSubmit} size="sm" className="text-xs sm:text-sm">{isEditing ? 'Simpan' : 'Tambah'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border-blue-200">
          <CardContent className="p-2.5 sm:pt-4 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total Harga Perolehan</p>
                <p className="text-sm sm:text-lg font-bold text-blue-600 truncate">{formatCurrency(summary.totalAcquisitionCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border-amber-200">
          <CardContent className="p-2.5 sm:pt-4 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10">
                <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Akum. Penyusutan</p>
                <p className="text-sm sm:text-lg font-bold text-amber-600 truncate">{formatCurrency(summary.totalAccumulatedDepreciation)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200">
          <CardContent className="p-2.5 sm:pt-4 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10">
                <RupiahIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Nilai Buku</p>
                <p className="text-sm sm:text-lg font-bold text-green-600 truncate">{formatCurrency(summary.totalCurrentValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border-purple-200">
          <CardContent className="p-2.5 sm:pt-4 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-purple-500/10">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Penyusutan/Bulan</p>
                <p className="text-sm sm:text-lg font-bold text-purple-600 truncate">{formatCurrency(summary.monthlyDepreciation)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Depreciation by Category */}
      {depreciationByCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
            <CardTitle className="text-sm sm:text-base">Penyusutan per Kategori</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-2.5 sm:space-y-3">
              {depreciationByCategory.map((cat) => {
                const depPercent = cat.totalCost > 0 ? (cat.totalDepreciation / cat.totalCost) * 100 : 0;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-0 text-xs sm:text-sm">
                      <span className="font-medium">{cat.category}</span>
                      <span className="text-muted-foreground text-[10px] sm:text-sm">
                        {cat.count} aset • {formatCurrency(cat.totalCurrentValue)}
                      </span>
                    </div>
                    <Progress value={depPercent} className="h-1.5 sm:h-2" />
                    <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                      <span>Akum: {formatCurrency(cat.totalDepreciation)}</span>
                      <span>{depPercent.toFixed(1)}% tersusut</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets Table */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <span>Daftar Aset Tetap ({assets.length})</span>
            {summary.fullyDepreciatedCount > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px] sm:text-xs w-fit">
                <AlertTriangle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                {summary.fullyDepreciatedCount} habis masa manfaat
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[10px] sm:text-xs whitespace-nowrap">Kode</TableHead>
                  <TableHead className="text-[10px] sm:text-xs whitespace-nowrap">Nama Aset</TableHead>
                  <TableHead className="text-[10px] sm:text-xs whitespace-nowrap hidden md:table-cell">Kategori</TableHead>
                  <TableHead className="text-[10px] sm:text-xs text-right whitespace-nowrap hidden sm:table-cell">Harga Perolehan</TableHead>
                  <TableHead className="text-[10px] sm:text-xs text-right whitespace-nowrap">Nilai Buku</TableHead>
                  <TableHead className="text-[10px] sm:text-xs text-center whitespace-nowrap hidden lg:table-cell">Progress</TableHead>
                  <TableHead className="text-[10px] sm:text-xs whitespace-nowrap hidden xl:table-cell">Metode</TableHead>
                  <TableHead className="text-[10px] sm:text-xs text-right whitespace-nowrap">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 sm:py-8 text-muted-foreground">
                      <Building2 className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                      <span className="text-xs sm:text-sm">Belum ada aset tetap</span>
                    </TableCell>
                  </TableRow>
                ) : (
                  assets.map((asset) => {
                    const dep = calculateAssetDepreciation(asset);
                    const progress = asset.acquisition_cost > 0 
                      ? (dep.accumulatedToDate / asset.acquisition_cost) * 100 
                      : 0;
                    
                    return (
                      <TableRow key={asset.id}>
                        <TableCell className="font-mono text-[10px] sm:text-sm py-2 sm:py-4">{asset.asset_code}</TableCell>
                        <TableCell className="py-2 sm:py-4">
                          <div>
                            <div className="font-medium text-[10px] sm:text-sm">{asset.asset_name}</div>
                            <div className="text-[9px] sm:text-xs text-muted-foreground">
                              {format(new Date(asset.acquisition_date), 'dd MMM yyyy', { locale: id })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-2 sm:py-4">
                          <Badge variant="outline" className="text-[9px] sm:text-xs">{asset.category || 'Lainnya'}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-[10px] sm:text-sm hidden sm:table-cell py-2 sm:py-4">
                          {formatCurrency(asset.acquisition_cost)}
                        </TableCell>
                        <TableCell className="text-right py-2 sm:py-4">
                          <div className="font-mono font-medium text-[10px] sm:text-sm">{formatCurrency(dep.currentValue)}</div>
                          <div className="text-[9px] sm:text-xs text-muted-foreground">
                            -{formatCurrency(dep.accumulatedToDate)}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell py-2 sm:py-4">
                          <div className="w-16 sm:w-20">
                            <Progress value={Math.min(progress, 100)} className="h-1.5 sm:h-2" />
                            <div className="text-[9px] sm:text-xs text-center text-muted-foreground mt-0.5 sm:mt-1">
                              {progress.toFixed(0)}%
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell py-2 sm:py-4">
                          <Badge variant={asset.depreciation_method === 'straight_line' ? 'secondary' : 'outline'} className="text-[9px] sm:text-xs">
                            {asset.depreciation_method === 'straight_line' ? 'Garis Lurus' : 'Saldo Menurun'}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 sm:py-4">
                          <div className="flex justify-end gap-0.5 sm:gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleViewSchedule(asset)} title="Lihat Jadwal" className="h-7 w-7 sm:h-8 sm:w-8">
                              <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(asset)} title="Edit" className="h-7 w-7 sm:h-8 sm:w-8">
                              <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(asset)} title="Hapus" className="text-destructive h-7 w-7 sm:h-8 sm:w-8">
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Depreciation Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto mx-2 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg">Jadwal Penyusutan - {selectedAsset?.asset_name}</DialogTitle>
          </DialogHeader>
          {selectedAsset && <DepreciationScheduleTable asset={selectedAsset} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DepreciationScheduleTable: React.FC<{ asset: FixedAsset }> = ({ asset }) => {
  const depreciation = calculateAssetDepreciation(asset);
  const currentDate = new Date();
  const currentPeriod = Math.max(0,
    (currentDate.getFullYear() - new Date(asset.acquisition_date).getFullYear()) * 12 +
    (currentDate.getMonth() - new Date(asset.acquisition_date).getMonth())
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="p-2 sm:p-3 rounded-lg bg-muted">
          <div className="text-[10px] sm:text-xs text-muted-foreground">Harga Perolehan</div>
          <div className="font-bold text-xs sm:text-base truncate">{formatCurrency(asset.acquisition_cost)}</div>
        </div>
        <div className="p-2 sm:p-3 rounded-lg bg-muted">
          <div className="text-[10px] sm:text-xs text-muted-foreground">Akum. Penyusutan</div>
          <div className="font-bold text-xs sm:text-base truncate">{formatCurrency(depreciation.accumulatedToDate)}</div>
        </div>
        <div className="p-2 sm:p-3 rounded-lg bg-muted">
          <div className="text-[10px] sm:text-xs text-muted-foreground">Nilai Buku Saat Ini</div>
          <div className="font-bold text-xs sm:text-base truncate">{formatCurrency(depreciation.currentValue)}</div>
        </div>
        <div className="p-2 sm:p-3 rounded-lg bg-muted">
          <div className="text-[10px] sm:text-xs text-muted-foreground">Sisa Masa Manfaat</div>
          <div className="font-bold text-xs sm:text-base">{depreciation.remainingMonths} bulan</div>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12 sm:w-16 text-[10px] sm:text-xs whitespace-nowrap">Periode</TableHead>
              <TableHead className="text-[10px] sm:text-xs whitespace-nowrap">Bulan/Tahun</TableHead>
              <TableHead className="text-right text-[10px] sm:text-xs whitespace-nowrap hidden sm:table-cell">Nilai Awal</TableHead>
              <TableHead className="text-right text-[10px] sm:text-xs whitespace-nowrap">Penyusutan</TableHead>
              <TableHead className="text-right text-[10px] sm:text-xs whitespace-nowrap hidden md:table-cell">Akumulasi</TableHead>
              <TableHead className="text-right text-[10px] sm:text-xs whitespace-nowrap">Nilai Akhir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {depreciation.schedule.slice(0, 60).map((row, idx) => {
              const isPast = idx < currentPeriod;
              const isCurrent = idx === currentPeriod;
              
              return (
                <TableRow 
                  key={row.period} 
                  className={`${isCurrent ? 'bg-primary/10 font-medium' : ''} ${!isPast && !isCurrent ? 'text-muted-foreground' : ''}`}
                >
                  <TableCell className="text-[10px] sm:text-sm py-1.5 sm:py-2">{row.period}</TableCell>
                  <TableCell className="text-[10px] sm:text-sm py-1.5 sm:py-2">
                    <span className="whitespace-nowrap">{format(new Date(row.year, row.month - 1), 'MMM yyyy', { locale: id })}</span>
                    {isCurrent && <Badge className="ml-1 sm:ml-2 text-[8px] sm:text-xs" variant="secondary">Now</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[10px] sm:text-sm hidden sm:table-cell py-1.5 sm:py-2">{formatCurrency(row.openingValue)}</TableCell>
                  <TableCell className="text-right font-mono text-amber-600 text-[10px] sm:text-sm py-1.5 sm:py-2">
                    {formatCurrency(row.depreciationAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[10px] sm:text-sm hidden md:table-cell py-1.5 sm:py-2">{formatCurrency(row.accumulatedDepreciation)}</TableCell>
                  <TableCell className="text-right font-mono text-[10px] sm:text-sm py-1.5 sm:py-2">{formatCurrency(row.closingValue)}</TableCell>
                </TableRow>
              );
            })}
            {depreciation.schedule.length > 60 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground text-[10px] sm:text-sm py-2">
                  ... dan {depreciation.schedule.length - 60} periode lainnya
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default FixedAssetDepreciation;
