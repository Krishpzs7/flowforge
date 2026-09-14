import { Injectable, Logger } from '@nestjs/common';

interface WorkflowNode {
    id: string;
    type: string;
    data?: {
      nodeType?: string;
      label?: string;
      [key: string]: unknown;
    };
  }

interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface ExecutionStep {
  nodeId: string;
  nodeType: string;
  status: 'succeeded' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

export interface ExecutionResult {
  status: 'succeeded' | 'failed';
  finalData: Record<string, unknown>;
  steps: ExecutionStep[];
  error?: string;
}

@Injectable()
export class WorkflowExecutionService {
  private readonly logger = new Logger(WorkflowExecutionService.name);

  /**
   * Executes one saved workflow definition.
   *
   * This service does not access PostgreSQL directly. WorkerService owns
   * database reads/writes and supplies the saved definition plus run input.
   */
  async execute(
    definition: unknown,
    input: unknown,
  ): Promise<ExecutionResult> {
    const normalizedDefinition = this.normalizeDefinition(definition);
    let data = this.normalizeInput(input);
    const steps: ExecutionStep[] = [];

    try {
      const startNode = this.findStartNode(normalizedDefinition);

      if (!startNode) {
        throw new Error('No start node found in workflow definition');
      }

      // A visited set prevents accidental infinite loops in cyclic graphs.
      const visited = new Set<string>();

      // This becomes null when there is no outgoing edge from the current node.
      let currentNode: WorkflowNode | null = startNode;

      while (currentNode !== null) {
        // currentNode is known to be non-null here. Save it as a local
        // constant so it remains safely narrowed inside try/catch blocks.
        const node: WorkflowNode = currentNode;

        if (visited.has(node.id)) {
          throw new Error(
            `Workflow contains a cycle at node "${node.id}"`,
          );
        }

        visited.add(node.id);

        // Each step receives a snapshot of data as it existed before the node.
        const stepInput = { ...data };

        try {
          const output = await this.executeNode(node, stepInput);

          steps.push({
            nodeId: node.id,
            nodeType: this.resolveNodeType(node),
            status: 'succeeded',
            input: stepInput,
            output,
          });

          // Node output becomes available as input for downstream nodes.
          data = { ...data, ...output };

          // A null result is valid: it means node is the end of this path.
          currentNode = this.getNextNode(
            node.id,
            normalizedDefinition,
          );
        } catch (nodeError: unknown) {
          const message = this.errorMessage(nodeError);

          steps.push({
            nodeId: node.id,
            nodeType: this.resolveNodeType(node),
            status: 'failed',
            input: stepInput,
            error: message,
          });

          return {
            status: 'failed',
            finalData: data,
            steps,
            error: `Node "${this.nodeLabel(node)}" failed: ${message}`,
          };
        }
      }

      return {
        status: 'succeeded',
        finalData: data,
        steps,
      };
    } catch (error: unknown) {
      const message = this.errorMessage(error);

      this.logger.error(`Workflow execution failed: ${message}`);

      return {
        status: 'failed',
        finalData: data,
        steps,
        error: message,
      };
    }
  }

  /**
   * Validates the minimum saved React Flow-style definition shape.
   */
  private normalizeDefinition(value: unknown): WorkflowDefinition {
    if (!value || typeof value !== 'object') {
      throw new Error('Workflow definition must be an object');
    }

    const candidate = value as Partial<WorkflowDefinition>;

    if (!Array.isArray(candidate.nodes)) {
      throw new Error('Workflow definition must contain a nodes array');
    }

    if (!Array.isArray(candidate.edges)) {
      throw new Error('Workflow definition must contain an edges array');
    }

    return {
      nodes: candidate.nodes,
      edges: candidate.edges,
    };
  }

  /**
   * Only plain object input is carried through a workflow.
   * Null, arrays, primitives, and omitted input become an empty object.
   */
  private normalizeInput(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return { ...(value as Record<string, unknown>) };
  }

  /**
   * A start node has no edge that targets it.
   * This assumes an initial linear workflow; multi-trigger selection can
   * be added later when the editor exposes trigger selection.
   */
  private findStartNode(
    definition: WorkflowDefinition,
  ): WorkflowNode | null {
    const targetNodeIds = new Set(
      definition.edges.map((edge) => edge.target),
    );

    return (
      definition.nodes.find(
        (node) => !targetNodeIds.has(node.id),
      ) ?? null
    );
  }

  /**
   * Gets the first outgoing connection for a node.
   * The initial engine deliberately supports one path at a time.
   */
  private getNextNode(
    nodeId: string,
    definition: WorkflowDefinition,
  ): WorkflowNode | null {
    const edge = definition.edges.find(
      (candidate) => candidate.source === nodeId,
    );

    if (!edge) {
      return null;
    }

    return (
      definition.nodes.find(
        (node) => node.id === edge.target,
      ) ?? null
    );
  }

  private resolveNodeType(node: WorkflowNode): string {
    const configuredType = node.data?.nodeType;
  
    if (typeof configuredType === 'string' && configuredType.length > 0) {
      return configuredType;
    }
  
    return node.type;
  }

  /**
 * Executes a node using the behavior type saved by the editor.
 */
private async executeNode(
    node: WorkflowNode,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const executableType = this.resolveNodeType(node);
  
    switch (executableType) {
      case 'webhook':
        return { ...data };
  
      case 'transform':
        return this.executeTransformNode(node, data);
  
      case 'condition':
        return this.executeConditionNode(node, data);
  
      case 'delay':
        return this.executeDelayNode(node, data);
  
      default:
        throw new Error(
          `Unsupported node type: ${executableType}`,
        );
    }
  }

  /**
   * Applies ordered set/delete operations from:
   *
   * data: {
   *   config: {
   *     operations: [
   *       { type: 'set', key: 'approved', value: true },
   *       { type: 'delete', key: 'temporaryValue' }
   *     ]
   *   }
   * }
   */
  private executeTransformNode(
    node: WorkflowNode,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const config = this.nodeConfig(node);
    const output = { ...data };

    const operations = Array.isArray(config.operations)
      ? config.operations
      : [];

    for (const operation of operations) {
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      const item = operation as {
        type?: string;
        key?: string;
        value?: unknown;
      };

      if (!item.key) {
        throw new Error('Transform operation requires a key');
      }

      if (item.type === 'set') {
        output[item.key] = item.value;
        continue;
      }

      if (item.type === 'delete') {
        delete output[item.key];
        continue;
      }

      throw new Error(
        `Unsupported transform operation: ${item.type ?? 'unknown'}`,
      );
    }

    return output;
  }

  /**
   * Evaluates one basic condition and stores the boolean outcome.
   *
   * Supported operators are eq, neq, gt, and lt. Branch routing based on
   * React Flow source handles will be added after this baseline works.
   */
  private executeConditionNode(
    node: WorkflowNode,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const config = this.nodeConfig(node);

    const field =
      typeof config.field === 'string'
        ? config.field
        : undefined;

    const operator =
      typeof config.operator === 'string'
        ? config.operator
        : undefined;

    if (!field || !operator) {
      // A condition without configuration is non-blocking during this phase.
      return {
        ...data,
        conditionResult: true,
      };
    }

    const actual = data[field];
    const expected = config.value;
    let result: boolean;

    switch (operator) {
      case 'eq':
        result = actual === expected;
        break;

      case 'neq':
        result = actual !== expected;
        break;

      case 'gt':
        result =
          typeof actual === 'number' &&
          typeof expected === 'number' &&
          actual > expected;
        break;

      case 'lt':
        result =
          typeof actual === 'number' &&
          typeof expected === 'number' &&
          actual < expected;
        break;

      default:
        throw new Error(
          `Unsupported condition operator: ${operator}`,
        );
    }

    return {
      ...data,
      conditionResult: result,
    };
  }

  /**
   * Waits for a configured period, capped to five seconds to keep the
   * initial polling worker responsive and testable.
   */
  private async executeDelayNode(
    node: WorkflowNode,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = this.nodeConfig(node);

    const configuredMilliseconds =
      typeof config.milliseconds === 'number'
        ? config.milliseconds
        : 0;

    const milliseconds = Math.min(
      5000,
      Math.max(0, configuredMilliseconds),
    );

    if (milliseconds > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      });
    }

    return {
      ...data,
      delayMs: milliseconds,
    };
  }

  /**
   * Safely obtains the optional config object stored in node.data.config.
   */
  private nodeConfig(
    node: WorkflowNode,
  ): Record<string, unknown> {
    const config = node.data?.config;

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return {};
    }

    return config as Record<string, unknown>;
  }

  /**
   * Uses the editor label in errors when available, otherwise the node ID.
   */
  private nodeLabel(node: WorkflowNode): string {
    const label = node.data?.label;

    return typeof label === 'string' && label.length > 0
      ? label
      : node.id;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}