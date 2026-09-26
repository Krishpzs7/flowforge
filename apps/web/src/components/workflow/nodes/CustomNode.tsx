'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

type WorkflowNodeData = {
  icon?: string;
  label?: string;
  description?: string;
  status?: string;
  nodeType?: string;
  type?: string;
  iconColor?: string;
  configuration?: Record<string, unknown>;
  config?: Record<string, unknown>;
};

const statusStyles: Record<string, string> = {
  idle: 'bg-slate-100 text-slate-500',
  queued: 'bg-amber-50 text-amber-700',
  running: 'bg-blue-50 text-blue-700',
  succeeded: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-rose-50 text-rose-700',
};

function formatStatus(status: string | undefined): string {
  if (!status) {
    return 'Idle';
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusDotClass(status: string | undefined): string {
  switch (status) {
    case 'queued':
      return 'bg-amber-400';

    case 'running':
      return 'bg-blue-500';

    case 'succeeded':
      return 'bg-emerald-500';

    case 'failed':
      return 'bg-rose-500';

    default:
      return 'bg-slate-400';
  }
}

export default function CustomNode({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as WorkflowNodeData;

  const label = nodeData.label ?? 'Untitled node';
  const description = nodeData.description ?? '';
  const status = nodeData.status ?? 'idle';
  const icon = nodeData.icon ?? '◉';
  const iconColor = nodeData.iconColor ?? 'text-slate-500';

  /*
   * The editor stores executable identity in data.nodeType.
   * The fallback supports older saved node data.
   */
  const executableNodeType =
    nodeData.nodeType ?? nodeData.type ?? '';

  const isCondition =
    executableNodeType.toLowerCase() === 'condition';

  return (
    <div
      className={[
        'relative min-w-[230px] rounded-2xl border bg-white px-5 py-4',
        'shadow-sm transition-shadow',
        selected
          ? 'border-violet-500 ring-2 ring-violet-200'
          : 'border-slate-200 hover:shadow-md',
      ].join(' ')}
    >
      {/* Every node accepts one incoming connection at the top. */}
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="!h-3 !w-3 !border-2 !border-white !bg-violet-500"
      />

      <div className="flex items-start gap-3">
        <div
          className={[
            'flex h-10 w-10 shrink-0 items-center justify-center',
            'rounded-xl bg-slate-50 text-lg',
            iconColor,
          ].join(' ')}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-base font-semibold text-slate-900">
              {label}
            </p>

            <span
              className={[
                'inline-flex shrink-0 items-center gap-1 rounded-full',
                'px-2 py-1 text-[11px] font-medium',
                statusStyles[status] ?? statusStyles.idle,
              ].join(' ')}
            >
              <span
                className={[
                  'h-1.5 w-1.5 rounded-full',
                  statusDotClass(status),
                ].join(' ')}
              />
              {formatStatus(status)}
            </span>
          </div>

          {description ? (
            <p className="mt-1 truncate text-sm text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {isCondition ? (
        <>
          {/*
           * These are two separate source handles, not labels.
           * React Flow will write the selected id into edge.sourceHandle.
           */}

          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!h-4 !w-4 !border-2 !border-white !bg-emerald-500"
            style={{
              left: '35%',
              bottom: -8,
            }}
          />

          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!h-4 !w-4 !border-2 !border-white !bg-rose-500"
            style={{
              left: '65%',
              bottom: -8,
            }}
          />

          <span
            className={[
              'pointer-events-none absolute -bottom-8 left-[35%]',
              '-translate-x-1/2 text-[11px] font-bold text-emerald-600',
            ].join(' ')}
          >
            True
          </span>

          <span
            className={[
              'pointer-events-none absolute -bottom-8 left-[65%]',
              '-translate-x-1/2 text-[11px] font-bold text-rose-600',
            ].join(' ')}
          >
            False
          </span>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          id="source"
          className="!h-3 !w-3 !border-2 !border-white !bg-violet-500"
        />
      )}
    </div>
  );
}