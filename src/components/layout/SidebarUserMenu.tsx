"use client";

import { signOut } from "next-auth/react";
import { LogOut, MessageSquare, Check } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { getTranslations, Locale } from "@/lib/i18n";
import { AvatarPicker } from "./AvatarPicker";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
  actor?: { name: string | null } | null;
};

function getDisplayName(notification: NotificationItem) {
  return notification.actor?.name || "System";
}

export function SidebarUserMenu({
  userId,
  userName,
  userEmail,
  locale,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  locale: Locale;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const translations = getTranslations(locale);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as NotificationItem[];
      setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0) return;
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (!res.ok) return;
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.error(e);
    }
  }, [unreadCount]);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleNotifications = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen && unreadCount > 0) {
      void markAllAsRead();
    }
  };

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3 px-3 py-2 rounded-md">
        <AvatarPicker userKey={userId} userName={userName} locale={locale} size="sm" />
        <div className="flex flex-col">
          <span className="text-white font-medium text-sm">{userName}</span>
          <span className="text-slate-500 text-xs">{userEmail}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 relative" ref={popoverRef}>
        <button
          onClick={handleToggleNotifications}
          className="p-2 relative rounded-md hover:bg-slate-800 text-slate-500 hover:text-blue-400 transition-colors"
          title={translations.sidebar.messages}
        >
          <MessageSquare size={16} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900"></span>
          )}
        </button>

        {isOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50">
            <div className="p-3 border-b flex justify-between items-center bg-slate-50">
              <span className="font-semibold text-sm text-slate-800">{translations.sidebar.notifications}</span>
              {unreadCount > 0 && (
                <button onClick={() => void markAllAsRead()} className="text-xs text-blue-600 hover:underline">
                  {translations.sidebar.markAllRead}
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">{translations.sidebar.noNotifications}</div>
              ) : (
                notifications.map((n) => {
                  const actorName = getDisplayName(n);
                  const createdAtLabel = new Date(n.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <a
                      href={n.link || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={n.id}
                      onClick={() => setIsOpen(false)}
                      className={`block p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors flex gap-3 ${
                        !n.read ? "bg-blue-50/30" : ""
                      }`}
                    >
                      <div className="mt-0.5">
                        {!n.read ? (
                          <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500"></div>
                        ) : (
                          <Check size={14} className="mt-0.5 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${!n.read ? "font-medium text-slate-800" : "text-slate-600"}`}>
                          <span className="font-semibold">{actorName}</span> {n.message}
                        </p>
                        <span className="text-xs text-slate-400 mt-1 inline-block">{createdAtLabel}</span>
                      </div>
                    </a>
                  );
                })
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 rounded-md hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
          title={translations.sidebar.signOut}
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
