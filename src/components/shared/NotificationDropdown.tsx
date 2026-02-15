import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';
import { useUserLoans } from '@/hooks/useUserLoans';
import { useUserSavings } from '@/hooks/useUserSavings';
import { useMemberNotifications } from '@/hooks/useMemberNotifications';
import { useAdminNotificationsData } from '@/hooks/useAdminNotificationsData';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  AlertTriangle, 
  CreditCard, 
  Wallet, 
  CheckCircle2, 
  Clock,
  BellOff,
  Check,
  Eye,
  Loader2,
  CalendarClock,
  Trash2,
  Building2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Notification {
  id: string;
  type: 'overdue' | 'unpaid' | 'underpaid' | 'info' | 'reminder' | 'admin';
  title: string;
  description: string;
  amount?: number;
  dueDate?: string;
  status: 'urgent' | 'warning' | 'info';
  source: 'calculated' | 'database' | 'admin';
  createdAt?: string;
  notificationType?: string;
}

interface NotificationDropdownProps {
  onNavigate?: (view: string) => void;
}

export const NotificationDropdown = ({ onNavigate }: NotificationDropdownProps) => {
  const { user, hasRole } = useAuth();
  const { t } = useThemeLanguage();
  const { installments } = useUserLoans();
  const { savings } = useUserSavings();
  const isAdmin = hasRole('admin');
  const { 
    notifications: memberNotifications, 
    unreadCount: memberUnreadCount,
    markAsRead: markMemberNotificationAsRead,
    markAllAsRead: markAllMemberNotificationsAsRead,
    deleteNotification: deleteMemberNotification
  } = useMemberNotifications();
  const {
    notifications: adminNotifications,
    unreadCount: adminUnreadCount,
    markAsRead: markAdminNotificationAsRead,
    markAllAsRead: markAllAdminNotificationsAsRead,
    deleteNotification: deleteAdminNotification
  } = useAdminNotificationsData();
  const [isOpen, setIsOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ open: boolean; notificationId: string | null; title: string; source: 'database' | 'admin' }>({
    open: false,
    notificationId: null,
    title: '',
    source: 'database',
  });
  const queryClient = useQueryClient();

  // Fetch read notifications from database (for calculated notifications)
  const { data: readNotifications = [] } = useQuery({
    queryKey: ['notification-reads', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error fetching notification reads:', error);
        return [];
      }
      return data.map(r => r.notification_id);
    },
    enabled: !!user?.id,
  });

  // Mutation to mark calculated notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) throw new Error('User not found');
      const { error } = await supabase
        .from('notification_reads')
        .upsert({
          user_id: user.id,
          notification_id: notificationId,
        }, { 
          onConflict: 'user_id,notification_id' 
        });
      
      if (error) throw error;
      return notificationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-reads', user?.id] });
    },
  });

  // Mutation to mark all calculated notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      if (!user?.id) throw new Error('User not found');
      const records = notificationIds.map(id => ({
        user_id: user.id,
        notification_id: id,
      }));
      
      const { error } = await supabase
        .from('notification_reads')
        .upsert(records, { onConflict: 'user_id,notification_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-reads', user?.id] });
    },
  });

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

  // Get overdue installments (with penalty applied)
  const overdueInstallments = installments.filter(
    inst => inst.status === 'overdue' || inst.status === 'partial'
  );

  // Get unpaid installments (past due but no penalty yet)
  const unpaidInstallments = installments.filter(
    inst => inst.status === 'unpaid'
  );

  // Build notifications list from calculated sources
  const notifications: Notification[] = [];

  // Add overdue installment notifications
  overdueInstallments.forEach((inst) => {
    const overdueDate = new Date(inst.dueDate);
    const monthsOverdue = Math.floor((today.getTime() - overdueDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    notifications.push({
      id: `overdue-${inst.id}`,
      type: 'overdue',
      title: t(`Angsuran ke-${inst.installmentNumber} Menunggak`, `Installment #${inst.installmentNumber} Overdue`),
      description: inst.status === 'partial' 
        ? t(
            `Sisa ${formatCurrency(inst.totalAmount - inst.paidAmount)}`,
            `Remaining ${formatCurrency(inst.totalAmount - inst.paidAmount)}`
          )
        : t(
            `Jatuh tempo ${formatDate(inst.dueDate)}`,
            `Due ${formatDate(inst.dueDate)}`
          ),
      amount: inst.totalAmount + (inst.penaltyAmount || 0),
      dueDate: inst.dueDate,
      status: monthsOverdue >= 2 ? 'urgent' : 'warning',
      source: 'calculated',
    });
  });

  // Add unpaid installment notifications (past due but no penalty yet)
  unpaidInstallments.forEach((inst) => {
    notifications.push({
      id: `unpaid-${inst.id}`,
      type: 'unpaid',
      title: t(`Angsuran ke-${inst.installmentNumber} Belum Dibayar`, `Installment #${inst.installmentNumber} Unpaid`),
      description: t(
        `Jatuh tempo ${formatDate(inst.dueDate)} - Segera bayar sebelum denda`,
        `Due ${formatDate(inst.dueDate)} - Pay before penalty`
      ),
      amount: inst.totalAmount - inst.paidAmount,
      dueDate: inst.dueDate,
      status: 'warning',
      source: 'calculated',
    });
  });

  if (isUnderpaid) {
    notifications.push({
      id: 'underpaid-savings',
      type: 'underpaid',
      title: t('Simpanan Wajib Kurang', 'Mandatory Savings Short'),
      description: t(
        `Kurang ${formatCurrency(underpaidAmount)}`,
        `Short by ${formatCurrency(underpaidAmount)}`
      ),
      amount: underpaidAmount,
      status: 'warning',
      source: 'calculated',
    });
  }

  // Add notifications from member_notifications table (from edge functions)
  memberNotifications.forEach((notif) => {
    // Determine notification type and status based on notification_type
    let type: Notification['type'] = 'info';
    let status: Notification['status'] = 'info';
    
    if (notif.notificationType === 'installment_reminder') {
      type = 'reminder';
      const daysUntilDue = notif.metadata?.days_until_due as number | undefined;
      if (daysUntilDue !== undefined) {
        if (daysUntilDue <= 1) {
          status = 'urgent';
        } else if (daysUntilDue <= 3) {
          status = 'warning';
        } else {
          status = 'info';
        }
      }
    } else if (notif.notificationType === 'savings_reminder') {
      type = 'underpaid';
      status = 'warning';
    } else if (notif.notificationType === 'overdue_alert') {
      type = 'overdue';
      status = 'urgent';
    }
    
    notifications.push({
      id: notif.id,
      type,
      title: notif.title,
      description: notif.message,
      amount: notif.metadata?.amount as number | undefined,
      dueDate: notif.metadata?.due_date as string | undefined,
      status,
      source: 'database',
      createdAt: notif.createdAt,
    });
  });

  // Add admin notifications if user is admin
  if (isAdmin) {
    adminNotifications.forEach((notif) => {
      let status: Notification['status'] = 'info';
      if (notif.notification_type === 'severe_overdue_alert') {
        status = 'urgent';
      } else if (notif.notification_type === 'reconciliation_reminder' || notif.notification_type === 'member_resignation') {
        status = 'warning';
      }
      
      notifications.push({
        id: notif.id,
        type: 'admin',
        title: notif.title,
        description: notif.message,
        status,
        source: 'admin',
        createdAt: notif.created_at,
        notificationType: notif.notification_type,
      });
    });
  }

  // Sort notifications: unread first, then by date
  notifications.sort((a, b) => {
    const aRead = a.source === 'database' 
      ? memberNotifications.find(n => n.id === a.id)?.isRead 
      : a.source === 'admin'
      ? adminNotifications.find(n => n.id === a.id)?.is_read
      : readNotifications.includes(a.id);
    const bRead = b.source === 'database'
      ? memberNotifications.find(n => n.id === b.id)?.isRead
      : b.source === 'admin'
      ? adminNotifications.find(n => n.id === b.id)?.is_read
      : readNotifications.includes(b.id);
    
    if (aRead !== bRead) return aRead ? 1 : -1;
    
    // Sort by date if available
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  const calculatedUnreadCount = notifications
    .filter(n => n.source === 'calculated' && !readNotifications.includes(n.id))
    .length;
  const unreadCount = calculatedUnreadCount + memberUnreadCount + (isAdmin ? adminUnreadCount : 0);

  const markAsRead = (notification: Notification) => {
    if (notification.source === 'database') {
      markMemberNotificationAsRead(notification.id);
    } else if (notification.source === 'admin') {
      markAdminNotificationAsRead(notification.id);
    } else if (!readNotifications.includes(notification.id)) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleMarkAllAsRead = () => {
    // Mark calculated notifications as read
    const calculatedUnreadIds = notifications
      .filter(n => n.source === 'calculated' && !readNotifications.includes(n.id))
      .map(n => n.id);
    if (calculatedUnreadIds.length > 0) {
      markAllAsReadMutation.mutate(calculatedUnreadIds);
    }
    
    // Mark database notifications as read
    markAllMemberNotificationsAsRead();
    
    // Mark admin notifications as read
    if (isAdmin) {
      markAllAdminNotificationsAsRead();
    }
  };

  const isNotificationRead = (notification: Notification) => {
    if (notification.source === 'database') {
      return memberNotifications.find(n => n.id === notification.id)?.isRead ?? false;
    }
    if (notification.source === 'admin') {
      return adminNotifications.find(n => n.id === notification.id)?.is_read ?? false;
    }
    return readNotifications.includes(notification.id);
  };

  const getTypeIcon = (type: string, notificationType?: string) => {
    // Admin notification icons
    if (type === 'admin' && notificationType) {
      switch (notificationType) {
        case 'reconciliation_reminder':
          return <Building2 className="h-4 w-4" />;
        case 'severe_overdue_alert':
          return <AlertCircle className="h-4 w-4" />;
        case 'loan_restructure':
          return <RefreshCw className="h-4 w-4" />;
        case 'member_resignation':
          return <AlertTriangle className="h-4 w-4" />;
        default:
          return <Bell className="h-4 w-4" />;
      }
    }
    // Member notification icons
    switch (type) {
      case 'overdue':
        return <CreditCard className="h-4 w-4" />;
      case 'underpaid':
        return <Wallet className="h-4 w-4" />;
      case 'reminder':
        return <CalendarClock className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`relative h-10 w-10 rounded-full transition-all duration-300 hover:bg-primary/10 ${
            unreadCount > 0 ? 'animate-none' : ''
          }`}
        >
          {/* Bell icon with ring animation when there are unread notifications */}
          <Bell className={`h-5 w-5 transition-transform ${
            unreadCount > 0 ? 'animate-bell-ring text-primary' : ''
          }`} />
          
          {/* Notification badge with multiple animation layers */}
          {unreadCount > 0 && (
            <>
              {/* Ping effect - outer ring that expands and fades */}
              <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive animate-badge-ping" />
              
              {/* Glow pulse effect */}
              <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive/50 animate-glow-pulse" />
              
              {/* Main badge with bounce animation */}
              <Badge 
                variant="destructive" 
                className="absolute -top-0.5 -right-0.5 h-5 min-w-5 p-0 flex items-center justify-center text-[10px] font-bold shadow-lg animate-badge-bounce border-2 border-background"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-80 bg-card border-border z-50"
        sideOffset={8}
      >
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="font-semibold">{t('Notifikasi', 'Notifications')}</span>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs gap-1"
              disabled={markAllAsReadMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleMarkAllAsRead();
              }}
            >
              {markAllAsReadMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              {t('Tandai Semua Dibaca', 'Mark All Read')}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BellOff className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              {t('Tidak Ada Notifikasi', 'No Notifications')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('Semua pembayaran Anda sudah lancar', 'All your payments are up to date')}
            </p>
            <CheckCircle2 className="mt-2 h-5 w-5 text-emerald-500" />
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1 p-1">
              {notifications.map((notification) => {
                const read = isNotificationRead(notification);
                return (
                  <div
                    key={notification.id}
                    className={`relative flex items-start gap-3 rounded-lg p-3 transition-colors cursor-pointer hover:bg-muted/50 ${
                      read ? 'opacity-60' : 'bg-muted/30'
                    } ${
                      notification.status === 'urgent' && !read
                        ? 'border-l-2 border-destructive'
                        : notification.status === 'warning' && !read
                        ? 'border-l-2 border-amber-500'
                        : ''
                    }`}
                    onClick={() => {
                      markAsRead(notification);
                      if (onNavigate) {
                        onNavigate('notifications');
                        setIsOpen(false);
                      }
                    }}
                  >
                    {/* Status indicator */}
                    {!read && (
                      <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary animate-pulse" />
                    )}
                    
                    {/* Icon */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      notification.status === 'urgent' 
                        ? 'bg-destructive/10 text-destructive' 
                        : notification.status === 'warning'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {getTypeIcon(notification.type, notification.notificationType)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${read ? 'font-normal' : 'font-semibold'}`}>
                          {notification.title}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {notification.description}
                      </p>
                      {notification.amount && (
                        <p className={`text-sm font-bold mt-1 ${
                          notification.status === 'urgent' 
                            ? 'text-destructive' 
                            : notification.status === 'warning'
                            ? 'text-amber-600'
                            : 'text-foreground'
                        }`}>
                          {formatCurrency(notification.amount)}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Mark as read button */}
                      {!read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title={t('Tandai Dibaca', 'Mark as Read')}
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}
                      
                      {/* Delete button - only for database notifications */}
                      {(notification.source === 'database' || notification.source === 'admin') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title={t('Hapus Notifikasi', 'Delete Notification')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmation({
                              open: true,
                              notificationId: notification.id,
                              title: notification.title,
                              source: notification.source as 'database' | 'admin',
                            });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
        
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs"
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('notifications');
                    setIsOpen(false);
                  }
                }}
              >
                {t('Lihat Semua Notifikasi', 'View All Notifications')}
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>

      {/* Delete confirmation dialog */}
      <AlertDialog 
        open={deleteConfirmation.open} 
        onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Hapus Notifikasi?', 'Delete Notification?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `Apakah Anda yakin ingin menghapus notifikasi "${deleteConfirmation.title}"? Tindakan ini tidak dapat dibatalkan.`,
                `Are you sure you want to delete the notification "${deleteConfirmation.title}"? This action cannot be undone.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Batal', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmation.notificationId) {
                  if (deleteConfirmation.source === 'admin') {
                    deleteAdminNotification(deleteConfirmation.notificationId);
                  } else {
                    deleteMemberNotification(deleteConfirmation.notificationId);
                  }
                }
                setDeleteConfirmation({ open: false, notificationId: null, title: '', source: 'database' });
              }}
            >
              {t('Hapus', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DropdownMenu>
  );
};
