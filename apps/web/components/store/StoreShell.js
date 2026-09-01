"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { api, clearToken, getToken, notifyAuthChange } from "../../lib/api";
import { themeClass } from "../../lib/storeThemes";
import StoreSearch from "./StoreSearch";

function StoreHeader({ slug, shop }) {
  const [cartCount, setCartCount] = useState(0);
  const [customer, setCustomer] = useState(null);

  const loadAuth = useCallback(() => {
    const token = getToken("customer", slug);
    if (!token) {
      setCustomer(null);
      setCartCount(0);
      return;
    }
    api
      .shop(slug)
      .customerMe(token)
      .then(setCustomer)
      .catch(() => {
        clearToken("customer", slug);
        setCustomer(null);
      });
    api
      .shop(slug)
      .cart.get(token)
      .then((c) => setCartCount(c.items?.length || 0))
      .catch(() => setCartCount(0));
  }, [slug]);

  useEffect(() => {
    loadAuth();
    window.addEventListener("zetro-auth", loadAuth);
    window.addEventListener("focus", loadAuth);
    return () => {
      window.removeEventListener("zetro-auth", loadAuth);
      window.removeEventListener("focus", loadAuth);
    };
  }, [loadAuth]);

  function logout() {
    clearToken("customer", slug);
    setCustomer(null);
    setCartCount(0);
    notifyAuthChange();
  }

  const displayName = customer?.name || customer?.phone || "there";

  return (
    <header className="sf-header">
      <div className="sf-header-inner">
        <Link href={`/${slug}`} className="sf-logo">
          {shop?.name || slug}
        </Link>
        <Suspense fallback={<div className="sf-search sf-search--loading" />}>
          <StoreSearch slug={slug} />
        </Suspense>
        <nav className="sf-nav">
          <Link href={`/${slug}`}>Home</Link>
          <Link href={`/${slug}#catalog`}>Shop</Link>
          <Link href={`/${slug}/cart`}>Cart{cartCount ? ` (${cartCount})` : ""}</Link>
          {customer ? (
            <div className="sf-user-menu">
              <span className="sf-user-greeting">Hi, {displayName}</span>
              <button type="button" className="sf-logout" onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <Link href={`/${slug}/login`} className="sf-login">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function StoreShell({ slug, children }) {
  const [shop, setShop] = useState(null);

  useEffect(() => {
    api.shop(slug).info().then(setShop).catch(() => setShop(null));
  }, [slug]);

  useEffect(() => {
    if (!shop) return;
    document.title = shop.meta_title || shop.name || slug;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = shop.meta_description || shop.description || "";
  }, [shop, slug]);

  const theme = shop?.storefront_theme || "playful";

  return (
    <div id="storefront" className={themeClass(theme)}>
      <StoreHeader slug={slug} shop={shop} />
      <main>{children}</main>
      <footer className="sf-footer">
        <p>
          Shop on Zetro · happy kids, happy parents ·{" "}
          <Link href={`/${slug}/admin/login`}>Shop admin</Link>
        </p>
      </footer>
    </div>
  );
}
