"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function PropertiesPanel() {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-muted/20">
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Properties
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Select a node to configure it
        </p>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="rounded-xl border border-dashed border-border bg-background/30 p-4 text-center">
            <p className="text-sm font-medium">No node selected</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Click a node on the canvas to inspect and configure it.
            </p>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}