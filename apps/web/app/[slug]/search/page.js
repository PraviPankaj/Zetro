"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ProductCard from "../../../components/store/ProductCard";
import ProductFilterTabs from "../../../components/store/ProductFilterTabs";
import { api } from "../../../lib/api";
import { filterProducts, topLevelCategories } from "../../../lib/storefront";

function SearchResults() {
  const { slug } = useParams();
  const router = useRouter();
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
  const tops = useMemo(() => topLevelCategories(categories), [categories]);

  function setCategoryFilter(id) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (id && id !== "all") params.set("category", id);
    const qs = params.toString();
    router.push(`/${slug}/search${qs ? `?${qs}` : ""}`);
  }

  return (
    <section className="bg0 p-t-23 p-b-140">
      <div className="container">
        <div className="p-b-10">
          <h3 className="ltext-103 cl5">
            {q ? <>Results for &ldquo;{q}&rdquo;</> : "Search products"}
          </h3>
          <p className="stext-102 cl6 p-t-10">
            {loading ? "Searching…" : `${results.length} product${results.length === 1 ? "" : "s"} found`}
          </p>
        </div>

        <div className="p-b-40">
          <ProductFilterTabs
            active={categorySlug || "all"}
            onChange={setCategoryFilter}
            items={[
              { id: "all", label: "All" },
              ...tops.map((cat) => ({ id: cat.slug, label: cat.name })),
            ]}
          />
        </div>

        {!loading && results.length === 0 ? (
          <p className="stext-102 cl6">
            No matches. <Link href={`/${slug}`}>Browse all</Link>
          </p>
        ) : (
          <div className="row">
            {results.map((p) => (
              <ProductCard key={p.id} slug={slug} product={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-t-100 p-b-100 txt-center">Loading search…</div>}>
      <SearchResults />
    </Suspense>
  );
}
