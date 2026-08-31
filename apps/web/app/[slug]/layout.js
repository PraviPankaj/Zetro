"use client";

import { useParams, usePathname } from "next/navigation";
import StoreShell from "../../components/store/StoreShell";

export default function ShopLayout({ children }) {
  const { slug } = useParams();
  const pathname = usePathname();
  if (pathname?.includes("/admin")) return children;
  return <StoreShell slug={slug}>{children}</StoreShell>;
}
