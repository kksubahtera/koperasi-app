import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loan, LoanInstallment } from '@/lib/types';
import { formatCurrency, formatShortDate } from '@/lib/mockData';
import { 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  History,
  Clock,
  XCircle,
  FileText,
  Trash2,
  X,
  Banknote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { LoanApprovalLetter } from '@/components/shared/LoanApprovalLetter';
import { LoanSettlementLetter } from '@/components/shared/LoanSettlementLetter';
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { TabNavigation, TabItem } from '@/components/shared/TabNavigation';
import { Button } from '@/components/ui/button';
import { useCriticalSettings } from '@/hooks/useSettingsChangeLogs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
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
import { EarlyPayoffCalculator } from './EarlyPayoffCalculator';

// Dynamic penalty info based on database settings
const PenaltyInfoNote = () => {
  const { t } = useThemeLanguage();
  const { settings } = useCriticalSettings();
  
  // Use settings from database/hook, with defaults
  const penaltyRate = settings?.latePaymentPenalty ?? 0.5;
  const penaltyTypeValue = settings?.latePaymentPenaltyType ?? 'monthly';
  const penaltyBaseValue = settings?.latePaymentPenaltyBase ?? 'remaining_installment';
  const gracePeriodDays = settings?.penaltyGracePeriodDays ?? 0;
  
  const penaltyType = penaltyTypeValue === 'daily' ? 'hari' : 'bulan';
  const penaltyBase = penaltyBaseValue === 'remaining_principal' 
    ? 'sisa pokok pinjaman' 
    : 'sisa angsuran';
  
  const penaltyText = `Denda ${penaltyRate}% dari ${penaltyBase} per ${penaltyType} keterlambatan`;
  const penaltyTextEn = `${penaltyRate}% penalty from ${penaltyBaseValue === 'remaining_principal' ? 'remaining principal' : 'remaining installment'} per ${penaltyTypeValue === 'daily' ? 'day' : 'month'} overdue`;
  
  const gracePeriodText = gracePeriodDays > 0 
    ? `Denda berlaku setelah ${gracePeriodDays} hari dari jatuh tempo`
    : 'Denda berlaku langsung setelah jatuh tempo';
  const gracePeriodTextEn = gracePeriodDays > 0 
    ? `Penalty applies ${gracePeriodDays} days after due date`
    : 'Penalty applies immediately after due date';
  
  return (
    <div className="mt-4 space-y-1">
      <p className="text-xs text-muted-foreground">
        * {t(penaltyText, penaltyTextEn)}
      </p>
      <p className="text-xs text-muted-foreground">
        * {t(gracePeriodText, gracePeriodTextEn)}
      </p>
    </div>
  );
};

interface LoanCardProps {
  loans: Loan[];
  installments: LoanInstallment[];
  onLoanDeleted?: () => void | Promise<unknown>;
  onNavigate?: (view: string) => void;
}

export const LoanCard = ({ loans, installments, onLoanDeleted, onNavigate }: LoanCardProps) => {
  const { t } = useThemeLanguage();
  const { user } = useAuth();
  const [selectedLoanForLetter, setSelectedLoanForLetter] = useState<Loan | null>(null);
  const [selectedLoanForSettlement, setSelectedLoanForSettlement] = useState<Loan | null>(null);
  const [loanToCancel, setLoanToCancel] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const pendingLoans = loans.filter(l => l.status === 'pending');
  const activeLoans = loans.filter(l => l.status === 'active');
  const completedLoans = loans.filter(l => l.status === 'completed');
  const rejectedLoans = loans.filter(l => l.status === 'rejected');
  
  const [activeLoanTab, setActiveLoanTab] = useState(activeLoans.length > 0 ? 'active' : 'history');

  const handleCancelLoan = async (loan: Loan) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', loan.id)
        .eq('status', 'pending');

      if (error) throw error;

      // Send notification to admin
      await supabase.from('admin_notifications').insert({
        title: 'Pengajuan Pinjaman Dibatalkan',
        message: `Anggota ${user?.name || 'Unknown'} (${user?.memberNumber || '-'}) membatalkan pengajuan pinjaman sebesar Rp ${loan.principalAmount.toLocaleString('id-ID')} dengan tenor ${loan.tenor} bulan.`,
        notification_type: 'loan_cancelled',
        metadata: {
          user_id: user?.id,
          member_name: user?.name,
          member_number: user?.memberNumber,
          loan_amount: loan.principalAmount,
          tenor: loan.tenor,
          cancelled_at: new Date().toISOString(),
        },
      });

      // Close dialog and reset state first
      setLoanToCancel(null);
      setIsDeleting(false);

      // Show success toast
      toast({
        title: t('Berhasil', 'Success'),
        description: t('Pengajuan pinjaman berhasil dibatalkan', 'Loan application cancelled successfully'),
      });
      
      // Trigger refetch to update UI immediately (realtime subscription also handles this)
      onLoanDeleted?.();
      
    } catch (error) {
      console.error('Error cancelling loan:', error);
      toast({
        title: t('Gagal', 'Failed'),
        description: t('Gagal membatalkan pengajuan pinjaman', 'Failed to cancel loan application'),
        variant: 'destructive',
      });
      setIsDeleting(false);
      setLoanToCancel(null);
    }
  };

  const handleDeleteRejectedLoan = async (loan: Loan) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', loan.id)
        .eq('status', 'rejected');

      if (error) throw error;

      toast({
        title: t('Berhasil', 'Success'),
        description: t('Riwayat pengajuan ditolak berhasil dihapus', 'Rejected loan application deleted successfully'),
      });
      
      onLoanDeleted?.();
    } catch (error) {
      console.error('Error deleting rejected loan:', error);
      toast({
        title: t('Gagal', 'Failed'),
        description: t('Gagal menghapus riwayat pengajuan', 'Failed to delete loan application'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setLoanToDelete(null);
    }
  };
  
  const loanTabs: TabItem[] = [
    {
      value: 'active',
      icon: CreditCard,
      label: t('Pinjaman Aktif', 'Active Loans'),
      tooltip: t('Lihat pinjaman yang sedang berjalan', 'View active loans'),
      badge: activeLoans.length > 0 ? activeLoans.length : undefined,
    },
    {
      value: 'history',
      icon: History,
      label: t('Riwayat', 'History'),
      tooltip: t('Lihat riwayat pinjaman', 'View loan history'),
      badge: completedLoans.length > 0 ? completedLoans.length : undefined,
    },
    {
      value: 'early-payoff',
      icon: Banknote,
      label: t('Pelunasan Dini', 'Early Payoff'),
      tooltip: t('Lihat riwayat pelunasan dini', 'View early payoff history'),
    },
  ];

  const getStatusBadge = (status: LoanInstallment['status']) => {
    switch (status) {
      case 'paid':
        return <Badge variant="success">{t('Lunas', 'Paid')}</Badge>;
      case 'overdue':
        return <Badge variant="error">{t('Menunggak', 'Overdue')}</Badge>;
      case 'unpaid':
        return <Badge variant="warning">{t('Belum Dibayar', 'Unpaid')}</Badge>;
      case 'partial':
        return <Badge variant="warning">{t('Sebagian', 'Partial')}</Badge>;
      default:
        return <Badge variant="secondary">{t('Belum Jatuh Tempo', 'Not Due')}</Badge>;
    }
  };

  const renderLoanDetail = (loan: Loan, isCompleted: boolean = false) => {
    const loanInstallments = installments.filter(i => i.loanId === loan.id);
    const paidInstallments = loanInstallments.filter(i => i.status === 'paid').length;
    const overdueInstallments = loanInstallments.filter(i => i.status === 'overdue');
    const totalPenalty = overdueInstallments.reduce((sum, i) => sum + i.penaltyAmount, 0);
    const progress = (paidInstallments / loan.tenor) * 100;
    const canDownloadLetter = loan.status === 'active' || loan.status === 'completed';

    return (
      <div key={loan.id} className="space-y-4">
        {/* Loan Summary - Compact */}
        <Card className={cn("border-border/40", isCompleted && "border-success/30 bg-success/5")}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{t('Total Pinjaman', 'Total Loan')}</p>
                  {isCompleted && <Badge variant="success" className="text-[10px]">{t('Lunas', 'Paid')}</Badge>}
                </div>
                <p className="text-xl font-bold">{formatCurrency(loan.principalAmount)}</p>
              </div>
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                isCompleted ? "bg-success/10" : "bg-primary/10"
              )}>
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <CreditCard className="h-5 w-5 text-primary" />
                )}
              </div>
            </div>

            {!isCompleted && (
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('Progress', 'Progress')}</span>
                  <span className="font-medium">{paidInstallments}/{loan.tenor}</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}

            <div className={cn("grid gap-3 text-xs", isCompleted ? "grid-cols-3" : "grid-cols-4")}>
              {!isCompleted && (
                <div>
                  <p className="text-muted-foreground">{t('Sisa', 'Remaining')}</p>
                  <p className="font-semibold">{formatCurrency(loan.remainingPrincipal)}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">{t('Tenor', 'Tenor')}</p>
                <p className="font-semibold">{loan.tenor} {t('bln', 'mo')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('Bunga', 'Interest')}</p>
                <p className="font-semibold">{loan.interestRate}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('Cair', 'Disbursed')}</p>
                <p className="font-semibold">{formatShortDate(loan.disbursementDate)}</p>
              </div>
            </div>

            {canDownloadLetter && (
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs gap-1.5"
                  onClick={() => setSelectedLoanForLetter(loan)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t('Surat Persetujuan', 'Approval Letter')}
                </Button>
                {isCompleted && (
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5"
                    onClick={() => setSelectedLoanForSettlement(loan)}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    {t('Surat Pelunasan', 'Settlement Letter')}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Penalty Info - Compact */}
        {!isCompleted && overdueInstallments.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">{t('Denda', 'Penalty')}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-card rounded-md p-2">
                  <p className="text-muted-foreground">{t('Bulan Ini', 'This Month')}</p>
                  <p className="font-bold text-destructive">
                    {formatCurrency(overdueInstallments[overdueInstallments.length - 1]?.penaltyAmount || 0)}
                  </p>
                </div>
                <div className="bg-card rounded-md p-2">
                  <p className="text-muted-foreground">{t('Akumulasi', 'Total')}</p>
                  <p className="font-bold text-destructive">{formatCurrency(totalPenalty)}</p>
                </div>
                <div className="bg-card rounded-md p-2">
                  <p className="text-muted-foreground">{t('Periode', 'Period')}</p>
                  <p className="font-bold text-destructive">{overdueInstallments.length} {t('bln', 'mo')}</p>
                </div>
              </div>
              <PenaltyInfoNote />
            </CardContent>
          </Card>
        )}

        {/* Installment Schedule - Touch Scrollable Table with Details */}
        {!isCompleted && loanInstallments.length > 0 && (
          <Card className="border-border/40">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm">{t('Jadwal Angsuran', 'Schedule')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ResponsiveTable>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs min-w-[750px]">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">#</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{t('Jatuh Tempo', 'Due')}</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">{t('Pokok', 'Principal')}</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">{t('Bunga', 'Interest')}</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">{t('Total', 'Total')}</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">{t('Denda', 'Penalty')}</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">{t('Dibayar', 'Paid')}</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{t('Keterangan', 'Remarks')}</th>
                        <th className="px-2 py-2 text-center font-medium text-muted-foreground whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {loanInstallments.map((inst) => {
                        const totalDue = inst.totalAmount + inst.penaltyAmount;
                        const difference = inst.paidAmount - totalDue;
                        
                        const getRemarkDisplay = () => {
                          if (inst.status === 'paid' && Math.abs(difference) < 1) {
                            return <span className="text-success text-[10px] font-medium">{t('Sesuai', 'Matched')}</span>;
                          } else if (difference > 0) {
                            return <span className="text-blue-600 text-[10px]">{t('Lebih', 'Over')} {formatCurrency(difference)}</span>;
                          } else if (difference < 0 && inst.paidAmount > 0) {
                            return <span className="text-warning text-[10px]">{t('Kurang', 'Short')} {formatCurrency(Math.abs(difference))}</span>;
                          } else if (inst.status === 'pending') {
                            return <span className="text-muted-foreground text-[10px]">-</span>;
                          } else if (inst.paidAmount === 0 && (inst.status === 'overdue' || inst.status === 'unpaid')) {
                            return <span className="text-destructive text-[10px]">{t('Belum dibayar', 'Unpaid')}</span>;
                          }
                          return <span className="text-muted-foreground text-[10px]">-</span>;
                        };

                        return (
                          <tr 
                            key={inst.id} 
                            className={cn(
                              "hover:bg-muted/30 transition-colors",
                              inst.status === 'overdue' && "bg-destructive/5",
                              inst.status === 'unpaid' && "bg-warning/5",
                              inst.status === 'paid' && "bg-success/5"
                            )}
                          >
                            <td className="px-2 py-2 font-medium">{inst.installmentNumber}</td>
                            <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{formatShortDate(inst.dueDate)}</td>
                            <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(inst.principalAmount)}</td>
                            <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(inst.interestAmount)}</td>
                            <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{formatCurrency(inst.totalAmount)}</td>
                            <td className="px-2 py-2 text-right whitespace-nowrap">
                              {inst.penaltyAmount > 0 ? (
                                <span className="text-destructive font-medium">{formatCurrency(inst.penaltyAmount)}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right whitespace-nowrap">
                              {inst.paidAmount > 0 ? (
                                <span className="font-medium">{formatCurrency(inst.paidAmount)}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-left whitespace-nowrap">{getRemarkDisplay()}</td>
                            <td className="px-2 py-2 text-center">{getStatusBadge(inst.status)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </ResponsiveTable>
            </CardContent>
          </Card>
        )}

        {/* Early Payoff Calculator */}
        {!isCompleted && loan.status === 'active' && loanInstallments.length > 0 && (
          <EarlyPayoffCalculator 
            loan={loan} 
            installments={loanInstallments}
            onSuccess={onLoanDeleted}
          />
        )}
      </div>
    );
  };

  if (loans.length === 0) {
    return (
      <Card className="border-border/40">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <CreditCard className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">{t('Tidak Ada Pinjaman', 'No Loans')}</p>
          <p className="text-xs text-muted-foreground">{t('Belum ada riwayat pinjaman', 'No loan history')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending Loans - Compact */}
      {pendingLoans.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium text-warning">{t('Menunggu Persetujuan', 'Pending')}</span>
            </div>
            <div className="space-y-2">
              {pendingLoans.map(loan => (
                <div key={loan.id} className="bg-card rounded-md p-2 border border-warning/20 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold">{formatCurrency(loan.principalAmount)}</span>
                      <span className="text-muted-foreground ml-2">{loan.tenor} {t('bln', 'mo')}</span>
                    </div>
                    <Badge variant="warning" className="text-[10px]">{t('Proses', 'Processing')}</Badge>
                  </div>
                  {loan.applicationDate && (
                    <p className="text-muted-foreground mt-1">
                      {t('Diajukan', 'Applied')}: {formatShortDate(loan.applicationDate)}
                    </p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                    onClick={() => setLoanToCancel(loan)}
                  >
                    <X className="h-3 w-3" />
                    {t('Batalkan Pengajuan', 'Cancel Application')}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejected Loans - Compact */}
      {rejectedLoans.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">{t('Ditolak', 'Rejected')}</span>
            </div>
            <div className="space-y-2">
              {rejectedLoans.map(loan => (
                <div key={loan.id} className="bg-card rounded-md p-2 border border-destructive/20 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{formatCurrency(loan.principalAmount)}</span>
                    <Badge variant="error" className="text-[10px]">{t('Ditolak', 'Rejected')}</Badge>
                  </div>
                  {loan.rejectionReason && (
                    <p className="text-destructive mt-1">{loan.rejectionReason}</p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1"
                    onClick={() => setLoanToDelete(loan)}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t('Hapus Riwayat', 'Delete History')}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs for Active and History */}
      <div className="space-y-6">
        <TabNavigation
          tabs={loanTabs}
          activeTab={activeLoanTab}
          onTabChange={(tab) => {
            if (tab === 'early-payoff' && onNavigate) {
              onNavigate('early-payoff-history');
            } else {
              setActiveLoanTab(tab);
            }
          }}
        />

        {activeLoanTab === 'active' && (
          <div className="space-y-6 animate-fade-in">
            {activeLoans.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CreditCard className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-lg font-medium text-foreground">{t('Tidak Ada Pinjaman Aktif', 'No Active Loans')}</p>
                  <p className="text-sm text-muted-foreground">{t('Anda tidak memiliki pinjaman yang sedang berjalan', 'You have no ongoing loans')}</p>
                </CardContent>
              </Card>
            ) : (
              activeLoans.map(loan => renderLoanDetail(loan, false))
            )}
          </div>
        )}

        {activeLoanTab === 'history' && (
          <div className="space-y-6 animate-fade-in">
            {completedLoans.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <History className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-lg font-medium text-foreground">{t('Belum Ada Riwayat', 'No History Yet')}</p>
                  <p className="text-sm text-muted-foreground">{t('Belum ada pinjaman yang selesai', 'No completed loans yet')}</p>
                </CardContent>
              </Card>
            ) : (
              completedLoans.map(loan => renderLoanDetail(loan, true))
            )}
          </div>
        )}
      </div>

      {/* Loan Approval Letter Dialog */}
      {selectedLoanForLetter && user && (
        <LoanApprovalLetter
          loan={{
            id: selectedLoanForLetter.id,
            principalAmount: selectedLoanForLetter.principalAmount,
            tenor: selectedLoanForLetter.tenor,
            interestRate: selectedLoanForLetter.interestRate,
            disbursementDate: selectedLoanForLetter.disbursementDate,
            approvedAt: selectedLoanForLetter.disbursementDate,
            memberName: user.name,
            memberNumber: user.memberNumber || '-',
          }}
          open={!!selectedLoanForLetter}
          onClose={() => setSelectedLoanForLetter(null)}
        />
      )}

      {/* Loan Settlement Letter Dialog */}
      {selectedLoanForSettlement && user && (() => {
        const loanInstallments = installments.filter(i => i.loanId === selectedLoanForSettlement.id);
        const paidInstallments = loanInstallments.filter(i => i.status === 'paid');
        const totalPaidPrincipal = paidInstallments.reduce((sum, i) => sum + i.principalAmount, 0);
        const totalPaidInterest = paidInstallments.reduce((sum, i) => sum + i.interestAmount, 0);
        const totalPaidPenalty = paidInstallments.reduce((sum, i) => sum + (i.penaltyAmount || 0), 0);
        const lastPaidDate = paidInstallments.length > 0 
          ? paidInstallments.sort((a, b) => new Date(b.paidDate || '').getTime() - new Date(a.paidDate || '').getTime())[0]?.paidDate
          : undefined;

        return (
          <LoanSettlementLetter
            loan={{
              id: selectedLoanForSettlement.id,
              principalAmount: selectedLoanForSettlement.principalAmount,
              tenor: selectedLoanForSettlement.tenor,
              interestRate: selectedLoanForSettlement.interestRate,
              disbursementDate: selectedLoanForSettlement.disbursementDate,
              completedDate: lastPaidDate,
              totalPaidPrincipal,
              totalPaidInterest,
              totalPaidPenalty,
              memberName: user.name,
              memberNumber: user.memberNumber || '-',
            }}
            open={!!selectedLoanForSettlement}
            onClose={() => setSelectedLoanForSettlement(null)}
          />
        );
      })()}

      {/* Cancel Pending Loan Dialog */}
      <AlertDialog open={!!loanToCancel} onOpenChange={() => setLoanToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Batalkan Pengajuan Pinjaman?', 'Cancel Loan Application?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `Apakah Anda yakin ingin membatalkan pengajuan pinjaman sebesar ${formatCurrency(loanToCancel?.principalAmount || 0)}? Tindakan ini tidak dapat dibatalkan.`,
                `Are you sure you want to cancel the loan application of ${formatCurrency(loanToCancel?.principalAmount || 0)}? This action cannot be undone.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('Tidak', 'No')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                if (loanToCancel) handleCancelLoan(loanToCancel);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('Membatalkan...', 'Cancelling...') : t('Ya, Batalkan', 'Yes, Cancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Rejected Loan Dialog */}
      <AlertDialog open={!!loanToDelete} onOpenChange={() => setLoanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Hapus Riwayat Pengajuan?', 'Delete Application History?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `Apakah Anda yakin ingin menghapus riwayat pengajuan pinjaman yang ditolak sebesar ${formatCurrency(loanToDelete?.principalAmount || 0)}?`,
                `Are you sure you want to delete the rejected loan application history of ${formatCurrency(loanToDelete?.principalAmount || 0)}?`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('Tidak', 'No')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={() => loanToDelete && handleDeleteRejectedLoan(loanToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('Menghapus...', 'Deleting...') : t('Ya, Hapus', 'Yes, Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};