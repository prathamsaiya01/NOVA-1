import { initializeApp, cert, getApps } from "firebase-admin/app";
import fs from "fs";
import fs from "fs";
import path from "path";

let initialized = false;
let initError: Error | null = null;

function getServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (json) {
    return JSON.parse(json);
  }

  if (base64) {
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(decoded);
  }

  if (path) {
    const content = fs.readFileSync(path, "utf8");
    return JSON.parse(content);
  }

  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_JSON is missing. Provide FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT_PATH"
  );

  // Fallback: allow a path to the service account JSON file
  const accountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, "serviceAccount.json");

  if (fs.existsSync(accountPath)) {
    try {
      const contents = fs.readFileSync(accountPath, "utf8");
      return JSON.parse(contents);
    } catch (e) {
      throw new Error("Failed to read/parse service account file at " + accountPath + ": " + (e as Error).message);
    }
  }

  throw new Error(
    `FIREBASE_SERVICE_ACCOUNT_JSON is missing and no service account file found at '${accountPath}'. Provide either the JSON in env or set FIREBASE_SERVICE_ACCOUNT_PATH to a valid file.`
  );
}

try {
  if (!getApps().length) {
    const serviceAccount = getServiceAccount();

    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    console.log("✅ Firebase Admin initialized");
  }

  initialized = true;
} catch (err) {
  initError = err as Error;
  console.error("❌ Firebase Admin init error:", err);
}

export { initialized, initError };