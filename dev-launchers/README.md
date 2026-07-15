# MakeShipHappen Dev Dock Launchers

These launcher apps provide stable Dock targets for the local development versions of Omni Release, ShipTalk, ShipSpace, ShipMemory, ShipMind, and ShipWatch.

Clicking a launcher activates the product only when both its native process and local dev server are healthy. If the app was quit while its dev server stayed alive, the launcher retires that leftover session before reopening. If a stale native process is still open after its dev server stops, the launcher closes that process before starting a fresh session. Otherwise it starts an invisible, fixed-label launchd job in the correct project directory. No Terminal window is opened. launchd owns the complete development process tree and provides its cleanup path.

Reinstall or refresh the launchers after changing an icon or launcher configuration:

```sh
./dev-launchers/install-launchers.sh
```
