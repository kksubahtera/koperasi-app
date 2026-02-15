import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ClipboardCheck, History } from 'lucide-react';
import { VerificationList } from './VerificationList';
import { TransactionHistory } from './TransactionHistory';

interface TransactionWithProfile {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  date: string | null;
  status: string;
  payment_method: string;
  account_holder_name: string | null;
  notes: string | null;
  created_at: string | null;
  approved_at?: string | null;
  installment_id: string | null;
  profiles: {
    name: string;
    member_number: string | null;
  } | null;
}

interface TransactionManagementProps {
  transactions: TransactionWithProfile[];
  isLoading?: boolean;
  isFetchingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => Promise<void>;
}

type TabType = 'verification' | 'history';

const tabs: { value: TabType; icon: typeof ClipboardCheck; label: string; tooltip: string }[] = [
  { value: 'verification', icon: ClipboardCheck, label: 'Verifikasi', tooltip: 'Verifikasi Transaksi Pending' },
  { value: 'history', icon: History, label: 'Riwayat', tooltip: 'Riwayat Semua Transaksi' },
];

export const TransactionManagement = ({
  transactions,
  isLoading,
  isFetchingMore,
  hasMore,
  onLoadMore,
  onRefresh,
}: TransactionManagementProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('verification');

  // Count pending transactions for badge
  const pendingCount = transactions.filter(t => t.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header with Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manajemen Transaksi</h1>
        <p className="mt-1 text-muted-foreground">Verifikasi dan kelola semua transaksi anggota</p>
      </div>

      {/* Tab Navigation Pills */}
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <TooltipProvider delayDuration={300}>
          <div className="inline-flex w-auto gap-1 bg-muted/50 p-1.5 rounded-xl border border-border/50">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.value;
              return (
                <Tooltip key={tab.value}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActiveTab(tab.value)}
                      className={`
                        relative gap-2 px-4 py-2 h-auto text-sm font-medium
                        transition-all duration-200 rounded-lg
                        ${isActive 
                          ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20' 
                          : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                        }
                      `}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                      {tab.value === 'verification' && pendingCount > 0 && (
                        <span className={`
                          ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full
                          ${isActive 
                            ? 'bg-primary-foreground/20 text-primary-foreground' 
                            : 'bg-warning text-warning-foreground'
                          }
                        `}>
                          {pendingCount}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{tab.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>

      {/* Tab Content */}
      {activeTab === 'verification' && (
        <div className="animate-fade-in">
          <VerificationList
            transactions={transactions}
            isLoading={isLoading}
            isFetchingMore={isFetchingMore}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            onRefresh={onRefresh}
          />
        </div>
      )}
      
      {activeTab === 'history' && (
        <div className="animate-fade-in">
          <TransactionHistory
            transactions={transactions}
            isLoading={isLoading}
            isFetchingMore={isFetchingMore}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </div>
  );
};
