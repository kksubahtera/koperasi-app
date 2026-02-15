import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilterSelect } from '@/components/ui/filter-select';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  GraduationCap, 
  Heart, 
  Building, 
  Calendar,
  FileText,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/mockData';
import { toast } from 'sonner';
import { useSHUFundActivities, SHUFundActivity } from '@/hooks/useSHUFundActivities';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SHUFundActivitiesProps {
  onBack: () => void;
}

const FUND_TYPES = [
  { value: 'pendidikan', label: 'Dana Pendidikan', icon: GraduationCap, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { value: 'sosial', label: 'Dana Sosial', icon: Heart, color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
  { value: 'pembangunan', label: 'Dana Pembangunan', icon: Building, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
];

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Direncanakan', color: 'bg-muted text-muted-foreground' },
  { value: 'ongoing', label: 'Berjalan', color: 'bg-info/20 text-info' },
  { value: 'completed', label: 'Selesai', color: 'bg-success/20 text-success' },
];

export const SHUFundActivities = ({ onBack }: SHUFundActivitiesProps) => {
  const { activities, loading, addActivity, updateActivity, deleteActivity, getTotalByType } = useSHUFundActivities();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<SHUFundActivity | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    fund_type: 'pendidikan' as 'pendidikan' | 'sosial' | 'pembangunan',
    title: '',
    description: '',
    amount: '',
    activity_date: new Date().toISOString().split('T')[0],
    status: 'planned' as 'planned' | 'ongoing' | 'completed',
    year: new Date().getFullYear(),
  });

  const resetForm = () => {
    setFormData({
      fund_type: 'pendidikan',
      title: '',
      description: '',
      amount: '',
      activity_date: new Date().toISOString().split('T')[0],
      status: 'planned',
      year: new Date().getFullYear(),
    });
    setEditingActivity(null);
    setIsFormOpen(false);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Nama kegiatan wajib diisi');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Jumlah dana harus lebih dari 0');
      return;
    }

    setIsSaving(true);
    try {
      if (editingActivity) {
        await updateActivity(editingActivity.id, {
          fund_type: formData.fund_type,
          title: formData.title,
          description: formData.description || null,
          amount: parseFloat(formData.amount),
          activity_date: formData.activity_date,
          status: formData.status,
          year: formData.year,
        });
        toast.success('Kegiatan berhasil diperbarui');
      } else {
        await addActivity({
          fund_type: formData.fund_type,
          title: formData.title,
          description: formData.description || null,
          amount: parseFloat(formData.amount),
          activity_date: formData.activity_date,
          status: formData.status,
          year: formData.year,
        });
        toast.success('Kegiatan berhasil ditambahkan');
      }
      resetForm();
    } catch {
      // Error already handled in hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (activity: SHUFundActivity) => {
    setFormData({
      fund_type: activity.fund_type,
      title: activity.title,
      description: activity.description || '',
      amount: activity.amount.toString(),
      activity_date: activity.activity_date,
      status: activity.status,
      year: activity.year,
    });
    setEditingActivity(activity);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      try {
        await deleteActivity(deleteId);
        toast.success('Kegiatan berhasil dihapus');
      } catch {
        // Error already handled in hook
      }
      setDeleteId(null);
    }
  };

  const filteredActivities = activities.filter(activity => {
    const matchesType = filterType === 'all' || activity.fund_type === filterType;
    const matchesSearch = activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (activity.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    return matchesType && matchesSearch;
  });

  const getFundTypeInfo = (type: string) => {
    return FUND_TYPES.find(f => f.value === type) || FUND_TYPES[0];
  };

  const getStatusInfo = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kegiatan Dana SHU</h1>
            <p className="text-sm text-muted-foreground">Pencatatan penggunaan Dana Pendidikan, Sosial & Pembangunan</p>
          </div>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Tambah Kegiatan</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {FUND_TYPES.map((fund) => {
          const Icon = fund.icon;
          const total = getTotalByType(fund.value as any);
          const count = activities.filter(a => a.fund_type === fund.value).length;
          return (
            <Card key={fund.value} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setFilterType(fund.value)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${fund.bgColor}`}>
                    <Icon className={`h-5 w-5 ${fund.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{fund.label}</p>
                    <p className="text-lg font-bold">{formatCurrency(total)}</p>
                    <p className="text-xs text-muted-foreground">{count} kegiatan</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Card */}
      <Card className="border-success/30 bg-success/5">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-success">✓ Terintegrasi Pembukuan:</strong> Kegiatan dengan status "Selesai" akan otomatis membuat jurnal pengeluaran dana dan mengurangi saldo kas.
          </p>
        </CardContent>
      </Card>

      {/* Form Card */}
      {isFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {editingActivity ? 'Edit Kegiatan' : 'Tambah Kegiatan Baru'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Jenis Dana</Label>
                <Select value={formData.fund_type} onValueChange={(v) => setFormData(prev => ({ ...prev, fund_type: v as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUND_TYPES.map((fund) => (
                      <SelectItem key={fund.value} value={fund.value}>
                        <span className="flex items-center gap-2">
                          <fund.icon className={`h-4 w-4 ${fund.color}`} />
                          {fund.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Nama Kegiatan</Label>
                <Input 
                  value={formData.title} 
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Contoh: Pelatihan Kewirausahaan"
                />
              </div>
              <div className="space-y-2">
                <Label>Jumlah Dana</Label>
                <Input 
                  type="number"
                  value={formData.amount} 
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input 
                  type="date"
                  value={formData.activity_date} 
                  onChange={(e) => setFormData(prev => ({ ...prev, activity_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Deskripsi</Label>
                <Textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Deskripsi singkat kegiatan..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm} disabled={isSaving}>Batal</Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {editingActivity ? 'Simpan Perubahan' : 'Tambah Kegiatan'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          placeholder="Cari kegiatan..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          containerClassName="flex-1"
        />
        <FilterSelect
          value={filterType}
          onValueChange={setFilterType}
          options={FUND_TYPES.map(fund => ({ value: fund.value, label: fund.label }))}
          placeholder="Filter jenis dana"
          allLabel="Semua Dana"
          triggerClassName="w-full sm:w-48"
        />
      </div>

      {/* Activities List */}
      <div className="space-y-3">
        {filteredActivities.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Belum ada kegiatan tercatat</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Kegiatan Pertama
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredActivities.map((activity) => {
            const fundInfo = getFundTypeInfo(activity.fund_type);
            const statusInfo = getStatusInfo(activity.status);
            const Icon = fundInfo.icon;
            return (
              <Card key={activity.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${fundInfo.bgColor} shrink-0`}>
                      <Icon className={`h-5 w-5 ${fundInfo.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-foreground">{activity.title}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{fundInfo.label}</Badge>
                            <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-primary">{formatCurrency(activity.amount)}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                            <Calendar className="h-3 w-3" />
                            {new Date(activity.activity_date).toLocaleDateString('id-ID')}
                          </p>
                        </div>
                      </div>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{activity.description}</p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(activity)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(activity.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kegiatan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus kegiatan ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
