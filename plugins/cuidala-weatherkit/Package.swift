// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CuidalaWeatherkit",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "CuidalaWeatherkit",
            targets: ["CuidalaWeatherKitPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.5.0")
    ],
    targets: [
        .target(
            name: "CuidalaWeatherKitPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/CuidalaWeatherKitPlugin",
            linkerSettings: [
                .linkedFramework("WeatherKit"),
                .linkedFramework("CoreLocation")
            ]
        )
    ]
)
