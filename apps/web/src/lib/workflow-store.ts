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
  updateNodeData: (nodeId: string, updates: NodeDataUpdate) => void;
};

let nodeCounter = 0;

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),

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
}));

export function generateNodeId(prefix: string) {
  nodeCounter += 1;
  return `${prefix}-${nodeCounter}-${Date.now()}`;
}