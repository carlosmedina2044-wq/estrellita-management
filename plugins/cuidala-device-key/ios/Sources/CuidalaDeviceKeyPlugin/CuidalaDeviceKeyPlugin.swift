import Capacitor
import Foundation
import Security

/// Device AES key in the data-protection keychain.
/// Reads leftovers from capacitor-secure-storage-plugin (`cap_sec`, Data account)
/// and writes with a String account so SecItemAdd/Update can succeed after uninstall.
@objc(CuidalaDeviceKeyPlugin)
public class CuidalaDeviceKeyPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CuidalaDeviceKeyPlugin"
    public let jsName = "CuidalaDeviceKey"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
    ]

    private static let currentService = "com.cuidala.app.device-key"
    private static let legacyService = "cap_sec"
    private let work = DispatchQueue(label: "com.cuidala.app.device-key")

    @objc func get(_ call: CAPPluginCall) {
        let key = call.getString("key") ?? ""
        work.async {
            do {
                if let value = try Self.read(key: key) {
                    call.resolve(["value": value])
                } else {
                    call.reject("Item with given key does not exist")
                }
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
                try Self.write(key: key, value: value)
                call.resolve()
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
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private static func read(key: String) throws -> String? {
        for service in [currentService, legacyService] {
            for account in accounts(for: key) {
                var result: AnyObject?
                let status = SecItemCopyMatching(query(service: service, account: account, returningData: true) as CFDictionary, &result)
                switch status {
                case errSecSuccess:
                    if let data = result as? Data, let value = String(data: data, encoding: .utf8), !value.isEmpty {
                        return value
                    }
                case errSecItemNotFound:
                    continue
                case errSecInteractionNotAllowed:
                    throw DeviceKeyStoreError.interactionNotAllowed
                default:
                    throw DeviceKeyStoreError.osStatus(status)
                }
            }
        }
        return nil
    }

    private static func write(key: String, value: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw DeviceKeyStoreError.osStatus(errSecParam)
        }
        var add = query(service: currentService, account: key, returningData: false)
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let added = SecItemAdd(add as CFDictionary, nil)
        switch added {
        case errSecSuccess:
            return
        case errSecDuplicateItem:
            let updated = SecItemUpdate(
                query(service: currentService, account: key, returningData: false) as CFDictionary,
                [kSecValueData as String: data] as CFDictionary
            )
            guard updated == errSecSuccess else { throw DeviceKeyStoreError.osStatus(updated) }
        case errSecInteractionNotAllowed:
            throw DeviceKeyStoreError.interactionNotAllowed
        default:
            throw DeviceKeyStoreError.osStatus(added)
        }
    }

    private static func delete(key: String) throws {
        for service in [currentService, legacyService] {
            for account in accounts(for: key) {
                let status = SecItemDelete(query(service: service, account: account, returningData: false) as CFDictionary)
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

    private static func accounts(for key: String) -> [Any] {
        [key, Data(key.utf8)]
    }

    private static func query(service: String, account: Any, returningData: Bool) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        if returningData {
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
        }
        return query
    }
}

private enum DeviceKeyStoreError: LocalizedError {
    case interactionNotAllowed
    case osStatus(OSStatus)

    var errorDescription: String? {
        switch self {
        case .interactionNotAllowed:
            return "User interaction is not allowed"
        case .osStatus(let status):
            return "Keychain error \(status)"
        }
    }
}
