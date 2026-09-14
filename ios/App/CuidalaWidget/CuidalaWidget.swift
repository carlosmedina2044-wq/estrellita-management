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
            .systemSmall
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
        let entry = CuidalaWidgetStore.read(now: now)
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: now)
        let nextMidnight = calendar.date(byAdding: .day, value: 1, to: startOfToday) ?? now.addingTimeInterval(86_400)
        completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
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
        default:
            CuidalaSmallView(snapshot: snapshot)
        }
    }
}

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

struct CuidalaSmallView: View {
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
