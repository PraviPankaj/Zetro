"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import AdminShell from "../../../components/admin/AdminShell";
import { api, clearToken, getToken } from "../../../lib/api";

function buildSections(base, mode) {
  const billingOps = {
    title: "Counter",
    items: [
      { href: `${base}/stock-in`, label: "Barcode stock", icon: "package" },
      { href: `${base}/billing`, label: "Billing", icon: "credit-card" },
      { href: `${base}/orders`, label: "Bills & refunds", icon: "file-text" },
    ],
  };
  const catalog = {
    title: "Product Management",
    items: [
      { href: `${base}/products`, label: "Products", icon: "shopping-bag" },
      { href: `${base}/categories`, label: "Categories", icon: "folder" },
      { href: `${base}/inventory`, label: "Inventory", icon: "package" },
    ],
  };
  const onlineOrders = {
    title: "Order Management",
    items: [
      { href: `${base}/orders`, label: "Orders", icon: "file-text" },
      { href: `${base}/customers`, label: "Customers", icon: "users" },
    ],
  };
  const marketing = {
    title: "Marketing",
    items: [{ href: `${base}/coupons`, label: "Coupons", icon: "tag" }],
  };
  const store = {
    title: "Store",
    items: [
      { href: `${base}/themes`, label: "Themes", icon: "layout" },
      { href: `${base}/settings`, label: "Settings", icon: "settings" },
      { href: `${base}/payments`, label: "Payments", icon: "credit-card" },
    ],
  };
  const account = {
    title: "Account",
    items: [{ href: `${base}/plans`, label: "Plans", icon: "package" }],
  };
  const general = {
    title: "General",
    items: [{ href: base, label: "Dashboard", icon: "home" }],
  };

  if (mode === "billing") {
    return [
      general,
      billingOps,
      {
        title: "Store",
        items: [{ href: `${base}/settings`, label: "Settings", icon: "settings" }],
      },
      account,
    ];
  }

  if (mode === "commerce") {
    return [general, catalog, onlineOrders, marketing, store, account];
  }

  // both
  return [
    general,
    {
      title: "Product Management",
      items: [
        { href: `${base}/products`, label: "Products", icon: "shopping-bag" },
        { href: `${base}/stock-in`, label: "Barcode stock", icon: "package" },
        { href: `${base}/categories`, label: "Categories", icon: "folder" },
        { href: `${base}/inventory`, label: "Inventory", icon: "package" },
      ],
    },
    {
      title: "Sales",
      items: [
        { href: `${base}/billing`, label: "Billing", icon: "credit-card" },
        { href: `${base}/orders`, label: "Orders & bills", icon: "file-text" },
        { href: `${base}/customers`, label: "Customers", icon: "users" },
      ],
    },
    marketing,
    store,
    account,
  ];
}

const BILLING_ALLOWED = new Set(["", "stock-in", "billing", "orders", "settings", "plans", "login"]);

export default function ShopAdminLayout({ children }) {
  const { slug } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [shopName, setShopName] = useState(slug);
  const [shopMode, setShopMode] = useState("both");

  const base = `/${slug}/admin`;
  const sections = useMemo(() => buildSections(base, shopMode), [base, shopMode]);

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
        const mode = me.shop?.shop_mode || "both";
        setShopMode(mode);
        setReady(true);

        if (mode === "billing") {
          const rest = pathname.replace(base, "").replace(/^\//, "").split("/")[0] || "";
          if (!BILLING_ALLOWED.has(rest)) {
            router.replace(`${base}/billing`);
          }
        }
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
