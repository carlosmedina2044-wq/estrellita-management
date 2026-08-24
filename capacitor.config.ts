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
  ios: {
    contentInset: "automatic",
    preferredContentMode: "recommended",
    limitsNavigationsToAppBoundDomains: true,
    scheme: "Cuidala",
  },
  plugins: {
    LocalNotifications: {
      iconColor: "#C45C26",
    },
    CapacitorHttp: { enabled: false },
  },
};

export default config;
