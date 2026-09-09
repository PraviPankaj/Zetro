"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProductCard from "../../../../components/store/ProductCard";
import ProductFilterTabs from "../../../../components/store/ProductFilterTabs";
import { api } from "../../../../lib/api";
import { filterProducts, findCategory, topLevelCategories } from "../../../../lib/storefront";

function CategoryPageContent() {
  const { slug, categorySlug } = useParams();
  const router = useRouter();
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

  const category = useMemo(() => findCategory(categories, categorySlug), [categories, categorySlug]);
  const tops = useMemo(() => topLevelCategories(categories), [categories]);
  const visible = useMemo(
    () => filterProducts(products, "", { categorySlug, categories }),
    [products, categorySlug, categories]
  );

  return (
    <section className="bg0 p-t-23 p-b-140">
      <div className="container">
        <div className="bread-crumb flex-w p-b-30">
          <Link href={`/${slug}`} className="stext-109 cl8 hov-cl1 trans-04">
            Home
            <i className="fa fa-angle-right m-l-9 m-r-10" aria-hidden="true" />
          </Link>
          <span className="stext-109 cl4">{category?.name || "Category"}</span>
        </div>

        <div className="p-b-10">
          <h3 className="ltext-103 cl5">{category?.name || "Browse"}</h3>
          <p className="stext-102 cl6 p-t-10">
            {loading ? "Loading…" : `${visible.length} product${visible.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="p-b-40">
          <ProductFilterTabs
            active={categorySlug}
            onChange={(id) => {
              if (id === "all") router.push(`/${slug}#catalog`);
              else router.push(`/${slug}/category/${id}`);
            }}
            items={[
              { id: "all", label: "All" },
              ...tops.map((cat) => ({ id: cat.slug, label: cat.name })),
            ]}
          />
        </div>

        {!loading && !category ? (
          <p className="stext-102 cl6">
            Category not found. <Link href={`/${slug}`}>Back to shop</Link>
          </p>
        ) : null}

        {!loading && category && visible.length === 0 ? (
          <p className="stext-102 cl6">No products in this category yet.</p>
        ) : null}

        {visible.length > 0 ? (
          <div className="row">
            {visible.map((p) => (
              <ProductCard key={p.id} slug={slug} product={p} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function CategoryPage() {
  return (
    <Suspense fallback={<div className="p-t-100 p-b-100 txt-center">Loading category…</div>}>
      <CategoryPageContent />
    </Suspense>
  );
}
