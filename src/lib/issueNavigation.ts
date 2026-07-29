const APP_ORIGIN = "http://neo-jira.local";

export function buildIssueDetailHref(issueId: string, returnTo: string) {
  return `/issues/${encodeURIComponent(issueId)}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function resolveIssueReturnTo(candidate: string | null | undefined) {
  if (!candidate) return "/issues";

  try {
    const url = new URL(candidate, APP_ORIGIN);
    const isAllowedPath =
      url.pathname === "/issues" ||
      /^\/iterations\/[^/]+$/.test(url.pathname) ||
      /^\/plans\/[^/]+$/.test(url.pathname);

    if (url.origin !== APP_ORIGIN || !isAllowedPath) return "/issues";

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/issues";
  }
}
