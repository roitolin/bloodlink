# LifeCycle

LifeCycle is a blood donation coordination system with:

- Mobile app (Expo + React Native)
- Web app (Vite + React)
- Firebase backend (Auth + Firestore)

It helps requesters, donors, and admins coordinate urgent blood requests faster.

## Features

- User authentication (mobile/web)
- Donor search and request matching
- Request creation and tracking
- Admin dashboards and moderation tools
- Emergency broadcast alerts
- City-level availability view on landing page

## Tech Stack

- Mobile: Expo, React Native, React Navigation, React Native Paper
- Web: React, Vite, React Router
- Backend/DB: Firebase Authentication + Cloud Firestore
- Language: TypeScript

## Project Structure

```text
bloodlink/
├─ src/                  # Mobile app source
│  ├─ screens/
│  │  ├─ admin/
│  │  ├─ auth/
│  │  ├─ shared/
│  │  └─ user/
│  ├─ navigation/
│  ├─ components/
│  ├─ services/
│  └─ utils/
├─ bloodlink_web/        # Web app source
│  ├─ src/
│  └─ config/            # Web centralized configs (vite/eslint/typescript)
├─ config/               # Centralized project configs
│  ├─ expo/
│  ├─ firebase/
│  ├─ babel/
│  ├─ eslint/
│  └─ typescript/
├─ docs/                 # Guides, diagrams, references
│  ├─ guides/
│  ├─ diagrams/
│  ├─ assets/
│  └─ references/
├─ logs/                 # Local debug logs (gitignored)
├─ app.config.js         # Root tool entry (delegates to config/)
├─ firebase.json         # Root Firebase entry (points to config/firebase/*)
└─ package.json          # Mobile app scripts/deps
```

## Prerequisites

- Node.js 18+ (recommended)
- npm
- Expo CLI tools via `npx` (no global install required)
- For mobile device testing: Expo Go app

## Setup

### 1. Clone and install mobile dependencies

```bash
git clone <your-repo-url>
cd bloodlink
npm install
```

### 2. Install web dependencies

```bash
cd bloodlink_web
npm install
cd ..
```

## Run the Apps

### Mobile (Expo)

```bash
cd bloodlink
npx expo start
```

Optional:

- `npm run android`
- `npm run ios`

### Web (Vite)

```bash
cd bloodlink/bloodlink_web
npm run dev
```

Default dev URL is usually `http://localhost:5175`.

## Scripts

### Mobile (`/bloodlink`)

- `npm run start` - Start Expo
- `npm run android` - Start Expo for Android
- `npm run ios` - Start Expo for iOS
- `npm run lint` - Lint mobile project

### Web (`/bloodlink_web`)

- `npm run dev` - Start web dev server
- `npm run build` - Build web app
- `npm run preview` - Preview build
- `npm run lint` - Lint web project

## Environment Notes

- Copy `.env.example` to `.env` and fill all Firebase values before running.
- For web, you can also copy `bloodlink_web/.env.example` to `bloodlink_web/.env`.
- Firebase and Cloudinary config are loaded from environment variables (no hardcoded values in source).
- OpenStreetMap endpoints used in the app do not require a private API key.

## Security Notes

- Security documentation has been moved to [`Security/`](Security/README.md).

## Team

- Roi (Lead / Main Programmer / Final Polishing)
- Ezra
- Samuel
- Sheen
- Daisy
- Cyrus

## Suggested Team Role Split

- Ezra: Database / Firestore support
- Samuel + Sheen: UI implementation
- Daisy + Cyrus: Testing, bug reporting, and docs support
- Roi: Final integration, code review, polishing, and demo readiness

## Notes

- This project is an academic system project.
- Update branding, contact info, and policies as needed before production use.
