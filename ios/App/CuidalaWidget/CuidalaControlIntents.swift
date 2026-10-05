import AppIntents
#if !CUIDALA_EXTENSION
import UIKit
#endif

/// Intents behind the Control Center / Lock Screen controls. This file is a
/// member of BOTH the app and the widget extension: a control that opens the
/// app needs the intent in both. The extension copy never runs `perform()`
/// (`openAppWhenRun` hands it to the app process), which is why the
/// `UIApplication` call is compiled out of the extension.

@available(iOS 16.4, *)
struct OpenScanControlIntent: AppIntent {
    static let title: LocalizedStringResource = "Scan something"
    static let description = IntentDescription("Open Cuidala and point the camera at a label or sticker.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        #if !CUIDALA_EXTENSION
        if let url = URL(string: "cuidala://scan") { await UIApplication.shared.open(url) }
        #endif
        return .result()
    }
}

@available(iOS 16.4, *)
struct StartPowerHourControlIntent: AppIntent {
    static let title: LocalizedStringResource = "Start power hour"
    static let description = IntentDescription("Open Cuidala and start a timed cleaning session.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        #if !CUIDALA_EXTENSION
        if let url = URL(string: "cuidala://power-hour") { await UIApplication.shared.open(url) }
        #endif
        return .result()
    }
}
