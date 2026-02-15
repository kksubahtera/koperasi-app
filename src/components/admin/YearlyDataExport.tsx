import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Archive, Download, Calendar, FileSpreadsheet, Loader2, Users, Wallet, CreditCard, BookOpen, PieChart, BarChart3 } from 'lucide-react';
import { useYearlyDataExport, ExportCategory } from '@/hooks/useYearlyDataExport';
import { toast } from 'sonner';

interface CategoryOption {
  id: ExportCategory;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: 'members', label: 'Data Anggota', icon: <Users className="h-4 w-4" />, description: 'Anggota aktif, baru, keluar' },
  { id: 'savings', label: 'Simpanan', icon: <Wallet className="h-4 w-4" />, description: 'Ringkasan simpanan per anggota' },
  { id: 'transactions', label: 'Transaksi', icon: <CreditCard className="h-4 w-4" />, description: 'Semua transaksi tahun tersebut' },
  { id: 'loans', label: 'Pinjaman', icon: <BookOpen className="h-4 w-4" />, description: 'Pinjaman dan angsuran' },
  { id: 'journals', label: 'Jurnal', icon: <FileSpreadsheet className="h-4 w-4" />, description: 'Entry jurnal umum' },
  { id: 'shu', label: 'SHU', icon: <PieChart className="h-4 w-4" />, description: 'Distribusi SHU per anggota' },
  { id: 'financial', label: 'Laporan Keuangan', icon: <BarChart3 className="h-4 w-4" />, description: 'Neraca, Laba Rugi' },
];

interface YearlyDataExportProps {
  onBack?: () => void;
}

const YearlyDataExport = ({ onBack }: YearlyDataExportProps) => {
  const { exportYearlyData, getAvailableYears, isExporting, progress } = useYearlyDataExport();
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<ExportCategory[]>(['all']);
  const [selectAll, setSelectAll] = useState(true);

  useEffect(() => {
    const loadYears = async () => {
      const years = await getAvailableYears();
      setAvailableYears(years);
      if (years.length > 0) {
        setSelectedYear(years[years.length - 1].toString());
      }
    };
    loadYears();
  }, []);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedCategories(['all']);
    } else {
      setSelectedCategories([]);
    }
  };

  const handleCategoryToggle = (categoryId: ExportCategory, checked: boolean) => {
    setSelectAll(false);
    if (checked) {
      setSelectedCategories(prev => [...prev.filter(c => c !== 'all'), categoryId]);
    } else {
      setSelectedCategories(prev => prev.filter(c => c !== categoryId));
    }
  };

  const handleExport = async () => {
    if (!selectedYear) {
      toast.error('Pilih tahun terlebih dahulu');
      return;
    }

    if (selectedCategories.length === 0) {
      toast.error('Pilih minimal satu kategori data');
      return;
    }

    const success = await exportYearlyData(
      parseInt(selectedYear),
      selectAll ? ['all'] : selectedCategories
    );

    if (success) {
      toast.success(`Arsip tahun buku ${selectedYear} berhasil diunduh`);
    } else {
      toast.error('Gagal mengekspor data. Silakan coba lagi.');
    }
  };

  const progressPercentage = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Archive className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Arsip Tahun Buku</CardTitle>
              <CardDescription>
                Export semua data aktivitas koperasi untuk satu tahun pembukuan
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Year Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Pilih Tahun Buku
            </label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Pilih tahun..." />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                    {year === new Date().getFullYear() && (
                      <Badge variant="secondary" className="ml-2 text-xs">Berjalan</Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Kategori Data</label>
            
            <div className="flex items-center space-x-2 p-3 rounded-lg border bg-muted/50">
              <Checkbox 
                id="select-all" 
                checked={selectAll}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer flex-1">
                Semua Data (Arsip Lengkap)
              </label>
              <Badge variant="outline">Rekomendasi</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map(category => (
                <div 
                  key={category.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                    selectAll ? 'opacity-50' : 'hover:bg-muted/50'
                  }`}
                >
                  <Checkbox 
                    id={category.id}
                    checked={selectAll || selectedCategories.includes(category.id)}
                    disabled={selectAll}
                    onCheckedChange={(checked) => handleCategoryToggle(category.id, checked as boolean)}
                  />
                  <div className="flex-1">
                    <label 
                      htmlFor={category.id} 
                      className="text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      {category.icon}
                      {category.label}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {category.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress */}
          {isExporting && (
            <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengekspor {progress.currentCategory}...
                </span>
                <span className="font-medium">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Langkah {progress.current} dari {progress.total}
              </p>
            </div>
          )}

          {/* Export Button */}
          <Button 
            onClick={handleExport} 
            disabled={isExporting || !selectedYear || selectedCategories.length === 0}
            className="w-full md:w-auto"
            size="lg"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengekspor...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Arsip Tahun {selectedYear}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tentang Arsip Tahun Buku</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Arsip tahun buku berisi seluruh data aktivitas koperasi dalam satu tahun pembukuan.
            File Excel yang dihasilkan akan memiliki beberapa sheet terpisah untuk setiap kategori data.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="flex items-start gap-2">
              <FileSpreadsheet className="h-4 w-4 mt-0.5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Format Multi-Sheet</p>
                <p className="text-xs">Setiap kategori data terpisah dalam sheet berbeda</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Archive className="h-4 w-4 mt-0.5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Arsip Lengkap</p>
                <p className="text-xs">Termasuk ringkasan dan statistik tahun tersebut</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default YearlyDataExport;
