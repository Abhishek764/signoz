# Icon Migration Reference: `@ant-design/icons` & `lucide-react` → `@signozhq/icons`

This document covers all icon name changes made (or to be aware of) when migrating from `@ant-design/icons` and `lucide-react` to `@signozhq/icons`.

---

## 1. `@ant-design/icons` → `@signozhq/icons`

All of these were replaced in `chore: replace antd icons with signoz icons`.

| `@ant-design/icons` | `@signozhq/icons` | Notes |
|---|---|---|
| `AlertFilled` | `BellRing` | |
| `AlertOutlined` | `Bell` | |
| `AlignLeftOutlined` | `AlignLeft` | |
| `ArrowLeftOutlined` | `ArrowLeft` | |
| `ArrowRightOutlined` | `ArrowRight` | |
| `ArrowUpOutlined` | `ArrowUp` | |
| `BarChartOutlined` | `ChartBar` | Note: NOT `BarChart` — use `ChartBar` |
| `CaretDownFilled` | `ChevronDown` | |
| `CaretDownOutlined` | `ChevronDown` | |
| `CaretRightFilled` | `ChevronRight` | |
| `CheckCircleFilled` | `CircleCheck` | |
| `CheckCircleOutlined` | `CircleCheck` | |
| `CheckOutlined` | `Check` | |
| `CloseCircleFilled` | `CircleX` | |
| `CloseCircleOutlined` | `CircleX` | |
| `CloseOutlined` | `X` | |
| `CloseSquareOutlined` | `SquareX` | |
| `CloudDownloadOutlined` | `CloudDownload` | |
| `CopyOutlined` | `Copy` | |
| `DashboardFilled` | `LayoutDashboard` | |
| `DeleteFilled` | `Trash2` | |
| `DeleteOutlined` | `Trash2` | |
| `DownOutlined` | `ChevronDown` | |
| `EditFilled` | `Pencil` | |
| `EditOutlined` | `Pencil` | |
| `EllipsisOutlined` | `Ellipsis` | Horizontal "more" |
| `ExclamationCircleFilled` | `CircleAlert` | |
| `ExclamationCircleOutlined` | `CircleAlert` | |
| `ExclamationCircleTwoTone` | `CircleAlert` | |
| `ExpandAltOutlined` | `Expand` | |
| `EyeFilled` | `Eye` | |
| `EyeInvisibleFilled` | `EyeOff` | |
| `FastBackwardOutlined` | `SkipBack` | |
| `FileSearchOutlined` | `FileSearch` | |
| `FilterOutlined` | `Filter` | |
| `FullscreenOutlined` | `Fullscreen` | |
| `HolderOutlined` | `GripVertical` | Drag handle |
| `InfoCircleOutlined` | `Info` | |
| `KeyOutlined` | `Key` | |
| `LeftOutlined` | `ChevronLeft` | |
| `LinkOutlined` | `Link` | |
| `LoadingOutlined` | `LoaderCircle` | Add `className="animate-spin"` for spin effect (see note below) |
| `MinusCircleFilled` | `CircleMinus` | |
| `MinusCircleOutlined` | `CircleMinus` | |
| `MinusSquareOutlined` | `SquareMinus` | |
| `MoreOutlined` | `EllipsisVertical` | Vertical "more" |
| `PauseCircleFilled` | `CirclePause` | |
| `PauseOutlined` | `Pause` | |
| `PlayCircleFilled` | `CirclePlay` | |
| `PlayCircleOutlined` | `Play` | |
| `PlusCircleFilled` | `CirclePlus` | |
| `PlusCircleOutlined` | `CirclePlus` | |
| `PlusOutlined` | `Plus` | |
| `PlusSquareOutlined` | `SquarePlus` | |
| `RightOutlined` | `ChevronRight` | |
| `RocketOutlined` | `Rocket` | |
| `SaveOutlined` | `Save` | |
| `SearchOutlined` | `Search` | |
| `SettingFilled` | `Settings` | |
| `SettingOutlined` | `Settings` | |
| `SoundFilled` | `Volume2` | |
| `SyncOutlined` | `RefreshCw` | |
| `VerticalAlignTopOutlined` | `ArrowUpToLine` | Scroll-to-top |
| `WarningFilled` | `TriangleAlert` | |
| `WarningOutlined` | `TriangleAlert` | |

### Icons kept in `@ant-design/icons` (no `@signozhq/icons` equivalent yet)

| `@ant-design/icons` | Reason kept |
|---|---|
| `ApiFilled` | No equivalent in `@signozhq/icons` |
| `GoogleSquareFilled` | Brand/OAuth icon — intentionally kept |

---

## 2. `lucide-react` → `@signozhq/icons` — Naming Differences to Watch For

`lucide-react` icons were **not replaced** in this PR, but `@signozhq/icons` is built on a subset of Lucide. Some icon names differ or simply do not exist. Use this as a reference when migrating `lucide-react` icons in the future.

| `lucide-react` | `@signozhq/icons` | Status |
|---|---|---|
| `Loader2` | `LoaderCircle` | Renamed — use `LoaderCircle` |
| `BarChart3` | `BarChart` | `BarChart3` does not exist — use `BarChart` |
| `BarChart2` | `BarChart` | `BarChart2` does not exist — use `BarChart` |
| `Edit2` | `PenLine` | `Edit2` does not exist — use `PenLine` (or `Pencil`) |
| `Binoculars` | _(none)_ | Does not exist in `@signozhq/icons` — keep from `lucide-react` |

> **Rule of thumb:** If a numbered variant like `BarChart2`, `BarChart3`, or `Edit2` doesn't exist, try the base name (`BarChart`, `PenLine`, `Pencil`) first. If none exist, keep the `lucide-react` import.

---

## 3. New Icons Added (no direct antd equivalent)

These icons were added fresh from `@signozhq/icons` as part of this migration (they did not replace a specific antd icon 1:1):

| `@signozhq/icons` | Context |
|---|---|
| `CircleArrowLeft` | Module navigation (back arrow in circle) |
| `CircleHelp` | Tooltip help icon (previously `InfoCircleOutlined` in some places) |
| `Share2` | Share URL / copy link action |

---

## 4. Patterns & Tips

### Loading spinner pattern

`LoadingOutlined` with antd's `spin` prop → `LoaderCircle` with a Tailwind class:

```tsx
// Before
<Spin indicator={<LoadingOutlined size={14} spin />} />

// After
<Spin indicator={<LoaderCircle size={14} className="animate-spin" />} />
```

### Filled vs Outlined

`@signozhq/icons` does not distinguish "Filled" vs "Outlined" in most names — there is generally one canonical version:

- `DeleteOutlined` and `DeleteFilled` → both become `Trash2`
- `SettingOutlined` and `SettingFilled` → both become `Settings`
- `EditFilled` and `EditOutlined` → both become `Pencil`

### Filter icon alias

When `Filter` conflicts with a TypeScript type called `Filter`, import with an alias:

```tsx
import { Filter as FilterIcon } from '@signozhq/icons';
```

### Icon that changes meaning by direction

Icons with `rotate` props are preserved:

```tsx
// RocketOutlined rotate={45} → Rocket rotate={45}
icon: <Rocket rotate={45} />
```

---

## 5. Import style

```tsx
// Old
import { SearchOutlined, PlusOutlined, LoadingOutlined } from '@ant-design/icons';

// New
import { Search, Plus, LoaderCircle } from '@signozhq/icons';
```
