"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, getToken, notifyAuthChange } from "../../../../lib/api";
import { money } from "../../../../lib/storefront";
import { COZA_ASSETS } from "../../../../components/store/CozaAssets";

export default function ProductPage() {
  const { slug, productSlug } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState(null);
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .shop(slug)
      .product(productSlug)
      .then((p) => {
        setProduct(p);
        setVariantId(p.variants?.[0]?.id);
      });
  }, [slug, productSlug]);

  async function addToCart() {
    const token = getToken("customer", slug);
    if (!token) {
      router.push(`/${slug}/login`);
      return;
    }
    await api.shop(slug).cart.add(variantId, qty, token);
    notifyAuthChange();
    setMessage("Added to cart");
  }

  if (!product) {
    return <div className="p-t-100 p-b-100 txt-center">Loading…</div>;
  }

  const images = product.images?.length
    ? product.images.map((im) => api.mediaUrl(im.url))
    : [`${COZA_ASSETS}/images/product-detail-01.jpg`];
  const variant = product.variants?.find((v) => v.id === variantId) || product.variants?.[0];

  return (
    <>
      <div className="container">
        <div className="bread-crumb flex-w p-l-25 p-r-15 p-t-30 p-lr-0-lg">
          <Link href={`/${slug}`} className="stext-109 cl8 hov-cl1 trans-04">
            Home
            <i className="fa fa-angle-right m-l-9 m-r-10" aria-hidden="true" />
          </Link>
          <span className="stext-109 cl4">{product.name}</span>
        </div>
      </div>

      <section className="sec-product-detail bg0 p-t-65 p-b-60">
        <div className="container">
          <div className="row">
            <div className="col-md-6 col-lg-7 p-b-30">
              <div className="p-l-25 p-r-30 p-lr-0-lg">
                <div className="wrap-slick3 flex-sb flex-w">
                  <div className="wrap-slick3-slides">
                    <div className="item-slick3">
                      <div className="wrap-pic-w pos-relative">
                        <img src={images[activeImg]} alt={product.name} />
                      </div>
                    </div>
                  </div>
                  {images.length > 1 ? (
                    <div className="flex-w p-t-20" style={{ gap: 8 }}>
                      {images.map((src, i) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => setActiveImg(i)}
                          style={{
                            border: i === activeImg ? "2px solid #717fe0" : "1px solid #eee",
                            padding: 0,
                            background: "none",
                            width: 64,
                            height: 64,
                            overflow: "hidden",
                          }}
                        >
                          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="col-md-6 col-lg-5 p-b-30">
              <div className="p-r-50 p-t-5 p-lr-0-lg">
                <h4 className="mtext-105 cl2 js-name-detail p-b-14">{product.name}</h4>
                <span className="mtext-106 cl2">{money(variant?.price)}</span>
                {variant?.compare_at_price ? (
                  <span className="stext-105 cl3 m-l-10" style={{ textDecoration: "line-through" }}>
                    {money(variant.compare_at_price)}
                  </span>
                ) : null}
                <p className="stext-102 cl3 p-t-23">{product.description || "—"}</p>

                <div className="p-t-33">
                  {(product.variants || []).length > 1 ? (
                    <div className="flex-w flex-r-m p-b-10">
                      <div className="size-203 flex-c-m respon6">Option</div>
                      <div className="size-204 respon6-next">
                        <div className="rs1-select2 bor8 bg0">
                          <select
                            className="form-control"
                            value={variantId || ""}
                            onChange={(e) => setVariantId(Number(e.target.value))}
                          >
                            {(product.variants || []).map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} — {money(v.price)} ({v.stock} in stock)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex-w flex-r-m p-b-10">
                    <div className="size-204 flex-w flex-m respon6-next">
                      <div className="wrap-num-product flex-w m-r-20 m-tb-10">
                        <button
                          type="button"
                          className="btn-num-product-down cl8 hov-btn3 trans-04 flex-c-m"
                          onClick={() => setQty((q) => Math.max(1, q - 1))}
                          style={{ background: "none", border: "none" }}
                        >
                          <i className="fs-16 zmdi zmdi-minus" />
                        </button>
                        <input
                          className="mtext-104 cl3 txt-center num-product"
                          type="number"
                          value={qty}
                          min={1}
                          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                        />
                        <button
                          type="button"
                          className="btn-num-product-up cl8 hov-btn3 trans-04 flex-c-m"
                          onClick={() => setQty((q) => q + 1)}
                          style={{ background: "none", border: "none" }}
                        >
                          <i className="fs-16 zmdi zmdi-plus" />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="flex-c-m stext-101 cl0 size-101 bg1 bor1 hov-btn1 p-lr-15 trans-04"
                        onClick={addToCart}
                      >
                        Add to cart
                      </button>
                    </div>
                  </div>
                  {message ? <p className="stext-102 cl1 p-t-20">{message}</p> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
