import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
  } from 'typeorm';
  import { Workflow } from '../../workflows/entities/workflow.entity';
  
  export type WorkflowRunStatus =
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed';
  
  @Entity('workflow_runs')
  export class WorkflowRun {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ name: 'workflow_id', type: 'uuid' })
    workflowId: string;
  
    // Keep the relationship available for future run-history queries.
    @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workflow_id' })
    workflow: Workflow;
  
    @Column({ type: 'text' })
    status: WorkflowRunStatus;
  
    @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
    input: Record<string, unknown>;
  
    @Column({ type: 'jsonb', nullable: true })
    output: Record<string, unknown> | null;
  
    @Column({ type: 'text', nullable: true })
    error: string | null;
  
    @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
    startedAt: Date | null;
  
    @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
    finishedAt: Date | null;
  
    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;
  }