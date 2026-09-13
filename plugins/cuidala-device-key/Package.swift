// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CuidalaDeviceKey",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "CuidalaDeviceKey",
            targets: ["CuidalaDeviceKeyPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.5.0")
    ],
    targets: [
        .target(
            name: "CuidalaDeviceKeyPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/CuidalaDeviceKeyPlugin",
            linkerSettings: [
                .linkedFramework("Security")
            ]
        )
    ]
)
