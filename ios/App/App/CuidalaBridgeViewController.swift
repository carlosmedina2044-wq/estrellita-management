import UIKit
import Capacitor

/// Edge-to-edge bridge: theme background under Dynamic Island, no automatic safe-area inset on the scroll view.
final class CuidalaBridgeViewController: CAPBridgeViewController {
    /// Matches CSS `--background` (#f4f1ec / #101418) so overscroll is never the wrong cream in dark mode.
    static let shellBackground = UIColor { traits in
        if traits.userInterfaceStyle == .dark {
            return UIColor(red: 0.063, green: 0.078, blue: 0.094, alpha: 1) // #101418
        }
        return UIColor(red: 0.957, green: 0.945, blue: 0.925, alpha: 1) // #f4f1ec
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .default }

    override func viewDidLoad() {
        super.viewDidLoad()
        applyChromeColors()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        applyChromeColors()
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        guard traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) else { return }
        applyChromeColors()
        setNeedsStatusBarAppearanceUpdate()
    }

    private func applyChromeColors() {
        let fill = Self.shellBackground
        view.backgroundColor = fill
        guard let webView else { return }
        webView.isOpaque = false
        webView.backgroundColor = fill
        webView.scrollView.backgroundColor = fill
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 15.0, *) {
            webView.underPageBackgroundColor = fill
        }
    }
}
