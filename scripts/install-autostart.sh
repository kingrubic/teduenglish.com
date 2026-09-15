#!/bin/zsh
set -euo pipefail

readonly ROOT="/Users/vsc_agent/projects/teduenglish"
readonly AGENTS="${HOME}/Library/LaunchAgents"
readonly UID_NUM="$(id -u)"
readonly DOMAIN="gui/${UID_NUM}"

chmod +x \
  "${ROOT}/scripts/teduenglish-convex.sh" \
  "${ROOT}/scripts/teduenglish-web.sh" \
  "${ROOT}/scripts/install-autostart.sh"

mkdir -p "${HOME}/.openclaw/logs" "$AGENTS"

for label in ai.teduenglish.convex ai.teduenglish.web; do
  src="${ROOT}/ops/launchd/${label}.plist"
  dst="${AGENTS}/${label}.plist"
  /usr/bin/plutil -lint "$src"
  /bin/cp "$src" "$dst"
  launchctl bootout "${DOMAIN}/${label}" 2>/dev/null || true
  launchctl bootstrap "$DOMAIN" "$dst"
  launchctl enable "${DOMAIN}/${label}"
  launchctl kickstart -k "${DOMAIN}/${label}"
  print -r -- "loaded ${label}"
done
