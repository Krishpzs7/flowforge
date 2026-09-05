"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

type ExecutionStatus = "idle" | "running" | "success" | "failed";

type FlowForgeNodeData = {
  label: string;
  nodeType?: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  status?: ExecutionStatus;
};

const statusStyles: Record<
  ExecutionStatus,
  {
    label: string;
    dotClassName: string;
    badgeClassName: string;
  }
> = {
  idle: {
    label: "Idle",
    dotClassName: "bg-slate-400",
    badgeClassName:
      "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  running: {
    label: "Running",
    dotClassName: "animate-pulse bg-amber-500",
    badgeClassName:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  },
  success: {
    label: "Success",
    dotClassName: "bg-emerald-500",
    badgeClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  failed: {
    label: "Failed",
    dotClassName: "bg-rose-500",
    badgeClassName:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
  },
};

export default function CustomNode({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as FlowForgeNodeData;

  const status = nodeData.status ?? "idle";
  const statusStyle = statusStyles[status];

  return (
    <div
      className={[
        "min-w-56 rounded-xl border bg-background px-3 py-3 shadow-sm transition-all",
        selected
          ? "border-violet-500 ring-2 ring-violet-500/20"
          : "border-border hover:border-violet-400/60 hover:shadow-md",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2 !border-2 !border-background !bg-violet-500"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={[
              "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold",
              nodeData.iconColor ?? "text-violet-500",
            ].join(" ")}
          >
            {nodeData.icon ?? "◉"}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {nodeData.label}
            </p>

            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {nodeData.description ?? nodeData.nodeType ?? "Workflow step"}
            </p>
          </div>
        </div>

        <span
          className={[
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
            statusStyle.badgeClassName,
          ].join(" ")}
        >
          <span className={`size-1.5 rounded-full ${statusStyle.dotClassName}`} />
          {statusStyle.label}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2 !border-2 !border-background !bg-violet-500"
      />
    </div>
  );
}