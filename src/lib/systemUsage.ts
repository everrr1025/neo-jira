export const SYSTEM_TIME_ZONE = "Asia/Shanghai";

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getShanghaiDateKey(value: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SYSTEM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day) + days * DAY_MS;
  return new Date(utc).toISOString().slice(0, 10);
}

export function getDateKeys(days: number, now: Date = new Date()) {
  const today = getShanghaiDateKey(now);
  return Array.from({ length: days }, (_, index) => shiftDateKey(today, index - days + 1));
}

export function getShanghaiDayStart(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - SHANGHAI_OFFSET_MS);
}

export function getInactiveCutoff(days: number, now: Date = new Date()) {
  return getShanghaiDayStart(shiftDateKey(getShanghaiDateKey(now), -days));
}

export function daysSince(value: Date, now: Date = new Date()) {
  const current = getShanghaiDayStart(getShanghaiDateKey(now)).getTime();
  const previous = getShanghaiDayStart(getShanghaiDateKey(value)).getTime();
  return Math.max(0, Math.floor((current - previous) / DAY_MS));
}

export function buildUsagePeriod(
  dateKeys: string[],
  activities: Array<{ activityDate: string; userId: string; departmentIdSnapshot: string | null }>,
) {
  const usersByDate = new Map(dateKeys.map((date) => [date, new Set<string>()]));
  const departmentsByDate = new Map(dateKeys.map((date) => [date, new Set<string>()]));

  for (const activity of activities) {
    usersByDate.get(activity.activityDate)?.add(activity.userId);
    if (activity.departmentIdSnapshot) {
      departmentsByDate.get(activity.activityDate)?.add(activity.departmentIdSnapshot);
    }
  }

  const activeUsers = new Set<string>();
  const activeDepartments = new Set<string>();
  const trend = dateKeys.map((date) => {
    const users = usersByDate.get(date) ?? new Set<string>();
    const departments = departmentsByDate.get(date) ?? new Set<string>();
    users.forEach((id) => activeUsers.add(id));
    departments.forEach((id) => activeDepartments.add(id));
    return { date, activeUsers: users.size, activeDepartments: departments.size };
  });

  return { activeUsers: activeUsers.size, activeDepartments: activeDepartments.size, trend };
}
