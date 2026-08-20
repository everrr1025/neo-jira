"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, History } from "lucide-react";

import { DropdownField } from "@/components/DropdownField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Locale } from "@/lib/i18n";
import { formatFullDateTime } from "@/lib/timeFormat";

type LogRow = { id: string; entityType: string; action: string; field: string | null; targetName: string; actorName: string; createdAt: string };

function governanceLabel(value: string | null, locale: Locale) {
  if (!value) return "—";
  const zh: Record<string, string> = {
    USER: "用户", DEPARTMENT: "部门", PROJECT: "项目", CREATE: "创建", UPDATE: "更新", DELETE: "删除",
    password: "密码重置", members: "成员", owner: "负责人", memberRole: "成员角色", departmentAdmin: "部门管理员",
    positions: "岗位", memberPermissions: "成员权限", details: "基本信息",
  };
  const en: Record<string, string> = {
    USER: "User", DEPARTMENT: "Department", PROJECT: "Project", CREATE: "Create", UPDATE: "Update", DELETE: "Delete",
    password: "Password reset", members: "Members", owner: "Owner", memberRole: "Member role", departmentAdmin: "Department admin",
    positions: "Positions", memberPermissions: "Member permissions", details: "Details",
  };
  return (locale === "zh" ? zh : en)[value] || value;
}

const TEXT = {
  zh: { title: "系统日志", subtitle: "用户、部门、项目及权限等系统治理操作", range: "时间范围", entity: "对象类型", action: "操作类型", actor: "操作者", all: "全部", days7: "近 7 天", days30: "近 30 天", days90: "近 90 天", time: "时间", target: "对象", field: "变更内容", noLogs: "当前筛选条件下没有系统日志", records: "条记录", page: "页" },
  en: { title: "System Logs", subtitle: "Governance activity for users, departments, projects, and permissions", range: "Date range", entity: "Entity", action: "Action", actor: "Actor", all: "All", days7: "Last 7 days", days30: "Last 30 days", days90: "Last 90 days", time: "Time", target: "Target", field: "Change", noLogs: "No system logs match these filters", records: "records", page: "Page" },
} as const;

export default function AdminLogsClient({ locale, logs, actors, filters, page, totalPages, total }: {
  locale: Locale;
  logs: LogRow[];
  actors: Array<{ id: string; name: string }>;
  filters: { range: string; entityType: string; action: string; actorId: string };
  page: number;
  totalPages: number;
  total: number;
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const searchParams = useSearchParams();
  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(key); else params.set(key, value);
    params.set("page", "1");
    router.push(`/admin/logs?${params.toString()}`);
  };
  const goToPage = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next));
    router.push(`/admin/logs?${params.toString()}`);
  };

  return <div className="flex flex-col gap-5">
    <div><h1 className="text-xl font-semibold tracking-tight">{t.title}</h1><p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p></div>
    <Card className="gap-0 overflow-hidden py-0">
      <div className="grid grid-cols-1 gap-3 border-b bg-muted/35 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <DropdownField id="log-range" label={t.range} value={filters.range} onChange={(value) => update("range", value)} options={[{ value: "7", label: t.days7 }, { value: "30", label: t.days30 }, { value: "90", label: t.days90 }, { value: "all", label: t.all }]} />
        <DropdownField id="log-entity" label={t.entity} value={filters.entityType} onChange={(value) => update("entityType", value)} options={[{ value: "all", label: t.all }, { value: "USER", label: locale === "zh" ? "用户" : "User" }, { value: "DEPARTMENT", label: locale === "zh" ? "部门" : "Department" }, { value: "PROJECT", label: locale === "zh" ? "项目" : "Project" }]} />
        <DropdownField id="log-action" label={t.action} value={filters.action} onChange={(value) => update("action", value)} options={[{ value: "all", label: t.all }, { value: "CREATE", label: locale === "zh" ? "创建" : "Create" }, { value: "UPDATE", label: locale === "zh" ? "更新" : "Update" }, { value: "DELETE", label: locale === "zh" ? "删除" : "Delete" }]} />
        <DropdownField id="log-actor" label={t.actor} value={filters.actorId} onChange={(value) => update("actorId", value)} options={[{ value: "all", label: t.all }, ...actors.map((actor) => ({ value: actor.id, label: actor.name }))]} />
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[860px]">
          <TableHeader className="bg-muted/50"><TableRow><TableHead className="pl-6">{t.time}</TableHead><TableHead>{t.actor}</TableHead><TableHead>{t.action}</TableHead><TableHead>{t.entity}</TableHead><TableHead>{t.target}</TableHead><TableHead>{t.field}</TableHead></TableRow></TableHeader>
          <TableBody>{logs.map((log) => <TableRow key={log.id}><TableCell className="pl-6 text-xs text-muted-foreground">{formatFullDateTime(log.createdAt, locale)}</TableCell><TableCell className="font-medium">{log.actorName}</TableCell><TableCell><Badge variant={log.action === "DELETE" ? "destructive" : "outline"}>{governanceLabel(log.action, locale)}</Badge></TableCell><TableCell>{governanceLabel(log.entityType, locale)}</TableCell><TableCell>{log.targetName}</TableCell><TableCell className="text-muted-foreground">{governanceLabel(log.field, locale)}</TableCell></TableRow>)}
            {logs.length === 0 ? <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="h-40 text-center text-muted-foreground"><History className="mx-auto mb-3 size-8 opacity-35" />{t.noLogs}</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3 text-sm"><span className="text-muted-foreground">{total} {t.records}</span><div className="flex items-center gap-2"><Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}><ArrowLeft /></Button><span className="font-medium">{t.page} {page} / {totalPages}</span><Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}><ArrowRight /></Button></div></div>
    </Card>
  </div>;
}
