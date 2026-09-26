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

type ConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

interface ParsedCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

@Injectable()
export class WorkflowExecutionService {
  private readonly logger = new Logger(WorkflowExecutionService.name);

  /**
   * WorkerService owns database reads and writes. This service executes
   * one saved definition and returns a serializable, per-node result.
   */
  async execute(
    definition: unknown,
    input: unknown,
  ): Promise<ExecutionResult> {
    let data = this.normalizeInput(input);
    const steps: ExecutionStep[] = [];

    try {
      const workflow = this.normalizeDefinition(definition);
      const startNode = this.findStartNode(workflow);

      if (!startNode) {
        throw new Error('No start node found in workflow definition');
      }

      // A path must not revisit a node; that would run forever.
      const visited = new Set<string>();
      let currentNode: WorkflowNode | null = startNode;

      while (currentNode !== null) {
        const node: WorkflowNode = currentNode;

        if (visited.has(node.id)) {
          throw new Error(`Workflow contains a cycle at node "${node.id}"`);
        }

        visited.add(node.id);
        const stepInput = { ...data };

        try {
          const output = await this.executeNode(node, stepInput);

          // Select the branch before marking the node successful. A missing
          // or ambiguous branch is an error in the Condition step itself.
          const nextNode = this.getNextNode(node, output, workflow);

          steps.push({
            nodeId: node.id,
            nodeType: this.resolveNodeType(node),
            status: 'succeeded',
            input: stepInput,
            output,
          });

          data = { ...data, ...output };
          currentNode = nextNode;
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

      return { status: 'succeeded', finalData: data, steps };
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

  private normalizeDefinition(value: unknown): WorkflowDefinition {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
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

  private normalizeInput(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return { ...(value as Record<string, unknown>) };
  }

  /**
   * A start node has no incoming edge. This retains the existing behavior
   * for your current one-trigger workflow.
   */
  private findStartNode(
    definition: WorkflowDefinition,
  ): WorkflowNode | null {
    const targetIds = new Set(
      definition.edges.map((edge) => edge.target),
    );

    return definition.nodes.find(
      (node) => !targetIds.has(node.id),
    ) ?? null;
  }

  /**
   * Condition routing uses an exact, persisted sourceHandle match.
   * Other nodes retain the existing first-outgoing-edge behavior.
   */
  private getNextNode(
    node: WorkflowNode,
    output: Record<string, unknown>,
    definition: WorkflowDefinition,
  ): WorkflowNode | null {
    const outgoing = definition.edges.filter(
      (edge) => edge.source === node.id,
    );

    if (this.resolveNodeType(node) === 'condition') {
      const decision = output.conditionResult;

      if (typeof decision !== 'boolean') {
        throw new Error('Condition did not produce a boolean result');
      }

      const branch = String(decision);
      const matching = outgoing.filter(
        (edge) => edge.sourceHandle === branch,
      );

      if (matching.length !== 1) {
        throw new Error(
          `Condition branch "${branch}" needs exactly one outgoing edge; found ${matching.length}`,
        );
      }

      const next = definition.nodes.find(
        (candidate) => candidate.id === matching[0].target,
      );

      if (!next) {
        throw new Error(
          `Condition branch "${branch}" targets a missing node`,
        );
      }

      return next;
    }

    const edge = outgoing[0];

    if (!edge) {
      return null;
    }

    return definition.nodes.find(
      (candidate) => candidate.id === edge.target,
    ) ?? null;
  }

  /**
   * React Flow stores the visual type as "custom"; the executable type
   * lives in node.data.nodeType.
   */
  private resolveNodeType(node: WorkflowNode): string {
    const configuredType = node.data?.nodeType;

    return typeof configuredType === 'string' &&
      configuredType.trim().length > 0
      ? configuredType
      : node.type;
  }

  private async executeNode(
    node: WorkflowNode,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const type = this.resolveNodeType(node);

    switch (type) {
      case 'webhook':
        return { ...data };
      case 'transform':
        return this.executeTransformNode(node, data);
      case 'condition':
        return this.executeConditionNode(node, data);
      case 'delay':
        return this.executeDelayNode(node, data);
      default:
        throw new Error(`Unsupported node type: ${type}`);
    }
  }

  /**
   * Transform expressions are parsed as a restricted data format.
   * No user-supplied JavaScript is evaluated.
   */
  private executeTransformNode(
    node: WorkflowNode,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const expression = this.nodeConfiguration(node).expression;

    if (
      typeof expression !== 'string' ||
      expression.trim().length === 0
    ) {
      return { ...data };
    }

    return this.parseTransformExpression(expression, data);
  }

  /**
   * The editor saves settings under data.configuration. The config fallback
   * keeps older saved nodes compatible.
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

    if (!assignments) {
      return { ...input };
    }

    const output = { ...input };

    for (const assignment of this.splitTopLevelAssignments(assignments)) {
      const separatorIndex = assignment.indexOf(':');

      if (separatorIndex === -1) {
        throw new Error(`Invalid transform assignment: "${assignment}"`);
      }

      const key = assignment.slice(0, separatorIndex).trim();
      const rawValue = assignment.slice(separatorIndex + 1).trim();

      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
        throw new Error(`Invalid transform field name: "${key}"`);
      }

      output[key] = this.parseTransformValue(rawValue);
    }

    return output;
  }

  /**
   * Commas inside quoted strings, arrays, and objects are not assignment
   * separators.
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
          throw new Error('Unbalanced brackets in transform expression');
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
      throw new Error('Unterminated value in transform expression');
    }

    const finalAssignment = current.trim();

    if (finalAssignment) {
      assignments.push(finalAssignment);
    }

    return assignments;
  }

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
      // Bare identifiers are data strings, not executable expressions.
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(trimmed)) {
        return trimmed;
      }

      throw new Error(`Invalid transform value: "${value}"`);
    }
  }

  /**
   * Parse the editor's saved three-line Condition format, compare a field
   * in the current data, and record which branch should be selected.
   */
  private executeConditionNode(
    node: WorkflowNode,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const expression = this.nodeConfiguration(node).expression;

    if (
      typeof expression !== 'string' ||
      expression.trim().length === 0
    ) {
      throw new Error('Condition expression is missing');
    }

    const condition = this.parseConditionExpression(expression);

    if (!Object.prototype.hasOwnProperty.call(data, condition.field)) {
      throw new Error(
        `Condition field "${condition.field}" is missing from input`,
      );
    }

    const actual = data[condition.field];
    const expected = condition.value;
    let result: boolean;

    switch (condition.operator) {
      case 'eq':
        result = actual === expected;
        break;
      case 'neq':
        result = actual !== expected;
        break;
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        if (
          typeof actual !== 'number' ||
          typeof expected !== 'number' ||
          !Number.isFinite(actual) ||
          !Number.isFinite(expected)
        ) {
          throw new Error(
            `Condition operator "${condition.operator}" requires numeric values`,
          );
        }

        if (condition.operator === 'gt') {
          result = actual > expected;
        } else if (condition.operator === 'gte') {
          result = actual >= expected;
        } else if (condition.operator === 'lt') {
          result = actual < expected;
        } else {
          result = actual <= expected;
        }
        break;
    }

    return {
      ...data,
      conditionResult: result,
      selectedBranch: String(result),
    };
  }

  /**
   * Only three named lines are accepted. This prevents arbitrary code and
   * avoids silently treating malformed conditions as successful.
   */
  private parseConditionExpression(
    expression: string,
  ): ParsedCondition {
    const lines = expression
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length !== 3) {
      throw new Error(
        'Condition needs three lines: Field, Operator, Value',
      );
    }

    const values: Record<string, string> = {};

    for (const line of lines) {
      const match = /^(Field|Operator|Value)\s*:\s*(.+)$/i.exec(line);

      if (!match) {
        throw new Error(`Invalid condition line: "${line}"`);
      }

      const key = match[1].toLowerCase();

      if (Object.prototype.hasOwnProperty.call(values, key)) {
        throw new Error(`Duplicate condition setting: ${key}`);
      }

      values[key] = match[2].trim();
    }

    const field = values.field;
    const operatorLabel = values.operator?.toLowerCase();
    const rawValue = values.value;

    if (!field || !operatorLabel || !rawValue) {
      throw new Error('Condition requires Field, Operator, and Value');
    }

    // Initial milestone: one top-level input key, not arbitrary paths.
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(field)) {
      throw new Error(`Invalid condition field: "${field}"`);
    }

    const operators: Record<string, ConditionOperator> = {
      'equals': 'eq',
      'equal to': 'eq',
      'eq': 'eq',
      '==': 'eq',
      'not equals': 'neq',
      'not equal to': 'neq',
      'neq': 'neq',
      '!=': 'neq',
      'greater than': 'gt',
      'gt': 'gt',
      '>': 'gt',
      'greater than or equal to': 'gte',
      'gte': 'gte',
      '>=': 'gte',
      'less than': 'lt',
      'lt': 'lt',
      '<': 'lt',
      'less than or equal to': 'lte',
      'lte': 'lte',
      '<=': 'lte',
    };

    const operator = operators[operatorLabel];

    if (!operator) {
      throw new Error(`Unsupported condition operator: "${operatorLabel}"`);
    }

    let value: unknown;

    try {
      value = JSON.parse(rawValue);
    } catch {
      // Text can be entered without JSON quotes in the Properties panel.
      value = rawValue;
    }

    return { field, operator, value };
  }

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

    return { ...data, delayMs: milliseconds };
  }

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