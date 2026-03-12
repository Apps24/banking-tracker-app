# BankTracker

A React Native app for Indian Android users that automatically reads bank SMS messages, parses transactions, and gives you a clear view of your finances.

## Features

- **Automatic SMS Sync** — Reads bank SMS from your inbox, parses transaction amounts, and syncs them to your account
- **Transaction History** — Browse all debits and credits with filtering and search
- **Analytics Dashboard** — Charts for spending trends, category breakdown, and bank-wise breakdown
- **Biometric Login** — Fingerprint / Face ID authentication for returning users
- **Offline-Ready** — Auth state and settings persist locally with Expo SecureStore
- **Dark UI** — Navy/gold theme with smooth Reanimated animations

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54 (legacy architecture, `newArchEnabled: false`) |
| Navigation | expo-router (file-based) |
| Styling | NativeWind v4 + Tailwind CSS v3 |
| State | Zustand |
| Data Fetching | TanStack React Query |
| Forms | react-hook-form + Zod |
| Charts | victory-native + @shopify/react-native-skia |
| Auth | Better Auth (session-based, 30-day tokens) |
| HTTP | Axios |
| Storage | expo-secure-store |
| Biometrics | expo-local-authentication |

## Prerequisites

- **Node.js** 20+
- **Expo CLI** — `npm install -g expo-cli`
- **EAS CLI** — `npm install -g eas-cli`
- An [Expo account](https://expo.dev) for EAS builds
- A running [BankTracker API server](../banking-tracker-api)

## Local Development

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Create .env file
cp .env.example .env
# Edit .env and set EXPO_PUBLIC_API_URL to your local server

# 3. Start Metro bundler
npx expo start --clear
```

### Testing on a physical device

1. Install **Expo Go** (SDK 54) from the Play Store on your Android device
2. Make sure your phone and computer are on the **same Wi-Fi network**
3. Scan the QR code shown by `npx expo start`

> **Note:** SMS reading requires a real Android device — it will not work in emulators or on iOS.

## Building an APK (EAS)

```bash
# 1. Log in to Expo
eas login

# 2. Configure project (first time only)
eas build:configure

# 3. Build a preview APK (internal testing)
eas build --profile preview --platform android

# 4. Build a production AAB (Play Store)
eas build --profile production --platform android
```

The APK download link is shown in the EAS dashboard once the build completes.

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the BankTracker REST API | `http://192.168.1.19:3000/api/v1` |
| `EXPO_PUBLIC_APP_NAME` | Display name used in the app | `BankTracker` |

Set these in `.env` for local dev. EAS build profiles in `eas.json` supply their own values at build time.

## SMS Permission Rationale

> **For Play Store listing:**
>
> BankTracker requests `READ_SMS` to automatically detect bank transaction messages from your SMS inbox. The app scans only messages from known Indian bank sender IDs (e.g. `VM-HDFCBK`, `VM-SBIINB`). Raw SMS content is never stored or transmitted — only the parsed transaction amount, type, and timestamp are sent to our servers. You can review and deselect individual messages before syncing.

## Project Structure

```
app/
  _layout.tsx           Root layout (auth guard, QueryClient)
  (auth)/               Login & Register screens
  (tabs)/               Home, Transactions, Analytics, Settings
  transaction/[id].tsx  Transaction detail
components/
  ui/                   Button, Card, Input, Badge, Skeleton
  common/               Header, LoadingScreen, EmptyState, OfflineBanner
  SmsSync.tsx           SMS scanning & sync modal
lib/
  api/                  Axios client + endpoint modules
  store/                Zustand stores (auth, settings)
  hooks/                useSmsReader, useTransactions, useAuth
  utils/                formatCurrency, formatDate, constants
  types/                Shared TypeScript types
assets/                 Icons, splash images
```

## SDK Note

This app targets **Expo SDK 54**, the last SDK to support the legacy React Native architecture. This was chosen to maximise compatibility with the Expo Go Android app while third-party libraries complete their new-arch migrations.
