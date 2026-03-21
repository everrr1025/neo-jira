import Link from "next/link";

export function Sidebar() {
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
      </nav>
      
      <div className="p-4 border-t border-slate-800 w-full text-sm">
        <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 cursor-pointer transition-colors">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">U</div>
          <div className="flex flex-col">
            <span className="text-white font-medium">Test User</span>
            <span className="text-slate-500 text-xs">user@example.com</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
