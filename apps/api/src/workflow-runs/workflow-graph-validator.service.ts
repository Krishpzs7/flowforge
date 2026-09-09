import { BadRequestException, Injectable } from '@nestjs/common';

type WorkflowNode = {
  id?: string;
  data?: {
    nodeType?: string;
  };
};

type WorkflowEdge = {
  source?: string;
  target?: string;
};

type WorkflowDefinition = {
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
};

@Injectable()
export class WorkflowGraphValidatorService {
  validate(definition: unknown): void {
    const graph = definition as WorkflowDefinition;
    const nodes = graph?.nodes ?? [];
    const edges = graph?.edges ?? [];

    if (!Array.isArray(nodes) || nodes.length === 0) {
      throw new BadRequestException('Workflow must contain at least one node');
    }

    if (!Array.isArray(edges)) {
      throw new BadRequestException('Workflow edges must be an array');
    }

    const nodeIds = new Set<string>();
    const incoming = new Map<string, number>();
    const nodeTypes = new Map<string, string>();
    const adjacency = new Map<string, string[]>();

    for (const node of nodes) {
      if (!node.id || typeof node.id !== 'string') {
        throw new BadRequestException('Every workflow node requires an ID');
      }

      if (nodeIds.has(node.id)) {
        throw new BadRequestException(`Duplicate node ID: ${node.id}`);
      }

      nodeIds.add(node.id);
      incoming.set(node.id, 0);
      nodeTypes.set(node.id, node.data?.nodeType ?? 'custom');
      adjacency.set(node.id, []);
    }

    const triggerIds = [...nodeTypes.entries()]
      .filter(([, nodeType]) => nodeType === 'webhook')
      .map(([nodeId]) => nodeId);

    if (triggerIds.length === 0) {
      throw new BadRequestException(
        'Workflow must contain at least one webhook trigger',
      );
    }

    for (const edge of edges) {
      if (!edge.source || !edge.target) {
        throw new BadRequestException(
          'Every workflow edge requires source and target IDs',
        );
      }

      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        throw new BadRequestException(
          `Edge references an unknown node: ${edge.source} → ${edge.target}`,
        );
      }

      if (edge.source === edge.target) {
        throw new BadRequestException(
          'Workflow nodes cannot connect to themselves',
        );
      }

      // Webhooks are entry points and cannot receive incoming edges.
      if (nodeTypes.get(edge.target) === 'webhook') {
        throw new BadRequestException(
          'Webhook nodes cannot have incoming workflow edges',
        );
      }

      // Notifications terminate branches in the current execution model.
      if (nodeTypes.get(edge.source) === 'notification') {
        throw new BadRequestException(
          'Notification nodes cannot have outgoing workflow edges',
        );
      }

      adjacency.get(edge.source)?.push(edge.target);
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    }

    for (const nodeId of nodeIds) {
      if (
        nodeTypes.get(nodeId) !== 'webhook' &&
        (incoming.get(nodeId) ?? 0) === 0
      ) {
        throw new BadRequestException(
          `Node ${nodeId} is disconnected from the workflow trigger`,
        );
      }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (nodeId: string): void => {
      if (visiting.has(nodeId)) {
        throw new BadRequestException(
          'Workflow contains a cycle; loops are not supported yet',
        );
      }

      if (visited.has(nodeId)) {
        return;
      }

      visiting.add(nodeId);

      for (const nextNodeId of adjacency.get(nodeId) ?? []) {
        visit(nextNodeId);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
    };

    for (const triggerId of triggerIds) {
      visit(triggerId);
    }

    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        throw new BadRequestException(
          `Node ${nodeId} is unreachable from a webhook trigger`,
        );
      }
    }
  }
}