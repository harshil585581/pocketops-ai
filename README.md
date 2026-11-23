# PocketOps AI

**Offline-first troubleshooting assistant built on Firebase AI Logic hybrid inference.**
Describe a problem with a machine, device, vehicle or home system and get likely causes, a step-by-step fix
and safety precautions. Answers come from **Gemini Nano on-device** when it's available and **Gemini Flash in
the cloud** when it isn't. Every answer says which one produced it.

> Built for #BuildHybridAI · Platform: **Web (Chrome)** · License: Apache 2.0  
> 🌐 **Live Demo:** [https://pocketops-8008c.web.app](https://pocketops-8008c.web.app) · 📹 **Video Demo:** [https://youtu.be/mzz2GWm9uuI](https://youtu.be/mzz2GWm9uuI)

## Why hybrid matters here

People need troubleshooting help where connectivity is worst: plant rooms, basements, roadsides, rural sites.
A cloud-only assistant fails exactly when it's needed. PocketOps:

- **Works with no signal.** Gemini Nano runs the diagnosis on the device; the app shell is cached by a service worker.
- **Stays private by default.** When the local model is ready, the problem description never leaves the device.
- **Uses the cloud when it adds value.** Long, detailed descriptions and "Deep analysis" requests go to Gemini Flash
  for more thorough reasoning.
- **Degrades gracefully.** Offline with no local model, it explains why and surfaces related saved guides.

## How Firebase AI Logic is used

All AI requests go through `firebase/ai` — there is no other inference path.

| Where | What |
| --- | --- |
| [`src/engine/firebase.ts`](src/engine/firebase.ts) | `getAI` + `getGenerativeModel(ai, { mode, onDeviceParams, inCloudParams })`, `generateContent`, and `response.inferenceSource` to label each answer *on-device* or *cloud*. On-device output is constrained to a JSON schema; cloud uses `responseMimeType: application/json`. |
| [`src/engine/index.ts`](src/engine/index.ts) | Router that picks the hybrid `InferenceMode` per request (table below) and retries in the cloud if an on-device answer can't be parsed. |
| [`src/lib/firebaseApp.ts`](src/lib/firebaseApp.ts) | Initialises Firebase and **App Check** (reCAPTCHA Enterprise, debug token on localhost) before any request. |

| Situation | `InferenceMode` |
| --- | --- |
| Online, Gemini Nano ready | `PREFER_ON_DEVICE` |
| Online, Nano not available | `PREFER_ON_DEVICE` → SDK falls back to cloud |
| Online, long description (Remote Config threshold) | `PREFER_IN_CLOUD` |
| Offline, Nano ready | `ONLY_ON_DEVICE` |
| "Deep analysis" button | `ONLY_IN_CLOUD` with the more capable `deep_model` (falls back to `cloud_model` if busy) |
| User override: On-device only / Cloud only | `ONLY_ON_DEVICE` / `ONLY_IN_CLOUD` |
| Offline, no Nano | No AI — related saved guides are shown |

### Other Firebase products

| Product | Use |
| --- | --- |
| **App Check** | Protects AI Logic (and Firestore) from abuse — [`src/lib/firebaseApp.ts`](src/lib/firebaseApp.ts) |
| **Authentication** | Anonymous sign-in by default; optional Google sign-in links the account for cross-device sync — [`src/lib/sync.ts`](src/lib/sync.ts) |
| **Cloud Firestore** | Saved guides mirrored to `users/{uid}/sessions`, last-write-wins merge, offline queue — [`src/lib/sync.ts`](src/lib/sync.ts), [`firestore.rules`](firestore.rules) |
| **Remote Config** | `cloud_model`, `deep_model`, `long_problem_chars`, `system_instruction` change AI behaviour without a redeploy — [`src/lib/remoteConfig.ts`](src/lib/remoteConfig.ts), [`remoteconfig.template.json`](remoteconfig.template.json) |
| **Hosting** | Serves the PWA — [`firebase.json`](firebase.json) |

## Features

- Natural-language problem input with category hints and a live preview of where the request will run
- Structured guide: likely causes ranked by likelihood, safety precautions first, a step checklist with saved progress, and escalation advice
- **Troubleshooting conversations**: every problem is a thread in the sidebar. Follow up in the same thread ("step 2 didn't work, it's still clicking") and get new steps with the full history as context; works on-device offline too
- **Built for fixing things**: a "Didn't work?" button on every step, a "Did this fix it?" check that marks threads Resolved, and one-tap follow-up suggestions
- **Deep analysis**: hand the problem to the more capable cloud model inside the same thread
- Source label on every answer (`Generated locally · Gemini Nano` / `Generated in cloud · Gemini Flash`)
- Saved guides in IndexedDB, searchable and filterable, available offline, synced via Firestore
- Settings page: live network, model and cloud status; Gemini Nano download with progress; routing preference
- Installable PWA, offline app shell, light and dark themes, responsive from phone to desktop

## Run locally

Requirements: Node 20+, desktop Chrome 139+ for on-device inference.

```bash
npm install
cp .env.example .env   # fill in the values — see "Firebase setup"
npm run dev            # http://localhost:5173
```

Production build with the service worker: `npm run build && npm run preview`.

## Firebase setup

1. **Web app config.** Firebase console → Project settings → Your apps → add a Web app → copy the config into `.env`.
2. **AI Logic.** Console → AI Logic → Get started → **Gemini Developer API**.
3. **App Check.** Console → App Check → Apps → your web app → **reCAPTCHA Enterprise** (create a website key for
   `localhost` and your hosting domains) → put the key in `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`.
   For `npm run dev`, add a debug token (App Check → Apps → ⋮ → Manage debug tokens) to `VITE_APPCHECK_DEBUG_TOKEN`.
   It is only used in development builds and is stripped from production bundles.
4. **Authentication.** Console → Authentication → Get started → enable **Anonymous** and **Google**.
5. **Firestore.** Console → Firestore Database → Create database.
6. **Deploy rules, Remote Config template and Hosting:**
   ```bash
   npx firebase-tools login
   npm run build
   npx firebase-tools deploy --only firestore:rules,remoteconfig,hosting
   ```

## On-device model (Gemini Nano)

Chrome manages the model; nothing is bundled with the app. Open **Settings → On-device AI** and click
**Download model** while online. Hardware and Chrome requirements apply; when Nano isn't available the app
uses cloud Gemini automatically.

## Project structure

```
src/
  engine/      firebase.ts (AI Logic), index.ts (hybrid router), prompt.ts, parse.ts, chromeAI.ts (model status/download)
  lib/         firebaseApp.ts (App Check), sync.ts (Auth + Firestore), remoteConfig.ts, db.ts (IndexedDB), samples.ts
  state/       engine status, theme, toasts, PWA install/update
  components/  shell, composer, analyzing state, routing table, sync card, dialogs
  pages/       Diagnose, Thread (conversation), History (all guides), Settings
```

Three hand-written example guides are seeded on first launch so the offline fallback has content. They are
labelled "Example guide · not AI output" and are never synced.

## License

[Apache License 2.0](LICENSE)
