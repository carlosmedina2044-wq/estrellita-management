import Foundation

/// Everything that crosses into the model, or comes back out, is cleaned here.
/// Pure Foundation: compiles and runs on every iOS version.
enum IntelligenceText {
    static let maxLineLength = 160
    static let maxLines = 80
    static let maxFreeText = 600
    static let maxNames = 60
    static let maxNameLength = 80
    static let maxField = 120
    static let maxNotes = 240

    /// Strips control characters (newlines and tabs become spaces), collapses
    /// whitespace, trims, and clamps to `limit` characters. Empty becomes nil.
    static func clean(_ raw: String?, limit: Int) -> String? {
        guard let raw else { return nil }
        var out = String.UnicodeScalarView()
        for scalar in raw.unicodeScalars {
            if scalar == "\n" || scalar == "\r" || scalar == "\t" {
                out.append(" ")
            } else if CharacterSet.controlCharacters.contains(scalar)
                        || scalar.properties.generalCategory == .format
                        || scalar.properties.generalCategory == .control {
                continue
            } else {
                out.append(scalar)
            }
        }
        let collapsed = String(out)
            .split(separator: " ", omittingEmptySubsequences: true)
            .joined(separator: " ")
        let clamped = String(collapsed.prefix(limit))
        let trimmed = clamped.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? nil : trimmed
    }

    static func cleanLines(_ raw: [String], maxCount: Int, limit: Int) -> [String] {
        var result: [String] = []
        for line in raw {
            guard let cleaned = clean(line, limit: limit) else { continue }
            result.append(cleaned)
            if result.count >= maxCount { break }
        }
        return result
    }

    /// Finite and inside `range`, else nil.
    static func number(_ value: Double?, in range: ClosedRange<Double>) -> Double? {
        guard let value, value.isFinite, range.contains(value) else { return nil }
        return value
    }

    static func integer(_ value: Int?, in range: ClosedRange<Int>) -> Int? {
        guard let value, range.contains(value) else { return nil }
        return value
    }
}
