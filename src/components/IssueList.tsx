"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, ListFilter, Users, ArrowLeft, ArrowRight } from "lucide-react";
import { updateIssue } from "@/app/actions/issues";

type Issue = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  iterationId?: string | null;
  iteration?: { name: string } | null;
  assigneeId?: string | null;
  assignee?: { name: string | null } | null;
  reporter?: { name: string | null } | null;
  createdAt: Date;
};

export default function IssueList({ initialIssues, users, iterations, currentUser }: { initialIssues: Issue[], users: any[], iterations: any[], currentUser: any }) {
  const [issues, setIssues] = useState(initialIssues);
  const [search, setSearch] = useState("");
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL"); // ALL, ME, UNASSIGNED
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  const [isPending, startTransition] = useTransition();

  // Sync state if initialIssues change from server
  const [columns, setColumns] = useState([
    { id: 'key', label: 'Key', width: 80 },
    { id: 'title', label: 'Summary', width: 0 },   // 0 = flexible, takes remaining space
    { id: 'iteration', label: 'Sprint', width: 160 },
    { id: 'status', label: 'Status', width: 140 },
    { id: 'type', label: 'Type', width: 120 },
    { id: 'priority', label: 'Priority', width: 140 },
    { id: 'assignee', label: 'Assignee', width: 190 },
  ]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('colIndex', index.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDragSourceIndex(index);
  };

  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverSide, setDragOverSide] = useState<'left' | 'right' | null>(null);

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData('colIndex');
    if (sourceIndexStr) {
      const sourceIndex = parseInt(sourceIndexStr, 10);
      if (sourceIndex !== targetIndex) {
        const newCols = [...columns];
        const [removed] = newCols.splice(sourceIndex, 1);
        // Adjust target if source was before target
        const adjustedTarget = dragOverSide === 'right' 
          ? (sourceIndex < targetIndex ? targetIndex : targetIndex + 1)
          : (sourceIndex < targetIndex ? targetIndex - 1 : targetIndex);
        newCols.splice(Math.max(0, adjustedTarget), 0, removed);
        setColumns(newCols);
      }
    }
    setDragSourceIndex(null);
    setDragOverIndex(null);
    setDragOverSide(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const side = e.clientX < midX ? 'left' : 'right';
    setDragOverIndex(index);
    setDragOverSide(side);
  };

  const handleDragEnd = () => {
    setDragSourceIndex(null);
    setDragOverIndex(null);
    setDragOverSide(null);
  };

  // --- Column Resize ---
  const resizingRef = useRef<{ colIndex: number; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const col = columns[colIndex];
    const startWidth = col.width || 150;
    resizingRef.current = { colIndex, startX: e.clientX, startWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, resizingRef.current.startWidth + delta);
      setColumns(prev => prev.map((c, i) => i === resizingRef.current!.colIndex ? { ...c, width: newWidth } : c));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columns]);

  useEffect(() => {
    setIssues(initialIssues);
  }, [initialIssues]);

  // Derived Data
  const filteredIssues = issues.filter((issue) => {
    if (statusFilter !== "ALL" && issue.status !== statusFilter) return false;
    if (typeFilter !== "ALL" && issue.type !== typeFilter) return false;
    if (priorityFilter !== "ALL" && issue.priority !== priorityFilter) return false;
    
    if (assigneeFilter === "ME" && issue.assigneeId !== currentUser?.id) return false;
    if (assigneeFilter === "UNASSIGNED" && issue.assigneeId !== null) return false;
    
    if (search) {
      const q = search.toLowerCase();
      if (!issue.title.toLowerCase().includes(q) && !issue.key.toLowerCase().includes(q)) return false;
    }
    
    return true;
  });

  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);
  const paginatedIssues = filteredIssues.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page if filters drastically change the array size
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);
  }, [filteredIssues.length, totalPages, currentPage]);

  const handleInlineUpdate = (issueId: string, field: string, value: string | null) => {
    // Optimistic update
    setIssues(prev => prev.map(i => {
      if (i.id === issueId) {
        if (field === 'iterationId') {
          const iter = iterations.find(it => it.id === value);
          return { ...i, iterationId: value, iteration: iter ? { name: iter.name } : null };
        }
        if (field === 'assigneeId') {
          const u = users.find(u => u.id === value);
          return { ...i, assigneeId: value, assignee: u ? { name: u.name } : null };
        }
        return { ...i, [field]: value };
      }
      return i;
    }));
    
    // Server action
    startTransition(() => {
      updateIssue(issueId, { [field]: value });
    });
  };

  return (
    <div className="flex flex-col flex-1 space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col xl:flex-row gap-3 items-center justify-between bg-white p-3 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2 w-full xl:w-80 relative">
          <Search size={16} className="absolute left-3 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by title or key..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border-slate-200 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Status */}
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-2 py-1.5 rounded-md border">
             <ListFilter size={14} className="text-slate-400" />
             <select 
              value={statusFilter} 
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="bg-transparent font-medium focus:outline-none cursor-pointer p-0 border-none"
            >
              <option value="ALL">All Status</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_TESTING">In Testing</option>
              <option value="DONE">Done</option>
            </select>
          </div>
          
          {/* Type */}
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-2 py-1.5 rounded-md border">
             <select 
              value={typeFilter} 
              onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              className="bg-transparent font-medium focus:outline-none cursor-pointer p-0 border-none"
            >
              <option value="ALL">All Types</option>
              <option value="TASK">Task</option>
              <option value="STORY">Story</option>
              <option value="BUG">Bug</option>
              <option value="EPIC">Epic</option>
            </select>
          </div>
          
          {/* Priority */}
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-2 py-1.5 rounded-md border">
             <select 
              value={priorityFilter} 
              onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
              className="bg-transparent font-medium focus:outline-none cursor-pointer p-0 border-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          
          {/* Assignee */}
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-2 py-1.5 rounded-md border">
             <Users size={14} className="text-slate-400" />
             <select 
              value={assigneeFilter} 
              onChange={(e) => { setAssigneeFilter(e.target.value); setCurrentPage(1); }}
              className="bg-transparent font-medium focus:outline-none cursor-pointer p-0 border-none"
            >
              <option value="ALL">All Users</option>
              <option value="ME">Assigned to Me</option>
              <option value="UNASSIGNED">Unassigned</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b">
              <tr>
                {columns.map((col, index) => {
                  const showLeftLine = dragOverIndex === index && dragOverSide === 'left' && dragSourceIndex !== index;
                  const showRightLine = dragOverIndex === index && dragOverSide === 'right' && dragSourceIndex !== index;
                  const isDragging = dragSourceIndex === index;
                  return (
                    <th
                      key={col.id}
                      className={`px-5 py-4 cursor-grab active:cursor-grabbing hover:bg-slate-100 transition-colors overflow-hidden relative select-none ${
                        isDragging ? 'opacity-40' : ''
                      }`}
                      style={col.width ? { width: `${col.width}px` } : undefined}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragLeave={() => { if (dragOverIndex === index) { setDragOverIndex(null); setDragOverSide(null); } }}
                    >
                      {showLeftLine && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 z-10" />
                      )}
                      {col.label}
                      {showRightLine && (
                        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-blue-500 z-10" />
                      )}
                      {/* Resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/50 z-20"
                        onMouseDown={(e) => handleResizeStart(e, index)}
                        draggable={false}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-50/70 transition-colors group">
                  {columns.map((col) => {
                    if (col.id === 'key') return (
                      <td key={col.id} className="px-5 py-3.5 text-slate-500 font-medium">
                        <Link href={`/issues/${issue.id}`} className="hover:text-blue-600 hover:underline">
                          {issue.key}
                        </Link>
                      </td>
                    );
                    if (col.id === 'title') return (
                      <td key={col.id} className="px-5 py-3.5 font-semibold text-slate-800 overflow-hidden text-ellipsis">
                        <Link href={`/issues/${issue.id}`} className="hover:text-blue-600 block w-full truncate border-b border-transparent">
                          {issue.title}
                        </Link>
                      </td>
                    );
                    if (col.id === 'iteration') return (
                      <td key={col.id} className="px-5 py-3.5">
                        <select
                          value={issue.iterationId || ""}
                          onChange={(e) => handleInlineUpdate(issue.id, 'iterationId', e.target.value || null)}
                          className="text-sm font-medium text-slate-700 bg-transparent border-none p-0 outline-none focus:ring-0 cursor-pointer w-full truncate" style={{ appearance: 'none', WebkitAppearance: 'none' }}
                        >
                          <option value="">Backlog</option>
                          {iterations.map((it) => (
                            <option key={it.id} value={it.id}>{it.name}</option>
                          ))}
                        </select>
                      </td>
                    );
                    if (col.id === 'status') return (
                      <td key={col.id} className="px-5 py-3.5">
                        <select 
                          value={issue.status}
                          onChange={(e) => handleInlineUpdate(issue.id, 'status', e.target.value)}
                          className={`text-sm font-medium px-2 py-0.5 rounded-full cursor-pointer border-none outline-none focus:ring-0 transition-colors ${
                            issue.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' :
                            issue.status === 'IN_PROGRESS' || issue.status === 'IN_TESTING' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`} style={{ appearance: 'none', WebkitAppearance: 'none' }}
                        >
                          <option value="TODO">To Do</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="IN_TESTING">In Testing</option>
                          <option value="DONE">Done</option>
                        </select>
                      </td>
                    );
                    if (col.id === 'type') return (
                      <td key={col.id} className="px-5 py-3.5">
                        <select
                          value={issue.type}
                          onChange={(e) => handleInlineUpdate(issue.id, 'type', e.target.value)}
                          className="text-sm font-medium text-slate-700 bg-transparent border-none p-0 outline-none focus:ring-0 cursor-pointer w-full truncate" style={{ appearance: 'none', WebkitAppearance: 'none' }}
                        >
                          <option value="TASK">Task</option>
                          <option value="STORY">Story</option>
                          <option value="BUG">Bug</option>
                          <option value="EPIC">Epic</option>
                        </select>
                      </td>
                    );
                    if (col.id === 'priority') return (
                      <td key={col.id} className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full flex-shrink-0 ${issue.priority === 'URGENT' ? 'bg-red-600' : issue.priority === 'HIGH' ? 'bg-orange-500' : issue.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-green-400'}`}></span>
                           <select
                             value={issue.priority}
                             onChange={(e) => handleInlineUpdate(issue.id, 'priority', e.target.value)}
                             className="text-sm font-medium text-slate-700 bg-transparent border-none p-0 outline-none focus:ring-0 cursor-pointer w-full truncate" style={{ appearance: 'none', WebkitAppearance: 'none' }}
                           >
                             <option value="LOW">Low</option>
                             <option value="MEDIUM">Medium</option>
                             <option value="HIGH">High</option>
                             <option value="URGENT">Urgent</option>
                           </select>
                        </div>
                      </td>
                    );
                    if (col.id === 'assignee') return (
                      <td key={col.id} className="px-5 py-3.5">
                        <select
                          value={issue.assigneeId || ""}
                          onChange={(e) => handleInlineUpdate(issue.id, 'assigneeId', e.target.value || null)}
                          className="text-sm font-medium text-slate-700 bg-transparent border-none p-0 outline-none focus:ring-0 cursor-pointer w-full truncate" style={{ appearance: 'none', WebkitAppearance: 'none' }}
                        >
                          <option value="">Unassigned</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </td>
                    );
                    return <td key={col.id}></td>;
                  })}
                </tr>
              ))}

              {filteredIssues.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-16 text-center text-slate-500">
                    <p className="font-medium text-base mb-1">No issues match the criteria</p>
                    <p className="text-sm">Try adjusting your filters or creating a new issue.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination & Count area */}
        <div className="bg-slate-50 border-t px-5 py-3 flex items-center justify-between text-sm">
          <div className="text-slate-500 font-medium">
            Showing <span className="text-slate-800 font-bold">{filteredIssues.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="text-slate-800 font-bold">{Math.min(currentPage * itemsPerPage, filteredIssues.length)}</span> of <span className="text-slate-800 font-bold">{filteredIssues.length}</span> issues
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="font-medium text-slate-700 px-2 leading-none">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
