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
  entityType: "ISSUE" | "COMMENT" | "ATTACHMENT" | "USER" | "DEPARTMENT";
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
  planNameById?: Record<string, string>;
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
  if (field === "planId") return locale === "zh" ? "计划" : "Plan";
  if (field === "iterationId") return translations.issueDetail.sprint;
  if (field === "dueDate") return translations.issueDetail.dueDate;
  if (field === "description") return translations.issueDetail.description;
  return field || "";
}

function getFieldValueLabel(field: string | null, value: string | null, locale: Locale, lookups: LookupMaps) {
  const translations = getTranslations(locale);
  if (field === "status") return value ? getIssueStatusLabel(value, locale) : translations.activitySection.emptyValue;
  if (field === "priority") return value ? getPriorityLabel(value, locale) : translations.activitySection.emptyValue;
  if (field === "type") return value ? getIssueTypeLabel(value, locale) : translations.activitySection.emptyValue;

  if (field === "assigneeId") {
    if (!value) return translations.issueList.unassigned;
    return lookups.assigneeNameById?.[value] || value;
  }

  if (field === "planId") {
    if (!value) return locale === "zh" ? "未设置计划" : "No plan";
    return lookups.planNameById?.[value] || value;
  }

  if (field === "iterationId") {
    if (!value) return translations.issueList.backlog;
    return lookups.iterationNameById?.[value] || value;
  }

  if (!value) return translations.activitySection.emptyValue;

  if (field === "dueDate") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  }

  return value;
}

export function formatActivityEntry(entry: ActivityLogEntry, locale: Locale, lookups: LookupMaps = {}) {
  const translations = getTranslations(locale);
  const actorName = entry.actor?.name || translations.activitySection.unknownUser;
  const metadata = parseActivityMetadata(entry.metadata);
  const preview = metadata.preview;
  const fileName = metadata.fileName;
  const targetName = metadata.name || metadata.email || entry.newValue || entry.entityId;

  if (entry.entityType === "USER") {
    if (entry.action === "CREATE") {
      return {
        primary: locale === "zh" ? `${actorName} 创建了用户 ${targetName}` : `${actorName} created user ${targetName}`,
      };
    }

    if (entry.action === "DELETE") {
      return {
        primary: locale === "zh" ? `${actorName} 删除了用户 ${targetName}` : `${actorName} deleted user ${targetName}`,
      };
    }

    return {
      primary: locale === "zh" ? `${actorName} 更新了用户 ${targetName}` : `${actorName} updated user ${targetName}`,
    };
  }

  if (entry.entityType === "DEPARTMENT") {
    if (entry.action === "CREATE") {
      return {
        primary: locale === "zh" ? `${actorName} 创建了部门 ${targetName}` : `${actorName} created department ${targetName}`,
      };
    }

    if (entry.action === "DELETE") {
      return {
        primary: locale === "zh" ? `${actorName} 删除了部门 ${targetName}` : `${actorName} deleted department ${targetName}`,
      };
    }

    return {
      primary: locale === "zh" ? `${actorName} 更新了部门 ${targetName}` : `${actorName} updated department ${targetName}`,
    };
  }

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
