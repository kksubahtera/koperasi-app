import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  History, 
  Eye, 
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Users,
  CreditCard,
  Calendar,
  RotateCcw,
  FileSpreadsheet,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatCurrency } from '@/lib/mockData';
import { Json } from '@/integrations/supabase/types';

interface MigrationRecord {
  id: string;
  year: number;
  status: 'completed' | 'rolled_back' | 'in_progress';
  created_at: string;
  completed_at?: string;
  rolled_back_at?: string;
  performed_by?: string;
  member_count: number;
  loan_count: number;
  total_savings: number;
  total_loans: number;
  has_opening_journal: boolean;
  has_balance_sheet: boolean;
  notes?: string;
  data?: {
    savings_summary?: any[];
    loans?: any[];
    balance_sheet?: any;
  };
}

export const MigrationHistory = () => {
  const [migrations, setMigrations] = useState<MigrationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMigration, setSelectedMigration] = useState<MigrationRecord | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const fetchMigrationHistory = async () => {
    setIsLoading(true);
    try {
      // Fetch migration history from cooperative_settings
      const { data: historyData, error: historyError } = await supabase
        .from('cooperative_settings')
        .select('*')
        .like('key', 'migration_history_%')
        .order('updated_at', { ascending: false });

      if (historyError) throw historyError;

      // Also fetch active backups to show pending/in-progress migrations
      const { data: backupData, error: backupError } = await supabase
        .from('cooperative_settings')
        .select('*')
        .like('key', 'migration_backup_%');

      if (backupError) throw backupError;

      const records: MigrationRecord[] = [];

      // Parse history records
      if (historyData) {
        for (const item of historyData) {
          const value = item.value as Record<string, Json>;
          records.push({
            id: item.id,
            year: (value.year as number) || 0,
            status: (value.status as 'completed' | 'rolled_back' | 'in_progress') || 'completed',
            created_at: (value.created_at as string) || item.updated_at || '',
            completed_at: value.completed_at as string,
            rolled_back_at: value.rolled_back_at as string,
            performed_by: value.performed_by as string,
            member_count: (value.member_count as number) || 0,
            loan_count: (value.loan_count as number) || 0,
            total_savings: (value.total_savings as number) || 0,
            total_loans: (value.total_loans as number) || 0,
            has_opening_journal: (value.has_opening_journal as boolean) || false,
            has_balance_sheet: (value.has_balance_sheet as boolean) || false,
            notes: value.notes as string,
            data: value.data as any,
          });
        }
      }

      // Check for backups that indicate in-progress or completed migrations
      if (backupData) {
        for (const item of backupData) {
          const value = item.value as Record<string, Json>;
          const year = (value.year as number) || 0;
          
          // Check if this year already has a completed record
          const existingRecord = records.find(r => r.year === year && r.status === 'completed');
          if (!existingRecord) {
            // This backup exists without a completed history, could indicate in-progress
            const backupRecord: MigrationRecord = {
              id: item.id,
              year,
              status: 'in_progress',
              created_at: (value.created_at as string) || item.updated_at || '',
              member_count: (value.member_count as number) || 0,
              loan_count: (value.loan_count as number) || 0,
              total_savings: (value.total_savings as number) || 0,
              total_loans: 0,
              has_opening_journal: false,
              has_balance_sheet: false,
            };
            
            // Only add if not already present
            if (!records.find(r => r.year === year)) {
              records.push(backupRecord);
            }
          }
        }
      }

      // Sort by year descending
      records.sort((a, b) => b.year - a.year || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setMigrations(records);
    } catch (error) {
      console.error('Error fetching migration history:', error);
      toast.error('Gagal memuat riwayat migrasi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMigrationHistory();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Selesai
          </Badge>
        );
      case 'rolled_back':
        return (
          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
            <RotateCcw className="h-3 w-3 mr-1" />
            Dibatalkan
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Clock className="h-3 w-3 mr-1" />
            Dalam Proses
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'rolled_back':
        return <RotateCcw className="h-5 w-5 text-orange-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const filteredMigrations = migrations.filter(m => {
    if (activeTab === 'all') return true;
    return m.status === activeTab;
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Memuat riwayat migrasi...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Riwayat Migrasi Data
          </CardTitle>
          <CardDescription>
            Daftar semua migrasi data yang pernah dilakukan beserta statusnya
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                Semua ({migrations.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs sm:text-sm">
                <CheckCircle2 className="h-3 w-3 mr-1 hidden sm:inline" />
                Selesai ({migrations.filter(m => m.status === 'completed').length})
              </TabsTrigger>
              <TabsTrigger value="rolled_back" className="text-xs sm:text-sm">
                <RotateCcw className="h-3 w-3 mr-1 hidden sm:inline" />
                Dibatalkan ({migrations.filter(m => m.status === 'rolled_back').length})
              </TabsTrigger>
              <TabsTrigger value="in_progress" className="text-xs sm:text-sm">
                <Clock className="h-3 w-3 mr-1 hidden sm:inline" />
                Proses ({migrations.filter(m => m.status === 'in_progress').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              {filteredMigrations.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {activeTab === 'all' 
                      ? 'Belum ada riwayat migrasi' 
                      : `Tidak ada migrasi dengan status "${activeTab}"`
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMigrations.map((migration) => (
                    <Card key={migration.id} className="bg-muted/30 hover:bg-muted/50 transition-colors">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-full ${
                              migration.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                              migration.status === 'rolled_back' ? 'bg-orange-100 dark:bg-orange-900/30' :
                              'bg-blue-100 dark:bg-blue-900/30'
                            }`}>
                              {getStatusIcon(migration.status)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-lg">Migrasi Tahun {migration.year}</p>
                                {getStatusBadge(migration.status)}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>{format(new Date(migration.created_at), 'dd MMM yyyy HH:mm', { locale: id })}</span>
                                </div>
                                {migration.status === 'completed' && migration.completed_at && (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Selesai: {format(new Date(migration.completed_at), 'dd MMM yyyy', { locale: id })}</span>
                                  </div>
                                )}
                                {migration.status === 'rolled_back' && migration.rolled_back_at && (
                                  <div className="flex items-center gap-1 text-orange-600">
                                    <RotateCcw className="h-3 w-3" />
                                    <span>Dibatalkan: {format(new Date(migration.rolled_back_at), 'dd MMM yyyy', { locale: id })}</span>
                                  </div>
                                )}
                              </div>
                              {migration.notes && (
                                <p className="text-sm text-muted-foreground mt-1 italic">
                                  {migration.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-500" />
                                <div>
                                  <span className="font-medium">{migration.member_count}</span>
                                  <span className="text-muted-foreground ml-1">anggota</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-purple-500" />
                                <div>
                                  <span className="font-medium">{migration.loan_count}</span>
                                  <span className="text-muted-foreground ml-1">pinjaman</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 col-span-2">
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                <div>
                                  <span className="font-medium">{formatCurrency(migration.total_savings)}</span>
                                  <span className="text-muted-foreground ml-1">simpanan</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1">
                              {migration.has_opening_journal && (
                                <Badge variant="outline" className="text-xs">
                                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                                  Jurnal Pembuka
                                </Badge>
                              )}
                              {migration.has_balance_sheet && (
                                <Badge variant="outline" className="text-xs">
                                  <Database className="h-3 w-3 mr-1" />
                                  Neraca
                                </Badge>
                              )}
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedMigration(migration);
                                setShowDetailDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Detail
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detail Migrasi Tahun {selectedMigration?.year}
              {selectedMigration && getStatusBadge(selectedMigration.status)}
            </DialogTitle>
            <DialogDescription>
              {selectedMigration && (
                <>
                  Dibuat pada {format(new Date(selectedMigration.created_at), 'dd MMMM yyyy HH:mm', { locale: id })}
                  {selectedMigration.performed_by && ` oleh ${selectedMigration.performed_by}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedMigration && (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-blue-50 dark:bg-blue-900/20">
                    <CardContent className="py-3 text-center">
                      <Users className="h-5 w-5 mx-auto text-blue-600" />
                      <p className="text-2xl font-bold text-blue-700">{selectedMigration.member_count}</p>
                      <p className="text-xs text-blue-600">Anggota</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-50 dark:bg-purple-900/20">
                    <CardContent className="py-3 text-center">
                      <CreditCard className="h-5 w-5 mx-auto text-purple-600" />
                      <p className="text-2xl font-bold text-purple-700">{selectedMigration.loan_count}</p>
                      <p className="text-xs text-purple-600">Pinjaman</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 dark:bg-green-900/20">
                    <CardContent className="py-3 text-center">
                      <TrendingUp className="h-5 w-5 mx-auto text-green-600" />
                      <p className="text-lg font-bold text-green-700">{formatCurrency(selectedMigration.total_savings)}</p>
                      <p className="text-xs text-green-600">Total Simpanan</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-orange-50 dark:bg-orange-900/20">
                    <CardContent className="py-3 text-center">
                      <Database className="h-5 w-5 mx-auto text-orange-600" />
                      <p className="text-lg font-bold text-orange-700">{formatCurrency(selectedMigration.total_loans)}</p>
                      <p className="text-xs text-orange-600">Total Pinjaman</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Status Timeline */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Timeline Migrasi</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Migrasi Dimulai</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(selectedMigration.created_at), 'dd MMMM yyyy HH:mm:ss', { locale: id })}
                          </p>
                        </div>
                      </div>
                      
                      {selectedMigration.status === 'completed' && selectedMigration.completed_at && (
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Migrasi Selesai</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(selectedMigration.completed_at), 'dd MMMM yyyy HH:mm:ss', { locale: id })}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {selectedMigration.status === 'rolled_back' && selectedMigration.rolled_back_at && (
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Migrasi Dibatalkan (Rollback)</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(selectedMigration.rolled_back_at), 'dd MMMM yyyy HH:mm:ss', { locale: id })}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Components Created */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Komponen yang Dibuat</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`flex items-center gap-2 p-2 rounded ${selectedMigration.has_opening_journal ? 'bg-green-50 dark:bg-green-900/20' : 'bg-muted/50'}`}>
                        {selectedMigration.has_opening_journal ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">Jurnal Pembuka</span>
                      </div>
                      <div className={`flex items-center gap-2 p-2 rounded ${selectedMigration.has_balance_sheet ? 'bg-green-50 dark:bg-green-900/20' : 'bg-muted/50'}`}>
                        {selectedMigration.has_balance_sheet ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">Neraca Awal</span>
                      </div>
                      <div className={`flex items-center gap-2 p-2 rounded ${selectedMigration.member_count > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-muted/50'}`}>
                        {selectedMigration.member_count > 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">Data Simpanan</span>
                      </div>
                      <div className={`flex items-center gap-2 p-2 rounded ${selectedMigration.loan_count > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-muted/50'}`}>
                        {selectedMigration.loan_count > 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">Data Pinjaman</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Data Preview */}
                {selectedMigration.data?.savings_summary && selectedMigration.data.savings_summary.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Preview Data Simpanan</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="rounded-md border max-h-[150px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User ID</TableHead>
                              <TableHead className="text-right">Simpanan Pokok</TableHead>
                              <TableHead className="text-right">Simpanan Wajib</TableHead>
                              <TableHead className="text-right">Simpanan Sukarela</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedMigration.data.savings_summary.slice(0, 5).map((item: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs">
                                  {item.user_id?.substring(0, 8)}...
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(item.simpanan_pokok || 0)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.simpanan_wajib || 0)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.simpanan_sukarela || 0)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {selectedMigration.data.savings_summary.length > 5 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ...dan {selectedMigration.data.savings_summary.length - 5} data lainnya
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                {selectedMigration.notes && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Catatan</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <p className="text-sm text-muted-foreground">{selectedMigration.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// Helper function to save migration history
export const saveMigrationHistory = async (
  year: number,
  status: 'completed' | 'rolled_back',
  data: {
    member_count: number;
    loan_count: number;
    total_savings: number;
    total_loans: number;
    has_opening_journal: boolean;
    has_balance_sheet: boolean;
    savings_data?: any[];
    notes?: string;
  }
): Promise<boolean> => {
  try {
    const historyKey = `migration_history_${year}_${Date.now()}`;
    const now = new Date().toISOString();
    
    const historyData = {
      year,
      status,
      created_at: now,
      completed_at: status === 'completed' ? now : undefined,
      rolled_back_at: status === 'rolled_back' ? now : undefined,
      member_count: data.member_count,
      loan_count: data.loan_count,
      total_savings: data.total_savings,
      total_loans: data.total_loans,
      has_opening_journal: data.has_opening_journal,
      has_balance_sheet: data.has_balance_sheet,
      notes: data.notes,
      data: {
        savings_summary: data.savings_data?.slice(0, 20), // Store only first 20 for preview
      },
    };

    const { error } = await supabase
      .from('cooperative_settings')
      .insert({
        key: historyKey,
        value: historyData,
        updated_at: now,
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving migration history:', error);
    return false;
  }
};
