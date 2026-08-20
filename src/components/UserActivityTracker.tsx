"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";

import { getShanghaiDateKey } from "@/lib/systemUsage";

export function UserActivityTracker({ userId }: { userId: string }) {
  const pathname = usePathname();

  const recordActivity = useCallback(async () => {
    const activityDate = getShanghaiDateKey();
    const storageKey = `sync-activity:${userId}:${activityDate}`;

    try {
      if (window.localStorage.getItem(storageKey) === "recorded") return;
      const response = await fetch("/api/usage/heartbeat", { method: "POST" });
      if (response.ok) window.localStorage.setItem(storageKey, "recorded");
    } catch {
      // Activity collection must never interrupt the user's workflow.
    }
  }, [userId]);

  useEffect(() => {
    void recordActivity();
  }, [pathname, recordActivity]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void recordActivity();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [recordActivity]);

  return null;
}
