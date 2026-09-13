# App Store submission package (Cuidala 1.0)

Actionable checklist for a human to archive, upload, and submit Cuidala for App Review. Agent-completable work on branch `pre-submission-hardening` is done through Phase 5 docs/tests; items marked **HUMAN** require Apple ID signing, live URLs, or a physical device.

Related: `README.md` (reviewer notes), `docs/INCIDENT_RESPONSE.md` (device checks), `docs/CONTROL_MATRIX.md`, `docs/RESIDUAL_RISKS.md`.

---

## 1. App Store Connect — App Privacy

**Copy into ASC → App Privacy:**

| Field | Value |
|---|---|
| Privacy practice | **Data Not Collected** |
| Tracking | No |
| Collected data types | None (empty) |

**Notes for the privacy questionnaire:** WeatherKit forecasts and ZIP/location geocoding are **Apple-collected** on device. Cuidala has no first-party server and does not receive that data. Matches `ios/App/App/PrivacyInfo.xcprivacy` (UserDefaults CA92.1, File Timestamp C617.1; collected types empty).

**Export compliance:** `ITSAppUsesNonExemptEncryption = false` (already in Info.plist). Encryption is Apple WebCrypto + Keychain only.

---

## 2. Age rating

**Target:** **4+**

Complete the 2026 age-rating questionnaire with no mature content, violence, gambling, unrestricted web, or user-generated content that would raise the rating. v1 has no accounts, no IAP, no chat.

Texas Declared Age Range APIs are **not** adopted for v1 (see `docs/RESIDUAL_RISKS.md`).

---

## 3. Localized metadata (draft)

Localizations to add in ASC: **English (U.S.)**, **Spanish (Mexico)**, **Portuguese (Brazil)**.

### en-US

**Name:** Cuidala  
**Subtitle:** Home chores, private on device  
**Keywords:** home,chores,maintenance,restock,household,organize,todo,filter,battery,reminder  
**Promotional text** (optional): No account. No cloud. Yours.

**Description:**

```
Cuidala keeps your home’s chores, rooms, and restock list private on this iPhone.

No account. No Cuidala server. Your home is encrypted on device and unlocked with Face ID, Touch ID, or your passcode.

• Today — what needs you now, plus seasonal and weather-driven checklists
• Home — rooms and a replacement forecast
• Restock — filters, batteries, and supplies with a clear order-now gauge

Optional location or ZIP during setup helps pick seasonal tasks and fetch an Apple Weather forecast. That ZIP or location is sent to Apple for geocoding and weather; Cuidala itself never receives it.

Back up with an encrypted file when you move to a new phone. One home, one phone for version 1.0.
```

**What’s New:**

```
Welcome to Cuidala 1.0 — chores, restock, and seasonal checklists that stay on your iPhone. No account required.
```

### es-MX

**Name:** Cuidala  
**Subtitle:** Tareas del hogar, privadas  
**Keywords:** hogar,tareas,mantenimiento,reposición,casa,organizar,filtro,batería,recordatorio  
**Promotional text:** Sin cuenta. Sin nube. Tuyo.

**Description:**

```
Cuidala guarda las tareas, habitaciones y lista de reposición de tu hogar en privado en este iPhone.

Sin cuenta. Sin servidor de Cuidala. Tu hogar se cifra en el dispositivo y se desbloquea con Face ID, Touch ID o tu código.

• Hoy — lo que necesita tu atención, más listas de temporada y del clima
• Hogar — habitaciones y un pronóstico de reemplazos
• Reposición — filtros, baterías y suministros con un medidor claro de cuándo pedir

La ubicación o el código postal opcionales en la configuración ayudan a elegir tareas de temporada y obtener el pronóstico de Apple Weather. Ese código postal o ubicación se envía a Apple para geocodificación y clima; Cuidala no lo recibe.

Haz una copia de seguridad cifrada al cambiar de teléfono. Un hogar, un teléfono en la versión 1.0.
```

**What’s New:**

```
Bienvenido a Cuidala 1.0 — tareas, reposición y listas de temporada que se quedan en tu iPhone. No necesitas cuenta.
```

### pt-BR

**Name:** Cuidala  
**Subtitle:** Tarefas da casa, no aparelho  
**Keywords:** casa,tarefas,manutenção,reposição,lar,organizar,filtro,bateria,lembrete  
**Promotional text:** Sem conta. Sem nuvem. Seu.

**Description:**

```
O Cuidala mantém as tarefas, cômodos e lista de reposição da sua casa em privado neste iPhone.

Sem conta. Sem servidor da Cuidala. Sua casa é criptografada no aparelho e desbloqueada com Face ID, Touch ID ou código.

• Hoje — o que precisa de você agora, mais checklists sazonais e do clima
• Casa — cômodos e uma previsão de trocas
• Reposição — filtros, baterias e itens com um medidor claro de quando pedir

Localização ou CEP opcionais na configuração ajudam a escolher tarefas sazonais e buscar a previsão do Apple Weather. Esse CEP ou localização é enviado à Apple para geocodificação e clima; a Cuidala não recebe esses dados.

Faça backup criptografado ao trocar de telefone. Uma casa, um telefone na versão 1.0.
```

**What’s New:**

```
Bem-vindo ao Cuidala 1.0 — tarefas, reposição e checklists sazonais que ficam no seu iPhone. Sem conta.
```

---

## 4. Reviewer notes (paste into ASC)

```
Cuidala is a Capacitor/WKWebView app with native iOS capabilities, not a thin website wrapper:

• Face ID / Touch ID / device passcode lock (LocalAuthentication via native plugin); cancel stays locked.
• Keychain-held AES-256-GCM vault; the device key is bound to this iPhone (Face ID / passcode). Encrypted portable backup in Settings moves the home to a new phone.
• Local notifications (no push, no APNs), including a repeating weekly digest.
• Retailer pages open in SFSafariViewController, not the app WebView. Paste a product link in Restock. There is no iOS Share Extension.
• Apple WeatherKit (native) for forecasts, with required Apple Weather attribution.
• Optional location during setup (system permission sheet shows Cuidala). ZIP can be typed instead for climate.
• Files picker for encrypted backup restore.
• No sign-in. On first launch tap “Use a sample home instead” to reach the task list immediately, with Restock already seeded.
• Order opens the retailer in Safari; no in-app purchase.
• iPhone only; portrait only.

Demo path: launch → Use a sample home instead → Today / Home / Restock.
```

---

## 5. URLs and mailboxes (**HUMAN**)

| Field | Expected | Status |
|---|---|---|
| Support URL | Live page (e.g. `https://cuidala.app` or `/how-it-works`) | **HUMAN** — must resolve before submit |
| Privacy Policy URL | Live host of `out/privacy/` (e.g. Vercel) | **HUMAN** — must resolve before submit |
| Marketing URL | Optional | Optional |
| `support@…` | Answers App Review and users | **HUMAN** — mailbox must receive mail |
| `privacy@…` | Answers privacy requests | **HUMAN** — mailbox must receive mail |

In-app Settings → Privacy / Terms / How it works still work offline from the bundle; ASC requires **live** Support + Privacy URLs.

---

## 6. Screenshot checklist (**HUMAN**)

Capture on **6.9"** and **6.7"** (and any other required sizes ASC lists for iPhone).

| # | Screen | Must show |
|---|---|---|
| 1 | Today (sample home, day one) | Redesigned header; **0 overdue**; greeting / display line |
| 2 | Today or Home | Seasonal entry or “This season” if available |
| 3 | Restock | Order-now list with **gauge** (have / on the way / need) |
| 4 | Home | Grouped room list / forecast card |
| 5 | Optional | Lock screen or Settings privacy line — only if needed for Guideline 4.2 |

Storefront: **United States** for v1. Price: **Free**. Devices: **iPhone only**.

---

## 7. Archive / Validate / TestFlight (**HUMAN** signing)

### Build numbers

| Setting | Current in repo | Rule |
|---|---|---|
| `MARKETING_VERSION` | `1.0` | Keep for 1.0 launch |
| `CURRENT_PROJECT_VERSION` | `2` | **+1 for every App Store Connect / TestFlight upload** |

Before each upload: in Xcode target **App** → General → Build, or in `ios/App/App.xcodeproj/project.pbxproj` both Debug and Release `CURRENT_PROJECT_VERSION` values, increment by 1 (next upload should be `3` if `2` was never uploaded, or whatever ASC next expects).

### Toolchain

- **Xcode 26.2+** / iOS 26 SDK (older archives are refused at upload).
- Node **22+** (`nvm use 22`) for `npm run cap:sync`.
- Signing: Team for `com.cuidala.app`; WeatherKit capability on the App ID; **always signed** (unsigned Keychain writes show LoadFailed).

### Exact Archive path in Xcode

1. `nvm use 22 && npm run cap:sync` (static `out/` → iOS).
2. Open `ios/App/App.xcodeproj` (or `npm run cap:ios`).
3. Scheme **App**, destination **Any iOS Device (arm64)** (not a simulator).
4. Product → **Destination** → Any iOS Device.
5. Product → **Archive** (Release configuration).
6. Organizer → select the archive → **Validate App** (checks Capacitor/Cordova xcframework signatures).
7. **Distribute App** → App Store Connect → Upload.
8. In ASC: add to TestFlight internal/external as needed → when ready, **Add for Review** → **Submit for Review**.

Agent note: Archive and Distribute require an Apple Development/Distribution identity on the Mac. A Release **simulator** compile can be run without distributing (see §8).

### Pre-archive agent-friendly compile

```bash
nvm use 22
npm run typecheck && npm run lint -- --max-warnings 0 && npm test && npm run build
npm run cap:sync   # if web assets changed
```

Then build Release for simulator via XcodeBuildMCP / Xcode to catch compile errors before Archive.

**Agent verification (2026-09-13):** Release configuration build for iPhone 17 simulator (**scheme App**) succeeded via XcodeBuildMCP (`build_sim` with `configuration: Release`). Archive → Validate → Distribute still requires a human Apple ID / distribution certificate on **Any iOS Device**.

---

## 8. Pre-release device checklist (**HUMAN**)

Run **every** checkbox in `docs/INCIDENT_RESPONSE.md` → **Pre-release device checks** on:

1. A real iPhone with Face ID  
2. An SE-class / Touch ID (or passcode-only) device  

Phase 5 extras (also listed in that file):

- [ ] Spanish system language end to end  
- [ ] Dark mode on every screen  
- [ ] Largest Dynamic Type on Today / Home / Restock  
- [ ] Airplane mode  
- [ ] Interactive sheet drag-dismiss + edge-swipe back (prefer 120 Hz)

Do **not** claim VoiceOver / Assistive Access Nutrition Labels until proven (see residual risks).

---

## 9. Remaining human-only before “Submit for Review”

1. **Signing & Archive** — Team, provisioning, WeatherKit profile, Product → Archive → Validate → Distribute.  
2. **Build number** — bump `CURRENT_PROJECT_VERSION` per upload.  
3. **ASC listing** — privacy Data Not Collected, age 4+, metadata for en-US / es-MX / pt-BR, screenshots 6.9" + 6.7".  
4. **Live Support URL + Privacy Policy URL**.  
5. **Answering** `support@` and `privacy@`.  
6. **P5-02** device checklist signed off on two devices.  
7. **TestFlight** smoke on a signed build, then Submit for Review.  
8. Icon Composer `.icon` — **not** required to block 1.0 unless ASC rejects AppIcon.appiconset (terracotta-on-cream is shipped).

---

## 10. Agent-completed gate (repo)

After Phase 5 agent work:

```bash
nvm use 22 && npm run typecheck && npm run lint -- --max-warnings 0 && npm test && npm run build
```

Must be green before handing off for Archive.
