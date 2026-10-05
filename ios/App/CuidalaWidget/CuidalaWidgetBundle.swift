import SwiftUI
import WidgetKit

@main
struct CuidalaWidgetBundle: WidgetBundle {
    var body: some Widget {
        CuidalaWidget()
        PowerHourLiveActivity()
        if #available(iOS 18.0, *) {
            ScanSomethingControl()
            StartPowerHourControl()
        }
    }
}
