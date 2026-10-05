import Foundation

/// What Siri, Spotlight and Visual Intelligence may know about the house.
///
/// The household lives in a Face ID bound vault that native code can never
/// open, so this plaintext, privacy-minimal snapshot is the ONLY source. The
/// web layer writes it into the App Group on every save (see
/// `intentsSnapshotFor` in `src/lib/intents-snapshot.ts` and
/// `CuidalaWidgetPlugin`). The vault key is never stored here.
struct CuidalaIntentsSnapshot: Decodable {
    struct Appliance: Decodable {
        let id: String
        let name: String
        /// Canonical asset type, for example "water_heater".
        let type: String
        let roomId: String
        let roomName: String
        let ageYears: Int?
        let yearsLeft: Double?
        let status: String?
    }

    struct Item: Decodable {
        let id: String
        let title: String
    }

    struct Today: Decodable {
        /// Local calendar day the list was written for, "YYYY-MM-DD".
        let day: String
        let left: Int
        let items: [Item]
    }

    let appliances: [Appliance]
    let today: Today
}

enum CuidalaIntentsStore {
    static let suiteName = "group.com.cuidala.app"
    static let snapshotKey = "intentsSnapshot"

    static func read() -> CuidalaIntentsSnapshot? {
        guard let data = UserDefaults(suiteName: suiteName)?.data(forKey: snapshotKey) else { return nil }
        return try? JSONDecoder().decode(CuidalaIntentsSnapshot.self, from: data)
    }

    /// The same "YYYY-MM-DD" the web layer writes, in the phone's calendar.
    static func localDay(_ date: Date = Date()) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    /// Today's list, or nil when the app has not written one today. Never
    /// read yesterday's list out loud as if it were today's.
    static func todayList(now: Date = Date()) -> CuidalaIntentsSnapshot.Today? {
        guard let today = read()?.today, today.day == localDay(now) else { return nil }
        return today
    }
}

/// The app's own deep links, handled in `src/lib/widget-url.ts`.
enum CuidalaLink {
    static let scan = URL(string: "cuidala://scan")!

    static func room(_ id: String) -> URL? {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "/")
        guard let encoded = id.addingPercentEncoding(withAllowedCharacters: allowed) else { return nil }
        return URL(string: "cuidala://room/\(encoded)")
    }
}
