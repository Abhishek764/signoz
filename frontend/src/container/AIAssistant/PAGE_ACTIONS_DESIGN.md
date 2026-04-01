# Page-Aware AI Action System — Technical Design

**Status:** Draft  
**Author:** AI Assistant  
**Created:** 2026-03-31  
**Scope:** Frontend — AI Assistant integration with page-specific actions

---

## 1. Overview

The Page-Aware AI Action System extends the AI Assistant so that it can understand what page the user is currently on, read the page's live state (active filters, time range, selected entities, etc.), and execute actions available on that page — all through a natural-language conversation.

### Goals

- Let users query, filter, and navigate each SigNoz page by talking to the AI
- Let users create and modify entities (dashboards, alerts, saved views) via the AI
- Keep page-specific wiring isolated and co-located with each page — not inside the AI core
- Zero-friction adoption: adding AI support to a new page is a single `usePageActions(...)` call
- Prevent the AI from silently mutating state — every action requires explicit user confirmation

### Non-Goals

- Backend AI model training or fine-tuning
- Real-time data streaming inside the AI chat (charts already handle that via existing blocks)
- Cross-session memory of user preferences (deferred to a future persistent-context system)

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser                                                             │
│                                                                      │
│  ┌─────────────────────────────────────────────────┐                │
│  │  Active Page (e.g. LogsExplorer)                │                │
│  │                                                 │                │
│  │  usePageActions('logs-explorer', [...actions])  │                │
│  │        │  registers on mount                    │                │
│  │        │  unregisters on unmount                │                │
│  │        ▼                                        │                │
│  │  ┌──────────────────┐                           │                │
│  │  │ PageActionRegistry│  ◄── singleton           │                │
│  │  │ Map<id, Action>   │                           │                │
│  │  └────────┬─────────┘                           │                │
│  └───────────┼─────────────────────────────────────┘                │
│              │  getAll() + context snapshot                          │
│              ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │  AI Assistant (Drawer / Full-page)                        │      │
│  │                                                           │      │
│  │  sendMessage()                                            │      │
│  │    ├── builds [PAGE_CONTEXT] block from registry          │      │
│  │    ├── appends user text                                  │      │
│  │    └── sends to API ──────────────────────────────────►  │      │
│  │                         AI Backend / Mock                 │      │
│  │  ◄── streaming response                                   │      │
│  │                                                           │      │
│  │  MessageBubble                                            │      │
│  │    └── RichCodeBlock detects ```ai-action                 │      │
│  │          └── ActionBlock                                  │      │
│  │               ├── renders description + param preview     │      │
│  │               ├── Accept → PageActionRegistry.execute()   │      │
│  │               └── Reject → no-op                         │      │
│  └───────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 `PageAction<TParams>`

The descriptor for a single action a page exposes to the AI.

```typescript
interface PageAction<TParams = Record<string, unknown>> {
  /**
   * Stable identifier, dot-namespaced by page.
   * e.g. "logs.runQuery", "dashboard.createPanel", "alert.save"
   */
  id: string;

  /**
   * Natural-language description sent verbatim in the page context block.
   * The AI uses this to decide which action to invoke.
   */
  description: string;

  /**
   * JSON Schema (draft-07) describing the parameters this action accepts.
   * Sent to the AI so it can generate structurally valid calls.
   */
  parameters: JSONSchemaObject;

  /**
   * Performs the action. Resolves with a result the AI can narrate back to
   * the user. Rejects if the action cannot be completed.
   */
  execute: (params: TParams) => Promise<ActionResult>;

  /**
   * Optional snapshot of the current page state.
   * Called at message-send time so the AI has fresh context.
   * Return value is JSON-serialised into the [PAGE_CONTEXT] block.
   */
  getContext?: () => unknown;
}

interface ActionResult {
  /** Short human-readable outcome: "Query updated with 2 new filters." */
  summary: string;
  /** Optional structured data the AI block can display (e.g. a new URL) */
  data?: Record<string, unknown>;
}

type JSONSchemaObject = {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
};
```

### 3.2 `PageActionDescriptor`

A lightweight, serialisable version of `PageAction` — safe to include in the API payload (no function references).

```typescript
interface PageActionDescriptor {
  id: string;
  description: string;
  parameters: JSONSchemaObject;
  context?: unknown; // snapshot from getContext()
}
```

### 3.3 `AIActionBlock`

The JSON payload the AI emits inside an ` ```ai-action ``` ` fenced block when it wants to invoke an action.

```typescript
interface AIActionBlock {
  /** Must match a registered PageAction.id */
  actionId: string;

  /**
   * One-sentence explanation of what the action will do.
   * Displayed in the confirmation card.
   */
  description: string;

  /**
   * Parameters the AI chose for this action.
   * Validated against the action's JSON Schema before execute() is called.
   */
  parameters: Record<string, unknown>;
}
```

---

## 4. PageActionRegistry

A module-level singleton (like `BlockRegistry`). Keeps a flat `Map<id, PageAction>` so look-up is O(1). Supports batch register/unregister keyed by a `pageId` so a page can remove all its actions at once on unmount.

```
src/container/AIAssistant/pageActions/PageActionRegistry.ts
```

### Interface

```typescript
const PageActionRegistry = {
  /** Register a set of actions under a page scope key. */
  register(pageId: string, actions: PageAction[]): void;

  /** Remove all actions registered under a page scope key. */
  unregister(pageId: string): void;

  /** Look up a single action by its dot-namespaced id. */
  get(actionId: string): PageAction | undefined;

  /**
   * Return serialisable descriptors for all currently registered actions,
   * with context snapshots already collected.
   */
  snapshot(): PageActionDescriptor[];
};
```

### Internal structure

```typescript
// pageId → action[]  (for clean unregister)
const _byPage = new Map<string, PageAction[]>();

// actionId → action  (for O(1) lookup at execute time)
const _byId = new Map<string, PageAction>();
```

---

## 5. `usePageActions` Hook

Pages call this hook to register their actions declaratively. React lifecycle handles cleanup.

```
src/container/AIAssistant/pageActions/usePageActions.ts
```

```typescript
function usePageActions(pageId: string, actions: PageAction[]): void {
  useEffect(() => {
    PageActionRegistry.register(pageId, actions);
    return () => PageActionRegistry.unregister(pageId);
    // Re-register if action definitions change (e.g. new callbacks after query update)
  }, [pageId, actions]);
}
```

**Important:** action factories (see §8) memoize with `useMemo` so that the `actions` array reference is stable — preventing unnecessary re-registrations.

---

## 6. Context Injection in `sendMessage`

Before every outgoing message, the AI store reads the registry and prepends a machine-readable context block to the API payload content. This block is **never stored in the conversation** (not visible in the message list) — it exists only in the network payload.

```
[PAGE_CONTEXT]
page: logs-explorer
actions:
  - id: logs.runQuery
    description: "Run the current log query with updated filters or time range"
    params: { filters: TagFilter[], timeRange?: string }
  - id: logs.saveView
    description: "Save the current query as a named view"
    params: { name: string }
state:
  filters: [{ key: "level", op: "=", value: "error" }]
  timeRange: "Last 15 minutes"
  panelType: "list"
[/PAGE_CONTEXT]

{user's message}
```

### Implementation in `useAIAssistantStore.sendMessage`

```typescript
// Build context prefix from registry
function buildContextPrefix(): string {
  const descriptors = PageActionRegistry.snapshot();
  if (descriptors.length === 0) return '';

  const actionLines = descriptors.map(a =>
    `  - id: ${a.id}\n    description: "${a.description}"\n    params: ${JSON.stringify(a.parameters.properties)}`
  ).join('\n');

  const contextLines = descriptors
    .filter(a => a.context !== undefined)
    .map(a => `  ${a.id}: ${JSON.stringify(a.context)}`)
    .join('\n');

  return [
    '[PAGE_CONTEXT]',
    'actions:',
    actionLines,
    contextLines ? 'state:' : '',
    contextLines,
    '[/PAGE_CONTEXT]',
    '',
  ].filter(Boolean).join('\n');
}

// In sendMessage, when building the API payload:
const payload = {
  conversationId: activeConversationId,
  messages: history.map((m, i) => {
    const content = (i === history.length - 1 && m.role === 'user')
      ? buildContextPrefix() + m.content
      : m.content;
    return { role: m.role, content };
  }),
};
```

The displayed message in the UI always shows only `m.content` (the user's raw text). The context prefix only exists in the wire payload.

---

## 7. `ActionBlock` Component

Registered as `BlockRegistry.register('action', ActionBlock)`.

```
src/container/AIAssistant/components/blocks/ActionBlock.tsx
```

### Render states

```
┌─────────────────────────────────────────────────────┐
│  ⚡  Suggested Action                               │
│                                                     │
│  "Filter logs for ERROR level from payment-service" │
│                                                     │
│  Parameters:                                        │
│  • level = ERROR                                    │
│  • service.name = payment-service                   │
│                                                     │
│  [ Apply ]   [ Dismiss ]                            │
└─────────────────────────────────────────────────────┘

── After Apply ──

┌─────────────────────────────────────────────────────┐
│  ✓  Applied: "Filter logs for ERROR level from      │
│     payment-service"                                │
└─────────────────────────────────────────────────────┘

── After error ──

┌─────────────────────────────────────────────────────┐
│  ✗  Failed: "Action 'logs.runQuery' is not          │
│     available on the current page."                 │
└─────────────────────────────────────────────────────┘
```

### Execution flow

1. Parse `AIActionBlock` JSON from the fenced block content
2. Validate `parameters` against the action's JSON Schema (fail fast with a clear error)
3. Look up `PageActionRegistry.get(actionId)` — if missing, show "not available" state
4. On Accept: call `action.execute(parameters)`, show loading spinner
5. On success: show summary from `ActionResult.summary`, call `markBlockAnswered(messageId, 'applied')`
6. On failure: show error, allow retry
7. On Dismiss: call `markBlockAnswered(messageId, 'dismissed')`

Like `ConfirmBlock` and `InteractiveQuestion`, `ActionBlock` uses `MessageContext` to get `messageId` and `answeredBlocks` from the store to persist its answered state across remounts.

---

## 8. Page Action Factories

Each page co-locates its action definitions in an `aiActions.ts` file. Factories are functions that close over the page's live state and handlers, so the `execute` callbacks always operate on current data.

### Example: `src/pages/LogsExplorer/aiActions.ts`

```typescript
export function logsRunQueryAction(deps: {
  handleRunQuery: () => void;
  updateQueryFilters: (filters: TagFilterItem[]) => void;
  currentQuery: Query;
  globalTime: GlobalReducer;
}): PageAction {
  return {
    id: 'logs.runQuery',
    description: 'Update the active log filters and run the query',
    parameters: {
      type: 'object',
      properties: {
        filters: {
          type: 'array',
          description: 'Replacement filter list. Each item has key, op, value.',
          items: {
            type: 'object',
            properties: {
              key:   { type: 'string' },
              op:    { type: 'string', enum: ['=', '!=', 'IN', 'NOT_IN', 'CONTAINS', 'NOT_CONTAINS'] },
              value: { type: 'string' },
            },
            required: ['key', 'op', 'value'],
          },
        },
      },
    },
    execute: async ({ filters }) => {
      deps.updateQueryFilters(filters as TagFilterItem[]);
      deps.handleRunQuery();
      return { summary: `Query updated with ${filters.length} filter(s) and re-run.` };
    },
    getContext: () => ({
      filters: deps.currentQuery.builder.queryData[0]?.filters?.items ?? [],
      timeRange: deps.globalTime.selectedTime,
      panelType: 'list',
    }),
  };
}

export function logsSaveViewAction(deps: {
  saveView: (name: string) => Promise<void>;
}): PageAction {
  return {
    id: 'logs.saveView',
    description: 'Save the current log query as a named view',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'View name' } },
      required: ['name'],
    },
    execute: async ({ name }) => {
      await deps.saveView(name as string);
      return { summary: `View "${name}" saved.` };
    },
  };
}
```

### Usage in the page component

```typescript
// src/pages/LogsExplorer/index.tsx

const { handleRunQuery, updateQueryFilters, currentQuery } = useQueryBuilder();
const globalTime = useSelector((s) => s.globalTime);

const actions = useMemo(
  () => [
    logsRunQueryAction({ handleRunQuery, updateQueryFilters, currentQuery, globalTime }),
    logsSaveViewAction({ saveView }),
    logsExportToDashboardAction({ exportToDashboard }),
  ],
  [handleRunQuery, updateQueryFilters, currentQuery, globalTime, saveView, exportToDashboard],
);

usePageActions('logs-explorer', actions);
```

---

## 9. Action Catalogue (Initial Scope)

### 9.1 Logs Explorer

| Action ID | Description | Key Parameters |
|-----------|-------------|----------------|
| `logs.runQuery` | Update filters and run the log query | `filters: TagFilterItem[]` |
| `logs.addFilter` | Append a single filter to the existing set | `key, op, value` |
| `logs.changeView` | Switch between list / timeseries / table | `view: 'list' \| 'timeseries' \| 'table'` |
| `logs.saveView` | Save current query as a named view | `name: string` |
| `logs.exportToDashboard` | Add current query as a panel to a dashboard | `dashboardId?: string, panelTitle?: string` |

### 9.2 Traces Explorer

| Action ID | Description | Key Parameters |
|-----------|-------------|----------------|
| `traces.runQuery` | Update filters and run the trace query | `filters: TagFilterItem[]` |
| `traces.addFilter` | Append a single filter | `key, op, value` |
| `traces.changeView` | Switch between list / trace / timeseries / table | `view: string` |
| `traces.exportToDashboard` | Add to a dashboard | `dashboardId?: string, panelTitle?: string` |

### 9.3 Dashboards List

| Action ID | Description | Key Parameters |
|-----------|-------------|----------------|
| `dashboards.create` | Create a new blank dashboard | `title: string, description?: string` |
| `dashboards.search` | Filter the dashboard list | `query: string` |
| `dashboards.duplicate` | Duplicate an existing dashboard | `dashboardId: string, newTitle?: string` |
| `dashboards.delete` | Delete a dashboard (requires confirmation) | `dashboardId: string` |

### 9.4 Dashboard Detail

| Action ID | Description | Key Parameters |
|-----------|-------------|----------------|
| `dashboard.createPanel` | Add a new panel to the current dashboard | `title: string, queryType: 'logs'\|'metrics'\|'traces'` |
| `dashboard.rename` | Rename the current dashboard | `title: string` |
| `dashboard.deletePanel` | Remove a panel | `panelId: string` |
| `dashboard.addVariable` | Add a dashboard-level variable | `name: string, type: string, defaultValue?: string` |

### 9.5 Alerts

| Action ID | Description | Key Parameters |
|-----------|-------------|----------------|
| `alerts.navigateCreate` | Navigate to the Create Alert page | `alertType?: 'metrics'\|'logs'\|'traces'` |
| `alerts.disable` | Disable an existing alert rule | `alertId: string` |
| `alerts.enable` | Enable an existing alert rule | `alertId: string` |
| `alerts.delete` | Delete an alert rule | `alertId: string` |

### 9.6 Create Alert

| Action ID | Description | Key Parameters |
|-----------|-------------|----------------|
| `alert.setCondition` | Set the alert threshold condition | `op: string, threshold: number` |
| `alert.test` | Test the alert rule against live data | — |
| `alert.save` | Save the alert rule | `name: string, severity?: string` |

### 9.7 Metrics Explorer

| Action ID | Description | Key Parameters |
|-----------|-------------|----------------|
| `metrics.runQuery` | Run a metric query | `metric: string, aggregation?: string` |
| `metrics.saveView` | Save current query as a view | `name: string` |
| `metrics.exportToDashboard` | Add to a dashboard | `dashboardId?: string, panelTitle?: string` |

---

## 10. Context Block Schema (Wire Format)

The `[PAGE_CONTEXT]` block is a freeform text section prepended to the API message content. For the real backend, this should migrate to a structured `system` role message or a dedicated field in the request body. For the initial implementation, embedding it in the user message content is sufficient and works with any LLM API.

```
[PAGE_CONTEXT]
page: <pageId>
actions:
  - id: <actionId>
    description: "<description>"
    params: <JSON Schema properties summary>
  ...
state:
  <actionId>: <JSON context snapshot>
  ...
[/PAGE_CONTEXT]
```

---

## 11. Parameter Validation

Before `execute()` is called, parameters are validated client-side using the JSON Schema stored on the `PageAction`. This catches cases where the AI generates structurally wrong parameters.

```typescript
function validateParams(schema: JSONSchemaObject, params: unknown): string | null {
  // Minimal validation: check required fields are present and types match
  // Full implementation can use ajv or a lightweight equivalent
  for (const key of schema.required ?? []) {
    if (!(params as Record<string, unknown>)[key]) {
      return `Missing required parameter: "${key}"`;
    }
  }
  return null; // valid
}
```

If validation fails, `ActionBlock` shows the error inline and does not call `execute`.

---

## 12. Answered State Persistence

`ActionBlock` follows the same pattern as `ConfirmBlock` and `InteractiveQuestion`:

- Uses `MessageContext` to read `messageId`
- Reads `answeredBlocks[messageId]` from the Zustand store
- On Accept: calls `markBlockAnswered(messageId, 'applied')`
- On Dismiss: calls `markBlockAnswered(messageId, 'dismissed')`
- On Error: calls `markBlockAnswered(messageId, 'error:<message>')`

This ensures re-renders and re-mounts do not reset the block to its initial state.

---

## 13. Error Handling

| Failure scenario | Behaviour |
|-----------------|-----------|
| `actionId` not in registry (page navigated away) | Block shows: "This action is no longer available — navigate back to \<page\> and try again." |
| Parameter validation fails | Block shows the validation error inline; does not call `execute` |
| `execute()` throws | Block shows the error message; offers a Retry button |
| AI emits malformed JSON in the block | `RichCodeBlock` falls back to rendering the raw fenced block as a code block |
| User navigates away mid-execution | `execute()` promise resolves/rejects normally; result is stored in `answeredBlocks` |

---

## 14. Permissions

Many page actions map to protected operations (e.g., creating a dashboard, deleting an alert). Each action factory should check the relevant permission before registering — if the user doesn't have permission, the action is simply not registered and will not appear in the context block.

```typescript
const canCreateDashboard = useComponentPermission(['create_new_dashboards']);

const actions = useMemo(() => [
  ...(canCreateDashboard ? [dashboardCreateAction({ ... })] : []),
  // ...
], [canCreateDashboard, ...]);

usePageActions('dashboard-list', actions);
```

This way the AI never suggests actions the user cannot perform.

---

## 15. Implementation Plan

### Phase 1 — Infrastructure (no page integrations yet)

1. `src/container/AIAssistant/pageActions/types.ts`
2. `src/container/AIAssistant/pageActions/PageActionRegistry.ts`
3. `src/container/AIAssistant/pageActions/usePageActions.ts`
4. `ActionBlock.tsx` + `ActionBlock.scss`
5. Register `'action'` in `blocks/index.ts`
6. Context injection in `useAIAssistantStore.sendMessage`
7. Mock API support for `[PAGE_CONTEXT]` → responds with `ai-action` block

### Phase 2 — Logs Explorer integration

8. `src/pages/LogsExplorer/aiActions.ts` (factories for `logs.*` actions)
9. Wire `usePageActions` into `LogsExplorer/index.tsx`

### Phase 3 — Traces, Dashboards, Alerts

10. `src/pages/TracesExplorer/aiActions.ts`
11. `src/pages/DashboardsListPage/aiActions.ts`
12. `src/pages/DashboardPage/aiActions.ts`
13. `src/pages/AlertList/aiActions.ts`
14. `src/pages/CreateAlert/aiActions.ts`

### Phase 4 — Backend handoff

15. Move `[PAGE_CONTEXT]` from content-embedded text to a dedicated `pageContext` field in the API request body
16. Replace mock responses with real AI backend calls

---

## 16. Open Questions

| # | Question | Impact |
|---|----------|--------|
| 1 | Should `ActionBlock` require a single user confirmation, or show a diff-style preview of what will change? | UX complexity |
| 2 | How should multi-step actions work? (e.g. "create dashboard then add three panels") — queue them or chain them? | Architecture |
| 3 | Should the registry support a global `getContext()` for page-agnostic state (user, org, time range)? | Context completeness |
| 4 | What is the max context block size before it degrades AI quality? | Prompt engineering |
| 5 | Should failed actions add a retry message back into the conversation, or stay silent? | UX |
| 6 | Can two pages be active simultaneously (e.g. drawer open over dashboard)? How do we prioritise which actions are "active"? | Edge case |

---

## 17. Relation to Existing AI Architecture

```
BlockRegistry          PageActionRegistry
     │                       │
     │ render blocks          │ register/unregister actions
     │ (ai-chart, ai-         │ (logs.runQuery, dashboard.create...)
     │  question, ai-         │
     │  confirm, ...)         │
     └──────────┬────────────┘
                │
          MessageBubble / StreamingMessage
                │
          RichCodeBlock (routes to BlockRegistry)
                │
          ActionBlock  ←── new: reads PageActionRegistry to execute
```

The `PageActionRegistry` is a parallel singleton to `BlockRegistry`. `BlockRegistry` maps `fenced-block-type → render component`. `PageActionRegistry` maps `action-id → execute function`. `ActionBlock` bridges the two: it is a registered *block* (render side) that calls into the *action* registry (execution side).
