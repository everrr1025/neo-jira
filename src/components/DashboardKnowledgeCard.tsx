"use client";

import { useState } from "react";
import Link from "next/link";
import { File, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTranslations, localeDateMap, type Locale } from "@/lib/i18n";
import type { ProjectKnowledgeSummary } from "@/lib/knowledge";

export default function DashboardKnowledgeCard({ data, locale, projectPath, initialTab = "recent" }: {
  data: ProjectKnowledgeSummary; locale: Locale; projectPath: string; initialTab?: "recent" | "favorites";
}) {
  const [tab, setTab] = useState(initialTab);
  const t = (zh: string, en: string) => locale === "zh" ? zh : en;
  const knowledgePath = `${projectPath}/knowledge`;
  const source = `${projectPath}${tab === "favorites" ? "?knowledge=favorites" : ""}`;
  const items = data[tab];

  return <section aria-label={t("项目知识", "Project knowledge")} className="w-full min-w-0 overflow-hidden rounded-xl border bg-background">
    <Tabs value={tab} onValueChange={(value) => setTab(value as "recent" | "favorites")} className="min-w-0 gap-0">
    <div className="flex min-w-0 items-center gap-2 border-b bg-muted/35 px-4 py-3">
      <h3 className="shrink-0 text-sm font-semibold text-foreground">{t("知识", "Knowledge")}</h3>
      <div className="flex w-0 min-w-0 flex-1 flex-nowrap gap-1.5 overflow-x-auto">
        <TabsList variant="line" aria-label={t("知识列表", "Knowledge lists")} className="p-0 group-data-[orientation=horizontal]/tabs:h-7">
          {(["recent", "favorites"] as const).map((value) => <TabsTrigger key={value} value={value} className="flex-none px-2 text-xs after:hidden">{value === "recent" ? t("最近更新", "Recently updated") : t("我的收藏", "My favorites")}</TabsTrigger>)}
        </TabsList>
      </div>
      <Link href={`${knowledgePath}${tab === "favorites" ? "?favorites=1" : ""}`} className="inline-flex shrink-0 justify-end rounded-md py-1 text-xs font-semibold text-muted-foreground hover:text-accent-foreground">{getTranslations(locale).dashboard.viewAll}</Link>
    </div>
    <TabsContent value={tab} className="min-w-0 py-2">
      {items.length ? items.map((item) => <Link key={item.id} href={`${knowledgePath}/${item.id}?${new URLSearchParams({ from: source })}`} title={item.title} className="flex h-10 w-full min-w-0 items-center gap-2 px-4 transition-colors hover:bg-muted/40">
        {item.type === "DOCUMENT" ? <FileText className="size-4 shrink-0 text-muted-foreground" /> : <File className="size-4 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.title}</span>
        <time dateTime={item.updatedAt} className="shrink-0 text-xs text-muted-foreground">{new Date(item.updatedAt).toLocaleString(localeDateMap[locale], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</time>
      </Link>) : <div className="px-4 py-8 text-center text-sm text-muted-foreground">{tab === "recent" ? t("暂无知识资料", "No knowledge materials yet") : t("暂无收藏", "No favorites yet")}</div>}
    </TabsContent>
    </Tabs>
  </section>;
}
