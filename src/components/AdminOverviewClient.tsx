"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { ArrowDown, ArrowUp, CircleHelp, HardDrive, StickyNote, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import DepartmentNavIcon from "@/components/DepartmentNavIcon";
import ProjectNavIcon from "@/components/ProjectNavIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { AdminOverviewData, UsageTrendPoint } from "@/lib/adminOverviewTypes";
import { formatStorageSize } from "@/lib/fileStorage";
import type { Locale } from "@/lib/i18n";

type Period = 7 | 30;
type InactiveDays = 30 | 90;
type ResourceSortField = "users" | "projects" | "files" | "bytes";
type SortDirection = "asc" | "desc";

const TEXT = {
  zh: {
    title: "系统概览", users: "用户", departments: "部门", projects: "项目",
    files: "文件", usedStorage: "空间", recentFiles: "近 30 天新增",
    activeUsers: "活跃用户", activeDepartments: "活跃部门",
    days: "天", healthTitle: "健康度", userActiveRate: "用户活跃率", attentionDepartments: "需关注部门",
    trend: "使用趋势", departmentResources: "部门资源使用情况", department: "部门",
    activeShort: "活跃", inactiveShort: "未活跃",
    noUsage: "当前周期暂无使用记录", unassigned: "未归属",
    sortAscending: "升序排列", sortDescending: "降序排列",
    healthHelp: "活跃率按所选周期内访问过系统的普通用户计算；观察期不足且从未活跃的新用户不计入。",
    attentionHelp: "需关注部门：纳入统计的普通用户中，活跃用户占比低于 20% 的部门。",
  },
  en: {
    title: "System Overview", users: "Users", departments: "Departments", projects: "Projects",
    files: "Files", usedStorage: "Storage used", recentFiles: "Added in 30 days",
    activeUsers: "Active users", activeDepartments: "Active departments",
    days: "days", healthTitle: "Health", userActiveRate: "User activity rate", attentionDepartments: "Departments to watch",
    trend: "Usage trend", departmentResources: "Department resource usage", department: "Department",
    activeShort: "Active", inactiveShort: "Inactive",
    noUsage: "No usage recorded in this period", unassigned: "Unassigned",
    sortAscending: "Sort ascending", sortDescending: "Sort descending",
    healthHelp: "The activity rate counts standard users who visited during the selected period; new users with insufficient observation time and no activity are excluded.",
    attentionHelp: "Departments to watch have an activity rate below 20% among eligible standard users.",
  },
} as const;

function Segment<T extends number | string>({ value, options, onChange }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-md bg-muted p-0.5">
      {options.map((option) => (
        <Button key={String(option.value)} type="button" variant="ghost" size="sm" aria-pressed={value === option.value} onClick={() => onChange(option.value)}
          className={`h-7 px-3 text-xs ${value === option.value ? "bg-background text-foreground shadow-xs hover:bg-background" : "text-muted-foreground hover:text-foreground"}`}>
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div role="group" aria-label={label} className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon ? <span className="flex size-8 items-center justify-center rounded-md bg-muted/60 text-muted-foreground"><Icon className="size-4" /></span> : null}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      {detail ? <div className="mt-1 text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}

function formatChartDate(date: string, locale: Locale) {
  const [, month, day] = date.split("-");
  return locale === "zh" ? `${Number(month)}月${Number(day)}日` : `${month}/${day}`;
}

function UsageLineChart({ points, locale, emptyText, usersLabel, departmentsLabel }: {
  points: UsageTrendPoint[]; locale: Locale; emptyText: string; usersLabel: string; departmentsLabel: string;
}) {
  const width = 720;
  const height = 250;
  const margin = { left: 42, right: 18, top: 20, bottom: 36 };
  const values = points.flatMap((point) => [point.activeUsers, point.activeDepartments]);
  const hasData = values.some((value) => value > 0);
  const roundedMax = Math.max(2, Math.ceil(Math.max(1, ...values) / 4) * 4);
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const plotted = points.map((point, index) => ({
    ...point,
    x: margin.left + (index / Math.max(1, points.length - 1)) * plotWidth,
    userY: margin.top + plotHeight - (point.activeUsers / roundedMax) * plotHeight,
    departmentY: margin.top + plotHeight - (point.activeDepartments / roundedMax) * plotHeight,
  }));
  const userPath = plotted.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.userY}`).join(" ");
  const departmentPath = plotted.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.departmentY}`).join(" ");

  if (!hasData) {
    return <div className="m-4 flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="relative min-w-[520px]" role="img" aria-label={`${usersLabel}、${departmentsLabel}`}>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((tick) => {
            const y = margin.top + (tick / 4) * plotHeight;
            const value = Math.round(roundedMax * (1 - tick / 4));
            return <g key={tick}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} className="stroke-border" strokeDasharray="3 4" />
              <text x={margin.left - 10} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">{value}</text>
            </g>;
          })}
          <path d={userPath} fill="none" className="stroke-chart-1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={departmentPath} fill="none" className="stroke-chart-2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {plotted.map((point, index) => <g key={point.date}>
            <circle cx={point.x} cy={point.userY} r="3.5" className="fill-background stroke-chart-1" strokeWidth="2" />
            <circle cx={point.x} cy={point.departmentY} r="3.5" className="fill-background stroke-chart-2" strokeWidth="2" />
            {(points.length <= 7 || index % 5 === 0 || index === points.length - 1) ?
              <text x={point.x} y={height - 12} textAnchor="middle" className="fill-muted-foreground text-[10px]">{formatChartDate(point.date, locale)}</text> : null}
          </g>)}
        </svg>
        {plotted.map((point) => <Tooltip key={point.date}>
          <TooltipTrigger asChild>
            <button type="button" className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ left: `${(point.x / width) * 100}%`, top: `${(Math.min(point.userY, point.departmentY) / height) * 100}%` }}
              aria-label={`${formatChartDate(point.date, locale)}: ${usersLabel} ${point.activeUsers}, ${departmentsLabel} ${point.activeDepartments}`} />
          </TooltipTrigger>
          <TooltipContent>
            <div className="font-medium">{formatChartDate(point.date, locale)}</div>
            <div className="mt-1 flex items-center gap-2"><span className="size-2 rounded-full bg-chart-1" />{usersLabel} · {point.activeUsers}</div>
            <div className="mt-1 flex items-center gap-2"><span className="size-2 rounded-full bg-chart-2" />{departmentsLabel} · {point.activeDepartments}</div>
          </TooltipContent>
        </Tooltip>)}
      </div>
    </TooltipProvider>
  );
}

export default function AdminOverviewClient({ data, locale }: { data: AdminOverviewData; locale: Locale }) {
  const t = TEXT[locale];
  const [period, setPeriod] = useState<Period>(30);
  const [inactiveDays, setInactiveDays] = useState<InactiveDays>(30);
  const [resourceSort, setResourceSort] = useState<{ field: ResourceSortField; direction: SortDirection } | null>(null);
  const usage = data.periods[period];
  const inactive = data.inactive[inactiveDays];
  const periodOptions = useMemo(() => ([7, 30] as Period[]).map((days) => ({ value: days, label: locale === "zh" ? `近 ${days} 天` : `${days} days` })), [locale]);
  const departmentResources = useMemo(() => {
    if (!resourceSort) return data.departmentResources;
    const direction = resourceSort.direction === "asc" ? 1 : -1;
    return [...data.departmentResources].sort((left, right) => {
      const difference = left[resourceSort.field] - right[resourceSort.field];
      return difference === 0 ? left.name.localeCompare(right.name, locale === "zh" ? "zh-CN" : "en-US") : difference * direction;
    });
  }, [data.departmentResources, locale, resourceSort]);

  const renderResourceSortHeader = (label: string, field: ResourceSortField) => {
    const isActive = resourceSort?.field === field;
    const direction = isActive ? resourceSort.direction : null;
    const nextDirection: SortDirection = isActive && direction === "desc" ? "asc" : "desc";
    return (
      <th className="px-4 py-3 text-left" aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
        <button
          type="button"
          className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
          aria-label={`${label}: ${nextDirection === "asc" ? t.sortAscending : t.sortDescending}`}
          title={`${label}: ${nextDirection === "asc" ? t.sortAscending : t.sortDescending}`}
          onClick={() => setResourceSort({ field, direction: nextDirection })}
        >
          <span>{label}</span>
          {isActive ? direction === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
        </button>
      </th>
    );
  };

  return <div className="space-y-6 text-foreground">
    <h1 className="text-xl font-semibold tracking-tight text-foreground">{t.title}</h1>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric icon={UserRound} label={t.users} value={data.totals.users} />
        <Metric icon={DepartmentNavIcon} label={t.departments} value={data.totals.departments} />
        <Metric icon={ProjectNavIcon} label={t.projects} value={data.totals.projects} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric icon={StickyNote} label={t.files} value={data.storage.totalFiles} />
        <Metric icon={HardDrive} label={t.usedStorage} value={formatStorageSize(data.storage.totalBytes)} />
        <Metric label={t.recentFiles} value={data.storage.recentFiles} detail={formatStorageSize(data.storage.recentBytes)} />
      </div>
    </div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="h-full gap-0 overflow-hidden py-0 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/35 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-sm font-semibold text-foreground">{t.trend}</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-1" />{t.activeUsers}</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-2" />{t.activeDepartments}</span>
            </div>
          </div>
          <Segment value={period} options={periodOptions} onChange={setPeriod} />
        </div>
        <div className="overflow-x-auto p-2"><UsageLineChart points={usage.trend} locale={locale} emptyText={t.noUsage} usersLabel={t.activeUsers} departmentsLabel={t.activeDepartments} /></div>
      </Card>

      <Card className="min-h-0 h-full gap-0 overflow-hidden py-0 lg:[contain:size]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/35 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-foreground">{t.healthTitle}</h2>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={locale === "zh" ? "健康度说明" : "Health criteria"}>
                    <CircleHelp className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64 space-y-1.5 text-xs leading-relaxed">
                  <p>{t.healthHelp}</p>
                  <p>{t.attentionHelp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Segment
            value={inactiveDays}
            options={[{ value: 30, label: `30 ${t.days}` }, { value: 90, label: `90 ${t.days}` }]}
            onChange={setInactiveDays}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid grid-cols-2 divide-x border-b">
            <Link href={`/admin/users?activityStatus=inactive${inactiveDays}`} className="px-4 py-3 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <div className="text-xs font-medium text-muted-foreground">{t.userActiveRate}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{inactive.activeRate}%</div>
            </Link>
            <div className="px-4 py-3">
              <div className="text-xs font-medium text-muted-foreground">{t.attentionDepartments}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{inactive.attentionDepartmentCount}</div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 divide-y overflow-y-auto">
              {inactive.departments.map((department) => (
                <Link
                  key={department.id}
                  href={`/admin/users?departmentIds=${encodeURIComponent(department.id)}&activityStatus=inactive${inactiveDays}`}
                  className="block px-4 py-2 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium" title={department.name}>{department.name}</span>
                    {department.eligibleUsers > 0 ? <span className="shrink-0 text-sm font-semibold tabular-nums">{department.activeRate}%</span> : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground tabular-nums">
                    {t.users} {department.users} · {t.activeShort} {department.activeUsers} · {t.inactiveShort} {department.inactiveUsers}
                  </span>
                </Link>
              ))}
              {inactive.departments.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">{t.noUsage}</div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </div>

    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/35 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{t.departmentResources}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <colgroup>
            <col className="w-[40%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
          </colgroup>
          <thead className="border-b bg-muted/15 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t.department}</th>
              {renderResourceSortHeader(t.users, "users")}
              {renderResourceSortHeader(t.projects, "projects")}
              {renderResourceSortHeader(t.files, "files")}
              {renderResourceSortHeader(t.usedStorage, "bytes")}
            </tr>
          </thead>
          <tbody className="divide-y">
            {departmentResources.map((department) => (
              <tr key={department.id ?? "unassigned"} className={department.id ? "" : "bg-muted/20"}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{department.id ? department.name : t.unassigned}</span>
                    {department.key ? <Badge variant="outline">{department.key}</Badge> : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-left tabular-nums">{department.users}</td>
                <td className="px-4 py-3 text-left tabular-nums">{department.projects}</td>
                <td className="px-4 py-3 text-left tabular-nums">{department.files}</td>
                <td className="px-4 py-3 text-left tabular-nums">{formatStorageSize(department.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </div>;
}
