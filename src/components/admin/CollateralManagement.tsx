import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, FileText, User, MapPin, Calendar, CheckCircle, RotateCcw, Search } from 'lucide-react';
import { useCollaterals, CollateralWithDetails } from '@/hooks/useCollaterals';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export function CollateralManagement() {
  const { t } = useThemeLanguage();
  const { collaterals, isLoading, verifyCollateral, returnCollateral, refetch } = useCollaterals();
  const { admins: adminUsers } = useAdminUsers();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCollateral, setSelectedCollateral] = useState<CollateralWithDetails | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  
  // Verify form state
  const [custodianId, setCustodianId] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  
  // Return form state
  const [returnNotes, setReturnNotes] = useState('');

  const filteredCollaterals = collaterals.filter(c => {
    const matchesSearch = 
      c.member?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.member?.member_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.collateral_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.document_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: t('Menunggu Verifikasi', 'Pending Verification'), variant: 'secondary' },
      verified: { label: t('Terverifikasi', 'Verified'), variant: 'default' },
      active: { label: t('Aktif', 'Active'), variant: 'default' },
      returned: { label: t('Dikembalikan', 'Returned'), variant: 'outline' },
      forfeited: { label: t('Disita', 'Forfeited'), variant: 'destructive' }
    };
    
    const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleVerify = async () => {
    if (!selectedCollateral || !custodianId || !storageLocation) {
      toast.error(t('Lengkapi semua data', 'Please complete all fields'));
      return;
    }

    const result = await verifyCollateral(selectedCollateral.id, custodianId, storageLocation);
    
    if (result.success) {
      toast.success(t('Agunan berhasil diverifikasi', 'Collateral verified successfully'));
      setVerifyDialogOpen(false);
      setSelectedCollateral(null);
      setCustodianId('');
      setStorageLocation('');
    } else {
      toast.error(t('Gagal memverifikasi agunan', 'Failed to verify collateral'));
    }
  };

  const handleReturn = async () => {
    if (!selectedCollateral) return;

    const result = await returnCollateral(selectedCollateral.id, returnNotes);
    
    if (result.success) {
      toast.success(t('Agunan berhasil dikembalikan', 'Collateral returned successfully'));
      setReturnDialogOpen(false);
      setSelectedCollateral(null);
      setReturnNotes('');
    } else {
      toast.error(t('Gagal mengembalikan agunan', 'Failed to return collateral'));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Summary stats
  const stats = {
    total: collaterals.length,
    pending: collaterals.filter(c => c.status === 'pending').length,
    active: collaterals.filter(c => c.status === 'active' || c.status === 'verified').length,
    returned: collaterals.filter(c => c.status === 'returned').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            {t('Manajemen Agunan', 'Collateral Management')}
          </h2>
          <p className="text-muted-foreground">
            {t('Kelola agunan pinjaman anggota', 'Manage member loan collaterals')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">{t('Total Agunan', 'Total Collaterals')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">{t('Menunggu Verifikasi', 'Pending')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">{t('Agunan Aktif', 'Active')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats.returned}</div>
            <p className="text-xs text-muted-foreground">{t('Dikembalikan', 'Returned')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Cari nama anggota, jenis agunan, nomor dokumen...', 'Search member, collateral type, document number...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder={t('Filter Status', 'Filter Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('Semua Status', 'All Status')}</SelectItem>
                <SelectItem value="pending">{t('Menunggu Verifikasi', 'Pending')}</SelectItem>
                <SelectItem value="verified">{t('Terverifikasi', 'Verified')}</SelectItem>
                <SelectItem value="active">{t('Aktif', 'Active')}</SelectItem>
                <SelectItem value="returned">{t('Dikembalikan', 'Returned')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Collaterals Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Anggota', 'Member')}</TableHead>
                <TableHead>{t('Jenis Agunan', 'Collateral Type')}</TableHead>
                <TableHead>{t('Nilai', 'Value')}</TableHead>
                <TableHead>{t('Penanggung Jawab', 'Custodian')}</TableHead>
                <TableHead>{t('Status', 'Status')}</TableHead>
                <TableHead>{t('Aksi', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    {t('Memuat...', 'Loading...')}
                  </TableCell>
                </TableRow>
              ) : filteredCollaterals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t('Tidak ada data agunan', 'No collateral data')}
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
                      <div>
                        <p className="font-medium">{collateral.collateral_type}</p>
                        {collateral.document_number && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {collateral.document_number}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(collateral.estimated_value || 0)}</TableCell>
                    <TableCell>
                      {collateral.custodian ? (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="text-sm">{collateral.custodian.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      {collateral.storage_location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {collateral.storage_location}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(collateral.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {collateral.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCollateral(collateral);
                              setVerifyDialogOpen(true);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            {t('Verifikasi', 'Verify')}
                          </Button>
                        )}
                        {(collateral.status === 'verified' || collateral.status === 'active') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCollateral(collateral);
                              setReturnDialogOpen(true);
                            }}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            {t('Kembalikan', 'Return')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Verify Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Verifikasi Agunan', 'Verify Collateral')}</DialogTitle>
          </DialogHeader>
          
          {selectedCollateral && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p><strong>{t('Anggota', 'Member')}:</strong> {selectedCollateral.member?.name}</p>
                <p><strong>{t('Jenis Agunan', 'Collateral Type')}:</strong> {selectedCollateral.collateral_type}</p>
                <p><strong>{t('No. Dokumen', 'Document No')}:</strong> {selectedCollateral.document_number || '-'}</p>
                <p><strong>{t('Nilai', 'Value')}:</strong> {formatCurrency(selectedCollateral.estimated_value || 0)}</p>
              </div>

              <div className="space-y-2">
                <Label>{t('Pengurus Penanggung Jawab', 'Custodian Admin')} *</Label>
                <Select value={custodianId} onValueChange={setCustodianId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('Pilih pengurus', 'Select admin')} />
                  </SelectTrigger>
                  <SelectContent>
                    {adminUsers.map((admin) => (
                      <SelectItem key={admin.user_id} value={admin.user_id}>
                        {admin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('Lokasi Penyimpanan', 'Storage Location')} *</Label>
                <Input
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder={t('Contoh: Brankas Kantor Utama', 'e.g., Main Office Safe')}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              {t('Batal', 'Cancel')}
            </Button>
            <Button onClick={handleVerify}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('Verifikasi', 'Verify')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Kembalikan Agunan', 'Return Collateral')}</DialogTitle>
          </DialogHeader>
          
          {selectedCollateral && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p><strong>{t('Anggota', 'Member')}:</strong> {selectedCollateral.member?.name}</p>
                <p><strong>{t('Jenis Agunan', 'Collateral Type')}:</strong> {selectedCollateral.collateral_type}</p>
                <p><strong>{t('No. Dokumen', 'Document No')}:</strong> {selectedCollateral.document_number || '-'}</p>
              </div>

              <div className="space-y-2">
                <Label>{t('Catatan Pengembalian', 'Return Notes')}</Label>
                <Textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder={t('Catatan pengembalian (opsional)', 'Return notes (optional)')}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
              {t('Batal', 'Cancel')}
            </Button>
            <Button onClick={handleReturn}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('Kembalikan Agunan', 'Return Collateral')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
