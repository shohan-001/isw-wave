# ISW Wave Admin (Flutter)

Cross-platform **admin** app for the ISW Wave control room (Android first; Linux/Windows later). Guests keep using mobile web.

## Toolchain location (important on this machine)

Linux root disk is small. All heavy tools are on the **251GB volume**:

| Tool | Path |
| --- | --- |
| Flutter | `/run/media/shohan/9E5A9CDF5A9CB58D/dev/flutter` |
| Android SDK | `/run/media/shohan/9E5A9CDF5A9CB58D/dev/Android/Sdk` |
| JDK 17 | `/run/media/shohan/9E5A9CDF5A9CB58D/dev/jdk-17` |
| Pub / Gradle caches | `…/dev/pub-cache`, `…/dev/gradle` |

Always load env first:

```bash
source "./env.sh"
```

## Run on a USB phone

1. On the phone: enable **Developer options** → **USB debugging**.
2. Plug in the cable; accept the RSA prompt.
3. Then:

```bash
cd "/run/media/shohan/New Volume/Projects/ISW Wave/isw-wave/apps/isw_wave_admin"
source ./env.sh
adb devices          # should list your phone
flutter devices
flutter run -d <deviceId> --dart-define=API_BASE=https://isw-wave.isharaka.dev
```

Or install the release APK already built:

```bash
source ./env.sh
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

## Rebuild APK

```bash
source ./env.sh
flutter build apk --release --dart-define=API_BASE=https://isw-wave.isharaka.dev
# → build/app/outputs/flutter-apk/app-release.apk
```

## Auth

Uses `POST /api/auth/login` and stores the returned **Bearer token**. API calls send `Authorization: Bearer <token>`.

## Screens (MVP)

- Login
- Live queue / now playing
- Approve / reject / next
- Change password
