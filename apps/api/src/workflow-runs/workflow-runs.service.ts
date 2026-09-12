import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../workflows/entities/workflow.entity';
import { CreateWorkflowRunDto } from './dto/create-workflow-run.dto';
import { WorkflowRun } from './entities/workflow-run.entity';
import { WorkflowGraphValidatorService } from './workflow-graph-validator.service';

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

    return this.workflowRunsRepository.save(
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
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowRun[]> {
    return this.workflowRunsRepository.find({
      where: { workflowId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }
}