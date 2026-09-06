import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { Workflow } from './entities/workflow.entity';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowsRepository: Repository<Workflow>,
  ) {}

  async create(dto: CreateWorkflowDto): Promise<Workflow> {
    const workflow = this.workflowsRepository.create({
      name: dto.name ?? 'Untitled workflow',
      definition: dto.definition,
    });

    return this.workflowsRepository.save(workflow);
  }

  async findOne(id: string): Promise<Workflow> {
    const workflow = await this.workflowsRepository.findOne({
      where: { id },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} was not found`);
    }

    return workflow;
  }

  async update(id: string, dto: UpdateWorkflowDto): Promise<Workflow> {
    const workflow = await this.findOne(id);

    // Only provided fields are applied, preserving the rest of the record.
    Object.assign(workflow, dto);

    return this.workflowsRepository.save(workflow);
  }
}