import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWorkflowDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  // Workflow definitions are persisted as a structured editor graph.
  @IsObject()
  @IsNotEmpty()
  definition: Record<string, unknown>;
}