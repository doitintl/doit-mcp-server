#!/usr/bin/env bash
# Manage the local wrangler dev server for the DoiT MCP CF Worker.
# Usage: ./scripts/dev/wrangler.sh [start|stop|restart|status|logs]
#
# The process runs in the background. PID is stored in /tmp/doit-wrangler.pid
# and output is streamed to /tmp/doit-wrangler.log.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORKER_DIR="$REPO_ROOT/doit-mcp-server"
PID_FILE="/tmp/doit-wrangler.pid"
LOG_FILE="/tmp/doit-wrangler.log"
PORT=8788

# ── helpers ────────────────────────────────────────────────────────────────────

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    kill -0 "$pid" 2>/dev/null
  else
    return 1
  fi
}

do_start() {
  if is_running; then
    echo "wrangler dev is already running (PID $(cat "$PID_FILE"), port $PORT)"
    return 0
  fi

  echo "Starting wrangler dev on port $PORT …"
  cd "$WORKER_DIR"
  nohup npx wrangler dev --port "$PORT" > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "Started (PID $!, log → $LOG_FILE)"
}

do_stop() {
  # Kill by PID file if we have one
  if is_running; then
    local pid
    pid=$(cat "$PID_FILE")
    echo "Stopping wrangler dev (PID $pid) …"
    kill "$pid"

    # Wait up to 5 s for clean exit
    for _ in $(seq 1 10); do
      sleep 0.5
      kill -0 "$pid" 2>/dev/null || break
    done

    if kill -0 "$pid" 2>/dev/null; then
      echo "Process did not exit cleanly; sending SIGKILL …"
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi

  # Also kill anything still holding the port (handles stale processes)
  local port_pid
  port_pid=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [[ -n "$port_pid" ]]; then
    echo "Killing stale process on port $PORT (PID $port_pid) …"
    kill -9 $port_pid 2>/dev/null || true
  fi

  rm -f "$PID_FILE"
  echo "Stopped."
}

do_status() {
  if is_running; then
    echo "wrangler dev is running (PID $(cat "$PID_FILE"), port $PORT)"
  else
    echo "wrangler dev is NOT running."
    rm -f "$PID_FILE"
  fi
}

do_logs() {
  if [[ ! -f "$LOG_FILE" ]]; then
    echo "No log file found at $LOG_FILE"
    return 1
  fi
  tail -f "$LOG_FILE"
}

# ── dispatch ───────────────────────────────────────────────────────────────────

CMD="${1:-help}"
case "$CMD" in
  start)   do_start ;;
  stop)    do_stop ;;
  restart) do_stop; sleep 1; do_start ;;
  status)  do_status ;;
  logs)    do_logs ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    echo ""
    echo "  start    Start wrangler dev in background (port $PORT)"
    echo "  stop     Stop the running wrangler dev process"
    echo "  restart  Stop then start"
    echo "  status   Show whether the process is running"
    echo "  logs     Tail the wrangler dev log"
    exit 1
    ;;
esac
