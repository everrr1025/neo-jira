"use client";

import { usePathname } from "next/navigation";

export function AppShell({
  hasSession,
  authenticatedContent,
  unauthenticatedContent,
}: {
  hasSession: boolean;
  authenticatedContent: React.ReactNode;
  unauthenticatedContent: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname.startsWith("/login");

  if (!hasSession || isLoginPage) {
    return <>{unauthenticatedContent}</>;
  }

  return <>{authenticatedContent}</>;
}
