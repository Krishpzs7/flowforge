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

type SaveWorkflowInput = {
  name: string;
  definition: WorkflowDefinition;
};

// The API returns the complete record so the client can retain the workflow ID.
async function parseWorkflowResponse(response: Response): Promise<ApiWorkflow> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<ApiWorkflow>;
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

  return parseWorkflowResponse(response);
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

  return parseWorkflowResponse(response);
}