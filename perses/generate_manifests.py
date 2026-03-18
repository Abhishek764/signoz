#!/usr/bin/env python3
"""
Generates package.json and mf-manifest.json for a Perses plugin module
by reading the kind: "..." declarations from your CUE schema files,
then builds the archive ready to mount into Perses.

Usage (run from the root of your plugin folder, where schemas/ lives):
  python3 generate_manifests.py --org signoz --name signoz --version 0.0.1
"""

import os
import re
import json
import tarfile
import argparse

# Maps keywords in schema folder names to Perses plugin kinds.
# Add more here if you introduce new plugin types.
KIND_HINTS = {
    "datasource":  "Datasource",
    "variable":    "Variable",
    "promql":      "TimeSeriesQuery",
    "formula":     "TimeSeriesQuery",
    "join":        "TimeSeriesQuery",
    "sql":         "TimeSeriesQuery",
    "composite":   "TimeSeriesQuery",
    "builder":     "TimeSeriesQuery",
    "query":       "TimeSeriesQuery",
    "panel":       "Panel",
    "trace":       "TraceQuery",
    "log":         "LogQuery",
    "profile":     "ProfileQuery",
}

def infer_kind(folder_name):
    lower = folder_name.lower()
    for hint, kind in KIND_HINTS.items():
        if hint in lower:
            return kind
    return None

def extract_kind_from_cue(cue_file):
    """Extract kind: "PluginName" from a CUE file."""
    with open(cue_file) as f:
        content = f.read()
    match = re.search(r'^\s*kind:\s*"([^"]+)"', content, re.MULTILINE)
    return match.group(1) if match else None

def to_display_name(name):
    """Convert CamelCase to 'Camel Case'."""
    return re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', name)

def main():
    parser = argparse.ArgumentParser(description="Generate Perses plugin manifests from CUE files and build archive.")
    parser.add_argument("--org",         required=True,    help="Your org name, e.g. signoz")
    parser.add_argument("--name",        required=True,    help="Plugin module name, e.g. signoz")
    parser.add_argument("--version",     default="0.0.1",  help="Plugin version, e.g. 0.0.1")
    parser.add_argument("--schemas-dir", default="schemas", help="Path to schemas directory (default: schemas)")
    args = parser.parse_args()

    schemas_dir = args.schemas_dir
    if not os.path.isdir(schemas_dir):
        print(f"Error: schemas directory '{schemas_dir}' not found. Run this script from your plugin root folder.")
        exit(1)

    plugins = []
    for folder in sorted(os.listdir(schemas_dir)):
        folder_path = os.path.join(schemas_dir, folder)
        if not os.path.isdir(folder_path):
            continue

        plugin_kind_name = None
        cue_file = os.path.join(folder_path, f"{folder}.cue")
        if os.path.isfile(cue_file):
            plugin_kind_name = extract_kind_from_cue(cue_file)

        perses_kind = infer_kind(folder)

        if not plugin_kind_name:
            print(f"Warning: could not extract kind from '{cue_file}', skipping.")
            continue
        if not perses_kind:
            print(f"Warning: could not infer Perses kind for folder '{folder}', skipping. Add a hint to KIND_HINTS.")
            continue

        plugins.append({
            "kind": perses_kind,
            "spec": {
                "display": {"name": to_display_name(plugin_kind_name)},
                "name": plugin_kind_name
            }
        })
        print(f"Found: {plugin_kind_name} -> {perses_kind}")

    if not plugins:
        print("No plugins found. Check that your schemas directory contains CUE files with kind: declarations.")
        exit(1)

    # Generate mf-manifest.json
    manifest = {
        "id": args.name,
        "name": args.name,
        "metaData": {
            "buildInfo": {
                "buildVersion": args.version
            }
        },
        "plugins": [
            {"kind": p["kind"], "name": p["spec"]["name"]}
            for p in plugins
        ]
    }

    # Generate package.json
    package = {
        "name": f"@{args.org}/{args.name}",
        "version": args.version,
        "description": f"{args.name} plugin module for Perses",
        "perses": {
            "schemasPath": "schemas",
            "plugins": plugins
        }
    }

    with open("mf-manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)
    print("\nWrote mf-manifest.json")

    with open("package.json", "w") as f:
        json.dump(package, f, indent=2)
    print("Wrote package.json")

    # Build the archive
    archive_name = f"{args.name}-{args.version}.tar.gz"
    with tarfile.open(archive_name, "w:gz") as tar:
        tar.add("package.json")
        tar.add("mf-manifest.json")
        if os.path.isdir("schemas"):
            tar.add("schemas")
        if os.path.isdir("cue.mod"):
            tar.add("cue.mod")

    print(f"Wrote {archive_name}")
    print(f"\nDone! {len(plugins)} plugin(s) packaged:")
    for p in plugins:
        print(f"  - {p['spec']['name']} ({p['kind']})")

if __name__ == "__main__":
    main()