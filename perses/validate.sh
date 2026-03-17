#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

percli lint -f "$SCRIPT_DIR/examples/redis-overview-perses.json" --plugin.path "$SCRIPT_DIR" --log.level fatal

# percli lint auto-generates this file as a side effect; clean it up.
rm -f "$SCRIPT_DIR/plugin-modules.json"
