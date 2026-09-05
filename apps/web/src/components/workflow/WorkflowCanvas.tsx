"use client";

import { useEffect } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWorkflowStore } from "@/lib/workflow-store";

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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const setStoreNodes = useWorkflowStore((state) => state.setNodes);
  const setStoreEdges = useWorkflowStore((state) => state.setEdges);
  const setSelectedNodeId = useWorkflowStore(
    (state) => state.setSelectedNodeId
  );

  useEffect(() => {
    setStoreNodes(nodes);
  }, [nodes, setStoreNodes]);

  useEffect(() => {
    setStoreEdges(edges);
  }, [edges, setStoreEdges]);

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    setSelectedNodeId(node.id);
  };

  const handlePaneClick = () => {
    setSelectedNodeId(null);
  };

  return (
    <section className="relative min-h-0 flex-1 bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
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
          {nodes.length} nodes · {edges.length} connection
          {edges.length === 1 ? "" : "s"}
        </p>
      </div>
    </section>
  );
}