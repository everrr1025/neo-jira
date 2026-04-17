import {
  getIssueStatusLabel,
  getIssueTypeLabel,
  getPriorityLabel,
  getTranslations,
  type Locale,
} from "@/lib/i18n";

export type ActivityActor = {
  id: string;
  name: string | null;
  avatar?: string | null;
} | null;

export type ActivityLogEntry = {
  id: string;
  entityType: "ISSUE" | "COMMENT" | "ATTACHMENT";
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  metadata: string | null;
  createdAt: string | Date;
  actor: ActivityActor;
};

type LookupMaps = {
  assigneeNameById?: Record<string, string>;
  iterationNameById?: Record<string, string>;
};

export function parseActivityMetadata(metadata: string | null) {
  if (!metadata) return {};

  try {
    return JSON.parse(metadata) as Record<string, string>;
  } catch {
    return {};
  }
}

function getFieldLabel(field: string | null, locale: Locale) {
  const translations = getTranslations(locale);

  if (field === "title") return translations.issueList.summary;
  if (field === "status") return translations.issueDetail.status;
  if (field === "priority") return translations.issueDetail.priority;
  if (field === "type") return translations.issueDetail.type;
  if (field === "assigneeId") return translations.issueDetail.assignee;
  if (field === "iterationId") return translations.issueDetail.sprint;
  if (field === "dueDate") return translations.issueDetail.dueDate;
  if (field === "description") return translations.issueDetail.description;
  return field || "";
}

function getFieldValueLabel(
  field: string | null,
  value: string | null,
  locale: Locale,
  lookups: LookupMaps,
) {
  const translations = getTranslations(locale);
  if (!value) return translations.activitySection.emptyValue;

  if (field === "status") return getIssueStatusLabel(value, locale);
  if (field === "priority") return getPriorityLabel(value, locale);
  if (field === "type") return getIssueTypeLabel(value, locale);

  if (field === "assigneeId") {
    return lookups.assigneeNameById?.[value] || translations.issueList.unassigned;
  }

  if (field === "iterationId") {
    return lookups.iterationNameById?.[value] || translations.issueList.backlog;
  }

  if (field === "dueDate") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  }

  return value;
}

export function formatActivityEntry(
  entry: ActivityLogEntry,
  locale: Locale,
  lookups: LookupMaps = {},
) {
  const translations = getTranslations(locale);
  const actorName = entry.actor?.name || translations.activitySection.unknownUser;
  const metadata = parseActivityMetadata(entry.metadata);
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
    const fieldLabel = getFieldLabel(entry.field, locale);
    const oldValue = getFieldValueLabel(entry.field, entry.oldValue, locale, lookups);
    const newValue = getFieldValueLabel(entry.field, entry.newValue, locale, lookups);

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
}
