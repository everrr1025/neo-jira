"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { updateProject } from "@/app/actions/projects";
import { type Locale } from "@/lib/i18n";
import AlertPopup from "./AlertPopup";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Textarea } from "./ui/textarea";
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
          projectOwner: "项目负责人",
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
          projectOwner: "Project Owner",
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
    <form onSubmit={handleSubmit} className="max-w-5xl space-y-6">
      <AlertPopup message={alertMessage} onClose={() => setAlertMessage("")} autoCloseMs={6000} />

      {error ? (
        <div className="rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700">
          {text.updateSuccess}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{locale === "zh" ? "基础信息" : "Basic information"}</CardTitle>
          <CardDescription>{locale === "zh" ? "维护项目名称、标识和描述。" : "Maintain the project name, key, and description."}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="name">{text.projectName}</Label>
            <Input
              id="name"
              required
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="key">{text.projectKey}</Label>
            <Input
              id="key"
              required
              value={formData.key}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, key: event.target.value.toUpperCase() }))
              }
              className="uppercase"
              maxLength={10}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="owner">{text.projectOwner}</Label>
            <Input id="owner" value={project.owner?.name || project.owner?.email || ""} disabled />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="description">{text.description}</Label>
            <Textarea
              id="description"
              rows={4}
              value={formData.description}
              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>{text.workflowTitle}</CardTitle>
              <CardDescription>{text.workflowDesc}</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addStatus}>
              <Plus className="size-4" />
              {text.addStatus}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-3">
            {workflowDraft.statuses.map((status, index) => (
              <div key={status.clientId} className="rounded-lg border bg-muted/20 p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_190px_130px_auto]">
                  <div className="grid gap-2">
                    <Label>{text.statusName}</Label>
                    <Input
                      value={status.name}
                      onChange={(event) => updateStatus(status.clientId, "name", event.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>{text.statusCategory}</Label>
                    <Select
                      value={status.category}
                      onValueChange={(value) =>
                        updateStatus(status.clientId, "category", value as WorkflowStatusCategory)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>{text.initialStatus}</Label>
                    <label className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium">
                      <input
                        type="radio"
                        checked={status.isInitial}
                        onChange={() => setInitialStatus(status.clientId)}
                        className="size-4 accent-primary"
                      />
                      {text.initialStatus}
                    </label>
                  </div>

                  <div className="flex items-end justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => moveStatus(status.clientId, -1)}
                      disabled={index === 0}
                      title={text.moveUp}
                      aria-label={text.moveUp}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => moveStatus(status.clientId, 1)}
                      disabled={index === workflowDraft.statuses.length - 1}
                      title={text.moveDown}
                      aria-label={text.moveDown}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => removeStatus(status.clientId)}
                      title={text.removeStatus}
                      aria-label={text.removeStatus}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">{text.transitions}</h4>
                <Badge variant="secondary">{workflowDraft.transitions.size}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{text.transitionsHint}</p>
            </div>

            <div className="overflow-hidden rounded-lg border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="border-r">{text.transitions}</TableHead>
                    {workflowDraft.statuses.map((status) => (
                      <TableHead key={`column-${status.clientId}`} className="text-center">
                        {status.name.trim() || "-"}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflowDraft.statuses.map((fromStatus) => (
                    <TableRow key={`row-${fromStatus.clientId}`}>
                      <TableCell className="border-r font-medium">{fromStatus.name.trim() || "-"}</TableCell>
                      {workflowDraft.statuses.map((toStatus) => {
                        const transitionKey = `${fromStatus.clientId}->${toStatus.clientId}`;
                        const isSelf = fromStatus.clientId === toStatus.clientId;

                        return (
                          <TableCell key={transitionKey} className="text-center">
                            <input
                              type="checkbox"
                              checked={isSelf ? true : workflowDraft.transitions.has(transitionKey)}
                              disabled={isSelf}
                              onChange={() => toggleTransition(fromStatus.clientId, toStatus.clientId)}
                              className="size-4 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{text.workflowValidationHint}</p>
        </CardContent>
      </Card>

      <Card>
        <CardFooter className="justify-end gap-3 py-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {text.cancel}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? text.saving : text.saveChanges}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
