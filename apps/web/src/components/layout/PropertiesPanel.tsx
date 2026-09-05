"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useWorkflowStore } from "@/lib/workflow-store";

export default function PropertiesPanel() {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const nodes = useWorkflowStore((state) => state.nodes);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

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
          {selectedNode ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Node ID
                </p>
                <p className="mt-1 font-mono text-sm">{selectedNode.id}</p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Label
                </p>
                <p className="mt-1 text-sm">
                  {String(selectedNode.data.label ?? "Untitled")}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Position
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  x: {Math.round(selectedNode.position.x)}, y:{" "}
                  {Math.round(selectedNode.position.y)}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-background/30 p-4 text-center">
              <p className="text-sm font-medium">No node selected</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Click a node on the canvas to inspect and configure it.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}