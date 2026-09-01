"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import StockManager from "../../../../components/admin/StockManager";
import { createShopCatalogApi } from "../../../../lib/catalogApi";

export default function ShopProductsPage() {
  const { slug } = useParams();
  const catalogApi = useMemo(() => createShopCatalogApi(slug), [slug]);

  return (
    <StockManager
      catalogApi={catalogApi}
      title="Products"
      subtitle="Manage your product catalog"
    />
  );
}
