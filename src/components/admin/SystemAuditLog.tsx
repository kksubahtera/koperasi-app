import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Activity, 
  User, 
  Clock, 
  Filter,
  RefreshCw,
  Loader2,
  FileText,
  Settings,
  Users,
  Wallet,
  BookOpen,
  Download,
  Upload,
  LogIn,
  LogOut,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useAuditLogs, ACTION_TYPES, ENTITY_TYPES, AuditLogFilters } from '@/hooks/useAuditLogs';

interface SystemAuditLogProps {
  onBack: () => void;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <Plus className="h-4 w-4" />,
  update: <Edit className="h-4 w-4" />,
  delete: <Trash2 className="h-4 w-4" />,
  approve: <CheckCircle className="h-4 w-4" />,
  reject: <XCircle className="h-4 w-4" />,
  export: <Download className="h-4 w-4" />,
  import: <Upload className="h-4 w-4" />,
  login: <LogIn className="h-4 w-4" />,
  logout: <LogOut className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  member: <Users className="h-4 w-4" />,
  loan: <FileText className="h-4 w-4" />,
  transaction: <Wallet className="h-4 w-4" />,
  savings: <Wallet className="h-4 w-4" />,
  journal: <BookOpen className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  shu: <Activity className="h-4 w-4" />,
  resignation: <Users className="h-4 w-4" />,
  backup: <Download className="h-4 w-4" />,
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-success/10 text-success border-success/20',
  update: 'bg-info/10 text-info border-info/20',
  delete: 'bg-destructive/10 text-destructive border-destructive/20',
  approve: 'bg-success/10 text-success border-success/20',
  reject: 'bg-destructive/10 text-destructive border-destructive/20',
  export: 'bg-primary/10 text-primary border-primary/20',
  import: 'bg-primary/10 text-primary border-primary/20',
  login: 'bg-muted text-muted-foreground border-border',
  logout: 'bg-muted text-muted-foreground border-border',
  settings: 'bg-warning/10 text-warning border-warning/20',
};

export const SystemAuditLog = ({ onBack }: SystemAuditLogProps) => {
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const { logs, loading, totalCount, refetch } = useAuditLogs(filters);

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.description.toLowerCase().includes(query) ||
      log.profile?.name?.toLowerCase().includes(query) ||
      log.profile?.email?.toLowerCase().includes(query)
    );
  });

  const getActionLabel = (actionType: string) => {
    return ACTION_TYPES.find(a => a.value === actionType)?.label || actionType;
  };

  const getEntityLabel = (entityType: string) => {
    return ENTITY_TYPES.find(e => e.value === entityType)?.label || entityType;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Audit Log Sistem</h1>
          <p className="text-sm text-muted-foreground">
            Riwayat aktivitas dan perubahan dalam sistem
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Activity className="h-3 w-3" />
          {totalCount} log
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <SearchInput
              placeholder="Cari deskripsi, nama, atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="flex-1"
            />
            <div className="flex flex-wrap gap-2">
              <Select
                value={filters.actionType || 'all'}
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  actionType: value === 'all' ? undefined : value 
                }))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Aksi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Aksi</SelectItem>
                  {ACTION_TYPES.map(action => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.entityType || 'all'}
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  entityType: value === 'all' ? undefined : value 
                }))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Entitas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Entitas</SelectItem>
                  {ENTITY_TYPES.map(entity => (
                    <SelectItem key={entity.value} value={entity.value}>
                      {entity.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={refetch}
                disabled={loading}
              >
                {loading ? (
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
            Riwayat Aktivitas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">
                {searchQuery || filters.actionType || filters.entityType
                  ? 'Tidak ada log yang sesuai filter'
                  : 'Belum ada aktivitas tercatat'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredLogs.map((log, index) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors animate-slide-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {/* Action Icon */}
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 border ${ACTION_COLORS[log.action_type] || 'bg-muted border-border'}`}>
                      {ACTION_ICONS[log.action_type] || <Activity className="h-4 w-4" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-foreground">
                          {log.description}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="outline" className="text-xs gap-1">
                          {ACTION_ICONS[log.action_type]}
                          {getActionLabel(log.action_type)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs gap-1">
                          {ENTITY_ICONS[log.entity_type]}
                          {getEntityLabel(log.entity_type)}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{log.profile?.name || 'System'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
