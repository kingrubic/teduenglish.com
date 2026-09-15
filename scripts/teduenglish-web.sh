#!/bin/zsh
set -euo pipefail

readonly ROOT="/Users/vsc_agent/projects/teduenglish"
readonly NODE_BIN="/Users/vsc_agent/.nvm/versions/node/v26.8.2/bin"
readonly CONVEX_URL="http://127.0.0.1:3214/version"
readonly HEALTH_URL="http://[::1]:4173/api/health"
readonly WAIT_SEC=180

export HOME="/Users/vsc_agent"
export PATH="${NODE_BIN}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$ROOT"

log() { print -r -- "$(date '+%Y-%m-%dT%H:%M:%S%z') $*"; }

convex_ready() {
  curl -fsS --max-time 2 "$CONVEX_URL" >/dev/null 2>&1
}

web_healthy() {
  curl -fsS --max-time 2 "$HEALTH_URL" 2>/dev/null | grep -q '"backend":"convex"'
}

elapsed=0
until convex_ready; do
  if (( elapsed >= WAIT_SEC )); then
    log "ERROR: Convex backend not ready on ${CONVEX_URL} after ${WAIT_SEC}s"
    exit 1
  fi
  sleep 2
  (( elapsed += 2 ))
done

if web_healthy; then
  log "Next.js already healthy on ${HEALTH_URL}; waiting to take over"
  while web_healthy; do
    sleep 10
  done
  log "existing Next.js process stopped"
fi

log "starting Next.js on port 4173"
exec npm run dev
