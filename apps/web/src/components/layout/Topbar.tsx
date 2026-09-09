"use client";

import { useCallback, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  createWorkflow,
  createWorkflowRun,
  getWorkflowRuns,
  updateWorkflow,
  type ApiWorkflowRun,
  type WorkflowDefinition,
} from "@/lib/api";
import { useWorkflowStore } from "@/lib/workflow-store";

const workflowName = "Order Processing";
const POLL_INTERVAL_MS = 300;
const MAX_POLL_ATTEMPTS = 20;

export default function Topbar() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const currentWorkflowId = useWorkflowStore(
    (state) => state.currentWorkflowId,
  );
  const saveStatus = useWorkflowStore((state) => state.saveStatus);
  const lastSavedAt = useWorkflowStore((state) => state.lastSavedAt);
  const activeRunId = useWorkflowStore((state) => state.activeRunId);
  const runStatus = useWorkflowStore((state) => state.runStatus);
  const setCurrentWorkflowId = useWorkflowStore(
    (state) => state.setCurrentWorkflowId,
  );
  const setLastSavedAt = useWorkflowStore((state) => state.setLastSavedAt);
  const setSaveStatus = useWorkflowStore((state) => state.setSaveStatus);
  const setActiveRunId = useWorkflowStore((state) => state.setActiveRunId);
  const setRunStatus = useWorkflowStore((state) => state.setRunStatus);
  const addExecutionLog = useWorkflowStore((state) => state.addExecutionLog);
  const clearExecutionLogs = useWorkflowStore(
    (state) => state.clearExecutionLogs,
  );
  const toPayload = useWorkflowStore((state) => state.toPayload);
  const resetDemo = useWorkflowStore((state) => state.resetDemo);

  useEffect(() => {
    const isRunning = runStatus === "queued" || runStatus === "running";

    if (!currentWorkflowId || !activeRunId || !isRunning) {
      return;
    }

    let attempts = 0;
    let isCancelled = false;

    const poll = async () => {
      try {
        const runs = await getWorkflowRuns(currentWorkflowId);

        if (isCancelled) {
          return;
        }

        const run = runs.find((candidate) => candidate.id === activeRunId);

        if (!run) {
          throw new Error("The workflow run could not be found");
        }

        const previousStatus = useWorkflowStore.getState().runStatus;

        if (run.status !== previousStatus) {
          setRunStatus(run.status);

          const statusMessages: Record<ApiWorkflowRun["status"], string> = {
            queued: "Workflow run is queued.",
            running: "Workflow run started.",
            succeeded: "Workflow run completed successfully.",
            failed: run.error ?? "Workflow run failed.",
          };

          const tone =
            run.status === "succeeded"
              ? "success"
              : run.status === "failed"
                ? "error"
                : "info";

          addExecutionLog(statusMessages[run.status], tone);
        }

        attempts += 1;

        if (
          attempts >= MAX_POLL_ATTEMPTS &&
          (run.status === "queued" || run.status === "running")
        ) {
          setRunStatus("error");
          addExecutionLog("Workflow run status timed out.", "error");
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }

        console.error("Failed to poll workflow run", error);
        setRunStatus("error");
        addExecutionLog("Could not retrieve workflow run status.", "error");
      }
    };

    // Poll only while a run is active; cleanup stops polling on status changes.
    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    activeRunId,
    addExecutionLog,
    currentWorkflowId,
    runStatus,
    setRunStatus,
  ]);

  const handleSave = useCallback(async () => {
    if (saveStatus === "saving") {
      return;
    }

    setSaveStatus("saving");

    try {
      const definition = toPayload() as WorkflowDefinition;
      const workflow = currentWorkflowId
        ? await updateWorkflow(currentWorkflowId, {
            name: workflowName,
            definition,
          })
        : await createWorkflow({
            name: workflowName,
            definition,
          });

      // Keep server identity and timestamp in sync after either POST or PUT.
      setCurrentWorkflowId(workflow.id);
      setLastSavedAt(workflow.updatedAt);
      setSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save workflow", error);
      setSaveStatus("error");
    }
  }, [
    currentWorkflowId,
    saveStatus,
    setCurrentWorkflowId,
    setLastSavedAt,
    setSaveStatus,
    toPayload,
  ]);

  const handleRun = useCallback(async () => {
    if (!currentWorkflowId) {
      addExecutionLog("Save the workflow before running it.", "error");
      return;
    }

    if (runStatus === "queued" || runStatus === "running") {
      return;
    }

    clearExecutionLogs();
    setRunStatus("queued");
    addExecutionLog("Creating workflow run…", "info");

    try {
      const run = await createWorkflowRun(currentWorkflowId, {
        input: {
          orderId: "ord_demo_1001",
          customerId: "cus_demo_204",
          total: 249.99,
        },
      });

      setActiveRunId(run.id);
      setRunStatus(run.status);
      addExecutionLog(`Run ${run.id.slice(0, 8)} queued.`, "info");
    } catch (error) {
      console.error("Failed to start workflow run", error);
      setActiveRunId(null);
      setRunStatus("error");

      const message =
        error instanceof Error
          ? error.message.replace(/[{}"]/g, "")
          : "Could not start workflow run.";

      addExecutionLog(`Run failed to start: ${message}`, "error");
    }
  }, [
    addExecutionLog,
    clearExecutionLogs,
    currentWorkflowId,
    runStatus,
    setActiveRunId,
    setRunStatus,
  ]);

  const handleReset = () => {
    const confirmed = window.confirm(
      "Reset the demo workflow? This will remove unsaved browser changes.",
    );

    if (confirmed) {
      resetDemo();
    }
  };

  const saveButtonLabel = {
    idle: "Save",
    saving: "Saving…",
    saved: "Saved",
    error: "Save failed",
  }[saveStatus];

  const savedTimeLabel = lastSavedAt
    ? new Intl.DateTimeFormat([], {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(lastSavedAt))
    : null;

  const isRunInProgress = runStatus === "queued" || runStatus === "running";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-muted/20 px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <p className="text-base font-bold tracking-tight">FlowForge</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Workflow editor
          </p>
        </div>

        <Separator orientation="vertical" className="h-5" />

        <p className="text-xs text-muted-foreground">
          {nodes.length} node{nodes.length === 1 ? "" : "s"} · {edges.length}{" "}
          connection{edges.length === 1 ? "" : "s"}
        </p>

        <div className="hidden items-center gap-2 text-[11px] text-muted-foreground lg:flex">
          {currentWorkflowId ? (
            <span>ID: {currentWorkflowId.slice(0, 8)}</span>
          ) : null}

          {savedTimeLabel ? <span>Saved at {savedTimeLabel}</span> : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Reset demo
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          isDisabled={saveStatus === "saving"}
        >
          {saveButtonLabel}
        </Button>

        <Button
          size="sm"
          onClick={handleRun}
          isDisabled={!currentWorkflowId || isRunInProgress}
        >
          {isRunInProgress ? "Running…" : "Run workflow"}
        </Button>
      </div>
    </header>
  );
}