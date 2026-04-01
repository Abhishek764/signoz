# AI Assistant — Technical Design Document

**Status:** In Progress  
**Last Updated:** 2026-04-01  
**Scope:** Frontend AI Assistant subsystem — UI, state management, API integration, page action system

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [User Flows](#3-user-flows)
4. [UI Modes and Transitions](#4-ui-modes-and-transitions)
5. [Control Flow: UI → API → UI](#5-control-flow-ui--api--ui)
6. [SSE Response Handling](#6-sse-response-handling)
7. [Page Action System](#7-page-action-system)
8. [Block Rendering System](#8-block-rendering-system)
9. [State Management](#9-state-management)
10. [Page-Specific Actions](#10-page-specific-actions)
11. [Voice Input](#11-voice-input)
12. [File Attachments](#12-file-attachments)
13. [Development Mode (Mock)](#13-development-mode-mock)
14. [Adding a New Page's Actions](#14-adding-a-new-pages-actions)
15. [Adding a New Block Type](#15-adding-a-new-block-type)
16. [Data Contracts](#16-data-contracts)
17. [Key Design Decisions](#17-key-design-decisions)

---

## 1. Overview

The AI Assistant is an embedded chat interface inside SigNoz that understands the current page context and can execute actions on behalf of the user (e.g., filter logs, update queries, navigate views). It communicates with a backend AI service via Server-Sent Events (SSE) and renders structured responses as rich interactive blocks alongside plain markdown.

**Key goals:**
- **Context-aware:** the AI always knows what page the user is on and what actions are available
- **Streaming:** responses appear token-by-token, no waiting for a full response
- **Actionable:** the AI can trigger page mutations (filter logs, switch views) without copy-paste
- **Extensible:** new pages can register actions; new block types can be added independently

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  User                                                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │ types text / voice / file
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  UI Layer                                                           │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────────┐  │
│  │  Panel      │  │  Modal      │  │  Full-Screen Page         │  │
│  │  (drawer)   │  │  (Cmd+P)    │  │  /ai-assistant/:id        │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┬─────────────┘  │
│         └────────────────┴─────────────────────────┘               │
│                           │ all modes share                         │
│                    ┌──────▼──────┐                                  │
│                    │ConversationView│                               │
│                    │  + ChatInput │                                  │
│                    └──────┬──────┘                                  │
└───────────────────────────┼─────────────────────────────────────────┘
                            │ sendMessage()
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Zustand Store  (useAIAssistantStore)                               │
│                                                                     │
│  conversations{}          isStreaming                               │
│  activeConversationId     streamingContent                          │
│  isDrawerOpen             answeredBlocks{}                          │
│  isModalOpen                                                        │
│                                                                     │
│  sendMessage()                                                      │
│    1. push user message                                             │
│    2. buildContextPrefix() ──► PageActionRegistry.snapshot()       │
│    3. call streamChat(payload)  [or mockStreamChat in dev]          │
│    4. accumulate chunks into streamingContent                       │
│    5. on done: push assistant message with actions[]                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ POST /api/v1/assistant/threads
                           │ (SSE response)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  API Layer  (src/api/ai/chat.ts)                                    │
│                                                                     │
│  streamChat(payload) → AsyncGenerator<SSEEvent>                    │
│  Parses  data: {...}\n\n  SSE frames                                │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Page Action System                                                 │
│                                                                     │
│  PageActionRegistry ◄──── usePageActions() hook                    │
│  (module singleton)        (called by each page on mount)          │
│                                                                     │
│  Registry is read by buildContextPrefix() before every API call.   │
│                                                                     │
│  AI response → ai-action block → ActionBlock component             │
│    → PageActionRegistry.get(actionId).execute(params)              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. User Flows

### 3.1 Basic Chat

```
User opens panel (header icon / Cmd+P / trigger button)
  → Conversation created (or resumed from store)
  → ChatInput focused automatically

User types message → presses Enter
  → User message appended to conversation
  → StreamingMessage (typing indicator) appears
  → SSE stream opens: tokens arrive word-by-word
  → StreamingMessage renders live content
  → Stream ends: StreamingMessage replaced by MessageBubble
  → Follow-up actions (if any) shown as chips on the message
```

### 3.2 AI Applies a Page Action (autoApply)

```
User: "Filter logs for errors from payment-svc"
  → PAGE_CONTEXT injected into wire payload
      (includes registered action schemas + current query state)
  → AI responds with plain text + ai-action block
  → ActionBlock mounts with autoApply=true
  → execute() fires immediately on mount — no user confirmation
  → Logs Explorer query updated via redirectWithQueryBuilderData()
  → URL reflects new filters, QueryBuilderV2 UI updates
  → ActionBlock shows "Applied ✓" state (persisted in answeredBlocks)
```

### 3.3 AI Asks a Clarifying Question

```
AI responds with ai-question block
  → InteractiveQuestion renders (radio or checkbox)
  → User selects answer → sendMessage() called automatically
  → Answer persisted in answeredBlocks (survives re-renders / mode switches)
  → Block shows answered state on re-mount
```

### 3.4 AI Requests Confirmation

```
AI responds with ai-confirm block
  → ConfirmBlock renders Accept / Reject buttons
  → Accept → sendMessage(acceptText)
  → Reject → sendMessage(rejectText)
  → Block shows answered state, buttons disabled
```

### 3.5 Modal → Panel Minimize

```
User opens modal (Cmd+P), interacts with AI
User clicks minimize button (−)
  → minimizeModal(): isModalOpen=false, isDrawerOpen=true (atomic)
  → Same conversation continues in the side panel
  → No data loss, streaming state preserved
```

### 3.6 Panel → Full Screen Expand

```
User clicks Maximize in panel header
  → closeDrawer() called
  → navigate to /ai-assistant/:conversationId
  → Full-screen page renders same conversation
  → TopNav (timepicker header) hidden on this route
  → SideNav remains visible
```

### 3.7 Voice Input

```
User clicks mic button in ChatInput
  → SpeechRecognition.start()
  → isListening=true (mic turns red, CSS pulse animation)
  → Interim results: textarea updates live as user speaks
  → Recognition ends (auto pause detection or manual click)
  → Final transcript committed to committedTextRef
  → User reviews / edits text, then sends normally
```

### 3.8 Resize Panel

```
User hovers over left edge of panel
  → Resize handle highlights (purple line)
User drags left/right
  → panel width updates live (min 380px, max 800px)
  → document.body.cursor = 'col-resize' during drag
  → text selection disabled during drag
```

---

## 4. UI Modes and Transitions

```
                    ┌──────────────────┐
                    │   All Closed     │
                    │  (trigger shown) │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        Click trigger    Cmd+P          navigate to
              │              │          /ai-assistant/:id
              ▼              ▼               ▼
        ┌──────────┐   ┌──────────┐  ┌─────────────┐
        │  Panel   │   │  Modal   │  │ Full-Screen │
        │ (drawer) │   │ (portal) │  │    Page     │
        └────┬─────┘   └────┬─────┘  └──────┬──────┘
             │              │               │
        ┌────▼──────────────▼───────────────▼────┐
        │   ConversationView  (shared component)  │
        └─────────────────────────────────────────┘

Transitions:
  Panel   → Full-Screen  :  Maximize → closeDrawer() + history.push()
  Modal   → Panel        :  Minimize → minimizeModal()
  Modal   → Full-Screen  :  Maximize → closeModal() + history.push()
  Any     → Closed       :  X button or Escape key

Visibility rules:
  Header AI icon    : hidden when isDrawerOpen=true
  Trigger button    : hidden when isDrawerOpen || isModalOpen || isFullScreenPage
  TopNav (timepicker): hidden when pathname.startsWith('/ai-assistant/')
```

---

## 5. Control Flow: UI → API → UI

### 5.1 Message Send

```
ChatInput.handleSend()
  ├── setText('')                         // clear textarea
  ├── committedTextRef.current = ''       // clear voice accumulator
  └── store.sendMessage(text, attachments)
        │
        ├── Push userMessage to conversations[id].messages
        ├── set isStreaming=true, streamingContent=''
        │
        ├── buildContextPrefix()
        │     └── PageActionRegistry.snapshot()
        │           → returns PageActionDescriptor[] (ids, schemas, current context)
        │           → serialized as [PAGE_CONTEXT]...[/PAGE_CONTEXT] string
        │
        ├── Build wire payload:
        │     {
        │       conversationId,
        │       messages: history.map((m, i) => ({
        │         role: m.role,
        │         content: i === last && role==='user'
        │           ? contextPrefix + m.content   // wire only, never stored
        │           : m.content
        │       }))
        │     }
        │
        ├── for await (event of streamChat(payload)):
        │     ├── streamingContent += event.content   // triggers StreamingMessage re-render
        │     └── if event.done: finalActions = event.actions; break
        │
        ├── Push assistantMessage { id: serverMessageId, content, actions }
        └── set isStreaming=false, streamingContent=''
```

### 5.2 Streaming Render Pipeline

```
streamingContent (Zustand state)
  → StreamingMessage component  (rendered while isStreaming=true)
      → react-markdown
          → RichCodeBlock (custom code renderer)
              → BlockRegistry.get(lang) → renders chart / table / action / etc.

On stream end:
  streamingContent → assistantMessage.content  (frozen in store)
  StreamingMessage removed, MessageBubble added with same content
  MessageBubble renders through identical markdown pipeline
```

### 5.3 PAGE_CONTEXT Wire Format

The context prefix is prepended to the last user message in the API payload **only**. It is never stored in the conversation or shown in the UI.

```
[PAGE_CONTEXT]
actions:
  - id: logs.runQuery
    description: "Replace all log filters and re-run the query"
    params: {"filters": {"type": "array", "items": {...}}}
  - id: logs.addFilter
    description: "Append a single key/op/value filter"
    params: {"key": {...}, "op": {...}, "value": {...}}
state:
  logs.runQuery: {"currentFilters": [...], "currentView": "list"}
[/PAGE_CONTEXT]
User's actual message text here
```

---

## 6. SSE Response Handling

### 6.1 Wire Format

**Request:**
```
POST /api/v1/assistant/threads
Content-Type: application/json

{
  "conversationId": "uuid",
  "messages": [
    { "role": "user", "content": "[PAGE_CONTEXT]...[/PAGE_CONTEXT]\nUser text" },
    { "role": "assistant", "content": "Previous assistant turn" },
    ...
  ]
}
```

**Response (SSE stream):**
```
data: {"type":"message","messageId":"srv-123","role":"assistant","content":"I'll ","done":false,"actions":[]}\n\n
data: {"type":"message","messageId":"srv-123","role":"assistant","content":"update ","done":false,"actions":[]}\n\n
data: {"type":"message","messageId":"srv-123","role":"assistant","content":"the query.","done":true,"actions":[
  {"id":"act-1","label":"Add another filter","kind":"follow_up","payload":{},"expiresAt":null}
]}\n\n
```

### 6.2 SSE Parsing (src/api/ai/chat.ts)

```
fetch() → ReadableStream → TextDecoder → string chunks
  → lineBuffer accumulates across chunks (handles partial lines)
  → split on '\n\n' (SSE event boundary)
  → for each complete part:
      find line starting with 'data: '
      strip prefix → parse JSON → yield SSEEvent
  → '[DONE]' sentinel → stop iteration
  → malformed JSON → skip silently
  → finally: reader.releaseLock()
```

### 6.3 Structured Content in the Stream

The AI embeds block payloads as markdown fenced code blocks with `ai-*` language tags inside the `content` stream. These are parsed live as tokens arrive:

````markdown
Here are the results:

```ai-graph
{
  "title": "p99 Latency",
  "datasets": [...]
}
```

The spike started at 14:45.
````

React-markdown renders the code block → `RichCodeBlock` detects the `ai-` prefix → looks up `BlockRegistry` → renders the chart/table/action component.

### 6.4 actions[] Array

Actions arrive on the **final** SSE event (`done: true`). They are stored on the `Message` object. Each action's `kind` determines UI behavior:

| Kind | Behavior |
|---|---|
| `follow_up` | Rendered as suggestion chip; click sends as new message |
| `open_resource` | Opens a SigNoz resource (trace, log, dashboard) |
| `navigate` | Navigates to a SigNoz route |
| `apply_filter` | Directly triggers a registered page action |
| `open_docs` | Opens a documentation URL |
| `undo` | Reverts the last page mutation |
| `revert` | Reverts to a specified previous state |

---

## 7. Page Action System

### 7.1 Concepts

| Concept | Description |
|---|---|
| `PageAction<TParams>` | An action a page exposes to the AI: id, description, JSON Schema params, `execute()`, optional `getContext()`, optional `autoApply` |
| `PageActionRegistry` | Module-level singleton (`Map<pageId, actions[]>` + `Map<actionId, action>`) |
| `usePageActions(pageId, actions)` | React hook — registers on mount, unregisters on unmount |
| `PageActionDescriptor` | Serializable version of `PageAction` (no functions) — sent to AI via PAGE_CONTEXT |
| `AIActionBlock` | Shape the AI emits when invoking an action: `{ actionId, description, parameters }` |

### 7.2 Lifecycle

```
Page component mounts
  └── usePageActions('logs-explorer', actions)
        └── PageActionRegistry.register('logs-explorer', actions)
              → added to _byPage map (for bulk unregister)
              → added to _byId map (for O(1) lookup by actionId)

User sends any message
  └── buildContextPrefix()
        └── PageActionRegistry.snapshot()
              → returns PageActionDescriptor[] with current context values

AI response contains  ```ai-action  block
  └── ActionBlock component mounts
        ├── PageActionRegistry.get(actionId) → PageAction with execute()
        └── if autoApply: execute(params) on mount
            else: render confirmation card, execute on user click

Page component unmounts
  └── usePageActions cleanup
        └── PageActionRegistry.unregister('logs-explorer')
              → all actions for this page removed from both maps
```

### 7.3 ActionBlock State Machine

**autoApply: true** (fires immediately on mount):
```
mount
  → hasFired ref guard (prevents double-fire in React StrictMode)
  → PageActionRegistry.get(actionId).execute(params)
  → render: loading spinner
  → success: "Applied ✓" state, markBlockAnswered(messageId, 'applied')
  → error: error state with message, markBlockAnswered(messageId, 'error:...')
```

**autoApply: false** (user must confirm):
```
mount
  → render: description + parameter summary + Apply / Dismiss buttons
  → Apply clicked:
      → execute(params) → loading → applied state
      → markBlockAnswered(messageId, 'applied')
  → Dismiss clicked:
      → markBlockAnswered(messageId, 'dismissed')
```

**Re-mount (scroll / mode switch):**
```
mount
  → answeredBlocks[messageId] exists
  → render answered state directly (skip pending UI)
```

---

## 8. Block Rendering System

### 8.1 Registration

`src/container/AIAssistant/components/blocks/index.ts` registers all built-in types at import time (side-effect import):

```typescript
BlockRegistry.register('action',     ActionBlock);
BlockRegistry.register('question',   InteractiveQuestion);
BlockRegistry.register('confirm',    ConfirmBlock);
BlockRegistry.register('timeseries', TimeseriesBlock);
BlockRegistry.register('barchart',   BarChartBlock);
BlockRegistry.register('piechart',   PieChartBlock);
BlockRegistry.register('linechart',  LineChartBlock);
BlockRegistry.register('graph',      LineChartBlock);  // alias
```

### 8.2 Render Pipeline

```
MessageBubble (assistant message)
  └── react-markdown
        └── components={{ code: RichCodeBlock }}
              └── RichCodeBlock
                    ├── lang.startsWith('ai-') ?
                    │     yes → BlockRegistry.get(lang.slice(3))
                    │             → parse JSON content
                    │             → render block component
                    └── no  → render plain <code> element
```

### 8.3 Block Component Interface

All block components receive:
```typescript
interface BlockProps {
  content: string;  // raw JSON string from the fenced code block body
}
```

Blocks access shared context via:
```typescript
const { messageId } = useContext(MessageContext);           // for answeredBlocks key
const markBlockAnswered = useAIAssistantStore(s => s.markBlockAnswered);
const sendMessage = useAIAssistantStore(s => s.sendMessage); // for interactive blocks
```

### 8.4 Block Types Reference

| Tag | Component | Purpose |
|---|---|---|
| `ai-action` | `ActionBlock` | Invokes a registered page action |
| `ai-question` | `InteractiveQuestion` | Radio or checkbox user selection |
| `ai-confirm` | `ConfirmBlock` | Binary accept / reject prompt |
| `ai-timeseries` | `TimeseriesBlock` | Tabular data with rows and columns |
| `ai-barchart` | `BarChartBlock` | Horizontal / vertical bar chart |
| `ai-piechart` | `PieChartBlock` | Doughnut / pie chart |
| `ai-linechart` | `LineChartBlock` | Multi-series line chart |
| `ai-graph` | `LineChartBlock` | Alias for `ai-linechart` |

---

## 9. State Management

### 9.1 Store Shape (Zustand + Immer)

```typescript
interface AIAssistantStore {
  // UI
  isDrawerOpen: boolean;
  isModalOpen: boolean;
  activeConversationId: string | null;

  // Data
  conversations: Record<string, Conversation>;

  // Streaming
  streamingContent: string;   // accumulates token-by-token during SSE stream
  isStreaming: boolean;

  // Block answer persistence
  answeredBlocks: Record<string, string>;  // messageId → answer string
}
```

### 9.2 Conversation Structure

```typescript
interface Conversation {
  id: string;
  messages: Message[];
  createdAt: number;
  updatedAt?: number;
  title?: string;         // auto-derived from first user message (60 char max)
}

interface Message {
  id: string;             // server messageId for assistant turns, uuidv4 for user
  role: 'user' | 'assistant';
  content: string;
  attachments?: MessageAttachment[];
  actions?: AssistantAction[];  // follow-up actions, present on final assistant message only
  createdAt: number;
}
```

### 9.3 Streaming State Machine

```
idle
  → sendMessage() called
  → isStreaming=true, streamingContent=''

streaming
  → each SSE chunk: streamingContent += event.content  (triggers StreamingMessage re-render)
  → done event: isStreaming=false, streamingContent=''
  → assistant message pushed to conversation

idle (settled)
  → MessageBubble renders final frozen content
  → ChatInput re-enabled (disabled={isStreaming})
```

### 9.4 Answered Block Persistence

Interactive blocks call `markBlockAnswered(messageId, answer)` on completion. On re-mount, blocks check `answeredBlocks[messageId]` and render the answered state directly. This ensures:
- Scrolling away and back does not reset blocks
- Switching UI modes (panel → full-screen) does not reset blocks
- Blocks cannot be answered twice

---

## 10. Page-Specific Actions

### 10.1 Logs Explorer

**File:** `src/pages/LogsExplorer/aiActions.ts`  
**Registered in:** `src/pages/LogsExplorer/index.tsx` via `usePageActions('logs-explorer', aiActions)`

| Action ID | autoApply | Description |
|---|---|---|
| `logs.runQuery` | `true` | Replace all filters in the query builder and re-run |
| `logs.addFilter` | `true` | Append a single `key / op / value` filter |
| `logs.changeView` | `true` | Switch between list / timeseries / table views |
| `logs.saveView` | `false` | Save current query as a named view (requires confirmation) |

**Critical implementation detail:** All query mutations use `redirectWithQueryBuilderData()`, not `handleSetQueryData`. The Logs Explorer's `QueryBuilderV2` is URL-driven — `compositeQuery` in the URL is the source of truth for displayed filters. `handleSetQueryData` updates React state only; `redirectWithQueryBuilderData` syncs the URL, making changes visible in the UI.

**Context shape provided to AI:**
```typescript
getContext: () => ({
  currentFilters: currentQuery.builder.queryData[0].filters.items,
  currentView:    currentView,   // 'list' | 'timeseries' | 'table'
})
```

---

## 11. Voice Input

### 11.1 Hook: useSpeechRecognition

**File:** `src/container/AIAssistant/hooks/useSpeechRecognition.ts`

```typescript
const { isListening, isSupported, start, stop, transcript, isFinal } =
  useSpeechRecognition({ lang: 'en-US', onError });
```

Exposes `transcript` and `isFinal` as React state (not callbacks) so `ChatInput` reacts via `useEffect([transcript, isFinal])`, eliminating stale closure issues.

### 11.2 Interim vs Final Handling

```
onresult (isFinal=false)  → pendingInterim = text  → setTranscript(text), setIsFinal(false)
onresult (isFinal=true)   → pendingInterim = ''    → setTranscript(text), setIsFinal(true)
onend    (pendingInterim) → setTranscript(pendingInterim), setIsFinal(true)
  ↑ fallback: Chrome often skips the final onresult when stop() is called manually
```

### 11.3 Text Accumulation in ChatInput

```
committedTextRef.current = ''     // tracks finalized text (typed + confirmed speech)

isFinal=false (interim):
  setText(committedTextRef.current + ' ' + transcript)
  // textarea shows live speech; committedTextRef unchanged

isFinal=true (final):
  committedTextRef.current += ' ' + transcript
  setText(committedTextRef.current)
  // both textarea and ref updated — text is now "committed"

User types manually:
  setText(e.target.value)
  committedTextRef.current = e.target.value
  // keeps both in sync so next speech session appends correctly
```

---

## 12. File Attachments

`ChatInput` uses Ant Design `Upload` with `beforeUpload` returning `false` (prevents auto-upload). Files accumulate in `pendingFiles: UploadFile[]` state. On send, files are converted to data URIs (`fileToDataUrl`) and stored on the `Message` as `attachments[]`.

**Accepted types:** `image/*`, `.pdf`, `.txt`, `.log`, `.csv`, `.json`

**Rendered in MessageBubble:**
- Images → inline `<img>` preview
- Other files → file badge chip (name + type)

---

## 13. Development Mode (Mock)

Set `VITE_AI_MOCK=true` in `.env.local` to use the mock API instead of the real SSE endpoint.

```typescript
// store/useAIAssistantStore.ts
const USE_MOCK_AI = import.meta.env.VITE_AI_MOCK === 'true';
const chat = USE_MOCK_AI ? mockStreamChat : streamChat;
```

`mockStreamChat` implements the same `AsyncGenerator<SSEEvent>` interface as `streamChat`. It selects canned responses from keyword matching on the last user message and simulates word-by-word streaming with 15–45ms random delays.

**Trigger keywords:**

| Keyword(s) | Response type |
|---|---|
| `filter logs`, `payment` + `error` | `ai-action`: logs.runQuery |
| `add filter` | `ai-action`: logs.addFilter |
| `change view` / `timeseries view` | `ai-action`: logs.changeView |
| `save view` | `ai-action`: logs.saveView |
| `error` / `exception` | Error rates table + trace snippet |
| `latency` / `p99` / `graph` | Line chart (p99 latency) |
| `bar` / `top service` | Bar chart (error count) |
| `pie` / `distribution` | Pie / doughnut chart |
| `timeseries` / `table` | Timeseries data table |
| `log` | Top log errors summary |
| `confirm` / `alert` / `anomal` | `ai-confirm` block |
| `environment` / `question` | `ai-question` (radio) |
| `level` / `select` / `filter` | `ai-question` (checkbox) |

---

## 14. Adding a New Page's Actions

### Step 1 — Create an aiActions file

```typescript
// src/pages/TracesExplorer/aiActions.ts
import { PageAction } from 'container/AIAssistant/pageActions/types';

interface FilterTracesParams {
  service: string;
  minDurationMs?: number;
}

export function tracesFilterAction(deps: {
  currentQuery: Query;
  redirectWithQueryBuilderData: (q: Query) => void;
}): PageAction<FilterTracesParams> {
  return {
    id: 'traces.filter',           // globally unique: pageName.actionName
    description: 'Filter traces by service name and minimum duration',
    autoApply: true,
    parameters: {
      type: 'object',
      properties: {
        service:       { type: 'string',  description: 'Service name to filter by' },
        minDurationMs: { type: 'number',  description: 'Minimum span duration in ms' },
      },
      required: ['service'],
    },
    execute: async ({ service, minDurationMs }) => {
      // Build updated query and redirect
      deps.redirectWithQueryBuilderData(buildUpdatedQuery(service, minDurationMs));
      return { summary: `Filtered traces for ${service}` };
    },
    getContext: () => ({
      currentFilters: deps.currentQuery.builder.queryData[0].filters.items,
    }),
  };
}
```

### Step 2 — Register in the page component

```typescript
// src/pages/TracesExplorer/index.tsx
import { usePageActions } from 'container/AIAssistant/pageActions/usePageActions';
import { tracesFilterAction } from './aiActions';

function TracesExplorer() {
  const { currentQuery, redirectWithQueryBuilderData } = useQueryBuilder();

  const aiActions = useMemo(() => [
    tracesFilterAction({ currentQuery, redirectWithQueryBuilderData }),
  ], [currentQuery, redirectWithQueryBuilderData]);

  usePageActions('traces-explorer', aiActions);

  // ... rest of component
}
```

**Rules:**
- `pageId` must be unique across pages (kebab-case convention)
- `actionId` must be globally unique — use `pageName.actionName` convention
- `actions` array **must be memoized** (`useMemo`) — identity change triggers re-registration
- For URL-driven state (QueryBuilder), always use the URL-sync API; never use `handleSetQueryData` alone
- `getContext()` should return only what the AI needs to make decisions — keep it minimal

---

## 15. Adding a New Block Type

### Step 1 — Create the component

```typescript
// src/container/AIAssistant/components/blocks/MyBlock.tsx
import { useContext } from 'react';
import MessageContext from '../MessageContext';
import { useAIAssistantStore } from '../../store/useAIAssistantStore';

interface MyBlockPayload {
  title: string;
  items: string[];
}

export default function MyBlock({ content }: { content: string }): JSX.Element {
  const payload = JSON.parse(content) as MyBlockPayload;
  const { messageId } = useContext(MessageContext);
  const markBlockAnswered = useAIAssistantStore(s => s.markBlockAnswered);
  const answered = useAIAssistantStore(s => s.answeredBlocks[messageId]);

  if (answered) return <div className="ai-block--answered">Done</div>;

  return (
    <div>
      <h4>{payload.title}</h4>
      {/* ... */}
    </div>
  );
}
```

### Step 2 — Register in index.ts

```typescript
// src/container/AIAssistant/components/blocks/index.ts
import MyBlock from './MyBlock';
BlockRegistry.register('myblock', MyBlock);
```

### Step 3 — AI emits the block tag

````markdown
```ai-myblock
{
  "title": "Something",
  "items": ["a", "b"]
}
```
````

---

## 16. Data Contracts

### 16.1 API Request

```typescript
POST /api/v1/assistant/threads
{
  conversationId: string,
  messages: Array<{
    role: 'user' | 'assistant',
    content: string   // last user message includes [PAGE_CONTEXT]...[/PAGE_CONTEXT] prefix
  }>
}
```

### 16.2 SSE Event Schema

```typescript
interface SSEEvent {
  type: 'message';
  messageId: string;       // server-assigned; consistent across all chunks of one turn
  role: 'assistant';
  content: string;         // incremental chunk — NOT cumulative
  done: boolean;           // true on the last event of a turn
  actions: Array<{
    id: string;
    label: string;
    kind: 'follow_up' | 'open_resource' | 'navigate' | 'apply_filter' | 'open_docs' | 'undo' | 'revert';
    payload: Record<string, unknown>;
    expiresAt: string | null;  // ISO-8601 or null
  }>;
}
```

### 16.3 ai-action Block Payload (embedded in content stream)

```typescript
{
  actionId: string,          // must match a registered PageAction.id
  description: string,       // shown in the confirmation card (autoApply=false)
  parameters: Record<string, unknown>  // must conform to the action's JSON Schema
}
```

### 16.4 PageAction Interface

```typescript
interface PageAction<TParams = Record<string, any>> {
  id: string;
  description: string;
  parameters: JSONSchemaObject;
  execute: (params: TParams) => Promise<{ summary: string; data?: unknown }>;
  getContext?: () => unknown;   // called on every sendMessage() to populate PAGE_CONTEXT
  autoApply?: boolean;          // default false
}
```

---

## 17. Key Design Decisions

### Context injection is wire-only
PAGE_CONTEXT is injected into the wire payload but never stored or shown in the UI. This keeps conversations readable, avoids polluting history with system context, and ensures the AI always gets fresh page state on every message rather than stale state from when the conversation started.

### URL-driven query builders require URL-sync APIs
Pages that use URL-driven state (e.g., `QueryBuilderV2` with `compositeQuery` URL param) **must** use the URL-sync API (`redirectWithQueryBuilderData`) when actions mutate query state. Using React `setState` alone does not update the URL, so the displayed filters do not change. This was the root cause of the first major bug in the Logs Explorer integration.

### autoApply co-located with action definition
The `autoApply` flag lives on the `PageAction` definition, not in the UI layer. The page that owns the action knows whether it is safe to apply without confirmation. Additive / reversible actions use `autoApply: true`. Actions that create persistent artifacts (saved views, alert rules) use `autoApply: false`.

### Transcript-as-state for voice input
`useSpeechRecognition` exposes `transcript` and `isFinal` as React state rather than using an `onTranscript` callback. The callback approach had a race condition: recognition events could fire before the `useEffect` that wired up the callback had run, leaving `onTranscriptRef.current` unset. State-based approach uses normal React reactivity with no timing dependency.

### Block answer persistence across re-mounts
Interactive blocks persist their answered state to `answeredBlocks[messageId]` in the Zustand store. Without this, switching UI modes or scrolling away and back would reset blocks to their unanswered state, allowing the user to re-submit answers and send duplicate messages to the AI.

### Panel resize is not persisted
Panel width resets to 380px on close/reopen. If persistence is needed, save `panelWidth` to `localStorage` in the drag `onMouseUp` handler and initialize `useState` from it.

### Mock API shares the same interface
`mockStreamChat` implements the same `AsyncGenerator<SSEEvent>` interface as `streamChat`. The store switches between them via `VITE_AI_MOCK=true`. This means the mock exercises the exact same store code path as production — no separate code branch to maintain.
