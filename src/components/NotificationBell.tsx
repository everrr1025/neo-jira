"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
  actor?: { name: string };
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", { method: "PATCH" });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      <button 
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) markAllAsRead();
        }}
        className="p-2 rounded-full hover:bg-slate-100 relative transition-colors text-slate-500"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {open && (
        <div 
          className="absolute bottom-full mb-3 w-[320px] bg-white border border-slate-300 shadow-2xl rounded-lg overflow-hidden z-[100] origin-bottom animate-in fade-in zoom-in-95 duration-100"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        >
          <div className="p-3 border-b bg-slate-50 font-semibold text-slate-700 text-sm flex justify-between items-center">
            Notifications
            {unreadCount > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{unreadCount} New</span>}
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">No notifications</div>
            ) : (
              notifications.map((n) => (
                <Link 
                  href={n.link || "#"} 
                  key={n.id}
                  onClick={() => setOpen(false)}
                  className={`block p-4 border-b last:border-0 hover:bg-slate-50 transition-colors ${n.read ? 'opacity-70' : 'bg-blue-50/30'}`}
                >
                  <div className="text-sm text-slate-800">
                    <span className="font-semibold">{n.actor?.name || 'System'}</span> {n.message}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt))} ago
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
