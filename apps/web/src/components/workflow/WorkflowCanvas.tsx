"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
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
    style: {
      stroke: "#8b5cf6",
      strokeWidth: 2,
    },
  },
];

function CanvasInner() {
  const { screenToFlowPosition } = useReactFlow();
  const hasInitialized = useRef(false);

  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);
  const setSelectedNodeId = useWorkflowStore(
    (state) => state.setSelectedNodeId
  );

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    setNodes(initialNodes);
    setEdges(initialEdges);
    hasInitialized.current = true;
  }, [setEdges, setNodes]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes(applyNodeChanges(changes, nodes));
    },
    [nodes, setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(applyEdgeChanges(changes, edges));
    },
    [edges, setEdges]
  );

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    setSelectedNodeId(node.id);
  };

  const handlePaneClick = () => {
    setSelectedNodeId(null);
  };

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!connection.source || !connection.target) {
        return false;
      }

      if (connection.source === connection.target) {
        return false;
      }

      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);

      const sourceNodeType = String(sourceNode?.data.nodeType ?? "");
      const targetNodeType = String(targetNode?.data.nodeType ?? "");

      if (targetNodeType === "webhook") {
        return false;
      }

      if (sourceNodeType === "notification") {
        return false;
      }

      const alreadyConnected = edges.some(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target
      );

      return !alreadyConnected;
    },
    [edges, nodes]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) {
        return;
      }

      setEdges(
        addEdge(
          {
            ...connection,
            id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
            animated: true,
            style: {
              stroke: "#8b5cf6",
              strokeWidth: 2,
            },
          },
          edges
        )
      );
    },
    [edges, isValidConnection, setEdges]
  );

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

      setNodes([...nodes, newNode]);
      setSelectedNodeId(newNode.id);
    },
    [nodes, screenToFlowPosition, setNodes, setSelectedNodeId]
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
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        connectionLineStyle={{
          stroke: "#8b5cf6",
          strokeWidth: 2,
        }}
        defaultEdgeOptions={{
          animated: true,
          style: {
            stroke: "#8b5cf6",
            strokeWidth: 2,
          },
        }}
        deleteKeyCode={["Backspace", "Delete"]}
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