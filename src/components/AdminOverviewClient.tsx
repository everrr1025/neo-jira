"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, Building2, Clock3, FolderKanban, History, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { AdminOverviewData, GovernanceLogSummary, UsageTrendPoint } from "@/lib/adminOverviewTypes";
import type { Locale } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/timeFormat";

type Period = 7 | 30;
type InactiveDays = 30 | 90;
type TrendMetric = "activeUsers" | "activeDepartments";

const TEXT = {
  zh: {
    title: "系统概览", subtitle: "SYNC 系统规模、使用活跃度与管理动态", overview: "系统规模与使用",
    users: "用户总数", departments: "部门总数", projects: "项目总数", activeUsers: "活跃用户",
    activeDepartments: "活跃部门", inactiveUsers: "沉默用户", userUnit: "名普通用户",
    departmentUnit: "个部门", projectUnit: "个项目", rate: "活跃率", days: "天",
    trend: "系统使用趋势", dailyUsers: "每日活跃用户", dailyDepartments: "每日活跃部门",
    noUsage: "当前周期暂无使用记录", inactiveTitle: "沉默用户", noDepartment: "未分配部门",
    noInactive: "当前阈值下没有沉默用户", viewAll: "查看全部", recent: "最近管理操作",
    noLogs: "暂无管理操作记录", systemLogs: "全部日志",
    lastActive: (days: number) => `${days} 天未活跃`, unknown: (count: number) => `${count} 名用户暂无活动记录`,
  },
  en: {
    title: "System Overview", subtitle: "SYNC scale, adoption, and administration activity", overview: "System scale and usage",
    users: "Total users", departments: "Departments", projects: "Managed projects", activeUsers: "Active users",
    activeDepartments: "Active departments", inactiveUsers: "Inactive users", userUnit: "standard users",
    departmentUnit: "departments", projectUnit: "projects", rate: "Active rate", days: "days",
    trend: "System usage trend", dailyUsers: "Daily active users", dailyDepartments: "Daily active departments",
    noUsage: "No usage recorded in this period", inactiveTitle: "Inactive users", noDepartment: "No department",
    noInactive: "No inactive users at this threshold", viewAll: "View all", recent: "Recent administration activity",
    noLogs: "No administration activity recorded", systemLogs: "All logs",
    lastActive: (days: number) => `Inactive for ${days} days`, unknown: (count: number) => `${count} users have no activity record yet`,
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
        <Button key={String(option.value)} type="button" variant="ghost" size="sm" onClick={() => onChange(option.value)}
          className={`h-7 px-3 text-xs ${value === option.value ? "bg-background text-foreground shadow-xs hover:bg-background" : "text-muted-foreground hover:text-foreground"}`}>
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: number; detail: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-md bg-muted/60 text-muted-foreground"><Icon className="size-4" /></span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function formatChartDate(date: string, locale: Locale) {
  const [, month, day] = date.split("-");
  return locale === "zh" ? `${Number(month)}月${Number(day)}日` : `${month}/${day}`;
}

function UsageLineChart({ points, metric, locale, emptyText }: {
  points: UsageTrendPoint[]; metric: TrendMetric; locale: Locale; emptyText: string;
}) {
  const width = 720;
  const height = 250;
  const margin = { left: 42, right: 18, top: 20, bottom: 36 };
  const values = points.map((point) => point[metric]);
  const hasData = values.some((value) => value > 0);
  const roundedMax = Math.max(2, Math.ceil(Math.max(1, ...values) / 4) * 4);
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const plotted = points.map((point, index) => ({
    ...point,
    value: point[metric],
    x: margin.left + (index / Math.max(1, points.length - 1)) * plotWidth,
    y: margin.top + plotHeight - (point[metric] / roundedMax) * plotHeight,
  }));
  const path = plotted.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  if (!hasData) {
    return <div className="m-4 flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="relative min-w-[520px]" role="img" aria-label={emptyText}>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((tick) => {
            const y = margin.top + (tick / 4) * plotHeight;
            const value = Math.round(roundedMax * (1 - tick / 4));
            return <g key={tick}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} className="stroke-border" strokeDasharray="3 4" />
              <text x={margin.left - 10} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">{value}</text>
            </g>;
          })}
          <path d={path} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {plotted.map((point, index) => <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="3.5" className="fill-background stroke-primary" strokeWidth="2" />
            {(points.length <= 7 || index % 5 === 0 || index === points.length - 1) ?
              <text x={point.x} y={height - 12} textAnchor="middle" className="fill-muted-foreground text-[10px]">{formatChartDate(point.date, locale)}</text> : null}
          </g>)}
        </svg>
        {plotted.map((point) => <Tooltip key={point.date}>
          <TooltipTrigger asChild>
            <button type="button" className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ left: `${(point.x / width) * 100}%`, top: `${(point.y / height) * 100}%` }} aria-label={`${formatChartDate(point.date, locale)}: ${point.value}`} />
          </TooltipTrigger>
          <TooltipContent>{formatChartDate(point.date, locale)} · {point.value}</TooltipContent>
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
  const [metric, setMetric] = useState<TrendMetric>("activeUsers");
  const [inactiveDays, setInactiveDays] = useState<InactiveDays>(30);
  const usage = data.periods[period];
  const inactive = data.inactive[inactiveDays];
  const userRate = data.totals.users > 0 ? Math.round((usage.activeUsers / data.totals.users) * 100) : 0;
  const departmentRate = data.totals.departments > 0 ? Math.round((usage.activeDepartments / data.totals.departments) * 100) : 0;
  const metricLabel = metric === "activeUsers" ? t.dailyUsers : t.dailyDepartments;
  const periodOptions = useMemo(() => ([7, 30] as Period[]).map((days) => ({ value: days, label: locale === "zh" ? `近 ${days} 天` : `${days} days` })), [locale]);

  return <div className="space-y-6 text-foreground">
    <div><h1 className="text-xl font-semibold tracking-tight text-foreground">{t.title}</h1><p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p></div>

    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/35 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{t.overview}</h2><Segment value={period} options={periodOptions} onChange={setPeriod} />
      </div>
      <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Metric icon={Users} label={t.users} value={data.totals.users} detail={t.userUnit} />
        <Metric icon={Building2} label={t.departments} value={data.totals.departments} detail={t.departmentUnit} />
        <Metric icon={FolderKanban} label={t.projects} value={data.totals.projects} detail={t.projectUnit} />
        <Metric icon={Activity} label={t.activeUsers} value={usage.activeUsers} detail={`${t.rate} ${userRate}%`} />
        <Metric icon={Building2} label={t.activeDepartments} value={usage.activeDepartments} detail={`${t.rate} ${departmentRate}%`} />
        <Metric icon={Clock3} label={t.inactiveUsers} value={data.inactive[30].count} detail={`30 ${t.days}`} />
      </CardContent>
    </Card>

    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <Card className="gap-0 overflow-hidden py-0 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/35 px-4 py-3">
          <div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-foreground">{t.trend}</h2><Badge variant="outline">{metricLabel}</Badge></div>
          <Segment value={metric} options={[{ value: "activeUsers", label: t.dailyUsers }, { value: "activeDepartments", label: t.dailyDepartments }]} onChange={setMetric} />
        </div>
        <div className="overflow-x-auto p-2"><UsageLineChart points={usage.trend} metric={metric} locale={locale} emptyText={t.noUsage} /></div>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/35 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{t.inactiveTitle}</h2>
          <Segment value={inactiveDays} options={[{ value: 30, label: `30 ${t.days}` }, { value: 90, label: `90 ${t.days}` }]} onChange={setInactiveDays} />
        </div>
        {inactive.users.length > 0 ? <div className="divide-y">{inactive.users.map((user) =>
          <Link key={user.id} href={`/admin/users?activityStatus=inactive${inactiveDays}&search=${encodeURIComponent(user.email)}`} className="block px-4 py-3 transition-colors hover:bg-muted/45">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{user.name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{user.departmentName || t.noDepartment}</p></div><span className="shrink-0 text-xs font-medium text-muted-foreground">{t.lastActive(user.inactiveDays)}</span></div>
          </Link>)}</div>
          : <div className="m-4 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">{t.noInactive}</div>}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span>{data.totals.unknownActivityUsers > 0 ? t.unknown(data.totals.unknownActivityUsers) : `${inactive.count} ${t.inactiveUsers}`}</span>
          <Link href={`/admin/users?activityStatus=inactive${inactiveDays}`} className="font-semibold hover:text-foreground">{t.viewAll}</Link>
        </div>
      </Card>
    </div>

    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/35 px-4 py-3">
        <div className="flex items-center gap-2"><History className="size-4 text-muted-foreground" /><h2 className="text-sm font-semibold text-foreground">{t.recent}</h2></div>
        <Link href="/admin/logs" className="text-xs font-semibold text-muted-foreground hover:text-foreground">{t.systemLogs}</Link>
      </div>
      {data.recentLogs.length > 0 ? <div className="divide-y">{data.recentLogs.map((log) =>
        <div key={log.id} className="flex items-center gap-3 px-4 py-3"><Badge variant="outline" className="w-20 shrink-0 justify-center">{entityLabel(log.entityType, locale)}</Badge><p className="min-w-0 flex-1 truncate text-sm text-foreground"><span className="font-medium">{log.actorName}</span> {logActionText(log, locale)}</p><span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(log.createdAt, locale)}</span></div>)}</div>
        : <div className="m-4 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">{t.noLogs}</div>}
    </Card>
  </div>;
}
