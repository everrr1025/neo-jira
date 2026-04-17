"use client";

import { useCallback, useEffect, useState } from "react";

import { Loader2 } from "lucide-react";
import Image from "next/image";

import {
  getIssueStatusLabel,
  getIssueTypeLabel,
  getPriorityLabel,
  getTranslations,
  Locale,
  localeDateMap,
} from "@/lib/i18n";
import { getDefaultAvatar } from "@/lib/avatar";
import { ISSUE_ACTIVITY_UPDATED_EVENT } from "@/lib/issueActivityEvents";

type ActivityUser = {
  id: string;
  name: string | null;
};

type ActivityIteration = {
  id: string;
  name: string;
};

type ActivityLog = {
  id: string;
  entityType: "ISSUE" | "COMMENT" | "ATTACHMENT";
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  metadata: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    avatar: string | null;
  } | null;
};

function parseMetadata(metadata: string | null) {
  if (!metadata) return {};

  try {
    const parsed = JSON.parse(metadata) as Record<string, string>;
    return parsed;
  } catch {
    return {};
  }
}

export default function ActivityLogSection({
  issueId,
  users,
  iterations,
  locale,
}: {
  issueId: string;
  users: ActivityUser[];
  iterations: ActivityIteration[];
  locale: Locale;
}) {
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const translations = getTranslations(locale);

  const fetchActivity = useCallback(async () => {
    try {
      const response = await fetch(`/api/issues/${issueId}/activity`);
      if (!response.ok) {
        throw new Error("Failed to fetch activity");
      }

      const logs = (await response.json()) as ActivityLog[];
      setActivity(logs);
    } catch (error) {
      console.error("Failed to fetch activity logs", error);
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    setLoading(true);
    void fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    const handleActivityUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ issueId?: string }>;
      if (customEvent.detail?.issueId !== issueId) return;
      void fetchActivity();
    };

    window.addEventListener(ISSUE_ACTIVITY_UPDATED_EVENT, handleActivityUpdated);
    return () => window.removeEventListener(ISSUE_ACTIVITY_UPDATED_EVENT, handleActivityUpdated);
  }, [fetchActivity, issueId]);

  const getFieldLabel = (field: string | null) => {
    if (field === "title") return translations.issueList.summary;
    if (field === "status") return translations.issueDetail.status;
    if (field === "priority") return translations.issueDetail.priority;
    if (field === "type") return translations.issueDetail.type;
    if (field === "assigneeId") return translations.issueDetail.assignee;
    if (field === "iterationId") return translations.issueDetail.sprint;
    if (field === "dueDate") return translations.issueDetail.dueDate;
    if (field === "description") return translations.issueDetail.description;
    return field || "";
  };

  const getFieldValueLabel = (field: string | null, value: string | null) => {
    if (!value) return translations.activitySection.emptyValue;

    if (field === "status") return getIssueStatusLabel(value, locale);
    if (field === "priority") return getPriorityLabel(value, locale);
    if (field === "type") return getIssueTypeLabel(value, locale);
    if (field === "assigneeId") {
      return users.find((user) => user.id === value)?.name || translations.issueList.unassigned;
    }
    if (field === "iterationId") {
      return iterations.find((iteration) => iteration.id === value)?.name || translations.issueList.backlog;
    }
    if (field === "dueDate") {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleDateString(localeDateMap[locale]);
    }

    return value;
  };

  const getActivityMessage = (entry: ActivityLog) => {
    const actorName = entry.actor?.name || translations.activitySection.unknownUser;
    const metadata = parseMetadata(entry.metadata);
    const preview = metadata.preview;
    const fileName = metadata.fileName;

    if (entry.entityType === "ISSUE" && entry.action === "CREATE") {
      return {
        primary:
          locale === "zh"
            ? `${actorName}${translations.activitySection.issueCreated}`
            : `${actorName} ${translations.activitySection.issueCreated}`,
      };
    }

    if (entry.entityType === "ISSUE" && entry.action === "DELETE") {
      return {
        primary:
          locale === "zh"
            ? `${actorName}${translations.activitySection.issueDeleted}`
            : `${actorName} ${translations.activitySection.issueDeleted}`,
      };
    }

    if (entry.entityType === "ISSUE" && entry.action === "UPDATE" && entry.field === "description") {
      return {
        primary:
          locale === "zh"
            ? `${actorName}${translations.activitySection.updatedDescription}`
            : `${actorName} ${translations.activitySection.updatedDescription}`,
      };
    }

    if (entry.entityType === "ISSUE" && entry.action === "UPDATE") {
      const fieldLabel = getFieldLabel(entry.field);
      const oldValue = getFieldValueLabel(entry.field, entry.oldValue);
      const newValue = getFieldValueLabel(entry.field, entry.newValue);

      return {
        primary:
          locale === "zh"
            ? `${actorName}${translations.activitySection.changed}${fieldLabel}，${translations.activitySection.from}“${oldValue}”${translations.activitySection.to}“${newValue}”`
            : `${actorName} ${translations.activitySection.changed} ${fieldLabel} ${translations.activitySection.from} "${oldValue}" ${translations.activitySection.to} "${newValue}"`,
      };
    }

    if (entry.entityType === "COMMENT") {
      const actionText =
        entry.action === "CREATE"
          ? translations.activitySection.commentAdded
          : entry.action === "DELETE"
            ? translations.activitySection.commentDeleted
            : translations.activitySection.commentUpdated;

      return {
        primary: locale === "zh" ? `${actorName}${actionText}` : `${actorName} ${actionText}`,
        secondary: preview,
      };
    }

    const attachmentAction =
      entry.action === "DELETE"
        ? translations.activitySection.attachmentDeleted
        : translations.activitySection.attachmentAdded;

    return {
      primary:
        locale === "zh"
          ? `${actorName}${attachmentAction}${fileName ? `：${fileName}` : ""}`
          : `${actorName} ${attachmentAction}${fileName ? `: ${fileName}` : ""}`,
    };
  };

  return (
    <div className="mt-8 border-t pt-8">
      <h3 className="mb-6 text-lg font-bold text-slate-800">
        {translations.activitySection.title} ({activity.length})
      </h3>

      {loading ? (
        <div className="py-4 text-center text-slate-500">
          <Loader2 className="mr-2 inline animate-spin" size={16} />
          {translations.activitySection.loading}
        </div>
      ) : activity.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {translations.activitySection.noActivity}
        </div>
      ) : (
        <div className="space-y-4">
          {activity.map((entry) => {
            const avatarUrl = entry.actor?.avatar || getDefaultAvatar(entry.actor?.id || entry.id);
            const message = getActivityMessage(entry);

            return (
              <div key={entry.id} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  <Image
                    src={avatarUrl}
                    alt={entry.actor?.name || translations.activitySection.unknownUser}
                    width={36}
                    height={36}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-6 text-slate-800">{message.primary}</div>
                  {message.secondary ? (
                    <div className="mt-1 line-clamp-2 text-sm text-slate-500">{message.secondary}</div>
                  ) : null}
                  <div className="mt-1 text-xs text-slate-400">
                    {new Date(entry.createdAt).toLocaleString(localeDateMap[locale])}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
