"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import CategoryNav from "../../../components/store/CategoryNav";
import { api } from "../../../lib/api";
import { filterProducts, findCategory, money } from "../../../lib/storefront";

function CategoryPageContent() {
  const { slug, categorySlug } = useParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.shop(slug).catalog(), api.shop(slug).categories.browse()])
      .then(([catalog, cats]) => {
        setProducts(catalog);
        setCategories(cats);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const category = useMemo(
    () => findCategory(categories, categorySlug),
    [categories, categorySlug]
  );

  const visible = useMemo(
    () => filterProducts(products, "", { categorySlug, categories }),
    [products, categorySlug, categories]
  );

  return (
    <section className="sf-section">
      <p className="sf-eyebrow">Category</p>
      <h1 className="sf-search-title">{category?.name || "Browse"}</h1>
      <p className="sf-search-meta">
        {loading
          ? "Loading…"
          : `${visible.length} product${visible.length === 1 ? "" : "s"} in this section`}
      </p>

      <CategoryNav slug={slug} categories={categories} activeSlug={categorySlug} />

      {!loading && !category ? (
        <div className="sf-search-empty">
          <p>Category not found.</p>
          <Link href={`/${slug}`} className="sf-btn">
            Back to shop
          </Link>
        </div>
      ) : null}

      {!loading && category && visible.length === 0 ? (
        <div className="sf-search-empty">
          <p>No products in this category yet.</p>
          <Link href={`/${slug}`} className="sf-btn">
            Browse all
          </Link>
        </div>
      ) : null}

      {visible.length > 0 ? (
        <div className="sf-grid">
          {visible.map((p) => {
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
      ) : null}
    </section>
  );
}

export default function CategoryPage() {
  return (
    <Suspense fallback={<div className="sf-section">Loading category…</div>}>
      <CategoryPageContent />
    </Suspense>
  );
}
