import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { WorkflowExecutionService } from './workflow-execution.service';
import { WorkerService } from './worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      // Resolve from apps/worker back to the monorepo root:
      // C:\dev\flowforge\apps\worker -> C:\dev\flowforge\.env
      envFilePath: resolve(process.cwd(), '../../.env'),
    }),
  ],
  providers: [
    WorkerService,
    WorkflowExecutionService,
  ],
})
export class AppModule {}