"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useWorkflowStore } from "@/lib/workflow-store";

export default function Topbar() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const resetDemo = useWorkflowStore((state) => state.resetDemo);

  const handleReset = () => {
    if (!confirm("Reset the demo workflow? This will overwrite your current work.")) {
      return;
    }

    resetDemo();
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-muted/20 px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <p className="text-base font-bold tracking-tight">FlowForge</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Workflow editor
          </p>
        </div>

        <Separator orientation="vertical" className="h-5" />

        <p className="text-xs text-muted-foreground">
          {nodes.length} node{nodes.length === 1 ? "" : "s"} · {edges.length} connection
          {edges.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Reset demo
        </Button>

        <Button size="sm">Save</Button>
      </div>
    </header>
  );
}