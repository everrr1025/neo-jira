"use client";

import { signOut } from "next-auth/react";
import { LogOut, MessageSquare, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const MOCK_NOTIFICATIONS = [
  { id: 1, message: "Alex mentioned you in PROJ-123", read: false, time: "5m ago" },
  { id: 2, message: "Sarah updated the status of PROJ-99", read: false, time: "1h ago" },
  { id: 3, message: "System maintenance tonight", read: true, time: "2d ago" }
];

export function SidebarUserMenu({ userName, userEmail }: { userName: string, userEmail: string }) {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3 px-3 py-2 rounded-md">
        <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
          {userName?.charAt(0)?.toUpperCase() || "U"}
        </div>
        <div className="flex flex-col">
          <span className="text-white font-medium text-sm">{userName}</span>
          <span className="text-slate-500 text-xs">{userEmail}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 relative" ref={popoverRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 relative rounded-md hover:bg-slate-800 text-slate-500 hover:text-blue-400 transition-colors"
          title="Messages"
        >
          <MessageSquare size={16} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900"></span>
          )}
        </button>

        {isOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50">
            <div className="p-3 border-b flex justify-between items-center bg-slate-50">
              <span className="font-semibold text-sm text-slate-800">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:underline">Mark all read</button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">No notifications</div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    onClick={() => markAsRead(n.id)}
                    className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors flex gap-3 ${!n.read ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className="mt-0.5">
                      {!n.read ? (
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500"></div>
                      ) : (
                        <Check size={14} className="mt-0.5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${!n.read ? 'font-medium text-slate-800' : 'text-slate-600'}`}>{n.message}</p>
                      <span className="text-xs text-slate-400 mt-1 inline-block">{n.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 rounded-md hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
