export function knowledgeReturnTarget(value: string | null, basePath: string) {
  if (!value?.startsWith("/") || value.startsWith("//")) return null;
  let url: URL;
  try { url = new URL(value, "https://knowledge.local"); } catch { return null; }
  if (url.origin !== "https://knowledge.local" || url.pathname !== basePath) return null;
  const params = new URLSearchParams();
  for (const key of ["folder", "search", "favorites", "trash"]) {
    const entry = url.searchParams.get(key);
    if (entry && (key === "folder" || key === "search" || entry === "1")) params.set(key, entry);
  }
  const kind = params.has("search") ? "search" : params.has("trash") ? "trash" : params.has("favorites") ? "favorites" : "list";
  return { href: `${basePath}${params.size ? `?${params}` : ""}`, kind };
}
