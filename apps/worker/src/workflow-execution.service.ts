import { Injectable, Logger } from '@nestjs/common';

interface WorkflowNode {
  id: string;
  type: string;
  data?: {
    nodeType?: string;
    label?: string;
    configuration?: Record<string, unknown>;
    config?: Record<string, unknown>;
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
   * Database access belongs to WorkerService. This service receives a workflow
   * definition and run input, then returns a serializable execution result.
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

      // Prevent accidental infinite execution if a workflow has a cycle.
      const visited = new Set<string>();
      let currentNode: WorkflowNode | null = startNode;

      while (currentNode !== null) {
        // Capture a non-null node reference for the complete iteration.
        // This also keeps TypeScript happy in the try/catch below.
        const node: WorkflowNode = currentNode;

        if (visited.has(node.id)) {
          throw new Error(
            `Workflow contains a cycle at node "${node.id}"`,
          );
        }

        visited.add(node.id);

        // Save a snapshot so history shows exactly what each step received.
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

          // Output fields become available to the next node in the workflow.
          data = { ...data, ...output };

          // A null next node means the workflow has reached its final step.
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
   * Validates the minimum React Flow-like saved definition structure.
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
   * Workflow data is always a plain object. Other input values become {}.
   */
  private normalizeInput(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return { ...(value as Record<string, unknown>) };
  }

  /**
   * A start node is not targeted by any edge.
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
   * Returns the first outgoing connection for a node.
   *
   * This is linear execution for now. Condition branching will later select
   * an edge using sourceHandle instead of simply selecting the first edge.
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

  /**
   * React Flow renders every card with serialized type "custom".
   * The executable behavior is stored in data.nodeType, for example:
   *
   * { type: "custom", data: { nodeType: "webhook" } }
   */
  private resolveNodeType(node: WorkflowNode): string {
    const configuredType = node.data?.nodeType;

    if (
      typeof configuredType === 'string' &&
      configuredType.trim().length > 0
    ) {
      return configuredType;
    }

    return node.type;
  }

  /**
   * Routes a workflow node to its supported execution behavior.
   */
  private async executeNode(
    node: WorkflowNode,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const executableType = this.resolveNodeType(node);

    switch (executableType) {
      case 'webhook':
        // The trigger starts execution with the input that was submitted.
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
   * Executes the Transform node's saved expression.
   *
   * Supported safe format:
   *   {{ ...input, fieldName: value, anotherField: value }}
   *
   * The expression is parsed, never executed as JavaScript. This prevents
   * arbitrary code execution in the worker process.
   */
  private executeTransformNode(
    node: WorkflowNode,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const configuration = this.nodeConfiguration(node);
    const expression = configuration.expression;

    // A missing expression makes Transform a safe pass-through node.
    if (
      typeof expression !== 'string' ||
      expression.trim().length === 0
    ) {
      return { ...data };
    }

    return this.parseTransformExpression(expression, data);
  }

  /**
   * Reads the editor's current configuration shape:
   *   node.data.configuration
   *
   * It also accepts node.data.config so older saved workflow definitions
   * remain compatible.
   */
  private nodeConfiguration(
    node: WorkflowNode,
  ): Record<string, unknown> {
    const configuration =
      node.data?.configuration ?? node.data?.config;

    if (
      !configuration ||
      typeof configuration !== 'object' ||
      Array.isArray(configuration)
    ) {
      return {};
    }

    return configuration as Record<string, unknown>;
  }

  /**
   * Parses a deliberately restricted transform expression.
   *
   * Supported example:
   *   {{ ...input, validated: true, priority: "high", retries: 3 }}
   *
   * It requires ...input first, then accepts comma-separated key/value
   * assignments. It does not execute arbitrary JavaScript.
   */
  private parseTransformExpression(
    expression: string,
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const trimmed = expression.trim();

    if (!trimmed.startsWith('{{') || !trimmed.endsWith('}}')) {
      throw new Error(
        'Transform expression must start with "{{" and end with "}}"',
      );
    }

    const body = trimmed.slice(2, -2).trim();

    if (!body.startsWith('...input')) {
      throw new Error(
        'Transform expression must begin with "...input"',
      );
    }

    const assignments = body
      .slice('...input'.length)
      .trim()
      .replace(/^,/, '')
      .trim();

    // {{ ...input }} simply returns a copy of the current workflow data.
    if (!assignments) {
      return { ...input };
    }

    const output = { ...input };

    for (const assignment of this.splitTopLevelAssignments(assignments)) {
      const separatorIndex = assignment.indexOf(':');

      if (separatorIndex === -1) {
        throw new Error(
          `Invalid transform assignment: "${assignment}"`,
        );
      }

      const key = assignment.slice(0, separatorIndex).trim();
      const rawValue = assignment.slice(separatorIndex + 1).trim();

      // Keep initial field names simple and predictable.
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
        throw new Error(
          `Invalid transform field name: "${key}"`,
        );
      }

      output[key] = this.parseTransformValue(rawValue);
    }

    return output;
  }

  /**
   * Splits assignments only on top-level commas. Commas inside quoted strings,
   * arrays, and JSON-like objects are preserved as part of their value.
   *
   * Example:
   *   active: true, tags: ["vip", "new"], note: "Hello, customer"
   */
  private splitTopLevelAssignments(value: string): string[] {
    const assignments: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;
    let escaped = false;
    let depth = 0;

    for (const character of value) {
      if (quote !== null) {
        current += character;

        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === quote) {
          quote = null;
        }

        continue;
      }

      if (character === '"' || character === "'") {
        quote = character;
        current += character;
        continue;
      }

      if (
        character === '{' ||
        character === '[' ||
        character === '('
      ) {
        depth += 1;
        current += character;
        continue;
      }

      if (
        character === '}' ||
        character === ']' ||
        character === ')'
      ) {
        depth -= 1;

        if (depth < 0) {
          throw new Error(
            'Unbalanced brackets in transform expression',
          );
        }

        current += character;
        continue;
      }

      if (character === ',' && depth === 0) {
        const assignment = current.trim();

        if (assignment) {
          assignments.push(assignment);
        }

        current = '';
        continue;
      }

      current += character;
    }

    if (quote !== null || depth !== 0) {
      throw new Error(
        'Unterminated value in transform expression',
      );
    }

    const finalAssignment = current.trim();

    if (finalAssignment) {
      assignments.push(finalAssignment);
    }

    return assignments;
  }

  /**
   * Parses safe literal values:
   *
   * true, false, null, 42, 19.99, "text", 'text', [], {}
   *
   * A bare identifier is retained as a plain string; it is never evaluated.
   */
  private parseTransformValue(value: string): unknown {
    const trimmed = value.trim();

    if (
      trimmed.startsWith("'") &&
      trimmed.endsWith("'") &&
      trimmed.length >= 2
    ) {
      return trimmed.slice(1, -1);
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      // Allow simple unquoted words as string values, never executable code.
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(trimmed)) {
        return trimmed;
      }

      throw new Error(
        `Invalid transform value: "${value}"`,
      );
    }
  }

  /**
   * Evaluates a simple condition and writes its result into conditionResult.
   *
   * The initial executor supports comparison, while branch routing through
   * source handles will be implemented in the next milestone.
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
   * Delays for a configured number of milliseconds. The five-second cap
   * protects the first polling-worker implementation from overly long jobs.
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
   * Reads config values used by Condition and Delay nodes.
   */
  private nodeConfig(
    node: WorkflowNode,
  ): Record<string, unknown> {
    const config = node.data?.config;

    if (
      !config ||
      typeof config !== 'object' ||
      Array.isArray(config)
    ) {
      return {};
    }

    return config as Record<string, unknown>;
  }

  /**
   * Uses the human-readable canvas label in error messages when available.
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