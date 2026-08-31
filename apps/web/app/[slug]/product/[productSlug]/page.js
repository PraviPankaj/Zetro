"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Carousel from "../../../../components/store/Carousel";
import { api, getToken } from "../../../../lib/api";

function money(value) {
  if (value == null) return "";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function ProductPage() {
  const { slug, productSlug } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState(null);
  const [shop, setShop] = useState(null);
  const [variantId, setVariantId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.shop(slug).info().then(setShop);
    api
      .shop(slug)
      .product(productSlug)
      .then((p) => {
        setProduct(p);
        setVariantId(p.variants?.[0]?.id);
      });
  }, [slug, productSlug]);

  const slides = useMemo(() => {
    if (!product) return [];
    const images = product.images?.length
      ? product.images
      : [{ id: "ph", url: "https://images.unsplash.com/photo-1503454537847-efebaebad738?auto=format&fit=crop&w=1400&q=80" }];
    return images.map((im) => ({
      id: im.id,
      image: im.url,
    }));
  }, [product]);

  async function addToCart() {
    const token = getToken("customer", slug);
    if (!token) {
      router.push(`/${slug}/login`);
      return;
    }
    await api.shop(slug).cart.add(variantId, 1, token);
    setMessage("Added to cart");
  }

  if (!product) return <div className="sf-section">Loading…</div>;

  const variant = product.variants?.find((v) => v.id === variantId) || product.variants?.[0];

  return (
    <section className="sf-section sf-pdp">
      <div className="sf-pdp-gallery">
        <Carousel slides={slides} aspect="product" interval={5000} showDots />
      </div>
      <div className="sf-pdp-copy">
        <p className="sf-eyebrow">{shop?.name || "Kids store"}</p>
        <h1>{product.name}</h1>
        <div className="sf-price-row sf-price-row--lg">
          <span>{money(variant?.price)}</span>
          {variant?.compare_at_price ? <s>{money(variant.compare_at_price)}</s> : null}
        </div>
        <p className="sf-pdp-desc">{product.description}</p>
        <label className="sf-label" htmlFor="variant">
          Option
        </label>
        <select
          id="variant"
          className="sf-select"
          value={variantId || ""}
          onChange={(e) => setVariantId(Number(e.target.value))}
        >
          {(product.variants || []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} — {money(v.price)} ({v.stock} in stock)
            </option>
          ))}
        </select>
        <button className="sf-btn" type="button" onClick={addToCart}>
          Add to cart
        </button>
        {message ? <p className="sf-toast">{message}</p> : null}
      </div>
    </section>
  );
}
