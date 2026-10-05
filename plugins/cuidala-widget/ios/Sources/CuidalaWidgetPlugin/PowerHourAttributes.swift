import ActivityKit
import Foundation

/// A timed cleaning session. ActivityKit matches the app's copy of this type
/// to the extension's by name and Codable shape, so this file is duplicated
/// byte for byte in `plugins/cuidala-widget/ios/Sources/CuidalaWidgetPlugin/PowerHourAttributes.swift`.
/// Change both together.
struct PowerHourAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var left: Int
        var nextTitle: String?
        var endsAt: Date
        var finished: Bool
    }

    var title: String
    var total: Int
}
