# PocketOps AI 🛠️⚡

[![Firebase AI Logic](https://img.shields.io/badge/Firebase-AI%20Logic-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/docs/ai-logic)
[![Gemini Nano](https://img.shields.io/badge/On--Device-Gemini%20Nano-4285F4?logo=google&logoColor=white)](https://developer.chrome.com/docs/ai/built-in)
[![Cloud Gemini](https://img.shields.io/badge/Cloud-Gemini%20Flash-34A853?logo=google-gemini&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Platform: Web (Chrome)](https://img.shields.io/badge/Platform-Web%20(Chrome)-informational)](#)

> **Offline-first troubleshooting assistant built on Firebase AI Logic hybrid inference.**  
> Built for the Google **#BuildHybridAI 2026** Hackathon.  
> 
> 🌐 **Live Web App:** [https://pocketops-8008c.web.app](https://pocketops-8008c.web.app)  
> 📹 **Demo Video (YouTube):** [https://youtu.be/mzz2GWm9uuI](https://youtu.be/mzz2GWm9uuI)  
> 📂 **GitHub Repository:** [https://github.com/harshil585581/pocketops-ai](https://github.com/harshil585581/pocketops-ai)

---

## 💡 Why Hybrid AI Matters Here

People need troubleshooting guidance where connectivity is worst: plant rooms, basements, highway roadsides, elevators, and remote job sites. A cloud-only AI assistant fails completely the moment connectivity drops. 

**PocketOps AI bridges this gap with seamless hybrid intelligence:**
- **Zero-Signal Troubleshooting:** Gemini Nano runs the diagnostic inference directly on the device via Chrome Built-in AI.
- **Privacy by Design:** When resolved on-device, your problem description never leaves your browser.
- **Cloud Intelligence on Demand:** Seamlessly connects to cloud Gemini Flash for deep reasoning, long technical write-ups, or photo diagnoses.
- **Offline Resilience:** PWA cached by Service Workers + IndexedDB offline persistence with Cloud Firestore sync. Every guide generated is saved locally.
- **Full Transparency:** Every single diagnostic response explicitly badges its runtime engine (`Generated locally · Gemini Nano` or `Generated in cloud · Gemini Flash`).

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
