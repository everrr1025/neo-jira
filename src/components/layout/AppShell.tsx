"use client";

import { usePathname } from "next/navigation";
import { UserActivityTracker } from "@/components/UserActivityTracker";

export function AppShell({
  hasSession,
  activityUserId,
  authenticatedContent,
  unauthenticatedContent,
}: {
  hasSession: boolean;
  activityUserId?: string;
  authenticatedContent: React.ReactNode;
  unauthenticatedContent: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname.startsWith("/login");

  if (!hasSession || isLoginPage) {
    return <>{unauthenticatedContent}</>;
  }

  return (
    <>
      {activityUserId ? <UserActivityTracker userId={activityUserId} /> : null}
      {authenticatedContent}
    </>
  );
}
