"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { Shield, ChevronLeft } from "lucide-react";

import { getTranslations, type Locale } from "@/lib/i18n";
import { AvatarPicker } from "./AvatarPicker";
import { SidebarUserMenu } from "./SidebarUserMenu";

export function SidebarClient({
  isAdmin,
  activeProject,
  lockProjectScopedLinks,
  user,
  locale,
}: {
  isAdmin: boolean;
  activeProject: { id: string; name: string; key: string } | null;
  lockProjectScopedLinks: boolean;
  user: { id?: string; name?: string | null; email?: string | null; avatar?: string | null } | null | undefined;
  locale: Locale;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const translations = getTranslations(locale);
  const plansLabel = locale === "zh" ? "计划" : "Plans";

  const getNavClass = (href: string) => {
    const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
    return `group flex items-center whitespace-nowrap rounded-md py-2 transition-colors ${
      collapsed ? "mx-3 justify-center" : "gap-3 px-3"
    } ${isActive ? "bg-slate-800 text-white" : "hover:bg-slate-800 hover:text-white"}`;
  };

  return (
    <aside
      className={`relative sticky top-0 z-30 flex h-screen shrink-0 flex-col items-start overflow-visible bg-slate-900 text-slate-300 shadow-xl transition-all duration-300 ease-in-out ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute right-0 top-8 z-40 flex h-6 w-6 translate-x-1/2 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 shadow-sm hover:text-white"
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className={`h-20 w-full p-6 ${collapsed ? "justify-center px-0" : "flex items-center gap-3"}`}>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow shadow-blue-500/50">
          {activeProject ? activeProject.name.charAt(0).toUpperCase() : "N"}
        </div>
        <span
          className={`truncate text-lg font-bold tracking-wide text-white transition-opacity duration-200 ${
            collapsed ? "hidden w-0 opacity-0" : "opacity-100"
          }`}
        >
          {activeProject ? activeProject.name : "Department Portal"}
        </span>
      </div>

      <nav className="mt-2 w-full flex-1 space-y-2 overflow-hidden px-2">
        {activeProject && (
          <div className="mb-4 space-y-2">
            <a
              href="/projects/select?projectId=clear"
              className={`group flex w-full items-center whitespace-nowrap rounded-md py-2 transition-colors hover:bg-slate-800 hover:text-white ${
                collapsed ? "mx-3 justify-center" : "gap-3 px-3"
              }`}
              title="Return to Portal"
            >
              <ChevronLeft className="h-5 w-5 flex-shrink-0 text-slate-400 transition-colors group-hover:text-blue-400" />
              <span className={`text-sm font-medium ${collapsed ? "hidden w-0 opacity-0" : "opacity-100 transition-opacity duration-200"}`}>
                Return to Portal
              </span>
            </a>
            <div className={`pb-1 pt-2 ${collapsed ? "px-0 text-center" : "px-3"}`}>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600 transition-all">
                {collapsed ? "–" : "Project"}
              </div>
            </div>
          </div>
        )}

        {(!activeProject ? [
          {
            id: "dashboard",
            href: "/",
            icon: <svg className="h-5 w-5 flex-shrink-0 text-slate-400 transition-colors group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
            label: translations.sidebar.dashboard
          },
          {
            id: "projects",
            href: "/projects",
            icon: <svg className="h-5 w-5 flex-shrink-0 text-slate-400 transition-colors group-hover:text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
            label: translations.sidebar.projects
          }
        ] : [
          {
            id: "dashboard",
            href: "/",
            icon: <svg className="h-5 w-5 flex-shrink-0 text-slate-400 transition-colors group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
            label: translations.sidebar.dashboard
          },
          {
            id: "kanban",
            href: "/iterations",
            icon: <svg className="h-5 w-5 flex-shrink-0 text-slate-400 transition-colors group-hover:text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
            label: translations.sidebar.iterations
          },
          {
            id: "issues",
            href: "/issues",
            icon: <svg className="h-5 w-5 flex-shrink-0 text-slate-400 transition-colors group-hover:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
            label: translations.sidebar.issues
          },
          {
            id: "plans",
            href: "/plans",
            icon: <svg className="h-5 w-5 flex-shrink-0 text-slate-400 transition-colors group-hover:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
            label: plansLabel
          },
          {
            id: "projects",
            href: "/projects",
            icon: <svg className="h-5 w-5 flex-shrink-0 text-slate-400 transition-colors group-hover:text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
            label: translations.sidebar.projects
          }
        ]).map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={getNavClass(item.href)}
            title={item.label}
          >
            {item.icon}
            <span className={`${collapsed ? "hidden w-0 opacity-0" : "opacity-100 transition-opacity duration-200"}`}>
              {item.label}
            </span>
          </Link>
        ))}

        {isAdmin && (
          <>
            <div className={`pb-1 pt-4 ${collapsed ? "px-0 text-center" : "px-3"}`}>
              <div className="h-px w-full bg-slate-800" />
            </div>
            <Link href="/admin" className={getNavClass("/admin")} title={translations.sidebar.admin}>
              <Shield className="h-5 w-5 flex-shrink-0 text-slate-400 transition-colors group-hover:text-red-400" />
              <span className={`${collapsed ? "hidden w-0 opacity-0" : "opacity-100 transition-opacity duration-200"}`}>
                {translations.sidebar.admin}
              </span>
            </Link>
          </>
        )}
      </nav>

      <div className={`flex w-full border-t border-slate-800 p-4 text-sm ${collapsed ? "justify-center px-0" : ""}`}>
        {collapsed ? (
          <Link href="/settings">
            <AvatarPicker
              userKey={user?.id || user?.email || user?.name || "anonymous"}
              userName={user?.name || translations.sidebar.userFallback}
              locale={locale}
              initialAvatar={user?.avatar}
              size="sm"
              editable={false}
            />
          </Link>
        ) : (
          <SidebarUserMenu
            userId={user?.id || user?.email || user?.name || "anonymous"}
            userName={user?.name || translations.sidebar.userFallback}
            userEmail={user?.email || ""}
            userAvatar={user?.avatar}
            locale={locale}
          />
        )}
      </div>
    </aside>
  );
}
