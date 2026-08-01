#!/bin/zsh

set -u

CONTENTS_DIR="${0:A:h:h}"
CONFIG_FILE="$CONTENTS_DIR/Resources/launcher.conf"

if [[ ! -r "$CONFIG_FILE" ]]; then
  /usr/bin/osascript -e 'display alert "MakeShipHappen Dev Launcher" message "The launcher configuration is missing." as critical'
  exit 1
fi

source "$CONFIG_FILE"

LOG_DIR="$HOME/Library/Logs/MakeShipHappen Dev Launchers"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${DISPLAY_NAME// /-}.log"
SESSION_STDOUT_LOG="$LOG_DIR/${DISPLAY_NAME// /-}-session.out.log"
SESSION_STDERR_LOG="$LOG_DIR/${DISPLAY_NAME// /-}-session.err.log"

log_launcher() {
  print -r -- "[$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')] pid=$$ $*" >> "$LOG_FILE"
}

# pgrep -f alone is unsafe here: build and codesign commands include the app
# executable path in their arguments and can briefly impersonate a running
# app. Verify the kernel accounting name as well, so only the real executable
# (for ShipSpace, `shipspace`) counts.
find_running_app_pids() {
  [[ -n "${RUNNING_PATTERN:-}" ]] || return 0
  local expected_name="${RUNNING_PATTERN:t}"
  local candidate_pid candidate_name
  while IFS= read -r candidate_pid; do
    [[ -n "$candidate_pid" ]] || continue
    candidate_name="$(/bin/ps -p "$candidate_pid" -o ucomm= 2>/dev/null)"
    candidate_name="${candidate_name//[[:space:]]/}"
    if [[ "$candidate_name" == "$expected_name" ]]; then
      print -r -- "$candidate_pid"
    fi
  done < <(/usr/bin/pgrep -f "$RUNNING_PATTERN" 2>/dev/null || true)
}

if [[ "${1:-}" == "--run-session" ]]; then
  export MSH_DEV_DOCK_LAUNCHER=1
  export NVM_DIR="$HOME/.nvm"
  [[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  cd "$PROJECT_DIR" || exit 1
  print -r -- "[$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')] starting $DISPLAY_NAME in $PROJECT_DIR"
  /bin/zsh -c "exec ${DEV_COMMAND}"
  session_status=$?
  # Remove our own launchd label once the dev command ends, otherwise
  # launchctl-submit jobs are silently respawned by launchd after any
  # abnormal exit (observed: unattended ShipMind rebuilds/relaunches).
  if [[ -n "${JOB_LABEL:-}" ]]; then
    active_job_pid="$(
      /bin/launchctl print "gui/$(/usr/bin/id -u)/$JOB_LABEL" 2>/dev/null \
        | /usr/bin/awk '/^[[:space:]]*pid = / { print $3; exit }'
    )"
    if [[ -z "$active_job_pid" || "$active_job_pid" == "$$" ]]; then
      print -r -- "[$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')] $DISPLAY_NAME dev command exited (status $session_status); removing owned job $JOB_LABEL"
      /bin/launchctl remove "$JOB_LABEL" >/dev/null 2>&1
    else
      print -r -- "[$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')] $DISPLAY_NAME dev command exited (status $session_status); job $JOB_LABEL now belongs to pid $active_job_pid, leaving it running"
    fi
  fi
  exit $session_status
fi

log_launcher "invoked"

app_running=0
server_healthy=0

running_pid=""
if [[ "${MSH_LAUNCHER_DRY_RUN:-0}" != "1" ]]; then
  running_pid="$(find_running_app_pids | /usr/bin/head -1)"
  [[ -n "$running_pid" ]] && app_running=1
fi

if [[ "${MSH_LAUNCHER_DRY_RUN:-0}" != "1" && -n "${DEV_SERVER_URL:-}" ]] && /usr/bin/curl -fsS --connect-timeout 1 --max-time 2 "$DEV_SERVER_URL" >/dev/null 2>&1; then
  server_healthy=1
fi

if (( ! app_running && server_healthy )) && [[ -n "${RUNNING_PATTERN:-}" ]]; then
  # The native window may still be starting. Give it a moment before treating
  # the listener as a leftover session from an app that was quit separately.
  for _ in {1..20}; do
    running_pid="$(find_running_app_pids | /usr/bin/head -1)"
    if [[ -n "$running_pid" ]]; then
      app_running=1
      break
    fi
    /bin/sleep 0.1
  done
fi

if (( app_running )) && [[ -z "${DEV_SERVER_URL:-}" || "$server_healthy" == "1" ]]; then
  log_launcher "existing app detected; activating pid $running_pid (bundle $APP_BUNDLE_ID)"
  if [[ -n "${APP_BUNDLE_ID:-}" ]]; then
    /usr/bin/osascript - "$APP_BUNDLE_ID" "${APP_PROCESS_NAME:-}" "$running_pid" >/dev/null 2>&1 <<'APPLESCRIPT' || true
on run argv
  set wantedBundleID to item 1 of argv
  set wantedProcessName to item 2 of argv
  set wantedPID to (item 3 of argv) as integer
  tell application "System Events"
    if wantedPID > 0 and exists (first application process whose unix id is wantedPID) then
      set frontmost of first application process whose unix id is wantedPID to true
    else if exists (first application process whose bundle identifier is wantedBundleID) then
      set frontmost of first application process whose bundle identifier is wantedBundleID to true
    else if wantedProcessName is not "" and exists application process wantedProcessName then
      set frontmost of application process wantedProcessName to true
    end if
  end tell
end run
APPLESCRIPT
  fi
  exit 0
fi

if (( app_running )) && [[ -n "${DEV_SERVER_URL:-}" && "$server_healthy" == "0" ]]; then
  log_launcher "stale app detected; dev server is unavailable at $DEV_SERVER_URL"
  stale_pids="$(find_running_app_pids)"
  while IFS= read -r stale_pid; do
    [[ -n "$stale_pid" ]] && /bin/kill -TERM "$stale_pid" >/dev/null 2>&1 || true
  done <<< "$stale_pids"
  for _ in {1..20}; do
    [[ -n "$(find_running_app_pids)" ]] || break
    /bin/sleep 0.1
  done
  while IFS= read -r stale_pid; do
    [[ -n "$stale_pid" ]] && /bin/kill -KILL "$stale_pid" >/dev/null 2>&1 || true
  done < <(find_running_app_pids)
fi

if (( ! app_running && server_healthy )); then
  port="${DEV_SERVER_URL##*:}"
  port="${port%%/*}"
  listener_pid="$(/usr/sbin/lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | /usr/bin/head -1)"

  if [[ -n "$listener_pid" ]]; then
    listener_pgid="$(/bin/ps -o pgid= -p "$listener_pid" | /usr/bin/tr -d ' ')"
    log_launcher "native app is closed; retiring leftover dev session on port $port (pgid $listener_pgid)"
    if [[ -n "$listener_pgid" && "$listener_pgid" != "$$" ]]; then
      /bin/kill -TERM -- "-$listener_pgid" >/dev/null 2>&1 || true
    else
      /bin/kill -TERM "$listener_pid" >/dev/null 2>&1 || true
    fi

    for _ in {1..30}; do
      /usr/sbin/lsof -nP -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || break
      /bin/sleep 0.1
    done
  fi
fi

# Optional guard: warn before starting a session that would run alongside a
# related production process (e.g. the Omni agent-loop worker sharing omni.db).
if [[ -n "${COEXIST_WARNING_PATTERN:-}" ]] && /usr/bin/pgrep -q -f "$COEXIST_WARNING_PATTERN"; then
  log_launcher "coexist warning triggered for pattern $COEXIST_WARNING_PATTERN"
  choice="$(/usr/bin/osascript - "$DISPLAY_NAME" "${COEXIST_WARNING_TEXT:-A related production process is already running.}" <<'APPLESCRIPT'
on run argv
  try
    set answer to display dialog (item 2 of argv) with title (item 1 of argv) buttons {"Cancel", "Open Anyway"} default button "Cancel" with icon caution
    return button returned of answer
  on error
    return "Cancel"
  end try
end run
APPLESCRIPT
)"
  if [[ "$choice" != "Open Anyway" ]]; then
    log_launcher "user cancelled launch after coexist warning"
    exit 0
  fi
fi

if [[ ! -d "$PROJECT_DIR" ]]; then
  log_launcher "project directory missing: $PROJECT_DIR"
  /usr/bin/osascript - "$DISPLAY_NAME" "$PROJECT_DIR" <<'APPLESCRIPT'
on run argv
  display alert (item 1 of argv) message ("Project directory not found:\n" & item 2 of argv) as critical
end run
APPLESCRIPT
  exit 1
fi

if [[ "${MSH_LAUNCHER_DRY_RUN:-0}" == "1" ]]; then
  log_launcher "dry run"
  print -r -- "/bin/launchctl submit -l ${JOB_LABEL:-missing-job-label} -o $SESSION_STDOUT_LOG -e $SESSION_STDERR_LOG -- $CONTENTS_DIR/Resources/launcher.sh --run-session"
  exit 0
fi

if [[ -z "${JOB_LABEL:-}" ]]; then
  log_launcher "missing launchd job label"
  exit 1
fi

# A fixed per-product launchd job owns the whole dev process tree. If a build
# or dependency repair is already running, a second Dock click must leave that
# session alone.
existing_job_pid="$(
  /bin/launchctl print "gui/$(/usr/bin/id -u)/$JOB_LABEL" 2>/dev/null \
    | /usr/bin/awk '/^[[:space:]]*pid = / { print $3; exit }'
)"
if [[ -n "$existing_job_pid" ]]; then
  log_launcher "launch already in progress (job pid $existing_job_pid); leaving existing session running"
  exit 0
fi

# Clear only an inactive/stale registration before submitting a fresh owner.
/bin/launchctl remove "$JOB_LABEL" >/dev/null 2>&1 || true

log_launcher "submitting invisible launchd job $JOB_LABEL"
if /bin/launchctl submit \
  -l "$JOB_LABEL" \
  -o "$SESSION_STDOUT_LOG" \
  -e "$SESSION_STDERR_LOG" \
  -- "$CONTENTS_DIR/Resources/launcher.sh" --run-session
then
  log_launcher "launchd accepted job $JOB_LABEL"
else
  status=$?
  log_launcher "launchd submission failed with status $status"
  exit "$status"
fi
