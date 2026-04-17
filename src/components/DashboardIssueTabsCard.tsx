"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { getPriorityLabel, getStatusLabel, getTranslations, localeDateMap, type Locale } from "@/lib/i18n";

type DashboardIssue = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | Date | null;
};

type IssueTab = {
  id: string;
  title: string;
  issues: DashboardIssue[];
  emptyText: string;
  meta: "status" | "priority" | "dueDate";
  accent: "blue" | "orange" | "rose";
  href: string;
  count: number;
};

export default function DashboardIssueTabsCard({
  tabs,
  locale,
}: {
  tabs: IssueTab[];
  locale: Locale;
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");
  const translations = getTranslations(locale);

  const currentTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) ?? tabs[0],
    [activeTab, tabs],
  );

  if (!currentTab) return null;

  const accentClass =
    currentTab.accent === "blue"
      ? "hover:border-blue-300 hover:bg-blue-50/40"
      : currentTab.accent === "orange"
        ? "hover:border-orange-300 hover:bg-orange-50/40"
        : "hover:border-rose-300 hover:bg-rose-50/40";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-slate-900">{currentTab.title}</h3>
          <Link href={currentTab.href} className="text-sm font-medium text-blue-600 hover:underline">
            {translations.dashboard.viewAll}
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = tab.id === currentTab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>{tab.title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {currentTab.issues.length > 0 ? (
          currentTab.issues.map((issue) => (
            <Link
              key={issue.id}
              href={`/issues/${issue.id}`}
              className={`block rounded-xl border border-slate-200 p-3 transition-colors ${accentClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold text-slate-500">{issue.key}</span>
                <span className={getIssueMetaBadge(currentTab.meta, issue)}>{getIssueMetaText(currentTab.meta, issue, locale)}</span>
              </div>
              <h4 className="mt-2 text-sm font-medium text-slate-800 line-clamp-2">{issue.title}</h4>
            </Link>
          ))
        ) : (
          <div className="py-10 text-center text-sm text-slate-400">{currentTab.emptyText}</div>
        )}
      </div>
    </section>
  );
}

function getIssueMetaText(meta: "status" | "priority" | "dueDate", issue: DashboardIssue, locale: Locale) {
  if (meta === "dueDate") {
    const dueDate = issue.dueDate ? new Date(issue.dueDate) : null;
    return dueDate ? dueDate.toLocaleDateString(localeDateMap[locale]) : "--";
  }

  if (meta === "priority") {
    return getPriorityLabel(issue.priority, locale);
  }

  return getStatusLabel(issue.status, locale);
}

function getIssueMetaBadge(meta: "status" | "priority" | "dueDate", issue: DashboardIssue) {
  if (meta === "dueDate") {
    return "text-[11px] font-bold text-rose-600";
  }

  if (meta === "priority") {
    return getPriorityBadgeClass(issue.priority);
  }

  return getStatusBadgeClass(issue.status);
}

function getStatusBadgeClass(status: string) {
  if (status === "DONE") {
    return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
  }

  if (status === "IN_PROGRESS" || status === "IN_TESTING") {
    return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700";
  }

  return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600";
}

function getPriorityBadgeClass(priority: string) {
  if (priority === "URGENT") {
    return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700";
  }

  if (priority === "HIGH") {
    return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700";
  }

  if (priority === "MEDIUM") {
    return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700";
  }

  return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
}
