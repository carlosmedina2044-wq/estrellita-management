import AppIntents
import SwiftUI
import WidgetKit

/// Control Center / Lock Screen / Action button controls. iOS 18 and later;
/// the widget bundle only lists them there.
@available(iOS 18.0, *)
struct ScanSomethingControl: ControlWidget {
    static let kind = "com.cuidala.app.control.scan"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenScanControlIntent()) {
                Label("control.scan.label", systemImage: "viewfinder")
            }
        }
        .displayName("control.scan.label")
        .description("control.scan.description")
    }
}

@available(iOS 18.0, *)
struct StartPowerHourControl: ControlWidget {
    static let kind = "com.cuidala.app.control.powerHour"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: StartPowerHourControlIntent()) {
                Label("control.powerHour.label", systemImage: "timer")
            }
        }
        .displayName("control.powerHour.label")
        .description("control.powerHour.description")
    }
}
