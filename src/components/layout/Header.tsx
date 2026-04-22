"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import NotificationBell from "@/components/NotificationBell";
import { getTranslations, type Locale } from "@/lib/i18n";

export function Header({ initialLocale }: { initialLocale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const translations = getTranslations(locale);
  const userName = session?.user?.name || translations.sidebar.userFallback;

  useEffect(() => {
    setQuery(searchParams.get("search") || "");
  }, [searchParams]);

  useEffect(() => {
    setLocale(initialLocale);
  }, [initialLocale]);

  const handleSearch = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (query.trim()) {
        router.push(`/?search=${encodeURIComponent(query.trim())}`);
      } else {
        router.push("/");
      }
    },
    [query, router]
  );

  const hideHeader =
    pathname.startsWith("/issues") ||
    pathname.startsWith("/iterations") ||
    pathname.startsWith("/plans") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/settings");

  const getTitle = () => {
    if (pathname === "/") return translations.header.workspaceOverview;
    if (pathname.startsWith("/admin")) return translations.header.adminSettings;
    if (pathname.startsWith("/settings")) return translations.settingsPage.title;
    if (pathname.startsWith("/login")) return translations.header.login;
    return translations.header.appName;
  };

  if (hideHeader) {
    return null;
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b bg-white px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <h1 className="truncate text-lg font-semibold text-slate-800">{getTitle()}</h1>
      </div>

      <div className="flex items-center gap-5">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translations.header.searchPlaceholder}
            className="w-64 rounded-full border bg-slate-50 py-2 pl-9 pr-4 text-sm transition-all focus:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </form>

        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-slate-500">
            {translations.header.welcomeBack}, <span className="text-slate-700">{userName}</span>
          </div>
          <NotificationBell locale={locale} />
        </div>
      </div>
    </header>
  );
}
