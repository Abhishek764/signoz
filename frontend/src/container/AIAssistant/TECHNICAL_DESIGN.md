# AI Assistant — Technical Design Document

**Feature:** Conversational AI Assistant embedded in the SigNoz frontend  
**Status:** In development (mock backend)  
**Last updated:** 2026-03-31  
**Author:** Engineering

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Architecture Overview](#3-architecture-overview)
4. [Directory Structure](#4-directory-structure)
5. [Data Model](#5-data-model)
6. [State Management](#6-state-management)
7. [UI Modes & Entry Points](#7-ui-modes--entry-points)
8. [Component Hierarchy](#8-component-hierarchy)
9. [Streaming Protocol](#9-streaming-protocol)
10. [Rich Block System](#10-rich-block-system)
11. [Interactive Blocks](#11-interactive-blocks)
12. [Conversation History](#12-conversation-history)
13. [Icon System](#13-icon-system)
14. [Routing & Integration](#14-routing--integration)
15. [Styling System](#15-styling-system)
16. [Backend Integration Plan](#16-backend-integration-plan)
17. [Security Considerations](#17-security-considerations)
18. [Open Questions & Future Work](#18-open-questions--future-work)

---

## 1. Overview

The AI Assistant is a conversational interface embedded in the SigNoz frontend that allows users to query observability data, get insights, and take actions — all in natural language. It renders rich, structured responses beyond plain text: charts, tables, and interactive confirmation flows powered by a pluggable block registry.

It operates in two surface modes:

- **Panel mode** — a 380px inline sidebar that shrinks the main content area without a modal overlay
- **Full-screen page mode** — a dedicated route with a persistent history sidebar

Both modes share the same Zustand store and conversation state, so switching between them is seamless.

---

## 2. Goals & Non-Goals

### Goals

- Provide a persistent, context-aware conversational interface accessible from any page
- Render AI responses as rich visual components (charts, tables, interactive questions) without custom parsing logic in each response
- Support streaming responses with a live typing experience
- Persist conversation history across page navigations within a session
- Enable the AI to ask clarifying questions and await user confirmation before taking actions
- Make the block system extensible so new response types can be added by registering a component — no changes to core chat code

### Non-Goals

- Backend AI model selection or prompt engineering (owned by the AI/backend team)
- Persisting conversations to a database (current scope: in-memory Zustand store)
- Multi-user / team shared conversations
- Mobile-responsive layout optimisation (desktop-first for now)

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        AppLayout                            │
│  ┌─────────────────────────┐   ┌─────────────────────────┐  │
│  │     .app-content        │   │   AIAssistantPanel      │  │
│  │  (flex: 1, min-width:0) │   │   (380px, flex-shrink:0)│  │
│  │  shrinks when panel open│   │                         │  │
│  └─────────────────────────┘   └─────────────────────────┘  │
│                                                             │
│  HeaderRightSection ──► openAIAssistant() ──► Zustand store │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Zustand Store (useAIAssistantStore)             │
│                                                             │
│  conversations: Record<id, Conversation>                    │
│  activeConversationId: string | null                        │
│  isDrawerOpen: boolean                                      │
│  streamingContent: string                                   │
│  isStreaming: boolean                                       │
│  answeredBlocks: Record<messageId, answer>                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Message Rendering Pipeline                 │
│                                                             │
│  Message.content (markdown string)                          │
│       │                                                     │
│       ▼                                                     │
│  ReactMarkdown                                              │
│       │  components={{ code: RichCodeBlock, pre: SmartPre }}│
│       ▼                                                     │
│  RichCodeBlock                                              │
│       │  language = "ai-<type>"?                            │
│       ├─── yes ──► BlockRegistry.get(type)                  │
│       │                   │                                 │
│       │                   ▼                                 │
│       │           <BlockComponent data={parsedJSON} />      │
│       │                                                     │
│       └─── no  ──► <code>{children}</code>                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Directory Structure

```
src/container/AIAssistant/
├── TECHNICAL_DESIGN.md           ← this document
├── AIAssistant.styles.scss       ← all styles (single file)
├── AIAssistantPanel.tsx          ← inline side panel
├── AIAssistantDrawer.tsx         ← Ant Design Drawer wrapper
├── AIAssistantTrigger.tsx        ← floating action button (legacy)
├── ConversationView.tsx          ← messages + input area
├── types.ts                      ← shared TypeScript types
│
├── store/
│   └── useAIAssistantStore.ts    ← Zustand + Immer store
│
├── mock/
│   └── mockAIApi.ts              ← streaming mock, swappable with fetch()
│
└── components/
    ├── ChatInput.tsx             ← textarea, file upload, send
    ├── VirtualizedMessages.tsx   ← react-virtuoso list
    ├── MessageBubble.tsx         ← committed message renderer
    ├── StreamingMessage.tsx      ← live streaming renderer
    ├── MessageContext.ts         ← React context: messageId → blocks
    ├── HistorySidebar.tsx        ← grouped conversation list
    ├── ConversationItem.tsx      ← single history row (rename, delete)
    ├── AIAssistantIcon.tsx       ← active icon (V2 — Minimal Line)
    ├── AIAssistantIconV2.tsx     ← Minimal Line (current active)
    ├── AIAssistantIconV3.tsx     ← Eye Lens
    ├── AIAssistantIconV4.tsx     ← Neural Spark
    ├── AIAssistantIconV5.tsx     ← App Badge
    ├── AIAssistantIconV6.tsx     ← Square Panda Bot (futuristic)
    └── blocks/
        ├── BlockRegistry.ts      ← Map<type, Component> singleton
        ├── RichCodeBlock.tsx     ← react-markdown code renderer
        ├── index.ts              ← registers all built-in blocks
        ├── chartSetup.ts         ← Chart.js registration + palette
        ├── InteractiveQuestion.tsx
        ├── ConfirmBlock.tsx
        ├── TimeseriesBlock.tsx
        ├── BarChartBlock.tsx
        ├── LineChartBlock.tsx
        └── PieChartBlock.tsx

src/pages/AIAssistantPage/
└── AIAssistantPage.tsx           ← full-screen route component

src/pages/AIAssistantIconPreview/
└── AIAssistantIconPreview.tsx    ← dev-only icon signoff page
```

---

## 5. Data Model

```typescript
// types.ts

interface MessageAttachment {
  name: string;       // original filename
  type: string;       // MIME type (e.g. "image/png", "application/pdf")
  dataUrl: string;    // data: URI for inline display or download URL
}

interface Message {
  id: string;                        // uuid v4
  role: 'user' | 'assistant';
  content: string;                   // raw markdown; may contain ai-* blocks
  attachments?: MessageAttachment[];
  createdAt: number;                 // Unix ms
}

interface Conversation {
  id: string;                        // uuid v4
  messages: Message[];
  createdAt: number;
  updatedAt?: number;                // updated on every new message
  title?: string;                    // auto-derived from first user message
}
```

### Title Derivation

When the first user message is sent, `deriveTitle()` truncates it to 60 characters and stores it on the conversation. This removes the need for a separate naming step.

---

## 6. State Management

### Store: `useAIAssistantStore`

**Technology:** Zustand with Immer middleware (immutable updates via draft mutations).

```typescript
interface AIAssistantStore {
  // UI
  isDrawerOpen: boolean;
  activeConversationId: string | null;

  // Data
  conversations: Record<string, Conversation>;

  // Streaming
  streamingContent: string;
  isStreaming: boolean;

  // Interactive block persistence
  answeredBlocks: Record<string, string>;  // messageId → answer

  // Actions
  openDrawer(): void;
  closeDrawer(): void;
  startNewConversation(): string;          // returns new id
  setActiveConversation(id: string): void;
  clearConversation(id: string): void;
  deleteConversation(id: string): void;
  renameConversation(id: string, title: string): void;
  markBlockAnswered(messageId: string, answer: string): void;
  sendMessage(text: string, attachments?: MessageAttachment[]): Promise<void>;
}
```

### `sendMessage` flow

```
sendMessage(text, attachments)
  │
  ├─ 1. Append user Message to conversation
  ├─ 2. Auto-title conversation (if first message)
  ├─ 3. Set isStreaming = true, streamingContent = ""
  ├─ 4. Call mockAIStream(payload) [→ real fetch when backend ready]
  ├─ 5. ReadableStream reader loop:
  │       while (!done) { streamingContent += chunk }
  ├─ 6. Create assistant Message from final streamingContent
  ├─ 7. Append to conversation, set isStreaming = false
  └─ 8. On error: append error message, reset streaming state
```

### `answeredBlocks` — Interactive Block Persistence

Stores answered state keyed by `messageId`. This survives component remounts caused by new messages arriving (which triggers a Zustand state update → list re-render → component lifecycle reset). Without this, interactive question/confirm blocks would reset to "pending" every time a new AI message arrived.

---

## 7. UI Modes & Entry Points

### Mode 1 — Panel (inline sidebar)

- Triggered by the **header bot icon** (`HeaderRightSection`) or `openAIAssistant()` imperative export
- `AIAssistantPanel` renders inside `AppLayout`'s flex row, to the right of `.app-content`
- `.app-content` uses `flex: 1; min-width: 0` so it naturally shrinks when the panel opens — no JavaScript resize logic needed
- Panel is 380px wide (`min: 320px`, `max: 480px`)
- Suppressed when already on the full-screen page (`matchPath` check)

### Mode 2 — Full-screen page

- Route: `/ai-assistant/:conversationId`
- `AIAssistantPage` is a two-column layout:
  - Left: `HistorySidebar` (220px, fixed width)
  - Right: `ConversationView` (flex: 1)
- URL drives active conversation: `useParams<{ conversationId }>` syncs to the store via `useEffect`
- If the `conversationId` param doesn't exist in the store, a new conversation is created and the user is redirected (`history.replace`)

### Entry Point Summary

| Surface | Component | Trigger |
|---------|-----------|---------|
| Header button | `HeaderRightSection` | Click → `openAIAssistant()` |
| Full-screen URL | `AIAssistantPage` | Direct navigation to `/ai-assistant/:id` |
| Panel expand | `AIAssistantPanel` maximize button | `history.push('/ai-assistant/:id')` |
| Panel minimize | `AIAssistantPage` minimize button | `openDrawer()` + `history.goBack()` |

### Pylon Chat Bubble

The Pylon support chat bubble (`pylon-chat-bubble-frame`) is hidden when the user is on the AI Assistant page to avoid visual conflict. Controlled in `AppRoutes/index.tsx`:

```typescript
useEffect(() => {
  if (
    pathname === ROUTES.ONBOARDING ||
    pathname.startsWith('/public/dashboard/') ||
    pathname.startsWith('/ai-assistant/')   // ← added
  ) {
    window.Pylon?.('hideChatBubble');
  } else {
    window.Pylon?.('showChatBubble');
  }
}, [pathname]);
```

---

## 8. Component Hierarchy

```
AIAssistantPanel
└── ConversationView (conversationId)
    ├── VirtualizedMessages
    │   ├── MessageBubble × N
    │   │   └── ReactMarkdown
    │   │       ├── SmartPre          ← unwraps <pre> for ai-* blocks
    │   │       └── RichCodeBlock     ← dispatches to BlockRegistry
    │   │           ├── InteractiveQuestion
    │   │           ├── ConfirmBlock
    │   │           ├── TimeseriesBlock
    │   │           ├── BarChartBlock
    │   │           ├── LineChartBlock
    │   │           └── PieChartBlock
    │   └── StreamingMessage (while isStreaming)
    │       └── ReactMarkdown (same pipeline)
    └── ChatInput
        ├── Textarea (auto-expand, Enter to send)
        └── Attachment chips

AIAssistantPage
├── Header (Clear, New, Minimize)
└── Body (flex-row)
    ├── HistorySidebar
    │   ├── New button
    │   └── ConversationItem × N (grouped by date)
    └── ConversationView (same as above)
```

### Context: `MessageContext`

`MessageBubble` wraps `ReactMarkdown` in a `MessageContext.Provider` that supplies the current `messageId`. Block components consume this via `useMessageContext()` to look up and persist answered state in the store.

```
MessageBubble (provides MessageContext: { messageId })
    └── ReactMarkdown
        └── RichCodeBlock
            └── ConfirmBlock / InteractiveQuestion
                └── useMessageContext() → messageId
                └── answeredBlocks[messageId] → is answered?
```

---

## 9. Streaming Protocol

### Current (mock)

`mockAIStream()` in `mock/mockAIApi.ts` returns a `Response` object with a `ReadableStream<Uint8Array>` body, simulating a real streaming HTTP response. Words are emitted with 15–45ms random delays.

### Real backend (swap point)

Replace the single line in `useAIAssistantStore.ts`:

```typescript
// Current (mock):
const response = mockAIStream(payload);

// Replace with:
const response = await fetch('/api/v1/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

The rest of the streaming loop (ReadableStream reader, TextDecoder, chunk accumulation) is identical. No other changes required.

### Payload shape

```typescript
{
  conversationId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}
```

### Stream format

Plain UTF-8 text chunks. The entire response is accumulated before being committed as a `Message`. This means partial markdown is rendered live via `StreamingMessage` but only committed once the stream closes.

> **Note:** If the backend emits structured SSE events (e.g. `data: {...}`) rather than raw text, the chunk accumulation logic in `sendMessage` will need a parser.

---

## 10. Rich Block System

### Motivation

AI responses can contain more than text. Rather than building bespoke markdown extensions or client-side JSON parsers, we leverage standard fenced code blocks with a custom language tag: ` ```ai-<type> `. This is valid markdown, renders gracefully in any markdown viewer as a code block, and is intercepted by our custom `code` renderer.

### Block Registry

A singleton `Map<string, React.ComponentType<{ data: unknown }>>` in `BlockRegistry.ts`:

```typescript
// Register
BlockRegistry.register('timeseries', TimeseriesBlock);

// Retrieve
const Component = BlockRegistry.get('timeseries');

// Enumerate
BlockRegistry.types(); // ['question', 'confirm', 'timeseries', ...]
```

### Rendering Pipeline

1. `ReactMarkdown` processes the assistant's markdown content
2. For fenced blocks (` ```lang `), it calls the custom `code` component (`RichCodeBlock`)
3. `RichCodeBlock` inspects the language tag:
   - If it starts with `ai-`, strip the prefix → look up in `BlockRegistry`
   - If a component is found, parse the block body as JSON → render `<Component data={...} />`
   - If JSON is invalid or type is unknown → fall back to `<code>` (graceful degradation)
4. `SmartPre` wraps the `code` renderer — it detects when `RichCodeBlock` returned a custom component (not a `<code>` element) and strips the `<pre>` wrapper that would otherwise force monospace font

### Built-in Block Types

| Tag | Component | Use Case |
|-----|-----------|----------|
| `ai-question` | `InteractiveQuestion` | Radio or checkbox question |
| `ai-confirm` | `ConfirmBlock` | Yes/No action confirmation |
| `ai-timeseries` | `TimeseriesBlock` | Scrollable data table |
| `ai-barchart` | `BarChartBlock` | Horizontal/vertical bar chart |
| `ai-piechart` | `PieChartBlock` | Doughnut/pie chart |
| `ai-linechart` | `LineChartBlock` | Line or area chart |
| `ai-graph` | `LineChartBlock` | Alias for `ai-linechart` |

### Adding a New Block Type

```typescript
// 1. Create the component
export default function MyBlock({ data }: { data: MyData }): JSX.Element { ... }

// 2. Register in blocks/index.ts
import MyBlock from './MyBlock';
BlockRegistry.register('mytype', MyBlock);

// 3. The AI can now use:
// ```ai-mytype
// { ...json payload... }
// ```
```

No changes to `RichCodeBlock`, `MessageBubble`, or the store are needed.

### Chart Setup (`chartSetup.ts`)

Registers all Chart.js elements once as a side effect. Provides:

- `CHART_PALETTE` — 8 SigNoz brand colours (hex)
- `CHART_PALETTE_ALPHA` — same colours at 20% opacity (for fill areas)
- `getChartTheme()` — reads `document.body.classList.contains('dark')` at render time and returns axis/grid colours appropriate for dark or light mode

> **Why hex, not CSS variables?** The Chart.js canvas context cannot read CSS custom properties (`var(--token)`). Colours must be resolved to hex/rgb at render time.

---

## 11. Interactive Blocks

### InteractiveQuestion

Renders radio buttons (auto-submit on selection) or checkboxes (requires a Confirm button).

```typescript
interface QuestionData {
  question?: string;
  type?: 'radio' | 'checkbox';   // default: 'radio'
  options: (string | { value: string; label: string })[];
}
```

### ConfirmBlock

Renders Accept/Reject buttons with configurable labels and response text.

```typescript
interface ConfirmData {
  message?: string;
  acceptText?: string;    // text sent to AI when accepted (default: "Yes, proceed.")
  rejectText?: string;    // text sent to AI when rejected (default: "No, cancel.")
  acceptLabel?: string;   // button label (default: "Accept")
  rejectLabel?: string;   // button label (default: "Reject")
}
```

### Answered State Persistence

**Problem:** Interactive blocks hold their "submitted" state in local React component state. When `sendMessage()` is called, the Zustand store changes, the message list re-renders, and the component can remount — resetting `submitted` to `false`. The question re-appears as interactive even though it was already answered.

**Solution:** Move answered state into the Zustand store, keyed by `messageId`.

```
User clicks answer
    │
    ├─ 1. markBlockAnswered(messageId, answer)   ← store update
    ├─ 2. sendMessage(answer)                    ← triggers AI response
    │
    └─ On next render:
           answeredBlocks[messageId] !== undefined
           → render answered state (✓ + answer text)
           → interactive controls hidden permanently
```

The `messageId` flows from `MessageBubble` via `MessageContext` — blocks do not receive it as a prop, keeping the block data schema clean.

---

## 12. Conversation History

### Grouping Logic

Conversations are sorted by `updatedAt` (descending) and grouped into date buckets:

| Group | Condition |
|-------|-----------|
| Today | `age < 24h` |
| Yesterday | `24h ≤ age < 48h` |
| Last 7 days | `48h ≤ age < 7d` |
| Last 30 days | `7d ≤ age < 30d` |
| Older | `age ≥ 30d` |

### Rename

Inline rename: click the pencil icon → input appears in place of the title → `Enter` or blur commits, `Escape` cancels. Calls `renameConversation(id, title)`.

### Delete

Click the trash icon → `deleteConversation(id)`. If the deleted conversation was active, the store automatically switches `activeConversationId` to the most recently updated remaining conversation (or `null` if none remain).

### Clear

`clearConversation(id)` empties `messages`, resets `title`, and clears any `answeredBlocks` entries for messages in that conversation. Streaming state is also reset.

---

## 13. Icon System

Six SVG icon variants were designed for the AI Assistant button, all in `src/container/AIAssistant/components/`. The active icon (`AIAssistantIcon.tsx`) is currently **V2 — Minimal Line**.

| Variant | File | Design | Notes |
|---------|------|---------|-------|
| V1 | `AIAssistantIcon.tsx` (original) | Circuit Visor — bear + filled red visor + circuit trace | Replaced by V2 |
| V2 | `AIAssistantIconV2.tsx` | **Minimal Line** — stroke outline, red eye bar | **Active** |
| V3 | `AIAssistantIconV3.tsx` | Eye Lens — SigNoz eye inside bear silhouette | Brand-first |
| V4 | `AIAssistantIconV4.tsx` | Neural Spark — bear + 6-point asterisk | Expressive |
| V5 | `AIAssistantIconV5.tsx` | App Badge — bear in dark rounded-square | Product logo weight |
| V6 | `AIAssistantIconV6.tsx` | Square Panda Bot — geometric panda, HUD visor, LED eyes | Futuristic |

**Design constraints:**
- All icons use `currentColor` for strokes/fills where possible → inherit the parent's text colour automatically on both dark and light surfaces
- SigNoz red (`#E8432D`) is used only as a single accent (the eye/visor) — never for structural elements
- All icons work from 16px to 64px. V2 is the most readable at 16px (pure silhouette)

A sign-off preview page is available at `/ai-assistant-icon-preview` (dev only) showing all variants at 6 sizes on dark and light backgrounds.

---

## 14. Routing & Integration

### Routes

```typescript
// constants/routes.ts
ROUTES.AI_ASSISTANT              = '/ai-assistant/:conversationId'
ROUTES.AI_ASSISTANT_ICON_PREVIEW = '/ai-assistant-icon-preview'  // dev only
```

### AppLayout integration

`AIAssistantPanel` is rendered directly inside `AppLayout`'s flex row — after the main `<LayoutContent>` but inside the same flex container. This gives it the "panel pushes content" behaviour without an overlay:

```tsx
<Flex style={{ flex: 1, overflow: 'hidden' }}>
  <LayoutContent>...</LayoutContent>
  <AIAssistantPanel />   {/* ← appended to flex row */}
</Flex>
```

`.app-content` uses `flex: 1; min-width: 0` (not a fixed `width: calc(100% - 54px)`). This means it naturally yields space to the panel without JavaScript.

### Imperative API

Two standalone exports allow any module to open/close the assistant without importing the full component:

```typescript
import { openAIAssistant, closeAIAssistant } from 'container/AIAssistant/store/useAIAssistantStore';

openAIAssistant();   // opens panel, creates conversation if none exists
closeAIAssistant();  // closes panel
```

---

## 15. Styling System

All styles live in a single file: `AIAssistant.styles.scss`.

### Design Tokens Used

| Token | Usage |
|-------|-------|
| `--l1-background` | Panel/page background |
| `--l2-background` | Message bubbles, input area |
| `--l3-background` | Code blocks, table headers |
| `--l1-foreground` | Primary text |
| `--l2-foreground` | Secondary text (timestamps, labels) |
| `--l1-border` / `--l2-border` | Dividers, block borders |
| `--primary` | Button accents (falls back to `--bg-robin-500`) |
| `--bg-cherry-500` | Rejection / error states |
| `--bg-forest-500` | Acceptance / success states |

### Key Layout Rules

- `.app-content { flex: 1; min-width: 0 }` — allows shrinking when panel opens
- `.ai-assistant-panel { flex-shrink: 0; width: 380px }` — fixed width, never wraps
- `.ai-assistant-page__body { flex-direction: row }` — sidebar + chat side by side
- `.ai-history { width: 220px; flex-shrink: 0 }` in page context

### Scrollbar Mixin

A custom `@mixin ai-scrollbar($width)` provides thin, hidden-until-hover scrollbars with CSS `scrollbar-color` for Firefox and `::-webkit-scrollbar-*` for Chrome/Safari.

---

## 16. Backend Integration Plan

### Swap Point

The entire backend integration is contained in a single line of `useAIAssistantStore.ts`. Replace:

```typescript
const response = mockAIStream(payload);
```

with:

```typescript
const response = await fetch('/api/v1/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

### Expected API Contract

**Request:**
```http
POST /api/v1/ai/chat
Content-Type: application/json

{
  "conversationId": "uuid",
  "messages": [
    { "role": "user",      "content": "Show me error rates" },
    { "role": "assistant", "content": "Here are the errors..." },
    { "role": "user",      "content": "Which service is worst?" }
  ]
}
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Transfer-Encoding: chunked

I found several issues...

```ai-timeseries
{ "title": "Errors", "columns": [...], "rows": [...] }
```
```

The response is a UTF-8 text stream. The client accumulates chunks until the stream closes, then commits the full markdown as an assistant message.

### Rich Block Authoring (Backend)

The AI model produces rich blocks as standard fenced code blocks. Example:

````markdown
Which environment would you like to investigate?

```ai-question
{
  "question": "Select environment:",
  "type": "radio",
  "options": ["Production", "Staging", "Development"]
}
```
````

The block body must be valid JSON. Invalid JSON falls back to rendering as a plain code block — the UI never crashes.

### Conversation Persistence

Currently all state is in-memory (Zustand). When the page is refreshed, all conversations are lost. Future persistence options:

1. **`localStorage`** — add `persist` middleware to Zustand. Zero backend changes, survives refresh, limited to ~5MB.
2. **Server-side** — store conversations in the SigNoz backend, fetch on load. Enables cross-device history.

---

## 17. Security Considerations

- **XSS via AI content:** AI responses are rendered via `react-markdown`, which does not execute arbitrary HTML by default. The `rehypeRaw` plugin is not used, so `<script>` tags in AI output are escaped.
- **JSON injection in blocks:** Block payloads are parsed with `JSON.parse()`. A parse error silently falls back to a code block — no user-visible error and no execution of arbitrary code.
- **File attachments:** Files are read as data URIs client-side (`FileReader.readAsDataURL`). They are included in the message payload sent to the backend. The backend must validate file types and sizes before processing.
- **Attachment display:** Images are rendered as `<img src={dataUrl}>` elements. Only `image/*` MIME types are displayed inline; all others render as a filename chip.

---

## 18. Open Questions & Future Work

### Near-term

| Item | Priority | Notes |
|------|----------|-------|
| Connect to real backend | High | Single line swap in `sendMessage` |
| Persist conversations to localStorage | Medium | Add Zustand `persist` middleware |
| Error states for failed blocks | Medium | Currently silently falls back to `<code>` |
| Keyboard shortcut to open assistant | Low | e.g. `⌘K` → AI or dedicated hotkey |

### Streaming protocol

The current implementation accumulates the full response before committing it as a message. If the backend emits structured SSE events (e.g. `event: block_start / data: {...}`), the store's reader loop needs a line parser. This would also enable streaming individual block renders as they complete.

### Conversation persistence

- Current: in-memory Zustand (lost on refresh)
- Option A: `zustand/middleware/persist` → localStorage (simple, no backend)
- Option B: Backend API for conversation CRUD (multi-device, teams)

### Multi-turn context window

The full message history is sent to the backend on every turn. As conversations grow, this will hit token limits. A sliding window or summarisation strategy will be needed.

### Block streaming

Currently, blocks are only rendered after the full assistant message is received. For long responses, this means a user waits for the entire response before seeing any charts. A future improvement is to stream block rendering progressively — render text as it arrives, then render blocks as their closing ` ``` ` tag is detected.

### Accessibility

- Interactive question/confirm blocks need ARIA `role="group"` and `aria-labelledby` for screen reader support
- The streaming indicator (3-dot animation) needs `aria-live="polite"` or `role="status"`
- Focus management when opening/closing the panel needs review

### Agent actions

The confirm block (`ai-confirm`) currently sends the user's decision as a text message. Future work includes a structured action protocol: the backend registers named actions, the frontend executes them (e.g. "create alert rule", "open trace"), and confirmation is a proper action dispatch rather than a freeform message.
