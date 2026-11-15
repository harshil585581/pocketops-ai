/**
 * Single Firebase app instance shared by AI Logic, App Check, Auth, Firestore and Remote Config.
 * Every SDK is imported lazily so the app shell stays small and loads offline.
 */
import type { FirebaseApp } from 'firebase/app';

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

const RECAPTCHA_SITE_KEY = env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY as string | undefined;
// Dev builds only: `import.meta.env.DEV` is replaced with `false` in production, so the
// debug token is stripped from the deployed bundle and can't be used to bypass App Check.
const APPCHECK_DEBUG_TOKEN = import.meta.env.DEV ? (env.VITE_APPCHECK_DEBUG_TOKEN as string | undefined) : undefined;
export const appCheckConfigured = Boolean(RECAPTCHA_SITE_KEY);

let appPromise: Promise<FirebaseApp> | null = null;

/** Initialises Firebase once. App Check is activated before any other product makes a request. */
export function getFirebaseApp(): Promise<FirebaseApp> {
  if (!firebaseConfigured) return Promise.reject(new Error('Firebase is not configured.'));
  return (appPromise ??= (async () => {
    const { initializeApp, getApps } = await import('firebase/app');
    const app = getApps()[0] ?? initializeApp(config);
    if (RECAPTCHA_SITE_KEY) {
      if (APPCHECK_DEBUG_TOKEN) {
        // A registered debug token lets localhost pass App Check
        // (Firebase console → App Check → Apps → ⋮ → Manage debug tokens).
        (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = APPCHECK_DEBUG_TOKEN;
      }
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    }
    return app;
  })());
}
