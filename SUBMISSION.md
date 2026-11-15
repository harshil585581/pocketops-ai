# PocketOps AI — #BuildHybridAI submission

**Platform:** Web (Chrome) · **Built with:** Firebase AI Logic (hybrid inference), App Check, Authentication,
Cloud Firestore, Remote Config, Hosting

## Inspiration

When something breaks (a machine on a job site, a car on a roadside, a breaker in a basement), help is needed
right away, and that's often where the signal is worst. Most AI assistants stop working the moment the network
drops. We wanted an assistant that keeps working there.

## What it does

PocketOps AI turns a plain-language description of a problem into a structured troubleshooting guide:
likely causes ranked by likelihood, safety precautions shown first, a step-by-step checklist that remembers
your progress, and what to do if the problem persists.

- **On-device first.** With Gemini Nano available in Chrome, the diagnosis runs locally: private, fast and
  fully offline.
- **Cloud when it helps.** If the local model isn't available, Firebase AI Logic falls back to Gemini Flash.
  Long, detailed descriptions go to the cloud first, and a **Deep analysis** button hands an on-device triage
  to Gemini Flash for confirming tests and more thorough steps.
- **Conversations, not one-shot answers.** Each problem becomes a thread. If a step doesn't work, tap "Didn't work?"
  or just reply. PocketOps answers with new steps using the whole history as context, on-device or in the cloud.
  Threads are marked Resolved when the fix works.
- **Always transparent.** Each answer is labelled with where it ran, using the SDK's `inferenceSource`.
- **Graceful offline mode.** With no network and no local model, the app explains why and shows related guides
  saved on the device.
- **Saved and synced.** Guides are stored in IndexedDB for offline use and mirrored to Cloud Firestore. An
  anonymous account backs them up; signing in with Google syncs them across devices.

## How we built it

- **Firebase AI Logic hybrid inference** (`firebase/ai`): one `getGenerativeModel` call with `onDeviceParams`
  (JSON-schema-constrained output for Gemini Nano) and `inCloudParams` (Gemini Flash, JSON output). A small router
  picks `PREFER_ON_DEVICE`, `PREFER_IN_CLOUD`, `ONLY_ON_DEVICE` or `ONLY_IN_CLOUD` per request based on
  connectivity, model availability, description length and the user's choice.
- **App Check** with reCAPTCHA Enterprise protects AI Logic and Firestore.
- **Remote Config** controls the cloud model, the long-description threshold and the system instruction without
  a redeploy, and the last values are cached for offline use.
- **Authentication + Firestore**: anonymous sign-in, optional Google account linking, per-user security rules,
  and last-write-wins sync with an offline queue.
- **React + TypeScript + Vite + Tailwind CSS**, delivered as an installable PWA with a service worker, and hosted
  on Firebase Hosting.

## Challenges

- Making the on-device and cloud models return the same structured format, so the UI can render either one
  identically.
- Designing the offline path so the app is still useful when no AI is reachable.
- Keeping local-first storage and cloud sync consistent across offline edits, deletes and account changes.

## What we learned

A hybrid SDK changes the product question from "which model?" to "which model for this request?". On-device
inference covers speed, privacy and availability, the cloud covers depth, and the user always knows which one
answered.

## What's next

- An Android app on the same Firebase project with Gemini Nano, sharing synced guides
- Photo input (show the error code or the broken part)
- Shared team workspaces for field technicians

## Links

- Live app: _add your Firebase Hosting URL_
- Repository: _add your GitHub URL_
- Demo video: _add your YouTube URL_
