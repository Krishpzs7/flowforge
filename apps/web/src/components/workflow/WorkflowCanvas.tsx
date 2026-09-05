"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWorkflowStore, generateNodeId } from "@/lib/workflow-store";

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

function CanvasInner() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

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

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData(
        "application/flowforge-node-type"
      );
      const nodeName = event.dataTransfer.getData(
        "application/flowforge-node-name"
      );

      if (!nodeType || !nodeName) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: generateNodeId(nodeType),
        type: "default",
        position,
        data: { label: nodeName, nodeType },
      };

      setNodes((current) => [...current, newNode]);
    },
    [screenToFlowPosition, setNodes]
  );

  return (
    <section
      ref={wrapperRef}
      className="relative min-h-0 flex-1 bg-background"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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

export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}