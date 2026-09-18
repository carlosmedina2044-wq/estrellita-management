import Foundation
import UIKit
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
    static let kitTypeKey = "kitType"
    static let paletteKey = "palette"
    static let seasonKey = "season"
    static let windowStatesKey = "windowStates"
    static let layerFilesKey = "layerFiles"
    static let phaseTimesKey = "phaseTimes"
    static let todayURL = URL(string: "cuidala://today")

    static var portraitsDirectory: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: suiteName)?
            .appendingPathComponent("portraits", isDirectory: true)
    }

    static func read(now: Date = Date()) -> CuidalaWidgetSnapshot {
        let defaults = UserDefaults(suiteName: suiteName)
        let titles = defaults?.stringArray(forKey: titlesKey) ?? []
        let windowStates = (defaults?.string(forKey: windowStatesKey) ?? "")
            .split(separator: ",")
            .map { String($0) }
        let phaseTimes = (defaults?.array(forKey: phaseTimesKey) as? [Int]) ?? []
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
            runLabel: defaults?.string(forKey: runLabelKey) ?? "",
            kitType: defaults?.string(forKey: kitTypeKey) ?? "",
            palette: defaults?.string(forKey: paletteKey) ?? "",
            season: defaults?.string(forKey: seasonKey) ?? "",
            windowStates: windowStates,
            layerFiles: defaults?.stringArray(forKey: layerFilesKey) ?? [],
            phaseTimes: phaseTimes
        )
    }
}

enum SkyPhase {
    case night, dawn, day, golden, dusk
}

struct SkySample {
    let phase: SkyPhase
    /// Progress through the phase, 0 to 1.
    let t: Double
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
    let kitType: String
    let palette: String
    let season: String
    /// Per window, in kit order: "lit", "dim" or "off".
    let windowStates: [String]
    /// Basenames in the App Group container: shadow, night, day, lit, foliage
    /// night, foliage day, snow.
    let layerFiles: [String]
    /// Minutes of the day: dawn start, dawn end, golden start, golden end,
    /// dusk start, dusk end. Mirrors `phaseBoundaries` in the web app.
    let phaseTimes: [Int]

    var isEmpty: Bool {
        dueCount == 0 && doneCount == 0
    }

    /// The same glance at another moment on the timeline.
    func at(_ other: Date) -> CuidalaWidgetSnapshot {
        CuidalaWidgetSnapshot(
            date: other, dueCount: dueCount, doneCount: doneCount, titles: titles, dueLabel: dueLabel,
            doneLabel: doneLabel, emptyLabel: emptyLabel, runLength: runLength, dayFraction: dayFraction,
            careLabel: careLabel, runLabel: runLabel, kitType: kitType, palette: palette, season: season,
            windowStates: windowStates, layerFiles: layerFiles, phaseTimes: phaseTimes
        )
    }

    var houseAvailable: Bool {
        layerFiles.count >= 7 && CuidalaWidgetStore.portraitsDirectory != nil
    }

    /// 0 shadow, 1 night, 2 day, 3 lit, 4 foliage night, 5 foliage day, 6 snow.
    func layerImage(_ index: Int) -> UIImage? {
        guard index < layerFiles.count, let directory = CuidalaWidgetStore.portraitsDirectory else { return nil }
        return UIImage(contentsOfFile: directory.appendingPathComponent(layerFiles[index]).path)
    }

    /// How much of the lit layer to show: lit windows count fully, dim ones a little.
    var litFraction: Double {
        guard !windowStates.isEmpty else { return 0 }
        let total = Double(windowStates.count)
        let lit = windowStates.reduce(0.0) { sum, state in
            switch state {
            case "lit": return sum + 1
            case "dim": return sum + 0.35
            default: return sum
            }
        }
        return lit / total
    }

    /// Fallback sun when the snapshot carries no phase times: 06:30 up, 19:30 down.
    static let fallbackPhaseTimes = [350, 415, 1110, 1160, 1160, 1205]

    var boundaries: [Int] {
        phaseTimes.count == 6 ? phaseTimes : Self.fallbackPhaseTimes
    }

    func skySample(at moment: Date) -> SkySample {
        let comps = Calendar.current.dateComponents([.hour, .minute], from: moment)
        let now = Double((comps.hour ?? 0) * 60 + (comps.minute ?? 0))
        let b = boundaries.map(Double.init)
        let (dawnStart, dawnEnd, goldenStart, goldenEnd, duskStart, duskEnd) = (b[0], b[1], b[2], b[3], b[4], b[5])
        func span(_ start: Double, _ end: Double) -> Double {
            min(1, max(0, (now - start) / max(1, end - start)))
        }
        if now >= dawnStart && now < dawnEnd { return SkySample(phase: .dawn, t: span(dawnStart, dawnEnd)) }
        if now >= dawnEnd && now < goldenStart { return SkySample(phase: .day, t: span(dawnEnd, goldenStart)) }
        if now >= goldenStart && now < goldenEnd { return SkySample(phase: .golden, t: span(goldenStart, goldenEnd)) }
        if now >= duskStart && now < duskEnd { return SkySample(phase: .dusk, t: span(duskStart, duskEnd)) }
        let nightLength = (dawnStart + 1440 - duskEnd).truncatingRemainder(dividingBy: 1440)
        let into = now >= duskEnd ? now - duskEnd : now + (1440 - duskEnd)
        return SkySample(phase: .night, t: nightLength > 0 ? min(1, max(0, into / nightLength)) : 0)
    }

    /// The moments in the next day at which the sky changes phase, for the timeline.
    func phaseChangeDates(after start: Date) -> [Date] {
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: start)
        var dates: [Date] = []
        for dayOffset in 0...1 {
            guard let day = calendar.date(byAdding: .day, value: dayOffset, to: startOfToday) else { continue }
            for minutes in Set(boundaries) {
                guard let moment = calendar.date(byAdding: .minute, value: minutes, to: day), moment > start else { continue }
                dates.append(moment)
            }
        }
        return dates.sorted()
    }
}
