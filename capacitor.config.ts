import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The web bundle in `out/` (from `npm run build`) is packaged into the app.
 * There is no `server.url`: the app never loads remote code, which is what
 * App Store Guideline 4.2 (minimum functionality) and 2.5.2 (no remote code)
 * look for. `npm run cap:sync` builds and copies the bundle.
 */
const config: CapacitorConfig = {
  appId: "com.cuidala.app",
  appName: "Cuidala",
  webDir: "out",
  loggingBehavior: "none",
  // Match brand cream so the status-bar / Dynamic Island region is never white
  // when contentInset is never (edge-to-edge WebView).
  backgroundColor: "#f4f1ec",
  ios: {
    contentInset: "never",
    preferredContentMode: "recommended",
    // WeatherKit is native. No WKWebView weather hosts, so no app-bound domains.
    limitsNavigationsToAppBoundDomains: false,
    scheme: "Cuidala",
    loggingBehavior: "none",
    // Capacitor's iOS default is YES: a long-press on any link renders the
    // third-party page inside the app's own WebKit process. Nothing here
    // benefits from a peek, so it stays off.
    allowsLinkPreview: false,
  },
  plugins: {
    LocalNotifications: {
      iconColor: "#A8481F",
    },
    SplashScreen: {
      // No `backgroundColor` on purpose. The plugin re-instantiates the
      // LaunchScreen storyboard and, when this key is set, overwrites the
      // storyboard's background with that one static hex — which defeated the
      // `LaunchBackground` colour set (#f4f1ec / #121110) and flashed the light colour on a
      // dark launch. Left unset, the storyboard's own dynamic colour applies,
      // and `Splash.imageset` carries a matching dark artwork.
      launchAutoHide: false,
      showSpinner: false,
    },
    CapacitorHttp: { enabled: false },
  },
};

export default config;
