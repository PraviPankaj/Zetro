"use client";

import { createClient } from "./zetroClient";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
