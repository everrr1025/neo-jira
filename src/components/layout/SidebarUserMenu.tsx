"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Settings } from "lucide-react";

import { getTranslations, type Locale } from "@/lib/i18n";
import { AvatarPicker } from "./AvatarPicker";

export function SidebarUserMenu({
  userId,
  userName,
  userAvatar,
  locale,
  position,
}: {
  userId: string;
  userName: string;
  userAvatar?: string | null;
  locale: Locale;
  position?: string | null;
}) {
  const translations = getTranslations(locale);

  async function handleSignOut() {
    try {
      await signOut({ redirect: false });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 w-full">
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[#f4f4f5]">
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
          <span className="truncate text-sm font-medium text-[#18181b]" title={userName}>
            {userName}
          </span>
          {position ? (
            <span className="mt-0.5 truncate text-xs text-[#71717a]" title={position}>
              {position}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        <Link
          href="/settings"
          className="rounded-lg p-2 text-[#71717a] transition-colors hover:bg-[#f4f4f5] hover:text-[#09090b]"
          title={translations.settingsPage.openSettings}
          aria-label={translations.settingsPage.openSettings}
        >
          <Settings size={16} />
        </Link>

        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="rounded-lg p-2 text-[#71717a] transition-colors hover:bg-red-50 hover:text-red-600"
          title={translations.sidebar.signOut}
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
