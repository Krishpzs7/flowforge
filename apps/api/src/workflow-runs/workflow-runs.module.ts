import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from '../workflows/entities/workflow.entity';
import { WorkflowRun } from './entities/workflow-run.entity';
import { WorkflowGraphValidatorService } from './workflow-graph-validator.service';
import { WorkflowRunsController } from './workflow-runs.controller';
import { WorkflowRunsService } from './workflow-runs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Workflow, WorkflowRun])],
  controllers: [WorkflowRunsController],
  providers: [WorkflowGraphValidatorService, WorkflowRunsService],
})
export class WorkflowRunsModule {}