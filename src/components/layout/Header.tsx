"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";

import NotificationBell from "@/components/NotificationBell";
import { Input } from "@/components/ui/input";
import { getTranslations, type Locale } from "@/lib/i18n";

export function Header({ initialLocale, initialIsGlobalAdmin = false }: { initialLocale: Locale; initialIsGlobalAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const translations = getTranslations(locale);
  const userName = session?.user?.name || translations.sidebar.userFallback;
  const isGlobalAdmin = initialIsGlobalAdmin || (session?.user as { role?: string } | undefined)?.role === "ADMIN";

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
    pathname.startsWith("/admin") ||
    pathname.startsWith("/issues") ||
    pathname.startsWith("/iterations") ||
    pathname.startsWith("/plans") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/settings") ||
    /^\/departments\/[^/]+\/(projects|members|items|notifications)(?:\/|$)/.test(pathname);
  const isDepartmentOverview = /^\/departments\/[^/]+$/.test(pathname);
  const isOverviewPage = pathname === "/" || isDepartmentOverview;
  const showNotificationBell = pathname !== "/";

  const getTitle = () => {
    if (pathname === "/") return translations.header.workspaceOverview;
    if (/^\/departments\/[^/]+$/.test(pathname)) return locale === "zh" ? "概览" : "Overview";
    if (pathname.startsWith("/admin")) return translations.header.adminSettings;
    if (pathname.startsWith("/settings")) return translations.settingsPage.title;
    if (pathname.startsWith("/login")) return translations.header.login;
    return translations.header.appName;
  };

  if (hideHeader || (pathname === "/" && isGlobalAdmin)) {
    return null;
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center gap-4">
        <h1
          className={`truncate text-foreground ${
            isDepartmentOverview ? "text-xl font-bold tracking-tight" : "text-lg font-semibold"
          }`}
        >
          {getTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-5">
        <form onSubmit={handleSearch} className="relative">
          <Input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translations.header.searchPlaceholder}
            className="h-9 w-64 bg-background pl-9"
          />
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
        </form>

        <div className="flex items-center gap-3">
          {!isOverviewPage ? (
            <div className="text-sm font-medium text-muted-foreground">
              {translations.header.welcomeBack},{" "}
              <span className="text-foreground">{userName}</span>
            </div>
          ) : null}
          {showNotificationBell ? <NotificationBell locale={locale} /> : null}
        </div>
      </div>
    </header>
  );
}
