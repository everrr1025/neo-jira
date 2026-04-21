"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { updateProject } from "@/app/actions/projects";
import { type Locale } from "@/lib/i18n";
import AlertPopup from "./AlertPopup";
import {
  DEFAULT_WORKFLOW_TEMPLATE,
  getWorkflowCategoryLabel,
  getWorkflowStatusName,
  type WorkflowStatusCategory,
} from "@/lib/workflows";

type WorkflowStatusDraft = {
  clientId: string;
  id?: string;
  name: string;
  category: WorkflowStatusCategory;
  isInitial: boolean;
};

type WorkflowDraftState = {
  statuses: WorkflowStatusDraft[];
  transitions: Set<string>;
};

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
    workflowStatuses: Array<{
      id: string;
      key: string;
      name: string;
      category: string;
      position: number;
      isInitial: boolean;
    }>;
    workflowTransitions: Array<{
      fromStatusId: string;
      toStatusId: string;
    }>;
  };
  locale: Locale;
};

function cloneWorkflowDraftState(draft: WorkflowDraftState): WorkflowDraftState {
  return {
    statuses: draft.statuses.map((status) => ({ ...status })),
    transitions: new Set(draft.transitions),
  };
}

function buildInitialWorkflowDraft(
  project: ProjectSettingsFormProps["project"],
  locale: Locale
): WorkflowDraftState {
  const baseStatuses =
    project.workflowStatuses.length > 0
      ? [...project.workflowStatuses]
          .sort((a, b) => a.position - b.position)
          .map((status) => ({
            clientId: status.id,
            id: status.id,
            name: getWorkflowStatusName(status.key, [status], locale),
            category: status.category as WorkflowStatusCategory,
            isInitial: status.isInitial,
          }))
      : (DEFAULT_WORKFLOW_TEMPLATE.statuses.map((status) => ({
          clientId: status.key,
          name: getWorkflowStatusName(
            status.key,
            [
              {
                id: status.key,
                key: status.key,
                name: status.name,
                category: status.category,
                position: status.position,
                isInitial: status.isInitial,
              },
            ],
            locale
          ),
          category: status.category,
          isInitial: status.isInitial,
        })) as WorkflowStatusDraft[]);

  const baseTransitions =
    project.workflowTransitions.length > 0
      ? new Set(
          project.workflowTransitions.map(
            (transition) => `${transition.fromStatusId}->${transition.toStatusId}`
          )
        )
      : new Set(
          DEFAULT_WORKFLOW_TEMPLATE.transitions
            .map((transition) => {
              const fromStatus = baseStatuses.find((status) => status.clientId === transition.fromKey);
              const toStatus = baseStatuses.find((status) => status.clientId === transition.toKey);
              return fromStatus && toStatus ? `${fromStatus.clientId}->${toStatus.clientId}` : "";
            })
            .filter(Boolean)
        );

  return { statuses: baseStatuses, transitions: baseTransitions };
}

function formatWorkflowSaveError(rawError: string, locale: Locale) {
  if (rawError.startsWith("Cannot remove statuses that are still used by issues:")) {
    const statusKeys = rawError
      .split(":")
      .slice(1)
      .join(":")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (locale === "zh") {
      return `保存失败：仍有 Issue 正在使用这些状态，不能直接删除：${statusKeys.join("、")}。请先将这些 Issue 移到其他状态后再保存。`;
    }

    return `Save failed: some issues are still using these statuses, so they cannot be deleted directly: ${statusKeys.join(
      ", "
    )}. Move those issues to another status first, then save again.`;
  }

  if (rawError === "Workflow must contain at least two statuses") {
    return locale === "zh"
      ? "保存失败：工作流至少需要保留 2 个状态。"
      : "Save failed: a workflow must keep at least 2 statuses.";
  }

  if (rawError === "Workflow must have exactly one initial status") {
    return locale === "zh"
      ? "保存失败：工作流必须且只能有 1 个初始状态。"
      : "Save failed: a workflow must have exactly 1 initial status.";
  }

  if (rawError === "Workflow must include at least one done status") {
    return locale === "zh"
      ? "保存失败：工作流至少需要有 1 个已完成状态。"
      : "Save failed: a workflow must include at least 1 done status.";
  }

  if (rawError === "Workflow status name is required") {
    return locale === "zh" ? "保存失败：状态名称不能为空。" : "Save failed: status name is required.";
  }

  return rawError;
}

export default function ProjectSettingsForm({ project, locale }: ProjectSettingsFormProps) {
  const router = useRouter();
  const text =
    locale === "zh"
      ? {
          updateFailed: "更新项目失败",
          updateSuccess: "项目更新成功",
          projectName: "项目名称",
          projectKey: "项目标识",
          projectKeyHint: "用于 Issue 编号的短标识，例如 NJ、WEB。",
          projectOwner: "项目负责人",
          ownerLockedHint: "项目负责人在创建后不可修改。",
          description: "项目描述",
          cancel: "取消",
          saveChanges: "保存更改",
          saving: "保存中...",
          workflowTitle: "工作流模板",
          workflowDesc: "按项目维护状态列表、状态分类以及允许的流转路径。",
          statusName: "状态名称",
          statusCategory: "状态分类",
          initialStatus: "初始状态",
          transitions: "允许流转",
          addStatus: "新增状态",
          removeStatus: "删除状态",
          moveUp: "上移",
          moveDown: "下移",
          transitionsHint: "勾选从行状态流转到列状态时允许的路径。",
          workflowValidationHint: "至少保留 2 个状态，并确保只有 1 个初始状态。",
          cannotRemoveLastStatuses: "工作流至少需要保留 2 个状态。",
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
          workflowTitle: "Workflow Template",
          workflowDesc: "Configure statuses, status categories, and allowed transitions per project.",
          statusName: "Status Name",
          statusCategory: "Category",
          initialStatus: "Initial",
          transitions: "Transitions",
          addStatus: "Add Status",
          removeStatus: "Remove Status",
          moveUp: "Move up",
          moveDown: "Move down",
          transitionsHint: "Check the paths that can move from the row status to the column status.",
          workflowValidationHint: "Keep at least two statuses and exactly one initial status.",
          cannotRemoveLastStatuses: "Workflow must keep at least two statuses.",
        };

  const [isPending, startTransition] = useTransition();
  const initialWorkflowDraft = useMemo(() => buildInitialWorkflowDraft(project, locale), [project, locale]);
  const [formData, setFormData] = useState({
    name: project.name || "",
    key: project.key || "",
    description: project.description || "",
  });
  const [workflowDraft, setWorkflowDraft] = useState<WorkflowDraftState>(() =>
    cloneWorkflowDraftState(initialWorkflowDraft)
  );
  const [savedWorkflowDraft, setSavedWorkflowDraft] = useState<WorkflowDraftState>(() =>
    cloneWorkflowDraftState(initialWorkflowDraft)
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const categoryOptions = useMemo(
    () =>
      (["TODO", "IN_PROGRESS", "DONE"] as WorkflowStatusCategory[]).map((category) => ({
        value: category,
        label: getWorkflowCategoryLabel(category, locale),
      })),
    [locale]
  );

  const setInitialStatus = (clientId: string) => {
    setWorkflowDraft((prev) => ({
      ...prev,
      statuses: prev.statuses.map((status) => ({
        ...status,
        isInitial: status.clientId === clientId,
      })),
    }));
  };

  const updateStatus = <K extends keyof WorkflowStatusDraft>(
    clientId: string,
    field: K,
    value: WorkflowStatusDraft[K]
  ) => {
    setWorkflowDraft((prev) => ({
      ...prev,
      statuses: prev.statuses.map((status) =>
        status.clientId === clientId ? { ...status, [field]: value } : status
      ),
    }));
  };

  const moveStatus = (clientId: string, direction: -1 | 1) => {
    setWorkflowDraft((prev) => {
      const index = prev.statuses.findIndex((status) => status.clientId === clientId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= prev.statuses.length) {
        return prev;
      }

      const nextStatuses = [...prev.statuses];
      const [movedStatus] = nextStatuses.splice(index, 1);
      nextStatuses.splice(targetIndex, 0, movedStatus);

      return { ...prev, statuses: nextStatuses };
    });
  };

  const addStatus = () => {
    const nextId = `temp-${Date.now()}`;
    setWorkflowDraft((prev) => ({
      ...prev,
      statuses: [
        ...prev.statuses,
        {
          clientId: nextId,
          name: locale === "zh" ? "新状态" : "New Status",
          category: "IN_PROGRESS",
          isInitial: false,
        },
      ],
    }));
  };

  const removeStatus = (clientId: string) => {
    setError(null);
    setSuccess(false);
    setAlertMessage("");

    setWorkflowDraft((prev) => {
      if (prev.statuses.length <= 2) {
        setError(text.cannotRemoveLastStatuses);
        setAlertMessage(text.cannotRemoveLastStatuses);
        return prev;
      }

      const nextStatuses = prev.statuses.filter((status) => status.clientId !== clientId);
      const nextTransitions = new Set(
        [...prev.transitions].filter(
          (transitionKey) =>
            !transitionKey.startsWith(`${clientId}->`) && !transitionKey.endsWith(`->${clientId}`)
        )
      );

      if (!nextStatuses.some((status) => status.isInitial)) {
        nextStatuses[0] = { ...nextStatuses[0], isInitial: true };
      }

      return {
        statuses: nextStatuses,
        transitions: nextTransitions,
      };
    });
  };

  const toggleTransition = (fromClientId: string, toClientId: string) => {
    const transitionKey = `${fromClientId}->${toClientId}`;

    setWorkflowDraft((prev) => {
      const nextTransitions = new Set(prev.transitions);
      if (nextTransitions.has(transitionKey)) {
        nextTransitions.delete(transitionKey);
      } else {
        nextTransitions.add(transitionKey);
      }
      return { ...prev, transitions: nextTransitions };
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setAlertMessage("");

    startTransition(async () => {
      const submittedWorkflowDraft = cloneWorkflowDraftState(workflowDraft);
      const result = await updateProject(project.id, {
        ...formData,
        workflow: {
          statuses: submittedWorkflowDraft.statuses.map((status, index) => ({
            clientId: status.clientId,
            id: status.id,
            name: status.name,
            category: status.category,
            isInitial: status.isInitial,
            position: index,
          })),
          transitions: [...submittedWorkflowDraft.transitions].map((transitionKey) => {
            const [fromClientId, toClientId] = transitionKey.split("->");
            return { fromClientId, toClientId };
          }),
        },
      });

      if (result.success) {
        setSavedWorkflowDraft(cloneWorkflowDraftState(submittedWorkflowDraft));
        setSuccess(true);
        router.refresh();
        return;
      }

      const formattedError = formatWorkflowSaveError(result.error || text.updateFailed, locale);
      setWorkflowDraft(cloneWorkflowDraftState(savedWorkflowDraft));
      setError(formattedError);
      setAlertMessage(formattedError);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
      <AlertPopup message={alertMessage} onClose={() => setAlertMessage("")} autoCloseMs={6000} />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : null}

      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-600">
          {text.updateSuccess}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-slate-700">
            {text.projectName}
          </label>
          <input
            id="name"
            required
            value={formData.name}
            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
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
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, key: event.target.value.toUpperCase() }))
            }
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
            onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
            className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{text.workflowTitle}</h3>
            <p className="mt-1 text-sm text-slate-500">{text.workflowDesc}</p>
          </div>
          <button
            type="button"
            onClick={addStatus}
            className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            <Plus size={16} />
            {text.addStatus}
          </button>
        </div>

        <div className="space-y-3">
          {workflowDraft.statuses.map((status, index) => (
            <div key={status.clientId} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_180px_110px_auto]">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500">{text.statusName}</label>
                  <input
                    value={status.name}
                    onChange={(event) => updateStatus(status.clientId, "name", event.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500">{text.statusCategory}</label>
                  <div className="relative">
                    <select
                      value={status.category}
                      onChange={(event) =>
                        updateStatus(status.clientId, "category", event.target.value as WorkflowStatusCategory)
                      }
                      className="w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    >
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500">{text.initialStatus}</label>
                  <label className="inline-flex h-[42px] items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700">
                    <input
                      type="radio"
                      checked={status.isInitial}
                      onChange={() => setInitialStatus(status.clientId)}
                    />
                    {text.initialStatus}
                  </label>
                </div>

                <div className="flex items-end justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => moveStatus(status.clientId, -1)}
                    disabled={index === 0}
                    className="rounded-md border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title={text.moveUp}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStatus(status.clientId, 1)}
                    disabled={index === workflowDraft.statuses.length - 1}
                    className="rounded-md border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title={text.moveDown}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStatus(status.clientId)}
                    className="rounded-md border border-red-200 p-2 text-red-600 transition-colors hover:bg-red-50"
                    title={text.removeStatus}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">{text.transitions}</h4>
            <p className="text-xs text-slate-500">{text.transitionsHint}</p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">
                    {text.transitions}
                  </th>
                  {workflowDraft.statuses.map((status) => (
                    <th
                      key={`column-${status.clientId}`}
                      className="border-b border-slate-200 px-3 py-2 text-center font-semibold text-slate-600"
                    >
                      {status.name.trim() || "-"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workflowDraft.statuses.map((fromStatus) => (
                  <tr key={`row-${fromStatus.clientId}`} className="odd:bg-slate-50/40">
                    <td className="border-r border-slate-200 px-3 py-2 font-medium text-slate-700">
                      {fromStatus.name.trim() || "-"}
                    </td>
                    {workflowDraft.statuses.map((toStatus) => {
                      const transitionKey = `${fromStatus.clientId}->${toStatus.clientId}`;
                      const isSelf = fromStatus.clientId === toStatus.clientId;

                      return (
                        <td key={transitionKey} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelf ? true : workflowDraft.transitions.has(transitionKey)}
                            disabled={isSelf}
                            onChange={() => toggleTransition(fromStatus.clientId, toStatus.clientId)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">{text.workflowValidationHint}</p>
      </section>

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
