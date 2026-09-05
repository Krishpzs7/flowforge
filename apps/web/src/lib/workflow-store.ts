import { create } from "zustand";
import type { Edge, Node } from "@xyflow/react";

type WorkflowStore = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
};

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
}));