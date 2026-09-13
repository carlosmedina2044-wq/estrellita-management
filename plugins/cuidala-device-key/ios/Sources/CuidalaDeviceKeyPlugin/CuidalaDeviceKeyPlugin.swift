import Capacitor
import Foundation
import LocalAuthentication
import Security

/// Device AES key in the data-protection keychain.
/// v2 is biometric/passcode-bound (`SecAccessControl`).
/// Still reads unbound v1 / `cap_sec` leftovers once, then migrates to v2 and deletes them.
@objc(CuidalaDeviceKeyPlugin)
public class CuidalaDeviceKeyPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CuidalaDeviceKeyPlugin"
    public let jsName = "CuidalaDeviceKey"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "verifyOwner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canEvaluate", returnType: CAPPluginReturnPromise),
    ]

    private static let currentService = "com.cuidala.app.device-key"
    private static let legacyService = "cap_sec"
    private static let v2Account = "cuidala-device-key-v2"
    private static let v1Account = "cuidala-device-key-v1"
    private let work = DispatchQueue(label: "com.cuidala.app.device-key")

    @objc func get(_ call: CAPPluginCall) {
        let key = call.getString("key") ?? ""
        let reason = call.getString("reason") ?? "Unlock Cuidala"
        let fallbackTitle = call.getString("fallbackTitle") ?? "Enter Passcode"
        work.async {
            do {
                if let value = try Self.read(key: key, reason: reason, fallbackTitle: fallbackTitle) {
                    call.resolve(["value": value])
                } else {
                    call.reject("Item with given key does not exist", "not_found")
                }
            } catch let error as DeviceKeyStoreError {
                call.reject(error.localizedDescription, error.code)
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func set(_ call: CAPPluginCall) {
        let key = call.getString("key") ?? ""
        let value = call.getString("value") ?? ""
        work.async {
            do {
                try Self.writeBound(account: key.isEmpty ? Self.v2Account : key, value: value)
                // Never leave unbound v1 readable after a successful v2 write.
                try Self.deleteUnboundLegacyKeys()
                call.resolve()
            } catch let error as DeviceKeyStoreError {
                call.reject(error.localizedDescription, error.code)
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        let key = call.getString("key") ?? ""
        work.async {
            do {
                try Self.delete(key: key)
                call.resolve()
            } catch let error as DeviceKeyStoreError {
                call.reject(error.localizedDescription, error.code)
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    /// Face ID / Touch ID with Apple’s system passcode fallback.
    /// Used for non-key actions (cleaner hand-back, disable lock, erase).
    /// Unlock of the vault key must use authenticated `get`, not this boolean gate.
    @objc func verifyOwner(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Unlock Cuidala"
        let fallbackTitle = call.getString("fallbackTitle") ?? "Enter Passcode"
        DispatchQueue.main.async {
            let context = LAContext()
            context.localizedFallbackTitle = fallbackTitle
            var error: NSError?
            let policy = LAPolicy.deviceOwnerAuthentication
            guard context.canEvaluatePolicy(policy, error: &error) else {
                call.reject(error?.localizedDescription ?? "Authentication not available", "auth_unavailable")
                return
            }
            context.evaluatePolicy(policy, localizedReason: reason) { success, evaluateError in
                if success {
                    call.resolve()
                    return
                }
                let nsError = evaluateError as NSError?
                if nsError?.code == LAError.userCancel.rawValue {
                    call.reject(evaluateError?.localizedDescription ?? "Cancelled", "user_canceled")
                    return
                }
                if nsError?.code == LAError.authenticationFailed.rawValue {
                    call.reject(evaluateError?.localizedDescription ?? "Authentication failed", "auth_failed")
                    return
                }
                call.reject(evaluateError?.localizedDescription ?? "Authentication failed", "auth_failed")
            }
        }
    }

    /// Pre-flight for Settings lock UI. Not a security control — callers must still authenticate.
    @objc func canEvaluate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let context = LAContext()
            var ownerError: NSError?
            let deviceIsSecure = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &ownerError)
            // Reading biometryType is only meaningful after a canEvaluatePolicy call.
            _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
            let biometryType: String
            switch context.biometryType {
            case .touchID:
                biometryType = "touchId"
            case .faceID:
                biometryType = "faceId"
            case .opticID:
                biometryType = "opticId"
            default:
                biometryType = "none"
            }
            call.resolve([
                "available": deviceIsSecure,
                "biometryType": biometryType,
                "deviceIsSecure": deviceIsSecure,
            ])
        }
    }

    // MARK: - Keychain

    private static func read(key: String, reason: String, fallbackTitle: String) throws -> String? {
        let requested = key.isEmpty ? v2Account : key

        // Prefer bound v2 (authenticated read — system prompt via ACL).
        if let value = try readBound(account: v2Account, reason: reason, fallbackTitle: fallbackTitle) {
            return value
        }
        if requested != v2Account, let value = try readBound(account: requested, reason: reason, fallbackTitle: fallbackTitle) {
            return value
        }

        // One-shot migration: unbound v1 / legacy → bound v2, then delete leftovers.
        if let legacy = try readUnboundLegacy() {
            try writeBound(account: v2Account, value: legacy)
            try deleteUnboundLegacyKeys()
            return legacy
        }

        return nil
    }

    private static func readBound(account: String, reason: String, fallbackTitle: String) throws -> String? {
        let context = LAContext()
        context.localizedReason = reason
        context.localizedFallbackTitle = fallbackTitle

        var result: AnyObject?
        var query = baseQuery(service: currentService, account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecUseAuthenticationContext as String] = context

        let status = SecItemCopyMatching(query as CFDictionary, &result)
        switch status {
        case errSecSuccess:
            if let data = result as? Data, let value = String(data: data, encoding: .utf8), !value.isEmpty {
                return value
            }
            return nil
        case errSecItemNotFound:
            return nil
        case errSecUserCanceled:
            throw DeviceKeyStoreError.userCanceled
        case errSecAuthFailed:
            throw DeviceKeyStoreError.authFailed
        case errSecInteractionNotAllowed:
            throw DeviceKeyStoreError.interactionNotAllowed
        default:
            throw DeviceKeyStoreError.osStatus(status)
        }
    }

    private static func readUnboundLegacy() throws -> String? {
        for service in [currentService, legacyService] {
            for account in accounts(for: v1Account) + accounts(for: "estrellita-device-key-v1") {
                var result: AnyObject?
                var query = baseQuery(service: service, account: account)
                query[kSecReturnData as String] = true
                query[kSecMatchLimit as String] = kSecMatchLimitOne
                // Skip UI for unbound leftovers; they have no ACL.
                query[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUISkip

                let status = SecItemCopyMatching(query as CFDictionary, &result)
                switch status {
                case errSecSuccess:
                    if let data = result as? Data, let value = String(data: data, encoding: .utf8), !value.isEmpty {
                        return value
                    }
                case errSecItemNotFound:
                    continue
                case errSecInteractionNotAllowed:
                    throw DeviceKeyStoreError.interactionNotAllowed
                case errSecUserCanceled:
                    throw DeviceKeyStoreError.userCanceled
                case errSecAuthFailed:
                    throw DeviceKeyStoreError.authFailed
                default:
                    // Unbound reads should not hit ACL errors; continue scanning.
                    continue
                }
            }
        }
        return nil
    }

    private static func writeBound(account: String, value: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw DeviceKeyStoreError.osStatus(errSecParam)
        }

        let context = LAContext()
        var authError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &authError) else {
            throw DeviceKeyStoreError.passcodeRequired
        }

        var error: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            [.biometryCurrentSet, .or, .devicePasscode],
            &error
        ) else {
            throw DeviceKeyStoreError.accessControlFailed(error?.takeRetainedValue())
        }

        // Add-then-delete: write under a temporary account first so a failed write
        // never leaves the device without the previous key.
        let pendingAccount = account + ".pending"
        for accountValue in accounts(for: pendingAccount) {
            _ = SecItemDelete(baseQuery(service: currentService, account: accountValue) as CFDictionary)
        }

        var pendingAdd = baseQuery(service: currentService, account: pendingAccount)
        pendingAdd[kSecValueData as String] = data
        pendingAdd[kSecAttrAccessControl as String] = access
        let pendingStatus = SecItemAdd(pendingAdd as CFDictionary, nil)
        switch pendingStatus {
        case errSecSuccess:
            break
        case errSecNotAvailable:
            throw DeviceKeyStoreError.passcodeRequired
        case errSecInteractionNotAllowed:
            throw DeviceKeyStoreError.interactionNotAllowed
        case errSecAuthFailed:
            throw DeviceKeyStoreError.authFailed
        case errSecUserCanceled:
            throw DeviceKeyStoreError.userCanceled
        default:
            throw DeviceKeyStoreError.osStatus(pendingStatus)
        }

        for accountValue in accounts(for: account) {
            let deleteStatus = SecItemDelete(baseQuery(service: currentService, account: accountValue) as CFDictionary)
            switch deleteStatus {
            case errSecSuccess, errSecItemNotFound:
                break
            case errSecInteractionNotAllowed:
                _ = SecItemDelete(baseQuery(service: currentService, account: pendingAccount) as CFDictionary)
                throw DeviceKeyStoreError.interactionNotAllowed
            default:
                _ = SecItemDelete(baseQuery(service: currentService, account: pendingAccount) as CFDictionary)
                throw DeviceKeyStoreError.osStatus(deleteStatus)
            }
        }

        var add = baseQuery(service: currentService, account: account)
        add[kSecValueData as String] = data
        add[kSecAttrAccessControl as String] = access
        let added = SecItemAdd(add as CFDictionary, nil)
        _ = SecItemDelete(baseQuery(service: currentService, account: pendingAccount) as CFDictionary)
        switch added {
        case errSecSuccess:
            return
        case errSecDuplicateItem:
            let updated = SecItemUpdate(
                baseQuery(service: currentService, account: account) as CFDictionary,
                [kSecValueData as String: data] as CFDictionary
            )
            guard updated == errSecSuccess else { throw DeviceKeyStoreError.osStatus(updated) }
        case errSecNotAvailable:
            throw DeviceKeyStoreError.passcodeRequired
        case errSecInteractionNotAllowed:
            throw DeviceKeyStoreError.interactionNotAllowed
        case errSecAuthFailed:
            throw DeviceKeyStoreError.authFailed
        case errSecUserCanceled:
            throw DeviceKeyStoreError.userCanceled
        default:
            throw DeviceKeyStoreError.osStatus(added)
        }
    }

    private static func deleteUnboundLegacyKeys() throws {
        for service in [currentService, legacyService] {
            for key in [v1Account, "estrellita-device-key-v1"] {
                for account in accounts(for: key) {
                    let status = SecItemDelete(baseQuery(service: service, account: account) as CFDictionary)
                    switch status {
                    case errSecSuccess, errSecItemNotFound:
                        continue
                    case errSecInteractionNotAllowed:
                        throw DeviceKeyStoreError.interactionNotAllowed
                    default:
                        throw DeviceKeyStoreError.osStatus(status)
                    }
                }
            }
        }
    }

    private static func delete(key: String) throws {
        if key.isEmpty {
            try deleteAllCuidalaDeviceKeys()
            return
        }
        let targets = [key, v2Account, v1Account, "estrellita-device-key-v1"]
        for service in [currentService, legacyService] {
            for target in targets {
                for account in accounts(for: target) {
                    let status = SecItemDelete(baseQuery(service: service, account: account) as CFDictionary)
                    switch status {
                    case errSecSuccess, errSecItemNotFound:
                        continue
                    case errSecInteractionNotAllowed:
                        throw DeviceKeyStoreError.interactionNotAllowed
                    default:
                        throw DeviceKeyStoreError.osStatus(status)
                    }
                }
            }
        }
    }

    /// Erase-all: delete every `cuidala-device-key-*` account (and known legacy ids).
    private static func deleteAllCuidalaDeviceKeys() throws {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: currentService,
            kSecMatchLimit as String: kSecMatchLimitAll,
            kSecReturnAttributes as String: true,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let items = result as? [[String: Any]] {
            for item in items {
                guard let account = item[kSecAttrAccount as String] else { continue }
                let accountString: String
                if let text = account as? String {
                    accountString = text
                } else if let data = account as? Data, let text = String(data: data, encoding: .utf8) {
                    accountString = text
                } else {
                    continue
                }
                guard accountString.hasPrefix("cuidala-device-key-") || accountString == "estrellita-device-key-v1" else {
                    continue
                }
                let deleteStatus = SecItemDelete(baseQuery(service: currentService, account: account) as CFDictionary)
                switch deleteStatus {
                case errSecSuccess, errSecItemNotFound:
                    continue
                case errSecInteractionNotAllowed:
                    throw DeviceKeyStoreError.interactionNotAllowed
                default:
                    throw DeviceKeyStoreError.osStatus(deleteStatus)
                }
            }
        } else if status != errSecItemNotFound {
            throw DeviceKeyStoreError.osStatus(status)
        }
        try deleteUnboundLegacyKeys()
    }

    private static func accounts(for key: String) -> [Any] {
        [key, Data(key.utf8)]
    }

    private static func baseQuery(service: String, account: Any) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}

private enum DeviceKeyStoreError: LocalizedError {
    case interactionNotAllowed
    case userCanceled
    case authFailed
    case passcodeRequired
    case accessControlFailed(CFError?)
    case osStatus(OSStatus)

    var code: String {
        switch self {
        case .interactionNotAllowed: return "interaction_not_allowed"
        case .userCanceled: return "user_canceled"
        case .authFailed: return "auth_failed"
        case .passcodeRequired: return "passcode_required"
        case .accessControlFailed: return "access_control_failed"
        case .osStatus: return "keychain_error"
        }
    }

    var errorDescription: String? {
        switch self {
        case .interactionNotAllowed:
            return "User interaction is not allowed"
        case .userCanceled:
            return "User canceled authentication"
        case .authFailed:
            return "Authentication failed"
        case .passcodeRequired:
            return "Device passcode required"
        case .accessControlFailed(let error):
            return error?.localizedDescription ?? "Could not create access control"
        case .osStatus(let status):
            return "Keychain error \(status)"
        }
    }
}
