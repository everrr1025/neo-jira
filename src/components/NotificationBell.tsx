"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getTranslations, type Locale } from "@/lib/i18n";
import { formatFullDateTime, formatRelativeTime } from "@/lib/timeFormat";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
  actor?: { name: string | null } | null;
};

export default function NotificationBell({ locale }: { locale: Locale }) {
  const translations = getTranslations(locale);
  const text = translations.notificationsMenu;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as NotificationItem[];
        setNotifications(data);
      } catch (error) {
        console.error(error);
      }
    };

    void fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;

    try {
      const response = await fetch("/api/notifications", { method: "PATCH" });
      if (!response.ok) return;
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          void markAllAsRead();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="relative rounded-full text-muted-foreground"
          title={text.title}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-destructive" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="w-[360px] overflow-hidden rounded-lg p-0 shadow-xl">
        <div className="flex items-center justify-between gap-3 bg-muted/35 px-4 py-3">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">{text.title}</DropdownMenuLabel>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {locale === "zh" ? `${unreadCount}${text.unreadSuffix}` : `${unreadCount} ${text.unreadSuffix}`}
              </span>
            )}
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void markAllAsRead();
                }}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {text.markAllRead}
              </Button>
            )}
          </div>
        </div>

        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-[420px] overflow-y-auto p-1.5">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">{text.noNotifications}</div>
          ) : (
            notifications.map((notification) => {
              const actorName = notification.actor?.name || text.systemActor;
              return (
                <DropdownMenuItem key={notification.id} asChild className="cursor-pointer p-0 focus:bg-transparent">
                  <Link
                    href={notification.link || "#"}
                    target={notification.link ? "_blank" : undefined}
                    rel={notification.link ? "noreferrer" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex w-full gap-3 rounded-md px-3 py-3 transition-colors hover:bg-accent focus:bg-accent ${
                      notification.read ? "bg-background" : "bg-primary/5"
                    }`}
                  >
                    <div className="pt-1">
                      {notification.read ? (
                        <Check size={14} className="text-muted-foreground/45" />
                      ) : (
                        <span className="mt-1 block h-2.5 w-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-5 ${notification.read ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                        <span className="font-semibold text-foreground">{actorName}</span> {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground" title={formatFullDateTime(notification.createdAt, locale)}>
                        {formatRelativeTime(notification.createdAt, locale)}
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
