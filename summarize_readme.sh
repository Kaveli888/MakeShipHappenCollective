#!/usr/bin/env zsh
# summarize_readme.sh
# Generates a summary of a README file using the chatgpt CLI.
#
# Usage:
#   ./summarize_readme.sh                  # uses README.md in current dir
#   ./summarize_readme.sh path/to/README   # specify a custom file
#   ./summarize_readme.sh -o summary.md    # save output to a file

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
MODEL="${CHATGPT_MODEL:-gpt-4o-mini}"  # override via -m flag or CHATGPT_MODEL env var
OUTPUT_FILE=""

PROMPT="You are a technical writer. Summarize the following README clearly and concisely.
Include:
- What the project does (1-2 sentences)
- Key features (bullet list)
- How to install/use it (brief)
- Any notable requirements or dependencies

Format the output as clean markdown."

# ── Argument parsing ──────────────────────────────────────────────────────────
README_FILE=""
SCRIPT_NAME="$(basename "$0")"

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [README_FILE] [OPTIONS]

Generates a markdown summary of a README file using the chatgpt CLI.
If README_FILE is omitted, auto-detects README.md / README.rst / README.txt.

Options:
  -o, --output <file>   Write summary to <file> instead of stdout
  -m, --model  <name>   Override the ChatGPT model (e.g. gpt-4o, gpt-4o-mini)
                        Can also be set via CHATGPT_MODEL env var
  -h, --help            Show this help message and exit

Examples:
  $SCRIPT_NAME                        # auto-detect README, print to terminal
  $SCRIPT_NAME path/to/README.md      # summarize a specific file
  $SCRIPT_NAME -o summary.md          # save output to a file
  $SCRIPT_NAME -m gpt-4o-mini -o out.md
  CHATGPT_MODEL=gpt-4o $SCRIPT_NAME  # override model via env var
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    -o|--output)
      OUTPUT_FILE="${2:?'--output requires a filename'}"
      shift 2
      ;;
    -m|--model)
      MODEL="${2:?'--model requires a model name'}"
      shift 2
      ;;
    -*)
      echo "Unknown option: $1" >&2
      echo "Run '$(basename "$0") --help' for usage." >&2
      exit 1
      ;;
    *)
      if [[ -z "$README_FILE" ]]; then
        README_FILE="$1"
      else
        echo "Unexpected argument: $1" >&2
        echo "Run '$(basename "$0") --help' for usage." >&2
        exit 1
      fi
      shift
      ;;
  esac
done

# ── Resolve README path ───────────────────────────────────────────────────────
if [[ -z "$README_FILE" ]]; then
  # Auto-detect common README filenames
  for candidate in README.md README.rst README.txt README; do
    if [[ -f "$candidate" ]]; then
      README_FILE="$candidate"
      break
    fi
  done
fi

if [[ -z "$README_FILE" || ! -f "$README_FILE" ]]; then
  echo "Error: No README file found. Specify one as the first argument." >&2
  exit 1
fi

# ── Check dependencies ────────────────────────────────────────────────────────
if ! command -v chatgpt &>/dev/null; then
  echo "Error: 'chatgpt' CLI not found. Install it and ensure it's in your PATH." >&2
  exit 1
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "Error: OPENAI_API_KEY is not set." >&2
  echo "Set it in your shell: export OPENAI_API_KEY=\"sk-...\"" >&2
  echo "Or load it from Keychain: export OPENAI_API_KEY=\"\$(security find-generic-password -a \"\$USER\" -s OPENAI_API_KEY -w)\"" >&2
  exit 1
fi

# ── Build the chatgpt command ─────────────────────────────────────────────────
CHATGPT_ARGS=(-q)
[[ -n "$MODEL" ]] && CHATGPT_ARGS+=(--model "$MODEL")

# ── Run ───────────────────────────────────────────────────────────────────────
echo "Summarizing: $README_FILE" >&2

SUMMARY=$(cat "$README_FILE" | chatgpt "${CHATGPT_ARGS[@]}" "$PROMPT")

# ── Output ────────────────────────────────────────────────────────────────────
if [[ -n "$OUTPUT_FILE" ]]; then
  printf '%s\n' "$SUMMARY" > "$OUTPUT_FILE"
  echo "Summary written to: $OUTPUT_FILE" >&2
else
  printf '%s\n' "$SUMMARY"
fi
