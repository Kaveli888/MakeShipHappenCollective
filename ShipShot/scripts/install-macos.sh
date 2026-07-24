#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_app="$project_dir/src-tauri/target/release/bundle/macos/ShipShot.app"
installed_app="/Applications/ShipShot.app"
launch_agent="$HOME/Library/LaunchAgents/com.makeshiphappen.shipshot.plist"
service_target="gui/$(id -u)/com.makeshiphappen.shipshot"

if [ ! -d "$source_app" ]; then
  echo "ShipShot.app is missing. Run npm run build first." >&2
  exit 1
fi

# Stop the installed background listener before replacing its bundle.
/bin/launchctl bootout "$service_target" 2>/dev/null || true
# A prior manual launch is not owned by launchd, so stop that copy too. Running
# two copies can make the second global-shortcut registration lose the mouse
# event even though both menu-bar icons look healthy.
/usr/bin/pkill -TERM -x shipshot 2>/dev/null || true
attempt=0
while /usr/bin/pgrep -x shipshot >/dev/null 2>&1 && [ "$attempt" -lt 20 ]; do
  /bin/sleep 0.1
  attempt=$((attempt + 1))
done

# Documents may be managed by a macOS file provider, which can attach Finder
# metadata that invalidates a bundle signature. Install a clean copy outside
# that directory and sign it with Jake's stable Developer ID so Screen Recording
# permission survives subsequent ShipShot builds.
/usr/bin/ditto --noextattr --norsrc "$source_app" "$installed_app"
/usr/bin/xattr -cr "$installed_app"
/usr/bin/codesign \
  --force \
  --deep \
  --sign "Developer ID Application: Jacob Felton (7G7K3X24Q5)" \
  --identifier com.makeshiphappen.shipshot \
  --options runtime \
  --timestamp \
  "$installed_app"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$installed_app"

# Keep the small global-shortcut listener available after login. The main window
# stays hidden for this launch, while the menu-bar item and capture shortcuts
# remain active. A normal user launch still opens the main ShipShot window.
/bin/mkdir -p "$HOME/Library/LaunchAgents"
/usr/bin/plutil -create xml1 "$launch_agent"
/usr/bin/plutil -insert Label -string "com.makeshiphappen.shipshot" "$launch_agent"
/usr/bin/plutil -insert ProgramArguments -json \
  '["/Applications/ShipShot.app/Contents/MacOS/shipshot","--background"]' \
  "$launch_agent"
/usr/bin/plutil -insert RunAtLoad -bool true "$launch_agent"
/usr/bin/plutil -insert KeepAlive -json '{"SuccessfulExit":false}' "$launch_agent"
/usr/bin/plutil -insert ProcessType -string "Background" "$launch_agent"
/usr/bin/plutil -insert ThrottleInterval -integer 5 "$launch_agent"
/bin/chmod 600 "$launch_agent"
/bin/launchctl bootstrap "gui/$(id -u)" "$launch_agent"
/bin/launchctl enable "$service_target"
/bin/launchctl kickstart -k "$service_target"

echo "Installed signed ShipShot release at $installed_app"
echo "Started its background capture listener and enabled launch at login"
