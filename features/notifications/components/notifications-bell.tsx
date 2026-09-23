"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database.types";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../actions";
import { mapNotificationRow, type Notification } from "../schemas";

interface InboxState {
  notifications: Notification[];
  unreadCount: number;
}

export function NotificationsBell({
  userId,
  initialNotifications,
  initialUnreadCount,
}: {
  userId: string;
  initialNotifications: Notification[];
  initialUnreadCount: number;
}) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [inbox, setInbox] = useState<InboxState>({
    notifications: initialNotifications,
    unreadCount: initialUnreadCount,
  });

  // Realtime subscription: an external system, so this is what effects are for.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on<Tables<"notifications">>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = mapNotificationRow(payload.new);
          setInbox((prev) =>
            prev.notifications.some((n) => n.id === notification.id)
              ? prev
              : {
                  notifications: [notification, ...prev.notifications],
                  unreadCount: prev.unreadCount + 1,
                },
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Optimistic updates are applied and rolled back with functional updates so a
  // notification arriving over Realtime in the meantime is never lost.
  const setReadAt = (ids: Set<string>, readAt: Date | null, unreadDelta: number) =>
    setInbox((prev) => ({
      notifications: prev.notifications.map((n) => (ids.has(n.id) ? { ...n, readAt } : n)),
      unreadCount: Math.max(prev.unreadCount + unreadDelta, 0),
    }));

  const markOneRead = async (notification: Notification) => {
    if (notification.readAt) return;

    const ids = new Set([notification.id]);
    setReadAt(ids, new Date(), -1);

    const result = await markNotificationReadAction({ notificationId: notification.id });
    if (!result.success) {
      setReadAt(ids, null, 1);
      toast.error(result.error ?? "Could not mark the notification as read");
    }
  };

  const markAllRead = async () => {
    const ids = new Set(inbox.notifications.filter((n) => !n.readAt).map((n) => n.id));
    const previousUnreadCount = inbox.unreadCount;
    setReadAt(ids, new Date(), -previousUnreadCount);

    const result = await markAllNotificationsReadAction();
    if (!result.success) {
      setReadAt(ids, null, previousUnreadCount);
      toast.error(result.error ?? "Could not mark notifications as read");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative size-9"
          aria-label={
            inbox.unreadCount
              ? `Notifications, ${inbox.unreadCount} unread`
              : "Notifications"
          }
        >
          <Bell className="size-4" aria-hidden="true" />
          {inbox.unreadCount > 0 ? (
            <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums">
              {inbox.unreadCount > 9 ? "9+" : inbox.unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0" align="end">
        <DropdownMenuLabel className="px-3 py-2 text-sm font-normal">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Notifications</span>
            {inbox.unreadCount > 0 ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-4 hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  markAllRead();
                }}
              >
                Mark all as read
              </button>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {inbox.notifications.length === 0 ? (
          <p className="text-muted-foreground px-3 py-8 text-center text-sm">
            No notifications yet.
          </p>
        ) : (
          <ScrollArea className="h-[min(320px,50vh)]">
            <div className="flex flex-col py-1">
              {inbox.notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onSelect={() => markOneRead(notification)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuItem asChild className="justify-center rounded-none py-2 text-xs">
          <Link href={`/organizations/${orgSlug}/settings/notifications`}>
            Notification settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationItem({
  notification,
  onSelect,
}: {
  notification: Notification;
  onSelect: () => void;
}) {
  const isUnread = !notification.readAt;

  const content = (
    <div className="min-w-0 flex-1 space-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm leading-tight", isUnread && "font-semibold")}>
          {notification.title}
        </p>
        <span
          className="text-muted-foreground shrink-0 text-[10px] whitespace-nowrap"
          suppressHydrationWarning
        >
          {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
        </span>
      </div>
      {notification.body ? (
        <p className="text-muted-foreground line-clamp-2 text-xs leading-snug">
          {notification.body}
        </p>
      ) : null}
    </div>
  );

  return (
    <DropdownMenuItem
      asChild={Boolean(notification.actionUrl)}
      className={cn(
        "focus:bg-accent cursor-pointer items-start rounded-none px-3 py-2.5",
        isUnread && "bg-accent/40",
      )}
      onSelect={onSelect}
    >
      {notification.actionUrl ? (
        <Link href={notification.actionUrl}>{content}</Link>
      ) : (
        content
      )}
    </DropdownMenuItem>
  );
}
