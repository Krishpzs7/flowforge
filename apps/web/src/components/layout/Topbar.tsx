"use client";

import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  createWorkflow,
  updateWorkflow,
  type WorkflowDefinition,
} from "@/lib/api";
import { useWorkflowStore } from "@/lib/workflow-store";

const workflowName = "Order Processing";

export default function Topbar() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const currentWorkflowId = useWorkflowStore(
    (state) => state.currentWorkflowId,
  );
  const saveStatus = useWorkflowStore((state) => state.saveStatus);
  const lastSavedAt = useWorkflowStore((state) => state.lastSavedAt);
  const setCurrentWorkflowId = useWorkflowStore(
    (state) => state.setCurrentWorkflowId,
  );
  const setLastSavedAt = useWorkflowStore((state) => state.setLastSavedAt);
  const setSaveStatus = useWorkflowStore((state) => state.setSaveStatus);
  const toPayload = useWorkflowStore((state) => state.toPayload);
  const resetDemo = useWorkflowStore((state) => state.resetDemo);

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
          size="sm"
          onClick={handleSave}
          isDisabled={saveStatus === "saving"}
        >
          {saveButtonLabel}
        </Button>
      </div>
    </header>
  );
}