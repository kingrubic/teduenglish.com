#!/bin/zsh
set -euo pipefail

readonly ROOT="/Users/vsc_agent/projects/teduenglish"
readonly AGENTS="${HOME}/Library/LaunchAgents"
readonly DOMAIN="gui/$(id -u)"
readonly LABEL="ai.teduenglish.web"

chmod +x "${ROOT}/scripts/teduenglish-web.sh" "${ROOT}/scripts/install-autostart.sh"
mkdir -p "${HOME}/ops/logs" "$AGENTS"

# The site used to run a local Convex backend; it now uses Convex Cloud.
if launchctl print "${DOMAIN}/ai.teduenglish.convex" >/dev/null 2>&1; then
  launchctl bootout "${DOMAIN}/ai.teduenglish.convex" || true
fi
[[ -f "${AGENTS}/ai.teduenglish.convex.plist" ]] && mv "${AGENTS}/ai.teduenglish.convex.plist" "${AGENTS}/ai.teduenglish.convex.plist.disabled"

src="${ROOT}/ops/launchd/${LABEL}.plist"
dst="${AGENTS}/${LABEL}.plist"
/usr/bin/plutil -lint "$src"
/bin/cp "$src" "$dst"
launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$dst"
launchctl enable "${DOMAIN}/${LABEL}"
launchctl kickstart -k "${DOMAIN}/${LABEL}"
print -r -- "loaded ${LABEL}"
