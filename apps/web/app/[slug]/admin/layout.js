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
  const sections = [
    {
      title: "General",
      items: [{ href: base, label: "Dashboard", icon: "home" }],
    },
    {
      title: "Product Management",
      items: [
        { href: `${base}/products`, label: "Products", icon: "shopping-bag" },
        { href: `${base}/categories`, label: "Categories", icon: "folder" },
      ],
    },
    {
      title: "Order Management",
      items: [{ href: `${base}/orders`, label: "Orders", icon: "file-text" }],
    },
    {
      title: "Store",
      items: [
        { href: `${base}/settings`, label: "Settings", icon: "settings" },
        { href: `${base}/payments`, label: "Payments", icon: "credit-card" },
      ],
    },
    {
      title: "Account",
      items: [{ href: `${base}/plans`, label: "Plans", icon: "package" }],
    },
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
      sections={sections}
      onLogout={() => clearToken("shop", slug)}
    >
      {children}
    </AdminShell>
  );
}
