import Foundation
import Capacitor
import CoreLocation
import WeatherKit

private actor AttributionCacheStore {
    private var cache: [String: String]?

    func get() -> [String: String]? {
        cache
    }

    func set(_ value: [String: String]) {
        cache = value
    }
}

@objc(CuidalaWeatherKitPlugin)
public class CuidalaWeatherKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CuidalaWeatherKitPlugin"
    public let jsName = "CuidalaWeatherKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "fetchForecast", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "geocodeZip", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reverseGeocode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetchAttribution", returnType: CAPPluginReturnPromise)
    ]

    private static let attributionCache = AttributionCacheStore()

    private static let isoDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    @objc func fetchForecast(_ call: CAPPluginCall) {
        guard let latitude = call.getDouble("latitude"),
              let longitude = call.getDouble("longitude") else {
            call.reject("latitude and longitude are required")
            return
        }
        let location = CLLocation(latitude: latitude, longitude: longitude)
        Task {
            do {
                let forecast = try await WeatherService.shared.weather(for: location, including: .daily)
                let days: [[String: Any]] = forecast.forecast.prefix(7).map { day in
                    [
                        "date": Self.isoDate(day.date),
                        "tempMinF": day.lowTemperature.converted(to: .fahrenheit).value,
                        "tempMaxF": day.highTemperature.converted(to: .fahrenheit).value,
                        "windMph": day.wind.speed.converted(to: .milesPerHour).value,
                        "precipIn": day.precipitationAmount.converted(to: .inches).value
                    ]
                }
                let fetchedAt = ISO8601DateFormatter().string(from: .now)
                await MainActor.run {
                    call.resolve([
                        "days": days,
                        "fetchedAt": fetchedAt
                    ])
                }
            } catch {
                await MainActor.run {
                    call.reject(error.localizedDescription)
                }
            }
        }
    }

    @objc func geocodeZip(_ call: CAPPluginCall) {
        guard let postalCode = call.getString("postalCode"), !postalCode.isEmpty else {
            call.reject("postalCode is required")
            return
        }
        let geocoder = CLGeocoder()
        geocoder.geocodeAddressString("\(postalCode), United States") { placemarks, error in
            Task { @MainActor in
                if let error {
                    call.reject(error.localizedDescription)
                    return
                }
                guard let place = placemarks?.first, let location = place.location else {
                    call.reject("No place found for that ZIP")
                    return
                }
                var result: [String: Any] = [
                    "lat": location.coordinate.latitude,
                    "lng": location.coordinate.longitude
                ]
                if let city = place.locality, !city.isEmpty {
                    result["placeName"] = city
                }
                call.resolve(result)
            }
        }
    }

    @objc func reverseGeocode(_ call: CAPPluginCall) {
        guard let latitude = call.getDouble("latitude"),
              let longitude = call.getDouble("longitude") else {
            call.reject("latitude and longitude are required")
            return
        }
        let location = CLLocation(latitude: latitude, longitude: longitude)
        CLGeocoder().reverseGeocodeLocation(location) { placemarks, error in
            Task { @MainActor in
                if let error {
                    call.reject(error.localizedDescription)
                    return
                }
                var result: [String: Any] = [:]
                if let city = placemarks?.first?.locality, !city.isEmpty {
                    result["placeName"] = city
                }
                call.resolve(result)
            }
        }
    }

    @objc func fetchAttribution(_ call: CAPPluginCall) {
        Task {
            if let cached = await Self.attributionCache.get() {
                await MainActor.run {
                    call.resolve(cached)
                }
                return
            }
            do {
                let attribution = try await WeatherService.shared.attribution
                async let lightData = URLSession.shared.data(from: attribution.combinedMarkLightURL)
                async let darkData = URLSession.shared.data(from: attribution.combinedMarkDarkURL)
                let (light, _) = try await lightData
                let (dark, _) = try await darkData
                let legalText: String
                if #available(iOS 16.4, *) {
                    legalText = attribution.legalAttributionText
                } else {
                    legalText = "Other data sources"
                }
                let payload: [String: String] = [
                    "legalPageURL": attribution.legalPageURL.absoluteString,
                    "legalText": legalText,
                    "markLight": "data:image/png;base64,\(light.base64EncodedString())",
                    "markDark": "data:image/png;base64,\(dark.base64EncodedString())"
                ]
                await Self.attributionCache.set(payload)
                await MainActor.run {
                    call.resolve(payload)
                }
            } catch {
                await MainActor.run {
                    call.reject(error.localizedDescription)
                }
            }
        }
    }

    private static func isoDate(_ date: Date) -> String {
        isoDateFormatter.string(from: date)
    }
}
