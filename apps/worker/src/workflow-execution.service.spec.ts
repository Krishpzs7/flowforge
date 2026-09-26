jest.mock('@nestjs/common', () => ({
    Injectable: () => (target: unknown) => target,
    Logger: class {
      error() {}
    },
  }));
  
  import { WorkflowExecutionService } from './workflow-execution.service';

describe('WorkflowExecutionService condition routing', () => {
  const service = new WorkflowExecutionService();

  function workflow(edges: Array<{
    source: string;
    target: string;
    sourceHandle?: string;
  }>) {
    return {
      nodes: [
        { id: 'webhook', type: 'custom', data: { nodeType: 'webhook' } },
        {
          id: 'condition',
          type: 'custom',
          data: {
            nodeType: 'condition',
            configuration: {
              expression: 'Field: total\nOperator: greater than\nValue: 100',
            },
          },
        },
        {
          id: 'approved',
          type: 'custom',
          data: {
            nodeType: 'transform',
            configuration: { expression: '{{ ...input, approved: true }}' },
          },
        },
        {
          id: 'rejected',
          type: 'custom',
          data: {
            nodeType: 'transform',
            configuration: { expression: '{{ ...input, approved: false }}' },
          },
        },
      ],
      edges: [
        { source: 'webhook', target: 'condition' },
        ...edges,
      ],
    };
  }

  const branchEdges = [
    { source: 'condition', sourceHandle: 'true', target: 'approved' },
    { source: 'condition', sourceHandle: 'false', target: 'rejected' },
  ];

  it('runs the true branch for a total above 100', async () => {
    const result = await service.execute(workflow(branchEdges), { total: 249.99 });

    expect(result.status).toBe('succeeded');
    expect(result.finalData).toMatchObject({
      conditionResult: true,
      selectedBranch: 'true',
      approved: true,
    });
    expect(result.steps.map((step) => step.nodeId)).toEqual([
      'webhook', 'condition', 'approved',
    ]);
  });

  it('runs the false branch for a total below 100', async () => {
    const result = await service.execute(workflow(branchEdges), { total: 49.99 });

    expect(result.status).toBe('succeeded');
    expect(result.finalData).toMatchObject({
      conditionResult: false,
      selectedBranch: 'false',
      approved: false,
    });
    expect(result.steps.map((step) => step.nodeId)).toEqual([
      'webhook', 'condition', 'rejected',
    ]);
  });

  it('fails when the selected branch has no edge', async () => {
    const result = await service.execute(
      workflow(branchEdges.filter((edge) => edge.sourceHandle !== 'false')),
      { total: 49.99 },
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain('needs exactly one outgoing edge; found 0');
  });

  it('fails when the selected branch has duplicate edges', async () => {
    const result = await service.execute(
      workflow([
        ...branchEdges,
        { source: 'condition', sourceHandle: 'true', target: 'rejected' },
      ]),
      { total: 249.99 },
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain('needs exactly one outgoing edge; found 2');
  });
});