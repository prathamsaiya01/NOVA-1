import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Safely access env vars in both Vite (client) and Node.js (server)
const getEnvVar = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
    return metaEnv?.[key];
  } catch {
    return undefined;
  }
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || 'AIzaSyC3ykyIodmGSXMGys3ETJfTEiMPb9AdiJ4',
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || 'nova-26b39.firebaseapp.com',
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || 'nova-26b39',
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || 'nova-26b39.firebasestorage.app',
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || '1078365953930',
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || '1:1078365953930:web:c19ef73e47173979893273',
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseApp = app;
export const firestore = getFirestore(app);
export const db = firestore;