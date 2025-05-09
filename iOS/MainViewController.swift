import UIKit

class MainViewController: UINavigationController {
    override func viewDidLoad() {
        self.navigationBar.prefersLargeTitles = true
        self.navigationBar.scrollEdgeAppearance = self.navigationBar.standardAppearance
        self.setViewControllers([MainViewControllerImpl()], animated: false)
    }
}

fileprivate class MainViewControllerImpl
    : UIViewController
    , PreferenceDelegate
{
    private static let prefSettings = "open_settings"
    private static let prefGitHub = "open_github"

    private var preferenceViewController: PreferenceViewController!

    override func viewDidLoad() {
        self.title = "Kagi Redirect"

        self.preferenceViewController = PreferenceViewController(root: PreferenceRoot(sections: [
            PreferenceSection(
                header: "Actions",
                footer: """
                    Open the extension settings, enable access to all websites, \
                    then paste in your session link.
                    """,
                preferences: [
                    Preference(
                        id: Self.prefSettings,
                        type: .button(label: "Open Safari settings")
                    ),
                ]
            ),
            PreferenceSection(
                header: "About",
                footer: "",
                preferences: [
                    Preference(
                        id: Self.prefGitHub,
                        type: .button(label: "Visit project on GitHub")
                    ),
                ]
            ),
        ]))
        self.addChild(self.preferenceViewController)
        self.preferenceViewController.view
            .autoLayoutInView(self.view)
            .fill(self.view)
            .activate()
        self.preferenceViewController.didMove(toParent: self)
        self.preferenceViewController.delegate = self
    }

    func preferenceView(didClickButton id: String) {
        switch id {
        case Self.prefSettings:
            if #available(iOS 18.0, *) {
                UIApplication.shared.open(URL(string: "App-Prefs:com.apple.mobilesafari")!)
            } else {
                UIApplication.shared.open(URL(string: "App-Prefs:SAFARI&path=WEB_EXTENSIONS")!)
            }
        case Self.prefGitHub:
            UIApplication.shared.open(URL(string: "https://github.com/apsun/kagi-redirect")!)
        default:
            abort()
        }
    }
}
