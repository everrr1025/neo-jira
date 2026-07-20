"use client";

import { LayoutGrid, List } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  ITERATION_LAYOUT_COOKIE,
  type IterationLayout,
} from "@/lib/iterationLayout";
import { getTranslations, type Locale } from "@/lib/i18n";

export default function IterationLayoutToggle({
  layout,
  locale,
}: {
  layout: IterationLayout;
  locale: Locale;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const text = getTranslations(locale).iterationDetail;

  const selectLayout = (nextLayout: IterationLayout) => {
    if (nextLayout === layout) return;

    document.cookie = `${ITERATION_LAYOUT_COOKIE}=${nextLayout}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const params = new URLSearchParams(searchParams.toString());
    params.set("layout", nextLayout);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-md border bg-background p-1 shadow-xs" aria-label={text.viewMode}>
      <Button
        type="button"
        variant={layout === "board" ? "default" : "ghost"}
        size="icon-sm"
        className={layout === "board" ? "shadow-xs" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}
        aria-pressed={layout === "board"}
        aria-label={text.board}
        title={text.board}
        onClick={() => selectLayout("board")}
      >
        <LayoutGrid className="size-4" />
      </Button>
      <Button
        type="button"
        variant={layout === "list" ? "default" : "ghost"}
        size="icon-sm"
        className={layout === "list" ? "shadow-xs" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}
        aria-pressed={layout === "list"}
        aria-label={text.list}
        title={text.list}
        onClick={() => selectLayout("list")}
      >
        <List className="size-4" />
      </Button>
    </div>
  );
}
