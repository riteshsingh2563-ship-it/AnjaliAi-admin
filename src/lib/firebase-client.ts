"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

// Client-side Firebase config. Every value here is intentionally exposed via
// NEXT_PUBLIC_* — none of these are secrets (they identify the project, not
// authorize access to it). Real authorization happens server-side.
export const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

export const isFirebaseClientConfigured = Boolean(
  firebaseClientConfig.apiKey &&
    firebaseClientConfig.authDomain &&
    firebaseClientConfig.projectId &&
    firebaseClientConfig.appId,
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseClientConfigured) return null;
  if (app) return app;
  app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseClientConfig);
  return app;
}

export function getFirebaseAuth(): Auth | null {
  if (authInstance) return authInstance;
  const a = getFirebaseApp();
  if (!a) return null;
  authInstance = getAuth(a);
  return authInstance;
}

export function getGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}
