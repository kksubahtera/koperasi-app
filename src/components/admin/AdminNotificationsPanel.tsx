import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, CheckCircle2, Trash2, RefreshCw, AlertTriangle, 
  Clock, Building2, Loader2, CheckCheck, X, AlertCircle, UserPlus, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminNotificationsData, AdminNotification } from '@/hooks/useAdminNotificationsData';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'reconciliation_reminder':
      return <Building2 className="h-5 w-5 text-amber-600" />;
    case 'monthly_closing':
      return <Clock className="h-5 w-5 text-blue-600" />;
    case 'severe_overdue_alert':
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    case 'loan_restructure':
      return <RefreshCw className="h-5 w-5 text-primary" />;
    case 'member_resignation':
      return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    case 'new_registration':
      return <UserPlus className="h-5 w-5 text-emerald-600" />;
    case 'resignation_request':
      return <AlertTriangle className="h-5 w-5 text-orange-600" />;
    case 'arrears_cleared_shu_ready':
      return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
    default:
      return <Bell className="h-5 w-5 text-primary" />;
  }
};

const getNotificationBadge = (type: string) => {
  switch (type) {
    case 'reconciliation_reminder':
      return <Badge variant="outline" className="text-amber-600 border-amber-300">Reconciliation</Badge>;
    case 'monthly_closing':
      return <Badge variant="outline" className="text-blue-600 border-blue-300">Book Closing</Badge>;
    case 'severe_overdue_alert':
      return <Badge variant="destructive">Critical Overdue</Badge>;
    case 'loan_restructure':
      return <Badge variant="outline" className="text-primary border-primary/30">Restructuring</Badge>;
    case 'member_resignation':
      return <Badge variant="outline" className="text-amber-600 border-amber-300">Resignation</Badge>;
    case 'new_registration':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200">New Registration</Badge>;
    case 'resignation_request':
      return <Badge variant="outline" className="text-orange-600 border-orange-300">Exit Request</Badge>;
    case 'arrears_cleared_shu_ready':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200">Dividend Ready</Badge>;
    default:
      return <Badge variant="outline">General</Badge>;
  }
};

interface NotificationItemProps {
  notification: AdminNotification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate?: (path: string) => void;
}

const NotificationItem = ({ notification, onMarkAsRead, onDelete, onNavigate }: NotificationItemProps) => {
  const getActionButton = () => {
    if (notification.notification_type === 'new_registration' || notification.notification_type === 'resignation_request') {
      return (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            if (!notification.is_read) {
              onMarkAsRead(notification.id);
            }
            onNavigate?.('/admin/registrations');
          }}
          title="View Request"
        >
          <ExternalLink className="h-4 w-4 text-primary" />
        </Button>
      );
    }
    if (notification.notification_type === 'arrears_cleared_shu_ready') {
      return (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            if (!notification.is_read) {
              onMarkAsRead(notification.id);
            }
            // Navigate to accounting with SHU withheld tab
            window.dispatchEvent(new CustomEvent('navigate-to-shu-withheld'));
          }}
          title="View Withheld Dividend"
        >
          <ExternalLink className="h-4 w-4 text-primary" />
        </Button>
      );
    }
    return null;
  };

  return (
    <div 
      className={cn(
        "p-4 border-b last:border-b-0 transition-colors",
        notification.is_read ? "bg-background" : "bg-amber-50/50 dark:bg-amber-900/10"
      )}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-1">
          {getNotificationIcon(notification.notification_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className={cn(
                  "font-medium text-sm",
                  !notification.is_read && "font-semibold"
                )}>
                  {notification.title}
                </h4>
                {getNotificationBadge(notification.notification_type)}
                {!notification.is_read && (
                  <span className="inline-block w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {notification.message}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {formatDistanceToNow(parseISO(notification.created_at), { 
                  addSuffix: true, 
                  locale: id 
                })}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {getActionButton()}
              {!notification.is_read && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onMarkAsRead(notification.id)}
                  title="Mark as read"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(notification.id)}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminNotificationsPanel = () => {
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    triggerReconciliationCheck,
  } = useAdminNotificationsData();

  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    await triggerReconciliationCheck();
    setChecking(false);
  };

  return (
    <Card>
      <CardHeader className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">System Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheck}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Check Reconciliation
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Automatic notifications for reconciliation and book closing reminders
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No notifications</p>
            <p className="text-sm mt-1">System will notify you if something needs attention</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
                onNavigate={navigate}
              />
            ))}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
