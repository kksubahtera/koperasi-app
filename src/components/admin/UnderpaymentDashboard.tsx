import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportButton } from '@/components/shared/ExportButton';
import { useUnderpaymentTracking, InstallmentUnderpayment, SavingsUnderpayment } from '@/hooks/useUnderpaymentTracking';
import { formatCurrency, formatShortDate } from '@/lib/mockData';
import { 
  AlertTriangle, 
  Users, 
  CreditCard, 
  Wallet, 
  RefreshCw,
  ArrowLeft,
  TrendingDown,
  Calendar,
  Hash
} from 'lucide-react';

interface UnderpaymentDashboardProps {
  onBack?: () => void;
}

export const UnderpaymentDashboard = ({ onBack }: UnderpaymentDashboardProps) => {
  const { installments, savings, summary, loading, error, refetch } = useUnderpaymentTracking();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'installments' | 'savings'>('all');

  // Filter data based on search
  const filteredInstallments = useMemo(() => {
    const searchLower = search.toLowerCase();
    return installments.filter(i => 
      i.memberName.toLowerCase().includes(searchLower) ||
      i.memberNumber.toLowerCase().includes(searchLower)
    );
  }, [installments, search]);

  const filteredSavings = useMemo(() => {
    const searchLower = search.toLowerCase();
    return savings.filter(s => 
      s.memberName.toLowerCase().includes(searchLower) ||
      s.memberNumber.toLowerCase().includes(searchLower)
    );
  }, [savings, search]);

  // Export data - convert to ExportTransaction format for ExportButton
  const exportInstallmentTransactions = useMemo(() => 
    filteredInstallments.map(i => ({
      id: i.id,
      memberName: i.memberName,
      memberNumber: i.memberNumber,
      type: 'bayar_angsuran_pinjaman',
      amount: i.underpaymentAmount,
      date: i.dueDate,
      status: 'partial' as const,
      paymentMethod: '-',
      accountHolderName: i.memberName,
      notes: `Angsuran #${i.installmentNumber} - Kurang bayar: ${formatCurrency(i.underpaymentAmount)} dari total ${formatCurrency(i.totalDue)}`,
      createdAt: i.dueDate,
    })), [filteredInstallments]);

  const exportSavingsTransactions = useMemo(() => 
    filteredSavings.map(s => ({
      id: s.userId,
      memberName: s.memberName,
      memberNumber: s.memberNumber,
      type: 'simpanan_wajib',
      amount: s.underpaymentAmount,
      date: s.joinDate,
      status: 'pending' as const,
      paymentMethod: '-',
      accountHolderName: s.memberName,
      notes: `Kurang ${s.deficitMonths} bulan simpanan wajib - Seharusnya: ${formatCurrency(s.expectedSimpananWajib)}, Aktual: ${formatCurrency(s.actualSimpananWajib)}`,
      createdAt: s.joinDate,
    })), [filteredSavings]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
            <Button onClick={refetch} className="mt-4" variant="outline">
              Coba Lagi
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
              Tracking Kekurangan Bayar
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Pantau kekurangan pembayaran angsuran dan simpanan wajib anggota
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg bg-destructive/10">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-destructive" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Anggota Kurang Bayar</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold">{summary.totalMembersWithUnderpayment}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg bg-warning/10">
                <CreditCard className="h-5 w-5 md:h-6 md:w-6 text-warning" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Kurang Angsuran</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold">{formatCurrency(summary.totalInstallmentUnderpayment)}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground">{summary.membersWithInstallmentUnderpayment} anggota</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg bg-orange-500/10">
                <Wallet className="h-5 w-5 md:h-6 md:w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Kurang Simpanan Wajib</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold">{formatCurrency(summary.totalSavingsUnderpayment)}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground">{summary.membersWithSavingsUnderpayment} anggota</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg bg-rose-500/10">
                <TrendingDown className="h-5 w-5 md:h-6 md:w-6 text-rose-500" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Total Kekurangan</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold">{formatCurrency(summary.totalUnderpaymentValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">Detail Kekurangan Bayar</CardTitle>
            <div className="flex items-center gap-2">
              <SearchInput
                placeholder="Cari anggota..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              {/* Button Group Navigation */}
              <div className="inline-flex items-center rounded-lg bg-muted p-1 gap-1">
                <Button
                  variant={activeTab === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('all')}
                  className={`gap-1.5 transition-all ${
                    activeTab === 'all' 
                      ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20' 
                      : 'hover:bg-muted-foreground/10'
                  }`}
                >
                  Semua
                  <Badge 
                    variant={activeTab === 'all' ? 'secondary' : 'outline'} 
                    className={`text-xs ${activeTab === 'all' ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
                  >
                    {filteredInstallments.length + filteredSavings.length}
                  </Badge>
                </Button>
                <Button
                  variant={activeTab === 'installments' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('installments')}
                  className={`gap-1.5 transition-all ${
                    activeTab === 'installments' 
                      ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20' 
                      : 'hover:bg-muted-foreground/10'
                  }`}
                >
                  Angsuran
                  <Badge 
                    variant={activeTab === 'installments' ? 'secondary' : 'outline'} 
                    className={`text-xs ${activeTab === 'installments' ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
                  >
                    {filteredInstallments.length}
                  </Badge>
                </Button>
                <Button
                  variant={activeTab === 'savings' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('savings')}
                  className={`gap-1.5 transition-all ${
                    activeTab === 'savings' 
                      ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20' 
                      : 'hover:bg-muted-foreground/10'
                  }`}
                >
                  Simpanan
                  <Badge 
                    variant={activeTab === 'savings' ? 'secondary' : 'outline'} 
                    className={`text-xs ${activeTab === 'savings' ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
                  >
                    {filteredSavings.length}
                  </Badge>
                </Button>
              </div>
              
              <div className="flex gap-2">
                {(activeTab === 'all' || activeTab === 'installments') && filteredInstallments.length > 0 && (
                  <ExportButton
                    transactions={exportInstallmentTransactions}
                    filename="kurang-bayar-angsuran"
                    title="Kurang Bayar Angsuran"
                  />
                )}
                {(activeTab === 'all' || activeTab === 'savings') && filteredSavings.length > 0 && (
                  <ExportButton
                    transactions={exportSavingsTransactions}
                    filename="kurang-bayar-simpanan"
                    title="Kurang Bayar Simpanan"
                  />
                )}
              </div>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'all' && (
              <div className="space-y-6">
                {filteredInstallments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-warning" />
                      Kekurangan Angsuran Pinjaman
                    </h3>
                    <InstallmentTable data={filteredInstallments} />
                  </div>
                )}
                
                {filteredSavings.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-orange-500" />
                      Kekurangan Simpanan Wajib
                    </h3>
                    <SavingsTable data={filteredSavings} />
                  </div>
                )}

                {filteredInstallments.length === 0 && filteredSavings.length === 0 && (
                  <EmptyState />
                )}
              </div>
            )}

            {activeTab === 'installments' && (
              filteredInstallments.length > 0 ? (
                <InstallmentTable data={filteredInstallments} />
              ) : (
                <EmptyState type="installments" />
              )
            )}

            {activeTab === 'savings' && (
              filteredSavings.length > 0 ? (
                <SavingsTable data={filteredSavings} />
              ) : (
                <EmptyState type="savings" />
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Sub-components
const InstallmentTable = ({ data }: { data: InstallmentUnderpayment[] }) => (
  <ScrollArea className="h-[300px] rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Anggota</TableHead>
          <TableHead className="text-center">Angsuran</TableHead>
          <TableHead className="text-center">Jatuh Tempo</TableHead>
          <TableHead className="text-right">Total Tagihan</TableHead>
          <TableHead className="text-right">Dibayar</TableHead>
          <TableHead className="text-right">Kekurangan</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <div>
                <p className="font-medium text-sm">{item.memberName}</p>
                <p className="text-xs text-muted-foreground">{item.memberNumber}</p>
              </div>
            </TableCell>
            <TableCell className="text-center">
              <Badge variant="outline" className="gap-1">
                <Hash className="h-3 w-3" />
                {item.installmentNumber}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatShortDate(item.dueDate)}
              </div>
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(item.totalDue)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCurrency(item.paidAmount)}
            </TableCell>
            <TableCell className="text-right">
              <span className="font-bold text-destructive">
                {formatCurrency(item.underpaymentAmount)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </ScrollArea>
);

const SavingsTable = ({ data }: { data: SavingsUnderpayment[] }) => (
  <ScrollArea className="h-[300px] rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Anggota</TableHead>
          <TableHead className="text-center">Lama Bergabung</TableHead>
          <TableHead className="text-right">Seharusnya</TableHead>
          <TableHead className="text-right">Aktual</TableHead>
          <TableHead className="text-right">Kekurangan</TableHead>
          <TableHead className="text-center">Bulan Kurang</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.userId}>
            <TableCell>
              <div>
                <p className="font-medium text-sm">{item.memberName}</p>
                <p className="text-xs text-muted-foreground">{item.memberNumber}</p>
              </div>
            </TableCell>
            <TableCell className="text-center">
              <span className="text-sm">{item.monthsJoined} bulan</span>
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(item.expectedSimpananWajib)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatCurrency(item.actualSimpananWajib)}
            </TableCell>
            <TableCell className="text-right">
              <span className="font-bold text-destructive">
                {formatCurrency(item.underpaymentAmount)}
              </span>
            </TableCell>
            <TableCell className="text-center">
              <Badge variant="destructive" className="text-xs">
                {item.deficitMonths} bulan
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </ScrollArea>
);

const EmptyState = ({ type }: { type?: 'installments' | 'savings' }) => (
  <div className="text-center py-12 text-muted-foreground">
    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-20" />
    <p className="text-sm">
      {type === 'installments' 
        ? 'Tidak ada kekurangan pembayaran angsuran' 
        : type === 'savings'
        ? 'Tidak ada kekurangan simpanan wajib'
        : 'Tidak ada data kekurangan bayar'}
    </p>
    <p className="text-xs mt-1">Semua anggota telah membayar sesuai ketentuan</p>
  </div>
);
