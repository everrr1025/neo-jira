"use client";

import { useState, useTransition } from "react";
import { updateProject } from "@/app/actions/projects";
import { useRouter } from "next/navigation";
import { Locale } from "@/lib/i18n";

type ProjectSettingsFormProps = {
  project: {
    id: string;
    name: string | null;
    key: string | null;
    description: string | null;
    owner?: {
      name: string | null;
      email: string | null;
    } | null;
  };
  locale: Locale;
};

export default function ProjectSettingsForm({ project, locale }: ProjectSettingsFormProps) {
  const router = useRouter();
  const text =
    locale === "zh"
      ? {
          updateFailed: "更新项目失败",
          updateSuccess: "项目更新成功",
          projectName: "项目名称",
          projectKey: "项目标识",
          projectKeyHint: "用于 issue 编号的短标识，例如 NJ、WEB。",
          projectOwner: "项目负责人",
          ownerLockedHint: "项目负责人创建后不可修改。",
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
          ownerLockedHint: "Project owner cannot be changed after creation.",
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
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-600">
          {text.updateSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-slate-700">
            {text.projectName}
          </label>
          <input
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="key" className="text-sm font-medium text-slate-700">
            {text.projectKey}
          </label>
          <input
            id="key"
            required
            value={formData.key}
            onChange={(e) => setFormData((prev) => ({ ...prev, key: e.target.value }))}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            maxLength={10}
          />
          <p className="text-xs text-slate-500">{text.projectKeyHint}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="owner" className="text-sm font-medium text-slate-700">
            {text.projectOwner}
          </label>
          <input
            id="owner"
            value={project.owner?.name || project.owner?.email || ""}
            disabled
            className="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
          <p className="text-xs text-slate-500">{text.ownerLockedHint}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-slate-700">
            {text.description}
          </label>
          <textarea
            id="description"
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          {text.cancel}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? text.saving : text.saveChanges}
        </button>
      </div>
    </form>
  );
}
