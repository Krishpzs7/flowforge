"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function ExecutionPanel() {
  return (
    <section className="flex h-48 shrink-0 flex-col border-t border-border bg-muted/10">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Execution log</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Workflow events will appear here during a run.
          </p>
        </div>

        <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Idle
        </span>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4 font-mono text-xs">
          <p className="text-muted-foreground">
            <span className="mr-2 text-violet-400">›</span>
            Waiting for a workflow execution...
          </p>
        </div>
      </ScrollArea>
    </section>
  );
}