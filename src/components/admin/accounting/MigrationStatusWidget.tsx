import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/mockData';
import { useJournalTemplates } from '@/hooks/useJournalTemplates';
import {
  CheckCircle2,
  AlertTriangle,
  Users,
  Wallet,
  CreditCard,
  FileEdit,
  ArrowRight,
  Loader2,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MigrationStatus {
  totalMembers: number;
  claimedMembers: number;
  unclaimedMembers: number;
  totalSavings: number;
  coaSavings: number;
  savingsDiff: number;
  totalLoans: number;
  coaLoans: number;
  loansDiff: number;
  configuredTemplates: number;
  totalTemplates: number;
}

interface MigrationStatusWidgetProps {
  onNavigateToJournalTemplates?: () => void;
  onNavigateToReconciliation?: () => void;
}

export const MigrationStatusWidget = ({
  onNavigateToJournalTemplates,
  onNavigateToReconciliation
}: MigrationStatusWidgetProps) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const { templates } = useJournalTemplates();

  useEffect(() => {
    const fetchStatus = async () => {
      setLoading(true);
      try {
        // Fetch member claim status
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, is_active, approval_status')
          .eq('approval_status', 'approved');

        const { data: authUsers } = await supabase
          .from('profiles')
          .select('user_id')
          .not('phone', 'is', null);

        // Fetch savings totals
        const { data: savings } = await supabase
          .from('savings_summary')
          .select('simpanan_pokok, simpanan_wajib, simpanan_sukarela');

        // Fetch COA balances
        const { data: coa } = await supabase
          .from('chart_of_accounts')
          .select('account_code, balance')
          .in('account_code', ['1-2000', '2-1010', '2-1020', '2-1030']);

        // Fetch loans
        const { data: loans } = await supabase
          .from('loans')
          .select('remaining_principal, status')
          .eq('status', 'active');

        // Calculate totals
        const totalMembers = profiles?.length || 0;
        const claimedMembers = authUsers?.length || 0;
        
        const totalSavings = savings?.reduce((sum, s) => 
          sum + (s.simpanan_pokok || 0) + (s.simpanan_wajib || 0) + (s.simpanan_sukarela || 0), 0
        ) || 0;

        const coaMap = new Map(coa?.map(c => [c.account_code, c.balance || 0]));
        const coaSavings = 
          (coaMap.get('2-1010') || 0) + 
          (coaMap.get('2-1020') || 0) + 
          (coaMap.get('2-1030') || 0);

        const totalLoans = loans?.reduce((sum, l) => sum + (l.remaining_principal || 0), 0) || 0;
        const coaLoans = coaMap.get('1-2000') || 0;

        // Count configured templates
        const configuredTemplates = templates.filter(t => 
          t.isActive && t.lines.every(l => l.accountId)
        ).length;

        setStatus({
          totalMembers,
          claimedMembers,
          unclaimedMembers: totalMembers - claimedMembers,
          totalSavings,
          coaSavings,
          savingsDiff: totalSavings - coaSavings,
          totalLoans,
          coaLoans,
          loansDiff: totalLoans - coaLoans,
          configuredTemplates,
          totalTemplates: templates.filter(t => t.isActive).length,
        });
      } catch (error) {
        console.error('Error fetching migration status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [templates]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Status Migrasi
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  const claimProgress = status.totalMembers > 0 
    ? (status.claimedMembers / status.totalMembers) * 100 
    : 0;
  
  const templateProgress = status.totalTemplates > 0 
    ? (status.configuredTemplates / status.totalTemplates) * 100 
    : 0;

  const isReconciled = Math.abs(status.savingsDiff) < 1 && Math.abs(status.loansDiff) < 1;
  const isTemplateComplete = status.configuredTemplates === status.totalTemplates;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Status Migrasi
          </CardTitle>
          <Badge variant={isReconciled && isTemplateComplete ? 'default' : 'secondary'}>
            {isReconciled && isTemplateComplete ? 'Siap Operasi' : 'Perlu Perhatian'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Claim Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Klaim Akun
            </span>
            <span className="text-muted-foreground">
              {status.claimedMembers} / {status.totalMembers}
            </span>
          </div>
          <Progress value={claimProgress} className="h-2" />
          {status.unclaimedMembers > 0 && (
            <p className="text-xs text-amber-600">
              {status.unclaimedMembers} anggota belum klaim akun
            </p>
          )}
        </div>

        {/* Reconciliation Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Rekonsiliasi Data
            </span>
            {isReconciled ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
          </div>
          {!isReconciled && (
            <div className="text-xs space-y-1">
              {Math.abs(status.savingsDiff) > 1 && (
                <p className="text-amber-600">
                  Selisih Simpanan: {formatCurrency(status.savingsDiff)}
                </p>
              )}
              {Math.abs(status.loansDiff) > 1 && (
                <p className="text-amber-600">
                  Selisih Pinjaman: {formatCurrency(status.loansDiff)}
                </p>
              )}
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-xs"
                onClick={onNavigateToReconciliation}
              >
                Lihat Detail <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </div>

        {/* Template Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <FileEdit className="h-4 w-4 text-muted-foreground" />
              Template Jurnal
            </span>
            <span className="text-muted-foreground">
              {status.configuredTemplates} / {status.totalTemplates}
            </span>
          </div>
          <Progress value={templateProgress} className="h-2" />
          {!isTemplateComplete && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-amber-600">
                {status.totalTemplates - status.configuredTemplates} template belum dikonfigurasi
              </p>
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-xs"
                onClick={onNavigateToJournalTemplates}
              >
                Konfigurasi <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
