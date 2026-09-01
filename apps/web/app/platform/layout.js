"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
      { href: "/platform/reports", label: "Reports", icon: "bar-chart-2" },
      { href: "/platform/users", label: "Users", icon: "users" },
    ],
  },
];

export default function PlatformLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

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
    api.platform
      .me(token)
      .then(() => setReady(true))
      .catch(() => router.replace("/platform/login"));
  }, [pathname, router]);

  if (pathname === "/platform/login") return children;
  if (!ready) return <div className="p-6">Loading…</div>;

  return (
    <AdminShell
      title="Zetro Platform"
      brand="Zetro"
      basePath="/platform"
      sections={sections}
      onLogout={() => clearToken("platform")}
    >
      {children}
    </AdminShell>
  );
}
