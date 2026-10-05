# Getting Cuidala onto your iPhone with TestFlight

Why this is yours to start: signing needs your Apple Developer account. This Mac
has no signing identity (`security find-identity` shows none), the Xcode project
has no development team, and no iPhone is connected. The code is ready; these
are the steps that need you.

## One time: accounts and the app record (about 20 minutes)

1. **Apple Developer Program** membership is active (developer.apple.com, $99/year).
2. In **Xcode, Settings, Accounts**, sign in with that Apple ID. Note the
   **Team ID** (10 characters, under Membership details).
3. In **App Store Connect, Apps, New App**: iOS, name Cuidala, primary language
   English (U.S.), bundle ID `com.cuidala.app`, SKU `cuidala-ios`.
4. Register the other IDs the project needs (Xcode does this for you when
   "Automatically manage signing" is on and a team is chosen):
   - `com.cuidala.app` (App Group `group.com.cuidala.app`, WeatherKit,
     Associated capabilities as listed in `App.entitlements`)
   - `com.cuidala.app.CuidalaWidget` (App Group)
5. Enable the **WeatherKit** capability on the App ID (Certificates,
   Identifiers & Profiles, Identifiers, `com.cuidala.app`, Capabilities).
   WeatherKit needs it for forecasts to work on a real device.

## What I need from you

- Your **Team ID**. With it I set `DEVELOPMENT_TEAM` on both targets, bump the
  build number, and run the archive from the command line.
- Confirmation that step 3 is done, so the upload has somewhere to land.
- Xcode signed in on this Mac (step 2). I cannot sign you in.

## Build and upload (I can do this once the above is true)

```bash
. ~/.nvm/nvm.sh && nvm use 22
npm run cap:sync
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/Cuidala.xcarchive \
  -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath build/Cuidala.xcarchive \
  -exportOptionsPlist ExportOptions.plist -allowProvisioningUpdates
```

`ExportOptions.plist` uses `method: app-store-connect`, `destination: upload`.
The upload shows up in App Store Connect, TestFlight, in about 10 to 30 minutes
after processing.

## Then, on your phone

1. Install **TestFlight** from the App Store.
2. In App Store Connect, TestFlight, add yourself as an **Internal Tester**
   (no review needed for internal testers).
3. Open the invite on your iPhone and install.

## First-launch checks that only a real iPhone can do

Record what you see in `docs/DEVICE_TEST_LOG.md` (create it).

- [ ] Face ID lock opens the house.
- [ ] Weather loads (WeatherKit works on device).
- [ ] **Scan something, camera:** point at a water heater or fridge sticker.
- [ ] **Scan something, barcode:** a product box, twice (learn, then recognise).
- [ ] **Choose a photo:** a photo of a sticker.
- [ ] **Receipt:** a real receipt, camera and photo.
- [ ] Apple Intelligence **off**: the invitation card appears in Settings and
      after a hard scan; "Open Settings" lands on Cuidala's Settings page.
- [ ] Apple Intelligence **on**: "Smart reading: On", "Tell Cuidala" appears and
      proposes confirm rows; nothing saves without a tap.
- [ ] **Siri:** "Hey Siri, what's left today in Cuidala" in English, Spanish and
      Portuguese; "Scan something" opens the scanner (cold launch and warm).
- [ ] **Visual Intelligence:** camera control or Action button, point at a saved
      appliance; the Cuidala card shows and opens the room.
- [ ] A **Dynamic Type** accessibility size on Today, Home, Restock, a receipt card.
- [ ] Widget on the Lock Screen.

## Before the public App Store

Add to the App Store description (`docs/APP_STORE_SUBMISSION.md`): scan a
sticker or receipt on your iPhone, Siri and Shortcuts, and "reads on this
iPhone, nothing is sent". App Privacy stays **Data Not Collected**: the camera
image is processed on device and never stored or sent; Apple Intelligence runs
on device (no Private Cloud Compute is used). Re-check the review notes for
the camera permission string.
