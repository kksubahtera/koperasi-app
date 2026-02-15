import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Pencil, Trash2, FileText, Loader2, ChevronRight, Lock, Building2, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { useChartOfAccounts, ChartOfAccountInput, AccountType } from '@/hooks/useChartOfAccounts';
import { useBusinessUnits } from '@/hooks/useBusinessUnits';
import { toast } from 'sonner';
import { 
  validateAccountName, 
  ACCOUNT_TYPE_TERMINOLOGY,
  getSynonyms,
  AccountTypeCode 
} from '@/lib/accountingTerminology';
import { AccountTypeBadge } from '@/components/shared/TermTooltip';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { QuickEquationGuide } from './QuickEquationGuide';

const ACCOUNT_TYPES: { value: AccountType; label: string; synonyms: string[]; color: string }[] = [
  { value: 'asset', label: 'Aset', synonyms: ACCOUNT_TYPE_TERMINOLOGY.asset.synonyms, color: 'bg-blue-100 text-blue-800' },
  { value: 'liability', label: 'Kewajiban', synonyms: ACCOUNT_TYPE_TERMINOLOGY.liability.synonyms, color: 'bg-red-100 text-red-800' },
  { value: 'equity', label: 'Modal', synonyms: ACCOUNT_TYPE_TERMINOLOGY.equity.synonyms, color: 'bg-green-100 text-green-800' },
  { value: 'income', label: 'Pendapatan', synonyms: ACCOUNT_TYPE_TERMINOLOGY.income.synonyms, color: 'bg-emerald-100 text-emerald-800' },
  { value: 'expense', label: 'Beban', synonyms: ACCOUNT_TYPE_TERMINOLOGY.expense.synonyms, color: 'bg-orange-100 text-orange-800' },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

export const ChartOfAccountsManagement = () => {
  const { accounts, loading, addAccount, updateAccount, deleteAccount, createStandardAccounts, getMissingStandardAccounts } = useChartOfAccounts();
  const { units } = useBusinessUnits();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [formData, setFormData] = useState<ChartOfAccountInput>({
    account_code: '',
    account_name: '',
    account_type: 'asset',
    parent_id: null,
    business_unit_id: null,
    description: '',
    is_active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<AccountType | 'all'>('all');
  const [nameValidation, setNameValidation] = useState<{ isValid: boolean; warning?: string; duplicates?: string[] }>({ isValid: true });
  const [codeValidation, setCodeValidation] = useState<{ isValid: boolean; error?: string; suggestion?: string }>({ isValid: true });
  const [isCreatingStandard, setIsCreatingStandard] = useState(false);

  // Account type prefix mapping
  const accountTypePrefix: Record<AccountType, string> = {
    asset: '1',
    liability: '2',
    equity: '3',
    income: '4',
    expense: '5'
  };

  const accountTypeName: Record<AccountType, string> = {
    asset: 'Aset',
    liability: 'Kewajiban',
    equity: 'Ekuitas',
    income: 'Pendapatan',
    expense: 'Beban'
  };

  // Check for missing standard accounts
  const missingAccounts = getMissingStandardAccounts();
  const hasMissingAccounts = missingAccounts.length > 0;

  const handleCreateStandardAccounts = async () => {
    setIsCreatingStandard(true);
    await createStandardAccounts();
    setIsCreatingStandard(false);
  };

  // Get existing account names for validation
  const existingAccountNames = useMemo(() => 
    accounts.map(a => a.account_name), 
    [accounts]
  );

  // Get existing account codes for validation
  const existingAccountCodes = useMemo(() => 
    accounts.map(a => a.account_code.toUpperCase()), 
    [accounts]
  );

  // Validate account code format and suggest next available code
  const validateAccountCode = (code: string, accountType: AccountType, isEditing: boolean = false, originalCode: string = '') => {
    const trimmedCode = code.trim();
    
    // Empty check
    if (!trimmedCode) {
      return { isValid: false, error: 'Kode akun wajib diisi' };
    }

    // Format check: X-XXXX (digit-4digits)
    const formatRegex = /^[1-5]-[0-9]{4}$/;
    if (!formatRegex.test(trimmedCode)) {
      const expectedPrefix = accountTypePrefix[accountType];
      const suggestion = suggestNextCode(accountType);
      return { 
        isValid: false, 
        error: `Format harus X-XXXX (contoh: ${expectedPrefix}-1000)`,
        suggestion
      };
    }

    // Check if first digit matches account type
    const firstDigit = trimmedCode.charAt(0);
    const expectedPrefix = accountTypePrefix[accountType];
    if (firstDigit !== expectedPrefix) {
      const suggestion = suggestNextCode(accountType);
      return { 
        isValid: false, 
        error: `Awalan "${firstDigit}" tidak sesuai untuk tipe ${accountTypeName[accountType]}. Gunakan awalan "${expectedPrefix}"`,
        suggestion
      };
    }

    // Check for duplicate (exclude current code when editing)
    const codesToCheck = isEditing 
      ? existingAccountCodes.filter(c => c !== originalCode.toUpperCase())
      : existingAccountCodes;
    
    if (codesToCheck.includes(trimmedCode.toUpperCase())) {
      const suggestion = suggestNextCode(accountType);
      return { 
        isValid: false, 
        error: `Kode akun "${trimmedCode}" sudah digunakan`,
        suggestion
      };
    }

    return { isValid: true };
  };

  // Suggest next available code for account type
  const suggestNextCode = (accountType: AccountType): string => {
    const prefix = accountTypePrefix[accountType];
    const typeAccounts = accounts
      .filter(a => a.account_code.startsWith(`${prefix}-`))
      .map(a => {
        const match = a.account_code.match(/^[1-5]-(\d{4})$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));

    if (typeAccounts.length === 0) {
      return `${prefix}-1000`;
    }

    const maxCode = Math.max(...typeAccounts);
    const nextCode = maxCode + 10; // Increment by 10 for room to insert between
    return `${prefix}-${nextCode.toString().padStart(4, '0')}`;
  };

  // Handle account code change with validation
  const handleCodeChange = (code: string) => {
    setFormData({ ...formData, account_code: code });
    
    const originalCode = editingAccount 
      ? accounts.find(a => a.id === editingAccount)?.account_code || ''
      : '';
    
    const validation = validateAccountCode(code, formData.account_type, !!editingAccount, originalCode);
    setCodeValidation(validation);
  };

  // Handle account type change - revalidate code and suggest new code
  const handleTypeChange = (newType: AccountType) => {
    setFormData({ ...formData, account_type: newType });
    
    // If code exists, revalidate with new type
    if (formData.account_code) {
      const originalCode = editingAccount 
        ? accounts.find(a => a.id === editingAccount)?.account_code || ''
        : '';
      
      const validation = validateAccountCode(formData.account_code, newType, !!editingAccount, originalCode);
      setCodeValidation(validation);
    } else {
      // Suggest a code for the new type
      const suggestion = suggestNextCode(newType);
      setCodeValidation({ isValid: true, suggestion });
    }
  };

  // Apply suggested code
  const applySuggestedCode = () => {
    if (codeValidation.suggestion) {
      setFormData({ ...formData, account_code: codeValidation.suggestion });
      setCodeValidation({ isValid: true });
    }
  };

  // Validate account name on change
  const handleNameChange = (name: string) => {
    setFormData({ ...formData, account_name: name });
    
    // Exclude current account name when editing
    const namesToCheck = editingAccount 
      ? existingAccountNames.filter(n => n !== accounts.find(a => a.id === editingAccount)?.account_name)
      : existingAccountNames;
    
    const validation = validateAccountName(name, namesToCheck);
    setNameValidation(validation);
  };

  const resetForm = () => {
    setFormData({
      account_code: '',
      account_name: '',
      account_type: 'asset',
      parent_id: null,
      business_unit_id: null,
      description: '',
      is_active: true
    });
    setEditingAccount(null);
    setNameValidation({ isValid: true });
    setCodeValidation({ isValid: true, suggestion: suggestNextCode('asset') });
  };

  // Initialize suggested code when opening add dialog
  const openAddDialog = () => {
    resetForm();
    setCodeValidation({ isValid: true, suggestion: suggestNextCode('asset') });
    setIsAddDialogOpen(true);
  };

  const handleAdd = async () => {
    if (!formData.account_code || !formData.account_name) {
      toast.error('Kode dan nama akun wajib diisi');
      return;
    }

    // Validate code before submit
    const codeCheck = validateAccountCode(formData.account_code, formData.account_type, false, '');
    if (!codeCheck.isValid) {
      toast.error(codeCheck.error || 'Format kode akun tidak valid');
      return;
    }

    if (!nameValidation.isValid && nameValidation.duplicates && nameValidation.duplicates.length > 0) {
      toast.error(`Nama akun duplikasi dengan: ${nameValidation.duplicates.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    const result = await addAccount(formData);
    setIsSubmitting(false);

    if (result) {
      setIsAddDialogOpen(false);
      resetForm();
    }
  };

  const handleEdit = async () => {
    if (!editingAccount || !formData.account_code || !formData.account_name) {
      toast.error('Kode dan nama akun wajib diisi');
      return;
    }

    // Validate code before submit
    const originalCode = accounts.find(a => a.id === editingAccount)?.account_code || '';
    const codeCheck = validateAccountCode(formData.account_code, formData.account_type, true, originalCode);
    if (!codeCheck.isValid) {
      toast.error(codeCheck.error || 'Format kode akun tidak valid');
      return;
    }

    if (!nameValidation.isValid && nameValidation.duplicates && nameValidation.duplicates.length > 0) {
      toast.error(`Nama akun duplikasi dengan: ${nameValidation.duplicates.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    const result = await updateAccount(editingAccount, formData);
    setIsSubmitting(false);

    if (result) {
      setIsEditDialogOpen(false);
      resetForm();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus akun ini?')) {
      await deleteAccount(id);
    }
  };

  const openEditDialog = (account: typeof accounts[0]) => {
    setFormData({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      parent_id: account.parent_id,
      business_unit_id: account.business_unit_id,
      description: account.description || '',
      is_active: account.is_active
    });
    setEditingAccount(account.id);
    setCodeValidation({ isValid: true }); // Current code is valid
    setNameValidation({ isValid: true });
    setIsEditDialogOpen(true);
  };

  const getTypeConfig = (type: AccountType) => {
    return ACCOUNT_TYPES.find(t => t.value === type) || ACCOUNT_TYPES[0];
  };

  // Group accounts by type
  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.account_type]) {
      acc[account.account_type] = [];
    }
    acc[account.account_type].push(account);
    return acc;
  }, {} as Record<AccountType, typeof accounts>);

  const filteredAccounts = filterType === 'all' 
    ? accounts 
    : accounts.filter(a => a.account_type === filterType);

  const FormContent = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-3 sm:space-y-4">
      {/* Account Type First - to determine code prefix */}
      <div className="space-y-1.5 sm:space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="account_type" className="text-xs sm:text-sm">Jenis Akun *</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <div className="space-y-1 text-xs">
                <p className="font-medium">Persamaan Akuntansi:</p>
                <p className="font-mono">Aset = Kewajiban + Modal</p>
                <p className="text-muted-foreground">(Aktiva = Utang + Ekuitas)</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <Select
          value={formData.account_type}
          onValueChange={(value: AccountType) => handleTypeChange(value)}
        >
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs px-1.5">
                    {accountTypePrefix[type.value]}-XXXX
                  </Badge>
                  <span className="text-sm">{type.label}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                    ({type.synonyms.filter(s => s !== type.label).slice(0, 2).join(', ')})
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Account Code with Validation */}
      <div className="space-y-1.5 sm:space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="account_code" className="text-xs sm:text-sm">Kode Akun *</Label>
          <span className="text-[10px] text-muted-foreground font-mono">
            Format: {accountTypePrefix[formData.account_type]}-XXXX
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            id="account_code"
            placeholder={`${accountTypePrefix[formData.account_type]}-1000`}
            value={formData.account_code}
            onChange={(e) => handleCodeChange(e.target.value.toUpperCase())}
            maxLength={6}
            className={`text-sm font-mono ${!codeValidation.isValid ? 'border-red-500' : ''}`}
          />
          {codeValidation.suggestion && (
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={applySuggestedCode}
              className="shrink-0 text-xs"
            >
              Gunakan {codeValidation.suggestion}
            </Button>
          )}
        </div>
        {!codeValidation.isValid && codeValidation.error && (
          <Alert className="py-1.5 sm:py-2 border-red-500 bg-red-50 dark:bg-red-900/20">
            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
            <AlertDescription className="text-xs sm:text-sm text-red-700 dark:text-red-300">
              {codeValidation.error}
              {codeValidation.suggestion && (
                <span className="ml-1">
                  Saran: <button 
                    type="button"
                    onClick={applySuggestedCode}
                    className="font-mono font-medium underline hover:no-underline"
                  >
                    {codeValidation.suggestion}
                  </button>
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
        {codeValidation.isValid && formData.account_code && (
          <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            ✓ Format kode akun valid
          </p>
        )}
      </div>
      <div className="space-y-1.5 sm:space-y-2">
        <Label htmlFor="account_name" className="text-xs sm:text-sm">Nama Akun *</Label>
        <Input
          id="account_name"
          placeholder="Kas Umum"
          value={formData.account_name}
          onChange={(e) => handleNameChange(e.target.value)}
          maxLength={100}
          className={`text-sm ${!nameValidation.isValid ? 'border-yellow-500' : ''}`}
        />
        {!nameValidation.isValid && nameValidation.warning && (
          <Alert className="py-1.5 sm:py-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600" />
            <AlertDescription className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300">
              {nameValidation.warning}
            </AlertDescription>
          </Alert>
        )}
        {formData.account_name && nameValidation.isValid && (
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {(() => {
              const synonyms = getSynonyms(formData.account_name);
              if (synonyms && synonyms.length > 1) {
                const alternatives = synonyms.filter(s => s.toLowerCase() !== formData.account_name.toLowerCase());
                if (alternatives.length > 0) {
                  return `Istilah setara: ${alternatives.slice(0, 3).join(', ')}`;
                }
              }
              return null;
            })()}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="parent_id" className="text-xs sm:text-sm">Akun Induk</Label>
          <Select
            value={formData.parent_id || 'none'}
            onValueChange={(value) => setFormData({ ...formData, parent_id: value === 'none' ? null : value })}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Tidak ada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tidak ada</SelectItem>
              {accounts
                .filter(a => a.account_type === formData.account_type && a.id !== editingAccount)
                .map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    <span className="text-sm">{account.account_code} - {account.account_name}</span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="business_unit_id" className="text-xs sm:text-sm">Unit Usaha</Label>
          <Select
            value={formData.business_unit_id || 'none'}
            onValueChange={(value) => setFormData({ ...formData, business_unit_id: value === 'none' ? null : value })}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Semua unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Semua unit (umum)</SelectItem>
              {units.filter(u => u.is_active).map(unit => (
                <SelectItem key={unit.id} value={unit.id}>
                  <span className="text-sm">{unit.code} - {unit.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5 sm:space-y-2">
        <Label htmlFor="description" className="text-xs sm:text-sm">Deskripsi</Label>
        <Textarea
          id="description"
          placeholder="Deskripsi akun..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          className="text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="is_active" className="text-xs sm:text-sm">Akun Aktif</Label>
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
    <div className="space-y-3 sm:space-y-4">
      {/* Quick Reference Guide */}
      <QuickEquationGuide variant="chart-of-accounts" />
      
      <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-6">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
            Chart of Accounts (Daftar Akun)
          </CardTitle>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Struktur akun koperasi sesuai standar pembukuan
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCreateStandardAccounts}
            disabled={isCreatingStandard || !hasMissingAccounts}
            className={`h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3 ${
              hasMissingAccounts 
                ? 'border-amber-500 text-amber-700 hover:bg-amber-50' 
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            {isCreatingStandard ? (
              <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">
              {hasMissingAccounts ? `Buat Akun Standar (${missingAccounts.length})` : 'Akun Standar Lengkap'}
            </span>
            <span className="sm:hidden">{hasMissingAccounts ? missingAccounts.length : '✓'}</span>
          </Button>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as AccountType | 'all')}>
            <SelectTrigger className="w-[100px] sm:w-[150px] h-8 sm:h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Jenis</SelectItem>
              {ACCOUNT_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            if (open) {
              openAddDialog();
            } else {
              setIsAddDialogOpen(false);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3">
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Tambah Akun</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Tambah Akun Baru</DialogTitle>
              </DialogHeader>
              <FormContent />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="text-xs sm:text-sm">Batal</Button>
                <Button 
                  onClick={handleAdd} 
                  disabled={isSubmitting || !codeValidation.isValid || !formData.account_code}
                  className="text-xs sm:text-sm"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 animate-spin" />}
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        {filterType === 'all' ? (
          <Accordion type="multiple" className="w-full" defaultValue={['asset', 'equity', 'income', 'expense']}>
            {ACCOUNT_TYPES.map(type => {
              const typeAccounts = groupedAccounts[type.value] || [];
              return (
                <AccordionItem key={type.value} value={type.value}>
                  <AccordionTrigger className="hover:no-underline py-2 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Badge className={`${type.color} text-[10px] sm:text-xs`}>{type.label}</Badge>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        ({typeAccounts.length} akun)
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <AccountTable 
                      accounts={typeAccounts} 
                      onEdit={openEditDialog}
                      onDelete={handleDelete}
                      getTypeConfig={getTypeConfig}
                    />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <AccountTable 
            accounts={filteredAccounts} 
            onEdit={openEditDialog}
            onDelete={handleDelete}
            getTypeConfig={getTypeConfig}
          />
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Edit Akun</DialogTitle>
            </DialogHeader>
            <FormContent isEdit />
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="text-xs sm:text-sm">Batal</Button>
              <Button 
                onClick={handleEdit} 
                disabled={isSubmitting || !codeValidation.isValid || !formData.account_code}
                className="text-xs sm:text-sm"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
    </div>
  );
};

interface AccountTableProps {
  accounts: ReturnType<typeof useChartOfAccounts>['accounts'];
  onEdit: (account: ReturnType<typeof useChartOfAccounts>['accounts'][0]) => void;
  onDelete: (id: string) => void;
  getTypeConfig: (type: AccountType) => { value: AccountType; label: string; color: string };
}

const AccountTable = ({ accounts, onEdit, onDelete, getTypeConfig }: AccountTableProps) => {
  if (accounts.length === 0) {
    return (
      <div className="text-center py-4 sm:py-6 text-muted-foreground">
        <FileText className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 opacity-50" />
        <p className="text-xs sm:text-sm">Tidak ada akun</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-3 sm:mx-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px] sm:w-[120px] text-[10px] sm:text-xs">Kode</TableHead>
            <TableHead className="text-[10px] sm:text-xs">Nama Akun</TableHead>
            <TableHead className="text-[10px] sm:text-xs hidden md:table-cell">Unit Usaha</TableHead>
            <TableHead className="text-right text-[10px] sm:text-xs hidden sm:table-cell">Saldo</TableHead>
            <TableHead className="text-[10px] sm:text-xs hidden lg:table-cell">Status</TableHead>
            <TableHead className="text-right text-[10px] sm:text-xs w-16 sm:w-auto">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-mono font-medium text-[10px] sm:text-sm p-2 sm:p-4">
                {account.account_code}
                {account.is_system && (
                  <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline ml-1 text-muted-foreground" />
                )}
              </TableCell>
              <TableCell className="p-2 sm:p-4">
                <div>
                  <span className="font-medium text-[10px] sm:text-sm">{account.account_name}</span>
                  {account.description && (
                    <p className="text-[8px] sm:text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-xs">
                      {account.description}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell p-2 sm:p-4">
                {account.business_unit ? (
                  <Badge variant="outline" className="text-[8px] sm:text-xs">
                    <Building2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                    {account.business_unit.code}
                  </Badge>
                ) : (
                  <span className="text-[10px] sm:text-xs text-muted-foreground">Umum</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-[10px] sm:text-sm hidden sm:table-cell p-2 sm:p-4">
                {formatCurrency(account.balance)}
              </TableCell>
              <TableCell className="hidden lg:table-cell p-2 sm:p-4">
                <Badge variant={account.is_active ? 'default' : 'secondary'} className="text-[8px] sm:text-xs">
                  {account.is_active ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </TableCell>
              <TableCell className="text-right p-1 sm:p-4">
                <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(account)}
                    className="h-7 w-7 sm:h-8 sm:w-8"
                  >
                    <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(account.id)}
                    className="text-destructive hover:text-destructive h-7 w-7 sm:h-8 sm:w-8"
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
