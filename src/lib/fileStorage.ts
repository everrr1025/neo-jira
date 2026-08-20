import { getDateKeys, getShanghaiDayStart } from "@/lib/systemUsage";

export function formatStorageSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  const precision = unitIndex === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;

  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function getStoragePeriodStart(days: number, now = new Date()) {
  return getShanghaiDayStart(getDateKeys(days, now)[0]);
}
