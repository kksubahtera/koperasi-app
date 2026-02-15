import { useState } from 'react';
import { useBranches, CooperativeBranch, BranchFormData, BranchTerminology } from '@/hooks/useBranches';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Building2, 
  Loader2,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';

const defaultColors = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export default function BranchManagement() {
  const { language } = useThemeLanguage();
  const { 
    branches, 
    branchFeatureEnabled, 
    branchTerminology,
    toggleBranchFeature,
    updateBranchTerminology,
    createBranch,
    updateBranch,
    toggleBranchActive,
    deleteBranch,
    updateBranchOrder,
    isLoading 
  } = useBranches();

  // Dynamic terminology
  const term = branchTerminology === 'unit' ? {
    singular: 'Unit',
    plural: 'Unit',
    singularLower: 'unit',
    pluralLower: 'unit'
  } : {
    singular: 'Cabang',
    plural: 'Cabang',
    singularLower: 'cabang',
    pluralLower: 'cabang'
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<CooperativeBranch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<CooperativeBranch | null>(null);
  const [formData, setFormData] = useState<BranchFormData>({
    name: '',
    code: '',
    badge_color: '#3b82f6',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = {
    title: language === 'id' ? `Manajemen ${term.singular}` : `${term.singular} Management`,
    desc: language === 'id' 
      ? `Kelola ${term.singularLower} koperasi untuk pengelompokan anggota`
      : `Manage cooperative ${term.pluralLower} for member grouping`,
    enableFeature: language === 'id' ? `Aktifkan Fitur ${term.singular}` : `Enable ${term.singular} Feature`,
    enableDescription: language === 'id'
      ? `Mengaktifkan fitur ini akan menampilkan opsi ${term.singularLower} di profil anggota`
      : `Enabling this feature will show ${term.singularLower} options in member profiles`,
    terminologyLabel: language === 'id' ? 'Pilih Istilah' : 'Choose Terminology',
    addBranch: language === 'id' ? `Tambah ${term.singular}` : `Add ${term.singular}`,
    editBranch: language === 'id' ? `Edit ${term.singular}` : `Edit ${term.singular}`,
    name: language === 'id' ? `Nama ${term.singular}` : `${term.singular} Name`,
    code: language === 'id' ? `Kode ${term.singular}` : `${term.singular} Code`,
    color: language === 'id' ? 'Warna Badge' : 'Badge Color',
    description: language === 'id' ? 'Deskripsi' : 'Description',
    status: language === 'id' ? 'Status' : 'Status',
    actions: language === 'id' ? 'Aksi' : 'Actions',
    active: language === 'id' ? 'Aktif' : 'Active',
    inactive: language === 'id' ? 'Nonaktif' : 'Inactive',
    save: language === 'id' ? 'Simpan' : 'Save',
    cancel: language === 'id' ? 'Batal' : 'Cancel',
    delete: language === 'id' ? 'Hapus' : 'Delete',
    deleteConfirm: language === 'id' ? `Hapus ${term.singular}?` : `Delete ${term.singular}?`,
    deleteDescription: language === 'id'
      ? `Tindakan ini tidak dapat dibatalkan. Pastikan tidak ada anggota yang terdaftar di ${term.singularLower} ini.`
      : `This action cannot be undone. Make sure no members are assigned to this ${term.singularLower}.`,
    noBranches: language === 'id' ? `Belum ada ${term.singularLower}` : `No ${term.pluralLower} yet`,
    preview: language === 'id' ? 'Pratinjau' : 'Preview',
    order: language === 'id' ? 'Urutan' : 'Order',
  };

  const openAddDialog = () => {
    setEditingBranch(null);
    setFormData({
      name: '',
      code: '',
      badge_color: '#3b82f6',
      description: ''
    });
    setDialogOpen(true);
  };

  const handleTerminologyChange = (value: string) => {
    updateBranchTerminology(value as BranchTerminology);
  };

  const openEditDialog = (branch: CooperativeBranch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      badge_color: branch.badge_color,
      description: branch.description || ''
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (branch: CooperativeBranch) => {
    setDeletingBranch(branch);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.code.trim()) return;
    
    setIsSubmitting(true);
    let success: boolean;
    
    if (editingBranch) {
      success = await updateBranch(editingBranch.id, formData);
    } else {
      success = await createBranch(formData);
    }
    
    setIsSubmitting(false);
    if (success) {
      setDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBranch) return;
    
    const success = await deleteBranch(deletingBranch.id);
    if (success) {
      setDeleteDialogOpen(false);
      setDeletingBranch(null);
    }
  };

  const handleMoveUp = async (branch: CooperativeBranch, index: number) => {
    if (index === 0) return;
    const prevBranch = branches[index - 1];
    await updateBranchOrder(branch.id, prevBranch.display_order);
    await updateBranchOrder(prevBranch.id, branch.display_order);
  };

  const handleMoveDown = async (branch: CooperativeBranch, index: number) => {
    if (index === branches.length - 1) return;
    const nextBranch = branches[index + 1];
    await updateBranchOrder(branch.id, nextBranch.display_order);
    await updateBranchOrder(nextBranch.id, branch.display_order);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enable Feature Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">{t.enableFeature}</CardTitle>
                <CardDescription>{t.enableDescription}</CardDescription>
              </div>
            </div>
            <Switch
              checked={branchFeatureEnabled}
              onCheckedChange={toggleBranchFeature}
            />
          </div>
        </CardHeader>
        {branchFeatureEnabled && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              <Label>{t.terminologyLabel}</Label>
              <RadioGroup 
                value={branchTerminology} 
                onValueChange={handleTerminologyChange}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cabang" id="term-cabang" />
                  <Label htmlFor="term-cabang" className="font-normal cursor-pointer">Cabang</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="unit" id="term-unit" />
                  <Label htmlFor="term-unit" className="font-normal cursor-pointer">Unit</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Branch List */}
      {branchFeatureEnabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>{t.desc}</CardDescription>
              </div>
              <Button onClick={openAddDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t.addBranch}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {branches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t.noBranches}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">{t.order}</TableHead>
                    <TableHead>{t.name}</TableHead>
                    <TableHead>{t.code}</TableHead>
                    <TableHead>{t.preview}</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead className="text-right">{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch, index) => (
                    <TableRow key={branch.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveUp(branch, index)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveDown(branch, index)}
                            disabled={index === branches.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{branch.name}</TableCell>
                      <TableCell className="font-mono text-sm">{branch.code}</TableCell>
                      <TableCell>
                        <Badge
                          style={{ backgroundColor: branch.badge_color }}
                          className="text-white"
                        >
                          {branch.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={branch.is_active}
                            onCheckedChange={(checked) => toggleBranchActive(branch.id, checked)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {branch.is_active ? t.active : t.inactive}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(branch)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(branch)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBranch ? t.editBranch : t.addBranch}
            </DialogTitle>
            <DialogDescription>
              {t.desc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.name} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={`Contoh: ${term.singular} Pusat`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">{t.code} *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Contoh: PST"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.color}</Label>
              <div className="flex items-center gap-3">
                <div className="flex gap-2 flex-wrap">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.badge_color === color 
                          ? 'border-foreground scale-110' 
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, badge_color: color })}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  value={formData.badge_color}
                  onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                  className="w-12 h-8 p-0 border-0 cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchDescription">{t.description}</Label>
              <Textarea
                id="branchDescription"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Deskripsi opsional..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.preview}</Label>
              <div className="p-3 bg-muted rounded-md">
                <Badge
                  style={{ backgroundColor: formData.badge_color }}
                  className="text-white"
                >
                  {formData.name || `Nama ${term.singular}`}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !formData.name.trim() || !formData.code.trim()}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
