"use client";

import { ChangeEvent } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useWorkflowStore } from "@/lib/workflow-store";

export default function PropertiesPanel() {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const nodes = useWorkflowStore((state) => state.nodes);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  const handleLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedNode) {
      return;
    }

    updateNodeData(selectedNode.id, {
      label: event.target.value,
    });
  };

  const handleDescriptionChange = (
    event: ChangeEvent<HTMLTextAreaElement>
  ) => {
    if (!selectedNode) {
      return;
    }

    updateNodeData(selectedNode.id, {
      description: event.target.value,
    });
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-muted/20">
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Properties
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure the selected workflow node
        </p>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="p-4">
          {selectedNode ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-background/60 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Node type
                </p>
                <p className="mt-1 text-sm font-semibold capitalize">
                  {String(selectedNode.data.nodeType ?? "custom")}
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="node-label"
                  className="text-xs font-medium text-foreground"
                >
                  Display name
                </label>

                <input
                  id="node-label"
                  type="text"
                  value={String(selectedNode.data.label ?? "")}
                  onChange={handleLabelChange}
                  placeholder="Enter a node name"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="node-description"
                  className="text-xs font-medium text-foreground"
                >
                  Description
                </label>

                <textarea
                  id="node-description"
                  value={String(selectedNode.data.description ?? "")}
                  onChange={handleDescriptionChange}
                  placeholder="Describe what this node does"
                  rows={4}
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">
                  Node details
                </p>

                <div className="space-y-1 rounded-md bg-muted/50 p-3 font-mono text-[11px] text-muted-foreground">
                  <p>
                    <span className="text-foreground">id:</span>{" "}
                    {selectedNode.id}
                  </p>
                  <p>
                    <span className="text-foreground">x:</span>{" "}
                    {Math.round(selectedNode.position.x)}
                  </p>
                  <p>
                    <span className="text-foreground">y:</span>{" "}
                    {Math.round(selectedNode.position.y)}
                  </p>
                </div>
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