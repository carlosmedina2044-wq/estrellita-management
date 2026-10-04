import UIKit
import Capacitor

/// Edge-to-edge bridge: theme background under Dynamic Island, no automatic safe-area inset on the scroll view.
final class CuidalaBridgeViewController: CAPBridgeViewController {
    /// Matches CSS `--background` (#f5f3ee / #121110) so overscroll is never the wrong cream in dark mode.
    static let shellBackground = UIColor { traits in
        if traits.userInterfaceStyle == .dark {
            return UIColor(red: 0.071, green: 0.067, blue: 0.063, alpha: 1) // #121110
        }
        return UIColor(red: 0.961, green: 0.953, blue: 0.933, alpha: 1) // #f5f3ee
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
