import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/mockData';
import { supabase } from '@/integrations/supabase/client';
import { useSHUWithheld } from '@/hooks/useSHUWithheld';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, CheckCircle, Search, RefreshCw, AlertCircle, User, Wallet, CreditCard, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WithheldRecord {
  id: string;
  user_id: string;
  year: number;
  shu_amount: number;
  simpanan_share: number;
  jasa_usaha_share: number;
  arrears_amount: number;
  withhold_reason: string;
  manual_exclusion: boolean;
  exclusion_note: string | null;
  status: string;
  created_at: string;
  released_at: string | null;
  released_amount: number | null;
  used_for_arrears: number | null;
  // Joined data
  member_name?: string;
  member_number?: string;
  current_arrears?: number;
}

export const WithheldSHUManagement = () => {
  const { user } = useAuth();
  const { releaseWithheldSHU, loading: releaseLoading } = useSHUWithheld();
  const [records, setRecords] = useState<WithheldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('withheld');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<WithheldRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('bank');
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('shu_withheld')
        .select('*')
        .order('year', { ascending: false })
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (yearFilter !== 'all') {
        query = query.eq('year', parseInt(yearFilter));
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get member profiles
      const userIds = [...new Set((data || []).map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', userIds);

      // Get current arrears for each member
      const arrearsPromises = userIds.map(async (userId) => {
        const { data: installments } = await supabase
          .from('loan_installments')
          .select('total_amount, paid_amount, loan_id')
          .in('status', ['overdue', 'partial']);

        // Filter by user's loans
        const { data: loans } = await supabase
          .from('loans')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active');

        const loanIds = (loans || []).map(l => l.id);
        const userInstallments = (installments || []).filter(i => loanIds.includes(i.loan_id));
        const arrears = userInstallments.reduce((sum, i) => sum + (i.total_amount - (i.paid_amount || 0)), 0);

        return { userId, arrears };
      });

      const arrearsData = await Promise.all(arrearsPromises);

      const enrichedRecords = (data || []).map(record => {
        const profile = profiles?.find(p => p.user_id === record.user_id);
        const arrears = arrearsData.find(a => a.userId === record.user_id);
        return {
          ...record,
          member_name: profile?.name || 'Unknown',
          member_number: profile?.member_number || '-',
          current_arrears: arrears?.arrears || 0,
        };
      });

      setRecords(enrichedRecords);

      // Get available years
      const years = [...new Set((data || []).map(r => r.year))].sort((a, b) => b - a);
      setAvailableYears(years);
    } catch (error) {
      console.error('Error fetching withheld records:', error);
      toast.error('Gagal memuat data SHU ditahan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [statusFilter, yearFilter]);

  const handleReleaseClick = (record: WithheldRecord) => {
    setSelectedRecord(record);
    setReleaseDialogOpen(true);
  };

  const confirmRelease = async () => {
    if (!selectedRecord || !user) return;

    const success = await releaseWithheldSHU(
      selectedRecord.user_id,
      selectedRecord.year,
      user.id,
      paymentMethod
    );

    if (success) {
      setReleaseDialogOpen(false);
      setSelectedRecord(null);
      setPaymentMethod('bank');
      fetchRecords();
    }
  };

  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      record.member_name?.toLowerCase().includes(term) ||
      record.member_number?.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (record: WithheldRecord) => {
    switch (record.status) {
      case 'withheld':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30"><Clock className="h-3 w-3 mr-1" />Ditahan</Badge>;
      case 'released':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Dirilis</Badge>;
      case 'used_for_arrears':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30"><Wallet className="h-3 w-3 mr-1" />Untuk Tunggakan</Badge>;
      default:
        return <Badge variant="secondary">{record.status}</Badge>;
    }
  };

  const getReasonBadge = (record: WithheldRecord) => {
    if (record.manual_exclusion) {
      return <Badge variant="secondary" className="text-xs">Manual</Badge>;
    }
    return <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">Tunggakan</Badge>;
  };

  const canRelease = (record: WithheldRecord) => {
    // Can release if:
    // 1. Status is 'withheld'
    // 2. No current arrears OR it's a manual exclusion
    return record.status === 'withheld' && (record.current_arrears === 0 || record.manual_exclusion);
  };

  // Summary statistics
  const withheldCount = records.filter(r => r.status === 'withheld').length;
  const releasedCount = records.filter(r => r.status === 'released').length;
  const usedForArrearsCount = records.filter(r => r.status === 'used_for_arrears').length;
  const totalWithheldAmount = records.filter(r => r.status === 'withheld').reduce((sum, r) => sum + r.shu_amount, 0);

  const mobileColumns = [
    {
      key: 'member',
      header: 'Anggota',
      render: (record: WithheldRecord) => (
        <div>
          <div className="font-medium">{record.member_name}</div>
          <div className="text-xs text-muted-foreground">{record.member_number}</div>
        </div>
      ),
    },
    {
      key: 'year',
      header: 'Tahun',
      render: (record: WithheldRecord) => record.year,
    },
    {
      key: 'amount',
      header: 'Jumlah',
      render: (record: WithheldRecord) => formatCurrency(record.shu_amount),
    },
    {
      key: 'status',
      header: 'Status',
      render: (record: WithheldRecord) => getStatusBadge(record),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-muted-foreground">Ditahan</span>
            </div>
            <p className="text-xl font-bold text-amber-600 mt-1">{withheldCount}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(totalWithheldAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Dirilis</span>
            </div>
            <p className="text-xl font-bold text-green-600 mt-1">{releasedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">Untuk Tunggakan</span>
            </div>
            <p className="text-xl font-bold text-blue-600 mt-1">{usedForArrearsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-xl font-bold mt-1">{records.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Daftar SHU Ditahan</span>
            <Button variant="outline" size="sm" onClick={fetchRecords} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau nomor anggota..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="withheld">Ditahan</SelectItem>
                <SelectItem value="released">Dirilis</SelectItem>
                <SelectItem value="used_for_arrears">Untuk Tunggakan</SelectItem>
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Tahun" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tahun</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anggota</TableHead>
                  <TableHead>Tahun</TableHead>
                  <TableHead>Jumlah SHU</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Tunggakan Saat Ini</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                      <span className="text-muted-foreground">Memuat data...</span>
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Tidak ada data SHU ditahan
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.member_name}</div>
                          <div className="text-xs text-muted-foreground">{record.member_number}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.year}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(record.shu_amount)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getReasonBadge(record)}
                          {record.exclusion_note && (
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]" title={record.exclusion_note}>
                              {record.exclusion_note}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.current_arrears > 0 ? (
                          <span className="text-destructive font-medium">{formatCurrency(record.current_arrears)}</span>
                        ) : (
                          <span className="text-green-600 text-sm">Lunas</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(record)}</TableCell>
                      <TableCell className="text-right">
                        {record.status === 'withheld' && (
                          <Button
                            size="sm"
                            variant={canRelease(record) ? 'default' : 'outline'}
                            onClick={() => handleReleaseClick(record)}
                            disabled={!canRelease(record) && !record.manual_exclusion}
                          >
                            {canRelease(record) ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Rilis
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Ada Tunggakan
                              </>
                            )}
                          </Button>
                        )}
                        {record.status === 'released' && record.released_at && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(record.released_at).toLocaleDateString('id-ID')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                <span className="text-muted-foreground">Memuat data...</span>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Tidak ada data SHU ditahan
              </div>
            ) : (
              filteredRecords.map(record => (
                <Card 
                  key={record.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => record.status === 'withheld' && handleReleaseClick(record)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{record.member_name}</p>
                        <p className="text-xs text-muted-foreground">{record.member_number}</p>
                      </div>
                      {getStatusBadge(record)}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tahun {record.year}</span>
                      <span className="font-medium">{formatCurrency(record.shu_amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tunggakan</span>
                      <span className={record.current_arrears > 0 ? 'text-destructive' : 'text-green-600'}>
                        {record.current_arrears > 0 ? formatCurrency(record.current_arrears) : 'Lunas'}
                      </span>
                    </div>
                    {record.status === 'withheld' && canRelease(record) && (
                      <Button size="sm" className="w-full mt-2">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Rilis SHU
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Release Confirmation Dialog */}
      <Dialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rilis SHU Ditahan</DialogTitle>
            <DialogDescription>
              Pastikan tunggakan anggota sudah dilunasi sebelum merilis SHU.
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Anggota</span>
                  <span className="font-medium">{selectedRecord.member_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tahun SHU</span>
                  <span className="font-medium">{selectedRecord.year}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jumlah SHU</span>
                  <span className="font-bold text-primary">{formatCurrency(selectedRecord.shu_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tunggakan Saat Ini</span>
                  <span className={selectedRecord.current_arrears > 0 ? 'text-destructive font-medium' : 'text-green-600'}>
                    {selectedRecord.current_arrears > 0 ? formatCurrency(selectedRecord.current_arrears) : 'Lunas'}
                  </span>
                </div>
              </div>

              {selectedRecord.current_arrears > 0 && !selectedRecord.manual_exclusion && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Anggota masih memiliki tunggakan</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Disarankan untuk menunggu hingga tunggakan dilunasi sebelum merilis SHU.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedRecord.manual_exclusion && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-600">Pengecualian Manual</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedRecord.exclusion_note || 'Tidak ada catatan'}
                      </p>
                    </div>
                  </div>
              {/* Payment Method Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Metode Pembayaran</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={paymentMethod === 'bank' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setPaymentMethod('bank')}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Transfer Bank
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <Banknote className="h-4 w-4 mr-2" />
                    Tunai
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Jurnal otomatis akan dibuat dengan akun {paymentMethod === 'bank' ? 'Bank' : 'Kas'}
                </p>
              </div>
            </div>
          )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseDialogOpen(false)}>
              Batal
            </Button>
            <Button 
              onClick={confirmRelease} 
              disabled={releaseLoading || (selectedRecord?.current_arrears || 0) > 0 && !selectedRecord?.manual_exclusion}
            >
              {releaseLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Konfirmasi Rilis
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
