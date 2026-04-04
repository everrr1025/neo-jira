"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useState, useEffect } from "react";
import { getTranslations, LANGUAGE_COOKIE, Locale } from "@/lib/i18n";

export function Header({ initialLocale }: { initialLocale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const translations = getTranslations(locale);
  const userName = session?.user?.name || translations.sidebar.userFallback;

  const [query, setQuery] = useState(searchParams.get("search") || "");

  useEffect(() => {
    setQuery(searchParams.get("search") || "");
  }, [searchParams]);

  useEffect(() => {
    setLocale(initialLocale);
  }, [initialLocale]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/?search=${encodeURIComponent(query.trim())}`);
    } else {
      router.push(`/`);
    }
  }, [query, router]);
  const hideHeader =
    pathname.startsWith("/issues") ||
    pathname.startsWith("/iterations") ||
    pathname.startsWith("/projects");
  const showLanguageSwitcher = pathname === "/";

  const handleLocaleSwitch = useCallback((nextLocale: Locale) => {
    if (nextLocale === locale) return;
    setLocale(nextLocale);
    document.cookie = `${LANGUAGE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [locale, router]);

  const getTitle = () => {
    if (pathname === "/") return translations.header.workspaceOverview;
    if (pathname.startsWith("/issues")) return translations.header.issues;
    if (pathname.startsWith("/projects")) return translations.header.projects;
    if (pathname.startsWith("/iterations")) return translations.header.iterations;
    if (pathname.startsWith("/admin")) return translations.header.adminSettings;
    if (pathname.startsWith("/login")) return translations.header.login;
    return translations.header.appName;
  };

  if (hideHeader) return null;

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 shadow-sm sticky top-0 z-10 w-full">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-800 truncate">{getTitle()}</h1>
      </div>

      <div className="flex items-center gap-6">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={translations.header.searchPlaceholder}
            className="pl-9 pr-4 py-2 border rounded-full text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 transition-all focus:w-80"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </form>
        <div className="text-sm text-slate-500 font-medium">
          {translations.header.welcomeBack}, {userName}
        </div>
        {showLanguageSwitcher && (
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
            {(["en", "zh"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleLocaleSwitch(option)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  locale === option ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {option === "en" ? "EN" : "中文"}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
