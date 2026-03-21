export function Header() {
  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 shadow-sm sticky top-0 z-10 w-full">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-800 truncate">Workspace overview</h1>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search issues, projects..." 
            className="pl-9 pr-4 py-2 border rounded-full text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 transition-all focus:w-80"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm">
          + Create
        </button>
      </div>
    </header>
  );
}
