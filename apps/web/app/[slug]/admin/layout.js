"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import AdminShell from "../../../components/admin/AdminShell";
import { api, clearToken, getToken } from "../../../lib/api";

export default function ShopAdminLayout({ children }) {
  const { slug } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [shopName, setShopName] = useState(slug);

  const base = `/${slug}/admin`;
  const items = [
    { href: base, label: "Overview", icon: "home" },
    { href: `${base}/plans`, label: "Plans", icon: "package" },
    { href: `${base}/products`, label: "Stock", icon: "shopping-bag" },
    { href: `${base}/settings`, label: "Theme", icon: "layout" },
    { href: `${base}/orders`, label: "Orders", icon: "file-text" },
    { href: `${base}/payments`, label: "Payments", icon: "credit-card" },
  ];

  useEffect(() => {
    if (pathname === `${base}/login`) {
      setReady(true);
      return;
    }
    const token = getToken("shop", slug);
    if (!token) {
      router.replace(`${base}/login`);
      return;
    }
    api
      .shop(slug)
      .adminMe(token)
      .then((me) => {
        setShopName(me.shop?.name || slug);
        setReady(true);
      })
      .catch(() => router.replace(`${base}/login`));
  }, [pathname, slug, router, base]);

  if (pathname === `${base}/login`) return children;
  if (!ready) return <div className="p-6">Loading…</div>;

  return (
    <AdminShell
      title={shopName}
      brand={shopName}
      basePath={base}
      items={items}
      onLogout={() => clearToken("shop", slug)}
    >
      {children}
    </AdminShell>
  );
}
