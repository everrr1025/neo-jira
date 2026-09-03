export type ListDateFilter = "ALL" | "EQ" | "GTE" | "LTE";
export type ListDateFilterWithBetween = ListDateFilter | "BETWEEN";

export function normalizeListDateFilter(value: string | undefined): ListDateFilter {
  return value === "EQ" || value === "GTE" || value === "LTE" ? value : "ALL";
}

export function normalizeListDateFilterWithBetween(value: string | undefined): ListDateFilterWithBetween {
  return value === "BETWEEN" ? value : normalizeListDateFilter(value);
}

export function resolveListDateFilterRange(filter: ListDateFilter, dateValue: string) {
  if (filter === "ALL" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;

  const start = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const nextDay = new Date(start);
  nextDay.setDate(nextDay.getDate() + 1);

  if (filter === "EQ") return { gte: start, lt: nextDay };
  if (filter === "GTE") return { gte: start };
  return { lt: nextDay };
}

export function resolveListDateFilterRangeWithBetween(
  filter: ListDateFilterWithBetween,
  dateValue: string,
  endDateValue: string,
) {
  if (filter !== "BETWEEN") return resolveListDateFilterRange(filter, dateValue);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateValue)) return null;

  const start = new Date(`${dateValue}T00:00:00`);
  const end = new Date(`${endDateValue}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end < start) return { gte: start, lt: start };
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}
