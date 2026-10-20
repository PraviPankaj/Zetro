"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import BarcodeGenerator from "../../../../components/admin/BarcodeGenerator";
import { createShopBarcodeApi } from "../../../../lib/catalogApi";

export default function BarcodeGeneratorPage() {
  const { slug } = useParams();
  const barcodeApi = useMemo(() => createShopBarcodeApi(slug), [slug]);
  return <BarcodeGenerator barcodeApi={barcodeApi} />;
}
