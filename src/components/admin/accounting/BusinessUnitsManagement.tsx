import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Building2, Star, Loader2, GripVertical } from 'lucide-react';
import { useBusinessUnits, BusinessUnitInput, BusinessUnit } from '@/hooks/useBusinessUnits';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRowProps {
  unit: BusinessUnit;
  onEdit: (unit: BusinessUnit) => void;
  onDelete: (id: string, isPrimary: boolean) => void;
}

const SortableRow = ({ unit, onEdit, onDelete }: SortableRowProps) => {
  // Primary unit (SP) tidak boleh di-drag
  const isDragDisabled = unit.is_primary;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: unit.id,
    disabled: isDragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-muted' : ''}>
      <TableCell className="p-1 sm:p-2 w-8">
        {isDragDisabled ? (
          <div className="p-1 opacity-30 cursor-not-allowed" title="Unit utama tidak dapat dipindahkan">
            <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </div>
        ) : (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
          >
            <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </button>
        )}
      </TableCell>
      <TableCell className="font-mono font-medium text-[10px] sm:text-sm p-2 sm:p-4">
        {unit.code}
        {unit.is_primary && (
          <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline ml-1 text-yellow-500 fill-yellow-500" />
        )}
      </TableCell>
      <TableCell className="font-medium text-[10px] sm:text-sm p-2 sm:p-4">{unit.name}</TableCell>
      <TableCell className="text-muted-foreground max-w-xs truncate text-[10px] sm:text-sm hidden md:table-cell p-2 sm:p-4">
        {unit.description || '-'}
      </TableCell>
      <TableCell className="p-2 sm:p-4">
        <Badge variant={unit.is_active ? 'default' : 'secondary'} className="text-[8px] sm:text-xs">
          {unit.is_active ? 'Aktif' : 'Nonaktif'}
        </Badge>
      </TableCell>
      <TableCell className="text-right p-1 sm:p-4">
        <div className="flex items-center justify-end gap-0.5 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(unit)}
            className="h-7 w-7 sm:h-8 sm:w-8"
          >
            <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          {!unit.is_primary && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(unit.id, unit.is_primary)}
              className="text-destructive hover:text-destructive h-7 w-7 sm:h-8 sm:w-8"
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export const BusinessUnitsManagement = () => {
  const { units, loading, addUnit, updateUnit, deleteUnit, reorderUnits } = useBusinessUnits();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [formData, setFormData] = useState<BusinessUnitInput>({
    code: '',
    name: '',
    description: '',
    is_active: true,
    is_primary: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeactivation, setPendingDeactivation] = useState<{ checked: boolean } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = units.findIndex((u) => u.id === active.id);
      const newIndex = units.findIndex((u) => u.id === over.id);
      
      // Jangan izinkan item dipindahkan ke posisi 0 (posisi SP/primary)
      // dan jangan izinkan SP dipindahkan
      const activeUnit = units.find(u => u.id === active.id);
      const primaryUnit = units.find(u => u.is_primary);
      
      if (activeUnit?.is_primary) {
        toast.error('Unit usaha utama tidak dapat dipindahkan');
        return;
      }
      
      // Jika target adalah posisi primary (index 0), jangan izinkan
      if (primaryUnit && newIndex === 0) {
        toast.error('Tidak dapat menggeser unit ke posisi unit utama');
        return;
      }
      
      const reorderedUnits = arrayMove(units, oldIndex, newIndex);
      await reorderUnits(reorderedUnits);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      is_active: true,
      is_primary: false
    });
    setEditingUnit(null);
  };

  const handleAdd = async () => {
    if (!formData.code || !formData.name) {
      toast.error('Kode dan nama unit wajib diisi');
      return;
    }

    setIsSubmitting(true);
    const result = await addUnit(formData);
    setIsSubmitting(false);

    if (result) {
      setIsAddDialogOpen(false);
      resetForm();
    }
  };

  const handleEdit = async () => {
    if (!editingUnit || !formData.code || !formData.name) {
      toast.error('Kode dan nama unit wajib diisi');
      return;
    }

    const currentUnit = units.find(u => u.id === editingUnit);
    if (currentUnit?.is_primary && !formData.is_active) {
      toast.error('Unit usaha utama tidak dapat dinonaktifkan');
      return;
    }

    setIsSubmitting(true);
    const result = await updateUnit(editingUnit, formData);
    setIsSubmitting(false);

    if (result) {
      setIsEditDialogOpen(false);
      resetForm();
    }
  };

  const handleDelete = async (id: string, isPrimary: boolean) => {
    if (isPrimary) {
      toast.error('Unit usaha utama tidak dapat dihapus');
      return;
    }

    if (confirm('Apakah Anda yakin ingin menghapus unit usaha ini?')) {
      await deleteUnit(id);
    }
  };

  const openEditDialog = (unit: BusinessUnit) => {
    setFormData({
      code: unit.code,
      name: unit.name,
      description: unit.description || '',
      is_active: unit.is_active,
      is_primary: unit.is_primary
    });
    setEditingUnit(unit.id);
    setIsEditDialogOpen(true);
  };

  const FormContent = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="code" className="text-xs sm:text-sm">Kode Unit *</Label>
          <Input
            id="code"
            placeholder="SP, TK, JS..."
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            maxLength={10}
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="name" className="text-xs sm:text-sm">Nama Unit *</Label>
          <Input
            id="name"
            placeholder="Simpan Pinjam"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            maxLength={100}
            className="text-sm"
          />
        </div>
      </div>
      <div className="space-y-1.5 sm:space-y-2">
        <Label htmlFor="description" className="text-xs sm:text-sm">Deskripsi</Label>
        <Textarea
          id="description"
          placeholder="Deskripsi unit usaha..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="text-sm"
        />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => {
              // Jika sedang edit unit non-utama dan ingin menonaktifkan, tampilkan konfirmasi
              if (isEdit && !formData.is_primary && formData.is_active && !checked) {
                setPendingDeactivation({ checked });
                setIsDeactivateDialogOpen(true);
              } else {
                setFormData({ ...formData, is_active: checked });
              }
            }}
            disabled={isEdit && formData.is_primary}
          />
          <Label htmlFor="is_active" className="text-xs sm:text-sm">
            Unit Aktif
            {isEdit && formData.is_primary && (
              <span className="text-muted-foreground ml-1">(tidak dapat dinonaktifkan)</span>
            )}
          </Label>
        </div>
        {!isEdit && (
          <div className="flex items-center gap-2">
            <Switch
              id="is_primary"
              checked={formData.is_primary}
              onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
            />
            <Label htmlFor="is_primary" className="text-xs sm:text-sm">Unit Utama</Label>
          </div>
        )}
      </div>
    </div>
  );

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
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-6">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
            Unit Usaha
          </CardTitle>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Kelola unit usaha koperasi. Seret baris untuk mengubah urutan.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3">
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Tambah Unit</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Tambah Unit Usaha Baru</DialogTitle>
            </DialogHeader>
            <FormContent />
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="text-xs sm:text-sm">Batal</Button>
              <Button onClick={handleAdd} disabled={isSubmitting} className="text-xs sm:text-sm">
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        {units.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-muted-foreground">
            <Building2 className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
            <p className="text-xs sm:text-sm">Belum ada unit usaha</p>
            <p className="text-[10px] sm:text-sm">Klik "Tambah Unit" untuk menambahkan unit usaha baru</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 text-[10px] sm:text-xs"></TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Kode</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Nama Unit</TableHead>
                    <TableHead className="text-[10px] sm:text-xs hidden md:table-cell">Deskripsi</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Status</TableHead>
                    <TableHead className="text-right text-[10px] sm:text-xs">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext items={units.map(u => u.id)} strategy={verticalListSortingStrategy}>
                    {units.map((unit) => (
                      <SortableRow
                        key={unit.id}
                        unit={unit}
                        onEdit={openEditDialog}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          </div>
        )}

        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Edit Unit Usaha</DialogTitle>
            </DialogHeader>
            <FormContent isEdit />
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="text-xs sm:text-sm">Batal</Button>
              <Button onClick={handleEdit} disabled={isSubmitting} className="text-xs sm:text-sm">
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Deactivate Confirmation Dialog */}
        <AlertDialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Nonaktifkan Unit Usaha?</AlertDialogTitle>
              <AlertDialogDescription>
                Unit usaha yang dinonaktifkan tidak akan tampil di menu navigasi dan tidak bisa digunakan untuk transaksi baru. 
                Anda dapat mengaktifkannya kembali kapan saja.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setPendingDeactivation(null);
              }}>
                Batal
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                if (pendingDeactivation) {
                  setFormData({ ...formData, is_active: pendingDeactivation.checked });
                }
                setPendingDeactivation(null);
                setIsDeactivateDialogOpen(false);
              }}>
                Ya, Nonaktifkan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
