import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Clock,
  User,
  Monitor,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface PasswordAuditLogProps {
  onBack: () => void;
}

interface PasswordLog {
  id: string;
  user_id: string;
  changed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  failure_reason: string | null;
  profile?: {
    name: string;
    email: string;
    member_number: string | null;
  };
}

export const PasswordAuditLog = ({ onBack }: PasswordAuditLogProps) => {
  const { t } = useThemeLanguage();
  const [logs, setLogs] = useState<PasswordLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      // Fetch password change logs
      const { data: logsData, error: logsError } = await supabase
        .from('password_change_logs')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(100);

      if (logsError) {
        console.error('Error fetching logs:', logsError);
        return;
      }

      // Fetch profiles for user info
      const userIds = [...new Set(logsData?.map(log => log.user_id) || [])];
      
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, name, email, member_number')
          .in('user_id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }

        // Map profiles to logs
        const profileMap = new Map(
          profilesData?.map(p => [p.user_id, { name: p.name, email: p.email, member_number: p.member_number }])
        );

        const logsWithProfiles = logsData?.map(log => ({
          ...log,
          profile: profileMap.get(log.user_id)
        })) || [];

        setLogs(logsWithProfiles);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchQuery === '' || 
      log.profile?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.profile?.member_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const successCount = logs.filter(l => l.status === 'success').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return t('Tidak diketahui', 'Unknown');
    
    // Simplified browser detection
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    if (ua.includes('Opera')) return 'Opera';
    return t('Browser lainnya', 'Other browser');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('Audit Log Password', 'Password Audit Log')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('Riwayat perubahan password anggota', 'Member password change history')}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{logs.length}</p>
                <p className="text-xs text-muted-foreground">{t('Total Log', 'Total Logs')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{successCount}</p>
                <p className="text-xs text-muted-foreground">{t('Berhasil', 'Successful')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{failedCount}</p>
                <p className="text-xs text-muted-foreground">{t('Gagal', 'Failed')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <SearchInput
              placeholder={t('Cari nama, email, atau nomor anggota...', 'Search name, email, or member number...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="flex-1"
            />
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                {t('Semua', 'All')}
              </Button>
              <Button
                variant={statusFilter === 'success' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('success')}
              >
                {t('Berhasil', 'Success')}
              </Button>
              <Button
                variant={statusFilter === 'failed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('failed')}
              >
                {t('Gagal', 'Failed')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchLogs}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {t('Riwayat Perubahan Password', 'Password Change History')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">
                {searchQuery || statusFilter !== 'all' 
                  ? t('Tidak ada log yang sesuai filter', 'No logs match the filter')
                  : t('Belum ada riwayat perubahan password', 'No password change history yet')
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log, index) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                    log.status === 'success' ? 'bg-success/10' : 'bg-destructive/10'
                  }`}>
                    {log.status === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">
                        {log.profile?.name || t('Anggota tidak ditemukan', 'Member not found')}
                      </span>
                      <Badge variant={log.status === 'success' ? 'success' : 'destructive'} className="shrink-0">
                        {log.status === 'success' 
                          ? t('Berhasil', 'Success') 
                          : t('Gagal', 'Failed')
                        }
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span>{log.profile?.email}</span>
                      {log.profile?.member_number && (
                        <>
                          <span>•</span>
                          <span>{log.profile.member_number}</span>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(new Date(log.changed_at), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        <span>{parseUserAgent(log.user_agent)}</span>
                      </div>
                    </div>
                    
                    {log.failure_reason && (
                      <div className="mt-2 text-sm text-destructive">
                        {t('Alasan:', 'Reason:')} {log.failure_reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
