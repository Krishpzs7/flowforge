import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import {
  ExecutionResult,
  WorkflowExecutionService,
} from './workflow-execution.service';

interface QueuedRunRow {
  id: string;
  workflow_id: string;
  input: unknown;
  definition: unknown;
}

@Injectable()
export class WorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WorkerService.name);
  private pool!: Pool;
  private polling = true;

  constructor(
    private readonly configService: ConfigService,
    private readonly executionService: WorkflowExecutionService,
  ) {}

  async onModuleInit(): Promise<void> {
    const databaseUrl =
      this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
    });

    this.logger.log('FlowForge worker started');

    // Run the polling loop in the background so Nest can finish startup.
    void this.pollAndProcessRuns();
  }

  async onModuleDestroy(): Promise<void> {
    this.polling = false;

    if (this.pool) {
      await this.pool.end();
    }
  }

  private async pollAndProcessRuns(): Promise<void> {
    while (this.polling) {
      try {
        const run = await this.claimNextRun();

        if (!run) {
          await this.sleep(1000);
          continue;
        }

        await this.processRun(run);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);

        this.logger.error(`Worker error: ${message}`);
        await this.sleep(1000);
      }
    }
  }

  private async claimNextRun(): Promise<QueuedRunRow | null> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query<QueuedRunRow>(`
        SELECT
          runs.id,
          runs.workflow_id,
          runs.input,
          workflows.definition
        FROM workflow_runs runs
        INNER JOIN workflows
          ON workflows.id = runs.workflow_id
        WHERE runs.status = 'queued'
        ORDER BY runs.created_at ASC
        LIMIT 1
        FOR UPDATE OF runs SKIP LOCKED
      `);

      const run = result.rows[0];

      if (!run) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `
          UPDATE workflow_runs
          SET status = 'running',
              started_at = COALESCE(started_at, NOW())
          WHERE id = $1
        `,
        [run.id],
      );

      await client.query('COMMIT');

      return run;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async processRun(run: QueuedRunRow): Promise<void> {
    this.logger.log(`Executing workflow run ${run.id}`);

    let result: ExecutionResult;

    try {
      result = await this.executionService.execute(
        run.definition,
        run.input,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      result = {
        status: 'failed',
        finalData: {},
        steps: [],
        error: message,
      };
    }

    await this.persistResult(run.id, result);

    this.logger.log(
      `Workflow run ${run.id} finished with status ${result.status}`,
    );
  }

  private async persistResult(
    runId: string,
    result: ExecutionResult,
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE workflow_runs
        SET status = $2,
            output = $3::jsonb,
            error = $4,
            finished_at = NOW()
        WHERE id = $1
      `,
      [
        runId,
        result.status,
        JSON.stringify(result),
        result.error ?? null,
      ],
    );
  }

  private async sleep(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}