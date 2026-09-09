import type { Edge, Node } from "@xyflow/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type WorkflowDefinition = {
  nodes: Node[];
  edges: Edge[];
};

export type ApiWorkflow = {
  id: string;
  name: string;
  definition: WorkflowDefinition;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export type ApiWorkflowRun = {
  id: string;
  workflowId: string;
  status: WorkflowRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

type SaveWorkflowInput = {
  name: string;
  definition: WorkflowDefinition;
};

type CreateWorkflowRunInput = {
  input?: Record<string, unknown>;
};

// The API returns complete records so browser state can retain server identity and timestamps.
async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getWorkflow(workflowId: string): Promise<ApiWorkflow> {
  const response = await fetch(`${API_URL}/workflows/${workflowId}`);
  return parseResponse<ApiWorkflow>(response);
}

export async function createWorkflow(
  input: SaveWorkflowInput,
): Promise<ApiWorkflow> {
  const response = await fetch(`${API_URL}/workflows`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseResponse<ApiWorkflow>(response);
}

export async function updateWorkflow(
  workflowId: string,
  input: SaveWorkflowInput,
): Promise<ApiWorkflow> {
  const response = await fetch(`${API_URL}/workflows/${workflowId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseResponse<ApiWorkflow>(response);
}

export async function createWorkflowRun(
  workflowId: string,
  input: CreateWorkflowRunInput = {},
): Promise<ApiWorkflowRun> {
  const response = await fetch(`${API_URL}/workflows/${workflowId}/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseResponse<ApiWorkflowRun>(response);
}

export async function getWorkflowRuns(
  workflowId: string,
): Promise<ApiWorkflowRun[]> {
  const response = await fetch(`${API_URL}/workflows/${workflowId}/runs`);
  return parseResponse<ApiWorkflowRun[]>(response);
}