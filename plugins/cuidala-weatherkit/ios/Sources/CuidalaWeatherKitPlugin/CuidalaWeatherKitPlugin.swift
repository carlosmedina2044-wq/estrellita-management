import Foundation
import Capacitor
import CoreLocation
import WeatherKit

@objc(CuidalaWeatherKitPlugin)
public class CuidalaWeatherKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CuidalaWeatherKitPlugin"
    public let jsName = "CuidalaWeatherKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "fetchForecast", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "geocodeZip", returnType: CAPPluginReturnPromise)
    ]

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
                call.resolve([
                    "days": days,
                    "fetchedAt": ISO8601DateFormatter().string(from: Date())
                ])
            } catch {
                call.reject(error.localizedDescription)
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

    private static func isoDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
