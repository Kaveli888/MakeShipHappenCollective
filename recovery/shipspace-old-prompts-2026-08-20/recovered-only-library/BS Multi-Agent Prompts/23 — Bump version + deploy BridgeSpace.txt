Bump BridgeSpace to version 3.0.54 and deploy.

Steps:
  1. Update version in: package.json, tauri.conf.json, Cargo.toml, and any other version-bearing file.
  2. Update CHANGELOG.md with bullets for what shipped since the last version.
  3. Commit with message: "chore: bump to 3.0.54"
  4. Tag: v3.0.54
  5. Run the build.
  6. Stop before deploy and show me the build output. I'll approve the deploy step.

Done = version bumped + changelog updated + tagged + build green + waiting for deploy approval.