import AVFoundation
import Capacitor
import Foundation
import UIKit
import VisionKit

/// Reads the text on an appliance sticker. Text only: this file never asks for a
/// photo (`capturePhoto`), never touches a pixel buffer and never writes anything.
@objc(CuidalaScanPlugin)
public class CuidalaScanPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CuidalaScanPlugin"
    public let jsName = "CuidalaScan"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanLabel", returnType: CAPPluginReturnPromise),
    ]

    @objc func isSupported(_ call: CAPPluginCall) {
        Task { @MainActor in
            call.resolve(["supported": DataScannerViewController.isSupported])
        }
    }

    @objc func scanLabel(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard DataScannerViewController.isSupported else {
                call.reject("This device cannot scan text", "unsupported")
                return
            }
            guard await Self.cameraAllowed() else {
                call.reject("Camera access is off", "denied")
                return
            }
            // Supported but still not available means restricted (parental controls etc.).
            guard DataScannerViewController.isAvailable else {
                call.reject("Camera access is off", "denied")
                return
            }
            guard let presenter = Self.topViewController() else {
                call.reject("Nothing to show the scanner on", "unsupported")
                return
            }
            let session = LabelScanSession()
            session.present(from: presenter) { outcome in
                switch outcome {
                case .lines(let lines):
                    call.resolve(["lines": lines])
                case .cancelled:
                    call.reject("Cancelled", "cancelled")
                case .failed(let code):
                    call.reject("Could not scan", code)
                }
            }
        }
    }

    /// True when the camera may be used. Never calls `requestAccess` without a
    /// usage description in Info.plist: that would crash the app.
    @MainActor
    private static func cameraAllowed() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            return true
        case .notDetermined:
            let described = Bundle.main.object(forInfoDictionaryKey: "NSCameraUsageDescription") as? String
            guard let described, !described.isEmpty else { return false }
            return await AVCaptureDevice.requestAccess(for: .video)
        default:
            return false
        }
    }

    @MainActor
    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
            ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var top = scene?.windows.first(where: \.isKeyWindow)?.rootViewController
            ?? scene?.windows.first?.rootViewController
        while let next = top?.presentedViewController { top = next }
        return top
    }
}

/// The three words on the scanner. A plugin package has no resource bundle in
/// this app, so the app's three languages live here.
private enum ScanCopy {
    private static let language: String = {
        let code = Bundle.main.preferredLocalizations.first ?? "en"
        if code.hasPrefix("es") { return "es" }
        if code.hasPrefix("pt") { return "pt" }
        return "en"
    }()
    private static func pick(_ en: String, _ es: String, _ pt: String) -> String {
        switch language {
        case "es": return es
        case "pt": return pt
        default: return en
        }
    }
    static var pointAtSticker: String { pick("Point at the sticker", "Apunta a la etiqueta", "Aponte para a etiqueta") }
    static var cancel: String { pick("Cancel", "Cancelar", "Cancelar") }
    static var useThis: String { pick("Use this", "Usar esto", "Usar isto") }
}

private enum ScanOutcome {
    case lines([String])
    case cancelled
    case failed(String)
}

/// One scanner presentation. Owns the controller, the buttons and the collected
/// strings; calls `finish` exactly once.
@MainActor
private final class LabelScanSession: NSObject, DataScannerViewControllerDelegate {
    private var scanner: DataScannerViewController?
    private var finish: ((ScanOutcome) -> Void)?
    private var items: [UUID: (text: String, top: CGFloat, left: CGFloat)] = [:]
    private var useButton: UIButton?

    func present(from presenter: UIViewController, finish: @escaping (ScanOutcome) -> Void) {
        self.finish = finish
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.text()],
            qualityLevel: .accurate,
            recognizesMultipleItems: true,
            isHighFrameRateTrackingEnabled: false,
            isPinchToZoomEnabled: true,
            isGuidanceEnabled: false,
            isHighlightingEnabled: true
        )
        scanner.delegate = self
        scanner.modalPresentationStyle = .fullScreen
        self.scanner = scanner
        installControls(on: scanner)
        presenter.present(scanner, animated: true) { [weak self, weak scanner] in
            guard let self, let scanner else { return }
            do {
                try scanner.startScanning()
            } catch {
                self.complete(.failed("unavailable"))
            }
        }
    }

    // MARK: Controls

    private func installControls(on scanner: DataScannerViewController) {
        let overlay = scanner.overlayContainerView

        let hint = UILabel()
        hint.text = ScanCopy.pointAtSticker
        hint.font = .preferredFont(forTextStyle: .headline)
        hint.adjustsFontForContentSizeCategory = true
        hint.textColor = .white
        hint.textAlignment = .center
        hint.numberOfLines = 0
        hint.translatesAutoresizingMaskIntoConstraints = false
        let hintBackground = UIView()
        hintBackground.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        hintBackground.layer.cornerRadius = 14
        hintBackground.translatesAutoresizingMaskIntoConstraints = false
        hintBackground.addSubview(hint)

        var cancelConfig = UIButton.Configuration.filled()
        cancelConfig.title = ScanCopy.cancel
        cancelConfig.baseBackgroundColor = UIColor.black.withAlphaComponent(0.55)
        cancelConfig.baseForegroundColor = .white
        cancelConfig.cornerStyle = .capsule
        let cancel = UIButton(configuration: cancelConfig, primaryAction: UIAction { [weak self] _ in
            self?.complete(.cancelled)
        })
        cancel.translatesAutoresizingMaskIntoConstraints = false

        var useConfig = UIButton.Configuration.filled()
        useConfig.title = ScanCopy.useThis
        useConfig.cornerStyle = .capsule
        useConfig.buttonSize = .large
        let use = UIButton(configuration: useConfig, primaryAction: UIAction { [weak self] _ in
            self?.useCurrentText()
        })
        use.isEnabled = false
        use.translatesAutoresizingMaskIntoConstraints = false
        useButton = use

        overlay.addSubview(hintBackground)
        overlay.addSubview(cancel)
        overlay.addSubview(use)
        let guide = overlay.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            cancel.topAnchor.constraint(equalTo: guide.topAnchor, constant: 12),
            cancel.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 16),
            hintBackground.topAnchor.constraint(equalTo: cancel.bottomAnchor, constant: 12),
            hintBackground.centerXAnchor.constraint(equalTo: guide.centerXAnchor),
            hintBackground.leadingAnchor.constraint(greaterThanOrEqualTo: guide.leadingAnchor, constant: 16),
            hint.topAnchor.constraint(equalTo: hintBackground.topAnchor, constant: 10),
            hint.bottomAnchor.constraint(equalTo: hintBackground.bottomAnchor, constant: -10),
            hint.leadingAnchor.constraint(equalTo: hintBackground.leadingAnchor, constant: 16),
            hint.trailingAnchor.constraint(equalTo: hintBackground.trailingAnchor, constant: -16),
            use.centerXAnchor.constraint(equalTo: guide.centerXAnchor),
            use.bottomAnchor.constraint(equalTo: guide.bottomAnchor, constant: -24),
            use.widthAnchor.constraint(greaterThanOrEqualToConstant: 160),
        ])
    }

    // MARK: Collecting text

    private func record(_ added: [RecognizedItem]) {
        for item in added {
            guard case .text(let text) = item else { continue }
            let transcript = text.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !transcript.isEmpty else { continue }
            items[item.id] = (transcript, text.bounds.topLeft.y, text.bounds.topLeft.x)
        }
        useButton?.isEnabled = !items.isEmpty
    }

    private func forget(_ removed: [RecognizedItem]) {
        for item in removed { items[item.id] = nil }
        useButton?.isEnabled = !items.isEmpty
    }

    /// Top to bottom, then left to right; each distinct line once.
    private func orderedLines() -> [String] {
        var seen = Set<String>()
        var lines: [String] = []
        for entry in items.values.sorted(by: { ($0.top, $0.left) < ($1.top, $1.left) }) {
            for raw in entry.text.split(whereSeparator: \.isNewline) {
                let line = raw.trimmingCharacters(in: .whitespaces)
                guard !line.isEmpty, seen.insert(line.lowercased()).inserted else { continue }
                lines.append(line)
            }
        }
        return lines
    }

    private func useCurrentText() {
        // Sync with what the scanner holds right now, then answer.
        complete(.lines(orderedLines()))
    }

    private func complete(_ outcome: ScanOutcome) {
        guard let finish else { return }
        self.finish = nil
        scanner?.stopScanning()
        let dismissed = scanner
        scanner = nil
        items.removeAll()
        let deliver = finish
        if let dismissed, dismissed.presentingViewController != nil {
            dismissed.dismiss(animated: true) { deliver(outcome) }
        } else {
            deliver(outcome)
        }
    }

    // MARK: DataScannerViewControllerDelegate

    func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        record(addedItems)
    }

    func dataScanner(_ dataScanner: DataScannerViewController, didUpdate updatedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        record(updatedItems)
    }

    func dataScanner(_ dataScanner: DataScannerViewController, didRemove removedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        forget(removedItems)
    }

    func dataScanner(_ dataScanner: DataScannerViewController, becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable) {
        switch error {
        case .cameraRestricted:
            complete(.failed("denied"))
        case .unsupported:
            complete(.failed("unsupported"))
        @unknown default:
            complete(.failed("unavailable"))
        }
    }
}
