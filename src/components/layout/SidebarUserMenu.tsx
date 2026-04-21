"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Settings } from "lucide-react";

import { getTranslations, type Locale } from "@/lib/i18n";
import { AvatarPicker } from "./AvatarPicker";

export function SidebarUserMenu({
  userId,
  userName,
  userEmail,
  userAvatar,
  locale,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string | null;
  locale: Locale;
}) {
  const translations = getTranslations(locale);

  return (
    <div className="flex items-center justify-between gap-2 w-full">
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2">
        <div className="flex-shrink-0">
          <AvatarPicker
            userKey={userId}
            userName={userName}
            locale={locale}
            initialAvatar={userAvatar}
            size="sm"
            editable={false}
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-white" title={userName}>
            {userName}
          </span>
          <span className="truncate text-xs text-slate-500" title={userEmail}>
            {userEmail}
          </span>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        <Link
          href="/settings"
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-blue-400"
          title={translations.settingsPage.openSettings}
        >
          <Settings size={16} />
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400"
          title={translations.sidebar.signOut}
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
