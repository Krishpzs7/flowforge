import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../workflows/entities/workflow.entity';
import { CreateWorkflowRunDto } from './dto/create-workflow-run.dto';
import {
  WorkflowRun,
  WorkflowRunStatus,
} from './entities/workflow-run.entity';
import { WorkflowGraphValidatorService } from './workflow-graph-validator.service';

type RunStatusUpdate = {
  startedAt?: Date | null;
  finishedAt?: Date | null;
  output?: Record<string, unknown> | null;
  error?: string | null;
};

@Injectable()
export class WorkflowRunsService {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowsRepository: Repository<Workflow>,
    @InjectRepository(WorkflowRun)
    private readonly workflowRunsRepository: Repository<WorkflowRun>,
    private readonly graphValidator: WorkflowGraphValidatorService,
  ) {}

  async create(
    workflowId: string,
    dto: CreateWorkflowRunDto,
  ): Promise<WorkflowRun> {
    const workflow = await this.workflowsRepository.findOne({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} was not found`);
    }

    this.graphValidator.validate(workflow.definition);

    const run = await this.workflowRunsRepository.save(
      this.workflowRunsRepository.create({
        workflowId,
        status: 'queued',
        input: dto.input ?? {},
        output: null,
        error: null,
        startedAt: null,
        finishedAt: null,
      }),
    );

    // Simulation is temporary; the worker will own this lifecycle next.
    void this.simulateExecution(run.id);

    return run;
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowRun[]> {
    return this.workflowRunsRepository.find({
      where: { workflowId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  private async updateStatus(
    runId: string,
    status: WorkflowRunStatus,
    fields: RunStatusUpdate = {},
  ): Promise<void> {
    // Save a partial entity instead of using update(), which cannot infer JSONB fields safely.
    const run = await this.workflowRunsRepository.findOne({
      where: { id: runId },
    });

    if (!run) {
      return;
    }

    run.status = status;

    if (fields.startedAt !== undefined) {
      run.startedAt = fields.startedAt;
    }

    if (fields.finishedAt !== undefined) {
      run.finishedAt = fields.finishedAt;
    }

    if (fields.output !== undefined) {
      run.output = fields.output;
    }

    if (fields.error !== undefined) {
      run.error = fields.error;
    }

    await this.workflowRunsRepository.save(run);
  }

  private async simulateExecution(runId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    await this.updateStatus(runId, 'running', {
      startedAt: new Date(),
    });

    await new Promise((resolve) => setTimeout(resolve, 700));

    await this.updateStatus(runId, 'succeeded', {
      output: {
        message: 'Workflow completed in simulation mode',
      },
      finishedAt: new Date(),
    });
  }
}