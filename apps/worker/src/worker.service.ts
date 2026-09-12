import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WorkflowRun } from './entities/workflow-run.entity';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private pollTimer: NodeJS.Timeout | undefined;
  private isPolling = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(WorkflowRun)
    private readonly workflowRunsRepository: Repository<WorkflowRun>,
  ) {}

  onModuleInit(): void {
    this.logger.log('FlowForge worker started');

    void this.pollForRuns();

    this.pollTimer = setInterval(() => {
      void this.pollForRuns();
    }, 1_000);
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.logger.log('FlowForge worker stopped');
  }

  private async pollForRuns(): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;

    try {
      const run = await this.claimNextQueuedRun();

      if (run) {
        await this.executeRun(run);
      }
    } catch (error) {
      this.logger.error(
        'Worker poll failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isPolling = false;
    }
  }

  private async claimNextQueuedRun(): Promise<WorkflowRun | null> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WorkflowRun);

      const run = await repository
        .createQueryBuilder('workflowRun')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('workflowRun.status = :status', { status: 'queued' })
        .orderBy('workflowRun.createdAt', 'ASC')
        .getOne();

      if (!run) {
        return null;
      }

      run.status = 'running';
      run.startedAt = new Date();

      const savedRun = await repository.save(run);

      this.logger.log(
        `Claimed workflow run ${savedRun.id} for workflow ${savedRun.workflowId}`,
      );

      return savedRun;
    });
  }

  private async executeRun(run: WorkflowRun): Promise<void> {
    try {
      this.logger.log(`Executing workflow run ${run.id}`);

      await this.sleep(1_000);

      run.status = 'succeeded';
      run.output = {
        message: 'Workflow completed in worker simulation mode',
        workflowId: run.workflowId,
        receivedInput: run.input,
      };
      run.error = null;
      run.finishedAt = new Date();

      await this.workflowRunsRepository.save(run);

      this.logger.log(`Workflow run ${run.id} succeeded`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown worker error';

      this.logger.error(
        `Workflow run ${run.id} failed`,
        error instanceof Error ? error.stack : String(error),
      );

      await this.workflowRunsRepository.update(
        {
          id: run.id,
          status: 'running',
        },
        {
          status: 'failed',
          error: errorMessage,
          finishedAt: new Date(),
        },
      );
    }
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}