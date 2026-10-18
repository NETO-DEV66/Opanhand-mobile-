#!/usr/bin/env bash
# Second line of defence: if the supervisor process dies, bring it back.
#
# The session_start hook restarts everything on a sandbox wake, but nothing
# would restart the supervisor if it were killed mid-session. This loop is
# independent of the supervisor, so the two cover each other.
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTERVAL=60
LOG=/tmp/dl-watchdog.log

echo "$(date '+%F %T') watchdog starting (every ${INTERVAL}s)" >> "$LOG"

while true; do
  if ! pgrep -f "supervisor.py" > /dev/null 2>&1; then
    echo "$(date '+%F %T') supervisor missing -> restarting" >> "$LOG"
    bash "$DIR/autostart.sh" >> "$LOG" 2>&1
  fi
  sleep "$INTERVAL"
done
