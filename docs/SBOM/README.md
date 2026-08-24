# SBOM

Per-release CycloneDX files belong here (`backend-<version>.cdx.json`, `ios-<version>.cdx.json`).

NOT VERIFIED — no SBOM has been generated in CI yet. Intended command once the gate is wired:

```bash
npx @cyclonedx/cyclonedx-npm --output-file docs/SBOM/backend.cdx.json
```

iOS SBOM requires the Xcode project from `npx cap add ios` plus a SwiftPM/CycloneDX step.
