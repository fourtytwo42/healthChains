'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, Notification } from '@/hooks/use-notifications';
import { RequestResponseCard } from '@/components/patient/request-response-card';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface NotificationDropdownProps {
  patientAddress: string | null;
  onNotificationClick?: (notification: Notification) => void;
}

/**
 * Notification dropdown component for patients
 * Shows pending access requests with unread count badge
 */
export function NotificationDropdown({
  patientAddress,
  onNotificationClick,
}: NotificationDropdownProps) {
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const {
    notifications,
    unreadNotifications,
    unreadCount,
    isLoading,
    clearAll,
    dismiss,
  } = useNotifications(patientAddress);

  const handleNotificationClick = (notification: Notification) => {
    setSelectedRequestId(notification.requestId);
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  const handleCloseRequestCard = () => {
    setSelectedRequestId(null);
  };

  if (!patientAddress) {
    return null;
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
            >
              Clear all
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => {
                const isUnread = unreadNotifications.some(n => n.requestId === notification.requestId);
                return (
                  <DropdownMenuItem
                    key={notification.requestId}
                    className="flex flex-col items-start p-3 cursor-pointer"
                    onClick={() => {
                      handleNotificationClick(notification);
                      if (isUnread) {
                        dismiss(notification.requestId);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {notification.provider?.organizationName || 'Provider'}
                          </span>
                          {isUnread && (
                            <Badge variant="default" className="h-2 w-2 rounded-full p-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Requesting access for {notification.dataType || 'data'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(notification.timestamp), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismiss(notification.requestId);
                          }}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
    {selectedRequestId !== null && (
      <RequestResponseCard
        requestId={selectedRequestId}
        onClose={handleCloseRequestCard}
      />
    )}
  </>
  );
}

