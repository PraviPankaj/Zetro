"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import Carousel from "../../components/store/Carousel";
import CategoryNav from "../../components/store/CategoryNav";
import { api } from "../../lib/api";
import { filterProducts, money } from "../../lib/storefront";

const HERO_FALLBACKS = [
  {
    id: "h1",
    image:
      "https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=1800&q=80",
  },
  {
    id: "h2",
    image:
      "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1800&q=80",
  },
  {
    id: "h3",
    image:
      "https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=1800&q=80",
  },
];

export default function ShopHome() {
  return (
    <Suspense fallback={<div className="sf-section">Loading…</div>}>
      <ShopHomeContent />
    </Suspense>
  );
}

function ShopHomeContent() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const categorySlug = searchParams.get("category") || "";
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.shop(slug).info().then(setShop);
    api.shop(slug).catalog().then(setProducts);
    api.shop(slug).categories.browse().then(setCategories);
  }, [slug]);

  const visibleProducts = useMemo(
    () => filterProducts(products, query, { categorySlug, categories }),
    [products, query, categorySlug, categories]
  );

  const heroSlides = useMemo(() => {
    const withImages = products.filter((p) => p.images?.[0]?.url).slice(0, 4);
    if (!withImages.length) {
      return HERO_FALLBACKS.map((s, i) => ({
        ...s,
        eyebrow: shop?.name || "ABC Kids",
        title: i === 0 ? shop?.name || "ABC Kids" : "New for little ones",
        subtitle:
          shop?.description ||
          "Clothes, toys, and little treasures for growing explorers.",
        cta: "Shop kids",
        href: `/${slug}#catalog`,
      }));
    }
    return withImages.map((p, i) => ({
      id: p.id,
      image: p.images[0].url,
      eyebrow: shop?.name || "ABC Kids",
      title: i === 0 ? shop?.name || p.name : p.name,
      subtitle:
        i === 0
          ? shop?.description || p.description
          : p.description || "Made for play, naps, and big adventures.",
      cta: i === 0 ? "Shop kids" : "View product",
      href: i === 0 ? `/${slug}#catalog` : `/${slug}/product/${p.slug}`,
    }));
  }, [products, shop, slug]);

  const featuredSlides = useMemo(
    () =>
      products.slice(0, 6).map((p) => ({
        id: `f-${p.id}`,
        image: p.images?.[0]?.url || HERO_FALLBACKS[0].image,
        title: p.name,
        subtitle: money(p.variants?.[0]?.price),
        href: `/${slug}/product/${p.slug}`,
        cta: "View",
      })),
    [products, slug]
  );

  return (
    <>
      <section className="sf-hero-wrap">
        <Carousel slides={heroSlides} aspect="hero" interval={6000} />
      </section>

      <section className="sf-section sf-intro">
        <p className="sf-eyebrow">For little explorers</p>
        <h2>Playful picks, parent-approved</h2>
        <p>
          {shop?.description ||
            "A joyful edit of clothes, toys, and everyday essentials for babies and kids."}
        </p>
      </section>

      {featuredSlides.length && !query && !categorySlug ? (
        <section className="sf-section sf-featured">
          <div className="sf-section-head">
            <div>
              <p className="sf-eyebrow">Featured</p>
              <h2>Little favourites</h2>
            </div>
            <a className="sf-text-link" href="#catalog">
              Full catalog
            </a>
          </div>
          <Carousel slides={featuredSlides} aspect="feature" interval={4500} />
        </section>
      ) : null}

      <section className="sf-section" id="catalog">
        <div className="sf-section-head">
          <div>
            <p className="sf-eyebrow">In stock</p>
            <h2>
              {query
                ? `Results for “${query}”`
                : categorySlug
                  ? `In ${categories.find((c) => c.slug === categorySlug)?.name || "category"}`
                  : "Shop by category"}
            </h2>
          </div>
          {query || categorySlug ? (
            <Link href={`/${slug}`} className="sf-text-link">
              Clear filters
            </Link>
          ) : null}
        </div>

        <CategoryNav slug={slug} categories={categories} activeSlug={categorySlug} />
        {visibleProducts.length === 0 ? (
          <p className="sf-search-empty-inline">No products match your search.</p>
        ) : (
          <div className="sf-grid">
            {visibleProducts.map((p) => {
              const img = p.images?.[0]?.url;
              const price = p.variants?.[0]?.price;
              const compare = p.variants?.[0]?.compare_at_price;
              return (
                <Link key={p.id} href={`/${slug}/product/${p.slug}`} className="sf-product">
                  <div className="sf-product-media">
                    {img ? <img src={img} alt={p.name} /> : <div className="sf-product-ph" />}
                  </div>
                  <div className="sf-product-meta">
                    <h3>{p.name}</h3>
                    {(p.categories || []).length ? (
                      <p className="sf-product-cats">
                        {(p.categories || []).map((c) => c.name).join(" · ")}
                      </p>
                    ) : null}
                    <div className="sf-price-row">
                      <span>{money(price)}</span>
                      {compare ? <s>{money(compare)}</s> : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
