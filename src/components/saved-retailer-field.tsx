"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseRetailerInput, savedRetailerLabel, sortedSavedRetailerLinks } from "@/lib/retailer";
import type { SavedRetailerLink } from "@/lib/types";

export function SavedRetailerField({
  value,
  saved,
  onChange,
}: {
  value: string;
  saved: SavedRetailerLink[];
  onChange: (url: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const suggestions = sortedSavedRetailerLinks(saved);

  function apply(raw: string) {
    setError(null);
    onChange(raw);
  }

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setError(null);
      onChange("");
      return;
    }
    const parsed = parseRetailerInput(trimmed);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onChange(parsed.url);
  }

  return (
    <div className="grid gap-2">
      <Input
        value={value}
        onChange={(event) => apply(event.target.value)}
        onBlur={() => commit(value)}
        placeholder="ebay.com or paste a listing"
        className="h-12"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {suggestions.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[13px] text-muted-foreground">Saved links</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 8).map((item) => {
              const selected = value.trim() === item.url;
              return (
                <Button
                  key={item.url}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "secondary"}
                  className="h-8 max-w-full rounded-full"
                  onClick={() => apply(item.url)}
                >
                  <span className="truncate">{savedRetailerLabel(item.url)}</span>
                </Button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Type a store (ebay.com) or paste a listing. We’ll suggest it next time — you can always add another.
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function parseOptionalRetailerUrl(value: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, url: "" };
  const parsed = parseRetailerInput(trimmed);
  if (!parsed.ok) return parsed;
  return { ok: true, url: parsed.url };
}
