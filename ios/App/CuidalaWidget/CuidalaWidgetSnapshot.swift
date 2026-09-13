import Foundation
import WidgetKit

/// Shared App Group glance. Keys must match `CuidalaWidgetPlugin`.
/// The vault key is never stored here.
enum CuidalaWidgetStore {
    static let suiteName = "group.com.cuidala.app"
    static let dueCountKey = "dueCount"
    static let doneCountKey = "doneCount"
    static let updatedAtKey = "updatedAt"
    static let titlesKey = "titles"
    static let dueLabelKey = "dueLabel"
    static let doneLabelKey = "doneLabel"
    static let emptyLabelKey = "emptyLabel"
    static let todayURL = URL(string: "cuidala://today")

    static func read(now: Date = Date()) -> CuidalaWidgetSnapshot {
        let defaults = UserDefaults(suiteName: suiteName)
        let titles = defaults?.stringArray(forKey: titlesKey) ?? []
        return CuidalaWidgetSnapshot(
            date: now,
            dueCount: defaults?.integer(forKey: dueCountKey) ?? 0,
            doneCount: defaults?.integer(forKey: doneCountKey) ?? 0,
            titles: titles,
            dueLabel: defaults?.string(forKey: dueLabelKey) ?? "",
            doneLabel: defaults?.string(forKey: doneLabelKey) ?? "",
            emptyLabel: defaults?.string(forKey: emptyLabelKey) ?? ""
        )
    }
}

struct CuidalaWidgetSnapshot: TimelineEntry {
    let date: Date
    let dueCount: Int
    let doneCount: Int
    let titles: [String]
    let dueLabel: String
    let doneLabel: String
    let emptyLabel: String

    var isEmpty: Bool {
        dueCount == 0 && doneCount == 0
    }
}
