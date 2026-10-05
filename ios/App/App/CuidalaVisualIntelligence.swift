import AppIntents
import UIKit

// The VisualIntelligence framework ships in the device SDK only, not the
// simulator SDK, so only the query that takes a `SemanticContentDescriptor` is
// compiled for devices. The entity, matcher and open intent always compile.
#if canImport(VisualIntelligence)
import VisualIntelligence
#endif

/// A saved appliance, as the system's visual intelligence camera shows it.
/// Built only from the plaintext snapshot; nothing here can reach the vault.
@available(iOS 26, *)
struct ApplianceEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation {
        TypeDisplayRepresentation(
            name: LocalizedStringResource("Appliance"),
            numericFormat: "\(placeholder: .int) appliances"
        )
    }

    static let defaultQuery = ApplianceEntityQuery()

    let id: String
    let name: String
    let roomId: String
    let roomName: String
    let ageYears: Int?

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)", subtitle: "\(subtitleText)")
    }

    /// "12 years old · Kitchen", or just the room when no install date is known.
    var subtitleText: String {
        guard let ageYears else { return roomName }
        let key = ageYears == 1 ? "appliance.subtitle.one" : "appliance.subtitle.many"
        let fallback = ageYears == 1 ? "1 year old · %@" : "%lld years old · %@"
        let format = NSLocalizedString(key, value: fallback, comment: "")
        return ageYears == 1 ? String(format: format, roomName) : String(format: format, ageYears, roomName)
    }

    init(_ appliance: CuidalaIntentsSnapshot.Appliance) {
        id = appliance.id
        name = appliance.name
        roomId = appliance.roomId
        roomName = appliance.roomName
        ageYears = appliance.ageYears
    }
}

@available(iOS 26, *)
struct ApplianceEntityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [ApplianceEntity] {
        let all = CuidalaIntentsStore.read()?.appliances ?? []
        return identifiers.compactMap { id in all.first { $0.id == id }.map(ApplianceEntity.init) }
    }

    func suggestedEntities() async throws -> [ApplianceEntity] {
        (CuidalaIntentsStore.read()?.appliances ?? []).prefix(5).map(ApplianceEntity.init)
    }
}

/// Camera labels are general en_US terms ("refrigerator", "water heater") that
/// the system neither translates nor expands, so each saved appliance type
/// carries the labels that can mean it.
enum ApplianceLabelMatcher {
    static let labelsByType: [String: [String]] = [
        "refrigerator": ["refrigerator", "fridge", "freezer"],
        "fridge": ["refrigerator", "fridge", "freezer"],
        "water_heater": ["water heater", "boiler", "hot water heater"],
        "washer": ["washing machine", "washer", "laundry machine"],
        "dryer": ["dryer", "clothes dryer", "tumble dryer"],
        "range_oven": ["oven", "stove", "range", "cooktop", "microwave oven"],
        "dishwasher": ["dishwasher"],
        "microwave": ["microwave", "microwave oven"],
        "furnace": ["furnace", "heater"],
        "hvac_system": ["air conditioner", "air conditioning", "heat pump", "hvac", "furnace"],
        "hvac": ["air conditioner", "air conditioning", "heat pump", "hvac", "furnace"],
        "evaporative_cooler": ["air conditioner", "swamp cooler", "evaporative cooler"],
        "garbage_disposal": ["garbage disposal", "disposal"],
        "air_purifier": ["air purifier"],
        "water_softener": ["water softener"],
        "smoke_detector": ["smoke detector", "smoke alarm"],
        "sump_pump": ["sump pump"],
    ]

    /// The saved appliances a set of camera labels points at. Matches the
    /// appliance type first, then a label appearing in the name the person gave
    /// it. No match means no result: nothing is ever invented.
    static func matches(
        labels: [String],
        in appliances: [CuidalaIntentsSnapshot.Appliance],
        limit: Int = 5
    ) -> [CuidalaIntentsSnapshot.Appliance] {
        let wanted = labels.map { $0.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        guard !wanted.isEmpty else { return [] }
        let hits = appliances.filter { appliance in
            let known = labelsByType[appliance.type] ?? []
            let name = appliance.name.lowercased()
            return wanted.contains { label in
                known.contains(label) || name.contains(label)
            }
        }
        return Array(hits.prefix(limit))
    }
}

#if canImport(VisualIntelligence)
@available(iOS 26, *)
struct ApplianceIntentValueQuery: IntentValueQuery {
    func values(for input: SemanticContentDescriptor) async throws -> [ApplianceEntity] {
        let appliances = CuidalaIntentsStore.read()?.appliances ?? []
        return ApplianceLabelMatcher.matches(labels: input.labels, in: appliances).map(ApplianceEntity.init)
    }
}
#endif

/// Tapping the card in visual intelligence results opens that appliance's room.
@available(iOS 26, *)
struct OpenApplianceIntent: OpenIntent {
    static let title: LocalizedStringResource = "Open appliance"
    static let openAppWhenRun = true

    @Parameter(title: "Appliance")
    var target: ApplianceEntity

    @MainActor
    func perform() async throws -> some IntentResult {
        if let url = CuidalaLink.room(target.roomId) {
            await UIApplication.shared.open(url)
        }
        return .result()
    }
}
