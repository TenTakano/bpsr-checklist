#!/usr/bin/env bash
# Prints the task-level diff between two upstreamTasks.json files, keyed by upstream id:
#   {"added": [...], "removed": [...], "changed": [{"id", "before", "after"}]}
# Usage: scripts/diff-upstream-tasks.sh <before.json> <after.json>
set -euo pipefail
jq -n --slurpfile b "$1" --slurpfile a "$2" '
  def index(doc): [doc.daily[], doc.weekly[]] | map({key: .id, value: .}) | from_entries;
  index($b[0]) as $B | index($a[0]) as $A |
  {
    added: [$A | keys[] | select($B[.] == null) | $A[.]],
    removed: [$B | keys[] | select($A[.] == null) | $B[.]],
    changed: [$A | keys[] | select($B[.] != null and $B[.] != $A[.]) | {id: ., before: $B[.], after: $A[.]}]
  }'
