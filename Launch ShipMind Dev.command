#!/bin/zsh
# Double-click to launch ShipMind Dev with a managed Vite server.
# Keep this terminal open while ShipMind Dev is running. Closing it shuts down
# both the app and Vite so ShipMind cannot be left pointing at a dead server.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective/shipmind" || exit 1
npm run shipmind:dev:detached
echo ""
echo "ShipMind Dev has stopped. You can close this window."
