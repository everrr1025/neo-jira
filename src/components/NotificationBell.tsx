"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";

import { getTranslations, localeDateMap, type Locale } from "@/lib/i18n";

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
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
            void markAllAsRead();
          }
        }}
        className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        title={text.title}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">{text.title}</span>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {locale === "zh" ? `${unreadCount}${text.unreadSuffix}` : `${unreadCount} ${text.unreadSuffix}`}
                </span>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  {text.markAllRead}
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">{text.noNotifications}</div>
            ) : (
              notifications.map((notification) => {
                const actorName = notification.actor?.name || text.systemActor;
                return (
                  <Link
                    key={notification.id}
                    href={notification.link || "#"}
                    onClick={() => setOpen(false)}
                    className={`flex gap-3 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 ${
                      notification.read ? "bg-white" : "bg-blue-50/40"
                    }`}
                  >
                    <div className="pt-1">
                      {notification.read ? (
                        <Check size={14} className="text-slate-300" />
                      ) : (
                        <span className="mt-1 block h-2.5 w-2.5 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${notification.read ? "text-slate-600" : "font-medium text-slate-800"}`}>
                        <span className="font-semibold">{actorName}</span> {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(notification.createdAt).toLocaleString(localeDateMap[locale])}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
