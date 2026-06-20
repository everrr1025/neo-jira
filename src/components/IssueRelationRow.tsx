"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getIssueTypeLabel, type Locale } from "@/lib/i18n";
import { getWorkflowStatusBadgeClass, getWorkflowStatusName, type WorkflowStatusRecord } from "@/lib/workflows";
import { cn } from "@/lib/utils";

export type IssueRelationRowIssue = {
  id: string;
  key: string;
  title: string;
  type: string;
  status: string;
};

type IssueRelationRowProps = {
  issue: IssueRelationRowIssue;
  locale: Locale;
  workflowStatuses: WorkflowStatusRecord[];
  asLink?: boolean;
  className?: string;
};

export default function IssueRelationRow({
  issue,
  locale,
  workflowStatuses,
  asLink = true,
  className,
}: IssueRelationRowProps) {
  const content = (
    <>
      <span className="shrink-0 text-xs font-semibold text-muted-foreground">{issue.key}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{issue.title}</span>
      <Badge variant="outline" className="shrink-0 rounded-md text-[10px] uppercase text-muted-foreground">
        {getIssueTypeLabel(issue.type, locale)}
      </Badge>
      <Badge
        variant="outline"
        className={cn("shrink-0 rounded-md text-[10px] uppercase", getWorkflowStatusBadgeClass(issue.status, workflowStatuses))}
      >
        {getWorkflowStatusName(issue.status, workflowStatuses, locale)}
      </Badge>
    </>
  );
  const rowClassName = cn(
    "flex min-w-0 items-center gap-2 rounded-md px-3 py-2 transition-colors",
    asLink ? "hover:bg-muted/60" : "",
    className
  );

  if (!asLink) {
    return <div className={rowClassName}>{content}</div>;
  }

  return (
    <Link href={`/issues/${issue.id}`} className={rowClassName}>
      {content}
    </Link>
  );
}
