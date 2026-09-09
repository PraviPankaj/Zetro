"use client";

import Link from "next/link";
import { api } from "../../lib/api";
import { money } from "../../lib/storefront";
import { COZA_ASSETS } from "./CozaAssets";

const PLACEHOLDER = `${COZA_ASSETS}/images/product-01.jpg`;

export default function ProductCard({ slug, product }) {
  const href = `/${slug}/product/${product.slug}`;
  const img = product.images?.[0]?.url ? api.mediaUrl(product.images[0].url) : PLACEHOLDER;
  const price = product.variants?.[0]?.price;

  return (
    <div className="col-sm-6 col-md-4 col-lg-3 p-b-35">
      <div className="block2">
        <div className="block2-pic hov-img0 coza-product-pic">
          <img src={img} alt={product.name} />
          <Link
            href={href}
            className="block2-btn flex-c-m stext-103 cl2 size-102 bg0 bor2 hov-btn1 p-lr-15 trans-04"
          >
            View
          </Link>
        </div>
        <div className="block2-txt flex-w flex-t p-t-14">
          <div className="block2-txt-child1 flex-col-l ">
            <Link href={href} className="stext-104 cl4 hov-cl1 trans-04 js-name-b2 p-b-6 coza-product-name">
              {product.name}
            </Link>
            <span className="stext-105 cl3">{money(price)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
