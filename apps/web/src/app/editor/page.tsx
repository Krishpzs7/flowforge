import Topbar from "@/components/layout/Topbar";

export default function EditorPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar />

      <section className="flex flex-1 items-center justify-center bg-muted/20">
        <div className="rounded-xl border border-dashed border-border bg-background/60 px-6 py-5 text-center shadow-sm">
          <p className="text-sm font-medium">FlowForge editor shell</p>

          <p className="mt-1 text-xs text-muted-foreground">
            Phase 2 in progress — canvas and workflow tools are coming next.
          </p>
        </div>
      </section>
    </div>
  );
}