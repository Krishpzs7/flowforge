import { IsObject, IsOptional } from 'class-validator';

export class CreateWorkflowRunDto {
  // Input is preserved with the run so executions are reproducible later.
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}