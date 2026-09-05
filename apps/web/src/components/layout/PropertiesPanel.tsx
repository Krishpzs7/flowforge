"use client";

import type { ChangeEvent } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useWorkflowStore } from "@/lib/workflow-store";

type NodeConfiguration = {
  method?: string;
  path?: string;
  url?: string;
  timeout?: number;
  expression?: string;
  delaySeconds?: number;
  operation?: string;
  query?: string;
  channel?: string;
  message?: string;
};

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-xs font-medium text-foreground"
    >
      {children}
    </label>
  );
}

function TextInput({
  id,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  id: string;
  value: string | number;
  placeholder: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: "text" | "number" | "url";
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
    />
  );
}

function TextArea({
  id,
  value,
  placeholder,
  onChange,
  rows = 4,
}: {
  id: string;
  value: string;
  placeholder: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
    />
  );
}

export default function PropertiesPanel() {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const nodes = useWorkflowStore((state) => state.nodes);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const configuration = (selectedNode?.data.configuration ??
    {}) as NodeConfiguration;
  const nodeType = String(selectedNode?.data.nodeType ?? "custom");

  const updateConfiguration = (updates: Partial<NodeConfiguration>) => {
    if (!selectedNode) {
      return;
    }

    updateNodeData(selectedNode.id, {
      configuration: {
        ...configuration,
        ...updates,
      },
    });
  };

  const handleLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedNode) {
      return;
    }

    updateNodeData(selectedNode.id, {
      label: event.target.value,
    });
  };

  const handleDescriptionChange = (
    event: ChangeEvent<HTMLTextAreaElement>
  ) => {
    if (!selectedNode) {
      return;
    }

    updateNodeData(selectedNode.id, {
      description: event.target.value,
    });
  };

  const renderNodeConfiguration = () => {
    if (!selectedNode) {
      return null;
    }

    switch (nodeType) {
      case "webhook":
        return (
          <>
            <div className="space-y-2">
              <FieldLabel htmlFor="webhook-method">HTTP method</FieldLabel>
              <select
                id="webhook-method"
                value={configuration.method ?? "POST"}
                onChange={(event) =>
                  updateConfiguration({ method: event.target.value })
                }
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="webhook-path">Endpoint path</FieldLabel>
              <TextInput
                id="webhook-path"
                value={configuration.path ?? "/orders"}
                placeholder="/orders"
                onChange={(event) =>
                  updateConfiguration({ path: event.target.value })
                }
              />
            </div>
          </>
        );

      case "http":
        return (
          <>
            <div className="space-y-2">
              <FieldLabel htmlFor="http-method">HTTP method</FieldLabel>
              <select
                id="http-method"
                value={configuration.method ?? "GET"}
                onChange={(event) =>
                  updateConfiguration({ method: event.target.value })
                }
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="http-url">Request URL</FieldLabel>
              <TextInput
                id="http-url"
                type="url"
                value={configuration.url ?? ""}
                placeholder="https://api.example.com/orders"
                onChange={(event) =>
                  updateConfiguration({ url: event.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="http-timeout">Timeout (ms)</FieldLabel>
              <TextInput
                id="http-timeout"
                type="number"
                value={configuration.timeout ?? 5000}
                placeholder="5000"
                onChange={(event) =>
                  updateConfiguration({
                    timeout: Number(event.target.value) || 0,
                  })
                }
              />
            </div>
          </>
        );

      case "condition":
        return (
          <div className="space-y-2">
            <FieldLabel htmlFor="condition-expression">
              Condition expression
            </FieldLabel>
            <TextArea
              id="condition-expression"
              value={configuration.expression ?? ""}
              placeholder="{{ order.total > 500 }}"
              onChange={(event) =>
                updateConfiguration({ expression: event.target.value })
              }
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              The execution engine will evaluate this expression during a run.
            </p>
          </div>
        );

      case "transform":
        return (
          <div className="space-y-2">
            <FieldLabel htmlFor="transform-expression">
              Transform template
            </FieldLabel>
            <TextArea
              id="transform-expression"
              value={configuration.expression ?? ""}
              placeholder='{{ { customerId: input.customerId, total: input.total } }}'
              onChange={(event) =>
                updateConfiguration({ expression: event.target.value })
              }
              rows={6}
            />
          </div>
        );

      case "delay":
        return (
          <div className="space-y-2">
            <FieldLabel htmlFor="delay-seconds">Delay (seconds)</FieldLabel>
            <TextInput
              id="delay-seconds"
              type="number"
              value={configuration.delaySeconds ?? 30}
              placeholder="30"
              onChange={(event) =>
                updateConfiguration({
                  delaySeconds: Number(event.target.value) || 0,
                })
              }
            />
          </div>
        );

      case "database":
        return (
          <>
            <div className="space-y-2">
              <FieldLabel htmlFor="database-operation">
                Database operation
              </FieldLabel>
              <select
                id="database-operation"
                value={configuration.operation ?? "SELECT"}
                onChange={(event) =>
                  updateConfiguration({ operation: event.target.value })
                }
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              >
                <option value="SELECT">SELECT</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="database-query">Query</FieldLabel>
              <TextArea
                id="database-query"
                value={configuration.query ?? ""}
                placeholder="SELECT * FROM customers WHERE id = {{ input.customerId }}"
                onChange={(event) =>
                  updateConfiguration({ query: event.target.value })
                }
                rows={6}
              />
            </div>
          </>
        );

      case "notification":
        return (
          <>
            <div className="space-y-2">
              <FieldLabel htmlFor="notification-channel">
                Delivery channel
              </FieldLabel>
              <select
                id="notification-channel"
                value={configuration.channel ?? "in-app"}
                onChange={(event) =>
                  updateConfiguration({ channel: event.target.value })
                }
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              >
                <option value="in-app">In-app</option>
                <option value="email">Email</option>
                <option value="slack">Slack</option>
              </select>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="notification-message">Message</FieldLabel>
              <TextArea
                id="notification-message"
                value={configuration.message ?? ""}
                placeholder="Order {{ input.orderId }} was processed successfully."
                onChange={(event) =>
                  updateConfiguration({ message: event.target.value })
                }
              />
            </div>
          </>
        );

      default:
        return (
          <p className="text-xs text-muted-foreground">
            This node does not have configuration fields yet.
          </p>
        );
    }
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-muted/20">
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Properties
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure the selected workflow node
        </p>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-4">
          {selectedNode ? (
            <>
              <div className="rounded-lg border border-border bg-background/60 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Node type
                </p>
                <p className="mt-1 text-sm font-semibold capitalize">
                  {nodeType}
                </p>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="node-label">Display name</FieldLabel>
                <TextInput
                  id="node-label"
                  value={String(selectedNode.data.label ?? "")}
                  placeholder="Enter a node name"
                  onChange={handleLabelChange}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="node-description">Description</FieldLabel>
                <TextArea
                  id="node-description"
                  value={String(selectedNode.data.description ?? "")}
                  placeholder="Describe what this node does"
                  onChange={handleDescriptionChange}
                />
              </div>

              <Separator />

              <section className="space-y-4">
                <div>
                  <p className="text-xs font-semibold">Configuration</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Settings used by the workflow execution engine.
                  </p>
                </div>

                {renderNodeConfiguration()}
              </section>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">
                  Node details
                </p>

                <div className="space-y-1 rounded-md bg-muted/50 p-3 font-mono text-[11px] text-muted-foreground">
                  <p>
                    <span className="text-foreground">id:</span>{" "}
                    {selectedNode.id}
                  </p>
                  <p>
                    <span className="text-foreground">x:</span>{" "}
                    {Math.round(selectedNode.position.x)}
                  </p>
                  <p>
                    <span className="text-foreground">y:</span>{" "}
                    {Math.round(selectedNode.position.y)}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-background/30 p-4 text-center">
              <p className="text-sm font-medium">No node selected</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Click a node on the canvas to inspect and configure it.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}