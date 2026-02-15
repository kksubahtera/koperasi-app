import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InfiniteScrollLoader } from '@/components/shared/InfiniteScrollLoader';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/ui/currency-input';
import { User, SavingsSummary, Loan, SHURecord, CorrectionTransaction, CorrectionType, CorrectionStatus } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCorrectionJournal } from '@/hooks/useCorrectionJournal';
import { useManualSHUJournal } from '@/hooks/useManualSHUJournal';
import { useBranches } from '@/hooks/useBranches';
import { User as UserIcon, ChevronRight, Wallet, CreditCard, Banknote, Plus, UserMinus, UserPlus, Phone, Mail, IdCard, Building2, KeyRound, Eye, EyeOff, Copy, Check, Shield, PenLine, AlertTriangle, ArrowUpDown, Flag, Minus, FileDown, Loader2, FileText, Receipt, Pencil, RefreshCw } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
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
import { TabNavigation } from '@/components/shared/TabNavigation';
import { UserIcon as ProfileIcon, Wallet as WalletIcon, CreditCard as LoanIcon, Banknote as ShuIcon, PenLine as CorrectionIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { MemberEditDialog } from './MemberEditDialog';
import { MemberNumberRegenerateDialog } from './MemberNumberRegenerateDialog';

interface MemberListProps {
  members: User[];
  onDeactivateMember?: (memberId: string) => void;
  onResetPassword?: (memberId: string, newPassword: string) => void;
  onMakeAdmin?: (memberId: string) => Promise<void>;
  onRemoveAdmin?: (memberId: string) => Promise<void>;
  onViewInactiveMembers?: () => void;
  onAddNewMember?: () => void;
  currentUserId?: string;
  isFetchingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => Promise<void>;
}

interface CorrectionFromDB {
  id: string;
  user_id: string;
  correction_type: CorrectionType;
  operation: 'add' | 'subtract';
  amount: number;
  current_balance: number;
  new_balance: number;
  reason: string;
  footnote: string | null;
  installment_id: string | null;
  installment_number: number | null;
  created_at: string;
  created_by: string | null;
  status: CorrectionStatus;
  reported_at: string | null;
  report_reason: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  correction_mode: 'nominal' | 'transaction_based' | null;
  transaction_id: string | null;
  journal_entry_id: string | null;
}

interface TransactionFromDB {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  date: string;
  status: string;
  created_at: string;
  notes: string | null;
  account_holder_name: string | null;
}

const correctionTypeLabels: Record<CorrectionType, string> = {
  'simpanan_pokok': 'Simpanan Pokok',
  'simpanan_wajib': 'Simpanan Wajib',
  'simpanan_sukarela': 'Simpanan Sukarela',
  'angsuran_pinjaman': 'Angsuran Pinjaman',
};

const correctionStatusLabels: Record<CorrectionStatus, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  'applied': { label: 'Diterapkan', variant: 'success' },
  'reported': { label: 'Dilaporkan', variant: 'warning' },
  'resolved': { label: 'Diselesaikan', variant: 'secondary' },
  'resolved_approved': { label: 'Disetujui', variant: 'success' },
  'resolved_rejected': { label: 'Ditolak', variant: 'secondary' },
};

export const MemberList = ({ members, onDeactivateMember, onResetPassword, onMakeAdmin, onRemoveAdmin, onViewInactiveMembers, onAddNewMember, currentUserId, isFetchingMore = false, hasMore = false, onLoadMore, onRefresh }: MemberListProps) => {
  const { user: authUser } = useAuth();
  const { createCorrectionJournal } = useCorrectionJournal();
  const { createManualSHUJournal } = useManualSHUJournal();
  const { activeBranches, branchFeatureEnabled, branchTerminology, getBranchById } = useBranches();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'savings' | 'loans' | 'shu' | 'correction'>('info');
  const [showSHUDialog, setShowSHUDialog] = useState(false);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [showMakeAdminDialog, setShowMakeAdminDialog] = useState(false);
  const [showRemoveAdminDialog, setShowRemoveAdminDialog] = useState(false);
  const [memberToDeactivate, setMemberToDeactivate] = useState<User | null>(null);
  const [memberToResetPassword, setMemberToResetPassword] = useState<User | null>(null);
  const [memberToMakeAdmin, setMemberToMakeAdmin] = useState<User | null>(null);
  const [memberToRemoveAdmin, setMemberToRemoveAdmin] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [corrections, setCorrections] = useState<CorrectionFromDB[]>([]);
  const [adminUserIds, setAdminUserIds] = useState<string[]>([]);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRegenerateNumberDialog, setShowRegenerateNumberDialog] = useState(false);
  const [shuFormData, setShuFormData] = useState({
    year: new Date().getFullYear(),
    amount: 0,
  });
  const [correctionFormData, setCorrectionFormData] = useState({
    correctionType: '' as CorrectionType | '',
    operation: 'add' as 'add' | 'subtract',
    amount: 0,
    selectedInstallment: '',
    reason: '',
    footnote: '',
    correctionMode: 'nominal' as 'nominal' | 'transaction_based',
    selectedTransaction: '',
  });
  const [existingCorrectionsForTx, setExistingCorrectionsForTx] = useState<number>(0);
  const [memberTransactions, setMemberTransactions] = useState<TransactionFromDB[]>([]);
  const [shuRecordsDB, setShuRecordsDB] = useState<{ id: string; user_id: string; year: number; amount: number; distributed_at: string; notes: string | null }[]>([]);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isSavingSHU, setIsSavingSHU] = useState(false);
  const [savingsSummaryDB, setSavingsSummaryDB] = useState<{ user_id: string; simpanan_pokok: number; simpanan_wajib: number; simpanan_sukarela: number; total_simpanan: number }[]>([]);
  const [loansDB, setLoansDB] = useState<Loan[]>([]);
  const [installmentsDB, setInstallmentsDB] = useState<{
    id: string;
    loan_id: string;
    installment_number: number;
    due_date: string;
    principal_amount: number;
    interest_amount: number;
    total_amount: number;
    paid_amount: number;
    status: string;
    penalty_amount: number;
  }[]>([]);

  // Fetch savings summary from database
  useEffect(() => {
    const fetchSavingsSummary = async () => {
      const { data, error } = await supabase
        .from('savings_summary')
        .select('*');
      
      if (error) {
        console.error('Error fetching savings summary:', error);
        return;
      }
      
      setSavingsSummaryDB(data?.map(d => ({
        user_id: d.user_id,
        simpanan_pokok: Number(d.simpanan_pokok) || 0,
        simpanan_wajib: Number(d.simpanan_wajib) || 0,
        simpanan_sukarela: Number(d.simpanan_sukarela) || 0,
        total_simpanan: Number(d.total_simpanan) || 0,
      })) || []);
    };
    
    fetchSavingsSummary();
  }, []);

  // Fetch loans from database
  useEffect(() => {
    const fetchLoans = async () => {
      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .order('application_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching loans:', error);
        return;
      }
      
      setLoansDB(data?.map(l => {
        // Map database status to Loan type status
        const dbStatus = l.status as string;
        let status: 'pending' | 'active' | 'completed' | 'defaulted' | 'rejected' = 'pending';
        if (dbStatus === 'active' || dbStatus === 'approved') {
          status = 'active';
        } else if (dbStatus === 'completed') {
          status = 'completed';
        } else if (dbStatus === 'rejected') {
          status = 'rejected';
        } else if (dbStatus === 'defaulted') {
          status = 'defaulted';
        }
        
        return {
          id: l.id,
          userId: l.user_id,
          principalAmount: Number(l.principal_amount) || 0,
          remainingPrincipal: Number(l.remaining_principal) || 0,
          tenor: l.tenor,
          interestRate: Number(l.interest_rate) || 0,
          status,
          applicationDate: l.application_date || '',
          disbursementDate: l.disbursement_date || '',
          rejectionReason: l.rejection_reason || undefined,
        };
      }) || []);
    };
    
    fetchLoans();
  }, []);

  // Fetch loan installments from database
  useEffect(() => {
    const fetchInstallments = async () => {
      const { data, error } = await supabase
        .from('loan_installments')
        .select('id, loan_id, installment_number, due_date, principal_amount, interest_amount, total_amount, paid_amount, status, penalty_amount')
        .order('installment_number', { ascending: true });
      
      if (error) {
        console.error('Error fetching installments:', error);
        return;
      }
      
      setInstallmentsDB(data?.map(i => ({
        id: i.id,
        loan_id: i.loan_id,
        installment_number: i.installment_number,
        due_date: i.due_date,
        principal_amount: Number(i.principal_amount) || 0,
        interest_amount: Number(i.interest_amount) || 0,
        total_amount: Number(i.total_amount) || 0,
        paid_amount: Number(i.paid_amount) || 0,
        status: i.status || 'pending',
        penalty_amount: Number(i.penalty_amount) || 0,
      })) || []);
    };
    
    fetchInstallments();
  }, []);

  // Fetch corrections from database
  useEffect(() => {
    const fetchCorrections = async () => {
      const { data, error } = await supabase
        .from('corrections')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching corrections:', error);
        return;
      }
      
      setCorrections(data as CorrectionFromDB[]);
    };
    
    fetchCorrections();
  }, []);

  // Fetch SHU records from database
  useEffect(() => {
    const fetchSHURecords = async () => {
      const { data, error } = await supabase
        .from('shu_records')
        .select('*')
        .order('year', { ascending: false });
      
      if (error) {
        console.error('Error fetching SHU records:', error);
        return;
      }
      
      setShuRecordsDB(data || []);
    };
    
    fetchSHURecords();
  }, []);

  // Fetch admin roles from database
  useEffect(() => {
    const fetchAdminRoles = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      
      if (error) {
        console.error('Error fetching admin roles:', error);
        return;
      }
      
      setAdminUserIds(data?.map(r => r.user_id) || []);
    };
    
    fetchAdminRoles();
  }, []);

  // Fetch member transactions when selected member changes
  useEffect(() => {
    const fetchMemberTransactions = async () => {
      if (!selectedMember) {
        setMemberTransactions([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select('id, user_id, type, amount, date, status, created_at, notes, account_holder_name')
        .eq('user_id', selectedMember.id)
        .eq('status', 'approved')
        .order('date', { ascending: false });
      
      if (error) {
        console.error('Error fetching member transactions:', error);
        return;
      }
      
      setMemberTransactions(data || []);
    };
    
    fetchMemberTransactions();
  }, [selectedMember]);

  // Calculate existing corrections for selected transaction
  useEffect(() => {
    if (!correctionFormData.selectedTransaction || correctionFormData.correctionMode !== 'transaction_based') {
      setExistingCorrectionsForTx(0);
      return;
    }
    
    // Sum all existing 'subtract' corrections for this transaction
    const existingSubtractTotal = corrections
      .filter(c => 
        c.transaction_id === correctionFormData.selectedTransaction && 
        c.operation === 'subtract' &&
        c.status === 'applied'
      )
      .reduce((sum, c) => sum + c.amount, 0);
    
    setExistingCorrectionsForTx(existingSubtractTotal);
  }, [correctionFormData.selectedTransaction, correctionFormData.correctionMode, corrections]);

  const refreshAdminRoles = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    setAdminUserIds(data?.map(r => r.user_id) || []);
  };

  const isAdmin = (userId: string) => adminUserIds.includes(userId);

  // Dynamic terminology for branch
  const branchTerm = branchTerminology === 'unit' ? 'Unit' : 'Cabang';

  // Only show active members with search and branch filter
  const filteredMembers = members.filter(m => {
    const matchesSearch = m.role === 'member' && m.isActive && (
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.memberNumber.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
    );
    
    // Apply branch filter
    if (selectedBranchFilter === 'all') {
      return matchesSearch;
    } else if (selectedBranchFilter === 'none') {
      return matchesSearch && !m.branchId;
    } else {
      return matchesSearch && m.branchId === selectedBranchFilter;
    }
  });

  const getMemberSavings = (userId: string): SavingsSummary => {
    // Use database records if available
    const dbRecord = savingsSummaryDB.find(s => s.user_id === userId);
    if (dbRecord) {
      return {
        simpananPokok: dbRecord.simpanan_pokok,
        simpananWajib: dbRecord.simpanan_wajib,
        simpananSukarela: dbRecord.simpanan_sukarela,
        totalSimpanan: dbRecord.total_simpanan,
      };
    }
    // Default to empty savings
    return {
      simpananPokok: 0,
      simpananWajib: 0,
      simpananSukarela: 0,
      totalSimpanan: 0,
    };
  };

  const getMemberLoans = (userId: string): Loan[] => {
    // Use database records
    return loansDB.filter(l => l.userId === userId);
  };

  const getMemberSHU = (userId: string): SHURecord[] => {
    // Use database records, convert to SHURecord format
    const dbRecords = shuRecordsDB.filter(s => s.user_id === userId);
    return dbRecords.map(r => ({
      id: r.id,
      userId: r.user_id,
      year: r.year,
      amount: r.amount,
      distributedAt: r.distributed_at,
      notes: r.notes || undefined,
    }));
  };

  const getMemberCorrections = (userId: string): CorrectionFromDB[] => {
    return corrections.filter(c => c.user_id === userId);
  };

  // Get installments for a specific member's active loans
  const getMemberInstallments = (userId: string) => {
    const memberLoans = loansDB.filter(l => l.userId === userId && (l.status === 'active' || l.status === 'pending'));
    const loanIds = memberLoans.map(l => l.id);
    return installmentsDB.filter(i => loanIds.includes(i.loan_id));
  };

  // Get selected installment details
  const getSelectedInstallmentDetails = () => {
    if (!correctionFormData.selectedInstallment || !selectedMember) return null;
    const installment = installmentsDB.find(i => i.id === correctionFormData.selectedInstallment);
    if (!installment) return null;
    
    const loan = loansDB.find(l => l.id === installment.loan_id);
    return { installment, loan };
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !correctionFormData.correctionType || !correctionFormData.amount || !correctionFormData.reason) {
      toast.error('Semua field wajib diisi');
      return;
    }

    // Validate installment selection for angsuran_pinjaman
    if (correctionFormData.correctionType === 'angsuran_pinjaman' && !correctionFormData.selectedInstallment) {
      toast.error('Pilih angsuran yang akan dikoreksi');
      return;
    }

    // Validate transaction-based correction doesn't exceed original transaction value
    if (correctionFormData.correctionMode === 'transaction_based' && 
        correctionFormData.selectedTransaction && 
        correctionFormData.operation === 'subtract') {
      const selectedTx = memberTransactions.find(t => t.id === correctionFormData.selectedTransaction);
      if (selectedTx) {
        const maxAllowedCorrection = selectedTx.amount - existingCorrectionsForTx;
        if (correctionFormData.amount > maxAllowedCorrection) {
          toast.error(`Koreksi pengurangan tidak boleh melebihi ${formatCurrency(maxAllowedCorrection)}. Transaksi asli: ${formatCurrency(selectedTx.amount)}, sudah dikoreksi: ${formatCurrency(existingCorrectionsForTx)}`);
          return;
        }
      }
    }

    // Get current balance based on correction type
    const savings = getMemberSavings(selectedMember.id);
    let currentBalance = 0;
    let installmentNumber: number | null = null;
    
    switch (correctionFormData.correctionType) {
      case 'simpanan_pokok':
        currentBalance = savings.simpananPokok;
        break;
      case 'simpanan_wajib':
        currentBalance = savings.simpananWajib;
        break;
      case 'simpanan_sukarela':
        currentBalance = savings.simpananSukarela;
        break;
      case 'angsuran_pinjaman':
        // For installments, get the specific installment paid_amount
        const selectedInst = installmentsDB.find(i => i.id === correctionFormData.selectedInstallment);
        if (selectedInst) {
          currentBalance = selectedInst.paid_amount;
          installmentNumber = selectedInst.installment_number;
        }
        break;
    }

    const newBalance = correctionFormData.operation === 'add' 
      ? currentBalance + correctionFormData.amount 
      : currentBalance - correctionFormData.amount;

    // Save correction to database
    const { data, error } = await supabase
      .from('corrections')
      .insert({
        user_id: selectedMember.id,
        correction_type: correctionFormData.correctionType,
        operation: correctionFormData.operation,
        amount: correctionFormData.amount,
        current_balance: currentBalance,
        new_balance: newBalance,
        reason: correctionFormData.reason,
        footnote: correctionFormData.footnote || `Koreksi oleh Admin pada ${formatDate(new Date().toISOString())}`,
        installment_id: correctionFormData.correctionType === 'angsuran_pinjaman' ? correctionFormData.selectedInstallment : null,
        installment_number: installmentNumber,
        created_by: authUser?.id || null,
        status: 'applied',
        correction_mode: correctionFormData.correctionMode,
        transaction_id: correctionFormData.correctionMode === 'transaction_based' && correctionFormData.selectedTransaction ? correctionFormData.selectedTransaction : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving correction:', error);
      toast.error('Gagal menyimpan koreksi');
      return;
    }

    // CRITICAL: Update savings_summary to reflect the actual balance change
    if (['simpanan_pokok', 'simpanan_wajib', 'simpanan_sukarela'].includes(correctionFormData.correctionType)) {
      const updateData: Record<string, number> = {};
      
      switch (correctionFormData.correctionType) {
        case 'simpanan_pokok':
          updateData.simpanan_pokok = newBalance;
          break;
        case 'simpanan_wajib':
          updateData.simpanan_wajib = newBalance;
          break;
        case 'simpanan_sukarela':
          updateData.simpanan_sukarela = newBalance;
          break;
      }
      
      // Calculate new total
      const currentSavings = getMemberSavings(selectedMember.id);
      const newTotal = 
        (correctionFormData.correctionType === 'simpanan_pokok' ? newBalance : currentSavings.simpananPokok) +
        (correctionFormData.correctionType === 'simpanan_wajib' ? newBalance : currentSavings.simpananWajib) +
        (correctionFormData.correctionType === 'simpanan_sukarela' ? newBalance : currentSavings.simpananSukarela);
      
      updateData.total_simpanan = newTotal;
      
      const { error: savingsError } = await supabase
        .from('savings_summary')
        .update(updateData)
        .eq('user_id', selectedMember.id);
      
      if (savingsError) {
        console.error('Error updating savings_summary:', savingsError);
        toast.error('Koreksi tersimpan tapi gagal memperbarui saldo. Harap refresh halaman.');
      } else {
        // Update local state for savings_summary
        setSavingsSummaryDB(prev => prev.map(s => 
          s.user_id === selectedMember.id 
            ? { ...s, ...updateData }
            : s
        ));
      }
    }

    // Create journal entry for the correction
    try {
      const journalId = await createCorrectionJournal({
        correctionType: correctionFormData.correctionType as CorrectionType,
        operation: correctionFormData.operation,
        amount: correctionFormData.amount,
        memberId: selectedMember.id,
        memberName: selectedMember.name,
        correctionId: data.id,
        reason: correctionFormData.reason,
      });
      
      if (journalId) {
        // Update correction with journal_entry_id
        await supabase
          .from('corrections')
          .update({ journal_entry_id: journalId })
          .eq('id', data.id);
          
        data.journal_entry_id = journalId;
      }
    } catch (journalError) {
      console.error('Error creating journal for correction:', journalError);
      // Continue even if journal creation fails
    }

    setCorrections(prev => [data as CorrectionFromDB, ...prev]);
    const operationText = correctionFormData.operation === 'add' ? 'Penambahan' : 'Pengurangan';
    toast.success(`${operationText} ${correctionTypeLabels[correctionFormData.correctionType as CorrectionType]} sebesar ${formatCurrency(correctionFormData.amount)} berhasil diterapkan.`);
    setShowCorrectionDialog(false);
    setCorrectionFormData({
      correctionType: '',
      operation: 'add',
      amount: 0,
      selectedInstallment: '',
      reason: '',
      footnote: '',
      correctionMode: 'nominal',
      selectedTransaction: '',
    });
  };

  const handleSHUSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !shuFormData.amount) {
      toast.error('Nominal SHU harus diisi');
      return;
    }

    // Check if SHU for this year already exists
    const existingSHU = shuRecordsDB.find(
      s => s.user_id === selectedMember.id && s.year === shuFormData.year
    );

    if (existingSHU) {
      toast.error(`SHU tahun ${shuFormData.year} untuk anggota ini sudah ada`);
      return;
    }

    setIsSavingSHU(true);
    try {
      const { data, error } = await supabase
        .from('shu_records')
        .insert({
          user_id: selectedMember.id,
          year: shuFormData.year,
          amount: shuFormData.amount,
          distributed_at: new Date().toISOString(),
          notes: `Input manual oleh admin pada ${formatDate(new Date().toISOString())}`,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving SHU:', error);
        toast.error('Gagal menyimpan SHU: ' + error.message);
        return;
      }

      // Create journal entry for manual SHU payment
      const journalResult = await createManualSHUJournal(
        selectedMember.id,
        selectedMember.name,
        shuFormData.year,
        shuFormData.amount,
        'bank' // Default to bank payment
      );

      if (journalResult.success) {
        // Update SHU record with journal reference
        await supabase
          .from('shu_records')
          .update({ 
            notes: `Input manual oleh admin pada ${formatDate(new Date().toISOString())} - Jurnal: ${journalResult.journalNumber}` 
          })
          .eq('id', data.id);
        
        toast.success(`SHU tahun ${shuFormData.year} untuk ${selectedMember.name} berhasil disimpan dan tercatat di jurnal (${journalResult.journalNumber})`);
      } else {
        console.warn('Journal creation failed:', journalResult.error);
        toast.success(`SHU tahun ${shuFormData.year} untuk ${selectedMember.name} berhasil disimpan`);
        toast.warning(`Jurnal tidak dibuat: ${journalResult.error}`);
      }

      // Update local state
      setShuRecordsDB(prev => [data, ...prev]);
      setShowSHUDialog(false);
      setShuFormData({ year: new Date().getFullYear(), amount: 0 });
    } catch (err) {
      console.error('Error saving SHU:', err);
      toast.error('Gagal menyimpan SHU');
    } finally {
      setIsSavingSHU(false);
    }
  };

  const handleDeactivateMemberDB = async () => {
    if (!memberToDeactivate) return;
    
    setIsDeactivating(true);
    try {
      const exitDate = new Date().toISOString().split('T')[0];
      const exitYear = new Date().getFullYear();

      const { error } = await supabase
        .from('profiles')
        .update({
          is_active: false,
          exit_date: exitDate,
          exit_year: exitYear,
        })
        .eq('user_id', memberToDeactivate.id);

      if (error) {
        console.error('Error deactivating member:', error);
        toast.error('Gagal menonaktifkan anggota: ' + error.message);
        return;
      }

      // Call the parent callback if provided
      onDeactivateMember?.(memberToDeactivate.id);
      toast.success(`${memberToDeactivate.name} berhasil dinonaktifkan`);
      setShowDeactivateDialog(false);
      setMemberToDeactivate(null);
      setSelectedMember(null);
    } catch (err) {
      console.error('Error deactivating member:', err);
      toast.error('Gagal menonaktifkan anggota');
    } finally {
      setIsDeactivating(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  const handleResetPassword = async () => {
    if (!memberToResetPassword || !newPassword) {
      toast.error('Password baru harus diisi');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    
    setIsResettingPassword(true);
    try {
      // Call the edge function through the parent callback
      if (onResetPassword) {
        await onResetPassword(memberToResetPassword.id, newPassword);
      }
      setShowResetPasswordDialog(false);
      setMemberToResetPassword(null);
      setNewPassword('');
      setCopiedPassword(false);
    } catch (error) {
      console.error('Reset password error:', error);
      toast.error('Gagal reset password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(newPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const exportMemberToPDF = (member: User) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Data Anggota Koperasi', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dicetak: ${formatDate(new Date().toISOString())}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    
    // Profile Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Informasi Profil', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const profileData = [
      ['Nama Lengkap', member.name],
      ['No. Anggota', member.memberNumber],
      ['NIK', member.nik || '-'],
      ['Email', member.email],
      ['Telepon', member.phone || '-'],
      ['Alamat', member.address || '-'],
      ['Rekening BCA', member.bankAccountNumber ? `${member.bankAccountNumber}${member.bankAccountName ? ` (a.n. ${member.bankAccountName})` : ''}` : '-'],
      ['Tanggal Bergabung', formatDate(member.joinDate)],
      ['Status', member.isActive ? 'Aktif' : 'Tidak Aktif'],
    ];
    
    (doc as any).autoTable({
      startY: yPos,
      head: [],
      body: profileData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 120 }
      },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // Savings Section
    const savings = getMemberSavings(member.id);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Simpanan', 14, yPos);
    yPos += 8;
    
    const savingsData = [
      ['Simpanan Pokok', formatCurrency(savings.simpananPokok)],
      ['Simpanan Wajib', formatCurrency(savings.simpananWajib)],
      ['Simpanan Sukarela', formatCurrency(savings.simpananSukarela)],
      ['Total Simpanan', formatCurrency(savings.totalSimpanan)],
    ];
    
    (doc as any).autoTable({
      startY: yPos,
      head: [],
      body: savingsData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 120 }
      },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // Loans Section
    const memberLoans = getMemberLoans(member.id);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Pinjaman', 14, yPos);
    yPos += 8;
    
    if (memberLoans.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Tidak ada riwayat pinjaman', 14, yPos);
      yPos += 10;
    } else {
      const loanTableData = memberLoans.map(loan => [
        formatDate(loan.disbursementDate),
        formatCurrency(loan.principalAmount),
        `${loan.tenor} bulan`,
        `${loan.interestRate}%`,
        loan.status === 'active' ? formatCurrency(loan.remainingPrincipal) : '-',
        loan.status === 'active' ? 'Aktif' : 'Lunas'
      ]);
      
      (doc as any).autoTable({
        startY: yPos,
        head: [['Tanggal', 'Pokok', 'Tenor', 'Bunga', 'Sisa', 'Status']],
        body: loanTableData,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Check if need new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    // SHU Section
    const shuRecords = getMemberSHU(member.id);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Riwayat SHU', 14, yPos);
    yPos += 8;
    
    if (shuRecords.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Belum ada riwayat SHU', 14, yPos);
      yPos += 10;
    } else {
      const shuTableData = shuRecords.map(shu => [
        `Tahun ${shu.year}`,
        formatDate(shu.distributedAt),
        formatCurrency(shu.amount)
      ]);
      
      (doc as any).autoTable({
        startY: yPos,
        head: [['Periode', 'Dibagikan', 'Jumlah']],
        body: shuTableData,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94], textColor: 255 },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Check if need new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    // Corrections Section
    const memberCorrections = getMemberCorrections(member.id);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Riwayat Koreksi', 14, yPos);
    yPos += 8;
    
    if (memberCorrections.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Belum ada riwayat koreksi', 14, yPos);
    } else {
      const correctionTableData = memberCorrections.map(correction => [
        formatDate(correction.created_at),
        correctionTypeLabels[correction.correction_type],
        correction.operation === 'add' ? 'Penambahan' : 'Pengurangan',
        formatCurrency(correction.amount),
        correctionStatusLabels[correction.status].label
      ]);
      
      (doc as any).autoTable({
        startY: yPos,
        head: [['Tanggal', 'Jenis', 'Operasi', 'Nominal', 'Status']],
        body: correctionTableData,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [245, 158, 11], textColor: 255 },
      });
    }
    
    // Save the PDF
    const fileName = `Data_Anggota_${member.memberNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${formatDate(new Date().toISOString()).replace(/\s/g, '_')}.pdf`;
    doc.save(fileName);
    toast.success('Data anggota berhasil diexport ke PDF');
  };

  return (
    <>
      <Card>
        <CardHeader className="p-3 sm:p-4 md:p-6">
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base sm:text-lg">Data Anggota</CardTitle>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                {filteredMembers.length} anggota terdaftar
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center">
              <SearchInput
                placeholder="Cari anggota..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                containerClassName="w-full sm:w-56 md:w-64"
              />
              {branchFeatureEnabled && activeBranches.length > 0 && (
                <Select value={selectedBranchFilter} onValueChange={setSelectedBranchFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder={`Filter ${branchTerm}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua {branchTerm}</SelectItem>
                    <SelectItem value="none">Tanpa {branchTerm}</SelectItem>
                    {activeBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: branch.badge_color }}
                          />
                          {branch.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {onAddNewMember && (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={onAddNewMember}
                    className="text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3"
                  >
                    <UserPlus className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Tambah Anggota</span>
                    <span className="sm:hidden">Tambah</span>
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onViewInactiveMembers}
                  className="text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3"
                >
                  <UserMinus className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Anggota Keluar</span>
                  <span className="sm:hidden">Keluar</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isMobile && onRefresh ? (
            <PullToRefresh onRefresh={onRefresh} className="max-h-[60vh]">
              <div className="divide-y divide-border">
                {filteredMembers.map((member) => {
                  const savings = getMemberSavings(member.id);
                  const memberLoans = getMemberLoans(member.id);
                  const hasActiveLoan = memberLoans.some(l => l.status === 'active');

                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className="flex w-full items-center gap-3 p-3 sm:p-4 text-left transition-colors hover:bg-muted/50"
                    >
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                        {member.profilePhoto ? (
                          <AvatarImage src={member.profilePhoto} alt={member.name} className="object-cover" />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs sm:text-sm">
                          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <p className="font-medium text-sm sm:text-base text-foreground truncate max-w-[140px] sm:max-w-none">{member.name}</p>
                          {member.isActive ? (
                            <Badge variant="success" className="text-[10px] sm:text-xs px-1.5 sm:px-2 h-4 sm:h-5">Aktif</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 sm:px-2 h-4 sm:h-5">Nonaktif</Badge>
                          )}
                          {isAdmin(member.id) && (
                            <Badge variant="outline" className="text-primary border-primary text-[10px] sm:text-xs px-1.5 sm:px-2 h-4 sm:h-5">
                              <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">{member.memberNumber}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">
                          📍 {member.address || 'Alamat belum diisi'}
                        </p>
                        <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            {formatCurrency(savings.totalSimpanan)}
                          </span>
                          {hasActiveLoan && (
                            <span className="flex items-center gap-1 text-warning">
                              <CreditCard className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              Pinjaman
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
                
                {/* Infinite scroll loader */}
                <InfiniteScrollLoader
                  isFetching={isFetchingMore}
                  hasMore={hasMore}
                  onLoadMore={onLoadMore}
                />
              </div>
            </PullToRefresh>
          ) : (
            <div className="divide-y divide-border">
              {filteredMembers.map((member) => {
                const savings = getMemberSavings(member.id);
                const memberLoans = getMemberLoans(member.id);
                const hasActiveLoan = memberLoans.some(l => l.status === 'active');

                return (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className="flex w-full items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left transition-colors hover:bg-muted/50"
                  >
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                      {member.profilePhoto ? (
                        <AvatarImage src={member.profilePhoto} alt={member.name} className="object-cover" />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs sm:text-sm">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <p className="font-medium text-sm sm:text-base text-foreground truncate">{member.name}</p>
                        {member.isActive ? (
                          <Badge variant="success" className="text-[10px] sm:text-xs px-1.5 sm:px-2 h-4 sm:h-5">Aktif</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 sm:px-2 h-4 sm:h-5">Nonaktif</Badge>
                        )}
                        {isAdmin(member.id) && (
                          <Badge variant="outline" className="text-primary border-primary text-[10px] sm:text-xs px-1.5 sm:px-2 h-4 sm:h-5">
                            <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                            Admin
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground">{member.memberNumber}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">
                        📍 {member.address || 'Alamat belum diisi'}
                      </p>
                      <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          {formatCurrency(savings.totalSimpanan)}
                        </span>
                        {hasActiveLoan && (
                          <span className="flex items-center gap-1 text-warning">
                            <CreditCard className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            Pinjaman
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
              
              {/* Infinite scroll loader */}
              <InfiniteScrollLoader
                isFetching={isFetchingMore}
                hasMore={hasMore}
                onLoadMore={onLoadMore}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Detail Dialog */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-8">
            <DialogTitle>Detail Anggota</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <>
              {/* Export Button - Moved below header with proper spacing */}
              <div className="flex justify-end -mt-2 mb-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportMemberToPDF(selectedMember)}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            <TabNavigation
              tabs={[
                { value: 'info', icon: ProfileIcon, label: 'Profil' },
                { value: 'savings', icon: WalletIcon, label: 'Simpanan' },
                { value: 'loans', icon: LoanIcon, label: 'Pinjaman' },
                { value: 'shu', icon: ShuIcon, label: 'SHU' },
                { value: 'correction', icon: CorrectionIcon, label: 'Koreksi' },
              ]}
              activeTab={detailTab}
              onTabChange={(value) => setDetailTab(value as typeof detailTab)}
            />

            {detailTab === 'info' && (
              <div className="mt-4 space-y-6 animate-fade-in">
                {/* Member Header Card */}
                <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 border">
                  <div className="flex flex-col sm:flex-row gap-5">
                    {/* Profile Photo Section */}
                    <button
                      type="button"
                      onClick={() => selectedMember.profilePhoto && setShowPhotoDialog(true)}
                      className={`relative group ${selectedMember.profilePhoto ? 'cursor-pointer' : 'cursor-default'} shrink-0 self-center sm:self-start`}
                    >
                      <Avatar className="h-20 w-20 ring-4 ring-background shadow-lg transition-transform group-hover:scale-105">
                        {selectedMember.profilePhoto ? (
                          <AvatarImage src={selectedMember.profilePhoto} alt={selectedMember.name} className="object-cover" />
                        ) : null}
                        <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                          {selectedMember.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {selectedMember.profilePhoto && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <Eye className="h-6 w-6 text-white" />
                        </div>
                      )}
                    </button>
                    
                    {/* Name & Status Section */}
                    <div className="flex-1 text-center sm:text-left">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                        <h3 className="text-xl font-bold text-foreground">{selectedMember.name}</h3>
                        {isAdmin(selectedMember.id) && (
                          <Badge className="bg-primary/20 text-primary border-primary/30">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                        {selectedMember.isActive ? (
                          <Badge variant="success">Aktif</Badge>
                        ) : (
                          <Badge variant="destructive">Tidak Aktif</Badge>
                        )}
                        {branchFeatureEnabled && selectedMember.branchId && getBranchById(selectedMember.branchId) && (
                          <Badge 
                            style={{ backgroundColor: getBranchById(selectedMember.branchId)?.badge_color }}
                            className="text-white text-xs"
                          >
                            {getBranchById(selectedMember.branchId)?.name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground font-mono text-sm">{selectedMember.memberNumber}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Bergabung sejak {formatDate(selectedMember.joinDate)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Separate Section */}
                {selectedMember.isActive && (
                  <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg border border-dashed">
                    <p className="w-full text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Aksi Cepat</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-9"
                      onClick={() => setShowEditDialog(true)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Data
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-9"
                      onClick={() => setShowRegenerateNumberDialog(true)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate No.
                    </Button>
                    {!isAdmin(selectedMember.id) ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-9"
                        onClick={() => {
                          setMemberToMakeAdmin(selectedMember);
                          setShowMakeAdminDialog(true);
                        }}
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        Jadikan Admin
                      </Button>
                    ) : (
                      currentUserId !== selectedMember.id && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-9 text-destructive border-destructive/50 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => {
                            setMemberToRemoveAdmin(selectedMember);
                            setShowRemoveAdminDialog(true);
                          }}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Hapus Role Admin
                        </Button>
                      )
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        setMemberToResetPassword(selectedMember);
                        generatePassword();
                        setShowResetPasswordDialog(true);
                      }}
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Reset Password
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-9 text-destructive border-destructive/50 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => {
                        setMemberToDeactivate(selectedMember);
                        setShowDeactivateDialog(true);
                      }}
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Non-aktifkan
                    </Button>
                  </div>
                )}

                {/* Information Grid */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    Informasi Pribadi
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-lg border p-3 bg-card">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <IdCard className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">NIK</p>
                        <p className="font-medium text-sm truncate">{selectedMember.nik || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border p-3 bg-card">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium text-sm truncate">{selectedMember.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border p-3 bg-card">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">Telepon</p>
                        <p className="font-medium text-sm truncate">{selectedMember.phone || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border p-3 bg-card">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">Rekening BCA</p>
                        <p className="font-medium text-sm truncate">{selectedMember.bankAccountNumber || '-'}</p>
                        {selectedMember.bankAccountName && (
                          <p className="text-xs text-muted-foreground truncate">a.n. {selectedMember.bankAccountName}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border p-3 bg-card sm:col-span-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <UserIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">Alamat Domisili</p>
                        <p className="font-medium text-sm">{selectedMember.address || '-'}</p>
                      </div>
                    </div>
                    {branchFeatureEnabled && selectedMember.branchId && getBranchById(selectedMember.branchId) && (
                      <div className="flex items-center gap-3 rounded-lg border p-3 bg-card">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            {branchTerminology === 'unit' ? 'Unit' : 'Cabang'}
                          </p>
                          <Badge 
                            style={{ backgroundColor: getBranchById(selectedMember.branchId)?.badge_color }}
                            className="text-white text-xs"
                          >
                            {getBranchById(selectedMember.branchId)?.name}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'savings' && (
              <div className="mt-4 space-y-5 animate-fade-in">
                {(() => {
                  const savings = getMemberSavings(selectedMember.id);
                  return (
                    <>
                      {/* Total Simpanan Header */}
                      <div className="rounded-xl gradient-primary p-5 text-primary-foreground shadow-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                            <Wallet className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm opacity-90">Total Simpanan</p>
                            <p className="text-2xl font-bold">{formatCurrency(savings.totalSimpanan)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Savings Breakdown */}
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Banknote className="h-4 w-4 text-muted-foreground" />
                          Rincian Simpanan
                        </h4>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="flex items-center gap-3 rounded-lg border p-4 bg-card">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 shrink-0">
                              <Wallet className="h-5 w-5 text-blue-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-muted-foreground">Simpanan Pokok</p>
                              <p className="text-lg font-bold">{formatCurrency(savings.simpananPokok)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 rounded-lg border p-4 bg-card">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 shrink-0">
                              <Wallet className="h-5 w-5 text-green-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-muted-foreground">Simpanan Wajib</p>
                              <p className="text-lg font-bold">{formatCurrency(savings.simpananWajib)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 rounded-lg border p-4 bg-card">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10 shrink-0">
                              <Wallet className="h-5 w-5 text-purple-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-muted-foreground">Simpanan Sukarela</p>
                              <p className="text-lg font-bold">{formatCurrency(savings.simpananSukarela)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {detailTab === 'loans' && (
              <div className="mt-4 space-y-5 animate-fade-in">
                {(() => {
                  const memberLoans = getMemberLoans(selectedMember.id);
                  const activeLoan = memberLoans.find(l => l.status === 'active');
                  const completedLoans = memberLoans.filter(l => l.status !== 'active');

                  if (memberLoans.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                          <CreditCard className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-sm text-muted-foreground">Tidak ada riwayat pinjaman</p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Active Loan Summary */}
                      {activeLoan && (
                        <div className="rounded-xl bg-gradient-to-br from-warning/20 via-warning/10 to-transparent p-5 border border-warning/30 shadow-sm">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/20">
                              <CreditCard className="h-6 w-6 text-warning" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Pinjaman Aktif</p>
                              <p className="text-2xl font-bold text-foreground">{formatCurrency(activeLoan.remainingPrincipal)}</p>
                              <p className="text-xs text-muted-foreground">sisa dari {formatCurrency(activeLoan.principalAmount)}</p>
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="flex items-center gap-2 rounded-lg bg-background/80 p-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Tenor</p>
                                <p className="font-semibold text-sm">{activeLoan.tenor} bulan</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg bg-background/80 p-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                                <Banknote className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Bunga</p>
                                <p className="font-semibold text-sm">{activeLoan.interestRate}%</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg bg-background/80 p-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Mulai</p>
                                <p className="font-semibold text-sm">{formatDate(activeLoan.disbursementDate)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Completed Loans List */}
                      {completedLoans.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            Riwayat Pinjaman Lunas
                          </h4>
                          <div className="space-y-3">
                            {completedLoans.map((loan) => (
                              <div key={loan.id} className="flex items-center gap-3 rounded-lg border p-4 bg-card">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 shrink-0">
                                  <Check className="h-5 w-5 text-success" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium truncate">Pinjaman {formatDate(loan.disbursementDate)}</p>
                                    <Badge variant="success">Lunas</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{formatCurrency(loan.principalAmount)} • {loan.tenor} bulan</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* If no active loan but has completed loans, show summary */}
                      {!activeLoan && completedLoans.length > 0 && (
                        <div className="rounded-xl bg-success/10 p-4 border border-success/30">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
                              <Check className="h-5 w-5 text-success" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-success">Tidak ada pinjaman aktif</p>
                              <p className="text-xs text-muted-foreground">Semua pinjaman telah lunas</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {detailTab === 'shu' && (
              <div className="mt-4 space-y-5 animate-fade-in">
                {(() => {
                  const shuRecords = getMemberSHU(selectedMember.id);
                  const totalSHU = shuRecords.reduce((sum, shu) => sum + shu.amount, 0);
                  
                  return (
                    <>
                      {/* SHU Summary Header */}
                      <div className="rounded-xl bg-gradient-to-br from-success/20 via-success/10 to-transparent p-5 border border-success/30 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
                              <Banknote className="h-6 w-6 text-success" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Total SHU Diterima</p>
                              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalSHU)}</p>
                              <p className="text-xs text-muted-foreground">{shuRecords.length} kali pembagian</p>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => setShowSHUDialog(true)}>
                            <Plus className="mr-1 h-4 w-4" />
                            Input SHU
                          </Button>
                        </div>
                      </div>
                      
                      {/* SHU Records List */}
                      {shuRecords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                            <Banknote className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <p className="mt-4 text-sm text-muted-foreground">Belum ada riwayat SHU</p>
                        </div>
                      ) : (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-muted-foreground" />
                            Riwayat Pembagian SHU
                          </h4>
                          <div className="space-y-3">
                            {shuRecords.map((shu) => (
                              <div key={shu.id} className="flex items-center gap-3 rounded-lg border p-4 bg-card">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 shrink-0">
                                  <Banknote className="h-5 w-5 text-success" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium">SHU Tahun {shu.year}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Dibagikan: {formatDate(shu.distributedAt)}
                                  </p>
                                </div>
                                <p className="text-lg font-bold text-success">{formatCurrency(shu.amount)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {detailTab === 'correction' && (
              <div className="mt-4 space-y-5 animate-fade-in">
                {(() => {
                  const memberCorrections = getMemberCorrections(selectedMember.id);
                  const addCorrections = memberCorrections.filter(c => c.operation === 'add');
                  const subtractCorrections = memberCorrections.filter(c => c.operation === 'subtract');
                  
                  return (
                    <>
                      {/* Correction Header with Action */}
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <PenLine className="h-4 w-4 text-muted-foreground" />
                          Riwayat Koreksi
                        </h4>
                        <Button size="sm" onClick={() => setShowCorrectionDialog(true)}>
                          <PenLine className="mr-1 h-4 w-4" />
                          Buat Koreksi
                        </Button>
                      </div>

                      {/* Warning Banner */}
                      <div className="rounded-xl border border-warning/50 bg-warning/10 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20 shrink-0">
                            <AlertTriangle className="h-5 w-5 text-warning" />
                          </div>
                          <div className="text-sm">
                            <p className="font-semibold text-warning">Perhatian</p>
                            <p className="text-muted-foreground">Koreksi akan langsung mengubah saldo anggota. Anggota dapat melaporkan jika koreksi tidak sesuai.</p>
                          </div>
                        </div>
                      </div>

                      {/* Stats Summary */}
                      {memberCorrections.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex items-center gap-3 rounded-lg border p-4 bg-card">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 shrink-0">
                              <Plus className="h-5 w-5 text-success" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-muted-foreground">Total Penambahan</p>
                              <p className="text-lg font-bold text-success">
                                +{formatCurrency(addCorrections.reduce((sum, c) => sum + c.amount, 0))}
                              </p>
                              <p className="text-xs text-muted-foreground">{addCorrections.length} koreksi</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 rounded-lg border p-4 bg-card">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
                              <Minus className="h-5 w-5 text-destructive" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-muted-foreground">Total Pengurangan</p>
                              <p className="text-lg font-bold text-destructive">
                                -{formatCurrency(subtractCorrections.reduce((sum, c) => sum + c.amount, 0))}
                              </p>
                              <p className="text-xs text-muted-foreground">{subtractCorrections.length} koreksi</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Corrections List */}
                      {memberCorrections.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                            <PenLine className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <p className="mt-4 text-sm text-muted-foreground">Belum ada riwayat koreksi</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {memberCorrections.map((correction) => {
                            const difference = correction.operation === 'add' ? correction.amount : -correction.amount;
                            return (
                              <div key={correction.id} className="rounded-xl border p-4 space-y-4 bg-card">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-3">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${correction.operation === 'add' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                                      {correction.operation === 'add' ? (
                                        <Plus className="h-5 w-5 text-success" />
                                      ) : (
                                        <Minus className="h-5 w-5 text-destructive" />
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium">
                                          {correctionTypeLabels[correction.correction_type]}
                                          {correction.installment_number && ` #${correction.installment_number}`}
                                        </p>
                                        <Badge variant={correctionStatusLabels[correction.status].variant}>
                                          {correctionStatusLabels[correction.status].label}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        {formatDate(correction.created_at)}
                                      </p>
                                    </div>
                                  </div>
                                  <p className={`text-lg font-bold ${difference >= 0 ? 'text-success' : 'text-destructive'}`}>
                                    {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                                  </p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                                      <Wallet className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Saldo Sebelum</p>
                                      <p className="font-semibold">{formatCurrency(correction.current_balance)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                                      <Wallet className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Saldo Sesudah</p>
                                      <p className="font-semibold">{formatCurrency(correction.new_balance)}</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-lg bg-muted/30 p-3 text-sm">
                                  <p className="text-xs text-muted-foreground mb-1">Alasan Koreksi</p>
                                  <p className="text-foreground">{correction.reason}</p>
                                </div>

                                {correction.footnote && (
                                  <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm border-l-3 border-primary">
                                    <ArrowUpDown className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <p className="text-muted-foreground italic">{correction.footnote}</p>
                                  </div>
                                )}

                                {correction.status === 'reported' && correction.report_reason && (
                                  <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm border-l-3 border-warning">
                                    <Flag className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                                    <div>
                                      <p className="font-medium text-warning">Laporan Anggota</p>
                                      <p className="text-muted-foreground">{correction.report_reason}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* SHU Input Dialog */}
      <Dialog open={showSHUDialog} onOpenChange={setShowSHUDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Input SHU Anggota</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSHUSubmit} className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">Anggota</p>
              <p className="font-medium">{selectedMember?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedMember?.memberNumber}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shu-year">Tahun Buku</Label>
              <Input
                id="shu-year"
                type="number"
                min={2020}
                max={new Date().getFullYear()}
                value={shuFormData.year}
                onChange={(e) => setShuFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                disabled={isSavingSHU}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shu-amount">Nominal SHU</Label>
              <CurrencyInput
                id="shu-amount"
                placeholder="Masukkan nominal SHU"
                value={shuFormData.amount}
                onChange={(value) => setShuFormData(prev => ({ ...prev, amount: value }))}
                disabled={isSavingSHU}
              />
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Catatan:</strong> Input SHU manual hanya untuk keperluan khusus. 
                Untuk pembagian SHU reguler, gunakan fitur Distribusi SHU di menu Akuntansi.
              </p>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowSHUDialog(false)}
                disabled={isSavingSHU}
              >
                Batal
              </Button>
              <Button type="submit" className="flex-1" disabled={isSavingSHU}>
                {isSavingSHU ? 'Menyimpan...' : 'Simpan SHU'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Correction Input Dialog */}
      <Dialog open={showCorrectionDialog} onOpenChange={setShowCorrectionDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Koreksi Transaksi</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCorrectionSubmit} className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">Anggota</p>
              <p className="font-medium">{selectedMember?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedMember?.memberNumber}</p>
            </div>

            {/* Mode Selection */}
            <div className="space-y-2">
              <Label>Mode Koreksi</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={correctionFormData.correctionMode === 'nominal' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setCorrectionFormData(prev => ({ ...prev, correctionMode: 'nominal', selectedTransaction: '' }))}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Nominal Langsung
                </Button>
                <Button
                  type="button"
                  variant={correctionFormData.correctionMode === 'transaction_based' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setCorrectionFormData(prev => ({ ...prev, correctionMode: 'transaction_based' }))}
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  Berbasis Transaksi
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {correctionFormData.correctionMode === 'nominal' 
                  ? 'Langsung koreksi saldo tanpa referensi transaksi tertentu'
                  : 'Pilih transaksi yang akan dikoreksi untuk audit trail yang lebih jelas'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-type">Jenis Koreksi</Label>
              <Select
                value={correctionFormData.correctionType}
                onValueChange={(value) => setCorrectionFormData(prev => ({ ...prev, correctionType: value as CorrectionType, selectedInstallment: '', selectedTransaction: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis transaksi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simpanan_pokok">Simpanan Pokok</SelectItem>
                  <SelectItem value="simpanan_wajib">Simpanan Wajib</SelectItem>
                  <SelectItem value="simpanan_sukarela">Simpanan Sukarela</SelectItem>
                  <SelectItem value="angsuran_pinjaman">Angsuran Pinjaman</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transaction selection for transaction_based mode (savings only) */}
            {correctionFormData.correctionMode === 'transaction_based' && 
             correctionFormData.correctionType && 
             correctionFormData.correctionType !== 'angsuran_pinjaman' && 
             selectedMember && (
              <div className="space-y-3">
                <Label>Pilih Transaksi</Label>
                <Select
                  value={correctionFormData.selectedTransaction}
                  onValueChange={(value) => setCorrectionFormData(prev => ({ ...prev, selectedTransaction: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih transaksi yang akan dikoreksi" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {(() => {
                      // Filter transactions by correction type
                      const typeMapping: Record<string, string[]> = {
                        'simpanan_pokok': ['simpanan_pokok'],
                        'simpanan_wajib': ['simpanan_wajib', 'setor_simpanan_wajib'],
                        'simpanan_sukarela': ['simpanan_sukarela', 'setor_simpanan_sukarela', 'penarikan_simpanan_sukarela'],
                      };
                      
                      const allowedTypes = typeMapping[correctionFormData.correctionType] || [];
                      const filteredTransactions = memberTransactions.filter(t => allowedTypes.includes(t.type));
                      
                      if (filteredTransactions.length === 0) {
                        return <SelectItem value="none" disabled>Tidak ada transaksi {correctionTypeLabels[correctionFormData.correctionType as CorrectionType]}</SelectItem>;
                      }
                      
                      const transactionTypeLabels: Record<string, string> = {
                        'simpanan_pokok': 'Simpanan Pokok',
                        'simpanan_wajib': 'Simpanan Wajib',
                        'setor_simpanan_wajib': 'Setor Simpanan Wajib',
                        'simpanan_sukarela': 'Simpanan Sukarela',
                        'setor_simpanan_sukarela': 'Setor Simpanan Sukarela',
                        'penarikan_simpanan_sukarela': 'Penarikan Simpanan Sukarela',
                      };
                      
                      return filteredTransactions.map((tx) => (
                        <SelectItem key={tx.id} value={tx.id} className="py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{transactionTypeLabels[tx.type] || tx.type}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-xs">{formatDate(tx.date)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-success">{formatCurrency(tx.amount)}</span>
                              {tx.notes && <span className="text-muted-foreground truncate max-w-[150px]">{tx.notes}</span>}
                            </div>
                          </div>
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
                
                {correctionFormData.selectedTransaction && (() => {
                  const selectedTx = memberTransactions.find(t => t.id === correctionFormData.selectedTransaction);
                  if (!selectedTx) return null;
                  
                  const transactionTypeLabels: Record<string, string> = {
                    'simpanan_pokok': 'Simpanan Pokok',
                    'simpanan_wajib': 'Simpanan Wajib',
                    'setor_simpanan_wajib': 'Setor Simpanan Wajib',
                    'simpanan_sukarela': 'Simpanan Sukarela',
                    'setor_simpanan_sukarela': 'Setor Simpanan Sukarela',
                    'penarikan_simpanan_sukarela': 'Penarikan Simpanan Sukarela',
                  };
                  
                  return (
                    <div className="rounded-xl border bg-card p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{transactionTypeLabels[selectedTx.type] || selectedTx.type}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(selectedTx.date)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-xs text-muted-foreground">Nominal</p>
                          <p className="font-medium text-success">{formatCurrency(selectedTx.amount)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-xs text-muted-foreground">Nama Akun</p>
                          <p className="font-medium">{selectedTx.account_holder_name || '-'}</p>
                        </div>
                      </div>
                      {selectedTx.notes && (
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">Catatan:</p>
                          <p>{selectedTx.notes}</p>
                        </div>
                      )}
                      
                      {/* Show existing corrections and max allowed */}
                      {existingCorrectionsForTx > 0 && (
                        <div className="rounded-lg border border-warning/50 bg-warning/10 p-2 text-sm">
                          <div className="flex items-center gap-2 text-warning">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="font-medium">Transaksi ini sudah pernah dikoreksi</span>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            <p>Total koreksi pengurangan: {formatCurrency(existingCorrectionsForTx)}</p>
                            <p>Maksimal koreksi pengurangan tersisa: <span className="font-medium text-foreground">{formatCurrency(selectedTx.amount - existingCorrectionsForTx)}</span></p>
                          </div>
                        </div>
                      )}
                      
                      {/* Show max allowed correction info */}
                      <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                        <p>Maksimal koreksi pengurangan: {formatCurrency(selectedTx.amount - existingCorrectionsForTx)}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Show installment selection for angsuran_pinjaman */}
            {correctionFormData.correctionType === 'angsuran_pinjaman' && selectedMember && (
              <div className="space-y-3">
                <Label htmlFor="installment-select">Pilih Angsuran</Label>
                <Select
                  value={correctionFormData.selectedInstallment}
                  onValueChange={(value) => setCorrectionFormData(prev => ({ ...prev, selectedInstallment: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih angsuran yang akan dikoreksi" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {(() => {
                      const memberInstallments = getMemberInstallments(selectedMember.id);
                      if (memberInstallments.length === 0) {
                        return <SelectItem value="none" disabled>Tidak ada pinjaman aktif</SelectItem>;
                      }
                      
                      const statusLabels: Record<string, { label: string; color: string }> = {
                        'pending': { label: 'Belum Jatuh Tempo', color: 'text-muted-foreground' },
                        'unpaid': { label: 'Jatuh Tempo', color: 'text-warning' },
                        'overdue': { label: 'Menunggak', color: 'text-destructive' },
                        'paid': { label: 'Lunas', color: 'text-success' },
                        'partial': { label: 'Sebagian', color: 'text-warning' },
                      };
                      
                      return memberInstallments.map((inst) => {
                        const statusInfo = statusLabels[inst.status] || statusLabels['pending'];
                        const totalDue = inst.total_amount + inst.penalty_amount - inst.paid_amount;
                        return (
                          <SelectItem key={inst.id} value={inst.id} className="py-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">#{inst.installment_number}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-xs">{formatDate(inst.due_date)}</span>
                                <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>Pokok: {formatCurrency(inst.principal_amount)}</span>
                                <span>•</span>
                                <span>Bunga: {formatCurrency(inst.interest_amount)}</span>
                                {inst.penalty_amount > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-destructive">Denda: {formatCurrency(inst.penalty_amount)}</span>
                                  </>
                                )}
                              </div>
                              <div className="text-xs font-medium">
                                Total: {formatCurrency(inst.total_amount + inst.penalty_amount)} 
                                {inst.paid_amount > 0 && <span className="text-success ml-1">(Dibayar: {formatCurrency(inst.paid_amount)})</span>}
                              </div>
                            </div>
                          </SelectItem>
                        );
                      });
                    })()}
                  </SelectContent>
                </Select>

                {/* Show installment details when selected */}
                {correctionFormData.selectedInstallment && (() => {
                  const details = getSelectedInstallmentDetails();
                  if (!details) return null;
                  
                  const { installment, loan } = details;
                  const remaining = installment.total_amount - installment.paid_amount;
                  
                  const statusLabels: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' | 'destructive' }> = {
                    'pending': { label: 'Belum Jatuh Tempo', variant: 'secondary' },
                    'unpaid': { label: 'Jatuh Tempo', variant: 'warning' },
                    'overdue': { label: 'Menunggak', variant: 'destructive' },
                    'paid': { label: 'Lunas', variant: 'success' },
                    'partial': { label: 'Sebagian Dibayar', variant: 'warning' },
                  };
                  const statusInfo = statusLabels[installment.status] || statusLabels['pending'];
                  
                  return (
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <CreditCard className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">Angsuran #{installment.installment_number}</p>
                            <p className="text-xs text-muted-foreground">
                              Jatuh tempo: {formatDate(installment.due_date)}
                            </p>
                          </div>
                        </div>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-xs text-muted-foreground">Pokok</p>
                          <p className="font-medium">{formatCurrency(installment.principal_amount)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-xs text-muted-foreground">Bunga</p>
                          <p className="font-medium">{formatCurrency(installment.interest_amount)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-xs text-muted-foreground">Total Tagihan</p>
                          <p className="font-medium">{formatCurrency(installment.total_amount)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-xs text-muted-foreground">Sudah Dibayar</p>
                          <p className="font-medium text-success">{formatCurrency(installment.paid_amount)}</p>
                        </div>
                      </div>
                      
                      {installment.penalty_amount > 0 && (
                        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <span className="text-destructive">Denda: {formatCurrency(installment.penalty_amount)}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Sisa Tagihan</span>
                        <span className={`font-bold ${remaining > 0 ? 'text-warning' : 'text-success'}`}>
                          {formatCurrency(remaining + installment.penalty_amount)}
                        </span>
                      </div>
                      
                      {loan && (
                        <div className="text-xs text-muted-foreground pt-1 border-t">
                          Pinjaman: {formatCurrency(loan.principalAmount)} • Tenor {loan.tenor} bulan • Bunga {loan.interestRate}%
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Operation toggle - Add or Subtract */}
            <div className="space-y-2">
              <Label>Operasi</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={correctionFormData.operation === 'add' ? 'default' : 'outline'}
                  className={`flex-1 ${correctionFormData.operation === 'add' ? 'bg-success hover:bg-success/90' : ''}`}
                  onClick={() => setCorrectionFormData(prev => ({ ...prev, operation: 'add' }))}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Penambahan
                </Button>
                <Button
                  type="button"
                  variant={correctionFormData.operation === 'subtract' ? 'default' : 'outline'}
                  className={`flex-1 ${correctionFormData.operation === 'subtract' ? 'bg-destructive hover:bg-destructive/90' : ''}`}
                  onClick={() => setCorrectionFormData(prev => ({ ...prev, operation: 'subtract' }))}
                >
                  <Minus className="mr-2 h-4 w-4" />
                  Pengurangan
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-amount">Nominal Koreksi</Label>
              <CurrencyInput
                id="correction-amount"
                placeholder="Masukkan nominal koreksi"
                value={correctionFormData.amount}
                onChange={(value) => setCorrectionFormData(prev => ({ ...prev, amount: value }))}
              />
            </div>

            {correctionFormData.amount > 0 && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="text-sm text-muted-foreground">Perubahan Saldo</p>
                <p className={`text-lg font-bold ${
                  correctionFormData.operation === 'add' 
                    ? 'text-success' 
                    : 'text-destructive'
                }`}>
                  {correctionFormData.operation === 'add' ? '+' : '-'}
                  {formatCurrency(correctionFormData.amount)}
                </p>
              </div>
            )}

            {/* Warning if correction exceeds transaction value */}
            {correctionFormData.correctionMode === 'transaction_based' && 
             correctionFormData.selectedTransaction &&
             correctionFormData.operation === 'subtract' &&
             correctionFormData.amount > 0 && (() => {
              const selectedTx = memberTransactions.find(t => t.id === correctionFormData.selectedTransaction);
              if (!selectedTx) return null;
              
              const maxAllowed = selectedTx.amount - existingCorrectionsForTx;
              const isExceeding = correctionFormData.amount > maxAllowed;
              
              if (isExceeding) {
                return (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Koreksi melebihi batas!</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Maksimal koreksi pengurangan yang diperbolehkan: <span className="font-medium text-foreground">{formatCurrency(maxAllowed)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Transaksi asli: {formatCurrency(selectedTx.amount)} - Sudah dikoreksi: {formatCurrency(existingCorrectionsForTx)}
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            <div className="space-y-2">
              <Label htmlFor="correction-reason">Alasan Koreksi *</Label>
              <Textarea
                id="correction-reason"
                placeholder="Jelaskan alasan dilakukan koreksi..."
                value={correctionFormData.reason}
                onChange={(e) => setCorrectionFormData(prev => ({ ...prev, reason: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-footnote">Catatan/Footnote (opsional)</Label>
              <Input
                id="correction-footnote"
                placeholder="Catatan tambahan yang akan ditampilkan ke anggota"
                value={correctionFormData.footnote}
                onChange={(e) => setCorrectionFormData(prev => ({ ...prev, footnote: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Jika kosong, akan menggunakan catatan default</p>
            </div>

            <div className="rounded-lg border border-warning/50 bg-warning/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Koreksi akan langsung diterapkan dan mengubah saldo anggota. Anggota akan melihat tanda koreksi ini di riwayat transaksinya.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCorrectionDialog(false);
                  setCorrectionFormData({
                    correctionType: '',
                    operation: 'add',
                    amount: 0,
                    selectedInstallment: '',
                    reason: '',
                    footnote: '',
                    correctionMode: 'nominal',
                    selectedTransaction: '',
                  });
                }}
              >
                Batal
              </Button>
              <Button type="submit" className="flex-1">
                <PenLine className="mr-2 h-4 w-4" />
                Terapkan Koreksi
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate Member Dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Non-aktifkan Anggota?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menonaktifkan anggota <strong>{memberToDeactivate?.name}</strong> ({memberToDeactivate?.memberNumber}). 
              Data anggota tidak akan dihapus dan dapat dilihat di menu "Anggota Keluar".
              <br /><br />
              <span className="text-muted-foreground">
                Tanggal keluar akan dicatat: <strong>{formatDate(new Date().toISOString())}</strong>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeactivating}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateMemberDB}
              disabled={isDeactivating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeactivating ? 'Memproses...' : 'Non-aktifkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password Anggota</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">Anggota</p>
              <p className="font-medium">{memberToResetPassword?.name}</p>
              <p className="text-sm text-muted-foreground">{memberToResetPassword?.memberNumber}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Password Baru</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan password baru"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button variant="outline" onClick={generatePassword}>
                  Generate
                </Button>
                <Button variant="outline" size="icon" onClick={copyPassword}>
                  {copiedPassword ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Pastikan Anda menyalin password sebelum menyimpan
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                disabled={isResettingPassword}
                onClick={() => {
                  setShowResetPasswordDialog(false);
                  setMemberToResetPassword(null);
                  setNewPassword('');
                }}
              >
                Batal
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleResetPassword}
                disabled={isResettingPassword || !newPassword}
              >
                {isResettingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Password'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Make Admin Dialog */}
      <AlertDialog open={showMakeAdminDialog} onOpenChange={setShowMakeAdminDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Jadikan Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menjadikan <strong>{memberToMakeAdmin?.name}</strong> sebagai admin?
              Admin memiliki akses penuh untuk mengelola koperasi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToMakeAdmin(null)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (memberToMakeAdmin && onMakeAdmin) {
                  await onMakeAdmin(memberToMakeAdmin.id);
                  await refreshAdminRoles();
                  setShowMakeAdminDialog(false);
                  setMemberToMakeAdmin(null);
                  setSelectedMember(null);
                }
              }}
            >
              Ya, Jadikan Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Admin Dialog */}
      <AlertDialog open={showRemoveAdminDialog} onOpenChange={setShowRemoveAdminDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Role Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus role admin dari <strong>{memberToRemoveAdmin?.name}</strong>?
              Member ini tidak lagi memiliki akses untuk mengelola koperasi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToRemoveAdmin(null)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (memberToRemoveAdmin && onRemoveAdmin) {
                  await onRemoveAdmin(memberToRemoveAdmin.id);
                  await refreshAdminRoles();
                  setShowRemoveAdminDialog(false);
                  setMemberToRemoveAdmin(null);
                  setSelectedMember(null);
                }
              }}
            >
              Ya, Hapus Role Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Photo Preview Dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="max-w-md p-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg">
            {selectedMember?.profilePhoto && (
              <img
                src={selectedMember.profilePhoto}
                alt={selectedMember.name}
                className="h-full w-full object-cover animate-scale-in"
              />
            )}
          </div>
          <div className="p-3 text-center">
            <p className="font-medium text-foreground">{selectedMember?.name}</p>
            <p className="text-sm text-muted-foreground">{selectedMember?.memberNumber}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Edit Dialog */}
      {selectedMember && (
        <MemberEditDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          member={selectedMember}
          onSuccess={() => {
            // Refresh member data by triggering re-render
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}

      {/* Member Number Regenerate Dialog */}
      {selectedMember && (
        <MemberNumberRegenerateDialog
          open={showRegenerateNumberDialog}
          onOpenChange={setShowRegenerateNumberDialog}
          member={selectedMember}
          isAdmin={isAdmin(selectedMember.id)}
          onSuccess={() => {
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}
    </>
  );
};
