import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { SidebarUserMenu } from "./SidebarUserMenu";

export async function Sidebar() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const isAdmin = (user as any)?.role === "ADMIN";

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col items-start min-h-screen">
      <div className="p-6 w-full flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow shadow-blue-500/50">
          N
        </div>
        <span className="font-bold text-xl text-white tracking-wide">Neo-Jira</span>
      </div>
      
      <nav className="flex-1 w-full px-4 space-y-2 mt-4">
        <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-slate-800 hover:text-white group">
          <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          Dashboard
        </Link>
        <Link href="/issues" className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-slate-800 hover:text-white group">
          <svg className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Issues
        </Link>
        <Link href="/iterations" className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-slate-800 hover:text-white group">
          <svg className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Iterations
        </Link>
        <Link href="/projects" className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-slate-800 hover:text-white group">
          <svg className="w-5 h-5 text-slate-400 group-hover:text-purple-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          Projects
        </Link>
        
        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">Admin</span>
            </div>
            <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-slate-800 hover:text-white group">
              <svg className="w-5 h-5 text-slate-400 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Settings
            </Link>
          </>
        )}
      </nav>
      
      <div className="p-4 border-t border-slate-800 w-full text-sm">
        <SidebarUserMenu userName={user?.name || "User"} userEmail={user?.email || ""} />
      </div>
    </aside>
  );
}
