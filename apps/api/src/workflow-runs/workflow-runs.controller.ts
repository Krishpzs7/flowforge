import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
  } from '@nestjs/common';
  import { CreateWorkflowRunDto } from './dto/create-workflow-run.dto';
  import { WorkflowRun } from './entities/workflow-run.entity';
  import { WorkflowRunsService } from './workflow-runs.service';
  
  @Controller('workflows/:workflowId/runs')
  export class WorkflowRunsController {
    constructor(private readonly workflowRunsService: WorkflowRunsService) {}
  
    @Post()
    create(
      @Param('workflowId', ParseUUIDPipe) workflowId: string,
      @Body() dto: CreateWorkflowRunDto,
    ): Promise<WorkflowRun> {
      return this.workflowRunsService.create(workflowId, dto);
    }
  
    @Get()
    findByWorkflowId(
      @Param('workflowId', ParseUUIDPipe) workflowId: string,
    ): Promise<WorkflowRun[]> {
      return this.workflowRunsService.findByWorkflowId(workflowId);
    }
  }