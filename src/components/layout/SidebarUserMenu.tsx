"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SidebarUserMenu({ userName, userEmail }: { userName: string, userEmail: string }) {
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
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="p-2 rounded-md hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
        title="Sign out"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
