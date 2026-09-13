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
  // Match brand cream so the status-bar / Dynamic Island region is never white
  // when contentInset is never (edge-to-edge WebView).
  backgroundColor: "#faf6ef",
  ios: {
    contentInset: "never",
    preferredContentMode: "recommended",
    // WeatherKit is native. No WKWebView weather hosts, so no app-bound domains.
    limitsNavigationsToAppBoundDomains: false,
    scheme: "Cuidala",
  },
  plugins: {
    LocalNotifications: {
      iconColor: "#9A5A35",
    },
    CapacitorHttp: { enabled: false },
  },
};

export default config;
