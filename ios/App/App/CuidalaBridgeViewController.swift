import UIKit
import Capacitor

/// Edge-to-edge bridge: cream under Dynamic Island, no automatic safe-area inset on the scroll view.
final class CuidalaBridgeViewController: CAPBridgeViewController {
    private let cream = UIColor(red: 0.980, green: 0.965, blue: 0.937, alpha: 1) // #faf6ef

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = cream
        applyWebViewChrome()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        applyWebViewChrome()
    }

    private func applyWebViewChrome() {
        guard let webView else { return }
        webView.isOpaque = false
        webView.backgroundColor = cream
        webView.scrollView.backgroundColor = cream
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 15.0, *) {
            webView.underPageBackgroundColor = cream
        }
    }
}
