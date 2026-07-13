#!/usr/bin/env bash
# The M-G separation gate: the inside (default) build graph must not contain
# the hardware crate at all; the open graph must. "Not present" is the claim,
# not "disabled" - cargo tree sees the whole dependency graph.
set -euo pipefail
cd "$(dirname "$0")/.."

if CARGO_NET_OFFLINE=true cargo tree -p thunk-cli --edges normal | grep -q "thunk-hw"; then
    echo "profile-audit: FAIL - the inside graph contains thunk-hw" >&2
    exit 1
fi
if ! CARGO_NET_OFFLINE=true cargo tree -p thunk-cli --features open --edges normal | grep -q "thunk-hw"; then
    echo "profile-audit: FAIL - the open graph is missing thunk-hw" >&2
    exit 1
fi
echo "profile-audit: clean"
