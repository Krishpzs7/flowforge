"use client";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const initialNodes: Node[] = [
  {
    id: "webhook",
    type: "default",
    position: { x: 260, y: 160 },
    data: { label: "Webhook" },
  },
  {
    id: "validate-order",
    type: "default",
    position: { x: 260, y: 300 },
    data: { label: "Validate Order" },
  },
];

const initialEdges: Edge[] = [
  {
    id: "webhook-to-validate",
    source: "webhook",
    target: "validate-order",
    animated: true,
  },
];

export default function WorkflowCanvas() {
  return (
    <section className="relative min-h-0 flex-1 bg-background">
      <ReactFlow
        defaultNodes={initialNodes}
        defaultEdges={initialEdges}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          className="!bottom-4 !right-4 !rounded-lg !border !border-border !bg-background"
          nodeColor="#7c3aed"
          maskColor="rgba(0, 0, 0, 0.25)"
        />
      </ReactFlow>

      <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-border bg-background/90 px-3 py-2 shadow-sm backdrop-blur">
        <p className="text-xs font-medium">Workflow canvas</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          2 nodes · 1 connection
        </p>
      </div>
    </section>
  );
}