"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Immediate feedback on internal admin navigations.
 * App Router soft-navigations keep the old page on screen with no browser reload —
 * without this, slow compiles / data fetches feel like a freeze.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef(null);
  const pendingHrefRef = useRef("");

  useEffect(() => {
    // Keep the indicator briefly so it bridges into loading.js / first paint
    const t = setTimeout(() => {
      setPending(false);
      pendingHrefRef.current = "";
    }, 180);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    function shouldTrack(anchor) {
      if (!anchor) return false;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
      if (anchor.dataset.noProgress === "true") return false;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return false;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
        return url.pathname + url.search;
      } catch {
        return false;
      }
    }

    function start(href) {
      pendingHrefRef.current = href;
      setPending(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setPending(false), 12000);
    }

    function onClick(e) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = shouldTrack(e.target.closest?.("a[href]"));
      if (!href) return;
      start(href);
    }

    function onKeyDown(e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      const href = shouldTrack(e.target.closest?.("a[href]"));
      if (!href) return;
      start(href);
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!pending) return null;

  return (
    <>
      <div className="admin-nav-progress" role="progressbar" aria-label="Loading page" aria-busy="true">
        <div className="admin-nav-progress-bar" />
      </div>
      <div className="admin-nav-overlay" aria-hidden="true">
        <div className="admin-nav-overlay-card">
          <div className="admin-nav-spinner" />
          <span>Loading…</span>
        </div>
      </div>
    </>
  );
}
