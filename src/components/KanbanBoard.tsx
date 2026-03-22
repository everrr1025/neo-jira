"use client";

import { useState, useTransition, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { updateIssueStatus } from "@/app/actions/issues";

type Issue = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  assignee?: { name: string | null } | null;
  reporter?: { name: string | null } | null;
};

const COLUMNS = [
  { id: "TODO", title: "To Do", bg: "bg-slate-100", border: "border-slate-200" },
  { id: "IN_PROGRESS", title: "In Progress", bg: "bg-blue-50", border: "border-blue-100" },
  { id: "IN_REVIEW", title: "In Review", bg: "bg-purple-50", border: "border-purple-100" },
  { id: "DONE", title: "Done", bg: "bg-emerald-50", border: "border-emerald-100" },
];

export default function KanbanBoard({ initialIssues }: { initialIssues: Issue[] }) {
  const [issues, setIssues] = useState(initialIssues);
  const [isPending, startTransition] = useTransition();

  // Sync state if initialIssues change from the server
  useEffect(() => {
    setIssues(initialIssues);
  }, [initialIssues]);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // Optimistic Update
    const draggedIssue = issues.find(i => i.id === draggableId);
    if (!draggedIssue) return;

    const newStatus = destination.droppableId;
    
    // Create new array with updated status
    const newIssues = issues.map(issue => 
      issue.id === draggableId ? { ...issue, status: newStatus } : issue
    );
    
    setIssues(newIssues);

    // Persist to server via Server Action
    startTransition(() => {
      updateIssueStatus(draggableId, newStatus);
    });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 items-start">
        {COLUMNS.map((col) => {
          const colIssues = issues.filter(i => i.status === col.id);
          
          return (
            <div key={col.id} className={`flex-shrink-0 w-80 rounded-xl border flex flex-col max-h-full ${col.bg} ${col.border}`}>
              <div className="p-3 font-semibold text-slate-700 flex items-center justify-between text-sm uppercase tracking-wide">
                {col.title}
                <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold border shadow-sm">
                  {colIssues.length}
                </span>
              </div>
              
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef}
                    className={`flex-1 overflow-y-auto p-2 space-y-3 min-h-[150px] transition-colors rounded-b-xl ${snapshot.isDraggingOver ? 'bg-black/5' : ''}`}
                  >
                    {colIssues.map((ticket, index) => (
                      <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                        {(provided, snapshot) => (
                          <div 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-white p-3.5 rounded-lg border shadow-sm hover:shadow-md transition-shadow group ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500/50 opacity-90 rotate-2' : ''}`}
                            style={{...provided.draggableProps.style}}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600 transition-colors">{ticket.key}</span>
                              <span className={`w-2 h-2 rounded-full ${ticket.priority === 'URGENT' ? 'bg-red-600' : ticket.priority === 'HIGH' ? 'bg-orange-500' : ticket.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-green-400'}`} title={`${ticket.priority} Priority`}></span>
                            </div>
                            <h4 className="text-sm font-medium text-slate-800 leading-snug mb-3 text-left">
                              {ticket.title}
                            </h4>
                            <div className="flex items-center justify-between mt-auto">
                              <div className="flex gap-1">
                                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">{ticket.type}</span>
                              </div>
                              {ticket.assignee && (
                                <div className="w-6 h-6 rounded-full bg-slate-200 border border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0" title={ticket.assignee.name || ''}>
                                  {ticket.assignee.name?.charAt(0) || 'U'}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    
                    {colIssues.length === 0 && !snapshot.isDraggingOver && (
                      <div className="h-24 flex items-center justify-center text-sm font-medium text-slate-400 border-2 border-dashed border-slate-200/50 rounded-lg mx-2">
                        Drop here
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
