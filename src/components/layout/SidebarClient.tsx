"use client";

import Link from "next/link";
import { useState } from "react";
import { SidebarUserMenu } from "./SidebarUserMenu";
import { AvatarPicker } from "./AvatarPicker";
import { usePathname } from "next/navigation";
import { getTranslations, Locale } from "@/lib/i18n";

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

  const getNavClass = (href: string) => {
    const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
    return `flex items-center ${collapsed ? 'justify-center mx-3' : 'gap-3 px-3'} py-2 rounded-md transition-colors ${
      isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'
    } group whitespace-nowrap`;
  };

  return (
    <aside className={`transition-all duration-300 ease-in-out bg-slate-900 text-slate-300 flex flex-col items-start h-screen sticky top-0 relative overflow-visible z-30 shrink-0 shadow-xl ${collapsed ? 'w-20' : 'w-64'}`}>
      
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="absolute right-0 translate-x-1/2 top-8 bg-slate-800 text-slate-400 hover:text-white border border-slate-700 w-6 h-6 rounded-full flex items-center justify-center z-40 shadow-sm"
      >
        <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className={`p-6 w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3'} h-20`}>
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow shadow-blue-500/50">
          {activeProject ? activeProject.name.charAt(0).toUpperCase() : 'N'}
        </div>
        <span className={`font-bold text-lg text-white tracking-wide truncate transition-opacity duration-200 ${collapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
          {activeProject ? activeProject.name : "Neo-Jira"}
        </span>
      </div>

      <nav className="flex-1 w-full px-2 space-y-2 mt-4 overflow-hidden">
        <Link
          href={lockProjectScopedLinks ? "/projects" : "/"}
          className={`${getNavClass(lockProjectScopedLinks ? "/projects" : "/")} ${lockProjectScopedLinks ? "opacity-50" : ""}`}
          title={translations.sidebar.dashboard}
        >
          <svg className="flex-shrink-0 w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          <span className={`transition-opacity duration-200 ${collapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{translations.sidebar.dashboard}</span>
        </Link>
        <Link
          href={lockProjectScopedLinks ? "/projects" : "/issues"}
          className={`${getNavClass(lockProjectScopedLinks ? "/projects" : "/issues")} ${lockProjectScopedLinks ? "opacity-50" : ""}`}
          title={translations.sidebar.issues}
        >
          <svg className="flex-shrink-0 w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span className={`transition-opacity duration-200 ${collapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{translations.sidebar.issues}</span>
        </Link>
        <Link
          href={lockProjectScopedLinks ? "/projects" : "/iterations"}
          className={`${getNavClass(lockProjectScopedLinks ? "/projects" : "/iterations")} ${lockProjectScopedLinks ? "opacity-50" : ""}`}
          title={translations.sidebar.iterations}
        >
          <svg className="flex-shrink-0 w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          <span className={`transition-opacity duration-200 ${collapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{translations.sidebar.iterations}</span>
        </Link>
        <Link href="/projects" className={getNavClass("/projects")} title={translations.sidebar.projects}>
          <svg className="flex-shrink-0 w-5 h-5 text-slate-400 group-hover:text-purple-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          <span className={`transition-opacity duration-200 ${collapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{translations.sidebar.projects}</span>
        </Link>

        {isAdmin && (
          <>
            <div className={`pt-4 pb-1 ${collapsed ? 'px-0 text-center' : 'px-3'}`}>
              <div className="w-full h-px bg-slate-800" />
            </div>
            <Link href="/admin" className={getNavClass("/admin")} title={translations.sidebar.settings}>
              <svg className="flex-shrink-0 w-5 h-5 text-slate-400 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className={`transition-opacity duration-200 ${collapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{translations.sidebar.settings}</span>
            </Link>
          </>
        )}
      </nav>

      <div className={`p-4 border-t border-slate-800 w-full text-sm flex ${collapsed ? 'justify-center px-0' : ''}`}>
        {collapsed ? (
          <AvatarPicker
            userKey={user?.id || user?.email || user?.name || "anonymous"}
            userName={user?.name || translations.sidebar.userFallback}
            locale={locale}
            initialAvatar={user?.avatar}
            size="sm"
          />
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
