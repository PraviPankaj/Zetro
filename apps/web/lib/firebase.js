"use client";

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";

function readConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "";
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "";
  return { apiKey, authDomain, projectId, appId, messagingSenderId };
}

export function isFirebasePhoneAuthEnabled() {
  const c = readConfig();
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
}

export function getFirebaseAuth() {
  if (!isFirebasePhoneAuthEnabled()) {
    throw new Error("Firebase is not configured");
  }
  const c = readConfig();
  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          apiKey: c.apiKey,
          authDomain: c.authDomain,
          projectId: c.projectId,
          appId: c.appId,
          messagingSenderId: c.messagingSenderId || undefined,
        });
  const auth = getAuth(app);
  // Dev/testing only: skip reCAPTCHA for Firebase *test phone numbers* (configured in the
  // Firebase console). Real numbers still fail without verification, so this is safe to gate
  // on an env flag + localhost.
  if (
    process.env.NEXT_PUBLIC_FIREBASE_TEST_PHONES === "true" &&
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
  ) {
    auth.settings.appVerificationDisabledForTesting = true;
  }
  return auth;
}

/** Convert local 10-digit (or with 0/91) to E.164 for India by default. */
export function toE164(phone, defaultCountry = "91") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (String(phone).trim().startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+${defaultCountry}${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith(defaultCountry)) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * Ensure a RecaptchaVerifier exists for containerId (hidden by default).
 */
export function ensureRecaptcha(containerId = "firebase-recaptcha") {
  if (typeof window === "undefined") return null;
  const auth = getFirebaseAuth();
  if (window.__zetroRecaptchaVerifier) {
    return window.__zetroRecaptchaVerifier;
  }
  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement("div");
    el.id = containerId;
    document.body.appendChild(el);
  }
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => {
      window.__zetroRecaptchaVerifier = null;
    },
  });
  window.__zetroRecaptchaVerifier = verifier;
  return verifier;
}

export async function sendFirebasePhoneOtp(phone) {
  const auth = getFirebaseAuth();
  const e164 = toE164(phone);
  if (!e164 || e164.length < 10) {
    throw new Error("Enter a valid mobile number");
  }
  const verifier = ensureRecaptcha();
  const confirmation = await signInWithPhoneNumber(auth, e164, verifier);
  return confirmation;
}

export async function confirmFirebaseOtp(confirmationResult, otp) {
  const result = await confirmationResult.confirm(String(otp).trim());
  const idToken = await result.user.getIdToken();
  return { user: result.user, idToken };
}
