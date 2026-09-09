"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { COZA_ASSETS } from "./CozaAssets";

const FALLBACK_SLIDES = [
  {
    id: "1",
    image: `${COZA_ASSETS}/images/slide-01.jpg`,
    eyebrow: "New Collection",
    title: "NEW SEASON",
  },
  {
    id: "2",
    image: `${COZA_ASSETS}/images/slide-02.jpg`,
    eyebrow: "Fresh picks",
    title: "Shop the edit",
  },
  {
    id: "3",
    image: `${COZA_ASSETS}/images/slide-03.jpg`,
    eyebrow: "Just arrived",
    title: "New arrivals",
  },
];

export default function HeroSlider({ slug, shop, products }) {
  const [index, setIndex] = useState(0);

  const slides = (() => {
    const cms = (shop?.homepage_blocks || [])
      .filter((b) => b.image_url || b.title)
      .map((b, i) => ({
        id: b.id || `cms-${i}`,
        image: b.image_url?.startsWith("http") ? b.image_url : api.mediaUrl(b.image_url),
        eyebrow: b.subtitle || shop?.name || "Shop",
        title: b.title || shop?.name || "NEW SEASON",
        href: b.href || `/${slug}#catalog`,
        cta: b.cta || "Shop Now",
      }));
    if (cms.length) return cms;

    const withImages = (products || []).filter((p) => p.images?.[0]?.url).slice(0, 3);
    if (withImages.length) {
      return withImages.map((p, i) => ({
        id: p.id,
        image: api.mediaUrl(p.images[0].url),
        eyebrow: shop?.name || "Shop",
        title: i === 0 ? shop?.name || p.name : p.name,
        href: i === 0 ? `/${slug}#catalog` : `/${slug}/product/${p.slug}`,
        cta: "Shop Now",
      }));
    }
    return FALLBACK_SLIDES.map((s) => ({ ...s, href: `/${slug}#catalog`, cta: "Shop Now" }));
  })();

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [slides.length]);

  const slide = slides[index] || slides[0];
  if (!slide) return null;

  return (
    <section className="section-slide">
      <div className="wrap-slick1">
        <div
          className="item-slick1"
          style={{
            backgroundImage: `url(${slide.image})`,
            minHeight: 480,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="container h-full">
            <div className="flex-col-l-m h-full p-t-100 p-b-30 respon5">
              <span className="ltext-101 cl2 respon2">{slide.eyebrow}</span>
              <h2 className="ltext-201 cl2 p-t-19 p-b-43 respon1">{slide.title}</h2>
              <Link
                href={slide.href}
                className="flex-c-m stext-101 cl0 size-101 bg1 bor1 hov-btn1 p-lr-15 trans-04"
              >
                {slide.cta}
              </Link>
            </div>
          </div>
        </div>
        {slides.length > 1 ? (
          <div className="flex-c-m p-t-20 p-b-20" style={{ gap: 8 }}>
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: "none",
                  background: i === index ? "#717fe0" : "#ccc",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
