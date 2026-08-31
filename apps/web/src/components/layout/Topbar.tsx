"use client";

import { Button } from "@/components/ui/button";

export default function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white shadow-sm">
          F
        </div>

        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold tracking-tight">FlowForge</h1>

          <span className="text-xs text-muted-foreground">
            Order Processing
          </span>
        </div>

        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Draft
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" type="button">
          Save
        </Button>

        <Button
          size="sm"
          type="button"
          className="bg-violet-600 text-white hover:bg-violet-500"
        >
          Run workflow
        </Button>
      </div>
    </header>
  );
}