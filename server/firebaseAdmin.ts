import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let initialized = false;
let initError: Error | null = null;

function getServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (json) {
    try {
      return JSON.parse(json);
    } catch (e) {
      console.warn("⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON environment variable.");
    }
  }

  if (base64) {
    try {
      const decoded = Buffer.from(base64, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch (e) {
      console.warn("⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable.");
    }
  }

  // Check explicit or fallback JSON path
  const accountPath = filePath || path.join(__dirname, "serviceAccount.json");

  if (fs.existsSync(accountPath)) {
    try {
      const contents = fs.readFileSync(accountPath, "utf8");
      return JSON.parse(contents);
    } catch (e) {
      console.warn("⚠️ Failed to read/parse service account file at " + accountPath);
    }
  }

  return null;
}

try {
  if (!getApps().length) {
    const serviceAccount = getServiceAccount();

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      initialized = true;
      console.log("✅ Firebase Admin initialized successfully");
    } else {
      console.warn("⚠️ Running Firebase Admin in local fallback mode (no service account JSON provided).");
    }
  } else {
    initialized = true;
  }
} catch (err) {
  initError = err as Error;
  console.error("❌ Firebase Admin init error:", err);
}

export const adminDb = initialized && getApps().length ? getFirestore() : null;
export { initialized, initError };