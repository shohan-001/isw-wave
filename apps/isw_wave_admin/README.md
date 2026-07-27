# ISW Wave Admin (Flutter)

Dual-mode native app for **organizer control room** and **staff ops**.

- **Organizer** — remote moderation (approve / reject / next / queue). Venue audio stays on the admin laptop.
- **Staff** — host requests, invite codes, event suspend / quota caps, guest bans, activity logs.

## Toolchain (this machine)

```bash
cd "/run/media/shohan/New Volume/Projects/ISW Wave/isw-wave/apps/isw_wave_admin"
source ./env.sh
```

| Tool | Path |
| --- | --- |
| Flutter | `/run/media/shohan/9E5A9CDF5A9CB58D/dev/flutter` |
| Android SDK | `/run/media/shohan/9E5A9CDF5A9CB58D/dev/Android/Sdk` |

## Run on USB phone

```bash
source ./env.sh
adb devices
flutter run -d <deviceId> --dart-define=API_BASE=https://isw-wave.isharaka.dev
```

## Auth

| Mode | Login | Token |
| --- | --- | --- |
| Organizer | `POST /api/auth/login` | `Authorization: Bearer` + `isw_auth` |
| Staff | `POST /api/owner/login` | `Authorization: Bearer` + `isw_owner` (requires API that returns `{ token }`) |

## Screens

**Organizer:** Live · Pending · Queue · More (quota + password)

**Staff:** Home · Requests · Events (suspend / quota / ban) · Invites · More (logs)

## Build release APK

```bash
source ./env.sh
flutter build apk --release --dart-define=API_BASE=https://isw-wave.isharaka.dev
# → build/app/outputs/flutter-apk/app-release.apk
```
