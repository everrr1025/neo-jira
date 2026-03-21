export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard</h2>
        <div className="text-sm text-slate-500 bg-white px-3 py-1.5 rounded-md border shadow-sm">
          Welcome back, Test User
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Open Issues", value: "12", color: "text-blue-600", bg: "bg-blue-50" },
          { label: "In Progress", value: "5", color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Done this week", value: "24", color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Overdue", value: "2", color: "text-red-600", bg: "bg-red-50" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-slate-500 text-sm font-medium">{stat.label}</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${stat.color}`}>{stat.value}</span>
            </div>
            <div className={`mt-3 h-1 w-full rounded-full ${stat.bg}`}>
              <div className={`h-full rounded-full bg-current ${stat.color} w-2/3 opacity-50`}></div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Recent Activity</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all</button>
          </div>
          <div className="p-0 flex-1 flex items-center justify-center text-slate-400 bg-slate-50/50 min-h-[300px]">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>Activity feed will appear here</p>
            </div>
          </div>
        </div>

        {/* My Tasks */}
        <div className="bg-white rounded-xl border shadow-sm flex flex-col">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Assigned to me</h3>
          </div>
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-colors group">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-blue-600">NJ-{1024 + i}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">In Progress</span>
                </div>
                <h4 className="text-sm font-medium text-slate-800 mt-1">Implement user authentication flow</h4>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
