"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminPageLoading from "../../components/admin/AdminPageLoading";
import AdminShell from "../../components/admin/AdminShell";
import { api, clearToken, getToken } from "../../lib/api";

const sections = [
  {
    title: "General",
    items: [{ href: "/platform", label: "Overview", icon: "home" }],
  },
  {
    title: "Management",
    items: [
      { href: "/platform/shops", label: "Shops", icon: "briefcase" },
      { href: "/platform/themes", label: "Themes", icon: "layout" },
      { href: "/platform/reports", label: "Reports", icon: "bar-chart-2" },
      { href: "/platform/users", label: "Users", icon: "users" },
    ],
  },
];

export default function PlatformLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const meOk = useRef(false);

  useEffect(() => {
    if (pathname === "/platform/login") {
      setReady(true);
      return;
    }
    const token = getToken("platform");
    if (!token) {
      router.replace("/platform/login");
      return;
    }

    if (meOk.current) {
      setReady(true);
      return;
    }

    let cancelled = false;
    api.platform
      .me(token)
      .then(() => {
        if (cancelled) return;
        meOk.current = true;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/platform/login");
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (pathname === "/platform/login") return children;
  if (!ready) return <AdminPageLoading label="Opening platform…" />;

  return (
    <AdminShell
      title="Zetro Platform"
      brand="Zetro"
      basePath="/platform"
      sections={sections}
      onLogout={() => {
        meOk.current = false;
        clearToken("platform");
      }}
    >
      {children}
    </AdminShell>
  );
}
