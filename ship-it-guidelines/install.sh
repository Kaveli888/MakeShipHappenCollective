#!/bin/bash
# Ship It — Install guidelines for Claude Code
# Usage: ./install.sh [global|project]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/CLAUDE.md"

case "${1:-global}" in
  global)
    mkdir -p ~/.claude
    if [ -f ~/.claude/CLAUDE.md ]; then
      echo "Existing ~/.claude/CLAUDE.md found. Backing up to ~/.claude/CLAUDE.md.bak"
      cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak
    fi
    cp "$SOURCE" ~/.claude/CLAUDE.md
    echo "Installed globally at ~/.claude/CLAUDE.md"
    echo "Active for all Claude Code conversations."
    ;;
  project)
    if [ -f ./CLAUDE.md ]; then
      echo "Existing CLAUDE.md found in current directory. Backing up to CLAUDE.md.bak"
      cp ./CLAUDE.md ./CLAUDE.md.bak
    fi
    cp "$SOURCE" ./CLAUDE.md
    echo "Installed at ./CLAUDE.md"
    echo "Active for Claude Code conversations in $(pwd)"
    ;;
  uninstall)
    if [ -f ~/.claude/CLAUDE.md ]; then
      rm ~/.claude/CLAUDE.md
      echo "Removed ~/.claude/CLAUDE.md"
    else
      echo "No global CLAUDE.md found."
    fi
    ;;
  *)
    echo "Usage: ./install.sh [global|project|uninstall]"
    exit 1
    ;;
esac
