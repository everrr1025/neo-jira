"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useState, useEffect } from "react";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const userName = session?.user?.name || "User";

  const [query, setQuery] = useState(searchParams.get("search") || "");

  useEffect(() => {
    setQuery(searchParams.get("search") || "");
  }, [searchParams]);

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

  const getTitle = () => {
    if (pathname === "/") return "Workspace overview";
    if (pathname.startsWith("/issues")) return "Issues";
    if (pathname.startsWith("/projects")) return "Projects";
    if (pathname.startsWith("/iterations")) return "Iterations";
    if (pathname.startsWith("/admin")) return "Admin Settings";
    if (pathname.startsWith("/login")) return "Login";
    return "Neo-Jira";
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
            placeholder="Search issues, projects..."
            className="pl-9 pr-4 py-2 border rounded-full text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 transition-all focus:w-80"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </form>
        <div className="text-sm text-slate-500 font-medium">
          Welcome back, {userName}
        </div>
      </div>
    </header>
  );
}
