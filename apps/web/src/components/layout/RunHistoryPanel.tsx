"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiWorkflowRun, WorkflowRunStatus } from "@/lib/api";
import { getWorkflowRuns } from "@/lib/api";
import { useWorkflowStore } from "@/lib/workflow-store";

const statusStyles: Record<WorkflowRunStatus, string> = {
  queued: "border-amber-200 bg-amber-50 text-amber-800",
  running: "border-sky-200 bg-sky-50 text-sky-800",
  succeeded: "border-emerald-200 bg-emerald-50 text-emerald-800",
  failed: "border-rose-200 bg-rose-50 text-rose-800",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatDuration(
  startedAt: string | null,
  finishedAt: string | null,
): string {
  if (!startedAt) {
    return "Waiting";
  }

  if (!finishedAt) {
    return "In progress";
  }

  const started = new Date(startedAt).getTime();
  const finished = new Date(finishedAt).getTime();

  if (Number.isNaN(started) || Number.isNaN(finished)) {
    return "—";
  }

  const durationMs = Math.max(0, finished - started);

  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1_000).toFixed(1)}s`;
}

function formatJson(value: Record<string, unknown> | null): string {
  if (!value) {
    return "—";
  }

  return JSON.stringify(value, null, 2);
}

export default function RunHistoryPanel() {
  const workflowId = useWorkflowStore((state) => state.currentWorkflowId);
  const activeRunId = useWorkflowStore((state) => state.activeRunId);
  const runStatus = useWorkflowStore((state) => state.runStatus);

  const [runs, setRuns] = useState<ApiWorkflowRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const applyRuns = useCallback(
    (nextRuns: ApiWorkflowRun[]) => {
      setRuns(nextRuns);
      setError(null);

      setSelectedRunId((currentSelectedRunId) => {
        if (
          currentSelectedRunId &&
          nextRuns.some((run) => run.id === currentSelectedRunId)
        ) {
          return currentSelectedRunId;
        }

        if (activeRunId && nextRuns.some((run) => run.id === activeRunId)) {
          return activeRunId;
        }

        return nextRuns[0]?.id ?? null;
      });
    },
    [activeRunId],
  );

  const loadRuns = useCallback(async (): Promise<void> => {
    if (!workflowId) {
      return;
    }

    const nextRuns = await getWorkflowRuns(workflowId);
    applyRuns(nextRuns);
  }, [applyRuns, workflowId]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);

    try {
      await loadRuns();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load workflow runs.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [loadRuns]);

  useEffect(() => {
    let cancelled = false;

    if (!workflowId) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setRuns([]);
          setSelectedRunId(null);
          setError(null);
        }
      });

      return () => {
        cancelled = true;
      };
    }

    void getWorkflowRuns(workflowId)
      .then((nextRuns) => {
        if (!cancelled) {
          applyRuns(nextRuns);
        }
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load workflow runs.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyRuns, workflowId]);

  const hasActiveRun = useMemo(
    () =>
      runStatus === "queued" ||
      runStatus === "running" ||
      runs.some((run) => run.status === "queued" || run.status === "running"),
    [runStatus, runs],
  );

  useEffect(() => {
    if (!workflowId || !hasActiveRun) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void getWorkflowRuns(workflowId)
        .then((nextRuns) => {
          applyRuns(nextRuns);
        })
        .catch((caughtError: unknown) => {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to refresh workflow runs.",
          );
        });
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [applyRuns, hasActiveRun, workflowId]);

  const selectedRun =
    runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null;

  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Run history
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Latest persisted workflow runs
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={!workflowId || isRefreshing}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {!workflowId ? (
        <div className="px-4 py-5 text-sm text-slate-500">
          Save the workflow to view its run history.
        </div>
      ) : error ? (
        <div className="px-4 py-5 text-sm text-rose-700">
          Could not load run history: {error}
        </div>
      ) : runs.length === 0 ? (
        <div className="px-4 py-5 text-sm text-slate-500">
          No runs yet. Click “Run workflow” to create the first run.
        </div>
      ) : (
        <div className="grid min-h-0 grid-cols-1 divide-y divide-slate-200 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:divide-x lg:divide-y-0">
          <div className="max-h-64 overflow-y-auto">
            {runs.map((run) => {
              const isSelected = run.id === selectedRun?.id;

              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedRunId(run.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${
                    isSelected
                      ? "bg-violet-50"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      Run {run.id.slice(0, 8)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDate(run.createdAt)} ·{" "}
                      {formatDuration(run.startedAt, run.finishedAt)}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      statusStyles[run.status]
                    }`}
                  >
                    {run.status}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedRun ? (
            <div className="max-h-64 overflow-y-auto bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs text-slate-600">
                  {selectedRun.id}
                </p>

                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    statusStyles[selectedRun.status]
                  }`}
                >
                  {selectedRun.status}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-slate-500">Started</dt>
                  <dd className="mt-0.5 text-slate-800">
                    {formatDate(selectedRun.startedAt)}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Finished</dt>
                  <dd className="mt-0.5 text-slate-800">
                    {formatDate(selectedRun.finishedAt)}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Duration</dt>
                  <dd className="mt-0.5 text-slate-800">
                    {formatDuration(
                      selectedRun.startedAt,
                      selectedRun.finishedAt,
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Created</dt>
                  <dd className="mt-0.5 text-slate-800">
                    {formatDate(selectedRun.createdAt)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Input
                </h3>
                <pre className="mt-1 max-h-28 overflow-auto rounded-md border border-slate-200 bg-white p-2 font-mono text-[11px] leading-4 text-slate-700">
                  {formatJson(selectedRun.input)}
                </pre>
              </div>

              <div className="mt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Output
                </h3>
                <pre className="mt-1 max-h-28 overflow-auto rounded-md border border-slate-200 bg-white p-2 font-mono text-[11px] leading-4 text-slate-700">
                  {formatJson(selectedRun.output)}
                </pre>
              </div>

              {selectedRun.error ? (
                <div className="mt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                    Error
                  </h3>
                  <pre className="mt-1 overflow-auto rounded-md border border-rose-200 bg-rose-50 p-2 font-mono text-[11px] leading-4 text-rose-800">
                    {selectedRun.error}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}