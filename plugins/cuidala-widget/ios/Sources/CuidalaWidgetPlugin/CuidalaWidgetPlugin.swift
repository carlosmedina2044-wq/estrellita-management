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
    // The house (E3-04): style and season only, never a room name or a coordinate.
    private static let kitTypeKey = "kitType"
    private static let paletteKey = "palette"
    private static let seasonKey = "season"
    private static let windowStatesKey = "windowStates"
    private static let layerFilesKey = "layerFiles"
    private static let phaseTimesKey = "phaseTimes"
    private static let allKeys = [
        dueCountKey, doneCountKey, updatedAtKey, titlesKey, dueLabelKey, doneLabelKey, emptyLabelKey,
        runLengthKey, dayFractionKey, careLabelKey, runLabelKey,
        kitTypeKey, paletteKey, seasonKey, windowStatesKey, layerFilesKey, phaseTimesKey
    ]

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

        defaults.set(call.getString("kitType") ?? "", forKey: Self.kitTypeKey)
        defaults.set(call.getString("palette") ?? "", forKey: Self.paletteKey)
        defaults.set(call.getString("season") ?? "", forKey: Self.seasonKey)
        defaults.set(call.getString("windowStates") ?? "", forKey: Self.windowStatesKey)
        let phaseTimes = (call.getArray("phaseTimes") ?? []).compactMap { ($0 as? NSNumber)?.intValue }
        defaults.set(phaseTimes, forKey: Self.phaseTimesKey)
        let layerFiles = (call.getArray("layerFiles") ?? []).compactMap { $0 as? String }
        defaults.set(Self.syncPortraits(layerFiles), forKey: Self.layerFilesKey)

        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func clearSnapshot(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else {
            call.reject("App Group UserDefaults unavailable")
            return
        }
        for key in Self.allKeys {
            defaults.removeObject(forKey: key)
        }
        if let directory = Self.portraitsDirectory {
            try? FileManager.default.removeItem(at: directory)
        }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    // MARK: - Portrait layers for the extension

    private static var portraitsDirectory: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: suiteName)?
            .appendingPathComponent("portraits", isDirectory: true)
    }

    /// Copies the handful of layer files for the current kit, palette and
    /// season from the app's web bundle (`public/portraits/…`) into the App
    /// Group container, and removes anything else there, so the extension can
    /// draw the house from ~150 KB of files instead of shipping every kit
    /// twice. Returns the basenames in the order given.
    private static func syncPortraits(_ webPaths: [String]) -> [String] {
        guard let directory = portraitsDirectory else { return [] }
        let fileManager = FileManager.default
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        var wanted: [String] = []
        for path in webPaths {
            let basename = (path as NSString).lastPathComponent
            guard !basename.isEmpty else { continue }
            let name = (basename as NSString).deletingPathExtension
            let ext = (basename as NSString).pathExtension
            guard let source = Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "public/portraits") else {
                continue
            }
            let destination = directory.appendingPathComponent(basename)
            if !sameSize(source, destination) {
                try? fileManager.removeItem(at: destination)
                try? fileManager.copyItem(at: source, to: destination)
            }
            wanted.append(basename)
        }
        let keep = Set(wanted)
        if let present = try? fileManager.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) {
            for url in present where !keep.contains(url.lastPathComponent) {
                try? fileManager.removeItem(at: url)
            }
        }
        return wanted
    }

    private static func sameSize(_ a: URL, _ b: URL) -> Bool {
        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: b.path),
              let sizeA = try? fileManager.attributesOfItem(atPath: a.path)[.size] as? NSNumber,
              let sizeB = try? fileManager.attributesOfItem(atPath: b.path)[.size] as? NSNumber else {
            return false
        }
        return sizeA == sizeB
    }
}
