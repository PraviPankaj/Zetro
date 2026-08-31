"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import CategoryNav from "../../../components/store/CategoryNav";
import { api } from "../../../lib/api";
import { filterProducts, money } from "../../../lib/storefront";

function SearchResults() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const categorySlug = searchParams.get("category") || "";
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.shop(slug).catalog({ q: q || undefined, category: categorySlug || undefined }),
      api.shop(slug).categories.browse(),
    ])
      .then(([catalog, cats]) => {
        setProducts(catalog);
        setCategories(cats);
      })
      .finally(() => setLoading(false));
  }, [slug, q, categorySlug]);

  const results = useMemo(
    () => filterProducts(products, q, { categorySlug, categories }),
    [products, q, categorySlug, categories]
  );

  return (
    <section className="sf-section">
      <p className="sf-eyebrow">Search</p>
      <h1 className="sf-search-title">
        {q ? (
          <>
            Results for <span>&ldquo;{q}&rdquo;</span>
          </>
        ) : (
          "Search products"
        )}
      </h1>
      <p className="sf-search-meta">
        {loading ? "Searching…" : `${results.length} product${results.length === 1 ? "" : "s"} found`}
      </p>

      <CategoryNav slug={slug} categories={categories} activeSlug={categorySlug} />

      {!loading && results.length === 0 ? (
        <div className="sf-search-empty">
          <p>
            No matches yet. Try &ldquo;kids pants&rdquo;, &ldquo;plush&rdquo;, or browse a category above.
          </p>
          <Link href={`/${slug}`} className="sf-btn">
            Browse all
          </Link>
        </div>
      ) : (
        <div className="sf-grid">
          {results.map((p) => {
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
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="sf-section">Loading search…</div>}>
      <SearchResults />
    </Suspense>
  );
}
