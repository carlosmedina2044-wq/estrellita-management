import ActivityKit
import SwiftUI
import WidgetKit

private func powerHourLeftText(_ left: Int) -> String {
    String(
        format: String(localized: "powerHour.left", defaultValue: "%lld left", comment: "Chores left in the timed session."),
        left
    )
}

private let powerHourAllDone = String(
    localized: "powerHour.allDone", defaultValue: "All done", comment: "Timed session finished."
)

private func powerHourNextText(_ title: String) -> String {
    String(
        format: String(localized: "powerHour.next", defaultValue: "Next: %@", comment: "The next chore in the timed session."),
        title
    )
}

private func progress(_ attributes: PowerHourAttributes, _ state: PowerHourAttributes.ContentState) -> Double {
    guard attributes.total > 0 else { return state.finished ? 1 : 0 }
    if state.finished { return 1 }
    return min(1, max(0, Double(attributes.total - state.left) / Double(attributes.total)))
}

/// Time left, counting down to `endsAt`. Past it the system stops the clock at zero.
private struct PowerHourTimer: View {
    let endsAt: Date

    var body: some View {
        Text(timerInterval: Date.now...max(Date.now, endsAt), countsDown: true)
            .monospacedDigit()
            .multilineTextAlignment(.trailing)
    }
}

struct PowerHourBar: View {
    let value: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(CuidalaPalette.track)
                Capsule()
                    .fill(CuidalaPalette.accent)
                    .frame(width: max(0, proxy.size.width * value))
            }
        }
        .frame(height: 6)
        .accessibilityElement()
        .accessibilityLabel(Text("powerHour.progress", comment: "Progress through the timed session."))
        .accessibilityValue(Text(value, format: .percent.precision(.fractionLength(0))))
    }
}

struct PowerHourLockScreenView: View {
    let attributes: PowerHourAttributes
    let state: PowerHourAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if state.finished {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(CuidalaPalette.accent)
                    Text(powerHourAllDone)
                        .font(.system(.title, design: .rounded, weight: .bold))
                        .foregroundStyle(CuidalaPalette.accent)
                }
                PowerHourBar(value: 1)
            } else {
                HStack(alignment: .firstTextBaseline) {
                    Text(powerHourLeftText(state.left))
                        .font(.system(.largeTitle, design: .rounded, weight: .bold))
                        .foregroundStyle(CuidalaPalette.accent)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    PowerHourTimer(endsAt: state.endsAt)
                        .font(.system(.title3, design: .rounded, weight: .semibold))
                        .foregroundStyle(.primary)
                }
                PowerHourBar(value: progress(attributes, state))
                if let next = state.nextTitle, !next.isEmpty {
                    Text(powerHourNextText(next))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(16)
    }
}

struct PowerHourLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PowerHourAttributes.self) { context in
            PowerHourLockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(CuidalaPalette.activityBackground)
                .activitySystemActionForegroundColor(CuidalaPalette.accent)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    if context.state.finished {
                        Label(powerHourAllDone, systemImage: "checkmark.circle.fill")
                            .font(.system(.headline, design: .rounded))
                            .foregroundStyle(CuidalaPalette.accent)
                    } else {
                        Text(powerHourLeftText(context.state.left))
                            .font(.system(.title2, design: .rounded, weight: .bold))
                            .foregroundStyle(CuidalaPalette.accent)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if !context.state.finished {
                        PowerHourTimer(endsAt: context.state.endsAt)
                            .font(.system(.title3, design: .rounded, weight: .semibold))
                            .frame(maxWidth: 90, alignment: .trailing)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        PowerHourBar(value: progress(context.attributes, context.state))
                        if !context.state.finished, let next = context.state.nextTitle, !next.isEmpty {
                            Text(powerHourNextText(next))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "house.fill")
                    .foregroundStyle(CuidalaPalette.accent)
            } compactTrailing: {
                if context.state.finished {
                    Image(systemName: "checkmark")
                        .foregroundStyle(CuidalaPalette.accent)
                } else {
                    Text("\(context.state.left)")
                        .font(.system(.body, design: .rounded, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(CuidalaPalette.accent)
                }
            } minimal: {
                if context.state.finished {
                    Image(systemName: "checkmark")
                        .foregroundStyle(CuidalaPalette.accent)
                } else {
                    Text("\(context.state.left)")
                        .font(.system(.body, design: .rounded, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(CuidalaPalette.accent)
                }
            }
            .keylineTint(CuidalaPalette.accent)
        }
    }
}
