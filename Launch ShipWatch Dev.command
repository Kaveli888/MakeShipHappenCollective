#!/bin/zsh
# Double-click to launch ShipWatch Dev detached from this terminal.
# Vite + the signed dev app start independently, so you can close this window
# (or Warp) right after and the app keeps running (no white-screen).
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective/ShipWatch" || exit 1
npm run shipwatch:detached
echo ""
echo "ShipWatch Dev is up. You can close this window."
