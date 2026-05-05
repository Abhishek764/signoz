# Icon Migration Reference: `@ant-design/icons` → `@signozhq/icons`

This is the canonical reference for replacing Ant Design icons with `@signozhq/icons`.
Use this list when you encounter any `*Outlined`, `*Filled`, or `*TwoTone` icon name — those are always Ant Design icons.

> **How to identify AntD icons in code:** Every Ant Design icon ends in `Outlined`, `Filled`, or `TwoTone`.
> Even after migration the source of truth is the git diff — look at removed lines (`-`) with `from '@ant-design/icons'`.

---

## Complete AntD → `@signozhq/icons` Mapping

| `@ant-design/icons` | `@signozhq/icons` | Type | Notes |
|---|---|---|---|
| `AlertFilled` | `BellRing` | Lucide | |
| `AlertOutlined` | `Bell` | Lucide | |
| `AlignLeftOutlined` | `AlignLeft` | Lucide | |
| `AppstoreOutlined` | `Grid2X2` | Lucide | Old Lucide name was `grid`; renamed to `Grid2X2` |
| `ArrowDownOutlined` | `ArrowDown` | Lucide | |
| `ArrowLeftOutlined` | `ArrowLeft` | Lucide | |
| `ArrowRightOutlined` | `ArrowRight` | Lucide | |
| `ArrowUpOutlined` | `ArrowUp` | Lucide | |
| `BarChartOutlined` | `ChartBar` | Lucide | NOT `BarChart` — use `ChartBar` |
| `BellOutlined` | `Bell` | Lucide | |
| `CalendarOutlined` | `Calendar` | Lucide | |
| `CameraOutlined` | `Camera` | Lucide | |
| `CaretDownFilled` | `ChevronDown` | Lucide | |
| `CaretDownOutlined` | `ChevronDown` | Lucide | |
| `CaretRightFilled` | `ChevronRight` | Lucide | |
| `CheckCircleFilled` | `CircleCheck` | Lucide | Old Lucide name was `check-circle` |
| `CheckCircleOutlined` | `CircleCheck` | Lucide | Old Lucide name was `check-circle` |
| `CheckOutlined` | `Check` | Lucide | |
| `ClockCircleOutlined` | `Clock` | Lucide | |
| `CloseCircleFilled` | `CircleX` | Lucide | Old Lucide name was `x-circle` |
| `CloseCircleOutlined` | `CircleX` | Lucide | Old Lucide name was `x-circle` |
| `CloseOutlined` | `X` | Lucide | |
| `CloseSquareOutlined` | `SquareX` | Lucide | |
| `CloudDownloadOutlined` | `CloudDownload` | Lucide | |
| `CloudOutlined` | `Cloud` | Lucide | |
| `CloudUploadOutlined` | `CloudUpload` | Lucide | |
| `CopyOutlined` | `Copy` | Lucide | |
| `CreditCardOutlined` | `CreditCard` | Lucide | |
| `DashboardFilled` | `LayoutDashboard` | Lucide | |
| `DashboardOutlined` | `LayoutDashboard` | Lucide | |
| `DeleteFilled` | `Trash2` | Lucide | |
| `DeleteOutlined` | `Trash2` | Lucide | `trash` also works |
| `DisconnectOutlined` | `Unlink` | Lucide | |
| `DownOutlined` | `ChevronDown` | Lucide | |
| `DownloadOutlined` | `Download` | Lucide | |
| `EditFilled` | `Pencil` | Lucide | Old Lucide name was `edit`; renamed to `Pencil` |
| `EditOutlined` | `Pencil` | Lucide | Old Lucide name was `edit`; renamed to `Pencil` |
| `EllipsisOutlined` | `Ellipsis` | Lucide | Horizontal dots |
| `ExclamationCircleFilled` | `CircleAlert` | Lucide | Old Lucide name was `alert-circle` |
| `ExclamationCircleOutlined` | `CircleAlert` | Lucide | Old Lucide name was `alert-circle` |
| `ExclamationCircleTwoTone` | `CircleAlert` | Lucide | Drop `twoToneColor`; use `color` prop instead |
| `ExpandAltOutlined` | `Expand` | Lucide | |
| `EyeFilled` | `EyeOpen` | Custom | Custom icon in @signozhq/icons pack |
| `EyeOutlined` | `EyeOpen` | Custom | Custom icon in @signozhq/icons pack |
| `EyeInvisibleFilled` | `EyeClosed` | Custom | Custom icon in @signozhq/icons pack |
| `EyeInvisibleOutlined` | `EyeClosed` | Custom | Custom icon in @signozhq/icons pack |
| `FastBackwardOutlined` | `SkipBack` | Lucide | |
| `FileOutlined` | `File` | Lucide | |
| `FileSearchOutlined` | `FileSearch` | Lucide | |
| `FilterOutlined` | `Filter` | Lucide | |
| `FolderOpenOutlined` | `FolderOpen` | Lucide | |
| `FolderOutlined` | `Folder` | Lucide | |
| `FullscreenOutlined` | `Fullscreen` | Lucide | |
| `HeartOutlined` | `Heart` | Lucide | |
| `HolderOutlined` | `GripVertical` | Lucide | Drag handle |
| `InfoCircleOutlined` | `SolidInfoCircle` | Custom | Custom solid icon — NOT lucide `Info` |
| `KeyOutlined` | `Key` | Lucide | |
| `LeftOutlined` | `ChevronLeft` | Lucide | |
| `LinkOutlined` | `Link` | Lucide | |
| `LoadingOutlined` | `Loader` | Lucide | Add `className="animate-spin"` — see spinner note below |
| `LockOutlined` | `LockSolid` | Custom | Custom icon in @signozhq/icons pack |
| `MailOutlined` | `Mailbox` | Lucide | |
| `MenuOutlined` | `Menu` | Lucide | |
| `MessageOutlined` | `MessageSquare` | Lucide | |
| `MinusCircleFilled` | `CircleMinus` | Lucide | |
| `MinusCircleOutlined` | `CircleMinus` | Lucide | |
| `MinusOutlined` | `Minus` | Lucide | |
| `MinusSquareOutlined` | `SquareMinus` | Lucide | |
| `MoreOutlined` | `Ellipsis` | Lucide | Horizontal dots — NOT `EllipsisVertical` |
| `NotificationOutlined` | `BellRing` | Lucide | |
| `PauseCircleFilled` | `CirclePause` | Lucide | Old Lucide name was `pause-circle` |
| `PauseCircleOutlined` | `CirclePause` | Lucide | Old Lucide name was `pause-circle` |
| `PauseOutlined` | `Pause` | Lucide | |
| `PlayCircleFilled` | `CirclePlay` | Lucide | Old Lucide name was `play-circle` |
| `PlayCircleOutlined` | `CirclePlay` | Lucide | Old Lucide name was `play-circle` |
| `PlusCircleFilled` | `CirclePlus` | Lucide | |
| `PlusCircleOutlined` | `CirclePlus` | Lucide | |
| `PlusOutlined` | `Plus` | Lucide | |
| `PlusSquareOutlined` | `SquarePlus` | Lucide | |
| `QuestionCircleOutlined` | `CircleHelp` | Lucide | Old Lucide name was `help-circle` |
| `ReloadOutlined` | `RefreshCw` | Lucide | |
| `RightOutlined` | `ChevronRight` | Lucide | |
| `RocketOutlined` | `Rocket` | Lucide | |
| `SaveOutlined` | `Save` | Lucide | |
| `SearchOutlined` | `Search` | Lucide | |
| `SettingFilled` | `Settings` | Lucide | Both filled and outlined → same icon |
| `SettingOutlined` | `Settings` | Lucide | Both filled and outlined → same icon |
| `ShoppingCartOutlined` | `ShoppingCart` | Lucide | |
| `SoundFilled` | `Volume2` | Lucide | |
| `StarOutlined` | `Star` | Lucide | |
| `SyncOutlined` | `RefreshCw` | Lucide | |
| `TeamOutlined` | `UsersRound` | Lucide | |
| `UnlockOutlined` | `LockOpen` | Lucide | `LockSolidOpen` does not exist — use `LockOpen` |
| `UpOutlined` | `ChevronUp` | Lucide | |
| `UploadOutlined` | `Upload` | Lucide | |
| `UserOutlined` | `UserRound` | Lucide | |
| `VerticalAlignTopOutlined` | `ArrowUpToLine` | Lucide | Scroll-to-top |
| `VideoCameraOutlined` | `Video` | Lucide | |
| `WarningFilled` | `SolidAlertTriangle` | Custom | Custom solid icon — NOT lucide `TriangleAlert` |
| `WarningOutlined` | `SolidAlertTriangle` | Custom | Custom solid icon — NOT lucide `TriangleAlert` |

---

## Icons with NO `@signozhq/icons` Equivalent — Keep as-is

| `@ant-design/icons` | File(s) | Reason |
|---|---|---|
| `ApiFilled` | `renderConfig.tsx` | No equivalent in `@signozhq/icons` |
| `GoogleSquareFilled` | `AuthnProviderSelector.tsx` | Brand icon — no brand icons in `@signozhq/icons` |

---

## Lucide-React Naming Differences

`@signozhq/icons` is built on Lucide but uses **newer Lucide names**. The reference list above uses some old Lucide kebab-case names that have since been renamed. This table covers the gaps:

| Old `lucide-react` name | `@signozhq/icons` name | Notes |
|---|---|---|
| `alert-circle` / `AlertCircle` | `CircleAlert` | Lucide moved shape qualifier to front |
| `alert-triangle` / `AlertTriangle` | `TriangleAlert` | Lucide renamed |
| `BarChart2` | `BarChart` | Numbered variant removed |
| `BarChart3` | `BarChart` | Numbered variant removed |
| `check-circle` / `CheckCircle` | `CircleCheck` | Lucide moved shape qualifier to front |
| `CheckCircle2` | `CircleCheckBig` | |
| `CheckIcon` | `Check` | Icon suffix removed |
| `DownloadIcon` | `Download` | Icon suffix removed |
| `Edit` / `Edit2` | `PenLine` or `Pencil` | Lucide renamed `edit` → `Pencil` |
| `Edit3Icon` | `PencilLine` | |
| `EllipsisIcon` | `Ellipsis` | Icon suffix removed |
| `FrownIcon` | `Frown` | Icon suffix removed |
| `Grid` | `Grid2X2` | Renamed in Lucide |
| `help-circle` / `HelpCircle` | `CircleHelp` | Lucide moved shape qualifier to front |
| `InfoIcon` | `Info` | Icon suffix removed |
| `LineChart` | `ChartLine` | Renamed in Lucide |
| `LinkIcon` | `Link` | Icon suffix removed |
| `Loader2` | `LoaderCircle` | Renamed — circular spinner |
| `MailIcon` | `Mail` | Icon suffix removed |
| `pause-circle` / `PauseCircle` | `CirclePause` | Lucide moved shape qualifier to front |
| `play-circle` / `PlayCircle` | `CirclePlay` | Lucide moved shape qualifier to front |
| `PlusIcon` | `Plus` | Icon suffix removed |
| `SettingsIcon` | `Settings` | Icon suffix removed |
| `TriangleAlertIcon` | `TriangleAlert` | Icon suffix removed |
| `UserIcon` | `User` | Icon suffix removed |
| `x-circle` / `XCircle` | `CircleX` | Lucide moved shape qualifier to front |
| `XIcon` | `X` | Icon suffix removed |

### Icons with NO equivalent in `@signozhq/icons` — keep from `lucide-react`

| `lucide-react` | File(s) | Notes |
|---|---|---|
| `Binoculars` | `GraphControlsPanel.tsx`, `LeftToolbarActions.tsx` | Not in @signozhq/icons |
| `Calendar1` | `EditCustomSchedule.tsx` | Numeric variant not available |
| `DecimalsArrowRight` | `FunnelsList.tsx` | Niche icon not in @signozhq/icons |

---

## Patterns & Tips

### How to identify which library an icon came from

Since all icons now import from `@signozhq/icons`, use `git diff` to trace origins:

```bash
# Find files where a specific antd icon was replaced
git diff main...HEAD -- '*.tsx' '*.ts' | awk '
  /^diff --git/ { file = $3; sub(/^a\//, "", file) }
  /^-.*InfoCircleOutlined/ { print file }
' | sort -u
```

Removed lines (`-`) from `@ant-design/icons` = antd-originated.
Removed lines (`-`) from `lucide-react` = lucide-originated.

---

### Spinner pattern (`LoadingOutlined`)

```tsx
// Before
<Spin indicator={<LoadingOutlined size={14} spin />} />

// After
<Spin indicator={<Loader size={14} className="animate-spin" />} />
```

> `Loader` ≠ `LoaderCircle`. Use `Loader` for antd `LoadingOutlined` replacements.
> Use `LoaderCircle` only when migrating lucide-react's `Loader2`.

---

### `twoToneColor` → `color`

`@signozhq/icons` has no two-tone support. Drop `twoToneColor` and use `color`:

```tsx
// Before
<CheckCircleTwoTone twoToneColor="#52c41a" />

// After
<CircleCheck color="#52c41a" />
```

---

### `style={{ fontSize }}` sizing

`@signozhq/icons` accepts a `size` prop. Both work, but `size` is preferred:

```tsx
// Works but not preferred
<Key style={{ fontSize: '37px' }} />

// Preferred
<Key size={37} />
```

---

### Filled vs Outlined collapse

`@signozhq/icons` has one canonical form — no Filled/Outlined split:

```tsx
// Both map to the same icon
DeleteOutlined → Trash2
DeleteFilled   → Trash2

SettingOutlined → Settings
SettingFilled   → Settings
```

---

### `Filter` name conflict

When `Filter` conflicts with a TypeScript type named `Filter`, use an alias:

```tsx
import { Filter as FilterIcon } from '@signozhq/icons';
```

---

### `rotate` prop

`@signozhq/icons` passes SVG props through, so `rotate` works directly:

```tsx
// RocketOutlined rotate={45} →
<Rocket rotate={45} />
```

---

## Import style

```tsx
// Before (antd)
import { SearchOutlined, PlusOutlined, LoadingOutlined, InfoCircleOutlined } from '@ant-design/icons';

// After (@signozhq/icons)
import { Search, Plus, Loader, SolidInfoCircle } from '@signozhq/icons';
```
