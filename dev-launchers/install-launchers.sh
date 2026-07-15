#!/bin/zsh

set -euo pipefail

ROOT_DIR="${0:A:h:h}"
SOURCE_DIR="$ROOT_DIR/dev-launchers"
INSTALL_DIR="$HOME/Applications/MakeShipHappen Dev"
DOCK_PLIST="$HOME/Library/Preferences/com.apple.dock.plist"

mkdir -p "$INSTALL_DIR"

HOST_BINARY="$(mktemp -t makeshiphappen-dock-host)"
trap 'rm -f "$HOST_BINARY" "${temp_plist:-}"' EXIT

swiftc \
  -O \
  -framework AppKit \
  -framework Foundation \
  "$SOURCE_DIR/DockHost.swift" \
  -o "$HOST_BINARY"

build_launcher() {
  local app_name="$1"
  local bundle_id="$2"
  local config_name="$3"
  local icon_path="$4"
  local app_path="$INSTALL_DIR/$app_name.app"

  rm -rf "$app_path"
  mkdir -p "$app_path/Contents/MacOS" "$app_path/Contents/Resources"
  cp "$HOST_BINARY" "$app_path/Contents/MacOS/dev-dock-host"
  cp "$SOURCE_DIR/launcher.sh" "$app_path/Contents/Resources/launcher.sh"
  cp "$SOURCE_DIR/configs/$config_name.conf" "$app_path/Contents/Resources/launcher.conf"
  cp "$ROOT_DIR/$icon_path" "$app_path/Contents/Resources/icon.icns"
  chmod 755 "$app_path/Contents/MacOS/dev-dock-host" "$app_path/Contents/Resources/launcher.sh"

  plutil -create xml1 "$app_path/Contents/Info.plist"
  plutil -insert CFBundleDevelopmentRegion -string en "$app_path/Contents/Info.plist"
  plutil -insert CFBundleDisplayName -string "$app_name" "$app_path/Contents/Info.plist"
  plutil -insert CFBundleExecutable -string dev-dock-host "$app_path/Contents/Info.plist"
  plutil -insert CFBundleIconFile -string icon.icns "$app_path/Contents/Info.plist"
  plutil -insert CFBundleIdentifier -string "$bundle_id" "$app_path/Contents/Info.plist"
  plutil -insert CFBundleInfoDictionaryVersion -string 6.0 "$app_path/Contents/Info.plist"
  plutil -insert CFBundleName -string "$app_name" "$app_path/Contents/Info.plist"
  plutil -insert CFBundlePackageType -string APPL "$app_path/Contents/Info.plist"
  plutil -insert CFBundleShortVersionString -string 1.0 "$app_path/Contents/Info.plist"
  plutil -insert CFBundleVersion -string 3 "$app_path/Contents/Info.plist"
  plutil -insert LSApplicationCategoryType -string public.app-category.developer-tools "$app_path/Contents/Info.plist"
  plutil -insert LSMultipleInstancesProhibited -bool true "$app_path/Contents/Info.plist"
  plutil -insert NSHighResolutionCapable -bool true "$app_path/Contents/Info.plist"
  xattr -cr "$app_path"
  codesign --force --sign - "$app_path"
}

build_launcher 'Omni Release' 'tech.makeshiphappen.omnirelease.dev' 'omni-release' 'omni-release/app/src-tauri/icons/icon.icns'
build_launcher 'ShipTalk Dev' 'com.makeshiphappen.shiptalk.dev' 'shiptalk' 'ShipTalk/src-tauri/icons/icon.icns'
build_launcher 'ShipSpace Dev' 'com.shipspace.ade.dev' 'shipspace' 'ShipSpace/src-tauri/icons/icon.icns'
build_launcher 'ShipMemory Dev' 'com.shipmemory.dev' 'shipmemory' 'ship-memory/packages/app/src-tauri/icons/icon.icns'
build_launcher 'ShipMind Dev' 'com.makeshiphappen.shipmind.dev' 'shipmind' 'shipmind/src-tauri/icons/icon.icns'
build_launcher 'ShipWatch Dev' 'com.shipwatch.app' 'shipwatch' 'ShipWatch/src-tauri/icons/icon.icns'

if [[ ! -f "$DOCK_PLIST" ]]; then
  print -u2 -- "Dock preferences were not found at $DOCK_PLIST"
  exit 1
fi

temp_plist="$(mktemp -t makeshiphappen-dock).plist"
cp "$DOCK_PLIST" "$temp_plist"

swift "$SOURCE_DIR/update-dock.swift" "$temp_plist" "$INSTALL_DIR"

plutil -lint "$temp_plist"
defaults import com.apple.dock "$temp_plist"
killall Dock

print -- "Installed six MakeShipHappen dev launchers in:"
print -- "$INSTALL_DIR"
