import ExecutionPanel from "@/components/layout/ExecutionPanel";
import PropertiesPanel from "@/components/layout/PropertiesPanel";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default function EditorPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <section className="flex-1 bg-background" />
          <ExecutionPanel />
        </div>

        <PropertiesPanel />
      </div>
    </div>
  );
}