import SwiftUI
import UIKit

/// The one place the extension's brand colours live. Slate blue matches the
/// web app: #2f5d8a on light, #8fb6e0 on dark.
enum CuidalaPalette {
    /// Slate blue, adapting to light and dark.
    static let accent = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? hex(0x8fb6e0) : hex(0x2f5d8a)
    })

    /// Track behind a progress bar.
    static let track = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? hex(0x8fb6e0, alpha: 0.25) : hex(0x2f5d8a, alpha: 0.18)
    })

    /// Lock Screen card tint. Kept quiet so the numbers carry the view.
    static let activityBackground = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? hex(0x14202e) : hex(0xeef3f9)
    })

    private static func hex(_ value: UInt32, alpha: CGFloat = 1) -> UIColor {
        UIColor(
            red: CGFloat((value >> 16) & 0xFF) / 255,
            green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255,
            alpha: alpha
        )
    }
}
