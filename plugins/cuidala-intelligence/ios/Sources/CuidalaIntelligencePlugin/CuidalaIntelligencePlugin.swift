import Capacitor
import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

/// Proposes structure for scanned or typed text using the on-device Apple Intelligence
/// model. Nothing leaves the phone (no Private Cloud Compute). The model only proposes:
/// the TypeScript layer validates every field before anything is shown or saved.
/// On iOS < 26, with Apple Intelligence off, or when the SDK lacks the framework, every
/// method except `availability` rejects with "unavailable".
@objc(CuidalaIntelligencePlugin)
public class CuidalaIntelligencePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CuidalaIntelligencePlugin"
    public let jsName = "CuidalaIntelligence"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "structureLabel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "structureReceipt", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tellCuidala", returnType: CAPPluginReturnPromise),
    ]

    @objc func availability(_ call: CAPPluginCall) {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            if let reason = IntelligenceEngine.unavailableReason() {
                call.resolve(["available": false, "reason": reason])
            } else {
                call.resolve(["available": true])
            }
            return
        }
        #endif
        call.resolve(["available": false, "reason": "deviceNotEligible"])
    }

    @objc func structureLabel(_ call: CAPPluginCall) {
        let lines = Self.strings(call, "lines")
        run(call) {
            #if canImport(FoundationModels)
            if #available(iOS 26.0, *) {
                return try await IntelligenceEngine.structureLabel(lines: lines)
            }
            #endif
            throw Self.unavailable
        }
    }

    @objc func structureReceipt(_ call: CAPPluginCall) {
        let lines = Self.strings(call, "lines")
        let tracked = Self.strings(call, "trackedNames")
        run(call) {
            #if canImport(FoundationModels)
            if #available(iOS 26.0, *) {
                return try await IntelligenceEngine.structureReceipt(lines: lines, trackedNames: tracked)
            }
            #endif
            throw Self.unavailable
        }
    }

    @objc func tellCuidala(_ call: CAPPluginCall) {
        let text = call.getString("text") ?? ""
        let today = call.getString("today") ?? ""
        let context = call.getObject("context")
        let rooms = Self.strings(context?["rooms"])
        let duties = Self.strings(context?["duties"])
        let supplies = Self.strings(context?["supplies"])
        run(call) {
            #if canImport(FoundationModels)
            if #available(iOS 26.0, *) {
                return try await IntelligenceEngine.tellCuidala(
                    text: text, rooms: rooms, duties: duties, supplies: supplies, today: today)
            }
            #endif
            throw Self.unavailable
        }
    }

    // MARK: helpers

    private static var unavailable: any Error { PluginFailure(code: "unavailable") }

    private struct PluginFailure: Error { let code: String }

    private static func strings(_ call: CAPPluginCall, _ key: String) -> [String] {
        strings(call.getArray(key))
    }

    private static func strings(_ value: Any?) -> [String] {
        (value as? [Any])?.compactMap { $0 as? String } ?? []
    }

    /// Runs `work` off the call's thread and resolves or rejects. Never throws out.
    private func run(_ call: CAPPluginCall, _ work: @escaping @Sendable () async throws -> [String: any Sendable]) {
        Task { @MainActor in
            do {
                let result = try await work()
                call.resolve(result)
            } catch is CancellationError {
                call.reject("Cancelled", "failed")
            } catch {
                call.reject("Could not read that", Self.code(for: error))
            }
        }
    }

    private static func code(for error: Error) -> String {
        if let failure = error as? PluginFailure { return failure.code }
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *), let failure = error as? IntelligenceFailure { return failure.code }
        #endif
        return "failed"
    }
}
