"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ListFilter, Search, X } from "lucide-react";

import { DropdownField } from "@/components/DropdownField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/i18n";
import { formatFullDateTime } from "@/lib/timeFormat";

type TargetType = "USER" | "DEPARTMENT" | "PROJECT";
type AuditTarget = { type: TargetType; id: string; name: string; key: string | null };
type TargetOption = { type: TargetType; id: string; name: string; detail: string };
type LogRow = { id: string; entityId: string; entityType: string; action: string; field: string | null; targetName: string; targetKey: string | null; actorName: string; createdAt: string };

function governanceLabel(value: string | null, locale: Locale) {
  if (!value) return "—";
  const zh: Record<string, string> = {
    USER: "用户", DEPARTMENT: "部门", PROJECT: "项目", CREATE: "创建", UPDATE: "更新", DELETE: "删除",
    password: "密码重置", members: "成员", owner: "负责人", memberRole: "成员角色", departmentAdmin: "部门管理员",
    positions: "岗位", memberPermissions: "成员权限", details: "基本信息", name: "名称", key: "标识", description: "描述",
  };
  const en: Record<string, string> = {
    USER: "User", DEPARTMENT: "Department", PROJECT: "Project", CREATE: "Create", UPDATE: "Update", DELETE: "Delete",
    password: "Password reset", members: "Members", owner: "Owner", memberRole: "Member role", departmentAdmin: "Department admin",
    positions: "Positions", memberPermissions: "Member permissions", details: "Details", name: "Name", key: "Key", description: "Description",
  };
  return (locale === "zh" ? zh : en)[value] || value;
}

const TEXT = {
  zh: { title: "系统日志", range: "时间范围", entity: "对象类型", action: "操作类型", actor: "操作者", unknownActor: "未知操作者", all: "全部", days7: "近 7 天", days30: "近 30 天", days90: "近 90 天", time: "时间", target: "对象", searchTarget: "搜索用户、部门或项目", searching: "搜索中…", noTargets: "没有匹配的对象", field: "变更内容", removeFilter: "取消筛选", noLogs: "当前筛选条件下没有系统日志", showing: "显示", to: "到", of: "共", records: "条记录", perPage: "每页", page: "第" },
  en: { title: "System Logs", range: "Date range", entity: "Entity", action: "Action", actor: "Actor", unknownActor: "Unknown actor", all: "All", days7: "Last 7 days", days30: "Last 30 days", days90: "Last 90 days", time: "Time", target: "Target", searchTarget: "Search users, departments, or projects", searching: "Searching…", noTargets: "No matching targets", field: "Change", removeFilter: "Remove filter", noLogs: "No system logs match these filters", showing: "Showing", to: "to", of: "of", records: "records", perPage: "Per page", page: "Page" },
} as const;

type FilterOption = { value: string; label: string };

function SingleFilterableHeader({
  label,
  filterLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  filterLabel: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label || options[0]?.label || value;

  return <div className="flex items-center gap-1">
    <span>{label}</span>
    {value !== "all" ? (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="h-5 max-w-24 justify-center bg-background px-1.5"
              tabIndex={0}
              aria-label={selectedLabel}
            >
              <span className="truncate">{selectedLabel}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>{selectedLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : null}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={value !== "all" ? "bg-accent text-foreground" : "text-muted-foreground"}
          aria-label={`${filterLabel}: ${selectedLabel}`}
          title={`${filterLabel}: ${selectedLabel}`}
        >
          <ListFilter />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options[0] ? <DropdownMenuRadioItem value={options[0].value}>{options[0].label}</DropdownMenuRadioItem> : null}
          {options.length > 1 ? <DropdownMenuSeparator /> : null}
          {options.slice(1).map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}

function MultiFilterableHeader({
  label,
  value,
  options,
  allLabel,
  locale,
  onChange,
}: {
  label: string;
  value: string[];
  options: FilterOption[];
  allLabel: string;
  locale: Locale;
  onChange: (value: string[]) => void;
}) {
  const selectedLabels = options.filter((option) => value.includes(option.value)).map((option) => option.label);
  const selectionLabel = selectedLabels.join(locale === "zh" ? "、" : ", ") || allLabel;
  const toggleOption = (optionValue: string, checked: boolean) => {
    onChange(checked ? [...value, optionValue] : value.filter((item) => item !== optionValue));
  };

  return <div className="flex items-center gap-1">
    <span>{label}</span>
    {value.length > 0 ? (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="h-5 min-w-5 justify-center bg-background px-1.5 tabular-nums"
              tabIndex={0}
              aria-label={selectionLabel}
            >
              {value.length}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="max-w-sm break-words">{selectionLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : null}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={value.length > 0 ? "bg-accent text-foreground" : "text-muted-foreground"}
          aria-label={`${label}: ${selectionLabel}`}
          title={`${label}: ${selectionLabel}`}
        >
          <ListFilter />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuCheckboxItem
          checked={value.length === 0}
          onCheckedChange={() => onChange([])}
          onSelect={(event) => event.preventDefault()}
        >
          {allLabel}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={value.includes(option.value)}
            onCheckedChange={(checked) => toggleOption(option.value, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            <span className="min-w-0 truncate" title={option.label}>{option.label}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}

function TargetFilterableHeader({
  label,
  selected,
  locale,
  allLabel,
  searchPlaceholder,
  searchingLabel,
  noResultsLabel,
  onSelect,
}: {
  label: string;
  selected: AuditTarget | null;
  locale: Locale;
  allLabel: string;
  searchPlaceholder: string;
  searchingLabel: string;
  noResultsLabel: string;
  onSelect: (target: TargetOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<TargetOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!open || !normalizedQuery) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/audit-targets?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setSearching(false);
          return;
        }
        setOptions(await response.json() as TargetOption[]);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setOptions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const selectedLabel = selected
    ? `${selected.name}${selected.key ? ` (${selected.key})` : ""}`
    : allLabel;

  return <div className="flex items-center gap-1">
    <span>{label}</span>
    {selected ? <Badge variant="outline" className="h-5 max-w-32 justify-center bg-background px-1.5" title={selectedLabel}>
      <span className="truncate">{selected.name}</span>
    </Badge> : null}
    <DropdownMenu open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setQuery("");
        setOptions([]);
        setSearching(false);
      }
    }}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={selected ? "bg-accent text-foreground" : "text-muted-foreground"}
          aria-label={`${label}: ${selectedLabel}`}
          title={`${label}: ${selectedLabel}`}
        >
          <ListFilter />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <div className="relative p-2">
          <Search className="pointer-events-none absolute left-4 top-4 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOptions([]);
              setSearching(Boolean(event.target.value.trim()));
            }}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder={searchPlaceholder}
            className="pl-8"
            autoFocus
          />
        </div>
        {query.trim() && searching ? <div className="px-3 py-4 text-center text-sm text-muted-foreground">{searchingLabel}</div> : null}
        {query.trim() && !searching && options.length === 0 ? <div className="px-3 py-4 text-center text-sm text-muted-foreground">{noResultsLabel}</div> : null}
        {options.map((option) => (
          <DropdownMenuItem
            key={`${option.type}:${option.id}`}
            className="flex items-center gap-2"
            onSelect={() => {
              onSelect(option);
              setOpen(false);
              setQuery("");
            }}
          >
            <Badge variant="outline" className="w-14 shrink-0 justify-center px-1">{governanceLabel(option.type, locale)}</Badge>
            <span className="min-w-0 flex-1 truncate" title={option.name}>{option.name}</span>
            <span className="max-w-28 truncate text-xs text-muted-foreground" title={option.detail}>{option.detail}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}

export default function AdminLogsClient({ locale, logs, actors, filters, page, pageSize, totalPages, total }: {
  locale: Locale;
  logs: LogRow[];
  actors: Array<{ id: string; name: string }>;
  filters: { range: string; entityTypes: string[]; actions: string[]; actorIds: string[]; target: AuditTarget | null };
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const searchParams = useSearchParams();
  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" && key !== "range") params.delete(key); else params.set(key, value);
    params.set("page", "1");
    router.push(`/admin/logs?${params.toString()}`);
  };
  const updateMulti = (key: string, values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (values.length > 0) params.set(key, values.join(",")); else params.delete(key);
    if (key === "entityType") {
      params.delete("targetType");
      params.delete("targetId");
    }
    params.set("page", "1");
    router.push(`/admin/logs?${params.toString()}`);
  };
  const selectTarget = (target: Pick<AuditTarget, "type" | "id">) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("entityType");
    params.set("targetType", target.type);
    params.set("targetId", target.id);
    params.set("page", "1");
    router.push(`/admin/logs?${params.toString()}`);
  };
  const clearTarget = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("targetType");
    params.delete("targetId");
    params.set("page", "1");
    router.push(`/admin/logs?${params.toString()}`);
  };
  const goToPage = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next));
    router.push(`/admin/logs?${params.toString()}`);
  };
  const rangeOptions = [
    { value: "all", label: t.all },
    { value: "7", label: t.days7 },
    { value: "30", label: t.days30 },
    { value: "90", label: t.days90 },
  ];
  const actorOptions = actors.map((actor) => ({ value: actor.id, label: actor.name }));
  const actorLabelsById = new Map(actorOptions.map((option) => [option.value, option.label]));
  const actionOptions = [
    { value: "CREATE", label: governanceLabel("CREATE", locale) },
    { value: "UPDATE", label: governanceLabel("UPDATE", locale) },
    { value: "DELETE", label: governanceLabel("DELETE", locale) },
  ];
  const entityOptions = [
    { value: "USER", label: governanceLabel("USER", locale) },
    { value: "DEPARTMENT", label: governanceLabel("DEPARTMENT", locale) },
    { value: "PROJECT", label: governanceLabel("PROJECT", locale) },
  ];
  const rangeStart = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, total);
  const pageSizeOptions = [10, 20, 50].map((size) => ({ value: String(size), label: String(size) }));
  const filterSummary = [
    ...(filters.range !== "all" ? [{ key: "range", label: t.time, value: rangeOptions.find((option) => option.value === filters.range)?.label || filters.range, clear: () => update("range", "all") }] : []),
    ...(filters.actorIds.length > 0 ? [{ key: "actorId", label: t.actor, value: filters.actorIds.map((actorId) => actorLabelsById.get(actorId) || t.unknownActor).join(locale === "zh" ? "、" : ", "), clear: () => updateMulti("actorId", []) }] : []),
    ...(filters.actions.length > 0 ? [{ key: "action", label: t.action, value: actionOptions.filter((option) => filters.actions.includes(option.value)).map((option) => option.label).join(locale === "zh" ? "、" : ", "), clear: () => updateMulti("action", []) }] : []),
    ...(filters.entityTypes.length > 0 ? [{ key: "entityType", label: t.entity, value: entityOptions.filter((option) => filters.entityTypes.includes(option.value)).map((option) => option.label).join(locale === "zh" ? "、" : ", "), clear: () => updateMulti("entityType", []) }] : []),
    ...(filters.target ? [{
      key: "target",
      label: t.target,
      value: `${filters.target.name}（${[governanceLabel(filters.target.type, locale), filters.target.key].filter(Boolean).join(" · ")}）`,
      clear: clearTarget,
    }] : []),
  ];

  return <div className="flex flex-col gap-5">
    <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
    {filterSummary.length > 0 ? <div className="flex flex-wrap gap-2 text-sm">
      {filterSummary.map((filter) => (
        <div key={filter.key} className="inline-flex max-w-[360px] items-start rounded-md border bg-background text-foreground shadow-xs">
          <span className="flex min-w-0 items-center px-2.5 py-1">
            <span className="shrink-0 text-muted-foreground">{filter.label}：</span>
            <span className="min-w-0 truncate" title={filter.value || t.all}>{filter.value || t.all}</span>
          </span>
          <button
            type="button"
            className="m-0.5 ml-0 inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`${t.removeFilter}：${filter.label}`}
            title={`${t.removeFilter}：${filter.label}`}
            onClick={filter.clear}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div> : null}
    <Card className="gap-0 overflow-hidden py-0">
      <Table className="min-w-[860px] table-auto">
        <TableHeader className="sticky top-0 z-10 bg-muted/50">
          <TableRow className="hover:bg-muted/50">
            <TableHead className="w-[18%] pl-6"><SingleFilterableHeader label={t.time} filterLabel={t.range} value={filters.range} options={rangeOptions} onChange={(value) => update("range", value)} /></TableHead>
            <TableHead className="w-[18%]"><MultiFilterableHeader label={t.actor} value={filters.actorIds} options={actorOptions} allLabel={t.all} locale={locale} onChange={(value) => updateMulti("actorId", value)} /></TableHead>
            <TableHead className="w-[12%]"><MultiFilterableHeader label={t.action} value={filters.actions} options={actionOptions} allLabel={t.all} locale={locale} onChange={(value) => updateMulti("action", value)} /></TableHead>
            <TableHead className="w-[12%]"><MultiFilterableHeader label={t.entity} value={filters.entityTypes} options={entityOptions} allLabel={t.all} locale={locale} onChange={(value) => updateMulti("entityType", value)} /></TableHead>
            <TableHead className="w-[24%]"><TargetFilterableHeader label={t.target} selected={filters.target} locale={locale} allLabel={t.all} searchPlaceholder={t.searchTarget} searchingLabel={t.searching} noResultsLabel={t.noTargets} onSelect={selectTarget} /></TableHead>
            <TableHead className="w-[16%]">{t.field}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{logs.map((log) => <TableRow key={log.id}><TableCell className="pl-6 text-xs whitespace-nowrap text-muted-foreground">{formatFullDateTime(log.createdAt, locale)}</TableCell><TableCell className="font-medium"><span className="block max-w-[180px] truncate" title={log.actorName}>{log.actorName}</span></TableCell><TableCell><Badge variant="outline" className={log.action === "DELETE" ? "border-destructive/30 bg-transparent text-destructive/80" : undefined}>{governanceLabel(log.action, locale)}</Badge></TableCell><TableCell>{governanceLabel(log.entityType, locale)}</TableCell><TableCell><button type="button" className="inline-flex w-full max-w-[280px] min-w-0 items-baseline gap-2 text-left hover:underline" onClick={() => selectTarget({ type: log.entityType as TargetType, id: log.entityId })}><span className="max-w-[160px] shrink-0 truncate font-medium text-foreground" title={log.targetName}>{log.targetName}</span>{log.targetKey ? <span className="min-w-0 truncate text-xs text-muted-foreground" title={log.targetKey}>{log.targetKey}</span> : null}</button></TableCell><TableCell className="text-muted-foreground">{log.field ? governanceLabel(log.field, locale) : null}</TableCell></TableRow>)}
          {logs.length === 0 ? <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="h-40 text-center text-muted-foreground">{t.noLogs}</TableCell></TableRow> : null}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3 text-sm">
        <div className="text-muted-foreground">
          {t.showing} <span className="font-medium text-foreground">{rangeStart}</span> {t.to}{" "}
          <span className="font-medium text-foreground">{rangeEnd}</span> {t.of}{" "}
          <span className="font-medium text-foreground">{total}</span> {t.records}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{t.perPage}</span>
            <DropdownField
              id="log-page-size"
              label={t.perPage}
              value={String(pageSize)}
              onChange={(value) => update("pageSize", value)}
              options={pageSizeOptions}
              hideLabel
              className="w-20"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}><ArrowLeft /></Button>
            <span className="px-1 font-medium leading-none text-foreground">
              {locale === "zh" ? `${t.page} ${page} / ${totalPages} 页` : `${t.page} ${page} of ${totalPages}`}
            </span>
            <Button type="button" variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}><ArrowRight /></Button>
          </div>
        </div>
      </div>
    </Card>
  </div>;
}
