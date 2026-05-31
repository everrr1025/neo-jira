"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIssueListFilters } from "@/components/issuelist/useIssueListFilters";
import { getTranslations, type Locale } from "@/lib/i18n";

export default function IssueSearchInput({ locale }: { locale: Locale }) {
  const translations = getTranslations(locale);
  const { filters, updateQueryParams } = useIssueListFilters();
  const search = filters.search;

  return (
    <div className="relative w-full sm:w-80">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={translations.issueList.searchPlaceholder}
        value={search}
        onChange={(event) => {
          updateQueryParams({ search: event.target.value });
        }}
        className="pl-9 pr-9"
      />
      {search ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            updateQueryParams({ search: null });
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={locale === "zh" ? "清除搜索" : "Clear search"}
          title={locale === "zh" ? "清除搜索" : "Clear search"}
        >
          <X size={14} />
        </Button>
      ) : null}
    </div>
  );
}
