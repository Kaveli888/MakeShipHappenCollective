import Foundation

guard CommandLine.arguments.count == 3 else {
    fputs("usage: update-dock.swift <dock-plist> <launcher-directory>\n", stderr)
    exit(64)
}

let plistURL = URL(fileURLWithPath: CommandLine.arguments[1])
let launcherDirectory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)

struct Launcher {
    let label: String
    let appName: String
    let bundleIdentifier: String
    let guid: UInt64
}

let launchers = [
    Launcher(label: "Omni Release", appName: "Omni Release.app", bundleIdentifier: "tech.makeshiphappen.omnirelease.dev", guid: 3_900_000_001),
    Launcher(label: "ShipTalk Dev", appName: "ShipTalk Dev.app", bundleIdentifier: "com.makeshiphappen.shiptalk.dev", guid: 3_900_000_002),
    Launcher(label: "ShipSpace Dev", appName: "ShipSpace Dev.app", bundleIdentifier: "com.shipspace.ade.dev", guid: 3_900_000_003),
    Launcher(label: "ShipMemory Dev", appName: "ShipMemory Dev.app", bundleIdentifier: "com.shipmemory.dev", guid: 3_900_000_004),
    Launcher(label: "ShipMind Dev", appName: "ShipMind Dev.app", bundleIdentifier: "com.makeshiphappen.shipmind.dev", guid: 3_900_000_005),
    Launcher(label: "ShipWatch Dev", appName: "ShipWatch Dev.app", bundleIdentifier: "com.shipwatch.app", guid: 3_900_000_006),
]

let plistData = try Data(contentsOf: plistURL)
guard var root = try PropertyListSerialization.propertyList(
    from: plistData,
    options: [.mutableContainersAndLeaves],
    format: nil
) as? [String: Any] else {
    throw NSError(domain: "MakeShipHappenDock", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Dock preferences do not contain a dictionary root",
    ])
}

var persistentApps = root["persistent-apps"] as? [[String: Any]] ?? []

func tileLabel(_ tile: [String: Any]) -> String? {
    (tile["tile-data"] as? [String: Any])?["file-label"] as? String
}

func tileBundleIdentifier(_ tile: [String: Any]) -> String? {
    (tile["tile-data"] as? [String: Any])?["bundle-identifier"] as? String
}

func makeTile(_ launcher: Launcher) throws -> [String: Any] {
    let appURL = launcherDirectory.appendingPathComponent(launcher.appName, isDirectory: true)
    let bookmark = try appURL.bookmarkData(
        options: [],
        includingResourceValuesForKeys: nil,
        relativeTo: nil
    )

    return [
        "GUID": NSNumber(value: launcher.guid),
        "tile-data": [
            "book": bookmark,
            "bundle-identifier": launcher.bundleIdentifier,
            "dock-extra": false,
            "file-data": [
                "_CFURLString": appURL.absoluteString,
                "_CFURLStringType": 15,
            ],
            "file-label": launcher.label,
            "file-type": 41,
            "is-beta": false,
        ],
        "tile-type": "file-tile",
    ]
}

// Remove the legacy raw-binary tile before rebuilding the six product records.
persistentApps.removeAll { tileLabel($0) == "ship-watch" }

for launcher in launchers {
    let replacement = try makeTile(launcher)
    var next: [[String: Any]] = []
    var inserted = false

    for tile in persistentApps {
        if tileLabel(tile) == launcher.label || tileBundleIdentifier(tile) == launcher.bundleIdentifier {
            if !inserted {
                next.append(replacement)
                inserted = true
            }
            continue
        }
        next.append(tile)
    }

    if !inserted {
        next.append(replacement)
    }
    persistentApps = next
}

root["persistent-apps"] = persistentApps

let productLabels = Set(launchers.map(\.label) + ["ship-watch", "exec"])
let productBundleIdentifiers = Set(launchers.map(\.bundleIdentifier))
if let recentApps = root["recent-apps"] as? [[String: Any]] {
    root["recent-apps"] = recentApps.filter { tile in
        let data = tile["tile-data"] as? [String: Any] ?? [:]
        let label = data["file-label"] as? String ?? ""
        let bundleIdentifier = data["bundle-identifier"] as? String ?? ""
        return !productLabels.contains(label) && !productBundleIdentifiers.contains(bundleIdentifier)
    }
}

let output = try PropertyListSerialization.data(
    fromPropertyList: root,
    format: .binary,
    options: 0
)
try output.write(to: plistURL, options: .atomic)
