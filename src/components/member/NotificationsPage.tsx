import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useUserLoans } from '@/hooks/useUserLoans';
import { useUserSavings } from '@/hooks/useUserSavings';
import { useInterestNotifications } from '@/hooks/useInterestNotifications';
import { useMemberNotifications } from '@/hooks/useMemberNotifications';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { 
  Bell, 
  CreditCard, 
  Wallet, 
  CheckCircle2, 
  ArrowLeft,
  BellOff,
  Coins,
  Check,
  Store,
  Trash2,
  Gift,
  RefreshCcw,
  CalendarClock,
  CheckCheck,
  X,
} from 'lucide-react';

import { SwipeableNotificationItem } from './SwipeableNotificationItem';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

interface NotificationsPageProps {
  onBack?: () => void;
  onNavigate?: (view: string) => void;
}

interface Notification {
  id: string;
  type: 'overdue' | 'unpaid' | 'underpaid' | 'info' | 'interest' | 'business_transaction' | 'savings' | 'loan' | 'loan_adjustment' | 'loan_restructure' | 'reminder';
  title: string;
  description: string;
  amount?: number;
  dueDate?: string;
  status: 'urgent' | 'warning' | 'info' | 'success';
  action?: string;
  actionView?: string;
  isRead?: boolean;
  createdAt?: string;
  onMarkAsRead?: () => void;
  onDelete?: () => void;
}

type FilterType = 'all' | 'urgent' | 'warning' | 'success' | 'info' | 'unread';

export const NotificationsPage = ({ onBack, onNavigate }: NotificationsPageProps) => {
  const { user } = useAuth();
  const { t } = useThemeLanguage();
  const { installments } = useUserLoans();
  const { savings } = useUserSavings();
  const { 
    notifications: interestNotifications, 
    unreadCount: unreadInterestCount,
    isLoading: isLoadingInterest,
    markAsRead: markInterestAsRead,
    markAllAsRead: markAllInterestAsRead,
    refetch: refetchInterest
  } = useInterestNotifications();
  const {
    notifications: memberNotifications,
    unreadCount: unreadMemberCount,
    loading: isLoadingMember,
    markAsRead: markMemberAsRead,
    markAllAsRead: markAllMemberAsRead,
    deleteNotification: deleteMemberNotification,
    refetch: refetchMember
  } = useMemberNotifications();

  // Combined loading state to prevent lag
  const isLoading = isLoadingInterest || isLoadingMember;

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchInterest(), refetchMember()]);
    toast.success(t('Notifikasi diperbarui', 'Notifications updated'));
  }, [refetchInterest, refetchMember, t]);

  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ open: boolean; id: string | null; title: string }>({
    open: false,
    id: null,
    title: '',
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  if (!user) return null;

  // Calculate underpaid savings
  const joinDate = new Date(user.joinDate);
  const today = new Date();
  const monthsJoined = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                       (today.getMonth() - joinDate.getMonth()) + 1;
  const expectedMonthlySaving = 50000;
  const expectedSimpananWajib = monthsJoined * expectedMonthlySaving;
  const underpaidAmount = expectedSimpananWajib - savings.simpananWajib;
  const isUnderpaid = underpaidAmount > 0;

  // Get overdue and unpaid installments
  const overdueInstallments = installments.filter(
    inst => inst.status === 'overdue' || inst.status === 'partial'
  );
  const unpaidInstallments = installments.filter(
    inst => inst.status === 'unpaid'
  );

  // Build notifications list
  const allNotifications: Notification[] = useMemo(() => {
    const notifications: Notification[] = [];

    overdueInstallments.forEach((inst) => {
      const overdueDate = new Date(inst.dueDate);
      const monthsOverdue = Math.floor((today.getTime() - overdueDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      
      notifications.push({
        id: `overdue-${inst.id}`,
        type: 'overdue',
        title: t(`Angsuran ke-${inst.installmentNumber} Menunggak`, `Installment #${inst.installmentNumber} Overdue`),
        description: inst.status === 'partial' 
          ? t(`Sisa ${formatCurrency(inst.totalAmount - inst.paidAmount)}`, `Remaining ${formatCurrency(inst.totalAmount - inst.paidAmount)}`)
          : t(`Terlambat ${monthsOverdue} bulan`, `${monthsOverdue} months late`),
        amount: inst.totalAmount + (inst.penaltyAmount || 0),
        dueDate: inst.dueDate,
        status: monthsOverdue >= 2 ? 'urgent' : 'warning',
        action: t('Bayar', 'Pay'),
        actionView: 'savings',
        createdAt: inst.dueDate,
      });
    });

    unpaidInstallments.forEach((inst) => {
      notifications.push({
        id: `unpaid-${inst.id}`,
        type: 'unpaid',
        title: t(`Angsuran ke-${inst.installmentNumber}`, `Installment #${inst.installmentNumber}`),
        description: t(`Jatuh tempo ${formatDate(inst.dueDate)}`, `Due ${formatDate(inst.dueDate)}`),
        amount: inst.totalAmount - inst.paidAmount,
        dueDate: inst.dueDate,
        status: 'warning',
        action: t('Bayar', 'Pay'),
        actionView: 'savings',
        createdAt: inst.dueDate,
      });
    });

    if (isUnderpaid) {
      notifications.push({
        id: 'underpaid-savings',
        type: 'underpaid',
        title: t('Simpanan Wajib Kurang', 'Mandatory Savings Short'),
        description: t(`Kurang ${formatCurrency(underpaidAmount)}`, `Short ${formatCurrency(underpaidAmount)}`),
        amount: underpaidAmount,
        status: 'warning',
        action: t('Setor', 'Deposit'),
        actionView: 'savings',
        createdAt: new Date().toISOString(),
      });
    }

    interestNotifications.forEach((notif) => {
      notifications.push({
        id: `interest-${notif.id}`,
        type: 'interest',
        title: t(`Bunga ${notif.period_name}`, `Interest ${notif.period_name}`),
        description: t(`${notif.interest_rate}% dari ${formatCurrency(notif.eligible_balance)}`, `${notif.interest_rate}% of ${formatCurrency(notif.eligible_balance)}`),
        amount: notif.interest_amount,
        status: 'success',
        isRead: notif.is_read,
        createdAt: notif.created_at,
        onMarkAsRead: () => markInterestAsRead(notif.id),
      });
    });

    memberNotifications.forEach((notif) => {
      let actionView = 'business-transactions';
      let action = t('Lihat', 'View');
      let status: 'info' | 'warning' | 'success' | 'urgent' = 'info';
      let notifType: Notification['type'] = 'business_transaction';

      if (notif.notificationType === 'savings_requirement_reminder') {
        actionView = 'savings';
        action = t('Setor', 'Deposit');
        status = 'warning';
        notifType = 'savings';
      } else if (notif.notificationType === 'early_payoff_approved' || notif.notificationType === 'transaction_approved') {
        actionView = 'loans';
        action = t('Lihat', 'View');
        status = 'success';
        notifType = 'loan';
      } else if (notif.notificationType === 'early_payoff_rejected' || notif.notificationType === 'transaction_rejected') {
        actionView = 'loans';
        action = t('Lihat', 'View');
        status = 'urgent';
        notifType = 'loan';
      } else if (notif.notificationType === 'loan_overpayment' || notif.notificationType === 'loan_overpayment_refund') {
        actionView = 'loans';
        status = 'success';
        notifType = 'loan';
      } else if (notif.notificationType === 'loan_adjustment') {
        actionView = 'loans';
        status = 'success';
        notifType = 'loan_adjustment';
      } else if (notif.notificationType === 'loan_restructure') {
        actionView = 'loans';
        status = 'info';
        notifType = 'loan_restructure';
      } else if (notif.notificationType === 'installment_reminder') {
        actionView = 'loans';
        action = t('Bayar', 'Pay');
        status = 'warning';
        notifType = 'reminder';
      } else if (notif.notificationType === 'overdue_alert') {
        actionView = 'loans';
        action = t('Bayar', 'Pay');
        status = 'urgent';
        notifType = 'overdue';
      }

      notifications.push({
        id: `member-${notif.id}`,
        type: notifType,
        title: notif.title,
        description: notif.message,
        amount: notif.metadata?.amount as number | undefined,
        status: status,
        isRead: notif.isRead,
        createdAt: notif.createdAt,
        actionView: actionView,
        action: action,
        onMarkAsRead: () => markMemberAsRead(notif.id),
        onDelete: () => {
          setDeleteConfirmation({
            open: true,
            id: notif.id,
            title: notif.title,
          });
        },
      });
    });

    // Sort by newest first
    return notifications.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }, [overdueInstallments, unpaidInstallments, isUnderpaid, underpaidAmount, interestNotifications, memberNotifications, t, today, markInterestAsRead, markMemberAsRead]);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let result = [...allNotifications];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(n => 
        n.title.toLowerCase().includes(query) ||
        n.description.toLowerCase().includes(query)
      );
    }

    if (filterType !== 'all') {
      if (filterType === 'unread') {
        result = result.filter(n => !n.isRead);
      } else {
        result = result.filter(n => n.status === filterType);
      }
    }

    return result;
  }, [allNotifications, searchQuery, filterType]);

  const totalUnread = unreadInterestCount + unreadMemberCount;

  const handleMarkAllAsRead = () => {
    markAllInterestAsRead();
    markAllMemberAsRead();
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmation.id) {
      const notificationId = deleteConfirmation.id;
      // Add to deleting set to trigger fade-out animation
      setDeletingIds(prev => new Set(prev).add(`member-${notificationId}`));
      // Wait for animation to complete before actually deleting
      setTimeout(() => {
        deleteMemberNotification(notificationId);
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.delete(`member-${notificationId}`);
          return next;
        });
      }, 300);
    }
    setDeleteConfirmation({ open: false, id: null, title: '' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'urgent': return 'text-destructive bg-destructive/10';
      case 'warning': return 'text-amber-600 bg-amber-500/10';
      case 'success': return 'text-emerald-600 bg-emerald-500/10';
      default: return 'text-primary bg-primary/10';
    }
  };

  const getStatusBorder = (status: string) => {
    switch (status) {
      case 'urgent': return 'border-l-destructive';
      case 'warning': return 'border-l-amber-500';
      case 'success': return 'border-l-emerald-500';
      default: return 'border-l-primary';
    }
  };

  const getTypeIcon = (type: string, size = 'h-4 w-4') => {
    const iconClass = size;
    switch (type) {
      case 'overdue': return <CreditCard className={iconClass} />;
      case 'underpaid': return <Wallet className={iconClass} />;
      case 'interest': return <Coins className={iconClass} />;
      case 'business_transaction': return <Store className={iconClass} />;
      case 'loan_adjustment': return <Gift className={iconClass} />;
      case 'loan_restructure': return <RefreshCcw className={iconClass} />;
      case 'reminder': return <CalendarClock className={iconClass} />;
      default: return <Bell className={iconClass} />;
    }
  };

  const getRelativeTime = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('Baru saja', 'Just now');
    if (diffMins < 60) return t(`${diffMins} menit lalu`, `${diffMins}m ago`);
    if (diffHours < 24) return t(`${diffHours} jam lalu`, `${diffHours}h ago`);
    if (diffDays < 7) return t(`${diffDays} hari lalu`, `${diffDays}d ago`);
    return formatDate(dateString);
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Compact Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-semibold truncate">
                {t('Notifikasi', 'Notifications')}
                {allNotifications.length > 0 && (
                  <span className="text-muted-foreground font-normal ml-1.5">
                    ({allNotifications.length})
                  </span>
                )}
              </h1>
            </div>
          </div>
          
          {totalUnread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-8 px-2 text-xs shrink-0"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">{t('Tandai dibaca', 'Mark read')}</span>
            </Button>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1">
            <SearchInput
              placeholder={t('Cari...', 'Search...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm"
              iconClassName="h-3.5 w-3.5 left-2.5"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 z-20"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger className="h-8 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all" className="text-xs">{t('Semua', 'All')}</SelectItem>
              <SelectItem value="unread" className="text-xs">{t('Belum dibaca', 'Unread')}</SelectItem>
              <SelectItem value="urgent" className="text-xs">{t('Mendesak', 'Urgent')}</SelectItem>
              <SelectItem value="warning" className="text-xs">{t('Perhatian', 'Warning')}</SelectItem>
              <SelectItem value="success" className="text-xs">{t('Berhasil', 'Success')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notifications List */}
      <PullToRefresh onRefresh={handleRefresh} className="flex-1">
        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            <p className="mt-3 text-sm">{t('Memuat...', 'Loading...')}</p>
          </div>
        ) : allNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="mt-3 text-sm font-medium">{t('Semua Baik!', 'All Good!')}</p>
            <p className="mt-1 text-xs text-muted-foreground text-center">
              {t('Tidak ada pemberitahuan', 'No notifications')}
            </p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BellOff className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium">{t('Tidak Ditemukan', 'Not Found')}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setSearchQuery(''); setFilterType('all'); }} 
              className="mt-2 text-xs"
            >
              {t('Reset filter', 'Reset filter')}
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {filteredNotifications.map((notification) => {
              const isDeleting = deletingIds.has(notification.id);
              
              const notificationContent = (
                <div 
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-l-2 ${getStatusBorder(notification.status)} ${notification.isRead ? 'opacity-60' : ''}`}
                >
                  {/* Icon */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${getStatusColor(notification.status)}`}>
                    {getTypeIcon(notification.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate flex items-center gap-1.5">
                          {notification.title}
                          {!notification.isRead && (
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.description}
                        </p>
                      </div>
                      {notification.amount && (
                        <span className={`text-xs font-semibold shrink-0 ${
                          notification.status === 'success' ? 'text-emerald-600' : 
                          notification.status === 'urgent' ? 'text-destructive' : 
                          notification.status === 'warning' ? 'text-amber-600' : 'text-foreground'
                        }`}>
                          {notification.status === 'success' ? '+' : ''}{formatCurrency(notification.amount)}
                        </span>
                      )}
                    </div>
                    
                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {getRelativeTime(notification.createdAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        {notification.action && onNavigate && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => onNavigate(notification.actionView || 'dashboard')}
                            className="h-6 px-2 text-[10px] text-primary"
                          >
                            {notification.action}
                          </Button>
                        )}
                        {notification.onMarkAsRead && !notification.isRead && (
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={notification.onMarkAsRead}
                            className="h-6 w-6"
                            title={t('Tandai dibaca', 'Mark read')}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        {notification.onDelete && (
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={notification.onDelete}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            title={t('Hapus', 'Delete')}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );

              // Wrap with swipeable on mobile for member notifications that can be deleted/marked
              if (isMobile && notification.onDelete) {
                return (
                  <SwipeableNotificationItem
                    key={notification.id}
                    isDeleting={isDeleting}
                    onSwipeLeft={() => {
                      if (notification.onDelete) {
                        notification.onDelete();
                      }
                    }}
                    onSwipeRight={notification.onMarkAsRead && !notification.isRead ? () => {
                      if (notification.onMarkAsRead) {
                        notification.onMarkAsRead();
                        toast.success(t('Ditandai dibaca', 'Marked as read'));
                      }
                    } : undefined}
                    leftAction="delete"
                    rightAction="mark-read"
                  >
                    {notificationContent}
                  </SwipeableNotificationItem>
                );
              }

              // Desktop: wrap with animated container
              return (
                <div 
                  key={notification.id}
                  className={`transition-all duration-300 ease-out overflow-hidden ${
                    isDeleting ? 'opacity-0 max-h-0' : 'opacity-100 max-h-[500px]'
                  }`}
                >
                  {notificationContent}
                </div>
              );
            })}
          </div>
        )}
      </PullToRefresh>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteConfirmation.open} 
        onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">{t('Hapus Notifikasi?', 'Delete?')}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {t('Tindakan ini tidak dapat dibatalkan.', 'This cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-9">{t('Batal', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="h-9 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              {t('Hapus', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
