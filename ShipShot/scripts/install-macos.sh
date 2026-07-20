#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_app="$project_dir/src-tauri/target/release/bundle/macos/ShipShot.app"
installed_app="/Applications/ShipShot.app"

if [ ! -d "$source_app" ]; then
  echo "ShipShot.app is missing. Run npm run build first." >&2
  exit 1
fi

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

echo "Installed stable development build at $installed_app"
