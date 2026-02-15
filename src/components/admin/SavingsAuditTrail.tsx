import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/mockData';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Search, 
  RefreshCw, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  FileText,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  History
} from 'lucide-react';
import { exportGenericToExcel } from '@/lib/exportUtils';

interface AuditEntry {
  id: string;
  date: string;
  type: 'transaction' | 'correction';
  action: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  userId: string;
  userName: string;
  memberNumber: string;
  description: string;
  createdBy?: string;
  status: string;
}

interface SavingsAuditTrailProps {
  onBack: () => void;
}

export const SavingsAuditTrail = ({ onBack }: SavingsAuditTrailProps) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'transaction' | 'correction'>('all');
  const [filterAction, setFilterAction] = useState<'all' | 'add' | 'subtract'>('all');

  const fetchAuditData = async () => {
    setIsLoading(true);
    try {
      // Fetch transactions for simpanan sukarela
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .in('type', ['simpanan_sukarela', 'setor_simpanan_sukarela', 'penarikan_simpanan_sukarela'])
        .eq('status', 'approved')
        .order('created_at', { ascending: true });

      if (txError) throw txError;

      // Fetch corrections for simpanan sukarela
      const { data: corrections, error: corError } = await supabase
        .from('corrections')
        .select('*')
        .eq('correction_type', 'simpanan_sukarela')
        .eq('status', 'applied')
        .order('created_at', { ascending: true });

      if (corError) throw corError;

      // Get all user IDs
      const userIds = new Set<string>();
      (transactions || []).forEach(tx => userIds.add(tx.user_id));
      (corrections || []).forEach(cor => userIds.add(cor.user_id));

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', Array.from(userIds));

      const profileMap = new Map<string, { name: string; memberNumber: string }>();
      (profiles || []).forEach(p => {
        profileMap.set(p.user_id, { 
          name: p.name, 
          memberNumber: p.member_number || '-' 
        });
      });

      // Build audit entries with running balance per user
      const userBalances = new Map<string, number>();
      const allEntries: AuditEntry[] = [];

      // Process transactions
      (transactions || []).forEach(tx => {
        const currentBalance = userBalances.get(tx.user_id) || 0;
        const isWithdrawal = tx.type === 'penarikan_simpanan_sukarela';
        const amount = Number(tx.amount);
        const newBalance = isWithdrawal ? currentBalance - amount : currentBalance + amount;
        userBalances.set(tx.user_id, newBalance);

        const profile = profileMap.get(tx.user_id) || { name: 'Unknown', memberNumber: '-' };
        
        allEntries.push({
          id: tx.id,
          date: tx.created_at,
          type: 'transaction',
          action: isWithdrawal ? 'subtract' : 'add',
          amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          userId: tx.user_id,
          userName: profile.name,
          memberNumber: profile.memberNumber,
          description: isWithdrawal ? 'Penarikan Simpanan Sukarela' : 'Setoran Simpanan Sukarela',
          status: tx.status,
        });
      });

      // Process corrections
      (corrections || []).forEach(cor => {
        const currentBalance = userBalances.get(cor.user_id) || 0;
        const amount = Number(cor.amount);
        const delta = cor.operation === 'add' ? amount : -amount;
        const newBalance = currentBalance + delta;
        userBalances.set(cor.user_id, newBalance);

        const profile = profileMap.get(cor.user_id) || { name: 'Unknown', memberNumber: '-' };
        
        allEntries.push({
          id: cor.id,
          date: cor.created_at,
          type: 'correction',
          action: cor.operation,
          amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          userId: cor.user_id,
          userName: profile.name,
          memberNumber: profile.memberNumber,
          description: `Koreksi: ${cor.reason}`,
          createdBy: cor.created_by || undefined,
          status: cor.status,
        });
      });

      // Sort by date descending (newest first)
      allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setEntries(allEntries);
    } catch (err) {
      console.error('Error fetching audit data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = 
        entry.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.memberNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = filterType === 'all' || entry.type === filterType;
      const matchesAction = filterAction === 'all' || entry.action === filterAction;
      
      return matchesSearch && matchesType && matchesAction;
    });
  }, [entries, searchQuery, filterType, filterAction]);

  const stats = useMemo(() => {
    const totalDeposits = entries
      .filter(e => e.type === 'transaction' && e.action === 'add')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalWithdrawals = entries
      .filter(e => e.type === 'transaction' && e.action === 'subtract')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalCorrectionsAdd = entries
      .filter(e => e.type === 'correction' && e.action === 'add')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalCorrectionsSubtract = entries
      .filter(e => e.type === 'correction' && e.action === 'subtract')
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      totalDeposits,
      totalWithdrawals,
      totalCorrectionsAdd,
      totalCorrectionsSubtract,
      netChange: totalDeposits - totalWithdrawals + totalCorrectionsAdd - totalCorrectionsSubtract,
    };
  }, [entries]);

  const exportData = filteredEntries.map(entry => ({
    'Tanggal': format(new Date(entry.date), 'dd/MM/yyyy HH:mm', { locale: localeId }),
    'Anggota': entry.userName,
    'No. Anggota': entry.memberNumber,
    'Tipe': entry.type === 'transaction' ? 'Transaksi' : 'Koreksi',
    'Aksi': entry.action === 'add' ? 'Penambahan' : 'Pengurangan',
    'Nominal': entry.amount,
    'Saldo Sebelum': entry.balanceBefore,
    'Saldo Sesudah': entry.balanceAfter,
    'Keterangan': entry.description,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Audit Trail Simpanan Sukarela
            </h1>
            <p className="text-sm text-muted-foreground">
              Riwayat lengkap perubahan saldo simpanan sukarela
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAuditData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportGenericToExcel(exportData, 'audit-simpanan-sukarela')}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Total Setoran</p>
                <p className="text-sm font-bold text-success truncate">{formatCurrency(stats.totalDeposits)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-4 w-4 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Total Penarikan</p>
                <p className="text-sm font-bold text-destructive truncate">{formatCurrency(stats.totalWithdrawals)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-info/10">
                <ArrowUpRight className="h-4 w-4 text-info" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Koreksi (+)</p>
                <p className="text-sm font-bold text-info truncate">{formatCurrency(stats.totalCorrectionsAdd)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <ArrowDownRight className="h-4 w-4 text-warning" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Koreksi (-)</p>
                <p className="text-sm font-bold text-warning truncate">{formatCurrency(stats.totalCorrectionsSubtract)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Perubahan Bersih</p>
                <p className={`text-sm font-bold truncate ${stats.netChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {stats.netChange >= 0 ? '+' : ''}{formatCurrency(stats.netChange)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama anggota, no. anggota, atau keterangan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="h-4 w-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="transaction">Transaksi</SelectItem>
                  <SelectItem value="correction">Koreksi</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterAction} onValueChange={(v) => setFilterAction(v as any)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Aksi</SelectItem>
                  <SelectItem value="add">Penambahan</SelectItem>
                  <SelectItem value="subtract">Pengurangan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Riwayat Perubahan</CardTitle>
          <CardDescription>
            {filteredEntries.length} dari {entries.length} entri
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Tidak ada data audit trail</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tanggal</TableHead>
                    <TableHead className="text-xs">Anggota</TableHead>
                    <TableHead className="text-xs">Tipe</TableHead>
                    <TableHead className="text-xs">Aksi</TableHead>
                    <TableHead className="text-xs text-right">Nominal</TableHead>
                    <TableHead className="text-xs text-right">Saldo Sebelum</TableHead>
                    <TableHead className="text-xs text-right">Saldo Sesudah</TableHead>
                    <TableHead className="text-xs">Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.slice(0, 100).map((entry) => (
                    <TableRow key={`${entry.type}-${entry.id}`}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(entry.date), 'dd MMM yyyy', { locale: localeId })}
                        <br />
                        <span className="text-muted-foreground">
                          {format(new Date(entry.date), 'HH:mm')}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{entry.userName}</div>
                        <div className="text-muted-foreground">{entry.memberNumber}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.type === 'transaction' ? 'default' : 'secondary'} className="text-[10px]">
                          {entry.type === 'transaction' ? 'Transaksi' : 'Koreksi'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={entry.action === 'add' ? 'default' : 'destructive'} 
                          className={`text-[10px] ${entry.action === 'add' ? 'bg-success/10 text-success border-success/30' : ''}`}
                        >
                          {entry.action === 'add' ? (
                            <><TrendingUp className="h-3 w-3 mr-1" /> Tambah</>
                          ) : (
                            <><TrendingDown className="h-3 w-3 mr-1" /> Kurang</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-xs text-right font-medium ${entry.action === 'add' ? 'text-success' : 'text-destructive'}`}>
                        {entry.action === 'add' ? '+' : '-'}{formatCurrency(entry.amount)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {formatCurrency(entry.balanceBefore)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatCurrency(entry.balanceAfter)}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {entry.description}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredEntries.length > 100 && (
                <div className="p-3 text-center text-sm text-muted-foreground border-t">
                  Menampilkan 100 dari {filteredEntries.length} entri. Export untuk melihat semua data.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
