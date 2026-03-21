export default function IterationsPage() {
  const iterations = [
    { name: "Sprint 4", status: "Active", startDate: "Oct 1, 2026", endDate: "Oct 14, 2026", progress: 65, issues: 24 },
    { name: "Sprint 5", status: "Planned", startDate: "Oct 15, 2026", endDate: "Oct 28, 2026", progress: 0, issues: 12 },
    { name: "Sprint 3", status: "Completed", startDate: "Sep 15, 2026", endDate: "Sep 28, 2026", progress: 100, issues: 30 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Iterations / Sprints</h2>
          <p className="text-sm text-slate-500 mt-1">Plan and manage team iterations.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm">
          Create Sprint
        </button>
      </div>

      <div className="grid gap-4">
        {iterations.map((iteration, i) => (
          <div key={i} className="bg-white rounded-xl border shadow-sm p-5 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-800">{iteration.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  iteration.status === 'Active' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  iteration.status === 'Planned' ? 'bg-slate-50 text-slate-600 border-slate-200' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {iteration.status}
                </span>
              </div>
              <div className="text-sm text-slate-500 font-medium">
                {iteration.startDate} - {iteration.endDate}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-slate-500">Issues</span>
                  <span className="font-semibold text-slate-800">{iteration.issues}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500">Completed</span>
                  <span className="font-semibold text-slate-800">{Math.round((iteration.progress / 100) * iteration.issues)}</span>
                </div>
              </div>
              
              <div className="w-1/3 min-w-[200px]">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 font-medium">Progress</span>
                  <span className="font-bold text-slate-700">{iteration.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${iteration.status === 'Completed' ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                    style={{ width: `${iteration.progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
