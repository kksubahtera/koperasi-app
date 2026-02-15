import { useState, useMemo } from 'react';
import { User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatCurrency } from '@/lib/mockData';
import { 
  UserX, 
  Calendar, 
  CalendarClock, 
  CreditCard, 
  Wallet,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  BanknoteIcon,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { RefundConfirmationLetter } from '@/components/shared/RefundConfirmationLetter';
import { TabNavigation } from '@/components/shared/TabNavigation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { toast } from 'sonner';
import { 
  useInactiveMemberData, 
  getMemberSavingsFromMap, 
  getMemberActiveLoanFromMap,
  calculateRefundBreakdown 
} from '@/hooks/useInactiveMemberData';

interface InactiveMembersReportProps {
  members: User[];
}

// Mock refund status - in real app, this would come from database
const mockRefundStatus: Record<string, { status: 'pending' | 'completed'; date?: string }> = {};

export const InactiveMembersReport = ({ members }: InactiveMembersReportProps) => {
  const currentYear = new Date().getFullYear();
  const inactiveMembers = members.filter(m => !m.isActive && m.exitYear);
  
  // Get user IDs for fetching data
  const userIds = useMemo(() => inactiveMembers.map(m => m.id), [inactiveMembers]);
  
  // Fetch real data from database
  const { savingsMap, loansMap, installmentsMap, isLoading } = useInactiveMemberData(userIds);
  
  // Split into this year and previous years
  const thisYearInactive = inactiveMembers.filter(m => m.exitYear === currentYear);
  const previousYearsInactive = inactiveMembers.filter(m => m.exitYear && m.exitYear < currentYear);

  const [activeTab, setActiveTab] = useState<'this-year' | 'previous-years'>('this-year');
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [refundStatuses, setRefundStatuses] = useState(mockRefundStatus);
  const [confirmRefundMember, setConfirmRefundMember] = useState<User | null>(null);
  const [letterMember, setLetterMember] = useState<User | null>(null);

  // Calculate total savings for inactive members
  const calculateTotalSavings = (memberList: User[]) => {
    return memberList.reduce((sum, member) => {
      const savings = getMemberSavingsFromMap(member.id, savingsMap);
      return sum + (savings?.totalSimpanan || 0);
    }, 0);
  };

  // Get loan status for member
  const getMemberLoanStatus = (userId: string) => {
    return getMemberActiveLoanFromMap(userId, loansMap);
  };

  // Calculate refund breakdown with arrears logic (no admin fee)
  const getRefundBreakdown = (userId: string) => {
    return calculateRefundBreakdown(userId, savingsMap, loansMap, installmentsMap);
  };

  const handleConfirmRefund = (member: User) => {
    setRefundStatuses(prev => ({
      ...prev,
      [member.id]: { status: 'completed', date: new Date().toISOString().split('T')[0] }
    }));
    setConfirmRefundMember(null);
    toast.success(`Dana ${member.name} berhasil dikembalikan`);
  };

  const renderMemberList = (memberList: User[], emptyMessage: string) => {
    if (memberList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <UserX className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {memberList.map((member) => {
          const breakdown = getRefundBreakdown(member.id);
          const { savings, totalArrears, remainingPrincipal, totalPenalties, refundAmount, shortfallAmount, hasShortfall, hasLoan } = breakdown;
          const loan = getMemberLoanStatus(member.id);
          const isExpanded = expandedMember === member.id;
          const refundStatus = refundStatuses[member.id] || { status: 'pending' };

          return (
            <Collapsible
              key={member.id}
              open={isExpanded}
              onOpenChange={() => setExpandedMember(isExpanded ? null : member.id)}
            >
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <CollapsibleTrigger asChild>
                  <div className="flex flex-col gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <span className="text-sm font-semibold text-muted-foreground">
                            {member.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.memberNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasShortfall && (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" /> Kekurangan
                          </Badge>
                        )}
                        <Badge 
                          variant={refundStatus.status === 'completed' ? 'default' : 'outline'}
                          className={refundStatus.status === 'completed' ? 'bg-success text-success-foreground' : 'border-warning text-warning'}
                        >
                          {refundStatus.status === 'completed' ? (
                            <><CheckCircle2 className="mr-1 h-3 w-3" /> Dikembalikan</>
                          ) : (
                            <><Clock className="mr-1 h-3 w-3" /> Menunggu</>
                          )}
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-muted-foreground">Bergabung</p>
                        <p className="font-medium text-foreground">{formatDate(member.joinDate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Keluar</p>
                        <p className="font-medium text-foreground">
                          {member.exitDate ? formatDate(member.exitDate) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Simpanan</p>
                        <p className="font-medium text-foreground">{formatCurrency(savings.totalSimpanan)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status Pinjaman</p>
                        {loan ? (
                          <Badge 
                            variant={loan.status === 'completed' ? 'default' : 'destructive'}
                            className={loan.status === 'completed' ? 'bg-success' : ''}
                          >
                            {loan.status === 'completed' ? 'Lunas' : 'Belum Lunas'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t border-border p-4 bg-muted/20">
                    <h4 className="flex items-center gap-2 font-medium text-foreground mb-3">
                      <Wallet className="h-4 w-4 text-primary" />
                      Rincian Pengembalian Dana
                    </h4>
                    
                    <div className="space-y-2 mb-4">
                      {/* Savings breakdown */}
                      <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-card">
                        <span className="text-muted-foreground">Simpanan Pokok</span>
                        <span className="font-medium text-foreground">{formatCurrency(savings.simpananPokok)}</span>
                      </div>
                      <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-card">
                        <span className="text-muted-foreground">Simpanan Wajib</span>
                        <span className="font-medium text-foreground">{formatCurrency(savings.simpananWajib)}</span>
                      </div>
                      <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-card">
                        <span className="text-muted-foreground">Simpanan Sukarela</span>
                        <span className="font-medium text-foreground">{formatCurrency(savings.simpananSukarela)}</span>
                      </div>
                      <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
                        <span className="font-medium text-foreground">Total Simpanan</span>
                        <span className="font-bold text-primary">{formatCurrency(savings.totalSimpanan)}</span>
                      </div>

                      {/* Arrears breakdown (if any) */}
                      {totalArrears > 0 && (
                        <>
                          <div className="border-t border-border my-2 pt-2">
                            <p className="text-sm font-medium text-destructive flex items-center gap-1 mb-2">
                              <CreditCard className="h-4 w-4" />
                              Tunggakan Pinjaman
                            </p>
                          </div>
                          <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-card">
                            <span className="text-muted-foreground">Sisa Pokok Pinjaman</span>
                            <span className="font-medium text-foreground">{formatCurrency(remainingPrincipal)}</span>
                          </div>
                          {totalPenalties > 0 && (
                            <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-card">
                              <span className="text-muted-foreground">Total Denda</span>
                              <span className="font-medium text-foreground">{formatCurrency(totalPenalties)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm py-2 px-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <span className="font-medium text-foreground">Total Tunggakan</span>
                            <span className="font-bold text-destructive">- {formatCurrency(totalArrears)}</span>
                          </div>
                        </>
                      )}

                      {/* Final result */}
                      <div className="border-t border-border my-2" />
                      {hasShortfall ? (
                        <div className="flex justify-between text-sm py-3 px-3 rounded-lg bg-destructive/10 border border-destructive/20">
                          <span className="font-medium text-foreground">Kekurangan yang Harus Dibayar</span>
                          <span className="font-bold text-destructive">{formatCurrency(shortfallAmount)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-sm py-3 px-3 rounded-lg bg-success/10 border border-success/20">
                          <span className="font-medium text-foreground">Dana Dikembalikan</span>
                          <span className="font-bold text-success">{formatCurrency(refundAmount)}</span>
                        </div>
                      )}
                    </div>

                    {refundStatus.status === 'pending' ? (
                      <Button 
                        onClick={() => setConfirmRefundMember(member)}
                        className={`w-full ${hasShortfall ? 'bg-warning hover:bg-warning/90 text-warning-foreground' : 'bg-success hover:bg-success/90 text-success-foreground'}`}
                      >
                        <BanknoteIcon className="mr-2 h-4 w-4" />
                        {hasShortfall ? 'Tandai Kekurangan Dibayar' : 'Tandai Sudah Dikembalikan'}
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-success/10 text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            Selesai pada {refundStatus.date ? formatDate(refundStatus.date) : '-'}
                          </span>
                        </div>
                        <Button 
                          onClick={() => setLetterMember(member)}
                          variant="outline"
                          className="w-full"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Unduh Surat Konfirmasi
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Laporan Anggota Non-Aktif</h1>
        <p className="mt-1 text-muted-foreground">Data anggota yang sudah tidak aktif di koperasi</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <Calendar className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{thisYearInactive.length}</p>
                <p className="text-sm text-muted-foreground">Keluar Tahun Ini</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{previousYearsInactive.length}</p>
                <p className="text-sm text-muted-foreground">Tahun Sebelumnya</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <UserX className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{inactiveMembers.length}</p>
                <p className="text-sm text-muted-foreground">Total Non-Aktif</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <CreditCard className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(calculateTotalSavings(inactiveMembers))}
                </p>
                <p className="text-sm text-muted-foreground">Total Simpanan</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <TabNavigation
        tabs={[
          { 
            value: 'this-year', 
            icon: Calendar, 
            label: `Tahun ${currentYear}`,
            badge: thisYearInactive.length > 0 ? thisYearInactive.length : undefined
          },
          { 
            value: 'previous-years', 
            icon: CalendarClock, 
            label: 'Tahun Sebelumnya',
            badge: previousYearsInactive.length > 0 ? previousYearsInactive.length : undefined
          },
        ]}
        activeTab={activeTab}
        onTabChange={(value) => setActiveTab(value as typeof activeTab)}
      />

      {/* This Year Content */}
      {activeTab === 'this-year' && (
        <Card className="animate-fade-in">
          <CardContent className="pt-6">
            {renderMemberList(thisYearInactive, `Tidak ada anggota keluar di tahun ${currentYear}`)}
          </CardContent>
        </Card>
      )}

      {/* Previous Years Content */}
      {activeTab === 'previous-years' && (
        <Card className="animate-fade-in">
          <CardContent className="pt-6">
            {renderMemberList(previousYearsInactive, 'Tidak ada data anggota keluar tahun sebelumnya')}
          </CardContent>
        </Card>
      )}

      {/* Confirm Refund Dialog */}
      <AlertDialog open={!!confirmRefundMember} onOpenChange={() => setConfirmRefundMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmRefundMember && getRefundBreakdown(confirmRefundMember.id).hasShortfall 
                ? 'Konfirmasi Pelunasan Kekurangan' 
                : 'Konfirmasi Pengembalian Dana'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRefundMember && getRefundBreakdown(confirmRefundMember.id).hasShortfall ? (
                <>
                  Anda akan menandai bahwa <strong>{confirmRefundMember?.name}</strong> telah membayar 
                  kekurangan sebesar{' '}
                  <strong className="text-destructive">
                    {confirmRefundMember && formatCurrency(getRefundBreakdown(confirmRefundMember.id).shortfallAmount)}
                  </strong>.
                </>
              ) : (
                <>
                  Anda akan menandai bahwa dana simpanan <strong>{confirmRefundMember?.name}</strong> sebesar{' '}
                  <strong className="text-success">
                    {confirmRefundMember && formatCurrency(getRefundBreakdown(confirmRefundMember.id).refundAmount)}
                  </strong>{' '}
                  telah dikembalikan ke rekening anggota.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRefundMember && handleConfirmRefund(confirmRefundMember)}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              Ya, Konfirmasi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Refund Confirmation Letter Dialog */}
      {letterMember && (() => {
        const breakdown = getRefundBreakdown(letterMember.id);
        const refundStatus = refundStatuses[letterMember.id];
        return (
          <RefundConfirmationLetter
            open={!!letterMember}
            onClose={() => setLetterMember(null)}
            refund={{
              id: letterMember.id,
              memberName: letterMember.name,
              memberNumber: letterMember.memberNumber,
              exitDate: letterMember.exitDate || new Date().toISOString(),
              simpananPokok: breakdown.savings.simpananPokok,
              simpananWajib: breakdown.savings.simpananWajib,
              simpananSukarela: breakdown.savings.simpananSukarela,
              totalSavings: breakdown.savings.totalSimpanan,
              loanOutstanding: breakdown.totalArrears,
              totalRefund: breakdown.refundAmount,
              refundDate: refundStatus?.date || new Date().toISOString().split('T')[0],
            }}
          />
        );
      })()}
    </div>
  );
};
