"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { CircleHelp, HardDrive, StickyNote, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import DepartmentNavIcon from "@/components/DepartmentNavIcon";
import ProjectNavIcon from "@/components/ProjectNavIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { AdminOverviewData, GovernanceLogSummary, UsageTrendPoint } from "@/lib/adminOverviewTypes";
import { formatStorageSize } from "@/lib/fileStorage";
import type { Locale } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/timeFormat";

type Period = 7 | 30;
type InactiveDays = 30 | 90;

const TEXT = {
  zh: {
    title: "系统概览", users: "用户", departments: "部门", projects: "项目",
    files: "文件", usedStorage: "空间", recentFiles: "近 30 天新增",
    activeUsers: "活跃用户", activeDepartments: "活跃部门",
    inactiveUsers: "沉默用户", inactiveDepartments: "沉默部门", days: "天",
    trend: "使用趋势",
    noUsage: "当前周期暂无使用记录", inactiveTitle: "沉默情况", recent: "最近操作",
    inactiveUserHelp: "沉默用户：普通用户超过所选天数未访问系统；观察期不足的新用户不计入。",
    inactiveDepartmentHelp: "沉默部门：至少有一名普通成员，且所有普通成员均为沉默用户；空部门不计入。",
    noLogs: "暂无管理操作记录", systemLogs: "全部日志",
  },
  en: {
    title: "System Overview", users: "Users", departments: "Departments", projects: "Projects",
    files: "Files", usedStorage: "Storage used", recentFiles: "Added in 30 days",
    activeUsers: "Active users", activeDepartments: "Active departments",
    inactiveUsers: "Inactive users", inactiveDepartments: "Inactive departments", days: "days",
    trend: "Usage trend",
    noUsage: "No usage recorded in this period", inactiveTitle: "Inactivity", recent: "Recent activity",
    inactiveUserHelp: "Inactive users: standard users with no system visit beyond the selected period; new users still in the observation period are excluded.",
    inactiveDepartmentHelp: "Inactive departments: departments with at least one standard member where every standard member is inactive; empty departments are excluded.",
    noLogs: "No administration activity recorded", systemLogs: "All logs",
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

function logActionText(log: GovernanceLogSummary, locale: Locale) {
  const actions = locale === "zh"
    ? { CREATE: "创建了", UPDATE: "更新了", DELETE: "删除了" }
    : { CREATE: "created", UPDATE: "updated", DELETE: "deleted" };
  const entities = locale === "zh"
    ? { USER: "用户", DEPARTMENT: "部门", PROJECT: "项目" }
    : { USER: "user", DEPARTMENT: "department", PROJECT: "project" };
  return `${actions[log.action as keyof typeof actions] || (locale === "zh" ? "变更了" : "changed")} ${entities[log.entityType as keyof typeof entities] || ""} ${log.targetName}`;
}

function entityLabel(entityType: string, locale: Locale) {
  const labels = locale === "zh"
    ? { USER: "用户", DEPARTMENT: "部门", PROJECT: "项目" }
    : { USER: "User", DEPARTMENT: "Department", PROJECT: "Project" };
  return labels[entityType as keyof typeof labels] || entityType;
}

export default function AdminOverviewClient({ data, locale }: { data: AdminOverviewData; locale: Locale }) {
  const t = TEXT[locale];
  const [period, setPeriod] = useState<Period>(30);
  const [inactiveDays, setInactiveDays] = useState<InactiveDays>(30);
  const usage = data.periods[period];
  const inactive = data.inactive[inactiveDays];
  const periodOptions = useMemo(() => ([7, 30] as Period[]).map((days) => ({ value: days, label: locale === "zh" ? `近 ${days} 天` : `${days} days` })), [locale]);

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

    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <Card className="gap-0 overflow-hidden py-0 lg:col-span-2">
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

      <div className="space-y-3">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-foreground">{t.inactiveTitle}</h2>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={locale === "zh" ? "沉默判定说明" : "Inactivity criteria"}>
                    <CircleHelp className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-80 space-y-1.5 text-xs leading-relaxed">
                  <p>{t.inactiveUserHelp}</p>
                  <p>{t.inactiveDepartmentHelp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Segment value={inactiveDays} options={[{ value: 30, label: `30 ${t.days}` }, { value: 90, label: `90 ${t.days}` }]} onChange={setInactiveDays} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Link href={`/admin/users?activityStatus=inactive${inactiveDays}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Metric icon={UserRound} label={t.inactiveUsers} value={inactive.count} />
          </Link>
          <Metric icon={DepartmentNavIcon} label={t.inactiveDepartments} value={inactive.departmentCount} />
        </div>
      </div>
    </div>

    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/35 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{t.recent}</h2>
        <Link href="/admin/logs" className="text-xs font-semibold text-muted-foreground hover:text-foreground">{t.systemLogs}</Link>
      </div>
      {data.recentLogs.length > 0 ? <div className="divide-y">{data.recentLogs.map((log) =>
        <div key={log.id} className="flex items-center gap-3 px-4 py-3"><Badge variant="outline" className="w-20 shrink-0 justify-center">{entityLabel(log.entityType, locale)}</Badge><p className="min-w-0 flex-1 truncate text-sm text-foreground"><span className="font-medium">{log.actorName}</span> {logActionText(log, locale)}</p><span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(log.createdAt, locale)}</span></div>)}</div>
        : <div className="m-4 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">{t.noLogs}</div>}
    </Card>
  </div>;
}
