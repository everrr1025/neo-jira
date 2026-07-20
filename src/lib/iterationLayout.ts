export const ITERATION_LAYOUT_COOKIE = "neo-jira-iteration-layout";

export type IterationLayout = "board" | "list";

export function parseIterationLayout(value: string | string[] | undefined): IterationLayout | null {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  return normalizedValue === "board" || normalizedValue === "list" ? normalizedValue : null;
}
