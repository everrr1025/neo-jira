export default function IssuesBoard() {
  const columns = [
    { title: "To Do", bg: "bg-slate-100", border: "border-slate-200" },
    { title: "In Progress", bg: "bg-blue-50", border: "border-blue-100" },
    { title: "In Review", bg: "bg-purple-50", border: "border-purple-100" },
    { title: "Done", bg: "bg-emerald-50", border: "border-emerald-100" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Active Sprint</h2>
          <p className="text-sm text-slate-500 mt-1">Sprint 4 • 12 days remaining</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm">
                U{i}
              </div>
            ))}
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-500 shadow-sm cursor-pointer hover:bg-slate-200 transition-colors">
              +
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200 mx-2"></div>
          <button className="bg-white border text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm">
            Complete Sprint
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {columns.map((col, i) => (
          <div key={i} className={`flex-shrink-0 w-80 rounded-xl border flex flex-col max-h-full ${col.bg} ${col.border}`}>
            <div className="p-3 font-semibold text-slate-700 flex items-center justify-between text-sm uppercase tracking-wide">
              {col.title}
              <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold border shadow-sm">
                {i === 0 ? 5 : i === 1 ? 2 : i === 2 ? 1 : 12}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {/* Sample Ticket */}
              {i === 0 && [1, 2].map(ticket => (
                <div key={ticket} className="bg-white p-3.5 rounded-lg border shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-shadow group">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600 transition-colors">NJ-10{ticket}</span>
                    <span className="w-2 h-2 rounded-full bg-red-500" title="High Priority"></span>
                  </div>
                  <h4 className="text-sm font-medium text-slate-800 leading-snug mb-3">
                    Design system component updates for the new navigation
                  </h4>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex gap-1">
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">UI</span>
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded">Task</span>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-slate-200 border border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-slate-500">
                      U1
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Drop Zone Indicator (invisible but present for spacing) */}
              <div className="h-2 rounded bg-black/5 opacity-0"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
