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
    static let runLengthKey = "runLength"
    static let dayFractionKey = "dayFraction"
    static let careLabelKey = "careLabel"
    static let runLabelKey = "runLabel"
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
            emptyLabel: defaults?.string(forKey: emptyLabelKey) ?? "",
            runLength: defaults?.integer(forKey: runLengthKey) ?? 0,
            dayFraction: defaults?.double(forKey: dayFractionKey) ?? 0,
            careLabel: defaults?.string(forKey: careLabelKey) ?? "",
            runLabel: defaults?.string(forKey: runLabelKey) ?? ""
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
    let runLength: Int
    let dayFraction: Double
    let careLabel: String
    let runLabel: String

    var isEmpty: Bool {
        dueCount == 0 && doneCount == 0
    }
}
