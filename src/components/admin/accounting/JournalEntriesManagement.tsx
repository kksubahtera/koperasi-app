import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilterSelect } from '@/components/ui/filter-select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, BookOpen, Loader2, Eye, Calendar, Building2, AlertCircle, Check, X } from 'lucide-react';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { useJournalEntries, JournalEntryLineInput } from '@/hooks/useJournalEntries';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { useBusinessUnits } from '@/hooks/useBusinessUnits';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { QuickEquationGuide } from './QuickEquationGuide';
import { AccountSelector } from './AccountSelector';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

export const JournalEntriesManagement = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  
  const { entries, loading, createEntry, deleteEntry, getEntryWithLines } = useJournalEntries(selectedYear, selectedUnitId);
  const { accounts } = useChartOfAccounts();
  const { units } = useBusinessUnits();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<Awaited<ReturnType<typeof getEntryWithLines>> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [businessUnitId, setBusinessUnitId] = useState<string | null>(null);
  const [lines, setLines] = useState<JournalEntryLineInput[]>([
    { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
    { account_id: '', debit_amount: 0, credit_amount: 0, description: '' }
  ]);

  const resetForm = () => {
    setEntryDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setBusinessUnitId(null);
    setLines([
      { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
      { account_id: '', debit_amount: 0, credit_amount: 0, description: '' }
    ]);
  };

  const addLine = () => {
    setLines([...lines, { account_id: '', debit_amount: 0, credit_amount: 0, description: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) {
      toast.error('Jurnal minimal harus memiliki 2 baris');
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof JournalEntryLineInput, value: string | number) => {
    const newLines = [...lines];
    if (field === 'debit_amount' || field === 'credit_amount') {
      newLines[index][field] = Number(value) || 0;
      
      // Auto-clear the other field to prevent same amount in both debit and credit
      if (field === 'debit_amount' && Number(value) > 0) {
        newLines[index].credit_amount = 0;
      } else if (field === 'credit_amount' && Number(value) > 0) {
        newLines[index].debit_amount = 0;
      }
    } else {
      newLines[index][field] = value as string;
    }
    setLines(newLines);
  };

  const totalDebit = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // Validation: Check for lines with both debit and credit amounts
  const hasInvalidLines = lines.some(line => 
    (line.debit_amount || 0) > 0 && (line.credit_amount || 0) > 0
  );

  // Validation: Check for duplicate accounts in the same line type (optional)
  const getDuplicateAccountWarnings = () => {
    const warnings: string[] = [];
    const debitAccounts = lines.filter(l => l.debit_amount > 0).map(l => l.account_id).filter(Boolean);
    const creditAccounts = lines.filter(l => l.credit_amount > 0).map(l => l.account_id).filter(Boolean);
    
    // Check if same account appears in both debit and credit across different lines
    const sameAccountBothSides = debitAccounts.filter(acc => creditAccounts.includes(acc));
    if (sameAccountBothSides.length > 0) {
      const accountNames = sameAccountBothSides.map(accId => {
        const acc = accounts.find(a => a.id === accId);
        return acc ? `${acc.account_code} - ${acc.account_name}` : accId;
      });
      warnings.push(`Akun ${accountNames.join(', ')} muncul di debit dan kredit (pastikan ini disengaja)`);
    }
    
    return warnings;
  };

  const duplicateWarnings = getDuplicateAccountWarnings();

  const handleSubmit = async () => {
    // Validate
    if (!description.trim()) {
      toast.error('Deskripsi jurnal wajib diisi');
      return;
    }

    const validLines = lines.filter(l => l.account_id && (l.debit_amount || l.credit_amount));
    if (validLines.length < 2) {
      toast.error('Minimal 2 baris jurnal dengan akun dan nominal');
      return;
    }

    // Check for invalid lines (same account with both debit and credit)
    if (hasInvalidLines) {
      toast.error('Setiap baris hanya boleh memiliki nilai di Debit ATAU Kredit, tidak keduanya');
      return;
    }

    if (!isBalanced) {
      toast.error('Jurnal tidak seimbang! Total Debit harus sama dengan Total Kredit');
      return;
    }

    setIsSubmitting(true);
    const result = await createEntry({
      entry_date: entryDate,
      description,
      business_unit_id: businessUnitId,
      lines: validLines
    });
    setIsSubmitting(false);

    if (result) {
      setIsAddDialogOpen(false);
      resetForm();
    }
  };

  const handleView = async (entryId: string) => {
    const entry = await getEntryWithLines(entryId);
    if (entry) {
      setViewingEntry(entry);
      setIsViewDialogOpen(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus jurnal ini? Saldo akun akan dikembalikan.')) {
      await deleteEntry(id);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <QuickEquationGuide variant="journal" />
      
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
              Jurnal Umum
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Catat transaksi dengan sistem double-entry
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FilterSelect
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(Number(v))}
              options={years.map(year => ({ value: year.toString(), label: year.toString() }))}
              showAllOption={false}
              icon={Calendar}
              triggerClassName="w-[85px] sm:w-[100px] h-8 sm:h-9 text-xs sm:text-sm"
            />
            <FilterSelect
              value={selectedUnitId || 'all'}
              onValueChange={(v) => setSelectedUnitId(v === 'all' ? undefined : v)}
              options={units.map(unit => ({ value: unit.id, label: `${unit.code} - ${unit.name}` }))}
              placeholder="Semua Unit"
              allLabel="Semua Unit"
              icon={Building2}
              triggerClassName="w-[110px] sm:w-[150px] h-8 sm:h-9 text-xs sm:text-sm"
            />
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden xs:inline">Buat</span> Jurnal
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg">Buat Jurnal Baru</DialogTitle>
                </DialogHeader>
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Tanggal</Label>
                    <Input
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2 sm:col-span-2">
                    <Label className="text-xs sm:text-sm">Unit Usaha</Label>
                    <Select
                      value={businessUnitId || 'none'}
                      onValueChange={(v) => setBusinessUnitId(v === 'none' ? null : v)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Pilih unit (opsional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-sm">Umum (tanpa unit)</SelectItem>
                        {units.filter(u => u.is_active).map(unit => (
                          <SelectItem key={unit.id} value={unit.id} className="text-sm">
                            {unit.code} - {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Deskripsi *</Label>
                  <Textarea
                    placeholder="Contoh: Penerimaan bunga pinjaman anggota..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="text-xs sm:text-sm">Detail Jurnal</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-8 text-xs sm:text-sm w-full sm:w-auto">
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> Tambah Baris
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="min-w-[150px] sm:min-w-[200px] text-[10px] sm:text-xs">Akun</TableHead>
                          <TableHead className="min-w-[100px] text-[10px] sm:text-xs hidden sm:table-cell">Keterangan</TableHead>
                          <TableHead className="min-w-[90px] sm:min-w-[120px] text-right text-[10px] sm:text-xs">Debit</TableHead>
                          <TableHead className="min-w-[90px] sm:min-w-[120px] text-right text-[10px] sm:text-xs">Kredit</TableHead>
                          <TableHead className="w-10 sm:w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line, index) => (
                          <TableRow key={index}>
                            <TableCell className="py-1.5 sm:py-2">
                              <AccountSelector
                                accounts={accounts}
                                value={line.account_id}
                                onValueChange={(v) => updateLine(index, 'account_id', v)}
                                placeholder="Pilih akun"
                              />
                            </TableCell>
                            <TableCell className="py-1.5 sm:py-2 hidden sm:table-cell">
                              <Input
                                className="h-8 sm:h-9 text-xs sm:text-sm"
                                placeholder="Keterangan"
                                value={line.description || ''}
                                onChange={(e) => updateLine(index, 'description', e.target.value)}
                              />
                            </TableCell>
                            <TableCell className="py-1.5 sm:py-2">
                              <Input
                                type="number"
                                className="h-8 sm:h-9 text-right text-xs sm:text-sm"
                                value={line.debit_amount || ''}
                                onChange={(e) => updateLine(index, 'debit_amount', e.target.value)}
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell className="py-1.5 sm:py-2">
                              <Input
                                type="number"
                                className="h-8 sm:h-9 text-right text-xs sm:text-sm"
                                value={line.credit_amount || ''}
                                onChange={(e) => updateLine(index, 'credit_amount', e.target.value)}
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell className="py-1.5 sm:py-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 sm:h-8 sm:w-8"
                                onClick={() => removeLine(index)}
                              >
                                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell colSpan={2} className="text-right text-xs sm:text-sm hidden sm:table-cell">
                            Total
                          </TableCell>
                          <TableCell className="text-right text-xs sm:text-sm sm:hidden">
                            Total
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm">
                            {formatCurrency(totalDebit)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm">
                            {formatCurrency(totalCredit)}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Validation Indicators */}
                  <div className="space-y-2">
                    {/* Invalid line warning */}
                    {hasInvalidLines && (
                      <div className="flex items-start gap-2 p-2 sm:p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                        <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5" />
                        <span className="text-[10px] sm:text-sm">
                          Setiap baris hanya boleh memiliki nilai di Debit ATAU Kredit
                        </span>
                      </div>
                    )}

                    {/* Duplicate account warnings */}
                    {duplicateWarnings.map((warning, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 sm:p-3 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                        <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5" />
                        <span className="text-[10px] sm:text-sm">{warning}</span>
                      </div>
                    ))}

                    {/* Balance indicator */}
                    <div className={`flex items-center gap-2 p-2 sm:p-3 rounded-lg ${
                      isBalanced && !hasInvalidLines
                        ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' 
                        : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                    }`}>
                      {isBalanced && !hasInvalidLines ? (
                        <>
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="text-[10px] sm:text-sm">Jurnal seimbang dan valid</span>
                        </>
                      ) : !isBalanced ? (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="text-[10px] sm:text-sm">
                            Selisih: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} size="sm" className="text-xs sm:text-sm">Batal</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || !isBalanced || hasInvalidLines} size="sm" className="text-xs sm:text-sm">
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />}
                  Simpan Jurnal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {entries.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-muted-foreground">
            <BookOpen className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
            <p className="text-sm sm:text-base">Belum ada jurnal di tahun {selectedYear}</p>
            <p className="text-xs sm:text-sm">Klik "Buat Jurnal" untuk membuat jurnal baru</p>
          </div>
        ) : (
          <ResponsiveTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm whitespace-nowrap">No. Jurnal</TableHead>
                  <TableHead className="text-xs sm:text-sm whitespace-nowrap">Tanggal</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden md:table-cell">Deskripsi</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Unit</TableHead>
                  <TableHead className="text-xs sm:text-sm text-right whitespace-nowrap">Debit</TableHead>
                  <TableHead className="text-xs sm:text-sm text-right whitespace-nowrap">Kredit</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-xs sm:text-sm text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-[10px] sm:text-xs whitespace-nowrap py-2 sm:py-3">
                      {entry.entry_number}
                    </TableCell>
                    <TableCell className="text-[10px] sm:text-xs whitespace-nowrap py-2 sm:py-3">
                      {format(new Date(entry.entry_date), 'dd/MM/yy', { locale: id })}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm max-w-[150px] truncate hidden md:table-cell py-2 sm:py-3">
                      {entry.description}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell py-2 sm:py-3">
                      {entry.business_unit ? (
                        <Badge variant="outline" className="text-[10px] sm:text-xs">
                          {entry.business_unit.code}
                        </Badge>
                      ) : (
                        <span className="text-[10px] sm:text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[10px] sm:text-xs whitespace-nowrap py-2 sm:py-3">
                      {formatCurrency(entry.total_debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[10px] sm:text-xs whitespace-nowrap py-2 sm:py-3">
                      {formatCurrency(entry.total_credit)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell py-2 sm:py-3">
                      <Badge 
                        variant={entry.is_balanced ? 'default' : 'destructive'}
                        className="text-[10px] sm:text-xs"
                      >
                        {entry.status === 'posted' ? 'Posted' : entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-2 sm:py-3">
                      <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          onClick={() => handleView(entry.id)}
                        >
                          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTable>
        )}

        {/* View Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Detail Jurnal</DialogTitle>
            </DialogHeader>
            {viewingEntry && (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <span className="text-muted-foreground">No. Jurnal:</span>
                    <p className="font-mono font-medium text-xs sm:text-sm">{viewingEntry.entry_number}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tanggal:</span>
                    <p className="text-xs sm:text-sm">{format(new Date(viewingEntry.entry_date), 'dd MMMM yyyy', { locale: id })}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Deskripsi:</span>
                    <p className="text-xs sm:text-sm">{viewingEntry.description}</p>
                  </div>
                  {viewingEntry.business_unit && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Unit Usaha:</span>
                      <p className="text-xs sm:text-sm">{viewingEntry.business_unit.code} - {viewingEntry.business_unit.name}</p>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] sm:text-xs">Akun</TableHead>
                        <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">Keterangan</TableHead>
                        <TableHead className="text-right text-[10px] sm:text-xs">Debit</TableHead>
                        <TableHead className="text-right text-[10px] sm:text-xs">Kredit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingEntry.lines?.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium text-[10px] sm:text-sm py-1.5 sm:py-2">
                            <span className="line-clamp-2">{line.account?.account_code} - {line.account?.account_name}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-[10px] sm:text-sm hidden sm:table-cell py-1.5 sm:py-2">
                            {line.description || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[10px] sm:text-sm py-1.5 sm:py-2">
                            {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[10px] sm:text-sm py-1.5 sm:py-2">
                            {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-medium">
                        <TableCell colSpan={2} className="text-right text-[10px] sm:text-sm hidden sm:table-cell">Total</TableCell>
                        <TableCell className="text-right text-[10px] sm:text-sm sm:hidden">Total</TableCell>
                        <TableCell className="text-right font-mono text-[10px] sm:text-sm">
                          {formatCurrency(viewingEntry.total_debit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[10px] sm:text-sm">
                          {formatCurrency(viewingEntry.total_credit)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} size="sm" className="text-xs sm:text-sm">Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
    </div>
  );
};
