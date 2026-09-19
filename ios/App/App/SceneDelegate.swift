import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private let privacyTag = 918273

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // Dynamic color matches CSS --background so dark-mode overscroll is not cream.
        let fill = CuidalaBridgeViewController.shellBackground
        window?.backgroundColor = fill
        let bridge = CuidalaBridgeViewController()
        bridge.view.backgroundColor = fill
        window?.rootViewController = bridge
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func sceneWillResignActive(_ scene: UIScene) {
        guard let window, window.viewWithTag(privacyTag) == nil else { return }
        // Opaque, not a material: duty titles stayed readable through
        // `.systemUltraThinMaterial` in the app switcher.
        let cover = UIView(frame: window.bounds)
        cover.backgroundColor = CuidalaBridgeViewController.shellBackground
        cover.isOpaque = true
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.tag = privacyTag
        window.addSubview(cover)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        window?.viewWithTag(privacyTag)?.removeFromSuperview()
    }
}
