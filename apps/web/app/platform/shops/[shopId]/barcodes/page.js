"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BarcodeGenerator from "../../../../../components/admin/BarcodeGenerator";
import { api, getToken } from "../../../../../lib/api";
import { createPlatformBarcodeApi } from "../../../../../lib/catalogApi";

export default function PlatformShopBarcodesPage() {
  const { shopId } = useParams();
  const [shop, setShop] = useState(null);
  const barcodeApi = useMemo(() => createPlatformBarcodeApi(shopId), [shopId]);

  useEffect(() => {
    api.platform.shops.get(Number(shopId), getToken("platform")).then(setShop).catch(() => {});
  }, [shopId]);

  return (
    <BarcodeGenerator
      barcodeApi={barcodeApi}
      title={`${shop?.name || "Shop"} — Barcode generator`}
      subtitle={
        shop?.slug ? (
          <>
            Generate and print price labels for{" "}
            <Link href={`/${shop.slug}`} target="_blank">
              /{shop.slug}
            </Link>
            . Printing adds the label count to the shop&apos;s stock.
          </>
        ) : null
      }
      headerActions={
        <div className="d-flex gap-2">
          <Link href={`/platform/shops/${shopId}/stock`} className="btn btn-outline-primary">
            Stock &amp; catalog
          </Link>
          <Link href={`/platform/shops/${shopId}/settings`} className="btn btn-outline-secondary">
            GST &amp; settings
          </Link>
          <Link href={`/platform/shops/${shopId}/reports`} className="btn btn-outline-secondary">
            Reports
          </Link>
          <Link href="/platform/shops" className="btn btn-outline-secondary">
            All shops
          </Link>
        </div>
      }
    />
  );
}
