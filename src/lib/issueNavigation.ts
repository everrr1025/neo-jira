const APP_ORIGIN = "http://neo-jira.local";

export function buildIssueDetailHref(issueId: string, returnTo: string) {
  const returnUrl = new URL(returnTo, APP_ORIGIN);
  const projectMatch = returnUrl.pathname.match(/^(\/departments\/[^/]+\/projects\/[^/]+)(?:\/|$)/);
  const issuePath = projectMatch
    ? `${projectMatch[1]}/issues/${encodeURIComponent(issueId)}`
    : `/issues/${encodeURIComponent(issueId)}`;
  return `${issuePath}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function resolveIssueReturnTo(candidate: string | null | undefined) {
  if (!candidate) return "/issues";

  try {
    const url = new URL(candidate, APP_ORIGIN);
    const isLegacyAllowedPath =
      url.pathname === "/issues" ||
      /^\/iterations\/[^/]+$/.test(url.pathname) ||
      /^\/plans\/[^/]+$/.test(url.pathname);
    const isProjectAllowedPath =
      /^\/departments\/[^/]+\/projects\/[^/]+\/(?:issues|iterations\/[^/]+|plans\/[^/]+)$/.test(url.pathname);

    if (url.origin !== APP_ORIGIN || (!isLegacyAllowedPath && !isProjectAllowedPath)) return "/issues";

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/issues";
  }
}
