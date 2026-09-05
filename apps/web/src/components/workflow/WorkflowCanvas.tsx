"use client";

import { useCallback, useEffect } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import CustomNode from "@/components/workflow/nodes/CustomNode";
import { generateNodeId, useWorkflowStore } from "@/lib/workflow-store";

const nodeTypes = {
  custom: CustomNode,
};

const nodeMetadata: Record<
  string,
  {
    icon: string;
    iconColor: string;
    description: string;
  }
> = {
  webhook: {
    icon: "◉",
    iconColor: "text-emerald-500",
    description: "Start workflow",
  },
  condition: {
    icon: "◇",
    iconColor: "text-amber-500",
    description: "Branch workflow",
  },
  transform: {
    icon: "✦",
    iconColor: "text-sky-500",
    description: "Transform data",
  },
  delay: {
    icon: "◷",
    iconColor: "text-orange-500",
    description: "Wait before next step",
  },
  http: {
    icon: "↗",
    iconColor: "text-blue-500",
    description: "Call external API",
  },
  database: {
    icon: "▤",
    iconColor: "text-violet-500",
    description: "Read or write data",
  },
  notification: {
    icon: "◌",
    iconColor: "text-pink-500",
    description: "Send notification",
  },
};

const initialNodes: Node[] = [
  {
    id: "webhook",
    type: "custom",
    position: { x: 260, y: 120 },
    data: {
      label: "Webhook",
      nodeType: "webhook",
      status: "idle",
      ...nodeMetadata.webhook,
    },
  },
  {
    id: "validate-order",
    type: "custom",
    position: { x: 260, y: 280 },
    data: {
      label: "Validate Order",
      nodeType: "transform",
      status: "idle",
      ...nodeMetadata.transform,
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: "webhook-to-validate",
    source: "webhook",
    target: "validate-order",
    animated: true,
    style: { stroke: "#8b5cf6", strokeWidth: 2 },
  },
];

function CanvasInner() {
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

      if (!nodeType || !nodeName) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const metadata = nodeMetadata[nodeType] ?? {
        icon: "◉",
        iconColor: "text-violet-500",
        description: "Workflow step",
      };

      const newNode: Node = {
        id: generateNodeId(nodeType),
        type: "custom",
        position,
        data: {
          label: nodeName,
          nodeType,
          status: "idle",
          ...metadata,
        },
      };

      setNodes((currentNodes) => [...currentNodes, newNode]);
    },
    [screenToFlowPosition, setNodes]
  );

  return (
    <section
      className="relative min-h-0 flex-1 bg-background"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />

        <MiniMap
          className="!bottom-4 !right-4 !rounded-lg !border !border-border !bg-background"
          nodeColor="#8b5cf6"
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