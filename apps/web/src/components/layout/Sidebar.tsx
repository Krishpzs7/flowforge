"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const nodeGroups = [
  {
    title: "Triggers",
    nodes: [{ name: "Webhook", icon: "◉", color: "text-emerald-500" }],
  },
  {
    title: "Logic",
    nodes: [
      { name: "Condition", icon: "◇", color: "text-amber-500" },
      { name: "Transform", icon: "✦", color: "text-sky-500" },
      { name: "Delay", icon: "◷", color: "text-orange-500" },
    ],
  },
  {
    title: "Actions",
    nodes: [
      { name: "HTTP Request", icon: "↗", color: "text-blue-500" },
      { name: "Database", icon: "▤", color: "text-violet-500" },
      { name: "Notification", icon: "◌", color: "text-pink-500" },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-muted/20">
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Node palette
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag nodes to the canvas
        </p>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-3">
          {nodeGroups.map((group) => (
            <section key={group.title}>
              <h2 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h2>

              <div className="space-y-1.5">
                {group.nodes.map((node) => (
                  <button
                    key={node.name}
                    type="button"
                    className="flex w-full cursor-grab items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-sm transition-colors hover:border-border hover:bg-background active:cursor-grabbing"
                  >
                    <span className={`text-base ${node.color}`}>
                      {node.icon}
                    </span>
                    <span className="font-medium">{node.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}