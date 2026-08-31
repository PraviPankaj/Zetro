"use client";

import { createClient } from "./zetroClient";

/**
 * Browser: same-origin "" so /api and /media go through Next rewrites.
 * Server / local: talk to FastAPI directly on :8000.
 */
function resolveApiBase() {
  const explicit = process.env.NEXT_PUBLIC_API_URL;
  if (explicit !== undefined && explicit !== "") {
    return explicit;
  }
  if (explicit === "") {
    if (typeof window === "undefined") {
      return process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
    }
    return "";
  }
  return process.env.API_INTERNAL_URL || "http://localhost:8000";
}

export const API_BASE = resolveApiBase();

export function tokenKey(kind, slug) {
  if (kind === "platform") return "zetro_platform_token";
  if (kind === "shop") return `zetro_shop_token_${slug}`;
  return `zetro_customer_token_${slug}`;
}

export function getToken(kind, slug) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(tokenKey(kind, slug));
}

export function setTokens(kind, slug, data) {
  localStorage.setItem(tokenKey(kind, slug), data.access_token);
  localStorage.setItem(`${tokenKey(kind, slug)}_refresh`, data.refresh_token);
}

export function clearToken(kind, slug) {
  localStorage.removeItem(tokenKey(kind, slug));
  localStorage.removeItem(`${tokenKey(kind, slug)}_refresh`);
}

export function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("zetro-auth"));
  }
}

export const api = createClient({
  baseUrl: API_BASE,
});
