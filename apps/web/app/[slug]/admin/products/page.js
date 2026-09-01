"use client";

import { Suspense, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "react-bootstrap";
import StockManager from "../../../../components/admin/StockManager";
import { createShopCatalogApi } from "../../../../lib/catalogApi";
import { exportShopProducts } from "../../../../lib/exportApi";

function ProductsContent() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const catalogApi = useMemo(() => createShopCatalogApi(slug), [slug]);
  const isDrafts = searchParams.get("filter") === "drafts";

  return (
    <StockManager
      catalogApi={catalogApi}
      title={isDrafts ? "Draft products" : "Products"}
      subtitle={isDrafts ? "Unpublished products (inactive)" : "Manage your product catalog"}
      initialStatusFilter={isDrafts ? "inactive" : ""}
      headerActions={
        <>
          <Button
            variant="outline-secondary"
            size="sm"
            href={isDrafts ? `/${slug}/admin/products` : `/${slug}/admin/products?filter=drafts`}
          >
            {isDrafts ? "All products" : "Drafts"}
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={() => exportShopProducts(slug)}>
            Export CSV
          </Button>
        </>
      }
    />
  );
}

export default function ShopProductsPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ProductsContent />
    </Suspense>
  );
}
