import { create } from "zustand";
import type { Edge, Node } from "@xyflow/react";

type NodeDataUpdate = Record<string, unknown>;

type WorkflowPayload = {
  nodes: Node[];
  edges: Edge[];
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type RunStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "error";

export type ExecutionLogEntry = {
  id: string;
  message: string;
  timestamp: string;
  tone: "neutral" | "info" | "success" | "error";
};

type WorkflowStore = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  currentWorkflowId: string | null;
  lastSavedAt: string | null;
  isLoadingWorkflow: boolean;
  saveStatus: SaveStatus;
  activeRunId: string | null;
  runStatus: RunStatus;
  executionLogs: ExecutionLogEntry[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setCurrentWorkflowId: (workflowId: string | null) => void;
  setLastSavedAt: (timestamp: string | null) => void;
  setIsLoadingWorkflow: (isLoading: boolean) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setActiveRunId: (runId: string | null) => void;
  setRunStatus: (status: RunStatus) => void;
  addExecutionLog: (
    message: string,
    tone?: ExecutionLogEntry["tone"],
  ) => void;
  clearExecutionLogs: () => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, updates: NodeDataUpdate) => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => boolean;
  hydrateFromServer: (workflow: {
    id: string;
    definition: WorkflowPayload;
    updatedAt: string;
  }) => void;
  resetDemo: () => void;
  toPayload: () => WorkflowPayload;
};

let nodeCounter = 0;
let logCounter = 0;

const STORAGE_KEY = "flowforge-workflow-v1";
const WORKFLOW_ID_STORAGE_KEY = "flowforge-workflow-id-v1";

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
  currentWorkflowId: null,
  lastSavedAt: null,
  isLoadingWorkflow: true,
  saveStatus: "idle",
  activeRunId: null,
  runStatus: "idle",
  executionLogs: [],

  setNodes: (nodes) => set({ nodes, saveStatus: "idle" }),

  setEdges: (edges) => set({ edges, saveStatus: "idle" }),

  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),

  setCurrentWorkflowId: (currentWorkflowId) => {
    if (currentWorkflowId) {
      localStorage.setItem(WORKFLOW_ID_STORAGE_KEY, currentWorkflowId);
    } else {
      localStorage.removeItem(WORKFLOW_ID_STORAGE_KEY);
    }

    set({ currentWorkflowId });
  },

  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),

  setIsLoadingWorkflow: (isLoadingWorkflow) => set({ isLoadingWorkflow }),

  setSaveStatus: (saveStatus) => set({ saveStatus }),

  setActiveRunId: (activeRunId) => set({ activeRunId }),

  setRunStatus: (runStatus) => set({ runStatus }),

  addExecutionLog: (message, tone = "neutral") =>
    set((state) => {
      logCounter += 1;

      return {
        executionLogs: [
          ...state.executionLogs,
          {
            id: `log-${Date.now()}-${logCounter}`,
            message,
            timestamp: new Date().toISOString(),
            tone,
          },
        ],
      };
    }),

  clearExecutionLogs: () => set({ executionLogs: [] }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
      saveStatus: "idle",
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
          : node,
      ),
      saveStatus: "idle",
    })),

  saveToLocalStorage: () => {
    const { nodes, edges } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
  },

  loadFromLocalStorage: () => {
    const rawWorkflow = localStorage.getItem(STORAGE_KEY);
    const storedWorkflowId = localStorage.getItem(WORKFLOW_ID_STORAGE_KEY);

    if (!rawWorkflow) {
      return false;
    }

    try {
      const parsed = JSON.parse(rawWorkflow) as WorkflowPayload;
      set({
        nodes: parsed.nodes,
        edges: parsed.edges,
        currentWorkflowId: storedWorkflowId,
        saveStatus: storedWorkflowId ? "saved" : "idle",
      });
      return true;
    } catch {
      return false;
    }
  },

  hydrateFromServer: (workflow) => {
    // Server data wins after a successful fetch; local storage remains an offline fallback.
    set({
      nodes: workflow.definition.nodes,
      edges: workflow.definition.edges,
      currentWorkflowId: workflow.id,
      lastSavedAt: workflow.updatedAt,
      saveStatus: "saved",
    });

    localStorage.setItem(WORKFLOW_ID_STORAGE_KEY, workflow.id);
    get().saveToLocalStorage();
  },

  resetDemo: () => {
    nodeCounter = 0;
    localStorage.removeItem(WORKFLOW_ID_STORAGE_KEY);

    set({
      nodes: demoNodes,
      edges: demoEdges,
      selectedNodeId: null,
      currentWorkflowId: null,
      lastSavedAt: null,
      saveStatus: "idle",
      activeRunId: null,
      runStatus: "idle",
      executionLogs: [],
    });

    get().saveToLocalStorage();
  },

  toPayload: () => {
    const { nodes, edges } = get();
    return { nodes, edges };
  },
}));

export function generateNodeId(prefix: string) {
  nodeCounter += 1;
  return `${prefix}-${nodeCounter}-${Date.now()}`;
}