# Icon Migration Analysis — Full Edge Case Report

## Summary

| Library | Files | Unique Icons | Fully Migratable | Rename Needed | No Equivalent |
|---|---|---|---|---|---|
| `@ant-design/icons` | 140 | 55 | 53 | — | 2 (`GoogleSquareFilled`, `ApiFilled`) |
| `lucide-react` | 311 | 179 | 149 (direct) + 27 (rename) | 27 | 3 |

---

## 1. Ant Design Icons

### ✅ All 53 Migratable Icons

| Ant Design | → | @signozhq/icons | Usage count |
|---|---|---|---|
| `ArrowRightOutlined` | → | `ArrowRight` | 3 |
| `ArrowUpOutlined` | → | `ArrowUp` | 1 |
| `CaretDownFilled` | → | `ChevronDown` | 2 |
| `CaretDownOutlined` | → | `ChevronDown` | 1 |
| `CaretRightFilled` | → | `ChevronRight` | 3 |
| `CheckCircleFilled` | → | `CircleCheck` | 2 |
| `CheckCircleOutlined` | → | `CircleCheck` | 1 |
| `CheckOutlined` | → | `Check` | 4 |
| `CloseCircleFilled` | → | `CircleX` | 1 |
| `CloseCircleOutlined` | → | `CircleX` | 1 |
| `CloseOutlined` | → | `X` | 7 |
| `CloseSquareOutlined` | → | `SquareX` | 1 |
| `CloudDownloadOutlined` | → | `CloudDownload` | 2 |
| `CopyOutlined` | → | `Copy` | 1 |
| `DeleteFilled` | → | `Trash2` | 1 |
| `DeleteOutlined` | → | `Trash2` | 4 |
| `DownOutlined` | → | `ChevronDown` | 4 |
| `EditFilled` | → | `Pencil` | 1 |
| `EditOutlined` | → | `Pencil` | 1 |
| `EllipsisOutlined` | → | `Ellipsis` | 2 |
| `ExclamationCircleFilled` | → | `CircleAlert` | 2 |
| `ExclamationCircleOutlined` | → | `CircleAlert` | 3 |
| `ExclamationCircleTwoTone` | → | `CircleAlert` | 1 |
| `ExpandAltOutlined` | → | `Expand` | 1 |
| `EyeFilled` | → | `Eye` | 2 |
| `EyeInvisibleFilled` | → | `EyeOff` | 1 |
| `FastBackwardOutlined` | → | `SkipBack` | 1 |
| `FileSearchOutlined` | → | `FileSearch` | 1 |
| `FilterOutlined` | → | `Filter` | 2 |
| `HolderOutlined` | → | `GripVertical` | 2 |
| `InfoCircleOutlined` | → | `Info` | 8 |
| `KeyOutlined` | → | `Key` | 1 |
| `LeftOutlined` | → | `ChevronLeft` | 1 |
| `LinkOutlined` | → | `Link` | 4 |
| `LoadingOutlined` | → | `LoaderCircle` | 19 |
| `MinusCircleOutlined` | → | `CircleMinus` | 1 |
| `MinusSquareOutlined` | → | `SquareMinus` | 3 |
| `MoreOutlined` | → | `EllipsisVertical` | 1 |
| `PauseCircleFilled` | → | `CirclePause` | 1 |
| `PlayCircleFilled` | → | `CirclePlay` | 2 |
| `PlusCircleFilled` | → | `CirclePlus` | 1 |
| `PlusCircleOutlined` | → | `CirclePlus` | 2 |
| `PlusOutlined` | → | `Plus` | 18 |
| `PlusSquareOutlined` | → | `SquarePlus` | 3 |
| `RightOutlined` | → | `ChevronRight` | 3 |
| `RocketOutlined` | → | `Rocket` | 1 |
| `SaveOutlined` | → | `Save` | 1 |
| `SearchOutlined` | → | `Search` | 9 |
| `SettingFilled` | → | `Settings` | 1 |
| `SettingOutlined` | → | `Settings` | 3 |
| `SyncOutlined` | → | `RefreshCw` | 2 |
| `VerticalAlignTopOutlined` | → | `ArrowUpToLine` | 3 |
| `WarningFilled` | → | `TriangleAlert` | 3 |
| `WarningOutlined` | → | `TriangleAlert` | 2 |

### ❌ No Equivalent (2 icons)

| Icon | File | Context |
|---|---|---|
| `GoogleSquareFilled` | `AuthnProviderSelector.tsx` | Google SSO auth provider selector — brand icon, no replacement |
| `ApiFilled` | `renderConfig.tsx` | Getting started page — decorative menu icon |

---

## 2. Ant Design — Edge Cases

### 🔄 `spin` prop (rotation animation)

Ant Design's `spin` boolean makes the icon rotate continuously. `@signozhq/icons` has no `spin` prop — use `className="animate-spin"` (Tailwind) instead.

| File | Usage | Migration |
|---|---|---|
| `K8sExpandedRow.tsx` | `<LoadingOutlined size={14} spin />` | `<LoaderCircle size={14} className="animate-spin" />` |
| `K8sBaseList.tsx` | `<LoadingOutlined size={14} spin />` | `<LoaderCircle size={14} className="animate-spin" />` |
| `QueryTable/.../useBaseAggregateOptions.tsx` | `<LoadingOutlined spin />` | `<LoaderCircle className="animate-spin" />` |
| `TraceWaterfall/.../Filters.tsx` | `<LoadingOutlined spin />` | `<LoaderCircle className="animate-spin" />` |
| `AddSpanToFunnelModal.tsx` | `<LoadingOutlined spin />` | `<LoaderCircle className="animate-spin" />` |
| `PipelinePage/.../utils.tsx` | `<LoadingOutlined style={{fontSize:15}} spin />` | `<LoaderCircle size={15} className="animate-spin" />` |
| `MessagingQueueHealthCheck/AttributeCheckList.tsx` | `<LoadingOutlined spin />` | `<LoaderCircle className="animate-spin" />` |
| `TanStackTable.tsx` | `<LoadingOutlined spin />` | `<LoaderCircle className="animate-spin" />` |
| `CeleryOverviewTable.tsx` | `<LoadingOutlined size={14} spin />` | `<LoaderCircle size={14} className="animate-spin" />` |
| `ServiceTopLevelOperations/index.tsx` | `<SyncOutlined spin />` | `<RefreshCw className="animate-spin" />` |
| `GeneralSettings.tsx (×3)` | `<LoadingOutlined spin />` | `<LoaderCircle className="animate-spin" />` |
| `MetricsExplorer/Summary/MetricsTable.tsx` | `<LoadingOutlined size={14} spin />` | `<LoaderCircle size={14} className="animate-spin" />` |
| `ApiMonitoring/DomainList.tsx` | `<LoadingOutlined size={14} spin />` | `<LoaderCircle size={14} className="animate-spin" />` |
| `ApiMonitoring/TopErrors.tsx` | `<LoadingOutlined size={14} spin />` | `<LoaderCircle size={14} className="animate-spin" />` |

### 🔄 `rotate` prop (static rotation)

Ant Design supports `rotate={N}` (degrees). `@signozhq/icons` has no `rotate` prop — use `style={{transform:'rotate(Ndeg)'}}` or a wrapper `className`.

| File | Usage | Migration |
|---|---|---|
| `SideNav/menuItems.tsx (×3)` | `<RocketOutlined rotate={45} />` | `<Rocket style={{transform:'rotate(45deg)'}} />` |
| `QueryBuilder/ToolbarActions/LeftToolbarActions.tsx` | `<VerticalAlignTopOutlined rotate={90} />` | `<ArrowUpToLine style={{transform:'rotate(90deg)'}} />` |
| `InfraMonitoringK8s/InfraMonitoringK8s.tsx` | `<VerticalAlignTopOutlined rotate={270} />` | `<ArrowUpToLine style={{transform:'rotate(270deg)'}} />` |

### 🎨 Two-tone icons

Ant Design two-tone icons accept `twoToneColor` (two separate fill colors). `@signozhq/icons` icons are single-stroke SVGs — no two-tone support. Use solid/outline equivalents with a single `color` prop.

| File | Usage | Migration |
|---|---|---|
| `ImportJSON/index.tsx` | `<ExclamationCircleTwoTone twoToneColor={[red[7], '#1f1f1f']} />` | `<CircleAlert color={red[7]} />` (drop secondary fill) |
| `ConnectionStatus.tsx` | `<CheckCircleTwoTone twoToneColor="#52c41a" />` | `<CircleCheck color="#52c41a" />` |
| `ConnectionStatus.tsx` | `<CloseCircleTwoTone twoToneColor="#e84749" />` | `<CircleX color="#e84749" />` |
| `LogsConnectionStatus.tsx` | `<CheckCircleTwoTone twoToneColor="#52c41a" />` | `<CircleCheck color="#52c41a" />` |
| `LogsConnectionStatus.tsx` | `<CloseCircleTwoTone twoToneColor="#e84749" />` | `<CircleX color="#e84749" />` |
| `CustomSelect.tsx` | `<CloseCircleOutlined twoToneColor={Color.BG_CHERRY_400} />` | `<CircleX color={Color.BG_CHERRY_400} />` |
| `CustomMultiSelect.tsx` | `<CloseCircleOutlined twoToneColor={Color.BG_CHERRY_400} />` | `<CircleX color={Color.BG_CHERRY_400} />` |

### 🌗 Light/Dark mode icon switching

One place conditionally swaps between Filled/Outlined based on dark mode. `@signozhq/icons` uses a single stroke icon — just use one icon with color:

| File | Current | Migration |
|---|---|---|
| `OptionsMenu/index.tsx` | `isDarkMode ? <SettingOutlined> : <SettingFilled>` | `<Settings />` (uniform, color via CSS/className) |

### 📐 `style={{fontSize}}` sizing

`@signozhq/icons` uses a `size` prop (number of px or named size). Replace `style={{fontSize: N}}` with `size={N}`.

| File | Current | Migration |
|---|---|---|
| `StatusMessage.tsx` | `<InfoCircleOutlined style={{fontSize:'1rem'}} />` | `<Info size={16} />` |
| `AuthnProviderSelector.tsx` | `<KeyOutlined style={{fontSize:'37px'}} />` | `<Key size={37} />` |
| `LogLiveTail/index.tsx` | `<MoreOutlined style={{fontSize:24}} />` | `<EllipsisVertical size={24} />` |
| `PipelinePage/.../utils.tsx` | `<LoadingOutlined style={{fontSize:15}} spin />` | `<LoaderCircle size={15} className="animate-spin" />` |
| `GantChart/index.tsx (×2)` | `style={{fontSize:'16px', color:'...'}}` | `size={16} color="..."` |

---

## 3. Lucide React — 149 Direct Replacements

These icons have the **exact same name** in `@signozhq/icons`. Just change the import, no rename needed.

<details>
<summary>Show all 149 icons</summary>

| Icon | Icon | Icon | Icon |
|---|---|---|---|
| `Antenna` | `ArrowDown` | `ArrowDownLeft` | `ArrowDownWideNarrow` |
| `ArrowLeft` | `ArrowLeftRight` | `ArrowRight` | `ArrowRightToLine` |
| `ArrowUp` | `ArrowUp10` | `ArrowUpDown` | `ArrowUpRight` |
| `Atom` | `Axis3D` | `Ban` | `Bell` |
| `BellDot` | `BellOff` | `Blocks` | `Bolt` |
| `BookOpenText` | `Braces` | `Cable` | `CableCar` |
| `Calendar` | `CalendarClock` | `ChartBar` | `ChartLine` |
| `Check` | `ChevronDown` | `ChevronLeft` | `ChevronRight` |
| `ChevronUp` | `ChevronsDown` | `CircleAlert` | `CircleArrowRight` |
| `CircleCheck` | `CircleOff` | `CircleX` | `Clock` |
| `CloudUpload` | `Code` | `Cog` | `Command` |
| `Compass` | `ConciergeBell` | `Cone` | `Copy` |
| `CornerDownRight` | `CreditCard` | `Crosshair` | `Delete` |
| `Diamond` | `Disc3` | `Dot` | `Download` |
| `DraftingCompass` | `Drill` | `Ellipsis` | `ExternalLink` |
| `FileTerminal` | `FileText` | `Filter` | `Flame` |
| `Focus` | `FolderTree` | `Frown` | `Fullscreen` |
| `GalleryVerticalEnd` | `Ghost` | `Github` | `Globe` |
| `Goal` | `GripVertical` | `Group` | `HandPlatter` |
| `History` | `Home` | `Inbox` | `Info` |
| `Key` | `KeyRound` | `Layers` | `LayoutDashboard` |
| `LayoutGrid` | `LifeBuoy` | `Link` | `Link2` |
| `List` | `ListMinus` | `Loader` | `LoaderCircle` |
| `MessageSquareText` | `Minus` | `MonitorCog` | `MonitorDot` |
| `Moon` | `MoveRight` | `MoveUpRight` | `OctagonAlert` |
| `Option` | `Paintbrush` | `Palette` | `PenLine` |
| `Pencil` | `PencilLine` | `Pin` | `PinOff` |
| `Plug` | `Plus` | `Pyramid` | `RefreshCcw` |
| `RefreshCw` | `RotateCcw` | `RotateCw` | `Rows3` |
| `Save` | `ScrollText` | `Search` | `Send` |
| `Server` | `Settings` | `Settings2` | `Share2` |
| `Sigma` | `SlidersHorizontal` | `Spline` | `SquareArrowOutUpRight` |
| `SquareMousePointer` | `SquarePen` | `Sun` | `Table` |
| `TableColumnsSplit` | `Terminal` | `TextSelect` | `TowerControl` |
| `Trash` | `Trash2` | `TriangleAlert` | `Undo` |
| `Undo2` | `UnfoldVertical` | `Unlink` | `UserPlus` |
| `Workflow` | `Wrench` | `X` | `Zap` |
| `ZoomOut` |  |  |  |

</details>

```tsx
// Before
import { X, Check, Info, Plus } from 'lucide-react';
// After
import { X, Check, Info, Plus } from '@signozhq/icons';
```

---

## 4. Lucide React — 27 Renames Needed

| lucide-react | → | @signozhq/icons | Files |
|---|---|---|---|
| `AlertTriangle` | → | `TriangleAlert` | 2 |
| `ArrowDownCircle` | → | `CircleArrowDown` | 1 |
| `ArrowRightCircle` | → | `CircleArrowRight` | 1 |
| `ArrowUpRightFromSquare` | → | `SquareArrowOutUpRight` | 1 |
| `BarChart2` | → | `BarChart` | 8 |
| `CalendarIcon` | → | `Calendar` | 1 |
| `CheckCircle` | → | `CircleCheck` | 2 |
| `CheckCircle2` | → | `CircleCheckBig` | 1 |
| `CheckIcon` | → | `Check` | 2 |
| `DownloadIcon` | → | `Download` | 1 |
| `Edit` | → | `Pencil` | 1 |
| `Edit2` | → | `PenLine` | 1 |
| `Edit3Icon` | → | `PencilLine` | 1 |
| `EllipsisIcon` | → | `Ellipsis` | 1 |
| `FrownIcon` | → | `Frown` | 1 |
| `Grid` | → | `Grid2X2` | 1 |
| `HelpCircle` | → | `CircleHelp` | 1 |
| `InfoIcon` | → | `Info` | 3 |
| `LineChart` | → | `ChartLine` | 4 |
| `LinkIcon` | → | `Link` | 1 |
| `Loader2` | → | `LoaderCircle` | 4 |
| `MailIcon` | → | `Mail` | 1 |
| `PlusIcon` | → | `Plus` | 1 |
| `SettingsIcon` | → | `Settings` | 1 |
| `TriangleAlertIcon` | → | `TriangleAlert` | 1 |
| `UserIcon` | → | `User` | 1 |
| `XIcon` | → | `X` | 1 |

---

## 5. Icons With NO Equivalent — Keep as-is

These 5 icons have no suitable replacement in `@signozhq/icons` and should remain on their current library:

| Icon | Library | File(s) | Reason |
|---|---|---|---|
| `GoogleSquareFilled` | `@ant-design/icons` | `AuthnProviderSelector.tsx` | Google brand icon — no brand icons in @signozhq/icons |
| `ApiFilled` | `@ant-design/icons` | `renderConfig.tsx` | No API-specific icon equivalent |
| `Binoculars` | `lucide-react` | `GraphControlsPanel.tsx`, `LeftToolbarActions.tsx` | Not in @signozhq/icons |
| `Calendar1` | `lucide-react` | `EditCustomSchedule.tsx` | Numeric calendar variant not available |
| `DecimalsArrowRight` | `lucide-react` | `FunnelsList.tsx` | Custom/niche icon not in @signozhq/icons |

---

## 6. Lucide — `color` prop (already compatible)

`@signozhq/icons` icons accept a `color` prop (SVGProps) identical to lucide-react — **no changes needed** for existing color usage:

```tsx
// Works identically in both libraries
<Search size={12} color={Color.BG_VANILLA_400} />
<Info size={10} color={Color.BG_SIENNA_400} />
<Loader2 className="animate-spin" size={16} color={Color.BG_ROBIN_500} />
```

> **One dark-mode case:** `AlertPopover.tsx` and `TopContributorsCard.tsx` pass `color={isDarkMode ? Color.X : Color.Y}` — this pattern works identically with `@signozhq/icons`.
