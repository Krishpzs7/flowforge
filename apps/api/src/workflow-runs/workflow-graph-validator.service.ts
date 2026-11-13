import { BadRequestException, Injectable } from '@nestjs/common';

// Node types the worker can actually execute. Any other value will fail at
// runtime, so we reject it here before the run is queued.
const SUPPORTED_NODE_TYPES = new Set([
  'webhook',
  'transform',
  'condition',
  'delay',
  'http',
  'database',
  'notification',
]);

type WorkflowNode = {
  id?: string;
  data?: {
    nodeType?: string;
    configuration?: Record<string, unknown>;
  };
};

type WorkflowEdge = {
  source?: string;
  target?: string;
  sourceHandle?: string | null;
};

type WorkflowDefinition = {
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[]
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

      const nodeType = node.data?.nodeType ?? 'custom';

      if (!SUPPORTED_NODE_TYPES.has(nodeType)) {
        throw new BadRequestException(
          `Unsupported node type: "${nodeType}". Allowed: ${[...SUPPORTED_NODE_TYPES].join(', ')}`,
        );
      }

      nodeIds.add(node.id);
      incoming.set(node.id, 0);
      nodeTypes.set(node.id, nodeType);
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

    // Multiple start nodes make execution ambiguous; require exactly one.
    if (triggerIds.length > 1) {
      throw new BadRequestException(
        `Workflow must contain exactly one webhook trigger; found ${triggerIds.length}`,
      );
    }

    // Track outgoing edge counts and condition sourceHandles for structural checks.
    const outgoingCount = new Map<string, number>();
    const conditionHandles = new Map<string, Set<string>>();

    for (const nodeId of nodeIds) {
      outgoingCount.set(nodeId, 0);

      if (nodeTypes.get(nodeId) === 'condition') {
        conditionHandles.set(nodeId, new Set());
      }
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

      const sourceType = nodeTypes.get(edge.source);

      if (sourceType === 'condition') {
        // Condition nodes route via named handles. Each handle (true/false)
        // must wire to exactly one target — duplicates are ambiguous.
        const handle = edge.sourceHandle ?? '';

        if (!handle) {
          throw new BadRequestException(
            `Condition node "${edge.source}" has an edge without a sourceHandle (expected "true" or "false")`,
          );
        }

        if (!['true', 'false'].includes(handle)) {
          throw new BadRequestException(
            `Condition node "${edge.source}" has an unrecognised sourceHandle "${handle}" (expected "true" or "false")`,
          );
        }

        const usedHandles = conditionHandles.get(edge.source)!;

        if (usedHandles.has(handle)) {
          throw new BadRequestException(
            `Condition node "${edge.source}" has duplicate edges for the "${handle}" branch`,
          );
        }

        usedHandles.add(handle);
      } else {
        // Non-Condition nodes have a linear execution model: exactly one
        // outgoing edge. A second edge would be silently ignored by the worker.
        const count = (outgoingCount.get(edge.source) ?? 0) + 1;
        outgoingCount.set(edge.source, count);

        if (count > 1) {
          throw new BadRequestException(
            `Node "${edge.source}" (type: ${sourceType}) has more than one outgoing edge. Only Condition nodes may branch`,
          );
        }
      }

      adjacency.get(edge.source)?.push(edge.target);
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    }

    // Every Condition node must have both true and false branches wired.
    for (const [nodeId, handles] of conditionHandles) {
      if (!handles.has('true') || !handles.has('false')) {
        const missing = ['true', 'false'].filter((h) => !handles.has(h));
        throw new BadRequestException(
          `Condition node "${nodeId}" is missing edges for: ${missing.join(', ')}`,
        );
      }
    }

    // Validate Condition expression syntax now so the run doesn't fail on
    // the first execution with a cryptic parse error.
    for (const node of nodes) {
      if (node.data?.nodeType !== 'condition') {
        continue;
      }

      const expression = node.data?.configuration?.expression;

      if (typeof expression !== 'string' || expression.trim().length === 0) {
        throw new BadRequestException(
          `Condition node "${node.id}" has no expression configured`,
        );
      }

      this.validateConditionExpression(expression, node.id ?? 'unknown');
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

  /**
   * Parse the condition expression using the same rules as the worker so
   * structural errors are caught before the run is queued, not during it.
   */
  private validateConditionExpression(expression: string, nodeId: string): void {
    const lines = expression
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length !== 3) {
      throw new BadRequestException(
        `Condition node "${nodeId}" expression must have exactly three lines: Field, Operator, Value`,
      );
    }

    const values: Record<string, string> = {};

    for (const line of lines) {
      const match = /^(Field|Operator|Value)\s*:\s*(.+)$/i.exec(line);

      if (!match) {
        throw new BadRequestException(
          `Condition node "${nodeId}" has an invalid expression line: "${line}"`,
        );
      }

      const key = match[1].toLowerCase();

      if (Object.prototype.hasOwnProperty.call(values, key)) {
        throw new BadRequestException(
          `Condition node "${nodeId}" has a duplicate expression setting: ${key}`,
        );
      }

      values[key] = match[2].trim();
    }

    const { field, operator: operatorLabel, value: rawValue } = values;

    if (!field || !operatorLabel || !rawValue) {
      throw new BadRequestException(
        `Condition node "${nodeId}" expression is missing Field, Operator, or Value`,
      );
    }

    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(field)) {
      throw new BadRequestException(
        `Condition node "${nodeId}" has an invalid field name: "${field}"`,
      );
    }

    const knownOperators = new Set([
      'equals', 'equal to', 'eq', '==',
      'not equals', 'not equal to', 'neq', '!=',
      'greater than', 'gt', '>',
      'greater than or equal to', 'gte', '>=',
      'less than', 'lt', '<',
      'less than or equal to', 'lte', '<=',
    ]);

    if (!knownOperators.has(operatorLabel.toLowerCase())) {
      throw new BadRequestException(
        `Condition node "${nodeId}" has an unsupported operator: "${operatorLabel}"`,
      );
    }
  }
}
