// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CuidalaWidget",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "CuidalaWidget",
            targets: ["CuidalaWidgetPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.5.0")
    ],
    targets: [
        .target(
            name: "CuidalaWidgetPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/CuidalaWidgetPlugin",
            swiftSettings: [
                // Match the app target's SWIFT_STRICT_CONCURRENCY = complete.
                // SPM packages do not inherit the Xcode project's build settings.
                .enableExperimentalFeature("StrictConcurrency")
            ],
            linkerSettings: [
                .linkedFramework("WidgetKit")
            ]
        )
    ]
)
