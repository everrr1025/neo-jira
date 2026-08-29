"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, ChevronsUpDown, Loader2, Search, X } from "lucide-react";

import { updateDepartmentMemberSettings } from "@/app/actions/departments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DepartmentWorkspaceData, DepartmentWorkspaceMember } from "@/lib/departmentWorkspace";
import type { Locale } from "@/lib/i18n";

type MultiSelectOption = {
  id: string;
  label: string;
  description?: string | null;
  disabled?: boolean;
  disabledReason?: string;
};
type CollapsibleSectionId = "projectAccess" | "taskAssignment" | "announcements";

const TEXT = {
  en: {
    title: "Member settings",
    back: "Back to members",
    save: "Save",
    saving: "Saving",
    expand: "Expand",
    collapse: "Collapse",
    basic: "Basic information",
    position: "Position",
    noPosition: "No position",
    projectAccess: "Project access",
    accessScope: "Access scope",
    noProjects: "No projects",
    allProjects: "All projects",
    selectedProjects: "Selected projects",
    accessibleProjects: "Accessible projects",
    searchProjects: "Search projects",
    noMatchingProjects: "No matching projects",
    taskAssignment: "Task assignment",
    byPerson: "By person",
    byPosition: "By position",
    byProjectMembers: "By project members",
    searchMembers: "Search members",
    noMatchingMembers: "No matching members",
    searchPositions: "Search positions",
    noMatchingPositions: "No matching positions",
    noProjectMembers: "No project members",
    allProjectMembers: "All project members",
    selectedProjectMembers: "Selected project members",
    assignableProjectMembers: "Assignable project members",
    assignablePreview: "Assignable people preview",
    noAssignablePeople: "No assignable people",
    self: "Self",
    person: "Person",
    project: "Project",
    defaultTask: "Default from project owner",
    announcements: "Announcement permissions",
    canPublishDepartment: "Can publish department announcements",
    announcementScope: "Project announcement access",
    noProjectAnnouncements: "No project announcements",
    allProjectAnnouncements: "All project announcements",
    selectedProjectAnnouncements: "Selected project announcements",
    announcementProjects: "Projects allowed for announcements",
    selected: "selected",
    defaultAccess: "Default access from project membership",
    defaultAnnouncement: "Default access as project owner",
    updateFailed: "Failed to update member settings",
    selectedProjectsMustBelong: "Selected projects must belong to this department.",
    positionNotFound: "Position not found.",
  },
  zh: {
    title: "成员设置",
    back: "返回成员列表",
    save: "保存",
    saving: "保存中",
    expand: "展开",
    collapse: "折叠",
    basic: "基础信息",
    position: "岗位",
    noPosition: "未设置岗位",
    projectAccess: "项目访问",
    accessScope: "访问权限",
    noProjects: "无项目",
    allProjects: "全部项目",
    selectedProjects: "指定项目",
    accessibleProjects: "可访问项目",
    searchProjects: "搜索项目",
    noMatchingProjects: "没有匹配的项目",
    taskAssignment: "任务分派",
    byPerson: "按人员",
    byPosition: "按岗位",
    byProjectMembers: "按项目成员",
    searchMembers: "搜索成员",
    noMatchingMembers: "没有匹配的成员",
    searchPositions: "搜索岗位",
    noMatchingPositions: "没有匹配的岗位",
    noProjectMembers: "无项目成员",
    allProjectMembers: "全部项目成员",
    selectedProjectMembers: "指定项目成员",
    assignableProjectMembers: "可分派项目成员",
    assignablePreview: "可分派人员预览",
    noAssignablePeople: "暂无可分派人员",
    self: "本人",
    person: "人员",
    project: "项目",
    defaultTask: "负责项目默认可分派",
    announcements: "公告权限",
    canPublishDepartment: "可发布部门公告",
    announcementScope: "项目公告权限",
    noProjectAnnouncements: "无项目公告权限",
    allProjectAnnouncements: "全部项目公告",
    selectedProjectAnnouncements: "指定项目公告",
    announcementProjects: "可发布公告的项目",
    selected: "已选",
    defaultAccess: "参与项目默认可访问",
    defaultAnnouncement: "项目负责人默认可发布",
    updateFailed: "更新成员设置失败",
    selectedProjectsMustBelong: "所选项目必须属于当前部门。",
    positionNotFound: "岗位不存在。",
  },
} as const;

function displayMember(member: Pick<DepartmentWorkspaceMember, "userName" | "userEmail">) {
  return member.userName || member.userEmail;
}

function translateSettingsError(message: string | undefined, locale: Locale) {
  const t = TEXT[locale];
  if (!message) return t.updateFailed;
  if (message.includes("Selected projects must belong to this department")) return t.selectedProjectsMustBelong;
  if (message.includes("Position not found")) return t.positionNotFound;
  return message;
}

function SearchableMultiSelect({
  label,
  placeholder,
  emptyText,
  selectedLabel,
  options,
  selectedIds,
  onChange,
}: {
  label: string;
  placeholder: string;
  emptyText: string;
  selectedLabel: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedSet = new Set(selectedIds);
  const selectedOptions = options.filter((option) => selectedSet.has(option.id));
  const filteredOptions = options.filter((option) => {
    const haystack = `${option.label} ${option.description || ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const toggleOption = (option: MultiSelectOption) => {
    if (option.disabled) return;
    onChange(
      selectedSet.has(option.id)
        ? selectedIds.filter((id) => id !== option.id)
        : Array.from(new Set([...selectedIds, option.id])),
    );
  };

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-auto min-h-10 justify-between gap-2 px-3 text-left font-normal">
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {selectedOptions.length > 0 ? `${selectedOptions.length} ${selectedLabel}` : placeholder}
            </span>
            <ChevronsUpDown size={15} className="shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(520px,calc(100vw-2rem))] p-0" align="start">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search size={15} className="text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const checked = selectedSet.has(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleOption(option)}
                    disabled={option.disabled}
                    className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border ${checked ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>
                      {checked ? <Check size={12} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{option.label}</span>
                      {option.description || option.disabledReason ? (
                        <span className="block truncate text-xs text-muted-foreground">{option.disabledReason || option.description}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">{emptyText}</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <Badge key={option.id} variant="secondary" className="gap-1">
              <span className="max-w-44 truncate">{option.label}</span>
              {!option.disabled ? (
                <button
                  type="button"
                  onClick={() => onChange(selectedIds.filter((id) => id !== option.id))}
                  className="rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X size={12} />
                </button>
              ) : null}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function DepartmentMemberSettingsClient({
  department,
  member,
  locale,
}: {
  department: DepartmentWorkspaceData;
  member: DepartmentWorkspaceMember;
  locale: Locale;
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const ownerProjectIds = useMemo(
    () => department.projects.filter((project) => project.ownerId === member.userId).map((project) => project.id),
    [department.projects, member.userId],
  );
  const defaultAccessProjectIds = useMemo(
    () => Array.from(new Set([...member.projects.map((project) => project.id), ...ownerProjectIds])),
    [member.projects, ownerProjectIds],
  );
  const defaultTaskProjectIds = ownerProjectIds;
  const defaultAnnouncementProjectIds = ownerProjectIds;
  const defaultAccessProjectIdSet = useMemo(() => new Set(defaultAccessProjectIds), [defaultAccessProjectIds]);
  const defaultTaskProjectIdSet = useMemo(() => new Set(defaultTaskProjectIds), [defaultTaskProjectIds]);
  const defaultAnnouncementProjectIdSet = useMemo(() => new Set(defaultAnnouncementProjectIds), [defaultAnnouncementProjectIds]);
  const projectOptions = useMemo<MultiSelectOption[]>(
    () => department.projects.map((project) => ({ id: project.id, label: project.name, description: project.key })),
    [department.projects],
  );
  const positionOptions = useMemo<MultiSelectOption[]>(
    () => department.positions.map((position) => ({ id: position.id, label: position.name })),
    [department.positions],
  );
  const memberOptions = useMemo<MultiSelectOption[]>(
    () =>
      department.members
      .filter((departmentMember) => !departmentMember.disabledAt)
      .map((departmentMember) => ({
        id: departmentMember.userId,
        label: displayMember(departmentMember),
        description: departmentMember.positionName || departmentMember.userEmail,
        disabled: Boolean(departmentMember.disabledAt),
      })),
    [department.members],
  );
  const projectAccessOptions = useMemo<MultiSelectOption[]>(
    () =>
      projectOptions.map((project) => ({
        ...project,
        disabled: defaultAccessProjectIdSet.has(project.id),
        disabledReason: defaultAccessProjectIdSet.has(project.id) ? t.defaultAccess : project.description || undefined,
      })),
    [defaultAccessProjectIdSet, projectOptions, t.defaultAccess],
  );
  const taskProjectOptions = useMemo<MultiSelectOption[]>(
    () =>
      projectOptions.map((project) => ({
        ...project,
        disabled: defaultTaskProjectIdSet.has(project.id),
        disabledReason: defaultTaskProjectIdSet.has(project.id) ? t.defaultTask : project.description || undefined,
      })),
    [defaultTaskProjectIdSet, projectOptions, t.defaultTask],
  );
  const announcementProjectOptions = useMemo<MultiSelectOption[]>(
    () =>
      projectOptions.map((project) => ({
        ...project,
        disabled: defaultAnnouncementProjectIdSet.has(project.id),
        disabledReason: defaultAnnouncementProjectIdSet.has(project.id) ? t.defaultAnnouncement : project.description || undefined,
      })),
    [defaultAnnouncementProjectIdSet, projectOptions, t.defaultAnnouncement],
  );
  const allProjectIds = useMemo(() => projectOptions.map((project) => project.id), [projectOptions]);
  const [errorMsg, setErrorMsg] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<CollapsibleSectionId, boolean>>({
    projectAccess: false,
    taskAssignment: false,
    announcements: false,
  });
  const [form, setForm] = useState({
    positionId: member.positionId || "none",
    projectScopeType: member.projectScopeType === "NONE" && ownerProjectIds.length > 0 ? "SELECTED_PROJECTS" : member.projectScopeType || "NONE",
    managedProjectIds: member.managedProjectIds,
    taskAssigneeIds: member.taskAssigneeIds,
    taskPositionIds: member.taskPositionIds,
    taskProjectScopeType: member.taskProjectScopeType === "NONE" && ownerProjectIds.length > 0
      ? "SELECTED_PROJECTS"
      : member.taskProjectScopeType || "NONE",
    taskProjectIds: member.taskProjectIds,
    canCreateDepartmentAnnouncements: member.canCreateDepartmentAnnouncements,
    announcementProjectScopeType: member.announcementProjectScopeType === "NONE" && ownerProjectIds.length > 0
      ? "SELECTED_PROJECTS"
      : member.announcementProjectScopeType || "NONE",
    announcementProjectIds: member.announcementProjectIds,
  });
  const selectedAccessProjectIds = useMemo(() => {
    if (form.projectScopeType === "ALL_PROJECTS") return allProjectIds;
    if (form.projectScopeType === "SELECTED_PROJECTS") {
      return Array.from(new Set([...form.managedProjectIds, ...defaultAccessProjectIds]));
    }
    return defaultAccessProjectIds;
  }, [allProjectIds, defaultAccessProjectIds, form.managedProjectIds, form.projectScopeType]);
  const selectedTaskProjectIds = useMemo(() => {
    if (form.taskProjectScopeType === "ALL_PROJECTS") return allProjectIds;
    if (form.taskProjectScopeType === "SELECTED_PROJECTS") {
      return Array.from(new Set([...form.taskProjectIds, ...defaultTaskProjectIds]));
    }
    return defaultTaskProjectIds;
  }, [allProjectIds, defaultTaskProjectIds, form.taskProjectIds, form.taskProjectScopeType]);
  const selectedAnnouncementProjectIds = useMemo(() => {
    if (form.announcementProjectScopeType === "ALL_PROJECTS") return allProjectIds;
    if (form.announcementProjectScopeType === "SELECTED_PROJECTS") {
      return Array.from(new Set([...form.announcementProjectIds, ...defaultAnnouncementProjectIds]));
    }
    return defaultAnnouncementProjectIds;
  }, [allProjectIds, defaultAnnouncementProjectIds, form.announcementProjectIds, form.announcementProjectScopeType]);
  const taskAssigneePreview = useMemo(() => {
    const selectedTaskProjectIdSet = new Set(selectedTaskProjectIds);
    const selectedTaskPositionIds = new Set(form.taskPositionIds);
    const selectedTaskAssigneeIds = new Set(form.taskAssigneeIds);

    return department.members
      .map((departmentMember) => {
        const sourceLabels: string[] = [];
        if (departmentMember.userId === member.userId) sourceLabels.push(t.self);
        if (selectedTaskAssigneeIds.has(departmentMember.userId)) sourceLabels.push(t.person);
        if (departmentMember.positionId && selectedTaskPositionIds.has(departmentMember.positionId)) sourceLabels.push(t.position);
        const memberProjectIds = departmentMember.projects.map((project) => project.id);
        if (form.taskProjectScopeType === "ALL_PROJECTS" && memberProjectIds.length > 0) {
          sourceLabels.push(t.allProjects);
        }
        if (memberProjectIds.some((projectId) => selectedTaskProjectIdSet.has(projectId))) {
          sourceLabels.push(t.project);
        }
        return sourceLabels.length > 0 ? { member: departmentMember, sourceLabels: Array.from(new Set(sourceLabels)) } : null;
      })
      .filter((entry): entry is { member: DepartmentWorkspaceMember; sourceLabels: string[] } => Boolean(entry));
  }, [department.members, form.taskAssigneeIds, form.taskPositionIds, form.taskProjectScopeType, member.userId, selectedTaskProjectIds, t.allProjects, t.person, t.position, t.project, t.self]);

  const handleSave = () => {
    setErrorMsg("");
    startTransition(async () => {
      const res = await updateDepartmentMemberSettings(department.id, member.userId, {
        positionId: form.positionId === "none" ? null : form.positionId,
        projectScopeType: form.projectScopeType,
        managedProjectIds: form.managedProjectIds.filter((projectId) => !defaultAccessProjectIdSet.has(projectId)),
        taskAssigneeIds: form.taskAssigneeIds,
        taskPositionIds: form.taskPositionIds,
        taskProjectScopeType: form.taskProjectScopeType,
        taskProjectIds: form.taskProjectIds.filter((projectId) => !defaultTaskProjectIdSet.has(projectId)),
        canCreateDepartmentAnnouncements: form.canCreateDepartmentAnnouncements,
        announcementProjectScopeType: form.announcementProjectScopeType,
        announcementProjectIds: form.announcementProjectIds.filter((projectId) => !defaultAnnouncementProjectIdSet.has(projectId)),
      });
      if (!res.success) {
        setErrorMsg(translateSettingsError(res.error, locale));
        return;
      }
      router.push(`/departments/${department.id}/members`);
      router.refresh();
    });
  };
  const toggleSection = (sectionId: CollapsibleSectionId) => {
    setCollapsedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  };
  const renderCollapseButton = (sectionId: CollapsibleSectionId, label: string) => {
    const isCollapsed = collapsedSections[sectionId];
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => toggleSection(sectionId)}
        aria-expanded={!isCollapsed}
        aria-label={`${isCollapsed ? t.expand : t.collapse} ${label}`}
        className="shrink-0"
      >
        <ChevronDown size={16} className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
      </Button>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Button asChild type="button" variant="ghost" size="icon-sm" className="-ml-2" title={t.back}>
              <Link href={`/departments/${department.id}/members`} aria-label={t.back}>
                <ArrowLeft size={18} />
              </Link>
            </Button>
            <h2 className="truncate text-2xl font-bold tracking-tight text-foreground">{t.title}</h2>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground sm:pl-8">
            {displayMember(member)} · {member.userEmail}
          </p>
        </div>
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
          {isPending ? t.saving : t.save}
        </Button>
      </div>

      {errorMsg ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {errorMsg}
        </div>
      ) : null}

      <section className="space-y-4 rounded-lg border bg-card p-5 shadow-sm">
        <h3 className="text-base font-semibold text-foreground">{t.basic}</h3>
        <div className="grid gap-2">
          <Label>{t.position}</Label>
          <Select
            value={form.positionId}
            onValueChange={(value) => setForm((current) => ({ ...current, positionId: value }))}
          >
            <SelectTrigger className="w-full bg-background sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t.noPosition}</SelectItem>
              {department.positions.map((position) => (
                <SelectItem key={position.id} value={position.id}>
                  {position.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">{t.projectAccess}</h3>
          {renderCollapseButton("projectAccess", t.projectAccess)}
        </div>
        {!collapsedSections.projectAccess ? (
          <>
            <div className="grid gap-2">
              <Label>{t.accessScope}</Label>
              <Select
                value={form.projectScopeType}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    projectScopeType: value,
                    managedProjectIds: value === "SELECTED_PROJECTS" ? current.managedProjectIds : [],
                  }))
                }
              >
                <SelectTrigger className="w-full bg-background sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE" disabled={ownerProjectIds.length > 0}>{t.noProjects}</SelectItem>
                  <SelectItem value="ALL_PROJECTS">{t.allProjects}</SelectItem>
                  <SelectItem value="SELECTED_PROJECTS">{t.selectedProjects}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.projectScopeType === "SELECTED_PROJECTS" || (form.projectScopeType === "NONE" && defaultAccessProjectIds.length > 0) ? (
              <SearchableMultiSelect
                label={t.accessibleProjects}
                placeholder={t.searchProjects}
                emptyText={t.noMatchingProjects}
                selectedLabel={t.selected}
                options={projectAccessOptions}
                selectedIds={selectedAccessProjectIds}
                onChange={(selectedIds) =>
                  setForm((current) => ({
                    ...current,
                    managedProjectIds: current.projectScopeType === "SELECTED_PROJECTS"
                      ? selectedIds.filter((projectId) => !defaultAccessProjectIdSet.has(projectId))
                      : [],
                  }))
                }
              />
            ) : null}
          </>
        ) : null}
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">{t.taskAssignment}</h3>
          {renderCollapseButton("taskAssignment", t.taskAssignment)}
        </div>
        {!collapsedSections.taskAssignment ? (
          <>
            <SearchableMultiSelect
              label={t.byPerson}
              placeholder={t.searchMembers}
              emptyText={t.noMatchingMembers}
              selectedLabel={t.selected}
              options={memberOptions.filter((option) => option.id !== member.userId)}
              selectedIds={form.taskAssigneeIds}
              onChange={(taskAssigneeIds) => setForm((current) => ({ ...current, taskAssigneeIds }))}
            />
            <SearchableMultiSelect
              label={t.byPosition}
              placeholder={t.searchPositions}
              emptyText={t.noMatchingPositions}
              selectedLabel={t.selected}
              options={positionOptions}
              selectedIds={form.taskPositionIds}
              onChange={(taskPositionIds) => setForm((current) => ({ ...current, taskPositionIds }))}
            />
            <div className="grid gap-2">
              <Label>{t.byProjectMembers}</Label>
              <Select
                value={form.taskProjectScopeType}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    taskProjectScopeType: value,
                    taskProjectIds: value === "SELECTED_PROJECTS" ? current.taskProjectIds : [],
                  }))
                }
              >
                <SelectTrigger className="w-full bg-background sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE" disabled={ownerProjectIds.length > 0}>{t.noProjectMembers}</SelectItem>
                  <SelectItem value="ALL_PROJECTS">{t.allProjectMembers}</SelectItem>
                  <SelectItem value="SELECTED_PROJECTS">{t.selectedProjectMembers}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.taskProjectScopeType === "SELECTED_PROJECTS" || (form.taskProjectScopeType === "NONE" && defaultTaskProjectIds.length > 0) ? (
              <SearchableMultiSelect
                label={t.assignableProjectMembers}
                placeholder={t.searchProjects}
                emptyText={t.noMatchingProjects}
                selectedLabel={t.selected}
                options={taskProjectOptions}
                selectedIds={selectedTaskProjectIds}
                onChange={(selectedIds) =>
                  setForm((current) => ({
                    ...current,
                    taskProjectIds: current.taskProjectScopeType === "SELECTED_PROJECTS"
                      ? selectedIds.filter((projectId) => !defaultTaskProjectIdSet.has(projectId))
                      : [],
                  }))
                }
              />
            ) : null}
            <div className="grid gap-2">
              <Label>{t.assignablePreview}</Label>
              <div className="max-h-80 overflow-y-auto overscroll-contain rounded-md border">
                {taskAssigneePreview.length > 0 ? (
                  taskAssigneePreview.map(({ member: previewMember, sourceLabels }) => (
                    <div key={previewMember.userId} className="flex h-16 items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{displayMember(previewMember)}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {previewMember.userEmail}
                          {previewMember.positionName ? ` · ${previewMember.positionName}` : ""}
                        </div>
                      </div>
                      <div className="flex max-w-60 flex-wrap justify-end gap-1 overflow-hidden">
                        {sourceLabels.map((source) => (
                          <Badge key={source} variant="outline">{source}</Badge>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">{t.noAssignablePeople}</div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">{t.announcements}</h3>
          {renderCollapseButton("announcements", t.announcements)}
        </div>
        {!collapsedSections.announcements ? (
          <>
            <label className="flex items-center gap-3 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                checked={form.canCreateDepartmentAnnouncements}
                onChange={(event) => setForm((current) => ({ ...current, canCreateDepartmentAnnouncements: event.target.checked }))}
              />
              <span className="font-medium">{t.canPublishDepartment}</span>
            </label>
            <div className="grid gap-2">
              <Label>{t.announcementScope}</Label>
              <Select
                value={form.announcementProjectScopeType}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    announcementProjectScopeType: value,
                    announcementProjectIds: value === "SELECTED_PROJECTS" ? current.announcementProjectIds : [],
                  }))
                }
              >
                <SelectTrigger className="w-full bg-background sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE" disabled={ownerProjectIds.length > 0}>{t.noProjectAnnouncements}</SelectItem>
                  <SelectItem value="ALL_PROJECTS">{t.allProjectAnnouncements}</SelectItem>
                  <SelectItem value="SELECTED_PROJECTS">{t.selectedProjectAnnouncements}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.announcementProjectScopeType === "SELECTED_PROJECTS" || (form.announcementProjectScopeType === "NONE" && defaultAnnouncementProjectIds.length > 0) ? (
              <SearchableMultiSelect
                label={t.announcementProjects}
                placeholder={t.searchProjects}
                emptyText={t.noMatchingProjects}
                selectedLabel={t.selected}
                options={announcementProjectOptions}
                selectedIds={selectedAnnouncementProjectIds}
                onChange={(selectedIds) =>
                  setForm((current) => ({
                    ...current,
                    announcementProjectIds: current.announcementProjectScopeType === "SELECTED_PROJECTS"
                      ? selectedIds.filter((projectId) => !defaultAnnouncementProjectIdSet.has(projectId))
                      : [],
                  }))
                }
              />
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
