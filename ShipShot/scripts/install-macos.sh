#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_app="$project_dir/src-tauri/target/release/bundle/macos/ShipShot.app"
installed_app="/Applications/ShipShot.app"
launch_agent="$HOME/Library/LaunchAgents/com.makeshiphappen.shipshot.plist"
service_target="gui/$(id -u)/com.makeshiphappen.shipshot"
staging_dir=$(/usr/bin/mktemp -d /private/tmp/shipshot-install.XXXXXX)
staged_app="$staging_dir/ShipShot.app"
previous_app="$staging_dir/Previous-ShipShot.app"

cleanup_staging() {
  if [ -d "$staging_dir" ]; then
    /bin/rm -rf "$staging_dir"
  fi
}
trap cleanup_staging EXIT HUP INT TERM

if [ ! -d "$source_app" ]; then
  echo "ShipShot.app is missing. Run npm run build first." >&2
  exit 1
fi

source_binary="$source_app/Contents/MacOS/shipshot"
if ! /usr/bin/strings "$source_binary" | /usr/bin/grep -Fq "tauri://localhost"; then
  echo "Refusing to install a non-production ShipShot binary. Run npm run build." >&2
  exit 1
fi
if ! /usr/bin/strings "$source_binary" | /usr/bin/grep -Fq "/assets/index-"; then
  echo "Refusing to install ShipShot without its embedded frontend. Run npm run build." >&2
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
# metadata that invalidates a bundle signature. Build and sign a completely
# fresh staging copy, then atomically replace the installed bundle. Never merge
# a new release into the previous .app because stale sealed resources can make
# the signature fail after launch.
/usr/bin/ditto --noextattr --norsrc "$source_app" "$staged_app"
/usr/bin/xattr -cr "$staged_app"
/usr/bin/codesign \
  --force \
  --sign "Developer ID Application: Jacob Felton (7G7K3X24Q5)" \
  --options runtime \
  --timestamp \
  "$staged_app"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$staged_app"

if [ -d "$installed_app" ]; then
  /bin/mv "$installed_app" "$previous_app"
fi
if ! /bin/mv "$staged_app" "$installed_app"; then
  if [ -d "$previous_app" ]; then
    /bin/mv "$previous_app" "$installed_app"
  fi
  echo "Unable to replace the installed ShipShot app." >&2
  exit 1
fi
# Sign once more at the final bundle path. macOS validates the relocated bundle
# immediately, but the hardened-runtime signature must originate at its stable
# /Applications path to remain valid after the first launch on this machine.
/usr/bin/codesign \
  --force \
  --sign "Developer ID Application: Jacob Felton (7G7K3X24Q5)" \
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
