#!/usr/bin/env bash
# Start (or restart) the APK download stack.
#
# Idempotent: safe to run from .openhands/hooks.json on every session start,
# and safe to run by hand. It makes sure exactly one supervisor is running;
# the supervisor owns the HTTP server and the idle-timer keepalive.
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTS="${APK_PORTS:-12000,12001}"
LOG=/tmp/dl-autostart.log

echo "$(date '+%F %T') autostart invoked (ports $PORTS)" >> "$LOG"

# Nothing to do if the supervisor is already alive.
if pgrep -f "supervisor.py" > /dev/null 2>&1; then
  echo "$(date '+%F %T') supervisor already running" >> "$LOG"
  exit 0
fi

# Clear anything stale holding the port so the supervisor can bind cleanly.
for pat in "serve.py" "keepalive.py"; do
  pids="$(pgrep -f "$pat" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    echo "$(date '+%F %T') stopped stale $pat: $pids" >> "$LOG"
  fi
done

APK_PORTS="$PORTS" nohup python3 "$DIR/supervisor.py" >> "$LOG" 2>&1 &
disown 2>/dev/null || true
echo "$(date '+%F %T') supervisor launched (pid $!)" >> "$LOG"

# Keep a watchdog alive too, so a killed supervisor gets restarted.
if ! pgrep -f "watchdog.sh" > /dev/null 2>&1; then
  nohup bash "$DIR/watchdog.sh" >> "$LOG" 2>&1 &
  disown 2>/dev/null || true
  echo "$(date '+%F %T') watchdog launched (pid $!)" >> "$LOG"
fi
