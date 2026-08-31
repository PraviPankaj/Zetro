"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import StockManager from "../../../../../components/admin/StockManager";
import { api, getToken } from "../../../../../lib/api";
import { createPlatformCatalogApi } from "../../../../../lib/catalogApi";

export default function PlatformShopStockPage() {
  const { shopId } = useParams();
  const [shop, setShop] = useState(null);
  const catalogApi = useMemo(() => createPlatformCatalogApi(shopId), [shopId]);

  useEffect(() => {
    api.platform.shops.get(Number(shopId), getToken("platform")).then(setShop);
  }, [shopId]);

  return (
    <StockManager
      catalogApi={catalogApi}
      title={`${shop?.name || "Shop"} — Stock & catalog`}
      subtitle={
        shop?.slug ? (
          <>
            Manage products and categories for{" "}
            <Link href={`/${shop.slug}`} target="_blank">
              /{shop.slug}
            </Link>
          </>
        ) : null
      }
      showThemePicker
      currentTheme={shop?.storefront_theme || "playful"}
      onThemeChange={(themeId) => setShop((s) => (s ? { ...s, storefront_theme: themeId } : s))}
      headerActions={
        <div className="d-flex gap-2">
          <Link href={`/platform/shops/${shopId}/reports`} className="btn btn-outline-primary">
            View reports
          </Link>
          <Link href="/platform/shops" className="btn btn-outline-secondary">
            All shops
          </Link>
        </div>
      }
    />
  );
}
