"use client";

import { getToken } from "./api";

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportShopOrders(slug) {
  const { api } = await import("./api");
  const { blob, filename } = await api.shop(slug).exportOrders(getToken("shop", slug));
  downloadBlob(blob, filename);
}

export async function exportShopProducts(slug) {
  const { api } = await import("./api");
  const { blob, filename } = await api.shop(slug).exportProducts(getToken("shop", slug));
  downloadBlob(blob, filename);
}
