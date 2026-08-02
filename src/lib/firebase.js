import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;
const canvasConfig = globalThis.__firebase_config;

const firebaseConfig = canvasConfig
  ? JSON.parse(canvasConfig)
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };

export const appId = globalThis.__app_id || env.VITE_UNFRAME_APP_ID || 'unframe-interactive-wall';
export const isFirebaseReady = Boolean(canvasConfig || firebaseConfig.apiKey);

let app;
let auth;
let db;

if (isFirebaseReady) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
