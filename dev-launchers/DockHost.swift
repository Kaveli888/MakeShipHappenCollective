import AppKit
import Foundation

private struct LauncherConfig {
    let displayName: String
    let runningPattern: String
    let jobLabel: String

    init(url: URL) throws {
        let contents = try String(contentsOf: url, encoding: .utf8)
        var values: [String: String] = [:]

        for rawLine in contents.split(whereSeparator: \.isNewline) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            guard !line.isEmpty, !line.hasPrefix("#"), let separator = line.firstIndex(of: "=") else {
                continue
            }

            let key = String(line[..<separator])
            var value = String(line[line.index(after: separator)...])
                .trimmingCharacters(in: .whitespaces)
            if value.count >= 2,
               (value.hasPrefix("'") && value.hasSuffix("'") ||
                value.hasPrefix("\"") && value.hasSuffix("\"")) {
                value.removeFirst()
                value.removeLast()
            }
            values[key] = value
        }

        guard let displayName = values["DISPLAY_NAME"], !displayName.isEmpty,
              let runningPattern = values["RUNNING_PATTERN"], !runningPattern.isEmpty,
              let jobLabel = values["JOB_LABEL"], !jobLabel.isEmpty else {
            throw NSError(
                domain: "MakeShipHappenDockHost",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "The launcher configuration is incomplete."]
            )
        }

        self.displayName = displayName
        self.runningPattern = runningPattern
        self.jobLabel = jobLabel
    }
}

private final class DockHostDelegate: NSObject, NSApplicationDelegate {
    private var config: LauncherConfig?
    private var monitor: Timer?
    private var launchTask: Process?
    private var runtimePID: pid_t?
    private var observedRuntime = false
    private var startupTicks = 0
    private var isTerminating = false
    private var shouldActivateOnDiscovery = true

    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            guard let resources = Bundle.main.resourceURL else {
                throw NSError(
                    domain: "MakeShipHappenDockHost",
                    code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "The launcher resources are missing."]
                )
            }

            config = try LauncherConfig(url: resources.appendingPathComponent("launcher.conf"))
            startOrActivateSession(resources: resources)
            monitor = Timer.scheduledTimer(withTimeInterval: 0.35, repeats: true) { [weak self] _ in
                self?.pollRuntime()
            }
        } catch {
            showFailure(error.localizedDescription)
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        activateRuntime()
        return true
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        guard observedRuntime else { return }
        activateRuntime()
    }

    func applicationWillTerminate(_ notification: Notification) {
        guard !isTerminating else { return }
        stopSession()
    }

    private func startOrActivateSession(resources: URL) {
        if let pid = findRuntimePID() {
            runtimePID = pid
            observedRuntime = true
            activateRuntime()
            return
        }

        let helper = resources.appendingPathComponent("launcher.sh")
        let task = Process()
        task.executableURL = helper
        task.currentDirectoryURL = Bundle.main.bundleURL
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice
        task.terminationHandler = { [weak self] process in
            DispatchQueue.main.async {
                guard let self, process.terminationStatus != 0, !self.observedRuntime else { return }
                self.showFailure("The invisible dev session could not be started. Check the launcher log for details.")
            }
        }

        do {
            try task.run()
            launchTask = task
        } catch {
            showFailure(error.localizedDescription)
        }
    }

    private func pollRuntime() {
        guard !isTerminating else { return }

        if let pid = findRuntimePID() {
            let isNewRuntime = runtimePID != pid
            runtimePID = pid
            observedRuntime = true
            startupTicks = 0

            if isNewRuntime || shouldActivateOnDiscovery {
                shouldActivateOnDiscovery = false
                activateRuntime()
            }
            return
        }

        runtimePID = nil
        if observedRuntime {
            terminateHostAndSession()
            return
        }

        startupTicks += 1
        if startupTicks >= 1_200 {
            showFailure("The dev app did not finish launching within seven minutes. Check the launcher log for details.")
        }
    }

    private func findRuntimePID() -> pid_t? {
        guard let pattern = config?.runningPattern else { return nil }
        let expectedExecutable = URL(fileURLWithPath: pattern).lastPathComponent

        let task = Process()
        let pipe = Pipe()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
        task.arguments = ["-f", pattern]
        task.standardOutput = pipe
        task.standardError = FileHandle.nullDevice

        do {
            try task.run()
            task.waitUntilExit()
        } catch {
            return nil
        }

        guard task.terminationStatus == 0,
              let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) else {
            return nil
        }

        for line in output.split(whereSeparator: \.isNewline) {
            if let pid = pid_t(line.trimmingCharacters(in: .whitespacesAndNewlines)),
               processExecutableName(pid: pid) == expectedExecutable {
                return pid
            }
        }
        return nil
    }

    /// `pgrep -f` also finds build/signing/polling commands whose arguments
    /// merely contain the runtime path. Verify the kernel command name so a
    /// Dock click can never attach to a transient helper and immediately exit.
    private func processExecutableName(pid: pid_t) -> String? {
        let task = Process()
        let pipe = Pipe()
        task.executableURL = URL(fileURLWithPath: "/bin/ps")
        task.arguments = ["-p", String(pid), "-o", "ucomm="]
        task.standardOutput = pipe
        task.standardError = FileHandle.nullDevice

        do {
            try task.run()
            task.waitUntilExit()
        } catch {
            return nil
        }

        guard task.terminationStatus == 0,
              let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) else {
            return nil
        }
        return output.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func activateRuntime() {
        guard let pid = runtimePID ?? findRuntimePID(),
              let app = NSRunningApplication(processIdentifier: pid) else {
            return
        }

        runtimePID = pid
        app.unhide()
        app.activate(options: [.activateAllWindows])
    }

    private func stopSession() {
        guard let label = config?.jobLabel else { return }
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/bin/launchctl")
        task.arguments = ["remove", label]
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice
        try? task.run()
        task.waitUntilExit()
    }

    private func terminateHostAndSession() {
        guard !isTerminating else { return }
        isTerminating = true
        monitor?.invalidate()
        stopSession()
        NSApplication.shared.terminate(nil)
    }

    private func showFailure(_ message: String) {
        guard !isTerminating else { return }
        isTerminating = true
        monitor?.invalidate()
        stopSession()

        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = config?.displayName ?? "MakeShipHappen Dev Launcher"
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.runModal()
        NSApplication.shared.terminate(nil)
    }
}

let application = NSApplication.shared
private let delegate = DockHostDelegate()
application.setActivationPolicy(.regular)
application.delegate = delegate
application.run()
