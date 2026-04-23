import { type Locale } from "@/lib/i18n";

export function countPasswordCategories(password: string) {
  let categories = 0;
  if (/[A-Z]/.test(password)) categories += 1;
  if (/[a-z]/.test(password)) categories += 1;
  if (/[0-9]/.test(password)) categories += 1;
  if (/[^A-Za-z0-9]/.test(password)) categories += 1;
  return categories;
}

export const ISSUE_TITLE_MAX_LENGTH = 50;
export const PLAN_NAME_MAX_LENGTH = 50;
export const ITERATION_NAME_MAX_LENGTH = 50;

type NameField = "issueTitle" | "planName" | "sprintName";

const localizedFieldNames: Record<Locale, Record<NameField, string>> = {
  en: {
    issueTitle: "Issue title",
    planName: "Plan name",
    sprintName: "Sprint name",
  },
  zh: {
    issueTitle: "问题标题",
    planName: "计划名称",
    sprintName: "迭代名称",
  },
};

export function isValidPassword(password: string) {
  return password.length >= 8 && countPasswordCategories(password) >= 3;
}

export function getLocalizedFieldName(field: NameField, locale: Locale) {
  return localizedFieldNames[locale][field];
}

export function getInvalidDateRangeMessage(locale: Locale) {
  return locale === "zh" ? "请选择有效的日期范围" : "Please provide a valid date range";
}

export function getEndBeforeStartMessage(field: "plan" | "sprint", locale: Locale) {
  if (locale === "zh") {
    return field === "plan" ? "计划结束日期不能早于开始日期" : "迭代结束日期不能早于开始日期";
  }

  return field === "plan"
    ? "Plan end date cannot be earlier than the start date"
    : "Sprint end date cannot be earlier than the start date";
}

export function normalizeNameOrThrow(name: string, field: NameField, maxLength: number, locale: Locale) {
  const trimmedName = name.trim();
  const label = getLocalizedFieldName(field, locale);

  if (!trimmedName) {
    throw new Error(locale === "zh" ? `请输入${label}` : `${label} is required`);
  }

  if (trimmedName.length > maxLength) {
    throw new Error(locale === "zh" ? `${label}不能超过${maxLength}个字符` : `${label} must be ${maxLength} characters or fewer`);
  }

  return trimmedName;
}
