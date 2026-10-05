// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CuidalaIntelligence",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "CuidalaIntelligence",
            targets: ["CuidalaIntelligencePlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.5.0")
    ],
    targets: [
        .target(
            name: "CuidalaIntelligencePlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/CuidalaIntelligencePlugin",
            swiftSettings: [
                // Match the app target's SWIFT_STRICT_CONCURRENCY = complete.
                // SPM packages do not inherit the Xcode project's build settings.
                .enableExperimentalFeature("StrictConcurrency")
            ],
            linkerSettings: [
                // FoundationModels only exists on iOS 26+. Link it weakly so the app
                // still launches on iOS 16.4-25; every use is behind #available.
                .unsafeFlags(["-Xlinker", "-weak_framework", "-Xlinker", "FoundationModels"])
            ]
        )
    ]
)
