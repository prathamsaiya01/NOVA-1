import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithCustomToken, type User } from 'firebase/auth';
import { doc, getFirestore, setDoc } from 'firebase/firestore';

const getEnvVar = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key];
  } catch {
    return undefined;
  }
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || getEnvVar('FIREBASE_API_KEY') || 'AIzaSyC3ykyIodmGSXMGys3ETJfTEiMPb9AdiJ4',
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || getEnvVar('FIREBASE_AUTH_DOMAIN') || 'nova-26b39.firebaseapp.com',
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || getEnvVar('FIREBASE_PROJECT_ID') || 'nova-26b39',
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || getEnvVar('FIREBASE_STORAGE_BUCKET') || 'nova-26b39.firebasestorage.app',
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || getEnvVar('FIREBASE_MESSAGING_SENDER_ID') || '1078365953930',
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || getEnvVar('FIREBASE_APP_ID') || '1:1078365953930:web:c19ef73e47173979893273',
};

export const firebaseProjectId = firebaseConfig.projectId;

// Singleton pattern to prevent re-initialization during HMR or multiple server imports
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseApp = app;
export const auth = getAuth(app);

// Firestore instances exported for both { db } and { firestore } imports
export const firestore = getFirestore(app);
export const db = firestore;

export const waitForFirebaseAuthReady = (): Promise<User | null> => new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    unsubscribe();
    resolve(user);
  }, () => {
    unsubscribe();
    resolve(null);
  });
});

export const signInWithServerCustomToken = async (customToken: string) => {
  if (!customToken) throw new Error('Firebase custom token is missing.');
  const result = await signInWithCustomToken(auth, customToken);
  return result.user;
};

export const saveUserToFirestore = async (
  name: string,
  email: string,
  phone = '',
  isSignUp = false,
  address?: string,
  pinCode?: string,
  uid?: string
) => {
  const userId = uid || email || 'guestuser';
  const userData = Object.fromEntries(Object.entries({
    uid: userId,
    name,
    email,
    phone,
    address,
    pinCode,
    isSignUp,
    updatedAt: new Date().toISOString()
  }).filter(([, value]) => value !== undefined));

  await setDoc(doc(db, 'users', userId), userData, { merge: true });
  return userData;
};