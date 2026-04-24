"use client";

import { useCallback, useEffect, useState, useMemo } from "react";

import { Loader2 } from "lucide-react";
import Image from "next/image";

import {
  getTranslations,
  Locale,
  localeDateMap,
} from "@/lib/i18n";
import { getDefaultAvatar } from "@/lib/avatar";
import { ISSUE_ACTIVITY_UPDATED_EVENT } from "@/lib/issueActivityEvents";
import { formatActivityEntry, type ActivityLogEntry } from "@/lib/activityLogFormatter";

type ActivityUser = {
  id: string;
  name: string | null;
};

type ActivityIteration = {
  id: string;
  name: string;
};

type ActivityPlan = {
  id: string;
  name: string;
};

export default function ActivityLogSection({
  issueId,
  users,
  plans,
  iterations,
  locale,
}: {
  issueId: string;
  users: ActivityUser[];
  plans: ActivityPlan[];
  iterations: ActivityIteration[];
  locale: Locale;
}) {
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const translations = getTranslations(locale);

  const fetchActivity = useCallback(async () => {
    try {
      const response = await fetch(`/api/issues/${issueId}/activity`);
      if (!response.ok) {
        throw new Error("Failed to fetch activity");
      }

      const logs = (await response.json()) as ActivityLogEntry[];
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

  const assigneeNameById = Object.fromEntries(
    users
      .filter((user) => user.name)
      .map((user) => [user.id, user.name as string]),
  );
  const planNameById = Object.fromEntries(plans.map((plan) => [plan.id, plan.name]));
  const iterationNameById = Object.fromEntries(iterations.map((iteration) => [iteration.id, iteration.name]));

  const groupedActivity = useMemo(() => {
    const withoutComments = activity.filter((log) => log.entityType !== "COMMENT");
    return withoutComments.reduce((groups: any[], currentLog) => {
      const lastGroup = groups[groups.length - 1];

      if (
        lastGroup &&
        lastGroup.type === "UPDATE_GROUP" &&
        lastGroup.actor?.id === currentLog.actor?.id &&
        currentLog.action === "UPDATE" &&
        currentLog.entityType === "ISSUE" &&
        Math.abs(new Date(lastGroup.createdAt).getTime() - new Date(currentLog.createdAt).getTime()) < 5 * 60 * 1000
      ) {
        lastGroup.children.push(currentLog);
        return groups;
      }

      groups.push({
        type: currentLog.action === "UPDATE" && currentLog.entityType === "ISSUE" ? "UPDATE_GROUP" : "SINGLE_EVENT",
        id: currentLog.id,
        actor: currentLog.actor,
        createdAt: currentLog.createdAt,
        log: currentLog,
        children: [currentLog],
      });

      return groups;
    }, []);
  }, [activity]);

  return (
    <div className="mt-8 border-t pt-8">
      <h3 className="mb-6 text-lg font-bold text-slate-800">
        {translations.activitySection.title} ({groupedActivity.length})
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
          {groupedActivity.map((group) => {
            const avatarUrl = group.actor?.avatar || getDefaultAvatar(group.actor?.id || group.id);
            const actorName = group.actor?.name || translations.activitySection.unknownUser;

            return (
              <div key={group.id} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <div className="h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shrink-0">
                  <Image
                    src={avatarUrl}
                    alt={actorName}
                    width={36}
                    height={36}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  {group.type === "UPDATE_GROUP" && group.children.length > 1 ? (
                    <>
                      <div className="text-sm font-medium leading-6 text-slate-800">
                        {actorName} {locale === "zh" ? `批量更新了 ${group.children.length} 个字段` : `updated ${group.children.length} fields`}
                      </div>
                      <div className="mt-2 space-y-2 border-l-2 border-slate-100 pl-3">
                        {group.children.map((child: ActivityLogEntry) => {
                          const msg = formatActivityEntry(child, locale, {
                            assigneeNameById,
                            planNameById,
                            iterationNameById,
                          });
                          const strippedMsg = msg.primary.replace(actorName, "").replace(/^\s*(changed|修改了)\s*/, "").trim();
                          
                          return (
                            <div key={child.id} className="text-sm text-slate-600">
                              <span className="capitalize">{strippedMsg}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        {new Date(group.createdAt).toLocaleString(localeDateMap[locale])}
                      </div>
                    </>
                  ) : (
                    group.children.map((child: ActivityLogEntry) => {
                      const msg = formatActivityEntry(child, locale, {
                        assigneeNameById,
                        planNameById,
                        iterationNameById,
                      });
                      return (
                        <div key={child.id}>
                          <div className="text-sm font-medium leading-6 text-slate-800">{msg.primary}</div>
                          {msg.secondary ? (
                            <div className="mt-1 line-clamp-2 text-sm text-slate-500">{msg.secondary}</div>
                          ) : null}
                          <div className="mt-1 text-xs text-slate-400">
                            {new Date(child.createdAt).toLocaleString(localeDateMap[locale])}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
