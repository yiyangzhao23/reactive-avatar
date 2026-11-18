#!/usr/bin/env bash
# Fast syntax/static gate (<1s). Run after every change.
# Usage: ./scripts/check.sh [--full]
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v node >/dev/null 2>&1; then
  NODE=node
elif [ -x "$HOME/.local/node/bin/node" ]; then
  NODE="$HOME/.local/node/bin/node"
else
  echo "error: node not found (add ~/.local/node/bin to PATH)" >&2
  exit 1
fi

files=(
  avatar-live/src/*.js
  avatar-live/build.js
  avatar-live/split-model.js
  avatar-live/functions/llm.js
  avatar-live/sw.js
)

for f in "${files[@]}"; do
  "$NODE" --check "$f"
done

python3 -c "import ast; ast.parse(open('avatar-live/server.py').read())"

grep -q 'src="./src/main.js' avatar-live/index.html

if [ -f avatar-live/model-parts/manifest.json ]; then
  python3 -c "import json; json.load(open('avatar-live/model-parts/manifest.json'))"
fi

if [ "${1:-}" = "--full" ]; then
  ( cd avatar-live && "$NODE" build.js >/dev/null )
fi

echo "ok: syntax/static checks${1:+ (${1})}"
