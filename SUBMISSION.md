# PocketOps AI — #BuildHybridAI Submission

> **Offline-first troubleshooting assistant built on Firebase AI Logic hybrid inference.**  
> Built for the Google **#BuildHybridAI 2026** Hackathon.  
> 
> 🌐 **Live Web App:** [https://pocketops-8008c.web.app](https://pocketops-8008c.web.app)  
> 📹 **Demo Video (YouTube):** [https://youtu.be/mzz2GWm9uuI](https://youtu.be/mzz2GWm9uuI)  
> 📂 **GitHub Repository:** [https://github.com/harshil585581/pocketops-ai](https://github.com/harshil585581/pocketops-ai)  
> 💻 **Platform:** Web (Chrome) · **License:** Apache 2.0

---

## Inspiration

When something breaks—a car on an isolated highway, a cooling pump in a concrete basement, or a circuit breaker during an outage—help is needed urgently. Unfortunately, these situations occur right where cell reception and internet connectivity are at their absolute worst.

Most modern GenAI assistants freeze or fail the moment connection is lost. We built **PocketOps AI** to solve this real-world failure point: an offline-first technical diagnostic partner that diagnoses problems locally with **Gemini Nano** when offline or private, and seamlessly routes to **Gemini Flash in the cloud** for high-complexity queries when online.

---

## What It Does

PocketOps AI transforms natural-language problem descriptions into structured, actionable troubleshooting plans:

- **⚡ Instant Local Diagnostics (Gemini Nano):** Diagnoses device and equipment failures directly in the browser with 0 ms network latency and 100% offline capability.
- **☁️ Cloud Depth (Gemini Flash via Firebase AI Logic):** Leverages cloud intelligence when connected, for deep analytical breakdowns, photo inspections, and high-complexity repairs.
- **🔄 Dynamic Troubleshooting Threads:** Unlike one-off answer bots, every problem becomes an ongoing conversational thread. If a step fails, users tap *"Didn't work?"* and receive updated instructions taking the entire conversation history into account.
- **🏷️ Runtime Transparency:** Every response explicitly displays which model and runtime environment generated it (`Generated locally · Gemini Nano` vs `Generated in cloud · Gemini Flash`).
- **💾 Local-First Persistence & Cloud Sync:** Every guide is cached in IndexedDB for offline access, with automatic background synchronization to **Cloud Firestore** and **Firebase Authentication**.
- **🛡️ Built-in Resilience:** If connectivity is lost and no local model exists, PocketOps gracefully falls back to intelligent token-matching across previously saved guides on the device.

---

## How We Built It

- **Firebase AI Logic SDK (`firebase/ai`):** The core engine. We configure a unified `getGenerativeModel` with `onDeviceParams` (schema-constrained structured JSON for Gemini Nano) and `inCloudParams` (Gemini Flash). 
- **Intelligent Hybrid Router:** Evaluates real-time device connectivity, model readiness, character payload, and user preferences (`prefer_on_device`, `only_on_device`, `prefer_in_cloud`, `only_in_cloud`).
- **Firebase App Check:** Integrated with reCAPTCHA Enterprise to safeguard AI Logic and Firestore from unauthorized calls and abuse.
- **Cloud Firestore & Authentication:** Anonymous sign-in allows immediate frictionless offline/online saving; optional Google Authentication links identities to sync troubleshooting records across devices.
- **Firebase Remote Config:** Dynamically updates default cloud models, system instructions, and routing thresholds without requiring client redeployments.
- **Frontend Stack & PWA:** Built with React 19, TypeScript, Vite, and Tailwind CSS; configured with Workbox Service Workers for full offline PWA installation. Hosted on **Firebase Hosting**.

---

## Challenges We Overcame

1. **Schema Consistency Across Local & Cloud Models:** Ensuring that Chrome's local Gemini Nano and cloud-based Gemini Flash produced identical JSON schemas for causes, likelihoods, safety tips, and actionable steps without breaking the UI.
2. **Offline-First State Synchronization:** Designing an IndexedDB database layer that seamlessly queues offline operations and handles conflict resolution with Cloud Firestore upon reconnection.
3. **Graceful Degradation:** Guaranteeing that the user never faces a dead-end screen—even in zero-connectivity environments with no model downloaded.

---

## What We Learned

Working with **Firebase AI Logic** highlighted that hybrid AI transforms architecture from asking *"which model should I pick?"* to *"which runtime is best for this specific interaction?"*. Having a unified SDK that manages both on-device inference and cloud fallbacks enables a whole new class of offline-resilient, privacy-conscious applications.

---

## What's Next for PocketOps AI

- **Multi-Platform Support:** Expanding to Android using Gemini Nano with the same unified Firebase backend.
- **Visual Diagnostics:** Expanding multimodal capabilities for on-device part identification and multimeter reading analysis.
- **Collaborative Fleet Workspaces:** Enabling field maintenance teams to share synced troubleshooting logs and resolution notes.

---

## Links

- **Live Web App:** [https://pocketops-8008c.web.app](https://pocketops-8008c.web.app)
- **GitHub Repository:** [https://github.com/harshil585581/pocketops-ai](https://github.com/harshil585581/pocketops-ai)
- **Demo Video (YouTube):** [https://youtu.be/mzz2GWm9uuI](https://youtu.be/mzz2GWm9uuI)
