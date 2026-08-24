import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.estrellita.management",
  appName: "Estrellita",
  webDir: "out",
  server: {
    // Dev builds can point at next dev. Release loads the bundled web assets
    // after `npm run cap:export` or the production origin.
    androidScheme: "https",
    iosScheme: "https",
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SignInWithApple: {},
  },
};

export default config;
