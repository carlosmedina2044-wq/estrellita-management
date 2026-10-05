import AppIntents
import UIKit

/// "What's left today?" Reads the plaintext snapshot only, so it answers
/// without opening the app or asking for Face ID.
struct WhatsLeftIntent: AppIntent {
    static let title: LocalizedStringResource = "What's left today"
    static let description = IntentDescription("Hear what is left to do today.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        .result(dialog: IntentDialog(stringLiteral: Self.spokenAnswer(for: CuidalaIntentsStore.todayList())))
    }

    /// Plain words, number first: how many are left is what tells you you are done.
    static func spokenAnswer(for today: CuidalaIntentsSnapshot.Today?) -> String {
        guard let today else {
            return NSLocalizedString("intent.left.stale", value: "Open Cuidala once to see what's left today.", comment: "")
        }
        if today.left == 0 {
            return NSLocalizedString("intent.left.none", value: "Nothing left today. You're all done.", comment: "")
        }
        let titles = today.items.prefix(3).map(\.title).filter { !$0.isEmpty }
        if titles.isEmpty {
            let key = today.left == 1 ? "intent.left.one.bare" : "intent.left.many.bare"
            let fallback = today.left == 1 ? "1 thing left today." : "%lld things left today."
            let format = NSLocalizedString(key, value: fallback, comment: "")
            return today.left == 1 ? format : String(format: format, today.left)
        }
        let list = ListFormatter.localizedString(byJoining: Array(titles))
        let key = today.left == 1 ? "intent.left.one" : "intent.left.many"
        let fallback = today.left == 1 ? "1 thing left today: %@." : "%lld things left today: %@."
        let format = NSLocalizedString(key, value: fallback, comment: "")
        return today.left == 1 ? String(format: format, list) : String(format: format, today.left, list)
    }
}

/// "Scan a label". Opens the app on the scan sheet through `cuidala://scan`.
struct OpenScannerIntent: AppIntent {
    static let title: LocalizedStringResource = "Scan a label"
    static let description = IntentDescription("Open Cuidala and scan the sticker on an appliance.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        await UIApplication.shared.open(CuidalaLink.scan)
        return .result()
    }
}

// MarkDoneIntent ("Mark the dishes done") is deliberately NOT here. Completing
// a chore means reading and re-saving the household, which lives in the Face ID
// bound vault. An intent would either have to unlock it with no one looking at
// the phone or write a second, unauthenticated copy of the household. Neither is
// acceptable, so marking things done stays inside the app.

struct CuidalaShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: WhatsLeftIntent(),
            phrases: [
                "What's left in \(.applicationName)",
                "What's left today in \(.applicationName)",
                "What's left to do in \(.applicationName)",
                "Ask \(.applicationName) what's left",
            ],
            shortTitle: "What's left today",
            systemImageName: "checklist"
        )
        AppShortcut(
            intent: OpenScannerIntent(),
            phrases: [
                "Scan a label in \(.applicationName)",
                "Scan a sticker in \(.applicationName)",
                "Scan an appliance with \(.applicationName)",
            ],
            shortTitle: "Scan a label",
            systemImageName: "camera.viewfinder"
        )
    }
}
