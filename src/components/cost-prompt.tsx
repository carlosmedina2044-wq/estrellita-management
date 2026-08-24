"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseCostInput } from "@/lib/costs";

export function CostPrompt({
  suggested,
  onSave,
  onSkip,
}: {
  suggested?: number;
  onSave: (amount: number) => void;
  onSkip: () => void;
}) {
  const [value, setValue] = useState(suggested != null ? String(suggested) : "");
  const parsed = parseCostInput(value);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-muted-foreground">What did it cost?</span>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="0.00"
        className="h-9 w-24"
        aria-label="What did it cost?"
      />
      <Button
        type="button"
        className="h-9 px-3"
        disabled={parsed == null}
        onClick={() => {
          if (parsed != null) onSave(parsed);
        }}
      >
        Save
      </Button>
      <Button type="button" variant="secondary" className="h-9 px-3" onClick={onSkip}>
        Skip
      </Button>
    </div>
  );
}
