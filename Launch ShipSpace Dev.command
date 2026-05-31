#!/bin/zsh
# Double-click to launch ShipSpace Dev detached from this terminal.
# Vite + the signed dev app start in their own session, so you can close
# this window (or Warp) right after and the app keeps running.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective/ShipSpace" || exit 1
npm run shipspace:detached
echo ""
echo "ShipSpace Dev is up. You can close this window."
