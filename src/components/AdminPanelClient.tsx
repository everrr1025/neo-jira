"use client";

import { useState, useTransition } from "react";
import { createUser, createProject, updateProjectMembers } from "@/app/actions/admin";
import { Users, FolderGit2, Plus, Shield, Check, Loader2 } from "lucide-react";

export default function AdminPanelClient({ initialUsers, initialProjects }: { initialUsers: any[], initialProjects: any[] }) {
  const [activeTab, setActiveTab] = useState<"USERS" | "PROJECTS">("USERS");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");
  
  return (
    <div className="flex flex-col flex-1 space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-200/50 p-1 w-fit rounded-lg">
        <button
          onClick={() => { setActiveTab("USERS"); setErrorMsg(""); }}
          className={`flex items-center gap-2 px-5 py-2 rounded-md font-medium text-sm transition-all ${
            activeTab === "USERS" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Users size={16} /> Users Management
        </button>
        <button
          onClick={() => { setActiveTab("PROJECTS"); setErrorMsg(""); }}
          className={`flex items-center gap-2 px-5 py-2 rounded-md font-medium text-sm transition-all ${
            activeTab === "PROJECTS" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FolderGit2 size={16} /> Projects & Access
        </button>
      </div>
      
      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium border border-red-100 flex items-center gap-2">
           {errorMsg}
        </div>
      )}

      {/* Views */}
      <div className="flex gap-6 flex-col xl:flex-row">
         {activeTab === "USERS" ? (
           <UsersView users={initialUsers} isPending={isPending} startTransition={startTransition} setErrorMsg={setErrorMsg} />
         ) : (
           <ProjectsView projects={initialProjects} users={initialUsers} isPending={isPending} startTransition={startTransition} setErrorMsg={setErrorMsg} />
         )}
      </div>
    </div>
  );
}

function UsersView({ users, isPending, startTransition, setErrorMsg }: any) {
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "USER" });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    startTransition(async () => {
      const res = await createUser(newUser);
      if (res.success) {
        setNewUser({ name: "", email: "", password: "", role: "USER" });
      } else {
        setErrorMsg(res.error || "Failed to create user");
      }
    });
  };

  return (
    <>
      <div className="xl:w-1/3 bg-white p-6 rounded-xl border shadow-sm h-fit">
        <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
          <Plus size={18} className="text-blue-600" /> Add New User
        </h3>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
            <input required type="text" value={newUser.name} onChange={e => setNewUser(p => ({...p, name: e.target.value}))} className="w-full border-slate-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Jane Doe" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <input required type="email" value={newUser.email} onChange={e => setNewUser(p => ({...p, email: e.target.value}))} className="w-full border-slate-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="jane@neo-jira.local" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <input required minLength={6} type="password" value={newUser.password} onChange={e => setNewUser(p => ({...p, password: e.target.value}))} className="w-full border-slate-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">System Role</label>
            <select value={newUser.role} onChange={e => setNewUser(p => ({...p, role: e.target.value}))} className="w-full border-slate-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white">
              <option value="USER">Base User</option>
              <option value="ADMIN">System Administrator</option>
            </select>
          </div>
          <button disabled={isPending} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md transition-colors shadow-sm disabled:opacity-50 mt-2 flex justify-center items-center gap-2">
            {isPending && <Loader2 size={16} className="animate-spin" />} Create User
          </button>
        </form>
      </div>
      
      <div className="xl:w-2/3 bg-white rounded-xl border shadow-sm overflow-hidden flex-1 h-fit">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-5 py-4 border-b">Name</th>
              <th className="px-5 py-4 border-b">Email</th>
              <th className="px-5 py-4 border-b w-32">Role</th>
              <th className="px-5 py-4 border-b w-40">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u: any) => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-800 flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                     {u.name?.charAt(0) || 'U'}
                   </div>
                   {u.name}
                </td>
                <td className="px-5 py-3 text-slate-600">{u.email}</td>
                <td className="px-5 py-3">
                   {u.role === 'ADMIN' ? (
                     <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit"><Shield size={12}/> ADMIN</span>
                   ) : (
                     <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">USER</span>
                   )}
                </td>
                <td className="px-5 py-3 text-slate-500 text-xs font-medium">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ProjectsView({ projects, users, isPending, startTransition, setErrorMsg }: any) {
  const [newProject, setNewProject] = useState({ name: "", key: "", description: "" });
  
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    startTransition(async () => {
      const res = await createProject({ ...newProject, memberIds: [] }); // Default to no members
      if (res.success) {
        setNewProject({ name: "", key: "", description: "" });
      } else {
        setErrorMsg(res.error || "Failed to create project");
      }
    });
  };

  const toggleMember = (projectId: string, userId: string, currentMembers: string[]) => {
    let newMembers = [...currentMembers];
    if (newMembers.includes(userId)) {
      newMembers = newMembers.filter(id => id !== userId);
    } else {
      newMembers.push(userId);
    }
    
    startTransition(async () => {
      const res = await updateProjectMembers(projectId, newMembers);
      if (!res.success) setErrorMsg(res.error || "Failed to update access");
    });
  }

  return (
    <>
      <div className="xl:w-1/3 bg-white p-6 rounded-xl border shadow-sm h-fit">
        <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
          <Plus size={18} className="text-emerald-600" /> Create Project
        </h3>
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Project Name</label>
            <input required type="text" value={newProject.name} onChange={e => setNewProject(p => ({...p, name: e.target.value}))} className="w-full border-slate-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Frontend App" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Key (2-4 uppercase letters)</label>
            <input required type="text" maxLength={4} pattern="[A-Z]+" value={newProject.key} onChange={e => setNewProject(p => ({...p, key: e.target.value.toUpperCase()}))} className="w-full border-slate-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono" placeholder="FE" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
            <textarea value={newProject.description} onChange={e => setNewProject(p => ({...p, description: e.target.value}))} className="w-full border-slate-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none h-20" placeholder="Optional details..." />
          </div>
          <button disabled={isPending} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-md transition-colors shadow-sm disabled:opacity-50 mt-2 flex justify-center items-center gap-2">
            {isPending && <Loader2 size={16} className="animate-spin" />} Create Project
          </button>
        </form>
      </div>

      <div className="xl:w-2/3 flex flex-col gap-4">
        {projects.map((p: any) => (
          <div key={p.id} className="bg-white rounded-xl border shadow-sm p-5 hover:border-slate-300 transition-colors flex flex-col gap-4">
            <div className="flex justify-between items-start">
               <div>
                 <div className="flex items-center gap-3 mb-1">
                   <h4 className="text-lg font-bold text-slate-800">{p.name}</h4>
                   <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold border font-mono tracking-wider">{p.key}</span>
                 </div>
                 <p className="text-sm text-slate-500">{p.description || "No description provided."}</p>
               </div>
               <div className="text-right text-xs bg-slate-50 p-2 rounded border border-slate-100">
                 <div className="text-slate-400">Created by <span className="font-semibold text-slate-600">{p.owner.name}</span></div>
                 <div className="text-slate-400 mt-1"><span className="font-bold text-slate-700">{p.issuesCount}</span> total issues</div>
               </div>
            </div>

            <div className="border-t pt-4 mt-2">
               <h5 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Users size={14} /> Team Access
               </h5>
               <div className="flex flex-wrap gap-2">
                 {users.map((u: any) => {
                   const hasAccess = p.members.includes(u.id);
                   const isAdmin = u.role === 'ADMIN';
                   
                   return (
                     <button
                       key={u.id}
                       disabled={isPending || isAdmin}
                       onClick={() => toggleMember(p.id, u.id, p.members)}
                       className={`flex items-center justify-between gap-3 px-3 py-2 border rounded-md text-sm transition-all focus:outline-none
                         ${isAdmin ? 'bg-slate-100 border-slate-200 opacity-70 cursor-not-allowed' : ''}
                         ${!isAdmin && hasAccess ? 'bg-blue-50 border-blue-200 hover:border-blue-400' : ''}
                         ${!isAdmin && !hasAccess ? 'bg-white border-slate-200 hover:border-slate-300' : ''}
                       `}
                       title={isAdmin ? "Admins have global access" : "Click to toggle access"}
                     >
                       <span className={`font-medium ${hasAccess || isAdmin ? 'text-slate-900' : 'text-slate-500'}`}>
                         {u.name}
                       </span>
                       {(hasAccess || isAdmin) ? (
                         <Check size={16} className={isAdmin ? 'text-slate-400' : 'text-blue-600'} />
                       ) : (
                         <div className="w-4 h-4 rounded-full border border-slate-300"></div>
                       )}
                     </button>
                   );
                 })}
               </div>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
           <div className="bg-white border border-dashed rounded-xl p-8 text-center text-slate-500 font-medium">
             No projects currently exist.
           </div>
        )}
      </div>
    </>
  )
}
