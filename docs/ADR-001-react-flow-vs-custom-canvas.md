# ADR-001: Use React Flow instead of custom canvas

## Status

Accepted

## Context

FlowForge needs a node-based visual editor for constructing workflows. Building drag/drop, zoom/pan, edge routing, and minimap from scratch would consume significant engineering time without adding portfolio value.

## Decision

Use React Flow (@xyflow/react) as the canvas foundation. It is MIT-licensed, widely adopted, and provides all core graph-editor mechanics out of the box.

## Consequences

- **Easier:** We focus on workflow execution engine, not canvas math.
- **Harder:** We depend on React Flow's API and upgrade path.
- **Neutral:** React Flow is free and open-source; no paywall for reproducible portfolio.
