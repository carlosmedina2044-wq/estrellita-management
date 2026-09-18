import BackgroundTasks
import CoreLocation
import Foundation
import UserNotifications
import WeatherKit

/// Weather alerts while the app is closed (E3-02).
///
/// The vault key is bound to Face ID, so nothing native can read the
/// household in the background. Instead the web side publishes a small
/// plaintext watch list (`CuidalaWeatherKitPlugin.updateWatchList`): one
/// entry per weather trigger that applies to the home, with its threshold
/// and localised copy, plus the home's coordinates rounded to two decimals.
/// This task fetches the WeatherKit daily forecast for those coordinates no
/// more than every six hours, compares each entry, and posts one local
/// notification per trigger per cooldown. Tapping it opens the app, which
/// fetches the forecast itself and adds the weather chores to Today.
enum WeatherRefresh {
    static let taskIdentifier = "com.cuidala.app.weather-refresh"
    static let watchListKey = "cuidala.weatherWatch"
    static let firedKeyPrefix = "cuidala.weatherFired."
    static let minimumInterval: TimeInterval = 6 * 60 * 60

    struct Entry: Decodable {
        let id: String
        let metric: String
        let op: String
        let value: Double
        let withinDays: Int
        let cooldownDays: Int
        let title: String
        let body: String
    }

    struct Watch: Decodable {
        let latitude: Double
        let longitude: Double
        let entries: [Entry]
    }

    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskIdentifier, using: nil) { task in
            guard let refresh = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            handle(refresh)
        }
    }

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: minimumInterval)
        try? BGTaskScheduler.shared.submit(request)
    }

    static func readWatch(from defaults: UserDefaults = .standard) -> Watch? {
        guard let data = defaults.data(forKey: watchListKey) else { return nil }
        return try? JSONDecoder().decode(Watch.self, from: data)
    }

    private static func handle(_ task: BGAppRefreshTask) {
        schedule()
        guard let watch = readWatch(), !watch.entries.isEmpty else {
            task.setTaskCompleted(success: true)
            return
        }
        let work = Task {
            do {
                let location = CLLocation(latitude: watch.latitude, longitude: watch.longitude)
                let daily = try await WeatherService.shared.weather(for: location, including: .daily)
                let now = Date()
                let hits = evaluate(watch, days: daily.forecast.map(DaySample.init), now: now)
                if !hits.isEmpty, await notificationsAllowed() {
                    for entry in hits {
                        await notify(entry, now: now)
                    }
                }
                task.setTaskCompleted(success: true)
            } catch {
                task.setTaskCompleted(success: false)
            }
        }
        task.expirationHandler = { work.cancel() }
    }

    /// One day of forecast in the units the watch list speaks.
    struct DaySample {
        let date: Date
        let tempMinF: Double
        let tempMaxF: Double
        let windMph: Double
        let precipIn: Double

        init(_ day: DayWeather) {
            date = day.date
            tempMinF = day.lowTemperature.converted(to: .fahrenheit).value
            tempMaxF = day.highTemperature.converted(to: .fahrenheit).value
            windMph = day.wind.speed.converted(to: .milesPerHour).value
            precipIn = day.precipitationAmount.converted(to: .inches).value
        }

        init(date: Date, tempMinF: Double, tempMaxF: Double, windMph: Double, precipIn: Double) {
            self.date = date
            self.tempMinF = tempMinF
            self.tempMaxF = tempMaxF
            self.windMph = windMph
            self.precipIn = precipIn
        }

        func value(for metric: String) -> Double? {
            switch metric {
            case "tempMinF": return tempMinF
            case "tempMaxF": return tempMaxF
            case "windMph": return windMph
            case "precipIn": return precipIn
            default: return nil
            }
        }
    }

    /// Entries whose condition a day inside their window meets and that have
    /// not fired within their cooldown. Mirrors `conditionHits` in the web app.
    static func evaluate(_ watch: Watch, days: [DaySample], now: Date, defaults: UserDefaults = .standard) -> [Entry] {
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: now)
        return watch.entries.filter { entry in
            if let fired = defaults.object(forKey: firedKeyPrefix + entry.id) as? Date,
               now.timeIntervalSince(fired) < Double(entry.cooldownDays) * 86_400 {
                return false
            }
            guard let end = calendar.date(byAdding: .day, value: entry.withinDays, to: now) else { return false }
            return days.contains { day in
                guard day.date >= startOfToday, day.date <= end, let value = day.value(for: entry.metric) else { return false }
                switch entry.op {
                case "<": return value < entry.value
                case ">": return value > entry.value
                case ">=": return value >= entry.value
                default: return false
                }
            }
        }
    }

    private static func notificationsAllowed() async -> Bool {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        return settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
    }

    private static func notify(_ entry: Entry, now: Date) async {
        let content = UNMutableNotificationContent()
        content.title = entry.title
        content.body = entry.body
        content.sound = .default
        content.userInfo = ["tab": "today", "weatherTriggerId": entry.id]
        let request = UNNotificationRequest(identifier: "weather-\(entry.id)", content: content, trigger: nil)
        do {
            try await UNUserNotificationCenter.current().add(request)
            UserDefaults.standard.set(now, forKey: firedKeyPrefix + entry.id)
        } catch {
            // A failed post is not worth a crash; the next refresh tries again.
        }
    }
}
