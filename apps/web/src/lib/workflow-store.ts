import { create } from "zustand";
import type { Edge, Node } from "@xyflow/react";

type NodeDataUpdate = Record<string, unknown>;

type WorkflowStore = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, updates: NodeDataUpdate) => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => boolean;
  resetDemo: () => void;
};

let nodeCounter = 0;

const STORAGE_KEY = "flowforge-workflow-v1";

// Initial demo workflow used for new users and Reset demo.
const demoNodes: Node[] = [
  {
    id: "webhook",
    type: "custom",
    position: { x: 260, y: 120 },
    data: {
      label: "Webhook",
      nodeType: "webhook",
      status: "idle",
      icon: "◉",
      iconColor: "text-emerald-500",
      description: "Start workflow",
      configuration: {
        method: "POST",
        path: "/orders",
      },
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
      icon: "✦",
      iconColor: "text-sky-500",
      description: "Transform data",
      configuration: {
        expression: "{{ { ...input, validated: true } }}",
      },
    },
  },
];

const demoEdges: Edge[] = [
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

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  updateNodeData: (nodeId, updates) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...updates,
              },
            }
          : node
      ),
    })),

  saveToLocalStorage: () => {
    const { nodes, edges } = get();
    const payload = JSON.stringify({ nodes, edges });
    localStorage.setItem(STORAGE_KEY, payload);
  },

  loadFromLocalStorage: () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw) as { nodes: Node[]; edges: Edge[] };
      set({ nodes: parsed.nodes, edges: parsed.edges });
      return true;
    } catch {
      return false;
    }
  },

  resetDemo: () => {
    nodeCounter = 0;
    set({ nodes: demoNodes, edges: demoEdges, selectedNodeId: null });
    get().saveToLocalStorage();
  },
}));

export function generateNodeId(prefix: string) {
  nodeCounter += 1;
  return `${prefix}-${nodeCounter}-${Date.now()}`;
}