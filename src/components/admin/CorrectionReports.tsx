import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatShortDate } from '@/lib/mockData';
import { 
  Flag, 
  CheckCircle, 
  XCircle, 
  User,
  ArrowLeft,
  Clock,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  Loader2,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FilterSelect } from '@/components/ui/filter-select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCorrectionJournal } from '@/hooks/useCorrectionJournal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DuplicateCorrectionCleanup } from './DuplicateCorrectionCleanup';
import { useDuplicateCorrectionDetection } from '@/hooks/useDuplicateCorrectionDetection';

interface CorrectionReport {
  id: string;
  user_id: string;
  correction_type: string;
  operation: string;
  amount: number;
  current_balance: number;
  new_balance: number;
  reason: string;
  status: string;
  report_reason: string | null;
  reported_at: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  journal_entry_id: string | null;
  profile?: {
    name: string;
    member_number: string | null;
  };
}

interface CorrectionReportsProps {
  onBack: () => void;
}

const getCorrectionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'simpanan_pokok': 'Simpanan Pokok',
    'simpanan_wajib': 'Simpanan Wajib',
    'simpanan_sukarela': 'Simpanan Sukarela',
    'angsuran': 'Angsuran',
  };
  return labels[type] || type;
};

const getOperationLabel = (operation: string): string => {
  return operation === 'add' ? 'Penambahan' : 'Pengurangan';
};

export const CorrectionReports = ({ onBack }: CorrectionReportsProps) => {
  const [reports, setReports] = useState<CorrectionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<CorrectionReport | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolveAction, setResolveAction] = useState<'approve' | 'reject' | null>(null);
  const [activeTab, setActiveTab] = useState('reports');
  
  // Regenerate journal state
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [isBulkRegenerating, setIsBulkRegenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  
  const { regenerateCorrectionJournal, validateRequiredAccounts } = useCorrectionJournal();
  
  // Duplicate detection
  const { totalDuplicates, refetch: refetchDuplicates } = useDuplicateCorrectionDetection();

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  // Realtime subscription for corrections
  useEffect(() => {
    const channel = supabase
      .channel('correction-reports-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'corrections'
        },
        (payload) => {
          console.log('[Realtime] Corrections changed:', payload.eventType);
          fetchReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('corrections')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter === 'reported') {
        query = query.eq('status', 'reported');
      } else if (statusFilter === 'resolved') {
        query = query.in('status', ['resolved_approved', 'resolved_rejected']);
      } else if (statusFilter === 'no_journal') {
        query = query.is('journal_entry_id', null).eq('status', 'applied');
      }

      const { data: correctionsData, error } = await query;

      if (error) throw error;
      
      if (!correctionsData || correctionsData.length === 0) {
        setReports([]);
        return;
      }

      // Fetch profiles separately
      const userIds = [...new Set(correctionsData.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, member_number')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      const reportsWithProfiles: CorrectionReport[] = correctionsData.map(c => ({
        ...c,
        profile: profileMap.get(c.user_id) || { name: 'Unknown', member_number: null }
      }));

      setReports(reportsWithProfiles);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal memuat laporan koreksi');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (action: 'approve' | 'reject') => {
    if (!selectedReport) return;
    
    if (!resolutionNote.trim()) {
      toast.error('Mohon isi catatan resolusi');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('corrections')
        .update({
          status: action === 'approve' ? 'resolved_approved' : 'resolved_rejected',
          resolution_note: resolutionNote.trim(),
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      toast.success(action === 'approve' 
        ? 'Laporan disetujui dan koreksi dipertahankan' 
        : 'Laporan ditolak'
      );
      
      setSelectedReport(null);
      setResolutionNote('');
      setResolveAction(null);
      fetchReports();
    } catch (error) {
      console.error('Error resolving report:', error);
      toast.error('Gagal memproses laporan');
    }
  };

  const filteredReports = reports.filter(report => {
    const searchLower = search.toLowerCase();
    const profileName = report.profile?.name || '';
    const memberNumber = report.profile?.member_number || '';
    
    return (
      profileName.toLowerCase().includes(searchLower) ||
      memberNumber.toLowerCase().includes(searchLower) ||
      getCorrectionTypeLabel(report.correction_type).toLowerCase().includes(searchLower)
    );
  });

  const reportedCount = reports.filter(r => r.status === 'reported').length;
  
  // Corrections without journal
  const correctionsWithoutJournal = useMemo(() => {
    return reports.filter(r => r.status === 'applied' && !r.journal_entry_id);
  }, [reports]);

  // Handle single regenerate with validation
  const handleRegenerateJournal = async (correction: CorrectionReport) => {
    setIsRegenerating(correction.id);
    
    // Validate required accounts first
    const validation = await validateRequiredAccounts();
    if (!validation.isValid) {
      toast.error('Akun yang diperlukan tidak ditemukan', {
        description: `Akun tidak aktif/tidak ada: ${validation.missingAccounts.join(', ')}`
      });
      setIsRegenerating(null);
      return;
    }
    
    const result = await regenerateCorrectionJournal(correction.id);
    
    if (result.success && result.journalNumber) {
      toast.success('Jurnal koreksi berhasil dibuat', {
        description: `Nomor jurnal: ${result.journalNumber}`
      });
      fetchReports();
    } else {
      toast.error('Gagal membuat jurnal koreksi', {
        description: 'Terjadi kesalahan saat membuat jurnal'
      });
    }
    
    setIsRegenerating(null);
  };

  // Handle bulk regenerate with validation
  const handleBulkRegenerate = async () => {
    if (correctionsWithoutJournal.length === 0) return;

    // Validate required accounts first before processing
    const validation = await validateRequiredAccounts();
    if (!validation.isValid) {
      toast.error('Tidak dapat memulai regenerate', {
        description: `Akun tidak aktif/tidak ada: ${validation.missingAccounts.join(', ')}`
      });
      return;
    }

    setIsBulkRegenerating(true);
    setBulkProgress({ current: 0, total: correctionsWithoutJournal.length, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < correctionsWithoutJournal.length; i++) {
      const correction = correctionsWithoutJournal[i];
      
      const result = await regenerateCorrectionJournal(correction.id);

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }

      setBulkProgress(prev => ({ 
        ...prev, 
        current: i + 1, 
        success: successCount,
        failed: failedCount 
      }));
    }

    setIsBulkRegenerating(false);

    if (successCount > 0) {
      toast.success(`Berhasil membuat ${successCount} jurnal koreksi`, {
        description: failedCount > 0 ? `${failedCount} koreksi gagal` : undefined
      });
      fetchReports();
    } else if (failedCount > 0) {
      toast.error('Gagal membuat jurnal', {
        description: 'Terjadi kesalahan saat memproses jurnal'
      });
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Laporan & Jurnal Koreksi</h1>
            <p className="mt-1 text-muted-foreground">
              Kelola laporan koreksi dari anggota, regenerate jurnal, dan cleanup duplikat
            </p>
          </div>
        </div>

        {/* Tabs - Button Group Style */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1">
            <button
              onClick={() => setActiveTab('reports')}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === 'reports'
                  ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Flag className="h-4 w-4" />
              Laporan Koreksi
            </button>
            <button
              onClick={() => setActiveTab('duplicates')}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === 'duplicates'
                  ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              Cleanup Duplikat
              {totalDuplicates > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {totalDuplicates}
                </Badge>
              )}
            </button>
          </div>

          <TabsContent value="reports" className="mt-4 space-y-4">
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                      <Flag className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{reportedCount}</p>
                      <p className="text-sm text-muted-foreground">Laporan Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                      <BookOpen className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{correctionsWithoutJournal.length}</p>
                      <p className="text-sm text-muted-foreground">Tanpa Jurnal</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{reports.length}</p>
                      <p className="text-sm text-muted-foreground">Total Koreksi</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

        {/* Bulk Regenerate Progress */}
        {isBulkRegenerating && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Membuat jurnal koreksi...</span>
                  <span className="font-medium">
                    {bulkProgress.current}/{bulkProgress.total}
                  </span>
                </div>
                <Progress value={(bulkProgress.current / bulkProgress.total) * 100} />
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Berhasil: {bulkProgress.success}</span>
                  <span className="text-destructive">Gagal: {bulkProgress.failed}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Flag className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <CardTitle className="text-lg">Daftar Koreksi</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {reportedCount} laporan menunggu tindakan
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {/* Bulk regenerate button */}
                {correctionsWithoutJournal.length > 0 && !isBulkRegenerating && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkRegenerate}
                        className="gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Regenerate Semua ({correctionsWithoutJournal.length})
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Buat jurnal untuk {correctionsWithoutJournal.length} koreksi yang belum memiliki jurnal</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <FilterSelect
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'Semua' },
                    { value: 'reported', label: 'Dilaporkan' },
                    { value: 'resolved', label: 'Sudah Ditangani' },
                    { value: 'no_journal', label: 'Tanpa Jurnal' },
                  ]}
                  placeholder="Filter status"
                  showAllOption={false}
                  triggerClassName="w-full sm:w-40"
                />
                <SearchInput
                  placeholder="Cari anggota..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  containerClassName="w-full sm:w-64"
                />
              </div>
            </div>
          </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {search ? 'Tidak ada laporan yang cocok' : 'Tidak ada laporan koreksi'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div>
                        <p className="font-medium text-foreground">{report.profile?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{report.profile?.member_number || '-'}</p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={report.status === 'reported' ? 'pending' : 'secondary'}>
                          {report.status === 'reported' ? (
                            <>
                              <Clock className="mr-1 h-3 w-3" />
                              Dilaporkan
                            </>
                          ) : report.status === 'resolved_approved' ? (
                            <>
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Disetujui
                            </>
                          ) : (
                            <>
                              <XCircle className="mr-1 h-3 w-3" />
                              Ditolak
                            </>
                          )}
                        </Badge>
                        <Badge variant="outline">
                          {getCorrectionTypeLabel(report.correction_type)}
                        </Badge>
                        <Badge variant={report.operation === 'add' ? 'success' : 'destructive'}>
                          {getOperationLabel(report.operation)}
                        </Badge>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <p><span className="font-medium">Koreksi:</span> {formatCurrency(report.amount)}</p>
                        <p><span className="font-medium">Alasan koreksi:</span> {report.reason}</p>
                      </div>

                      {report.report_reason && (
                        <div className="rounded bg-warning/10 p-2 text-sm border-l-2 border-warning">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium text-warning">Laporan Anggota:</p>
                              <p className="text-muted-foreground">{report.report_reason}</p>
                              {report.reported_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Dilaporkan: {formatShortDate(report.reported_at)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {report.resolution_note && (
                        <div className="rounded bg-muted p-2 text-sm">
                          <p className="font-medium">Resolusi:</p>
                          <p className="text-muted-foreground">{report.resolution_note}</p>
                          {report.resolved_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Ditangani: {formatShortDate(report.resolved_at)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    {/* Regenerate journal button */}
                    {report.status === 'applied' && !report.journal_entry_id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRegenerateJournal(report)}
                            disabled={isRegenerating === report.id}
                          >
                            {isRegenerating === report.id ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-1 h-4 w-4" />
                            )}
                            Buat Jurnal
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Buat jurnal untuk koreksi ini</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {/* Journal indicator */}
                    {report.journal_entry_id && (
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                        <BookOpen className="mr-1 h-3 w-3" />
                        Jurnal Dibuat
                      </Badge>
                    )}
                    
                    {report.status === 'reported' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            setSelectedReport(report);
                            setResolveAction('reject');
                          }}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Tolak
                        </Button>
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => {
                            setSelectedReport(report);
                            setResolveAction('approve');
                          }}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Setujui
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolution Dialog */}
      <Dialog open={!!resolveAction} onOpenChange={() => {
        setResolveAction(null);
        setSelectedReport(null);
        setResolutionNote('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveAction === 'approve' ? 'Setujui Laporan' : 'Tolak Laporan'}
            </DialogTitle>
            <DialogDescription>
              {resolveAction === 'approve' 
                ? 'Koreksi akan dipertahankan dan anggota akan diberitahu bahwa laporannya valid.' 
                : 'Koreksi akan tetap berlaku dan anggota akan diberitahu bahwa laporannya ditolak.'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedReport && (
            <div className="rounded bg-muted p-3 text-sm space-y-1">
              <p><span className="font-medium">Anggota:</span> {selectedReport.profile?.name}</p>
              <p><span className="font-medium">Tipe:</span> {getCorrectionTypeLabel(selectedReport.correction_type)}</p>
              <p><span className="font-medium">Jumlah:</span> {formatCurrency(selectedReport.amount)}</p>
              <p><span className="font-medium">Laporan:</span> {selectedReport.report_reason}</p>
            </div>
          )}

          <Textarea
            placeholder="Berikan catatan resolusi untuk anggota..."
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setResolveAction(null);
              setSelectedReport(null);
              setResolutionNote('');
            }}>
              Batal
            </Button>
            <Button 
              variant={resolveAction === 'approve' ? 'success' : 'destructive'} 
              onClick={() => resolveAction && handleResolve(resolveAction)}
            >
              {resolveAction === 'approve' ? 'Setujui' : 'Tolak'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </TabsContent>

          <TabsContent value="duplicates" className="mt-4">
            <DuplicateCorrectionCleanup />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};
