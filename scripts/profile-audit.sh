#!/usr/bin/env bash
# The M-G separation gate: the inside (default) build graph must not contain
# the hardware crate at all; the open graph must. "Not present" is the claim,
# not "disabled" - cargo tree sees the whole dependency graph.
#
# Capture first, then grep: inside an `if cmd | grep` condition, set -e cannot
# catch a cargo failure, and the wrong assertion would report. The match pins
# cargo tree's "name version" format so a look-alike crate name cannot pass.
set -euo pipefail
cd "$(dirname "$0")/.."

# Offline by default (the local sandbox has no network); CI overrides with
# CARGO_NET_OFFLINE=false because a fresh runner has no registry index yet.
: "${CARGO_NET_OFFLINE:=true}"
export CARGO_NET_OFFLINE

inside="$(cargo tree -p thunk-cli --edges normal --locked)"
open="$(cargo tree -p thunk-cli --features open --edges normal --locked)"

if grep -qE 'thunk-hw v[0-9]' <<<"$inside"; then
    echo "profile-audit: FAIL - the inside graph contains thunk-hw" >&2
    exit 1
fi
if ! grep -qE 'thunk-hw v[0-9]' <<<"$open"; then
    echo "profile-audit: FAIL - the open graph is missing thunk-hw" >&2
    exit 1
fi
echo "profile-audit: clean"
