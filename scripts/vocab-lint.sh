#!/usr/bin/env bash
# vocab-lint: keep the course reading as engineering, not hacking.
# Rejects exploitation vocabulary anywhere in content or source. Runs in CI and
# is the kind of check a facility reviewer can read in ten seconds and trust.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DENY='exploit|malware|keylogger|backdoor|rootkit|botnet|ransomware|\bddos\b'

# Scan course-facing material (content + source), not internal planning docs,
# which legitimately describe the vocabulary this lint keeps out.
hits="$(grep -rIniE "$DENY" "$ROOT" \
    --include='*.md' --include='*.rs' --include='*.ron' \
    --exclude-dir=target --exclude-dir=.git --exclude-dir=docs \
    --exclude-dir=node_modules 2>/dev/null || true)"

if [ -n "$hits" ]; then
    echo "vocab-lint: exploitation vocabulary found; keep the language course-appropriate:"
    echo "$hits"
    exit 1
fi

echo "vocab-lint: clean"
