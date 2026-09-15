#!/bin/zsh
set -euo pipefail

readonly ROOT="/Users/vsc_agent/projects/teduenglish"
readonly NODE_BIN="/Users/vsc_agent/.nvm/versions/node/v26.8.2/bin"
readonly HEALTH_URL="http://127.0.0.1:3214/version"

export HOME="/Users/vsc_agent"
export PATH="${NODE_BIN}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export CONVEX_AGENT_MODE="anonymous"
cd "$ROOT"

log() { print -r -- "$(date '+%Y-%m-%dT%H:%M:%S%z') $*"; }

healthy() {
  curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1
}

if healthy; then
  log "Convex already healthy on ${HEALTH_URL}; waiting to take over"
  while healthy; do
    sleep 10
  done
  log "existing Convex backend stopped"
fi

log "starting anonymous Convex backend"
exec npx convex dev
