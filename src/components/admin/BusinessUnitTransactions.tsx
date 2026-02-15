import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, Pencil, Trash2, Loader2, ShoppingCart, Package, 
  Wrench, Ticket, User, Calendar, Filter,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, ArrowUp, ArrowDown, Search
} from 'lucide-react';
import { RupiahIcon } from '@/components/ui/rupiah-icon';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { useBusinessUnitTransactions, BusinessUnitTransactionInput } from '@/hooks/useBusinessUnitTransactions';
import { useBusinessUnits } from '@/hooks/useBusinessUnits';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CurrencyInput } from '@/components/ui/currency-input';

interface BusinessUnitTransactionsProps {
  selectedUnitCode: string;
}

interface MemberOption {
  id: string;
  name: string;
  member_number: string;
}

const getTransactionTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    purchase: 'Belanja',
    deposit: 'Setor Produk',
    service: 'Jasa',
    ticket: 'Tiket/Paket',
  };
  return labels[type] || type;
};

const getTransactionTypeIcon = (type: string) => {
  switch (type) {
    case 'purchase':
      return <ShoppingCart className="h-4 w-4" />;
    case 'deposit':
      return <Package className="h-4 w-4" />;
    case 'service':
      return <Wrench className="h-4 w-4" />;
    case 'ticket':
      return <Ticket className="h-4 w-4" />;
    default:
      return <RupiahIcon className="h-4 w-4" />;
  }
};

const getUnitTransactionTypes = (unitCode: string) => {
  switch (unitCode) {
    case 'TK':
      return [{ value: 'purchase', label: 'Belanja' }];
    case 'PRD':
      return [{ value: 'deposit', label: 'Setor Produk' }];
    case 'JS':
      return [{ value: 'service', label: 'Jasa' }];
    case 'PRW':
      return [{ value: 'ticket', label: 'Tiket/Paket' }];
    default:
      return [
        { value: 'purchase', label: 'Belanja' },
        { value: 'deposit', label: 'Setor Produk' },
        { value: 'service', label: 'Jasa' },
        { value: 'ticket', label: 'Tiket/Paket' },
      ];
  }
};

const getUnitDescription = (unitCode: string) => {
  switch (unitCode) {
    case 'TK':
      return 'Catat nilai belanja anggota di toko koperasi';
    case 'PRD':
      return 'Catat nilai produk yang disetor anggota ke unit produksi';
    case 'JS':
      return 'Catat nilai jasa yang digunakan anggota';
    case 'PRW':
      return 'Catat tiket atau paket wisata yang dibeli anggota';
    default:
      return 'Catat transaksi unit usaha';
  }
};

export const BusinessUnitTransactions = ({ selectedUnitCode }: BusinessUnitTransactionsProps) => {
  const { user } = useAuth();
  const { units } = useBusinessUnits();
  const selectedUnit = units.find(u => u.code === selectedUnitCode);
  const { transactions, loading, addTransaction, deleteTransaction, refetch } = useBusinessUnitTransactions(selectedUnit?.id);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchMember, setSearchMember] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Bulk selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMember, setFilterMember] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Sorting states
  type SortField = 'transaction_date' | 'user_name' | 'transaction_type' | 'amount' | 'is_member_transaction';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('transaction_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const transactionTypes = getUnitTransactionTypes(selectedUnitCode);
  
  const [formData, setFormData] = useState({
    user_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    transaction_type: transactionTypes[0]?.value || 'purchase',
    description: '',
    amount: 0,
    quantity: 1,
    is_member_transaction: false, // Default to non-member transaction
    notes: '',
    customer_name: '', // For non-member transactions
  });
  
  // Apply filters to transactions
  const filteredTransactions = transactions.filter(tx => {
    // Search query filter (name, member number, description)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = tx.user_name?.toLowerCase().includes(query);
      const matchesMemberNumber = tx.member_number?.toLowerCase().includes(query);
      const matchesDescription = tx.description?.toLowerCase().includes(query);
      if (!matchesName && !matchesMemberNumber && !matchesDescription) {
        return false;
      }
    }
    
    // Date range filter
    if (filterDateFrom) {
      const txDate = new Date(tx.transaction_date);
      const fromDate = new Date(filterDateFrom);
      if (txDate < fromDate) return false;
    }
    if (filterDateTo) {
      const txDate = new Date(tx.transaction_date);
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (txDate > toDate) return false;
    }
    
    // Member filter
    if (filterMember) {
      if (tx.user_id !== filterMember) return false;
    }
    
    // Transaction type filter
    if (filterType !== 'all') {
      if (tx.transaction_type !== filterType) return false;
    }
    
    return true;
  });
  
  // Apply sorting to filtered transactions
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'transaction_date':
        comparison = new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
        break;
      case 'user_name':
        comparison = (a.user_name || '').localeCompare(b.user_name || '');
        break;
      case 'transaction_type':
        comparison = (a.transaction_type || '').localeCompare(b.transaction_type || '');
        break;
      case 'amount':
        comparison = a.amount - b.amount;
        break;
      case 'is_member_transaction':
        comparison = (a.is_member_transaction === b.is_member_transaction) ? 0 : a.is_member_transaction ? -1 : 1;
        break;
      default:
        comparison = 0;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };
  
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };
  
  const clearFilters = () => {
    setSearchQuery('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterMember('');
    setFilterType('all');
    setCurrentPage(1); // Reset to first page when filters are cleared
  };
  
  const hasActiveFilters = searchQuery || filterDateFrom || filterDateTo || filterMember || filterType !== 'all';
  
  // Pagination calculations
  const totalItems = sortedTransactions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);
  
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterDateFrom, filterDateTo, filterMember, filterType]);
  
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };
  useEffect(() => {
    const fetchMembers = async () => {
      setLoadingMembers(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, name, member_number')
          .eq('is_active', true)
          .eq('approval_status', 'approved')
          .order('name');

        if (error) throw error;

        setMembers((data || []).map(p => ({
          id: p.user_id,
          name: p.name,
          member_number: p.member_number || '-',
        })));
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, []);

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
    m.member_number.toLowerCase().includes(searchMember.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      user_id: '',
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: transactionTypes[0]?.value || 'purchase',
      description: '',
      amount: 0,
      quantity: 1,
      is_member_transaction: false,
      notes: '',
      customer_name: '',
    });
    setSearchMember('');
  };

  const handleSubmit = async () => {
    // Validation
    if (formData.is_member_transaction && !formData.user_id) {
      toast.error('Pilih anggota terlebih dahulu');
      return;
    }
    if (formData.amount <= 0) {
      toast.error('Nilai transaksi harus lebih dari 0');
      return;
    }
    if (!selectedUnit) {
      toast.error('Unit usaha tidak ditemukan');
      return;
    }

    setIsSubmitting(true);
    
    // For non-member transactions, use admin's user_id as placeholder
    const userId = formData.is_member_transaction ? formData.user_id : (user?.id || '');
    
    // Build description with customer name for non-member transactions
    let description = formData.description || '';
    if (!formData.is_member_transaction && formData.customer_name) {
      description = formData.customer_name + (description ? ` - ${description}` : '');
    }

    const input: BusinessUnitTransactionInput = {
      user_id: userId,
      business_unit_id: selectedUnit.id,
      transaction_date: formData.transaction_date,
      transaction_type: formData.transaction_type,
      description: description || null,
      amount: formData.amount,
      quantity: formData.quantity,
      is_member_transaction: formData.is_member_transaction,
      notes: formData.notes || null,
    };

    // Get member name for journal description
    const selectedMember = members.find(m => m.id === formData.user_id);
    const memberName = formData.is_member_transaction 
      ? selectedMember?.name || 'Anggota'
      : formData.customer_name || 'Non-Anggota';

    const result = await addTransaction(input, user?.id, { 
      createJournal: true, 
      memberName 
    });
    
    setIsSubmitting(false);
    
    if (result) {
      setIsDialogOpen(false);
      resetForm();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
      await deleteTransaction(id);
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };
  
  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = paginatedTransactions.map(tx => tx.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };
  
  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };
  
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    const confirmed = confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.size} transaksi yang dipilih?`);
    if (!confirmed) return;
    
    setIsDeleting(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const id of selectedIds) {
      const result = await deleteTransaction(id);
      if (result) {
        successCount++;
      } else {
        failCount++;
      }
    }
    
    setIsDeleting(false);
    setSelectedIds(new Set());
    
    if (failCount > 0) {
      toast.error(`${failCount} transaksi gagal dihapus`);
    }
    if (successCount > 0) {
      toast.success(`${successCount} transaksi berhasil dihapus`);
    }
  };
  
  const isAllSelected = paginatedTransactions.length > 0 && 
    paginatedTransactions.every(tx => selectedIds.has(tx.id));
  const isSomeSelected = paginatedTransactions.some(tx => selectedIds.has(tx.id));

  const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  const memberTransactionsFiltered = filteredTransactions.filter(t => t.is_member_transaction);
  const memberTotal = memberTransactionsFiltered.reduce((sum, t) => sum + t.amount, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
        <StatCard
          icon={getTransactionTypeIcon(transactionTypes[0]?.value)}
          value={filteredTransactions.length}
          label={`Total Transaksi${hasActiveFilters ? ' (Filtered)' : ''}`}
          iconBgColor="bg-primary/10"
        />
        <StatCard
          icon={<RupiahIcon className="text-green-600" />}
          value={formatCurrency(totalAmount)}
          label="Total Nilai"
          iconBgColor="bg-green-500/10"
        />
        <StatCard
          icon={<User className="text-blue-600" />}
          value={formatCurrency(memberTotal)}
          label="Kontribusi SHU Anggota"
          iconBgColor="bg-blue-500/10"
        />
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                {getTransactionTypeIcon(transactionTypes[0]?.value)}
                Transaksi {selectedUnit?.name || 'Unit Usaha'}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {getUnitDescription(selectedUnitCode)}
              </p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Transaksi
            </Button>
          </div>
          
          {/* Search and Filter Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <SearchInput
                placeholder="Cari nama anggota, no. anggota, atau keterangan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                containerClassName="flex-1"
              />
              <Button
                variant={showFilters ? "secondary" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className="sm:w-auto"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filter
                {hasActiveFilters && (
                  <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    !
                  </Badge>
                )}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                  Reset
                </Button>
              )}
            </div>
            
            {/* Expanded Filters */}
            {showFilters && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 p-4 bg-muted/50 rounded-lg border">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Dari Tanggal</Label>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Sampai Tanggal</Label>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Anggota</Label>
                  <Select value={filterMember} onValueChange={setFilterMember}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Semua anggota" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">Semua anggota</SelectItem>
                      {members.map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} ({member.member_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Jenis Transaksi</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Semua jenis" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">Semua jenis</SelectItem>
                      {transactionTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {getTransactionTypeIcon(transactionTypes[0]?.value)}
              <p className="mt-4 text-lg font-medium">
                {hasActiveFilters ? 'Tidak Ada Hasil' : 'Belum Ada Transaksi'}
              </p>
              <p className="text-sm">
                {hasActiveFilters 
                  ? 'Coba ubah filter pencarian Anda' 
                  : 'Klik "Tambah Transaksi" untuk memulai'}
              </p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Reset Filter
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bulk Actions Bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="font-medium">
                      {selectedIds.size} dipilih
                    </Badge>
                    <span className="text-muted-foreground">
                      Total: {formatCurrency(
                        paginatedTransactions
                          .filter(tx => selectedIds.has(tx.id))
                          .reduce((sum, tx) => sum + tx.amount, 0)
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Batal Pilih
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Menghapus...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Hapus {selectedIds.size} Transaksi
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Pilih semua"
                          className={isSomeSelected && !isAllSelected ? "opacity-50" : ""}
                        />
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          className="h-auto p-0 font-medium hover:bg-transparent flex items-center"
                          onClick={() => handleSort('transaction_date')}
                        >
                          Tanggal
                          {getSortIcon('transaction_date')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          className="h-auto p-0 font-medium hover:bg-transparent flex items-center"
                          onClick={() => handleSort('user_name')}
                        >
                          Anggota
                          {getSortIcon('user_name')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          className="h-auto p-0 font-medium hover:bg-transparent flex items-center"
                          onClick={() => handleSort('transaction_type')}
                        >
                          Jenis
                          {getSortIcon('transaction_type')}
                        </Button>
                      </TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">
                        <Button 
                          variant="ghost" 
                          className="h-auto p-0 font-medium hover:bg-transparent flex items-center ml-auto"
                          onClick={() => handleSort('amount')}
                        >
                          Nilai
                          {getSortIcon('amount')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          className="h-auto p-0 font-medium hover:bg-transparent flex items-center"
                          onClick={() => handleSort('is_member_transaction')}
                        >
                          SHU
                          {getSortIcon('is_member_transaction')}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((tx) => (
                      <TableRow key={tx.id} className={selectedIds.has(tx.id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(tx.id)}
                            onCheckedChange={(checked) => handleSelectOne(tx.id, checked as boolean)}
                            aria-label={`Pilih transaksi ${tx.id}`}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(tx.transaction_date)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tx.user_name}</p>
                            <p className="text-xs text-muted-foreground">{tx.member_number}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTransactionTypeIcon(tx.transaction_type)}
                            {getTransactionTypeLabel(tx.transaction_type)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {tx.description || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell>
                          {tx.is_member_transaction ? (
                            <Badge variant="default" className="bg-green-500/10 text-green-600">
                              Ya
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Tidak</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(tx.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Menampilkan {startIndex + 1}-{Math.min(endIndex, totalItems)} dari {totalItems} transaksi</span>
                    <Select 
                      value={itemsPerPage.toString()} 
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>per halaman</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => goToPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1 mx-2">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => goToPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Transaction Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getTransactionTypeIcon(transactionTypes[0]?.value)}
              Tambah Transaksi {selectedUnit?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Member Transaction Toggle - First */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <Label htmlFor="is_member" className="text-sm font-medium cursor-pointer">
                    Transaksi Anggota Koperasi
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Aktifkan jika transaksi dari anggota (dapat SHU)
                  </p>
                </div>
              </div>
              <Switch
                id="is_member"
                checked={formData.is_member_transaction}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  is_member_transaction: checked,
                  user_id: checked ? formData.user_id : '',
                  customer_name: checked ? '' : formData.customer_name,
                })}
              />
            </div>

            {/* Member Selection - Only shown when is_member_transaction is true */}
            {formData.is_member_transaction ? (
              <div className="space-y-2">
                <Label>Pilih Anggota *</Label>
                <div className="space-y-2">
                  <SearchInput
                    placeholder="Cari nama atau no. anggota..."
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                  />
                  {loadingMembers ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <ScrollArea className="h-32 border rounded-md">
                      <div className="p-2 space-y-1">
                        {filteredMembers.map(member => (
                          <div
                            key={member.id}
                            onClick={() => setFormData({ ...formData, user_id: member.id })}
                            className={`p-2 rounded cursor-pointer hover:bg-muted transition-colors ${
                              formData.user_id === member.id ? 'bg-primary/10 border border-primary' : ''
                            }`}
                          >
                            <p className="font-medium text-sm">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.member_number}</p>
                          </div>
                        ))}
                        {filteredMembers.length === 0 && (
                          <p className="text-center text-sm text-muted-foreground py-4">
                            Tidak ada anggota ditemukan
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
                {formData.is_member_transaction && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200">
                      SHU
                    </Badge>
                    Transaksi ini akan dihitung sebagai kontribusi SHU Jasa Usaha
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Nama Pelanggan</Label>
                <Input
                  placeholder="Nama pelanggan (opsional)"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Transaksi umum tanpa kontribusi SHU
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal *</Label>
                <Input
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Jenis Transaksi</Label>
                <Select
                  value={formData.transaction_type}
                  onValueChange={(v) => setFormData({ ...formData, transaction_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {transactionTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nilai Transaksi *</Label>
              <CurrencyInput
                value={formData.amount}
                onChange={(v) => setFormData({ ...formData, amount: v })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea
                placeholder="Deskripsi transaksi..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
