import Foundation
import Capacitor
import WidgetKit

/// Writes the lock-screen glance to App Group UserDefaults.
/// The vault key stays in Keychain ThisDeviceOnly + biometry ACL and is never copied here.
@objc(CuidalaWidgetPlugin)
public class CuidalaWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CuidalaWidgetPlugin"
    public let jsName = "CuidalaWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearSnapshot", returnType: CAPPluginReturnPromise)
    ]

    private static let suiteName = "group.com.cuidala.app"
    private static let dueCountKey = "dueCount"
    private static let doneCountKey = "doneCount"
    private static let updatedAtKey = "updatedAt"
    private static let titlesKey = "titles"
    private static let dueLabelKey = "dueLabel"
    private static let doneLabelKey = "doneLabel"
    private static let emptyLabelKey = "emptyLabel"
    private static let runLengthKey = "runLength"
    private static let dayFractionKey = "dayFraction"
    private static let careLabelKey = "careLabel"
    private static let runLabelKey = "runLabel"

    @objc func updateSnapshot(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else {
            call.reject("App Group UserDefaults unavailable")
            return
        }
        let dueCount = call.getInt("dueCount") ?? 0
        let doneCount = call.getInt("doneCount") ?? 0
        let updatedAt = call.getString("updatedAt") ?? ""
        let titles = (call.getArray("titles") ?? []).compactMap { $0 as? String }
        defaults.set(dueCount, forKey: Self.dueCountKey)
        defaults.set(doneCount, forKey: Self.doneCountKey)
        defaults.set(updatedAt, forKey: Self.updatedAtKey)
        defaults.set(titles, forKey: Self.titlesKey)
        defaults.set(call.getString("dueLabel") ?? "", forKey: Self.dueLabelKey)
        defaults.set(call.getString("doneLabel") ?? "", forKey: Self.doneLabelKey)
        defaults.set(call.getString("emptyLabel") ?? "", forKey: Self.emptyLabelKey)
        defaults.set(call.getInt("runLength") ?? 0, forKey: Self.runLengthKey)
        defaults.set(call.getDouble("dayFraction") ?? 0, forKey: Self.dayFractionKey)
        defaults.set(call.getString("careLabel") ?? "", forKey: Self.careLabelKey)
        defaults.set(call.getString("runLabel") ?? "", forKey: Self.runLabelKey)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func clearSnapshot(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else {
            call.reject("App Group UserDefaults unavailable")
            return
        }
        defaults.removeObject(forKey: Self.dueCountKey)
        defaults.removeObject(forKey: Self.doneCountKey)
        defaults.removeObject(forKey: Self.updatedAtKey)
        defaults.removeObject(forKey: Self.titlesKey)
        defaults.removeObject(forKey: Self.dueLabelKey)
        defaults.removeObject(forKey: Self.doneLabelKey)
        defaults.removeObject(forKey: Self.emptyLabelKey)
        defaults.removeObject(forKey: Self.runLengthKey)
        defaults.removeObject(forKey: Self.dayFractionKey)
        defaults.removeObject(forKey: Self.careLabelKey)
        defaults.removeObject(forKey: Self.runLabelKey)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
