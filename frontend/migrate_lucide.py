#!/usr/bin/env python3
"""
Migrate lucide-react icons to @signozhq/icons.

Strategy:
- When there is NO existing @signozhq/icons import:
    Replace the lucide import IN-PLACE with the @signozhq/icons import.
    If some tokens must stay in lucide (no equivalent), keep them in a
    lucide import right after the new @signozhq/icons line.

- When there IS an existing @signozhq/icons import already in the file:
    Merge the new icons into that import (keeping it in its original position).
    Remove / shrink the lucide import in-place (keep only no-equivalent tokens).

Regenerate iconlist.json with:
    python3 -c "
    import json
    with open('node_modules/@signozhq/icons/package.json') as f:
        pkg = json.load(f)
    icons = sorted(k.replace('./', '') for k in pkg.get('exports', {}) if k != '.')
    open('iconlist.json', 'w').write(json.dumps(icons, indent=2))
    "
"""

import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Mappings
# ---------------------------------------------------------------------------
RENAME_MAP: dict[str, str] = {
    'AlertCircle':            'CircleAlert',
    'AlertTriangle':          'TriangleAlert',
    'ArrowDownCircle':        'CircleArrowDown',
    'ArrowRightCircle':       'CircleArrowRight',
    'ArrowUpRightFromSquare': 'SquareArrowOutUpRight',
    'BarChart2':              'BarChart',
    'BarChart3':              'ChartBar',
    'BarChartHorizontal':     'ChartBar',
    'BetweenHorizonalStart':  'BetweenHorizontalStart',
    'BugIcon':                'Bug',
    'CalendarIcon':           'Calendar',
    'CheckCircle':            'CircleCheck',
    'CheckCircle2':           'CircleCheckBig',
    'CheckIcon':              'Check',
    'CompassIcon':            'Compass',
    'DownloadIcon':           'Download',
    'Edit':                   'Pencil',
    'Edit2':                  'PenLine',
    'Edit3Icon':              'PencilLine',
    'EllipsisIcon':           'Ellipsis',
    'FrownIcon':              'Frown',
    'Grid':                   'Grid2X2',
    'HelpCircle':             'CircleHelp',
    'InfoIcon':               'Info',
    'LineChart':              'ChartLine',
    'LinkIcon':               'Link',
    'Loader2':                'LoaderCircle',
    'MailIcon':               'Mail',
    'PieChart':               'ChartPie',
    'PlusCircle':             'CirclePlus',
    'PlusIcon':               'Plus',
    'SettingsIcon':           'Settings',
    'SigmaSquare':            'SquareSigma',
    'Sliders':                'SlidersHorizontal',
    'TriangleAlertIcon':      'TriangleAlert',
    'UserIcon':               'User',
    'XIcon':                  'X',
}

# Icons with no @signozhq/icons equivalent — keep in lucide import
NO_EQUIVALENT: set[str] = {'Binoculars', 'Calendar1', 'DecimalsArrowRight'}

# ---------------------------------------------------------------------------
# Load & validate iconlist
# ---------------------------------------------------------------------------
_ICONLIST = Path('iconlist.json')
if not _ICONLIST.exists():
    print('ERROR: iconlist.json not found.', file=sys.stderr)
    sys.exit(1)

AVAILABLE: set[str] = set(json.loads(_ICONLIST.read_text()))

_bad = {s: t for s, t in RENAME_MAP.items() if t not in AVAILABLE}
if _bad:
    print('ERROR: RENAME_MAP has targets not in iconlist.json:', file=sys.stderr)
    for s, t in sorted(_bad.items()):
        print(f'  {s!r} -> {t!r}', file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Regex
# ---------------------------------------------------------------------------
LUCIDE_RE = re.compile(
    r'import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*[\'"]lucide-react[\'"];?\n?',
    re.DOTALL,
)
SIGNOZ_RE = re.compile(
    r'import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*[\'"]@signozhq/icons[\'"];?\n?',
    re.DOTALL,
)


def parse_tokens(raw: str) -> list[str]:
    return [t.strip() for t in raw.split(',') if t.strip()]


def base(token: str) -> str:
    """'Foo as Bar' -> 'Foo'"""
    return token.split()[0]


def fmt(names: list[str], pkg: str) -> str:
    return f"import {{ {', '.join(sorted(names, key=str.lower))} }} from '{pkg}';\n"


# ---------------------------------------------------------------------------
# Per-file migration
# ---------------------------------------------------------------------------
def migrate_file(filepath: Path, dry_run: bool = False) -> tuple[bool, list[str], list[str]]:
    content = filepath.read_text()
    original = content

    lucide_matches = list(LUCIDE_RE.finditer(content))
    if not lucide_matches:
        return False, [], []

    # Collect all tokens from all lucide import statements
    all_tokens: list[str] = []
    for m in lucide_matches:
        all_tokens.extend(parse_tokens(m.group(1)))

    # Categorise
    to_signoz: dict[str, str] = {}   # original_name -> signoz_name
    keep_lucide: list[str] = []      # tokens to keep in lucide
    notes: list[str] = []

    for token in all_tokens:
        name = base(token)
        if name in NO_EQUIVALENT:
            keep_lucide.append(token)
        elif name in RENAME_MAP:
            to_signoz[name] = RENAME_MAP[name]
        elif name in AVAILABLE:
            to_signoz[name] = name          # direct match, same name
        else:
            keep_lucide.append(token)       # type export / unknown
            notes.append(f"Kept in lucide (no equivalent / non-icon): {name}")

    if not to_signoz:
        return False, [], notes

    # --- Step 1: rename usages in body (longest first to avoid partial hits) ---
    for old_name in sorted(to_signoz.keys(), key=len, reverse=True):
        new_name = to_signoz[old_name]
        if old_name != new_name:
            content = re.sub(r'\b' + re.escape(old_name) + r'\b', new_name, content)

    # Re-search after renames: the rename step mutates import lines (e.g. BarChart2
    # becomes BarChart inside the lucide import), so saved match positions are stale.
    lucide_matches = list(LUCIDE_RE.finditer(content))

    # --- Step 2: decide where the signozhq import lives ---
    existing_signoz = SIGNOZ_RE.search(content)

    new_signoz_names: list[str] = sorted(set(to_signoz.values()), key=str.lower)

    if existing_signoz:
        # Merge into the existing @signozhq/icons import (keep it in place)
        current_names = [base(t) for t in parse_tokens(existing_signoz.group(1))]
        merged = sorted(set(current_names) | set(new_signoz_names), key=str.lower)
        content = SIGNOZ_RE.sub(fmt(merged, '@signozhq/icons'), content, count=1)

        # Shrink or remove each lucide import
        if keep_lucide:
            # Replace the first lucide import with kept-only tokens, remove the rest
            lucide_matches = list(LUCIDE_RE.finditer(content))
            if lucide_matches:
                first = lucide_matches[0]
                content = content[:first.start()] + fmt(keep_lucide, 'lucide-react') + content[first.end():]
                content = LUCIDE_RE.sub('', content)
        else:
            content = LUCIDE_RE.sub('', content)

    else:
        # No existing @signozhq/icons import — replace the first lucide import IN-PLACE.
        first = lucide_matches[0]

        if keep_lucide:
            replacement = fmt(new_signoz_names, '@signozhq/icons') + fmt(keep_lucide, 'lucide-react')
        else:
            replacement = fmt(new_signoz_names, '@signozhq/icons')

        content = content[:first.start()] + replacement + content[first.end():]

        # Remove only the remaining (extra) lucide imports beyond the first — do NOT
        # use a blanket LUCIDE_RE.sub here as that would also remove the kept-lucide
        # import we just inserted above.
        remaining = list(LUCIDE_RE.finditer(content))
        # The replacement may have introduced a kept-lucide import at first.start();
        # skip any match that overlaps the insertion point.
        insert_end = first.start() + len(replacement)
        for m in reversed(remaining):
            if m.start() < insert_end:
                continue  # part of our replacement — leave it alone
            content = content[:m.start()] + content[m.end():]

    if content == original:
        return False, [], notes

    if not dry_run:
        filepath.write_text(content)

    migrated = sorted(to_signoz.keys())
    return True, migrated, notes


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    dry_run = '--dry-run' in sys.argv
    src = Path('src')
    files = sorted(src.rglob('*.tsx')) + sorted(src.rglob('*.ts'))

    total = 0
    all_icons: set[str] = set()
    results = []

    for fp in files:
        changed, icons, notes = migrate_file(fp, dry_run=dry_run)
        if changed or notes:
            results.append((fp, changed, icons, notes))
        if changed:
            total += 1
            all_icons.update(icons)

    prefix = '[DRY RUN] ' if dry_run else ''
    print(f'{prefix}Files changed: {total}')
    print(f'{prefix}Unique lucide icons migrated: {len(all_icons)}')
    print()
    for fp, changed, icons, notes in results:
        status = 'CHANGED' if changed else 'NOTED'
        print(f'[{status}] {fp}')
        if icons:
            print(f'         Icons: {icons}')
        for note in notes:
            print(f'         NOTE: {note}')


if __name__ == '__main__':
    main()
