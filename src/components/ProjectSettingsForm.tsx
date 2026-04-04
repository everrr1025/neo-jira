"use client";

import { useState, useTransition } from "react";
import { updateProject } from "@/app/actions/projects";
import { useRouter } from "next/navigation";
import { Locale } from "@/lib/i18n";

type ProjectSettingsFormProps = {
  project: any;
  users: any[];
  locale: Locale;
};

export default function ProjectSettingsForm({ project, users, locale }: ProjectSettingsFormProps) {
  const router = useRouter();
  const text =
    locale === "zh"
      ? {
          updateFailed: "更新项目失败",
          updateSuccess: "项目更新成功！",
          projectName: "项目名称",
          projectKey: "项目标识",
          projectKeyHint: "用于 issue 编号的短标识（例如：NJ、WEB）。",
          projectOwner: "项目负责人",
          description: "项目描述",
          cancel: "取消",
          saveChanges: "保存更改",
          saving: "保存中...",
        }
      : {
          updateFailed: "Failed to update project",
          updateSuccess: "Project updated successfully!",
          projectName: "Project Name",
          projectKey: "Project Key",
          projectKeyHint: "Short identifier for issues (e.g., NJ, WEB).",
          projectOwner: "Project Owner",
          description: "Description",
          cancel: "Cancel",
          saveChanges: "Save Changes",
          saving: "Saving...",
        };

  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    name: project.name || "",
    key: project.key || "",
    description: project.description || "",
    ownerId: project.ownerId || "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await updateProject(project.id, formData);
      if (result.success) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(result.error || text.updateFailed);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg text-sm font-medium">
          {text.updateSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-slate-700">{text.projectName}</label>
          <input 
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="key" className="text-sm font-medium text-slate-700">{text.projectKey}</label>
          <input 
            id="key"
            required
            value={formData.key}
            onChange={(e) => setFormData(prev => ({...prev, key: e.target.value}))}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow uppercase"
            maxLength={10}
          />
          <p className="text-xs text-slate-500">{text.projectKeyHint}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="owner" className="text-sm font-medium text-slate-700">{text.projectOwner}</label>
          <select 
            id="owner"
            value={formData.ownerId}
            onChange={(e) => setFormData(prev => ({...prev, ownerId: e.target.value}))}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-slate-700">{text.description}</label>
          <textarea 
            id="description"
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button 
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
        >
          {text.cancel}
        </button>
        <button 
          type="submit" 
          disabled={isPending}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
        >
          {isPending ? text.saving : text.saveChanges}
        </button>
      </div>
    </form>
  );
}
