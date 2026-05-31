#!/bin/zsh
# Double-click to launch ShipTalk Dev detached from this terminal.
# Vite + the signed dev app start independently, so you can close this window
# (or Warp) right after and the app keeps running (no white-screen).
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective/ShipTalk" || exit 1
npm run shiptalk:detached
echo ""
echo "ShipTalk Dev is up. You can close this window."
