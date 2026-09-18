import SwiftUI
import WidgetKit

@main
struct CuidalaWidget: Widget {
    let kind = "CuidalaToday"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CuidalaWidgetProvider()) { entry in
            CuidalaWidgetEntryView(snapshot: entry)
                .widgetURL(CuidalaWidgetStore.todayURL)
        }
        .configurationDisplayName(Text("widget.galleryName", comment: "Widget gallery title."))
        .description(Text("widget.galleryDescription", comment: "Widget gallery subtitle."))
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
            .systemSmall,
            .systemMedium
        ])
    }
}

struct CuidalaWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> CuidalaWidgetSnapshot {
        CuidalaWidgetStore.read()
    }

    func getSnapshot(in context: Context, completion: @escaping (CuidalaWidgetSnapshot) -> Void) {
        completion(CuidalaWidgetStore.read())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CuidalaWidgetSnapshot>) -> Void) {
        let now = Date()
        let snapshot = CuidalaWidgetStore.read(now: now)
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: now)
        let nextMidnight = calendar.date(byAdding: .day, value: 1, to: startOfToday) ?? now.addingTimeInterval(86_400)
        // The sky changes at each phase boundary, so the house gets a fresh
        // entry there: dark windows under a night sky at 7 pm without the app
        // ever opening. Midnight rolls the day counts.
        var moments = [now]
        moments.append(contentsOf: snapshot.phaseChangeDates(after: now).filter { $0 < nextMidnight })
        moments.append(nextMidnight)
        completion(Timeline(entries: moments.map { snapshot.at($0) }, policy: .after(nextMidnight)))
    }
}

struct CuidalaWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let snapshot: CuidalaWidgetSnapshot

    var body: some View {
        switch family {
        case .accessoryCircular:
            CuidalaCircularView(snapshot: snapshot)
        case .accessoryRectangular:
            CuidalaRectangularView(snapshot: snapshot)
        case .accessoryInline:
            CuidalaInlineView(snapshot: snapshot)
        case .systemMedium:
            CuidalaMediumView(snapshot: snapshot)
        default:
            CuidalaSmallView(snapshot: snapshot)
        }
    }
}

// MARK: - Sky

/// Colour stops for each phase, mirroring `sky.ts` in the web app (clear weather).
enum SkyPalette {
    typealias RGB = (r: Double, g: Double, b: Double)
    struct Stops {
        let top: RGB
        let mid: RGB
        let horizon: RGB
    }

    private static func rgb(_ hex: UInt32) -> RGB {
        (Double((hex >> 16) & 0xFF) / 255, Double((hex >> 8) & 0xFF) / 255, Double(hex & 0xFF) / 255)
    }

    private static func base(_ phase: SkyPhase) -> Stops {
        switch phase {
        case .night: return Stops(top: rgb(0x0f1626), mid: rgb(0x1a2238), horizon: rgb(0x2a2f45))
        case .dawn: return Stops(top: rgb(0x4a5a86), mid: rgb(0xc98a6b), horizon: rgb(0xf2c9a0))
        case .day: return Stops(top: rgb(0x8fb8e8), mid: rgb(0xc9dcf0), horizon: rgb(0xeef2f0))
        case .golden: return Stops(top: rgb(0x6f8fc2), mid: rgb(0xe6a56a), horizon: rgb(0xf6d3a2))
        case .dusk: return Stops(top: rgb(0x2b3358), mid: rgb(0x7a5a7a), horizon: rgb(0xe08a6a))
        }
    }

    private static func next(_ phase: SkyPhase) -> SkyPhase {
        switch phase {
        case .night: return .dawn
        case .dawn: return .day
        case .day: return .golden
        case .golden: return .dusk
        case .dusk: return .night
        }
    }

    private static func mix(_ a: RGB, _ b: RGB, _ t: Double) -> RGB {
        (a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t)
    }

    static func stops(for sample: SkySample) -> Stops {
        let a = base(sample.phase)
        let b = base(next(sample.phase))
        // Ease toward the next phase late in this one, so day stays day.
        let t = max(0, sample.t - 0.7) / 0.3
        return Stops(top: mix(a.top, b.top, t), mid: mix(a.mid, b.mid, t), horizon: mix(a.horizon, b.horizon, t))
    }

    static func color(_ c: RGB) -> Color {
        Color(red: c.r, green: c.g, blue: c.b)
    }

    /// Mirrors `dayOpacityForPhase` in the web app.
    static func dayOpacity(_ sample: SkySample) -> Double {
        switch sample.phase {
        case .day: return 1
        case .night: return 0
        case .dawn: return 0.15 + sample.t * 0.85
        case .golden: return 1 - sample.t * 0.35
        case .dusk: return 0.65 * (1 - sample.t)
        }
    }

    /// Ink on a light sky, cream on a dark one (relative luminance of the top stop).
    static func textOnSky(_ stops: Stops) -> Color {
        let c = stops.top
        func lin(_ v: Double) -> Double { v <= 0.03928 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
        let luminance = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
        return luminance > 0.45 ? Color(red: 0.11, green: 0.11, blue: 0.12) : Color(red: 0.97, green: 0.95, blue: 0.93)
    }
}

extension View {
    /// The sky fills the whole widget on iOS 17 (container background) and the
    /// view's own background before that.
    @ViewBuilder
    func skyBackground<B: View>(_ background: B) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { background }
        } else {
            self.background(background)
        }
    }
}

struct SkyGradient: View {
    let stops: SkyPalette.Stops
    var body: some View {
        LinearGradient(
            stops: [
                .init(color: SkyPalette.color(stops.top), location: 0),
                .init(color: SkyPalette.color(stops.mid), location: 0.55),
                .init(color: SkyPalette.color(stops.horizon), location: 1)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

// MARK: - The house

/// The layered portrait from the App Group container, lit by the current
/// phase: shadow, night, day (crossfaded), the lit windows, and the foliage.
struct HouseStack: View {
    let snapshot: CuidalaWidgetSnapshot
    let dayOpacity: Double

    var body: some View {
        ZStack {
            layer(0)
            layer(1)
            layer(2).opacity(dayOpacity)
            layer(3).opacity(snapshot.litFraction).blendMode(.screen)
            layer(4)
            layer(5).opacity(dayOpacity)
        }
    }

    @ViewBuilder
    private func layer(_ index: Int) -> some View {
        if let image = snapshot.layerImage(index) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
        }
    }
}

struct CuidalaSmallView: View {
    let snapshot: CuidalaWidgetSnapshot

    var body: some View {
        if snapshot.houseAvailable {
            let sample = snapshot.skySample(at: snapshot.date)
            let stops = SkyPalette.stops(for: sample)
            let ink = SkyPalette.textOnSky(stops)
            VStack(alignment: .leading, spacing: 0) {
                HouseStack(snapshot: snapshot, dayOpacity: SkyPalette.dayOpacity(sample))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                Text(snapshot.isEmpty ? snapshot.emptyLabel : snapshot.dueLabel)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(ink)
                    .lineLimit(1)
                if snapshot.runLength > 0, !snapshot.runLabel.isEmpty {
                    Text(snapshot.runLabel)
                        .font(.caption2)
                        .foregroundStyle(ink.opacity(0.75))
                        .lineLimit(1)
                }
            }
            .skyBackground(SkyGradient(stops: stops))
        } else {
            CuidalaSmallTextView(snapshot: snapshot)
        }
    }
}

struct CuidalaMediumView: View {
    let snapshot: CuidalaWidgetSnapshot

    var body: some View {
        if snapshot.houseAvailable {
            let sample = snapshot.skySample(at: snapshot.date)
            let stops = SkyPalette.stops(for: sample)
            let ink = SkyPalette.textOnSky(stops)
            HStack(alignment: .center, spacing: 12) {
                HouseStack(snapshot: snapshot, dayOpacity: SkyPalette.dayOpacity(sample))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                VStack(alignment: .leading, spacing: 4) {
                    Text(snapshot.isEmpty ? snapshot.emptyLabel : snapshot.dueLabel)
                        .font(.headline)
                        .foregroundStyle(ink)
                    Text(snapshot.doneLabel)
                        .font(.subheadline)
                        .foregroundStyle(ink.opacity(0.75))
                    if !snapshot.careLabel.isEmpty {
                        Text(snapshot.careLabel)
                            .font(.caption)
                            .foregroundStyle(ink.opacity(0.75))
                    }
                    if snapshot.runLength > 0, !snapshot.runLabel.isEmpty {
                        Text(snapshot.runLabel)
                            .font(.caption)
                            .foregroundStyle(ink.opacity(0.75))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .skyBackground(SkyGradient(stops: stops))
        } else {
            CuidalaSmallTextView(snapshot: snapshot)
        }
    }
}

// MARK: - Lock screen and text fallbacks

struct CuidalaCircularView: View {
    let snapshot: CuidalaWidgetSnapshot

    var body: some View {
        Gauge(value: snapshot.dayFraction) {
            Text("\(snapshot.dueCount)")
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .accessibilityLabel(snapshot.dueLabel)
    }
}

struct CuidalaRectangularView: View {
    let snapshot: CuidalaWidgetSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(snapshot.dueLabel)
                .font(.headline)
                .widgetAccentable()
            if !snapshot.careLabel.isEmpty {
                Text(snapshot.careLabel)
                    .font(.caption)
                    .lineLimit(1)
            } else if snapshot.isEmpty {
                Text(snapshot.emptyLabel)
                    .font(.caption)
            } else if let title = snapshot.titles.first {
                Text(title)
                    .font(.caption)
                    .lineLimit(1)
            } else {
                Text(snapshot.doneLabel)
                    .font(.caption)
            }
            if snapshot.runLength > 0, !snapshot.runLabel.isEmpty {
                Text(snapshot.runLabel)
                    .font(.caption2)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct CuidalaInlineView: View {
    let snapshot: CuidalaWidgetSnapshot

    var body: some View {
        if snapshot.isEmpty {
            Text(snapshot.emptyLabel)
        } else if let title = snapshot.titles.first {
            Text("\(snapshot.dueCount) · \(title)")
        } else {
            Text(snapshot.dueLabel)
        }
    }
}

/// The pre-house small widget, kept as the fallback when the house layers are
/// not in the container yet (first launch before the app has written them).
struct CuidalaSmallTextView: View {
    let snapshot: CuidalaWidgetSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(snapshot.isEmpty ? snapshot.emptyLabel : snapshot.dueLabel)
                .font(.headline)
            Text(snapshot.doneLabel)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if !snapshot.careLabel.isEmpty {
                Text(snapshot.careLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if snapshot.runLength > 0, !snapshot.runLabel.isEmpty {
                Text(snapshot.runLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if !snapshot.titles.isEmpty {
                ForEach(snapshot.titles, id: \.self) { title in
                    Text(title)
                        .font(.caption)
                        .lineLimit(1)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
