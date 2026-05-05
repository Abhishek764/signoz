# Affected Routes QA Checklist

Generated from the current tracked diff against `main`.

- Current tracked diff: `git diff main`
- Branch commits only: `git diff main...HEAD`
- Scope: 411 tracked frontend files changed
- Current tracked diff size: 3245 insertions, 1606 deletions
- Branch-only diff size: 3245 insertions, 1606 deletions
- Note: this file is untracked and is not included in the diff counts above.

The changes are mostly icon migration work, so the risk is visual or interaction regressions in icons, buttons, tabs, menus, tables, empty states, charts, modals, and popovers.

## Highest Priority Shared Checks

These shared surfaces affect many pages. Check them while moving through the route list below.

- [ ] Side navigation icons, active state, hover state, collapsed and expanded states
- [ ] Top navigation, time picker, refresh controls, share URL modal, feedback/announcement buttons
- [ ] Route tabs with icons across Logs, Traces, Metrics, Meter, Infra, Messaging Queues, and Settings
- [ ] Query builders: add/remove filters, operators, aggregation, functions, run query button
- [ ] Quick filters: empty state, checkbox filters, settings drawer/popover
- [ ] Tables: row actions, expand/collapse, sorting, column controls, empty/error/loading states
- [ ] Charts: legend, tooltip header/footer, value graph, UPlot chart actions
- [ ] Common menus and modals: download menu, error modal, changelog modal, support/chat launcher
- [ ] Common form controls: select, multiselect, timezone picker, Y-axis unit selector

## Icon Coverage Cross-Check

Cross-check result against `git diff main...HEAD`: 411 changed files total, 400 files with added `@signozhq/icons` imports, and 242 unique new `@signozhq/icons` names. The route brackets below list the main page-facing icons; the additional nested/shared icons from the diff are:

`Antenna`, `ArrowDownToDot`, `ArrowLeftRight`, `ArrowRightToLine`, `ArrowUp10`, `ArrowUpFromDot`, `Ban`, `Bell`, `BellPlus`, `BetweenHorizontalStart`, `BookOpenText`, `Boxes`, `Braces`, `Building2`, `Cable`, `CableCar`, `ChartArea`, `ChartPie`, `ChevronLeft`, `ChevronsDown`, `ChevronsLeftRight`, `CircleArrowLeft`, `CircleHelp`, `ClipboardType`, `Clock`, `Clock4`, `CloudUpload`, `Code`, `Command`, `Computer`, `ConciergeBell`, `Container`, `CornerDownLeft`, `CornerDownRight`, `Crosshair`, `DatabaseZap`, `Diamond`, `Disc3`, `Dot`, `Download`, `Drill`, `EllipsisVertical`, `Eye`, `EyeOff`, `FileKey2`, `FilePenLine`, `Frown`, `Ghost`, `GitCommitVertical`, `Grid2X2`, `Group`, `HdmiPort`, `Infinity`, `KeyRound`, `LampDesk`, `Layers`, `Layers2`, `LayoutList`, `Leaf`, `List`, `LogOut`, `Minus`, `MonitorDot`, `MousePointerClick`, `MoveRight`, `Option`, `Package2`, `PackagePlus`, `Paintbrush`, `PanelBottomClose`, `PinOff`, `Plug`, `Radius`, `Receipt`, `Save`, `Settings2`, `Share2`, `Sigma`, `Slash`, `Spline`, `SquareMinus`, `SquareMousePointer`, `SquarePen`, `SquarePlus`, `SquareSigma`, `SquareX`, `TableColumnsSplit`, `Terminal`, `TextSelect`, `Timer`, `Undo`, `Undo2`, `Unlink`, `Wrench`, `Zap`, `ZoomOut`.

Changed files without added `@signozhq/icons` imports are non-route or support files: `frontend/ICON_ANALYSIS.md`, `frontend/ICON_MIGRATION.md`, `frontend/icon-list.md`, `frontend/iconlist.json`, `frontend/migrate_lucide.py`, `frontend/package.json`, `frontend/yarn.lock`, `frontend/src/constants/env.ts`, `frontend/src/container/GridCardLayout/WidgetHeader/__tests__/WidgetHeader.test.tsx`, `frontend/src/container/MetricsExplorer/Inspect/constants.ts`, and `frontend/src/container/NewWidget/RightContainer/__tests__/RightContainer.test.tsx`.

## Route Checklist

Use real IDs where routes contain params. The bracketed icon lists call out the main changed icons for that route; shared app shell icons are listed in the shared checks above.

### Auth, Public, and Error Routes

- [ ] `/signup` [icons: CircleAlert, ArrowUpRight, LifeBuoy] - Sign up page and shared auth header/footer
- [ ] `/login` [icons: ArrowRight, CircleAlert, LifeBuoy] - Login page and auth error state
- [ ] `/forgot-password` [icons: ArrowUpRight, LifeBuoy] - Auth container shared UI
- [ ] `/password-reset` [icons: ArrowLeft, Plus, Settings, X] - Reset password container
- [ ] `/something-went-wrong` [icons: CircleAlert, Home, LifeBuoy] - Error boundary fallback
- [ ] `/public/dashboard/:dashboardId` [icons: LayoutGrid, CloudDownload, CircleCheck] - Public dashboard controls and widget icons
- [ ] `/workspace-locked` [icons: Home, LifeBuoy] - Workspace locked state

### Home and App Shell

- [ ] `/home` [icons: BarChart, BellDot, Bug, DraftingCompass, HardDrive, Home, LayoutGrid, ScrollText, TowerControl] - Home cards for dashboards, saved views, services, alert rules, checklist, data source info
- [ ] Any logged-in route [icons: Rocket, BarChart, Bug, Settings, LayoutGrid, UserPlus, MessageSquareText, Slack, Shield, Route, Plus] - SideNav and TopNav shell behavior

### Dashboards

- [ ] `/dashboard` [icons: ArrowDownWideNarrow, ArrowUpRight, CalendarClock, Check, Ellipsis, Expand, ExternalLink, FileJson, Github, LayoutGrid, Plus, Search, Trash2] - Dashboard list, templates, import JSON, delete/request dashboard actions
- [ ] `/dashboard/:dashboardId` [icons: Check, ClipboardCopy, Ellipsis, FileJson, FolderKanban, Fullscreen, Globe, LockKeyhole, PenLine, Plus, SolidAlertTriangle, SolidInfoCircle, X] - Dashboard header, variables, widget header, full-view, thresholds
- [ ] `/dashboard/:dashboardId/:widgetId` [icons: Atom, Axis3D, ChartLine, ChevronDown, ChevronRight, EyeClosed, EyeOpen, GripVertical, Link, Palette, Plus, SlidersHorizontal, Trash2, X] - New widget editor, query section, graph, legend, axes, thresholds, formatting, context links

### Services and APM

- [ ] `/services` [icons: Search, SolidAlertTriangle] - Services table, filters, column search
- [ ] `/services/:servicename` [icons: BarChart, DraftingCompass, ScrollText, Search, ChartLine] - Service metrics page, top operations table, ApDex settings
- [ ] `/services/:servicename/top-level-operations` [icons: BarChart, RefreshCw] - Top-level operations page
- [ ] `/trace/:id` [icons: Anvil, BarChart, Bookmark, Link2, LoaderCircle, PanelRight, Plus, Search, Trash2, X] - Trace detail page, waterfall, span drawer, add span to funnel, related signals/logs/attributes

### Logs

- [ ] `/logs/logs-explorer` [icons: Compass, Filter, CircleCheck, CirclePlus, Loader, Link, Pin, Settings, SkipBack, SlidersHorizontal, X] - Logs explorer, query status, filters, log detail, raw log view, format options, action buttons
- [ ] `/logs/logs-explorer/live` [icons: CirclePause, CirclePlay, Ellipsis, Pause, Play] - Live tail controls and pause/resume
- [ ] `/logs/pipelines` [icons: CircleAlert, CircleCheck, CircleMinus, CirclePlus, CircleX, ChevronDown, ChevronRight, Expand, EyeOpen, GripVertical, Loader, Pencil, Plus, SolidInfoCircle, Trash2] - Pipeline list, change history, processor forms, preview, table actions, drag/expand controls
- [ ] `/logs/saved-views` [icons: TowerControl, Compass, Workflow] - Saved views route tab and shared save view UI
- [ ] `/logs/old-logs-explorer` [icons: Compass, Filter, Loader, Search] - Old logs explorer compatibility route

### Traces

- [ ] `/trace` [icons: ArrowUpToLine, Filter, RefreshCw] - Trace filter/search page
- [ ] `/traces-explorer` [icons: BarChart, Compass, Filter, ArrowUpToLine, RefreshCw, X] - Traces explorer list, filters, query builder, span drawer
- [ ] `/traces/saved-views` [icons: TowerControl, Compass, Cone] - Traces saved views
- [ ] `/traces/funnels` [icons: CalendarClock, Check, Compass, Cone, Ellipsis, PencilLine, Plus, Search, Trash2, X] - Funnels list, create, rename, delete, search, empty state
- [ ] `/traces/funnels/:funnelId` [icons: CalendarClock, Check, Cone, Loader, Plus, Trash2, X] - Funnel configuration, step popovers, graph/results

### Metrics and Meter

- [ ] `/metrics-explorer/summary` [icons: BarChart, ChartBar, Diff, Gauge, Info, Loader, Search] - Metrics summary, table, treemap, search, type renderer
- [ ] `/metrics-explorer/explorer` [icons: Atom, CircleArrowDown, CircleArrowRight, Focus, RefreshCcw, SquareArrowOutUpRight, TriangleAlert] - Metrics explorer graph, inspect, expanded view, query builder
- [ ] `/metrics-explorer/views` [icons: TowerControl, BarChart, Compass] - Metrics saved views
- [ ] `/meter` [icons: TowerControl, Compass, Filter] - Meter breakdown page
- [ ] `/meter/explorer` [icons: Compass, Filter] - Meter explorer route
- [ ] `/meter/explorer/views` [icons: TowerControl, Compass] - Meter saved views

### Infrastructure

- [ ] `/infrastructure-monitoring/hosts` [icons: Inbox, CircleCheckBig, HandPlatter, Search] - Hosts list, table config, waitlist/empty states
- [ ] `/infrastructure-monitoring/kubernetes` [icons: Inbox, ArrowUpDown, ChevronDown, ChevronRight, Info, Loader, RotateCw] - K8s base list, expanded rows, headers, entity events, cluster/node/pod/workload table configs

### API Monitoring

- [ ] `/api-monitoring/explorer` [icons: ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Info, Loader, MoveUpRight, RotateCw, UnfoldVertical, X] - Domain list, domain details, dependent services, top errors, empty/error states

### Messaging Queues

- [ ] `/messaging-queues/overview` [icons: Rows3, LoaderCircle, Search] - Celery overview and overview tables
- [ ] `/messaging-queues/kafka` [icons: ListMinus, Bolt, Check, ChevronDown, FolderTree, Info, Loader, OctagonAlert, X] - Kafka list/common components
- [ ] `/messaging-queues/kafka/detail` [icons: ListMinus, BarChart, ScrollText, LoaderCircle] - Kafka detail metric page and graph config
- [ ] `/messaging-queues/celery-task` [icons: Rows3, ChevronDown, ChevronUp, X] - Celery task detail and graph grid

### Alerts

- [ ] `/alerts` [icons: GalleryVerticalEnd, Pyramid, Plus, ArrowRight, CirclePlay] - Alert rules list, empty state, alert info cards
- [ ] `/alerts?tab=TriggeredAlerts` [icons: GalleryVerticalEnd, BellOff, CircleCheck, CircleOff, Flame] - Triggered alerts table row/status UI
- [ ] `/alerts?tab=Configuration&subTab=PlannedDowntime` [icons: CalendarClock, PenLine, Trash2, Check, X] - Planned downtime list, form, delete modal
- [ ] `/alerts?tab=Configuration&subTab=RoutingPolicies` [icons: RotateCw, PenLine, Trash2, Plus, Search, Check, X] - Routing policy list, details, delete flow
- [ ] `/alerts/new` [icons: BarChart, ChartLine, CircleX, DraftingCompass, FileText, Loader, Pencil, PencilLine, RotateCcw, Send, Trash, X] - Create alert V2 header, condition, thresholds, evaluation settings, notification settings, footer
- [ ] `/alerts/type-selection` [icons: AlignLeft, BellRing, ChartBar, LayoutDashboard, Volume2] - Alert type selection into create flow
- [ ] `/alerts/history?ruleId=<ruleId>` [icons: ArrowDownLeft, ArrowUpRight, Calendar, DraftingCompass, Ellipsis, Info, Search] - Alert history timeline, tabs, filters, stats, popovers
- [ ] `/alerts/overview?ruleId=<ruleId>` [icons: Check, Copy, Ellipsis, PenLine, Trash2, BellOff, CircleCheck, CircleOff] - Alert overview/details, header action buttons, rename modal, alert state

### Settings and Channels

- [ ] `/settings` [icons: Cog, Backpack, BellDot, Bot, Building, Cpu, CreditCard, Keyboard, Pencil, Plus, Shield, Sparkles, User, Users, Settings] - General settings and status message
- [ ] `/settings/billing` [icons: CreditCard, CircleCheck, CloudDownload, RefreshCcw] - Billing container and refresh payment status
- [ ] `/settings/org-settings` [icons: Building, Key, Plus, Trash2, X] - Organization settings, auth domain, invite team members
- [ ] `/settings/members` [icons: Users, Plus, Trash2] - Members settings tab via settings navigation
- [ ] `/settings/roles` [icons: Shield] - Roles settings tab via settings navigation
- [ ] `/settings/roles/:roleId` [icons: Shield] - Role details page via settings navigation
- [ ] `/settings/my-settings` [icons: User, Copy, Delete, FileTerminal, Mail, MonitorCog, Moon, Sun] - User info, timezone adaptation, license section
- [ ] `/settings/service-accounts` [icons: Bot] - Service accounts settings tab via settings navigation
- [ ] `/settings/channels` [icons: BellDot, Plus] - Alert channels list
- [ ] `/settings/channels/new` [icons: Plus, Key, X] - Create alert channel flow
- [ ] `/settings/channels/edit/:channelId` [icons: Pencil, Key, X] - Edit alert channel flow
- [ ] `/settings/ingestion-settings` [icons: Cpu, CircleAlert, Check, Loader] - Ingestion settings and multi-ingestion alert threshold UI
- [ ] `/settings/shortcuts` [icons: Keyboard] - Shortcuts tab icon/navigation
- [ ] `/settings/mcp-server` [icons: Sparkles] - MCP server tab icon/navigation

### Integrations

- [ ] `/integrations` [icons: ArrowUpRight, Book, Cloudy, Github, Slack, Unplug, Plus, Trash2, X, Check, Loader] - Integrations list/header, cloud integration actions, AWS/Azure account setup/edit/remove flows
- [ ] `/integrations/:integrationId` [icons: Book, Cloudy, Github, Slack, Trash2, X, Check, Loader] - Integration detail header, content tabs, data collected, uninstall bar, service details

### Onboarding

- [ ] `/get-started` [icons: ArrowLeft, ArrowRight, Blocks, Check, CircleCheck, CircleX, Loader, Server, UserPlus] - Onboarding container, module steps, connection status, data source, environment details, logs connection status
- [ ] `/get-started-with-signoz-cloud` [icons: Check, Goal, Search, UserPlus, X, Copy, Key, TriangleAlert, CircleCheck, Plus] - Onboarding V2 add data source, ingestion details, invite team members
- [ ] `/get-started/application-monitoring` [icons: ChartBar, LayoutDashboard, AlignLeft, BellRing, Volume2] - Application monitoring onboarding path
- [ ] `/get-started/logs-management` [icons: ChartBar, LayoutDashboard, AlignLeft, BellRing, Volume2] - Logs management onboarding path
- [ ] `/get-started/infrastructure-monitoring` [icons: ChartBar, LayoutDashboard, AlignLeft, BellRing, Volume2] - Infrastructure onboarding path
- [ ] `/get-started/aws-monitoring` [icons: ChartBar, LayoutDashboard, AlignLeft, BellRing, Volume2] - AWS onboarding path
- [ ] `/get-started/azure-monitoring` [icons: ChartBar, LayoutDashboard, AlignLeft, BellRing, Volume2] - Azure onboarding path
- [ ] `/onboarding` [icons: ArrowRight, ChevronDown, CircleAlert, LoaderCircle, Plus, Trash2] - Organization onboarding questionnaire

### Exceptions, Support, Status, Licenses

- [ ] `/exceptions` [icons: Search] - Exceptions list
- [ ] `/error-detail` [icons: FileSearch] - Error detail follow-through from exceptions
- [ ] `/support` [icons: LifeBuoy, ArrowUpRight, Book, CreditCard, Github, MessageSquare, Slack, X] - Support page and chat/support launcher
- [ ] `/status` [icons: History, Table] - Version/status page
- [ ] `/licenses` [icons: Copy] - License page/container

## Suggested Smoke Order

1. Start with `/home`, `/logs/logs-explorer`, `/dashboard/:dashboardId`, and `/settings`.
2. Check one table-heavy page: `/metrics-explorer/summary`, `/infrastructure-monitoring/kubernetes`, or `/alerts`.
3. Check one query-builder-heavy page: `/logs/logs-explorer`, `/traces-explorer`, `/metrics-explorer/explorer`, or `/alerts/new`.
4. Check one modal/action-heavy flow: dashboard widget edit, pipeline preview, alert channel create/edit, funnel edit, or routing policy delete.
5. Check one public/auth route: `/signup`, `/login`, or `/public/dashboard/:dashboardId`.
