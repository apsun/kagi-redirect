import AppKit

class AppDelegate: NSObject, NSApplicationDelegate {
    private func initMenu() {
        NSApp.mainMenu = NSMenu.make(
            title: "Kagi Redirect",
            children: [
                .submenu(
                    title: "Kagi Redirect",
                    children: [
                        .action(
                            title: "About Kagi Redirect",
                            action: #selector(NSApplication.orderFrontStandardAboutPanel(_:))
                        ),
                        .separator,
                        .action(
                            title: "Hide Kagi Redirect",
                            action: #selector(NSApplication.hide(_:)),
                            keyEquivalent: "h",
                            keyEquivalentModifierMask: [.command]
                        ),
                        .action(
                            title: "Hide Others",
                            action: #selector(NSApplication.hideOtherApplications(_:)),
                            keyEquivalent: "h",
                            keyEquivalentModifierMask: [.option, .command]
                        ),
                        .action(
                            title: "Show All",
                            action: #selector(NSApplication.unhideAllApplications(_:))
                        ),
                        .separator,
                        .action(
                            title: "Quit Kagi Redirect",
                            action: #selector(NSApplication.terminate(_:)),
                            keyEquivalent: "q",
                            keyEquivalentModifierMask: [.command]
                        )
                    ]
                )
            ]
        )
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        self.initMenu()

        let window = NSWindow(contentViewController: MainViewController())
        window.title = "Kagi Redirect"
        window.styleMask.remove(.resizable)
        window.makeKeyAndOrderFront(nil)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}
