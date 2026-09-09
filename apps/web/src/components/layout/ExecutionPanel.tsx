"use client";

import { useWorkflowStore } from "@/lib/workflow-store";

const statusStyles = {
  idle: "border-border bg-muted text-muted-foreground",
  queued: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  running: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  succeeded: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  failed: "border-red-500/30 bg-red-500/10 text-red-700",
  error: "border-red-500/30 bg-red-500/10 text-red-700",
};

const logToneStyles = {
  neutral: "text-muted-foreground",
  info: "text-sky-700",
  success: "text-emerald-700",
  error: "text-red-700",
};

export default function ExecutionPanel() {
  const runStatus = useWorkflowStore((state) => state.runStatus);
  const executionLogs = useWorkflowStore((state) => state.executionLogs);

  return (
    <section className="flex h-40 shrink-0 flex-col border-t border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Execution log</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Workflow events appear here during a run.
          </p>
        </div>

        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyles[runStatus]}`}
        >
          {runStatus}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs">
        {executionLogs.length > 0 ? (
          <div className="space-y-1.5">
            {executionLogs.map((entry) => (
              <p key={entry.id} className={logToneStyles[entry.tone]}>
                <span className="mr-2 text-muted-foreground">
                  {new Intl.DateTimeFormat([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }).format(new Date(entry.timestamp))}
                </span>
                <span className="mr-2">›</span>
                {entry.message}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            › Waiting for a workflow execution…
          </p>
        )}
      </div>
    </section>
  );
}